import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, tenantDatabases, platformAuditLogs } from '@/lib/platform/schema';
import { closeTenantPool, getTenantDb } from '@/lib/db/tenant-pool-manager';
import {
  users,
  systemConfig,
  branches,
  fiscalYears,
  taxRateSlabs,
  leaveTypes,
  leaveRules,
  otRules,
  payHeads,
} from '@/lib/db/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { validatePhoneNumber } from '@/lib/utils/phone';
import { eq, and, ne } from 'drizzle-orm';
import postgres from 'postgres';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    await ensurePlatformTablesExist();
    const { id } = await params;

    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found.' }, { status: 404 });
    }

    const [tenantDbRecord] = await platformDb
      .select()
      .from(tenantDatabases)
      .where(eq(tenantDatabases.companyId, id))
      .limit(1);

    return NextResponse.json({
      success: true,
      company,
      database: tenantDbRecord
        ? {
            dbName: tenantDbRecord.dbName,
            dbHost: tenantDbRecord.dbHost,
            dbPort: tenantDbRecord.dbPort,
            dbUser: tenantDbRecord.dbUser,
            schemaVersion: tenantDbRecord.schemaVersion,
            lastHealthStatus: tenantDbRecord.lastHealthStatus,
            lastHealthAt: tenantDbRecord.lastHealthAt,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error getting company:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch company details.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();
    const { id } = await params;
    const body = await request.json();

    const [existing] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Company not found.' }, { status: 404 });
    }

    const updates: Partial<typeof companies.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Lifecycle Action Dispatcher
    const lifecycleAction = body.action as 'SUSPEND' | 'REACTIVATE' | 'ARCHIVE' | 'RESTORE' | undefined;

    if (lifecycleAction === 'SUSPEND') {
      updates.status = 'SUSPENDED';
      updates.suspendedAt = new Date();
      await closeTenantPool(existing.slug);
    } else if (lifecycleAction === 'REACTIVATE') {
      updates.status = 'ACTIVE';
      updates.suspendedAt = null;
    } else if (lifecycleAction === 'ARCHIVE') {
      updates.status = 'ARCHIVED';
      updates.archivedAt = new Date();
      await closeTenantPool(existing.slug);
    } else if (lifecycleAction === 'RESTORE') {
      updates.status = 'ACTIVE';
      updates.archivedAt = null;
    } else if (body.status && ['PENDING', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED', 'REJECTED'].includes(body.status)) {
      updates.status = body.status;
      if (body.status !== 'ACTIVE' && existing.status === 'ACTIVE') {
        await closeTenantPool(existing.slug);
      }
    }

    // Uniqueness validation for companyCode if updated
    if (body.companyCode && body.companyCode.trim().toUpperCase() !== existing.companyCode) {
      const newCode = body.companyCode.trim().toUpperCase();
      const [duplicateCode] = await platformDb
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.companyCode, newCode), ne(companies.id, id)))
        .limit(1);

      if (duplicateCode) {
        return NextResponse.json(
          { success: false, error: `Company Code "${newCode}" is already taken.` },
          { status: 400 }
        );
      }
      updates.companyCode = newCode;
    }

    // Editable metadata
    if (body.displayName) updates.displayName = String(body.displayName).trim();
    if (body.legalName) updates.legalName = String(body.legalName).trim();
    if (body.contactEmail) updates.contactEmail = String(body.contactEmail).trim().toLowerCase();
    if (body.contactPhone !== undefined) {
      if (body.contactPhone && String(body.contactPhone).trim()) {
        const phoneVal = validatePhoneNumber(String(body.contactPhone));
        if (!phoneVal.isValid) {
          return NextResponse.json(
            { success: false, error: phoneVal.error || 'Invalid contact phone number format.' },
            { status: 400 }
          );
        }
        updates.contactPhone = phoneVal.formatted || String(body.contactPhone).trim();
      } else {
        updates.contactPhone = null;
      }
    }
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null;
    if (body.industryType) updates.industryType = String(body.industryType).trim();
    if (body.panVatNumber !== undefined) updates.panVatNumber = body.panVatNumber ? String(body.panVatNumber).trim() : null;
    if (body.registrationNumber !== undefined) updates.registrationNumber = body.registrationNumber ? String(body.registrationNumber).trim() : null;
    if (body.headOfficeAddress !== undefined) updates.headOfficeAddress = body.headOfficeAddress ? String(body.headOfficeAddress).trim() : null;
    if (body.headOfficeBranchCode !== undefined) updates.headOfficeBranchCode = body.headOfficeBranchCode ? String(body.headOfficeBranchCode).trim().toUpperCase() : 'HO-01';
    if (body.headOfficeBranchAddress !== undefined) updates.headOfficeBranchAddress = body.headOfficeBranchAddress ? String(body.headOfficeBranchAddress).trim() : null;

    if (body.initialSetupPayload !== undefined) {
      const existingPayload = (existing.initialSetupPayload as any) || {};
      updates.initialSetupPayload = {
        ...existingPayload,
        ...body.initialSetupPayload,
      };
    }

    const [updatedCompany] = await platformDb
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id))
      .returning();

    // Synchronize company profile changes (PAN, Reg No, Address, Phone, Legal Name) to tenant DB systemConfig
    try {
      const tenantDb = await getTenantDb(existing.slug);
      if (tenantDb) {
        const syncConfigs: Array<{ key: string; value: string }> = [];
        if (updates.panVatNumber !== undefined) syncConfigs.push({ key: 'company_pan_vat', value: updates.panVatNumber || '' });
        if (updates.registrationNumber !== undefined) syncConfigs.push({ key: 'company_registration_no', value: updates.registrationNumber || '' });
        if (updates.headOfficeAddress !== undefined) syncConfigs.push({ key: 'company_office_address', value: updates.headOfficeAddress || '' });
        if (updates.contactPhone !== undefined) syncConfigs.push({ key: 'company_phone', value: updates.contactPhone || '' });
        if (updates.legalName !== undefined) syncConfigs.push({ key: 'company_legal_name', value: updates.legalName });
        if (updates.displayName !== undefined) syncConfigs.push({ key: 'company_display_name', value: updates.displayName });

        for (const cfg of syncConfigs) {
          await tenantDb
            .insert(systemConfig)
            .values({
              key: cfg.key,
              value: cfg.value,
              dataType: 'string',
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: systemConfig.key,
              set: { value: cfg.value, updatedAt: new Date() },
            });
        }

        // Synchronize contactEmail change to tenant DB admin user and system config
        if (updates.contactEmail && updates.contactEmail !== existing.contactEmail) {
          await tenantDb
            .update(users)
            .set({
              email: updates.contactEmail,
              updatedAt: new Date(),
            })
            .where(eq(users.email, existing.contactEmail.toLowerCase()));

          await tenantDb
            .insert(systemConfig)
            .values({
              key: 'company_email',
              value: updates.contactEmail,
              dataType: 'string',
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: systemConfig.key,
              set: { value: updates.contactEmail, updatedAt: new Date() },
            });
        }

        // Synchronize industryType change to tenant DB system_config
        if (updates.industryType && updates.industryType !== existing.industryType) {
          await tenantDb
            .insert(systemConfig)
            .values({
              key: 'company_industry_type',
              value: updates.industryType,
              dataType: 'string',
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: systemConfig.key,
              set: { value: updates.industryType, updatedAt: new Date() },
            });
        }

        // Synchronize primary branch code and address
        if (updates.headOfficeBranchCode !== undefined || updates.headOfficeBranchAddress !== undefined) {
          const targetBranchCode = updates.headOfficeBranchCode || existing.headOfficeBranchCode || 'HO-01';
          const targetBranchAddress = updates.headOfficeBranchAddress || updates.headOfficeAddress || existing.headOfficeBranchAddress || existing.headOfficeAddress || 'Head Office';
          const targetPhone = updates.contactPhone || existing.contactPhone || 'N/A';
          const targetEmail = updates.contactEmail || existing.contactEmail;

          const existingBranches = await tenantDb.select().from(branches).limit(5);
          const primaryBranch = existingBranches.find(b => b.code === existing.headOfficeBranchCode || b.name === 'Head Office') || existingBranches[0];

          if (primaryBranch) {
            await tenantDb
              .update(branches)
              .set({
                code: targetBranchCode,
                location: targetBranchAddress,
                phone: targetPhone,
                email: targetEmail,
                updatedAt: new Date(),
              })
              .where(eq(branches.id, primaryBranch.id));
          } else {
            await tenantDb.insert(branches).values({
              code: targetBranchCode,
              name: 'Head Office',
              location: targetBranchAddress,
              phone: targetPhone,
              email: targetEmail,
              status: 'active',
            }).onConflictDoNothing();
          }
        }

        // Synchronize active fiscal year
        if (body.initialSetupPayload?.fiscalYear) {
          const fy = body.initialSetupPayload.fiscalYear;
          if (fy.label) {
            const existingFYs = await tenantDb.select().from(fiscalYears);
            const activeFY = existingFYs.find(f => f.status === 'Active') || existingFYs.find(f => f.slug === fy.slug) || existingFYs[0];

            if (activeFY) {
              await tenantDb
                .update(fiscalYears)
                .set({
                  label: fy.label,
                  slug: fy.slug || activeFY.slug,
                  startDateBS: fy.startDateBS || activeFY.startDateBS,
                  endDateBS: fy.endDateBS || activeFY.endDateBS,
                  startDateAD: fy.startDateAD ? new Date(fy.startDateAD) : activeFY.startDateAD,
                  endDateAD: fy.endDateAD ? new Date(fy.endDateAD) : activeFY.endDateAD,
                  status: 'Active',
                })
                .where(eq(fiscalYears.id, activeFY.id));
            } else {
              await tenantDb.insert(fiscalYears).values({
                label: fy.label,
                slug: fy.slug,
                fromMonth: 4,
                toMonth: 3,
                startDateBS: fy.startDateBS,
                endDateBS: fy.endDateBS,
                startDateAD: new Date(fy.startDateAD),
                endDateAD: new Date(fy.endDateAD),
                status: 'Active',
                payslipsGenerated: false,
              }).onConflictDoNothing();
            }
          }
        }

        // Synchronize overtime multiplier
        if (body.initialSetupPayload?.otHourlyMultiplier !== undefined) {
          const otMult = String(body.initialSetupPayload.otHourlyMultiplier);
          const [standardOT] = await tenantDb
            .select()
            .from(otRules)
            .where(eq(otRules.platformCode, 'OT_STANDARD'))
            .limit(1);

          if (standardOT) {
            await tenantDb
              .update(otRules)
              .set({
                rateOfficeDay: otMult,
                rateOffDay: otMult,
                updatedAt: new Date(),
              })
              .where(eq(otRules.id, standardOT.id));
          } else {
            await tenantDb.insert(otRules).values({
              ruleName: `Standard Nepal Labour Act Overtime (${otMult}x)`,
              ruleType: 'Hourly',
              rateOfficeDay: otMult,
              rateOffDay: otMult,
              isPlatformLocked: true,
              platformCode: 'OT_STANDARD',
              isActive: true,
            }).onConflictDoNothing();
          }
        }

        // Synchronize leave types & statutory leave rules
        if (Array.isArray(body.initialSetupPayload?.leaveTypes)) {
          for (const lt of body.initialSetupPayload.leaveTypes) {
            const [existingLT] = await tenantDb
              .select()
              .from(leaveTypes)
              .where(eq(leaveTypes.code, lt.code))
              .limit(1);

            let ltId: string;
            if (existingLT) {
              await tenantDb
                .update(leaveTypes)
                .set({
                  name: lt.name,
                  leaveType: lt.isPaid ? 'Pay' : 'Non-Pay',
                  noOfDays: String(lt.daysPerYear),
                  carryForward: (lt.maxAccumulation || 0) > 0,
                  accumulationCap: String(lt.maxAccumulation || 0),
                  genderApplicable: lt.genderSpecific || 'All',
                  isEncashable: Boolean(lt.isEncashable),
                  updatedAt: new Date(),
                })
                .where(eq(leaveTypes.id, existingLT.id));
              ltId = existingLT.id;
            } else {
              const [newLT] = await tenantDb
                .insert(leaveTypes)
                .values({
                  name: lt.name,
                  code: lt.code,
                  leaveType: lt.isPaid ? 'Pay' : 'Non-Pay',
                  noOfDays: String(lt.daysPerYear),
                  carryForward: (lt.maxAccumulation || 0) > 0,
                  accumulationCap: String(lt.maxAccumulation || 0),
                  isStatutory: true,
                  statutoryCode: lt.code,
                  genderApplicable: lt.genderSpecific || 'All',
                  isEncashable: Boolean(lt.isEncashable),
                  encashmentBasis: 'BasicSalary',
                  proRataForNewJoinees: true,
                  isPlatformLocked: true,
                  isActive: true,
                })
                .returning({ id: leaveTypes.id });
              ltId = newLT.id;
            }

            // Sync corresponding leave rule
            const isDaysWorked = lt.code === 'HOME' || lt.code === 'SUBSTITUTE';
            const accrualMethod = isDaysWorked ? 'DAYS_WORKED' : 'FIXED_ANNUAL';
            const accrualValue = lt.code === 'HOME' ? '20' : String(lt.daysPerYear);

            const [existingRule] = await tenantDb
              .select()
              .from(leaveRules)
              .where(eq(leaveRules.leaveTypeId, ltId))
              .limit(1);

            if (existingRule) {
              await tenantDb
                .update(leaveRules)
                .set({
                  accrualMethod,
                  accrualValue,
                  updatedAt: new Date(),
                })
                .where(eq(leaveRules.id, existingRule.id));
            } else {
              await tenantDb.insert(leaveRules).values({
                leaveTypeId: ltId,
                ruleName: `${lt.name.split(' (')[0]} Statutory Rule`,
                ruleCategory: 'STATUTORY',
                accrualMethod,
                accrualValue,
                encashmentRate: 'BASIC_DAILY',
                encashmentFixedAmount: '0',
                minServiceDaysForEligibility: 0,
                isPlatformLocked: true,
                isActive: true,
              }).onConflictDoNothing();
            }
          }
        }

        // Synchronize pay heads
        if (Array.isArray(body.initialSetupPayload?.payHeads)) {
          for (const ph of body.initialSetupPayload.payHeads) {
            const [existingPH] = await tenantDb
              .select()
              .from(payHeads)
              .where(eq(payHeads.code, ph.code))
              .limit(1);

            if (existingPH) {
              await tenantDb
                .update(payHeads)
                .set({
                  name: ph.name,
                  type: ph.type === 'EARNING' ? 'allowance' : 'deduction',
                  effectOnTax: ph.isTaxable,
                  isFestivalAllowance: ph.code === 'FESTIVAL',
                  isSsfHead: Boolean(ph.isSsfHead),
                  isCitHead: Boolean(ph.isCitHead),
                  isPfHead: Boolean(ph.isPfHead),
                  isTdsHead: Boolean(ph.isTdsHead),
                  updatedAt: new Date(),
                })
                .where(eq(payHeads.id, existingPH.id));
            } else {
              await tenantDb.insert(payHeads).values({
                name: ph.name,
                code: ph.code,
                type: ph.type === 'EARNING' ? 'allowance' : 'deduction',
                effectOnTax: ph.isTaxable,
                calcBasis: 'BasicSalary',
                calcParameter: 'BasicSalary',
                calcPercent: '0',
                isFestivalAllowance: ph.code === 'FESTIVAL',
                isSsfHead: Boolean(ph.isSsfHead),
                isCitHead: Boolean(ph.isCitHead),
                isPfHead: Boolean(ph.isPfHead),
                isTdsHead: Boolean(ph.isTdsHead),
              }).onConflictDoNothing();
            }
          }
        }

        // Synchronize tax rate slabs for the active fiscal year
        if (Array.isArray(body.initialSetupPayload?.taxSlabs)) {
          const [activeFY] = await tenantDb
            .select({ id: fiscalYears.id })
            .from(fiscalYears)
            .where(eq(fiscalYears.status, 'Active'))
            .limit(1);

          if (activeFY) {
            await tenantDb
              .delete(taxRateSlabs)
              .where(eq(taxRateSlabs.fiscalYearId, activeFY.id));

            for (const slab of body.initialSetupPayload.taxSlabs) {
              await tenantDb.insert(taxRateSlabs).values({
                fiscalYearId: activeFY.id,
                category: slab.category,
                amountFrom: String(slab.amountFrom),
                amountTo: slab.amountTo !== null && slab.amountTo !== undefined && slab.amountTo !== '' ? String(slab.amountTo) : null,
                ratePercent: String(slab.ratePercent),
                fixedDeduction: String(slab.fixedDeduction || '0'),
              });
            }
          }
        }
      }
    } catch (tenantSyncErr) {
      console.warn('[PLATFORM_COMPANY_UPDATE] Failed to sync configuration to tenant database:', tenantSyncErr);
    }

    // Audit log
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: lifecycleAction ? `COMPANY_${lifecycleAction}` : 'COMPANY_UPDATE',
      companyId: id,
      meta: {
        updates,
        previousStatus: existing.status,
        newStatus: updatedCompany.status,
        lifecycleAction,
      },
    });

    return NextResponse.json({
      success: true,
      company: updatedCompany,
      message: lifecycleAction
        ? `Company ${existing.companyCode} status changed to ${updatedCompany.status}.`
        : 'Company details and configurations updated successfully.',
    });
  } catch (error: any) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update company.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();
    const { id } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty if called without json payload
    }

    const { confirmCode, purgeDatabase = true } = body || {};

    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!company) {
      return NextResponse.json({ success: false, error: 'Company not found.' }, { status: 404 });
    }

    // Safety validation: verify confirmation code matches
    if (confirmCode && confirmCode.trim().toUpperCase() !== company.companyCode.toUpperCase()) {
      return NextResponse.json(
        {
          success: false,
          error: `Confirmation code mismatch. Expected "${company.companyCode}", got "${confirmCode}".`,
        },
        { status: 400 }
      );
    }

    // 1. Close active in-memory connection pool
    await closeTenantPool(company.slug);

    // 2. Terminate and drop isolated PostgreSQL database
    const [tenantDbRecord] = await platformDb
      .select()
      .from(tenantDatabases)
      .where(eq(tenantDatabases.companyId, id))
      .limit(1);

    let dbDropSuccess = false;
    if (tenantDbRecord && purgeDatabase) {
      try {
        const mainDbUrl = process.env.DATABASE_URL!;
        const urlObj = new URL(mainDbUrl.replace('postgresql://', 'http://'));
        const dbUser = urlObj.username || 'postgres';
        const dbPasswordPlain = urlObj.password || 'admin';
        const dbHost = urlObj.hostname || '127.0.0.1';
        const dbPort = urlObj.port || '5432';

        const adminPgUrl = `postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:${dbPort}/postgres`;
        const adminSql = postgres(adminPgUrl, { max: 1 });

        try {
          // Terminate any active sessions to the target database
          await adminSql.unsafe(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = '${tenantDbRecord.dbName}' AND pid <> pg_backend_pid();
          `);
          // Drop the physical database
          await adminSql.unsafe(`DROP DATABASE IF EXISTS "${tenantDbRecord.dbName}"`);
          dbDropSuccess = true;
        } finally {
          await adminSql.end();
        }
      } catch (dropErr: any) {
        console.error(`Notice: Failed to drop database ${tenantDbRecord.dbName}:`, dropErr);
      }
    }

    // 3. Cascade-delete company records in platform DB
    await platformDb.delete(companies).where(eq(companies.id, id));

    // 4. Immutable audit trail
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'COMPANY_PERMANENT_PURGE',
      meta: {
        companyCode: company.companyCode,
        slug: company.slug,
        legalName: company.legalName,
        dbName: tenantDbRecord?.dbName || `pay_t_${company.slug}`,
        dbDropSuccess,
        purgedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Company ${company.companyCode} (${company.legalName}) and database pay_t_${company.slug} permanently purged.`,
      dbDropped: dbDropSuccess,
    });
  } catch (error: any) {
    console.error('Error permanently deleting company:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete company.' },
      { status: 500 }
    );
  }
}

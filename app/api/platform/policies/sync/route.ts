import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { platformPolicyPacks, platformAuditLogs, companies } from '@/lib/platform/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { getTenantDb } from '@/lib/db/tenant-pool-manager';
import { leaveTypes, otRules, auditLogs, payHeads, taxRateSlabs, fiscalYears } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { DEFAULT_NEPAL_POLICY_PACK_V1, StatutoryPolicyPackPayload } from '@/lib/platform/policy-pack-data';

export async function POST(request: Request) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable; defaults to active published pack
    }

    const { version } = body || {};

    // 1. Fetch target policy pack
    let packRecord;
    if (version) {
      const [found] = await platformDb
        .select()
        .from(platformPolicyPacks)
        .where(eq(platformPolicyPacks.version, Number(version)))
        .limit(1);
      packRecord = found;
    } else {
      const [published] = await platformDb
        .select()
        .from(platformPolicyPacks)
        .where(eq(platformPolicyPacks.isPublished, true))
        .orderBy(desc(platformPolicyPacks.version))
        .limit(1);
      packRecord = published;
    }

    const packPayload: StatutoryPolicyPackPayload =
      (packRecord?.payload as StatutoryPolicyPackPayload) || DEFAULT_NEPAL_POLICY_PACK_V1;

    // 2. Fetch all ACTIVE tenant companies
    const activeCompanies = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.status, 'ACTIVE'));

    if (activeCompanies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tenant companies to sync.',
        syncedCount: 0,
        syncedCompanies: [],
      });
    }

    const syncedCompanies: Array<{ id: string; name: string; slug: string }> = [];
    const syncErrors: Array<{ slug: string; error: string }> = [];

    // 3. Sync to each tenant DB
    for (const company of activeCompanies) {
      try {
        const tenantDb = await getTenantDb(company.slug);
        if (!tenantDb) {
          syncErrors.push({ slug: company.slug, error: 'Could not connect to tenant database.' });
          continue;
        }

        // A. Upsert Statutory Leave Types
        for (const lr of packPayload.leaveRules || []) {
          await tenantDb
            .insert(leaveTypes)
            .values({
              name: lr.name,
              code: lr.code,
              leaveType: lr.leaveType,
              noOfDays: String(lr.daysPerYear),
              accumulationCap: lr.maxAccumulation ? String(lr.maxAccumulation) : null,
              maxPaidDays: lr.maxPaidDays ? String(lr.maxPaidDays) : null,
              isStatutory: true,
              statutoryCode: lr.statutoryCode,
              genderApplicable: lr.genderApplicable || 'All',
              requiresDocument: Boolean(lr.requiresDocument),
              documentThresholdDays: lr.documentThresholdDays || null,
              isEncashable: Boolean(lr.isEncashable),
              encashmentBasis: lr.encashmentBasis || 'BasicSalary',
              isPlatformLocked: true,
              platformCode: lr.code,
              isActive: true,
            })
            .onConflictDoUpdate({
              target: leaveTypes.code,
              set: {
                name: lr.name,
                leaveType: lr.leaveType,
                noOfDays: String(lr.daysPerYear),
                accumulationCap: lr.maxAccumulation ? String(lr.maxAccumulation) : null,
                maxPaidDays: lr.maxPaidDays ? String(lr.maxPaidDays) : null,
                isStatutory: true,
                genderApplicable: lr.genderApplicable || 'All',
                requiresDocument: Boolean(lr.requiresDocument),
                isEncashable: Boolean(lr.isEncashable),
                encashmentBasis: lr.encashmentBasis || 'BasicSalary',
                isPlatformLocked: true,
                platformCode: lr.code,
                isActive: true,
                updatedAt: new Date(),
              },
            });
        }

        // B. Upsert Statutory Overtime Rules
        for (const ot of packPayload.otRules || []) {
          await tenantDb
            .insert(otRules)
            .values({
              ruleName: ot.name,
              ruleType: ot.ruleType,
              rateOfficeDay: String(ot.rateOfficeDay),
              rateOffDay: String(ot.rateOffDay),
              isPlatformLocked: true,
              platformCode: ot.code,
              isActive: true,
            })
            .onConflictDoUpdate({
              target: otRules.ruleName,
              set: {
                ruleType: ot.ruleType,
                rateOfficeDay: String(ot.rateOfficeDay),
                rateOffDay: String(ot.rateOffDay),
                isPlatformLocked: true,
                platformCode: ot.code,
                isActive: true,
                updatedAt: new Date(),
              },
            });
        }

        // C. Upsert Statutory Deductions (SSF, EPF, CIT) into pay_heads
        for (const ded of packPayload.statutoryDeductions || []) {
          const isSSF = ded.code.includes('SSF');
          const isEPF = ded.code.includes('EPF');
          const isCIT = ded.code.includes('CIT');

          await tenantDb
            .insert(payHeads)
            .values({
              code: isSSF ? 'SSF' : isEPF ? 'EPF' : isCIT ? 'CIT' : ded.code,
              name: ded.name,
              type: 'deduction',
              effectOnTax: !ded.isPreTax,
              calcBasis: 'BasicSalary',
              calcParameter: 'BasicSalary',
              calcPercent: String(ded.employeePercent || '0'),
              isSsfHead: isSSF,
              isPfHead: isEPF,
              isCitHead: isCIT,
            })
            .onConflictDoUpdate({
              target: payHeads.code,
              set: {
                name: ded.name,
                calcPercent: String(ded.employeePercent || '0'),
                effectOnTax: !ded.isPreTax,
                isSsfHead: isSSF,
                isPfHead: isEPF,
                isCitHead: isCIT,
                updatedAt: new Date(),
              },
            });
        }

        // D. Upsert Statutory Benefits (Festival Allowance) into pay_heads
        for (const ben of packPayload.statutoryBenefits || []) {
          await tenantDb
            .insert(payHeads)
            .values({
              code: 'FESTIVAL',
              name: ben.name,
              type: 'allowance',
              effectOnTax: true,
              calcBasis: 'BasicSalary',
              calcParameter: 'BasicSalary',
              calcPercent: '100',
              isFestivalAllowance: true,
            })
            .onConflictDoUpdate({
              target: payHeads.code,
              set: {
                name: ben.name,
                isFestivalAllowance: true,
                updatedAt: new Date(),
              },
            });
        }

        // E. Sync Baseline Tax Slabs if provided
        if (packPayload.taxSlabsBaseline && packPayload.taxSlabsBaseline.length > 0) {
          const existingFYs = await tenantDb.select().from(fiscalYears);
          const activeFY =
            existingFYs.find((f) => f.status?.toLowerCase() === "active") ||
            existingFYs[0];

          if (activeFY) {
            // Synchronize and update tax slabs for active fiscal year to match policy pack baseline
            await tenantDb
              .delete(taxRateSlabs)
              .where(eq(taxRateSlabs.fiscalYearId, activeFY.id));

            for (const slab of packPayload.taxSlabsBaseline) {
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

        // C. Log sync event in tenant audit log
        try {
          await tenantDb.insert(auditLogs).values({
            action: 'EDIT',
            module: 'SYSTEM_CONTROL',
            recordId: 'STATUTORY_POLICY_PACK',
            result: 'SUCCESS',
            newValues: {
              event: 'POLICY_PACK_SYNCED_BY_SUPER_ADMIN',
              policyPackVersion: packPayload.version,
              policyPackName: packPayload.name,
              syncedAt: new Date().toISOString(),
            },
            ipAddress: '127.0.0.1',
          });
        } catch {
          // Non-blocking audit log
        }

        // D. Update company policy pack version & initialSetupPayload on control plane
        const currentSetup = (company.initialSetupPayload as any) || {};
        await platformDb
          .update(companies)
          .set({
            policyPackVersion: packPayload.version,
            initialSetupPayload: {
              ...currentSetup,
              taxSlabs: packPayload.taxSlabsBaseline || currentSetup.taxSlabs,
            },
            updatedAt: new Date(),
          })
          .where(eq(companies.id, company.id));

        syncedCompanies.push({
          id: company.id,
          name: company.displayName || company.legalName,
          slug: company.slug,
        });
      } catch (err: any) {
        console.error(`Error syncing policy pack to tenant ${company.slug}:`, err);
        syncErrors.push({ slug: company.slug, error: err?.message || 'Sync failed.' });
      }
    }

    // 4. Record Platform Audit Log
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'POLICY_PACK_BROADCAST_SYNC',
      meta: {
        policyPackVersion: packPayload.version,
        policyPackName: packPayload.name,
        syncedCount: syncedCompanies.length,
        syncedCompanies: syncedCompanies.map((c) => c.slug),
        errors: syncErrors,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Statutory Policy Pack v${packPayload.version} successfully synchronized to ${syncedCompanies.length} active tenant database(s).`,
      syncedCount: syncedCompanies.length,
      syncedCompanies,
      errors: syncErrors,
    });
  } catch (error: any) {
    console.error('Error broadcasting statutory policy pack:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to broadcast policy pack to tenant databases.' },
      { status: 500 }
    );
  }
}

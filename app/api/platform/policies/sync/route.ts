import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { platformPolicyPacks, platformAuditLogs, companies } from '@/lib/platform/schema';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { getTenantDb } from '@/lib/db/tenant-pool-manager';
import { leaveTypes, otRules, auditLogs } from '@/lib/db/schema';
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

        // D. Update company policy pack version on control plane
        await platformDb
          .update(companies)
          .set({
            policyPackVersion: packPayload.version,
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

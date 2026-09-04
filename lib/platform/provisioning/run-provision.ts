import { platformDb } from '../db';
import { companies, tenantDatabases, platformAuditLogs, provisioningJobs } from '../schema';
import { createTenantDatabase } from './create-database';
import { migrateTenantDatabase } from './migrate-tenant';
import { seedTenantDatabase } from './seed-tenant';
import { encryptPassword } from '../crypto';
import { eq } from 'drizzle-orm';

export async function runProvisioningPipeline(companyId: string): Promise<{
  success: boolean;
  dbName: string;
  adminEmail: string;
  tempPasswordPlain: string;
}> {
  // Fetch company details
  const [company] = await platformDb
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    throw new Error(`Company with ID ${companyId} not found.`);
  }

  // Record provisioning job
  const [job] = await platformDb
    .insert(provisioningJobs)
    .values({
      companyId,
      status: 'RUNNING',
      step: 'create_db',
    })
    .returning();

  try {
    // Step 1: Update status to PROVISIONING
    await platformDb
      .update(companies)
      .set({ status: 'PROVISIONING' })
      .where(eq(companies.id, companyId));

    // Step 2: Create isolated PostgreSQL Database
    console.log(`[Provisioning] Creating database for company ${company.slug}...`);
    const dbConfig = await createTenantDatabase(company.slug);

    await platformDb
      .update(provisioningJobs)
      .set({ step: 'migrate' })
      .where(eq(provisioningJobs.id, job.id));

    // Step 3: Run Drizzle Migrations
    console.log(`[Provisioning] Migrating schema for database ${dbConfig.dbName}...`);
    await migrateTenantDatabase(dbConfig.connectionUrl);

    await platformDb
      .update(provisioningJobs)
      .set({ step: 'seed' })
      .where(eq(provisioningJobs.id, job.id));

    // Step 4: Seed RBAC Matrix, Protected Roles, Statutory Rules & Office Admin User
    console.log(`[Provisioning] Seeding tenant data for company ${company.slug}...`);
    const seedResult = await seedTenantDatabase({
      connectionUrl: dbConfig.connectionUrl,
      legalName: company.legalName,
      companyCode: company.companyCode,
      adminEmail: company.contactEmail,
      industryType: company.industryType || 'General',
    });

    // Step 5: Save encrypted credentials into control plane
    const encryptedPassword = encryptPassword(dbConfig.dbPasswordPlain);

    await platformDb
      .insert(tenantDatabases)
      .values({
        companyId,
        dbName: dbConfig.dbName,
        dbHost: dbConfig.dbHost || '127.0.0.1',
        dbPort: dbConfig.dbPort || 5432,
        dbUser: dbConfig.dbUser,
        dbPasswordEncrypted: encryptedPassword,
        schemaVersion: '1.0.0',
        lastHealthAt: new Date(),
      })
      .onConflictDoNothing();

    // Step 6: Mark company ACTIVE
    await platformDb
      .update(companies)
      .set({
        status: 'ACTIVE',
        provisionedAt: new Date(),
      })
      .where(eq(companies.id, companyId));

    await platformDb
      .update(provisioningJobs)
      .set({ status: 'SUCCEEDED', step: 'complete' })
      .where(eq(provisioningJobs.id, job.id));

    // Step 7: Audit log
    await platformDb.insert(platformAuditLogs).values({
      action: 'COMPANY_PROVISION_SUCCESS',
      companyId,
      meta: { dbName: dbConfig.dbName, adminEmail: company.contactEmail },
    });

    return {
      success: true,
      dbName: dbConfig.dbName,
      adminEmail: company.contactEmail,
      tempPasswordPlain: seedResult.tempPasswordPlain,
    };
  } catch (err: any) {
    console.error(`[Provisioning Failed] Company ${company.slug}:`, err);

    await platformDb
      .update(provisioningJobs)
      .set({
        status: 'FAILED',
        errorMessage: err?.message || 'Unknown provisioning error',
      })
      .where(eq(provisioningJobs.id, job.id));

    await platformDb
      .update(companies)
      .set({ status: 'PENDING' })
      .where(eq(companies.id, companyId));

    throw err;
  }
}

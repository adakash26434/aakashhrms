import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, tenantDatabases, type Company } from '@/lib/platform/schema';
import { getDb } from '@/lib/db';
import { systemConfig } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface Tier1CompanyValues {
  legalName: string;
  panVatNumber: string;
  registrationNumber: string;
  industryType: string;
  headOfficeAddress: string;
}

/**
 * Resolves the platform Company record corresponding to the current tenant context.
 * Handles:
 * 1. Multi-tenant session with tenantSlug
 * 2. Tenant systemConfig company_code lookup
 * 3. Database name match in tenantDatabases (e.g. Local dev / SINGLE_TENANT_MODE)
 * 4. Fallback to active company if only one company exists
 */
export async function resolvePlatformCompanyForTenant(tenantSlug?: string | null): Promise<Company> {
  await ensurePlatformTablesExist();

  // 1. Direct slug match from session / context
  if (tenantSlug) {

    const [comp] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.slug, tenantSlug))
      .limit(1);

    if (comp) return comp;
  }

  // 2. Lookup via tenant DB systemConfig (company_code or company_legal_name)
  try {
    const tenantDb = getDb();
    const configRows = await tenantDb.select().from(systemConfig);
    const configMap = new Map(configRows.map((r) => [r.key, r.value]));

    const companyCode = configMap.get('company_code');
    if (companyCode) {
      const [comp] = await platformDb
        .select()
        .from(companies)
        .where(eq(companies.companyCode, companyCode.trim().toUpperCase()))
        .limit(1);

      if (comp) return comp;
    }

    const legalName = configMap.get('company_legal_name');
    if (legalName) {
      const [comp] = await platformDb
        .select()
        .from(companies)
        .where(eq(companies.legalName, legalName.trim()))
        .limit(1);

      if (comp) return comp;
    }
  } catch (err) {
    console.warn('[resolvePlatformCompanyForTenant] Tenant systemConfig lookup note:', err);
  }

  // 3. Lookup via tenantDatabases dbName (for SINGLE_TENANT_MODE or TENANT_DB_NAME env)
  const currentDbName = process.env.TENANT_DB_NAME || 'payroll_system';
  const [dbRecord] = await platformDb
    .select({ companyId: tenantDatabases.companyId })
    .from(tenantDatabases)
    .where(eq(tenantDatabases.dbName, currentDbName))
    .limit(1);

  if (dbRecord) {
    const [comp] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, dbRecord.companyId))
      .limit(1);

    if (comp) return comp;
  }

  // 4. Single tenant fallback: if only 1 company exists on platform
  const allCompanies = await platformDb.select().from(companies).limit(2);
  if (allCompanies.length === 1) {
    return allCompanies[0];
  }

  throw new Error('Unable to resolve platform company record for current tenant.');
}

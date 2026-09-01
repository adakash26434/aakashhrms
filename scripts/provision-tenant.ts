import { platformDb } from '../lib/platform/db';
import { companies } from '../lib/platform/schema';
import { runProvisioningPipeline } from '../lib/platform/provisioning/run-provision';
import { eq } from 'drizzle-orm';

async function main() {
  const args = process.argv.slice(2);
  const slugArg = args.find((a) => a.startsWith('--slug='));

  if (!slugArg) {
    console.error('❌ Missing --slug parameter. Usage: npx tsx scripts/provision-tenant.ts --slug=acme');
    process.exit(1);
  }

  const slug = slugArg.split('=')[1].trim().toLowerCase();
  console.log(`🚀 Provisioning tenant database for slug: "${slug}"...`);

  const [company] = await platformDb
    .select()
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);

  if (!company) {
    console.error(`❌ Company with slug "${slug}" not found in platform database.`);
    process.exit(1);
  }

  try {
    const result = await runProvisioningPipeline(company.id);
    console.log(`✅ Tenant Provisioning Successful!`);
    console.log(`   Company: ${company.legalName} (${company.companyCode})`);
    console.log(`   Database Name: ${result.dbName}`);
    console.log(`   Office Admin Email: ${result.adminEmail}`);
    console.log(`   Temporary Password: ${result.tempPasswordPlain}`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Provisioning Failed:`, err);
    process.exit(1);
  }
}

main();

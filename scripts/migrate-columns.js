const postgres = require('postgres');

async function migrateDb(url, name) {
  console.log(`Connecting to ${name} (${url})...`);
  try {
    const sql = postgres(url, { max: 1, connect_timeout: 5 });
    console.log(`Adding columns to ${name}.companies...`);
    await sql.unsafe('ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;');
    await sql.unsafe('ALTER TABLE companies ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;');

    console.log(`Adding columns to ${name}.tenant_databases...`);
    await sql.unsafe('ALTER TABLE tenant_databases ADD COLUMN IF NOT EXISTS last_health_status VARCHAR(50) DEFAULT \'HEALTHY\';');
    await sql.unsafe('ALTER TABLE tenant_databases ADD COLUMN IF NOT EXISTS db_size_bytes INTEGER;');

    const res = await sql.unsafe('SELECT id, company_code, suspended_at, archived_at FROM companies LIMIT 1;');
    console.log(`Success on ${name}! Verified companies query.`);
    await sql.end();
  } catch (err) {
    console.error(`Error on ${name}:`, err.message);
  }
}

async function main() {
  await migrateDb('postgresql://postgres:admin@127.0.0.1:5432/payroll_db', 'payroll_db');
  await migrateDb('postgresql://postgres:admin@127.0.0.1:5432/payroll_platform', 'payroll_platform');
  console.log('ALL MIGRATIONS COMPLETED.');
  process.exit(0);
}

main();

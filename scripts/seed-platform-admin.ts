import postgres from 'postgres';
import bcrypt from 'bcryptjs';

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const passwordPlain = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !passwordPlain) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be defined in your .env file.');
  }

  const name = 'Super Administrator';

  console.log(`🌱 Initializing Super Admin & Platform Database...`);
  console.log(`   Email: ${email}`);

  const mainDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:admin@127.0.0.1:5432/payroll_db';
  const platformDbUrl = process.env.PLATFORM_DATABASE_URL || 'postgresql://postgres:admin@127.0.0.1:5432/payroll_platform';

  // Extract connection parameters
  const urlObj = new URL(platformDbUrl.replace('postgresql://', 'http://'));
  const targetDbName = urlObj.pathname.replace('/', '') || 'payroll_platform';
  const dbUser = urlObj.username || 'postgres';
  const dbPassword = urlObj.password || 'admin';
  const dbHost = urlObj.hostname || '127.0.0.1';
  const dbPort = urlObj.port || '5432';

  // 1. Connect to postgres default DB to issue CREATE DATABASE statement if missing
  const adminPgUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/postgres`;
  const adminSql = postgres(adminPgUrl, { max: 1 });

  try {
    const existingDbs = await adminSql`
      SELECT datname FROM pg_database WHERE datname = ${targetDbName}
    `;

    if (existingDbs.length === 0) {
      console.log(`🔨 Creating platform database "${targetDbName}"...`);
      await adminSql.unsafe(`CREATE DATABASE "${targetDbName}"`);
      console.log(`✅ Database "${targetDbName}" created successfully!`);
    }
  } catch (err: any) {
    console.warn(`Notice during CREATE DATABASE check:`, err?.message || err);
  } finally {
    await adminSql.end();
  }

  // 2. Connect to platform DB and create schema tables if missing
  const platformSql = postgres(platformDbUrl, { max: 1 });

  try {
    await platformSql`
      CREATE TABLE IF NOT EXISTS platform_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `;

    await platformSql`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_code VARCHAR(16) NOT NULL UNIQUE,
        legal_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        slug VARCHAR(63) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        contact_email VARCHAR(255) NOT NULL,
        contact_phone VARCHAR(50),
        registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        policy_pack_version INTEGER NOT NULL DEFAULT 1,
        provisioned_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `;

    await platformSql`
      CREATE TABLE IF NOT EXISTS tenant_databases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
        db_name VARCHAR(100) NOT NULL,
        db_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
        db_port INTEGER NOT NULL DEFAULT 5432,
        db_user VARCHAR(100) NOT NULL,
        db_password_encrypted TEXT NOT NULL,
        schema_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
        last_health_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `;

    await platformSql`
      CREATE TABLE IF NOT EXISTS platform_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_platform_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        meta JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `;

    const passwordHash = await bcrypt.hash(passwordPlain, 12);

    const existingUser = await platformSql`
      SELECT id FROM platform_users WHERE email = ${email.toLowerCase().trim()} LIMIT 1
    `;

    if (existingUser.length > 0) {
      console.log(`ℹ️ Updating existing Super Admin account "${email}"...`);
      await platformSql`
        UPDATE platform_users 
        SET password_hash = ${passwordHash}, is_active = true, updated_at = now()
        WHERE email = ${email.toLowerCase().trim()}
      `;
    } else {
      console.log(`➕ Creating new Super Admin account "${email}"...`);
      await platformSql`
        INSERT INTO platform_users (email, password_hash, name, is_active)
        VALUES (${email.toLowerCase().trim()}, ${passwordHash}, ${name}, true)
      `;
    }

    console.log(`\n=================================================`);
    console.log(`🎉 SUPER ADMIN SEED SUCCESSFUL!`);
    console.log(`=================================================`);
    console.log(`   Super Admin Login URL: http://localhost:3000/platform/login`);
    console.log(`   Super Admin Email:     ${email}`);
    console.log(`   Super Admin Password:  ${passwordPlain}`);
    console.log(`=================================================\n`);
    process.exit(0);
  } finally {
    await platformSql.end();
  }
}

seedSuperAdmin().catch((err) => {
  console.error(`❌ Super Admin Seed Failed:`, err);
  process.exit(1);
});

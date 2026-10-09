import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../lib/db/schema';
import { permissions, roles, actionEnum, moduleEnum, rolePermissions } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { ensureEmployeeSelfServiceRole } from '../lib/auth/employee-self-service-role';
import { decryptCredential } from '../lib/platform/crypto';

dotenv.config({ path: '.env' });

// We extract the actual string values from the schema enums
const ACTIONS = actionEnum.enumValues;
const MODULES = moduleEnum.enumValues;

export async function seedRbacForDb(targetDb: any) {
  // 1. SEED PERMISSIONS MATRIX
  let permissionsInserted = 0;
  for (const mod of MODULES) {
    for (const act of ACTIONS) {
      await targetDb.insert(permissions)
        .values({ action: act, module: mod })
        .onConflictDoNothing();
      permissionsInserted++;
    }
  }

  // 2. SEED CORE ROLES
  const coreRoles = [
    {
      name: "System Administrator",
      slug: "system_admin",
      scopeType: "GLOBAL" as const,
      isSystemRole: true,
      description: "Technical owner. Full CRUD on all configuration masters. Cannot process payroll.",
    },
    {
      name: "HR Manager",
      slug: "hr_manager",
      scopeType: "GLOBAL" as const,
      isSystemRole: true,
      description: "Owns employee lifecycle. Full CRUD on Employees, Leave, and Attendance.",
    },
    {
      name: "HR Officer",
      slug: "hr_officer",
      scopeType: "GLOBAL" as const,
      isSystemRole: true,
      description: "Entry-level HR officer. Add and edit access for employees and leave records without delete permissions.",
    },
    {
      name: "Branch Manager",
      slug: "branch_manager",
      scopeType: "BRANCH" as const,
      isSystemRole: true,
      description: "Branch-scoped management access for local employees, attendance, and leave approvals.",
    },
    {
      name: "Payroll Controller",
      slug: "payroll_controller",
      scopeType: "GLOBAL" as const,
      isSystemRole: true,
      description: "Runs payroll and exports bank files. View-only on employee personal data.",
    },
    {
      name: "Department Head",
      slug: "department_head",
      scopeType: "DEPARTMENT" as const,
      isSystemRole: true,
      description: "Scoped access. Can approve leave and view attendance for their own department.",
    },
    {
      name: "Employee Self-Service",
      slug: "employee",
      scopeType: "SELF" as const,
      isSystemRole: true,
      description: "Self-service. Can view own payslips and apply for own leave.",
    },
    {
      name: "Standard Staff",
      slug: "standard_staff",
      scopeType: "SELF" as const,
      isSystemRole: true,
      description: "Legacy self-service slug. Prefer the Employee Self-Service (employee) role.",
    },
  ];

  for (const role of coreRoles) {
    await targetDb.insert(roles)
      .values(role)
      .onConflictDoNothing({ target: roles.slug });
  }

  // 3. MAP ALL PERMISSIONS TO SYSTEM ADMINISTRATOR ROLE
  const adminRoleResult = await targetDb.select().from(roles).where(eq(roles.slug, 'system_admin')).limit(1);
  if (adminRoleResult.length > 0) {
    const adminRoleId = adminRoleResult[0].id;
    const allPermissions = await targetDb.select().from(permissions);
    
    for (const perm of allPermissions) {
      await targetDb.insert(rolePermissions)
        .values({
          roleId: adminRoleId,
          permissionId: perm.id,
        })
        .onConflictDoNothing();
    }
  }

  // 4. MAP REPORT PERMISSIONS TO FUNCTIONAL ROLES
  const roleReportMappings: Record<string, { action: string; module: string }[]> = {
    hr_manager: [
      { action: 'VIEW', module: 'HR_LETTERS' },
      { action: 'ADD', module: 'HR_LETTERS' },
      { action: 'EDIT', module: 'HR_LETTERS' },
      { action: 'DELETE', module: 'HR_LETTERS' },
      { action: 'VIEW', module: 'REPORTS_SALARY_SHEET' },
      { action: 'EXPORT', module: 'REPORTS_SALARY_SHEET' },
      { action: 'VIEW', module: 'REPORTS_PAYSLIP' },
      { action: 'VIEW', module: 'REPORTS_ATTENDANCE' },
      { action: 'EXPORT', module: 'REPORTS_ATTENDANCE' },
      { action: 'VIEW', module: 'REPORTS_TAX_IRD' },
      { action: 'EXPORT', module: 'REPORTS_TAX_IRD' },
      { action: 'VIEW', module: 'REPORTS_LEAVE' },
      { action: 'EXPORT', module: 'REPORTS_LEAVE' },
      { action: 'VIEW', module: 'REPORTS_LOAN' },
      { action: 'EXPORT', module: 'REPORTS_LOAN' },
    ],
    payroll_controller: [
      { action: 'VIEW', module: 'REPORTS_SALARY_SHEET' },
      { action: 'EXPORT', module: 'REPORTS_SALARY_SHEET' },
      { action: 'VIEW', module: 'REPORTS_PAYSLIP' },
      { action: 'VIEW', module: 'REPORTS_ATTENDANCE' },
      { action: 'EXPORT', module: 'REPORTS_ATTENDANCE' },
      { action: 'VIEW', module: 'REPORTS_TAX_IRD' },
      { action: 'EXPORT', module: 'REPORTS_TAX_IRD' },
      { action: 'VIEW', module: 'REPORTS_LOAN' },
      { action: 'EXPORT', module: 'REPORTS_LOAN' },
    ],
    branch_manager: [
      { action: 'VIEW', module: 'REPORTS_PAYSLIP' },
      { action: 'VIEW', module: 'REPORTS_ATTENDANCE' },
      { action: 'VIEW', module: 'REPORTS_LEAVE' },
      { action: 'VIEW', module: 'REPORTS_LOAN' },
    ],
    department_head: [
      { action: 'VIEW', module: 'REPORTS_PAYSLIP' },
      { action: 'VIEW', module: 'REPORTS_ATTENDANCE' },
      { action: 'VIEW', module: 'REPORTS_LEAVE' },
    ],
    employee: [
      { action: 'VIEW', module: 'REPORTS_PAYSLIP' },
      { action: 'VIEW', module: 'REPORTS_LEAVE' },
    ],
    standard_staff: [
      { action: 'VIEW', module: 'REPORTS_PAYSLIP' },
      { action: 'VIEW', module: 'REPORTS_LEAVE' },
    ],
  };

  for (const [slug, permsToGrant] of Object.entries(roleReportMappings)) {
    const roleRes = await targetDb.select().from(roles).where(eq(roles.slug, slug)).limit(1);
    if (roleRes.length > 0) {
      const roleId = roleRes[0].id;
      for (const p of permsToGrant) {
        const permRes = await targetDb.select()
          .from(permissions)
          .where(and(eq(permissions.action, p.action as any), eq(permissions.module, p.module as any)))
          .limit(1);
        if (permRes.length > 0) {
          await targetDb.insert(rolePermissions)
            .values({ roleId, permissionId: permRes[0].id })
            .onConflictDoNothing();
        }
      }
    }
  }

  await ensureEmployeeSelfServiceRole(targetDb);
}

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set.');

  console.log('🌱 Starting RBAC Seed...');
  const sql = postgres(dbUrl, { max: 1 });

  try {
    const [tableCheck] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'companies'
      ) AS has_companies;
    `;

    if (tableCheck?.has_companies) {
      console.log('🏢 Multi-tenant control plane detected. Seeding RBAC across active tenant databases...');
      const tenantDbs = await sql`
        SELECT 
          c.id, 
          COALESCE(c.display_name, c.legal_name, c.slug) AS name, 
          c.slug, 
          td.db_name, 
          td.db_user, 
          td.db_password_encrypted, 
          td.db_host, 
          td.db_port
        FROM companies c
        JOIN tenant_databases td ON td.company_id = c.id
        WHERE c.status = 'ACTIVE'
      `;

      console.log(`Found ${tenantDbs.length} active tenant database(s) to seed.`);

      for (const t of tenantDbs) {
        console.log(`\n⏳ Seeding RBAC for tenant: "${t.name}" (${t.slug}) -> database: "${t.db_name}"...`);
        try {
          const dbPassword = decryptCredential(t.db_password_encrypted);
          let dbHost = t.db_host || '127.0.0.1';
          let dbPort = t.db_port || 5432;
          const dbUser = t.db_user || 'postgres';
          const dbName = t.db_name;

          if ((dbHost === '127.0.0.1' || dbHost === 'localhost') && process.env.DATABASE_URL) {
            try {
              const parsedMain = new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://'));
              if (parsedMain.hostname && parsedMain.hostname !== '127.0.0.1' && parsedMain.hostname !== 'localhost') {
                dbHost = parsedMain.hostname;
                if (parsedMain.port) dbPort = Number(parsedMain.port);
              }
            } catch {}
          }

          const tenantUrl = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
          const tenantSql = postgres(tenantUrl, { max: 1 });
          const tenantDrizzle = drizzle(tenantSql, { schema });

          try {
            await seedRbacForDb(tenantDrizzle);
            console.log(`   ✅ Tenant "${t.name}" RBAC seeded successfully.`);
          } finally {
            await tenantSql.end();
          }
        } catch (tenantErr) {
          console.error(`   ❌ Failed seeding tenant "${t.name}":`, tenantErr);
        }
      }
    } else {
      console.log('Single database environment detected. Seeding RBAC directly...');
      const targetDb = drizzle(sql, { schema });
      await seedRbacForDb(targetDb);
      console.log('✅ Direct database RBAC seeded successfully.');
    }

    console.log('\n🎉 RBAC Seeding Complete across all databases!');
    process.exit(0);
  } catch (err) {
    console.error('❌ RBAC Seed failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';

export interface SeedTenantOptions {
  connectionUrl: string;
  legalName: string;
  companyCode: string;
  adminEmail: string;
  adminPasswordPlain?: string;
}

export async function seedTenantDatabase(options: SeedTenantOptions): Promise<{
  adminUserId: string;
  tempPasswordPlain: string;
}> {
  const { connectionUrl, legalName, companyCode, adminEmail, adminPasswordPlain } = options;
  const tempPasswordPlain = adminPasswordPlain || 'Password123!';

  const sql = postgres(connectionUrl, { max: 1 });
  const tenantDb = drizzle(sql, { schema });

  try {
    // 1. SEED PERMISSIONS MATRIX (Action x Module)
    const ACTIONS = schema.actionEnum.enumValues;
    const MODULES = schema.moduleEnum.enumValues;

    for (const mod of MODULES) {
      for (const act of ACTIONS) {
        await tenantDb
          .insert(schema.permissions)
          .values({ action: act, module: mod })
          .onConflictDoNothing();
      }
    }

    // 2. SEED PROTECTED ROLES
    const [officeAdminRole] = await tenantDb
      .insert(schema.roles)
      .values({
        name: 'Office Administrator',
        slug: 'office_admin',
        scopeType: 'GLOBAL',
        isSystemRole: true,
        isProtected: true,
        description: 'Primary Office Administrator for company tenant. Full administrative authority.',
      })
      .onConflictDoNothing({ target: schema.roles.slug })
      .returning();

    const [employeeRole] = await tenantDb
      .insert(schema.roles)
      .values({
        name: 'Employee Self-Service',
        slug: 'employee',
        scopeType: 'SELF',
        isSystemRole: true,
        isProtected: true,
        description: 'Standard employee role for self-service portal, payslip viewing, and leave requests.',
      })
      .onConflictDoNothing({ target: schema.roles.slug })
      .returning();

    // Get Office Admin role ID
    const targetAdminRole =
      officeAdminRole ||
      (
        await tenantDb
          .select()
          .from(schema.roles)
          .where(eq(schema.roles.slug, 'office_admin'))
          .limit(1)
      )[0];

    // Map all permissions to Office Administrator
    const allPermissions = await tenantDb.select().from(schema.permissions);
    for (const perm of allPermissions) {
      await tenantDb
        .insert(schema.rolePermissions)
        .values({
          roleId: targetAdminRole.id,
          permissionId: perm.id,
        })
        .onConflictDoNothing();
    }

    // 3. SEED STATUTORY LEAVE TYPES (Nepal Labour Act 2074)
    const statutoryLeaveTypes = [
      {
        name: 'Home Leave (घर बिदा)',
        code: 'HOME',
        leaveType: 'Pay',
        noOfDays: '18.0',
        accumulationCap: '90.0',
        isStatutory: true,
        statutoryCode: 'HOME',
        isPlatformLocked: true,
        genderApplicable: 'All',
        isEncashable: true,
        encashmentBasis: 'BasicSalary',
      },
      {
        name: 'Sick Leave (बिरामी बिदा)',
        code: 'SICK',
        leaveType: 'Pay',
        noOfDays: '12.0',
        accumulationCap: '45.0',
        isStatutory: true,
        statutoryCode: 'SICK',
        isPlatformLocked: true,
        genderApplicable: 'All',
        requiresDocument: true,
        documentThresholdDays: 3,
        isEncashable: true,
        encashmentBasis: 'BasicSalary',
      },
      {
        name: 'Maternity Leave (प्रसूति बिदा)',
        code: 'MATERNITY',
        leaveType: 'Partial-Pay',
        noOfDays: '98.0',
        maxPaidDays: '60.0',
        isStatutory: true,
        statutoryCode: 'MATERNITY',
        isPlatformLocked: true,
        genderApplicable: 'Female',
        requiresDocument: true,
      },
      {
        name: 'Paternity Leave (प्रसूति स्याहार बिदा)',
        code: 'PATERNITY',
        leaveType: 'Pay',
        noOfDays: '15.0',
        accumulationCap: '15.0',
        isStatutory: true,
        statutoryCode: 'PATERNITY',
        isPlatformLocked: true,
        genderApplicable: 'Male',
        requiresDocument: true,
      },
      {
        name: 'Mourning Leave (क्रिया बिदा)',
        code: 'MOURNING',
        leaveType: 'Pay',
        noOfDays: '13.0',
        accumulationCap: '13.0',
        isStatutory: true,
        statutoryCode: 'MOURNING',
        isPlatformLocked: true,
        genderApplicable: 'All',
        requiresDocument: false,
      },
      {
        name: 'Public & Festival Holidays (पर्व बिदा)',
        code: 'PUBLIC',
        leaveType: 'Pay',
        noOfDays: '14.0',
        accumulationCap: '14.0',
        isStatutory: true,
        statutoryCode: 'PUBLIC',
        isPlatformLocked: true,
        genderApplicable: 'All',
        requiresDocument: false,
      },
    ];

    for (const lt of statutoryLeaveTypes) {
      await tenantDb.insert(schema.leaveTypes).values(lt).onConflictDoNothing();
    }

    // 4. SEED OVERTIME RULES
    const defaultOtRules = [
      {
        ruleName: 'Standard Nepal Labour Act Overtime (1.5x)',
        ruleType: 'Hourly',
        rateOfficeDay: '1.50',
        rateOffDay: '1.50',
        isPlatformLocked: true,
        platformCode: 'OT_STANDARD',
      },
    ];

    for (const ot of defaultOtRules) {
      await tenantDb.insert(schema.otRules).values(ot).onConflictDoNothing();
    }

    // 5. CREATE INITIAL OFFICE ADMIN USER ACCOUNT
    const passwordHash = await bcrypt.hash(tempPasswordPlain, 12);
    const [adminUser] = await tenantDb
      .insert(schema.users)
      .values({
        name: `${legalName} Admin`,
        email: adminEmail,
        passwordHash,
        isActive: true,
        mustChangePassword: true,
      })
      .onConflictDoNothing({ target: schema.users.email })
      .returning();

    const targetUser =
      adminUser ||
      (
        await tenantDb
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, adminEmail))
          .limit(1)
      )[0];

    // Assign Office Admin role
    await tenantDb
      .insert(schema.userRoles)
      .values({
        userId: targetUser.id,
        roleId: targetAdminRole.id,
      })
      .onConflictDoNothing();

    // 6. SEED INITIAL SYSTEM CONFIG
    const initialConfigs = [
      { key: 'onboarding_completed', value: 'false', dataType: 'boolean' },
      { key: 'company_legal_name', value: legalName, dataType: 'string' },
      { key: 'company_code', value: companyCode, dataType: 'string' },
      { key: 'company_contact_email', value: adminEmail, dataType: 'string' },
    ];

    for (const conf of initialConfigs) {
      await tenantDb
        .insert(schema.systemConfig)
        .values(conf)
        .onConflictDoNothing({ target: schema.systemConfig.key });
    }

    return {
      adminUserId: targetUser.id,
      tempPasswordPlain,
    };
  } finally {
    await sql.end();
  }
}

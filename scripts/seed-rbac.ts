import { db } from '../lib/db';
import { permissions, roles, actionEnum, moduleEnum, rolePermissions } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

// We extract the actual string values from the schema enums
const ACTIONS = actionEnum.enumValues;
const MODULES = moduleEnum.enumValues;

async function seed() {
  console.log("🌱 Starting RBAC Seed...");

  // 1. SEED PERMISSIONS MATRIX
  console.log("Generating Action x Module permission matrix...");
  let permissionsInserted = 0;
  
  for (const mod of MODULES) {
    for (const act of ACTIONS) {
      await db.insert(permissions)
        .values({ action: act, module: mod })
        .onConflictDoNothing();
      permissionsInserted++;
    }
  }
  console.log(`✅ Processed ${permissionsInserted} permission combinations.`);

  // 2. SEED CORE ROLES
  console.log("Seeding core enterprise roles...");
  
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
      name: "Standard Staff",
      slug: "standard_staff",
      scopeType: "SELF" as const,
      isSystemRole: true,
      description: "Self-service. Can view own payslips and apply for own leave.",
    },
  ];

  for (const role of coreRoles) {
    await db.insert(roles)
      .values(role)
      .onConflictDoNothing({ target: roles.slug });
  }
  console.log(`✅ Processed ${coreRoles.length} core roles.`);

  // 3. MAP ALL PERMISSIONS TO SYSTEM ADMINISTRATOR ROLE
  console.log("Mapping all permissions to System Administrator role...");
  const adminRoleResult = await db.select().from(roles).where(eq(roles.slug, 'system_admin')).limit(1);
  if (adminRoleResult.length > 0) {
    const adminRoleId = adminRoleResult[0].id;
    const allPermissions = await db.select().from(permissions);
    
    let rolePermissionsMapped = 0;
    for (const perm of allPermissions) {
      await db.insert(rolePermissions)
        .values({
          roleId: adminRoleId,
          permissionId: perm.id,
        })
        .onConflictDoNothing();
      rolePermissionsMapped++;
    }
    console.log(`✅ Mapped ${rolePermissionsMapped} permissions to System Administrator.`);
  }

  // 4. MAP REPORT PERMISSIONS TO OTHER ROLES
  console.log("Mapping Report permissions to functional roles...");
  
  const roleReportMappings: Record<string, { action: string; module: string }[]> = {
    hr_manager: [
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
      { action: 'VIEW', module: 'REPORTS_LEAVE' },
      { action: 'EXPORT', module: 'REPORTS_LEAVE' },
      { action: 'VIEW', module: 'REPORTS_LOAN' },
      { action: 'EXPORT', module: 'REPORTS_LOAN' },
    ],
    hr_officer: [
      { action: 'VIEW', module: 'REPORTS_SALARY_SHEET' },
      { action: 'VIEW', module: 'REPORTS_PAYSLIP' },
      { action: 'VIEW', module: 'REPORTS_ATTENDANCE' },
      { action: 'VIEW', module: 'REPORTS_LEAVE' },
      { action: 'VIEW', module: 'REPORTS_LOAN' },
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
    standard_staff: [
      { action: 'VIEW', module: 'REPORTS_PAYSLIP' },
      { action: 'VIEW', module: 'REPORTS_LEAVE' },
    ],
  };

  for (const [slug, permsToGrant] of Object.entries(roleReportMappings)) {
    const roleRes = await db.select().from(roles).where(eq(roles.slug, slug)).limit(1);
    if (roleRes.length > 0) {
      const roleId = roleRes[0].id;
      for (const p of permsToGrant) {
        const permRes = await db.select()
          .from(permissions)
          .where(and(eq(permissions.action, p.action as any), eq(permissions.module, p.module as any)))
          .limit(1);
        if (permRes.length > 0) {
          await db.insert(rolePermissions)
            .values({ roleId, permissionId: permRes[0].id })
            .onConflictDoNothing();
        }
      }
    }
  }
  console.log("✅ Report permissions mapped across core roles.");

  console.log("🎉 RBAC Seeding Complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
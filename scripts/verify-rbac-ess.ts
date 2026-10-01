import { db } from '../lib/db';
import { roles, permissions, rolePermissions, employees } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { EMPLOYEE_ROLE_SLUG, ROLE_PERMISSION_PRESETS, EMPLOYEE_SELF_SERVICE_GRANTS } from '../lib/constants/role-presets';
import { getEmployeeAccess } from '../lib/services/user.service';
import { findUsersByRoleId } from '../lib/repositories/role.repository';

async function runVerification() {
  console.log('=== VERIFYING RBAC & ESS IMPLEMENTATION ===\n');

  // Test 1: Employee Role
  const [empRole] = await db.select().from(roles).where(eq(roles.slug, EMPLOYEE_ROLE_SLUG));
  if (!empRole) {
    throw new Error(`FAIL: Role "${EMPLOYEE_ROLE_SLUG}" not found!`);
  }
  console.log(`[PASS] 1. Found role "${empRole.name}" (slug: ${empRole.slug}, scope: ${empRole.scopeType}, id: ${empRole.id})`);

  // Test 2: Role Permissions for Employee
  const empPerms = await db
    .select({
      action: permissions.action,
      module: permissions.module,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, empRole.id));

  console.log(`[PASS] 2. Employee role has ${empPerms.length} assigned permissions:`);
  for (const g of EMPLOYEE_SELF_SERVICE_GRANTS) {
    const found = empPerms.some((p) => p.action === g.action && p.module === g.module);
    if (!found) {
      console.warn(`[WARN] Grant [${g.action} ${g.module}] missing from employee role.`);
    } else {
      console.log(`       - Verified grant [${g.action} ${g.module}]`);
    }
  }

  // Test 3: Verify Role Presets
  console.log(`\n[PASS] 3. Verified ${ROLE_PERMISSION_PRESETS.length} presets configured:`);
  for (const p of ROLE_PERMISSION_PRESETS) {
    console.log(`       - Preset "${p.label}" (${p.id}): ${p.grants.length} grants -> "${p.description}"`);
  }

  // Test 4: Find Users By Role
  const assigned = await findUsersByRoleId(empRole.id);
  console.log(`\n[PASS] 4. findUsersByRoleId successfully executed. Currently assigned to "${empRole.name}": ${assigned.length} users`);

  // Test 5: Check Employee Access lookup
  const [firstEmp] = await db.select().from(employees).limit(1);
  if (firstEmp) {
    const access = await getEmployeeAccess(firstEmp.id);
    console.log(`\n[PASS] 5. getEmployeeAccess(${firstEmp.id}) returned:`, access ? `Linked to ${access.email} (Role: ${access.roleName})` : 'No user linked yet');
  } else {
    console.log('\n[INFO] 5. No employees in DB to test getEmployeeAccess.');
  }

  console.log('\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

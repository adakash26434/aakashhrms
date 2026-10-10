import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// S59 (found migrating Administration, 4.13, 2026-10-10): anyone with Users & roles → Add / Edit
// could make any login — their own included — a company administrator, change the permissions and
// scope of any role (their own included), and Users & roles / Audit log ignored the scope (a branch
// role saw every login and every audit entry; platform support could change logins). One action
// had no permission check at all; temporary passwords came from Math.random(); the audit trail
// showed made-up addresses (127.0.0.1 stored, "103.90.84.12" displayed). The rules themselves are
// unit-tested in tests/user-access.engine.test.ts and tests/role.engine.test.ts.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const body = (src: string, start: string) => {
  const i = src.indexOf(start);
  assert.ok(i >= 0, start);
  const end = src.indexOf('\n}\n', i);
  return src.slice(i, end < 0 ? undefined : end);
};
const exportsOf = (src: string) => [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
/** The source without comments (rules that say what not to do mention it). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('S59 administration is company-wide: views and changes', () => {
  const users = read('app/actions/user.actions.ts');
  const roles = read('app/actions/role.actions.ts');
  const audit = read('app/actions/audit.actions.ts');

  it('every exported action checks first: a company-wide view, or a company-wide change (never support)', () => {
    for (const [file, src] of [['user', users], ['role', roles], ['audit', audit]] as const) {
      for (const name of exportsOf(src)) {
        const fn = body(src, `export async function ${name}(`);
        const check = Math.max(fn.indexOf('await checkCompanyView('), fn.indexOf('await checkCompanyControl('));
        assert.ok(check > 0, `${file}.${name} checks`);
        const work = fn.search(/await service\.|permissionHistory\(/);
        assert.ok(work > check, `${file}.${name}: the check comes before the work`);
      }
    }
    // Views: Users & roles / Audit log with a company-wide role; the activity of a login needs both.
    assert.match(body(users, 'export async function usersPageAction('), /await checkCompanyView\('USERS_ROLES'\)/);
    assert.match(body(users, 'export async function loginActivityAction('), /await checkCompanyView\('USERS_ROLES'\);\s*await checkCompanyView\('AUDIT_LOG'\);/);
    assert.match(body(audit, 'export async function auditPageAction('), /await checkCompanyView\('AUDIT_LOG'\)/);
    // Changes: the right permission, company-wide, never support view.
    assert.match(body(users, 'export async function saveLoginAction('), /checkCompanyControl\(id \? 'EDIT' : 'ADD', 'USERS_ROLES'\)/);
    assert.match(body(users, 'export async function setLoginActiveAction('), /checkCompanyControl\(active \? 'EDIT' : 'DELETE', 'USERS_ROLES'\)/);
    assert.match(body(users, 'export async function issuePasswordAction('), /checkCompanyControl\('EDIT', 'USERS_ROLES'\)/);
    assert.match(body(roles, 'export async function deleteRoleAction('), /checkCompanyControl\('DELETE', 'USERS_ROLES'\)/);
    const check = read('lib/auth/check-permission.ts');
    assert.match(body(check, 'export async function checkCompanyView('), /if \(!scope\.isImpersonation && scope\.scopeType !== 'GLOBAL'\)/);
    assert.match(body(check, 'export async function checkCompanyControl('), /if \(scope\.isImpersonation\) throw/);
  });

  it('the unguarded employee list and the old raw-error actions are gone', () => {
    assert.doesNotMatch(users, /getUnlinkedEmployeesAction|updateUserDelegationAction|getUsersAction\b/);
    assert.doesNotMatch(roles, /updateRolePermissionsAction|assignUsersToRoleAction|cloneRoleAction/);
    for (const src of [users, roles, audit]) {
      assert.doesNotMatch(src, /error instanceof Error \? error\.message/);
      assert.match(src, /toActionError\(error, '/);
    }
    assert.ok(!existsSync(join(root, 'components/admin/audit/audit-detail-modal.tsx')));
  });

  it('the dashboard shows the company activity feed to company-wide roles only', () => {
    assert.match(read('lib/services/dashboard.service.ts'), /audit && scope\.scopeType === "GLOBAL" \? section\("activity"/);
  });
});

describe('S59 the access rules guard every change, inside one lock', () => {
  const userService = read('lib/services/user.service.ts');
  const roleService = read('lib/services/role.service.ts');

  it('changes run inside the administration lock with the facts read again there', () => {
    assert.match(read('lib/repositories/user.repository.ts'), /select pg_advisory_xact_lock\(hashtext\('aakashhrms\.administration'\)\)/);
    for (const [src, names] of [
      [userService, ['saveLogin', 'setLoginActive', 'issueTemporaryPassword', 'saveDelegation', 'changeLinkedLoginRole']],
      [roleService, ['saveRole', 'saveRolePermissions', 'deleteRole', 'addRoleMembers']],
    ] as const) {
      for (const name of names) assert.match(body(src, `export async function ${name}(`), /administrationTx\(async \(tx\) =>/, name);
    }
  });

  it('logins: within reach, never one\'s own, administrators only by administrators, one administrator stays', () => {
    const save = body(userService, 'export async function saveLogin(');
    assert.match(save, /refuse\(loginChangeProblem\(actor, facts, current\.roleId === chosen\.id \? "edit" : "role"\), current, actor, attempted\)/);
    assert.match(save, /refuse\(roleReachProblem\(actor, roleFacts\(chosen\)\), current, actor, attempted\)/);
    assert.match(save, /lastAdministratorProblem\(facts, \{ isActive: current\.isActive, roleSlug: chosen\.slug \}, await repository\.findActiveAdminIds\(tx\)\)/);
    assert.match(save, /refuse\(roleReachProblem\(actor, roleFacts\(chosen\)\), null, actor, attempted\)/);
    assert.match(body(userService, 'export async function setLoginActive('), /refuse\(loginChangeProblem\(actor, facts, "status"\)/);
    assert.match(body(userService, 'export async function issueTemporaryPassword('), /refuse\(loginChangeProblem\(actor, loginFacts\(record, roles\), "password"\)/);
    assert.match(body(userService, 'export async function saveDelegation('), /delegationProblem\(\{ actor, owner:/);
    // Refusals are audited: DENIED_SELF about one's own login, DENIED_PERMISSION otherwise.
    assert.match(userService, /login && login\.id === actor\.userId \? DENIED_SELF : "DENIED_PERMISSION"/);
    assert.match(body(userService, 'async function auditRefusals'), /result: error\.result/);
  });

  it('roles: the administrator role fixed, never one\'s own, nothing beyond the actor\'s own permissions', () => {
    assert.match(body(roleService, 'export async function saveRolePermissions('), /refuse\(permissionChangeProblem\(actor, roleFacts\(role\), next\), actor, role\.id/);
    assert.match(body(roleService, 'export async function saveRole('), /refuse\(roleDetailsProblem\(actor, roleFacts\(current\)/);
    assert.match(body(roleService, 'export async function saveRole('), /refuse\(newRoleProblem\(actor, grants, form\.scopeType\)/);
    assert.match(body(roleService, 'export async function deleteRole('), /refuse\(roleDeleteProblem\(actor, roleFacts\(record\), record\.logins\)/);
    assert.match(body(roleService, 'export async function addRoleMembers('), /refuse\(roleReachProblem\(actor, roleFacts\(role\)\)/);
    // Someone else's save in between is never overwritten.
    assert.match(body(roleService, 'export async function saveRolePermissions('), /if \(shown\.join\('\|'\) !== baseline\.join\('\|'\)\) throw new UserFacingError/);
    // Grants are written in one place, with the change log.
    for (const file of ['lib/services/role.service.ts', 'lib/services/user.service.ts']) assert.doesNotMatch(read(file), /insert\(rolePermissions\)/);
    assert.match(body(read('lib/repositories/role.repository.ts'), 'export async function setRoleGrantsTx('), /insert\(rolePermissionChangeLog\)/);
  });

  it('the employee record (S44) uses the same rules for linked logins', () => {
    const employee = read('lib/services/employee.service.ts');
    const actions = read('app/actions/employee.actions.ts');
    assert.match(employee, /await userService\.changeLinkedLoginRole\(guard\.actorUserId, linkedUser\.id, targetRoleId\)/);
    assert.match(employee, /await userService\.roleGiveProblemFor\(guard\.actorUserId, chosen\.id\)/);
    assert.match(employee, /await userService\.loginChangeProblemFor\(guard\.actorUserId, linkedUser\.id, "edit"\)/);
    assert.match(actions, /canManageLogins: canManageLogins && scope\.scopeType === 'GLOBAL' && !scope\.isImpersonation,/);
    assert.match(body(actions, 'async function assertMayResetLogin('), /await userService\.loginChangeProblemFor\(scope\.userId, access\.userId, 'password'\)/);
    // Leaving switches the login off: an administrator's only by another administrator.
    assert.match(body(actions, 'export async function setEmployeeStatusAction('), /await userService\.leavingLoginProblem\(scope\.userId, employee\.id\)/);
    assert.match(body(read('lib/services/exit.service.ts'), 'export async function completeExitCase('), /await leavingLoginProblem\(ctx\.userId, existing\.employeeId\)/);
  });
});

describe('S59 temporary passwords and the audit trail', () => {
  it('temporary passwords come from node:crypto, never Math.random()', () => {
    const engine = read('lib/engines/user.engine.ts');
    assert.doesNotMatch(code(engine), /Math\.random/);
    assert.match(engine, /export function generateTemporaryPassword\(random: \(max: number\) => number\): string/);
    const service = read('lib/services/user.service.ts');
    assert.match(service, /import \{ randomInt \} from "node:crypto";/);
    assert.equal((service.match(/generateTemporaryPassword\(/g) ?? []).length, (service.match(/generateTemporaryPassword\(randomInt\)/g) ?? []).length);
    assert.doesNotMatch(code(read('components/platform/admin-password-reset-card.tsx')), /Math\.random/);
    // The development console preview never prints the password in production.
    assert.match(read('lib/services/email.service.ts'), /process\.env\.NODE_ENV === "production" \? "\(not logged: shown once on screen\)" : tempPassword/);
  });

  it('a temporary password is never stored: new logins and resets write the hash only', () => {
    const repo = read('lib/repositories/user.repository.ts');
    assert.match(body(repo, 'export async function saveLoginTx('), /passwordHash: newPasswordHash, isActive: true, mustChangePassword: true, tempPassword: null/);
    assert.match(body(repo, 'export async function setTemporaryPasswordTx('), /tempPassword: null, failedLoginAttempts: 0, lockedUntil: null/);
  });

  it('entries record the request\'s client address or nothing, and the role at the time', () => {
    const audit = read('lib/services/audit.service.ts');
    assert.match(body(audit, 'async function requestAddress('), /addressText\(getClientIp\(await headers\(\)\)\)/);
    assert.match(body(audit, 'export async function recordAuditLog('), /const ipAddress = params\.ipAddress !== undefined \? addressText\(params\.ipAddress\) : await requestAddress\(\);/);
    assert.match(body(audit, 'export async function recordAuditLog('), /if \(userId && !roleId\)/);
    // No made-up address anywhere an entry is written or shown.
    for (const file of ['lib/services/audit.service.ts', 'lib/services/role.service.ts', 'lib/repositories/role.repository.ts', 'lib/repositories/onboarding.repository.ts', 'app/api/platform/policies/sync/route.ts']) {
      assert.doesNotMatch(read(file), /'127\.0\.0\.1'|"127\.0\.0\.1"/, file);
    }
    for (const file of ['components/admin/audit-client.tsx', 'components/admin/audit-detail.tsx']) {
      assert.doesNotMatch(read(file), /103\.90\.84\.12/);
      assert.match(read(file), /Not recorded/);
    }
  });

  it('migration 0082 clears the placeholder once and is mirrored for every company', () => {
    const migration = read('lib/db/migrations/0082_administration.sql');
    const sync = read('lib/db/tenant-schema-sync.ts');
    for (const src of [migration, sync]) {
      assert.match(src, /UPDATE "audit_logs" SET "ip_address" = NULL WHERE "ip_address" = '127\.0\.0\.1';/);
      assert.match(src, /COMMENT ON COLUMN "audit_logs"\."ip_address"/);
      assert.match(src, /ON DELETE SET NULL/);
      assert.match(src, /CREATE UNIQUE INDEX "users_employee_id_unique"/);
    }
    assert.match(read('lib/db/migrations/meta/_journal.json'), /"tag": "0082_administration"/);
  });
});

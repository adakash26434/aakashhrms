import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S44 (found while testing F13): the employee form's "Self-service access" let anyone with
// Employees → Edit give a linked login any role — System Administrator included, their own login
// included — and the record's Reset password / Resend sign-in issued a temporary password for any
// linked login (an office user's too). Now: another role needs Users & roles → Edit, never on
// one's own login; an office login's email and password are managed under Admin → Users.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const service = read('lib/services/employee.service.ts');
const actions = read('app/actions/employee.actions.ts');
const sync = service.slice(service.indexOf('async function syncEmployeeUserAccess'), service.indexOf('export async function saveEmployee'));

describe('S44 self-service access from the employee record', () => {
  it('a linked login changes role only with Users & roles → Edit, and never one\'s own', () => {
    const roleBlock = sync.slice(sync.indexOf('if (targetRoleId && targetRoleId !== access?.roleId)'), sync.indexOf('return warnings.length'));
    assert.ok(roleBlock.indexOf('if (own)') < roleBlock.indexOf('updateUserRepository(linkedUser.id, {}, targetRoleId)'));
    assert.match(roleBlock, /else if \(!guard\.canManageLogins\)/);
    assert.match(roleBlock, /DENIED_SELF/);
    // The only role write is the guarded one.
    assert.equal(sync.split('updateUserRepository(linkedUser.id, {}, targetRoleId)').length, 2);
  });

  it('a new login gets the Employee role unless the user may give roles', () => {
    assert.match(sync, /if \(!isSelfServiceRole\(resolvedSlug\) && !guard\.canManageLogins\) \{\s*resolvedSlug = EMPLOYEE_ROLE_SLUG;/);
  });

  it('an office login\'s email does not follow the record without Users & roles → Edit', () => {
    assert.match(sync, /else if \(officeLogin && !guard\.canManageLogins\)/);
  });

  it('the save passes who acts and Users & roles → Edit from the server', () => {
    assert.match(actions, /hasPermission\('EDIT', 'USERS_ROLES'\)/);
    assert.match(actions, /userId: scope\.userId,[\s\S]*canManageLogins: canManageLogins && !scope\.isImpersonation,/);
    assert.match(service, /const loginAccess: LoginAccessContext = \{ canManageLogins: ctx\.canManageLogins, actorUserId: ctx\.userId \};/);
  });

  it('reset and resend refuse one\'s own login and office logins without Users & roles → Edit (audited)', () => {
    for (const name of ['resendEmployeeCredentialsAction', 'resetEmployeePasswordAction']) {
      const fn = actions.slice(actions.indexOf(`export async function ${name}`));
      const body = fn.slice(0, fn.indexOf('\n}\n'));
      assert.ok(body.indexOf('await assertMayResetLogin(') > 0, `${name} checks the login`);
      assert.ok(body.indexOf('await assertMayResetLogin(') < body.indexOf('userService.resetUserPassword('), `${name} checks before resetting`);
    }
    const guard = actions.slice(actions.indexOf('async function assertMayResetLogin'), actions.indexOf('/**\n * Re-sends'));
    assert.match(guard, /access\.userId === scope\.userId[\s\S]*DENIED_SELF/);
    assert.match(guard, /!empService\.isSelfServiceRole\(access\.roleSlug\)[\s\S]*hasPermission\('EDIT', 'USERS_ROLES'\)[\s\S]*DENIED_PERMISSION/);
  });

  it('only the canonical and legacy Employee roles count as self-service', async () => {
    const { isSelfServiceRole } = await import('../lib/services/employee.service');
    assert.equal(isSelfServiceRole('employee'), true);
    assert.equal(isSelfServiceRole('standard_staff'), true);
    for (const slug of ['system_admin', 'office_admin', 'hr_manager', 'branch_hr', null, undefined, '']) assert.equal(isSelfServiceRole(slug), false);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// F17 notification centre: the bell lists what waits for the signed-in person only. Every count
// runs with the permission the deciding action checks, within the person's scope, and never
// counts their own records (S15 / S21); pay-run steps follow the maker-checker (F2); the list
// carries counts and pay months, never pay figures; support view stays read-only.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const fn = (src: string, name: string) => {
  const start = src.search(new RegExp(`export (async )?function ${name}\\b`));
  assert.ok(start >= 0, name);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

const service = read('lib/services/notification.service.ts');
const action = read('app/actions/notification.actions.ts');

describe('F17 notification centre', () => {
  it('the action reads the signed-in user only (no user id from the browser); support view gets the read-only centre', () => {
    assert.match(action, /^'use server';/);
    assert.match(action, /export async function getNotificationsAction\(\) \{/);
    assert.match(action, /const \{ userId, isImpersonation \} = await requireAuthenticatedUser\(\);/);
    assert.match(action, /isImpersonation \? await notifications\.supportNotifications\(\) : await notifications\.notificationsFor\(userId\)/);
    assert.match(action, /toActionError\(error, 'notifications'\)/);
  });

  it('each count runs only with the permission the deciding action checks (and the view its screen needs)', () => {
    const centre = fn(service, 'notificationCentre');
    assert.match(centre, /const decides = \(action: ActionType, module: ModuleType\) => views\(module\) && has\(action, module\);/);
    for (const line of [
      /leave: views\('LEAVE_APPROVALS'\) \|\| views\('LEAVE_APPLICATIONS'\),/,
      /details: decides\('APPROVE', 'EMPLOYEES'\),/,
      /reimbursements: decides\('APPROVE', 'REIMBURSEMENTS'\),/,
      /travel: decides\('APPROVE', 'TRAVEL'\),/,
      /evaluations: decides\('EDIT', 'PERFORMANCE'\),/,
      /targets: decides\('APPROVE', 'TARGETS'\),/,
      /canSend: decides\('EDIT', 'PAYROLL_GENERATE'\), canApprove: decides\('APPROVE', 'PAYROLL_REVIEW'\), canLock: decides\('LOCK', 'PAYROLL_REVIEW'\)/,
      /deadlines: views\('PAYROLL_GENERATE'\) \|\| views\('PAYROLL_REVIEW'\),/,
    ]) {
      assert.match(centre, line);
    }
    // S15 / S24: leave this user can decide — supervisees', or everyone's in scope with Approve.
    assert.match(centre, /counted\('leave', gate\.leave, \(\) => countLeaveWaitingFor\(scope, has\('APPROVE', 'LEAVE_APPROVALS'\)\)\)/);
    for (const kind of ['attendance', 'salary', 'details', 'reimbursements', 'travel', 'leavePolicy', 'evaluations', 'targets', 'teamTargets', 'runs']) {
      assert.match(centre, new RegExp(`counted\\('${kind}', gate\\.${kind},`), kind);
    }
  });

  it('new counts are within the scope and leave out the person\'s own records', () => {
    assert.match(fn(read('lib/services/reimbursement.service.ts'), 'countWaitingFor'), /repo\.countInStatus\("submitted", buildEmployeeScopeCondition\(scope\), scope\.employeeId\)/);
    assert.match(fn(read('lib/services/travel.service.ts'), 'countWaitingFor'), /repo\.countInStatus\('submitted', buildEmployeeScopeCondition\(scope\), scope\.employeeId\)/);
    const targets = read('lib/services/target.service.ts');
    assert.match(fn(targets, 'countWaitingFor'), /repo\.countInStatus\('forwarded', \{ scopeCondition: buildEmployeeScopeCondition\(scope\), excludeEmployeeId: scope\.employeeId \}\)/);
    assert.match(fn(targets, 'countTeamWaiting'), /\{ supervisorId: supervisorEmployeeId, excludeEmployeeId: supervisorEmployeeId \}/);
    assert.match(fn(read('lib/services/evaluation.service.ts'), 'countWaitingFor'), /repo\.countWaitingFor\(userId, buildEmployeeScopeCondition\(scope\)\)/);
    for (const [file, table] of [
      ['lib/repositories/reimbursement.repository.ts', 'reimbursementClaims'],
      ['lib/repositories/travel.repository.ts', 'travelClaims'],
      ['lib/repositories/target.repository.ts', 'employeeTargets'],
    ] as const) {
      const count = fn(read(file), 'countInStatus');
      assert.match(count, /\.innerJoin\(employees, eq\(\w+\.employeeId, employees\.id\)\)/, file);
      assert.match(count, new RegExp(`ne\\(${table}\\.employeeId, (filter\\.)?excludeEmployeeId\\)`), file);
    }
  });

  it('pay-run steps follow the move\'s own rules and the person\'s branches; the list carries no pay figures', () => {
    const runs = fn(read('lib/services/payroll-control.service.ts'), 'runsWaitingFor');
    assert.match(runs, /repo\.runsNeedingAction\(actor\.scope\.employeeId\)/);
    assert.match(runs, /\.filter\(\(run\) => runConcerns\(run, actor\.scope\)\)/);
    assert.match(runs, /const step = nextRunStep\(run, stepActor\);/);
    assert.match(fn(read('lib/engines/payroll-control.engine.ts'), 'nextRunStep'), /checkerRefusal\(\{ mode: actor\.mode, step, generatedBy: run\.generatedBy, actor: actor\.userId, actorIsAdmin: actor\.isAdmin, runIncludesActor: run\.includesActor \}\) === null/);
    const query = fn(read('lib/repositories/payroll-control.repository.ts'), 'runsNeedingAction');
    assert.doesNotMatch(query, /total(Gross|Deductions|NetPayable|Tds|Pf|Ssf)|netPay|grossPay/);
    assert.match(query, /\$\{payrollSlips\.employeeId\} = \$\{actorEmployeeId\}/);
    assert.doesNotMatch(read('lib/types/notification.ts'), /amount|gross|net\b/i);
  });

  it('the permission set follows verifyPermission: the same administrator roles, nothing for an inactive user', () => {
    const perms = read('lib/auth/get-user-permissions.ts');
    assert.match(perms, /export const ADMIN_ROLE_SLUGS: readonly string\[\] = \['system_admin', 'office_admin'\];/);
    assert.match(read('lib/auth/check-permission.ts'), /r\.slug === 'system_admin' \|\| r\.slug === 'office_admin'/);
    assert.match(fn(perms, 'permissionSetFor'), /\.where\(and\(eq\(users\.id, userId\), eq\(users\.isActive, true\)\)\);/);
  });

  it('the frame builds the centre from the session user\'s scope; support view only reads the company\'s waiting leave', () => {
    const ws = read('lib/services/workspace-context.service.ts');
    assert.match(ws, /const \[permissions, scope\] = await Promise\.all\(\[getUserPermissionSet\(\), resolveUserScope\(userId, tenantSlug\)\]\);/);
    assert.match(ws, /notifications = await notificationCentre\(\{ userId, scope, permissions \}\);/);
    assert.match(ws, /notifications: supportCentre\(pendingCount\),/);
    // The title bar shows the bell only to people who can receive something.
    assert.match(read('components/frame/title-bar.tsx'), /\{context\?\.notifications\.enabled && <NotificationBell initial=\{context\.notifications\} \/>\}/);
  });
});

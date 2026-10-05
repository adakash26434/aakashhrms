import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S24 (4.6): leave requests, approvals and balances.
const root = join(__dirname, '..');
const source = (file: string) => readFileSync(join(root, file), 'utf8');
const fnBody = (src: string, name: string) => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  // Up to the function's closing brace at the start of a line.
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end + 2);
};

const actions = source('app/actions/leave.actions.ts');
const service = source('lib/services/leave.service.ts');
const repo = source('lib/repositories/leave.repository.ts');

describe('S24 leave security', () => {
  it('every leave action checks a leave permission with scope and returns safe errors', () => {
    for (const name of ['previewLeaveAction', 'createLeaveRequestAction', 'decideLeaveRequestsAction', 'adjustLeaveBalanceAction', 'getLeaveLedgerAction']) {
      const body = fnBody(actions, name);
      assert.match(body, /ensureTenantContext\(\)/, name);
      assert.match(body, /checkPermissionWithScope\(|viewScope\(\)/, name);
      assert.match(body, /fail\(error, '/, name);
    }
    assert.match(fnBody(actions, 'fail'), /toActionError\(error, context\)/);
    assert.match(fnBody(actions, 'viewScope'), /'LEAVE_APPLICATIONS'[\s\S]*'LEAVE_APPROVALS'/);
  });

  it('changes are audited, refusals too (own record, out of scope)', () => {
    assert.match(fnBody(actions, 'createLeaveRequestAction'), /result: 'SUCCESS'/);
    assert.match(fnBody(actions, 'decideLeaveRequestsAction'), /result: 'SUCCESS'/);
    assert.match(fnBody(actions, 'adjustLeaveBalanceAction'), /result: 'SUCCESS'/);
    const refusal = fnBody(actions, 'auditRefusal');
    assert.match(refusal, /OwnLeaveError[\s\S]*DENIED_SELF/);
    assert.match(refusal, /OutOfScopeError[\s\S]*'DENIED_SCOPE'/);
  });

  it('support view (impersonation) cannot decide leave; ids are validated', () => {
    const body = fnBody(actions, 'decideLeaveRequestsAction');
    assert.match(body, /getImpersonationSession\(\)/);
    assert.match(body, /UUID\.test\(id\)/);
    assert.match(body, /MAX_BULK/);
  });

  it('the server counts the days; the browser never sends them', () => {
    const create = fnBody(service, 'createRequest');
    assert.match(create, /previewFor\(person, type, input\)/);
    assert.match(create, /days: p\.days/);
    assert.doesNotMatch(create, /r\.(noOfDays|days)\b/);
    assert.doesNotMatch(fnBody(service, 'parseInput'), /\br\.(noOfDays|days|paidDays)\b/);
  });

  it('nobody approves, cancels or adjusts their own leave (S21)', () => {
    const decide = fnBody(service, 'decide');
    assert.match(decide, /isOwnRecord\(ctx\.scope\.employeeId, person\.id\)/);
    assert.match(decide, /if \(own\) throw new OwnAttendanceError/);
    assert.match(decide, /availableActions\(request, actor/);
    assert.match(fnBody(service, 'adjustBalance'), /isOwnRecord\(ctx\.scope\.employeeId, person\.id\)/);
  });

  it('only people in scope (or supervisees) can be acted on', () => {
    assert.match(fnBody(service, 'decide'), /if \(!inScope && !supervisor && !own && a\.preparedBy !== ctx\.userId\) throw new OutOfScopeError\(\)/);
    assert.match(fnBody(service, 'adjustBalance'), /employeesFor\(ctx\.scope\)[\s\S]*OutOfScopeError/);
    assert.match(fnBody(service, 'ledgerFor'), /employeesFor\(scope\)[\s\S]*OutOfScopeError/);
    assert.match(fnBody(service, 'employeesFor'), /buildEmployeeScopeCondition\(scope\)/);
  });

  it('approval re-checks the balance, overlaps and closed months; cancelling is refused in a closed month', () => {
    const decide = fnBody(service, 'decide');
    assert.match(decide, /next\.status === "approved"[\s\S]*previewFor\(person, type, \{[\s\S]*\}, id\)/);
    assert.match(decide, /Can't approve: /);
    assert.match(decide, /decision === "cancel"[\s\S]*await guardOpen\(person/);
    assert.match(decide, /reject[\s\S]*Labour Act §51/);
  });

  it('decisions are conditional on the status and write the ledger in the same transaction', () => {
    const fn = fnBody(repo, 'decideRequest');
    assert.match(fn, /\.transaction\(/);
    assert.match(fn, /eq\(leaveApplications\.status, p\.expectedStatus\)/);
    assert.match(fn, /postLedgerLines\(p\.ledger, tx\)/);
    assert.match(fn, /approvalActions/);
  });

  it('the ledger is never edited or deleted', () => {
    const all = [repo, service, source('lib/services/leave-salary.service.ts'), source('lib/services/employee.service.ts'), source('lib/services/self-service.service.ts')].join('\n');
    assert.doesNotMatch(all, /\.update\(leaveLedger\)/);
    assert.doesNotMatch(all, /\.delete\(leaveLedger\)/);
  });

  it('self-service takes the employee from the session and goes through the leave service', () => {
    const ss = source('lib/services/self-service.service.ts');
    assert.match(fnBody(ss, 'applyForLeave'), /getSessionEmployeeId\(\)[\s\S]*leaveService\.createRequest\(input, \{ userId, source: 'self_service', selfEmployeeId: employeeId \}\)/);
    assert.match(fnBody(ss, 'withdrawMyLeave'), /leaveService\.withdrawOwn\(id, employeeId, userId\)/);
    assert.match(fnBody(ss, 'getMyLeaveBalances'), /leaveService\.myBalances\(employeeId\)/);
    // Reading balances no longer writes them.
    assert.doesNotMatch(fnBody(ss, 'getMyLeaveBalances'), /\.update\(/);
    assert.match(fnBody(service, 'withdrawOwn'), /a\.employeeId !== employeeId/);
    const ssActions = source('app/actions/self-service.actions.ts');
    assert.match(fnBody(ssActions, 'applyForLeaveAction'), /recordAuditLog[\s\S]*toActionError/);
    assert.match(fnBody(ssActions, 'withdrawMyLeaveAction'), /recordAuditLog[\s\S]*toActionError/);
  });

  it('attendance reads approved leave day by day from the leave service', () => {
    const att = source('lib/services/attendance.service.ts');
    assert.match(att, /approvedLeaveDays\(ids, from, to\)/);
    assert.doesNotMatch(att, /findApprovedLeaves/);
  });

  it('the bell counts only leave this user can decide', () => {
    const ws = source('lib/services/workspace-context.service.ts');
    assert.match(ws, /countLeaveWaitingFor\(scope, await hasPermission\('APPROVE', 'LEAVE_APPROVALS'\)\)/);
    const count = fnBody(service, 'countWaitingFor');
    assert.match(count, /w\.employeeId !== scope\.employeeId && w\.preparedBy !== scope\.userId/);
  });

  it('statutory leave types cannot be changed or switched off in the old editor (no going below the law)', () => {
    const lt = source('lib/services/leave-type.service.ts');
    assert.match(fnBody(lt, 'saveLeaveType'), /existing\.isStatutory\) throw new UserFacingError\(STATUTORY_LOCKED\)/);
    assert.match(fnBody(lt, 'toggleLeaveTypeStatus'), /isStatutory\) throw new UserFacingError\(STATUTORY_LOCKED\)/);
  });
});

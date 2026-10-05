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

// S24 (4.6b): opening a leave year, substitute leave, entitlements posted with attendance.
const entitlements = source('lib/services/leave-entitlement.service.ts');
const attendanceRepo = source('lib/repositories/attendance.repository.ts');
const attendanceService = source('lib/services/attendance.service.ts');
const leavesPage = source('app/(dashboard)/timeAndLeave/leaves/page.tsx');

describe('S24 leave entitlements (4.6b)', () => {
  it('opening a leave year: company-wide only, never from support view, audited, once', () => {
    assert.match(fnBody(actions, 'openYearScope'), /checkPermissionWithScope\('EDIT', 'LEAVE_APPLICATIONS'\)[\s\S]*scopeType !== 'GLOBAL'/);
    assert.match(fnBody(actions, 'leaveOpeningPreviewAction'), /openYearScope\(\)/);
    const open = fnBody(actions, 'openLeaveYearAction');
    assert.match(open, /getImpersonationSession\(\)/);
    assert.match(open, /openYearScope\(\)/);
    assert.match(open, /result: 'SUCCESS'/);
    assert.match(open, /fail\(error, '/);
    assert.match(fnBody(entitlements, 'openingPreview'), /scope\.scopeType !== "GLOBAL"/);
    // What blocks opening is exactly the checklist the window shows.
    assert.match(fnBody(entitlements, 'openingPreview'), /const problems = checks\.filter\(\(c\) => !c\.ok\)/);
    // The year is opened again from the server's own preview (problems stop it), and the database allows one opening per year.
    const service = fnBody(entitlements, 'openYear');
    assert.match(service, /openingPreview\(scope\)/);
    assert.match(service, /preview\.problems\.length\) throw/);
    const tx = fnBody(repo, 'openYear');
    assert.match(tx, /onConflictDoNothing\(\{ target: leaveYearOpenings\.fiscalYearId \}\)/);
    assert.match(tx, /postLedgerLines\(p\.lines\.slice\(i, i \+ 500\), tx\)/);
    assert.match(leavesPage, /openYear = edit && scope\.scopeType === "GLOBAL"/);
  });

  it('substitute leave: in scope, never your own, only days attendance shows as worked, decided once', () => {
    const action = fnBody(actions, 'grantSubstituteLeaveAction');
    assert.match(action, /checkPermissionWithScope\('EDIT', 'LEAVE_APPLICATIONS'\)/);
    assert.match(action, /getImpersonationSession\(\)/);
    assert.match(action, /result: 'SUCCESS'/);
    assert.match(action, /auditRefusal\(error, scope/);
    const grant = fnBody(entitlements, 'grantSubstitute');
    assert.match(grant, /MAX_GRANTS/);
    assert.match(grant, /isOwnRecord\(ctx\.scope\.employeeId, i\.employeeId\)\)\) throw new OwnAttendanceError/);
    assert.match(grant, /substituteSuggestions\(ctx\.scope\)/);
    assert.match(grant, /if \(s\.decided\) throw/);
    assert.match(grant, /i\.days === 0 && i\.note\.length < 3/);
    assert.match(grant, /findLinesByRef\([\s\S]*"substitute:"\)[\s\S]*Someone else decided/);
    // Suggestions read people through the user's scope.
    assert.match(fnBody(entitlements, 'substituteSuggestions'), /buildEmployeeScopeCondition\(scope\)/);
    assert.match(fnBody(entitlements, 'leaveCalendar'), /buildEmployeeScopeCondition\(scope\)/);
  });

  it('home leave is posted with the month close and taken back on reopen, in the same transaction', () => {
    assert.match(fnBody(attendanceRepo, 'closePeriod'), /postLedgerLines\(params\.ledger, tx\)/);
    assert.match(fnBody(attendanceRepo, 'reopenPeriod'), /postLedgerLines\(params\.ledger, tx\)/);
    assert.match(fnBody(attendanceService, 'closeMonth'), /monthCloseLines\([\s\S]*repo\.closePeriod\(\{[\s\S]*?ledger \}\)/);
    assert.match(fnBody(attendanceService, 'reopenMonth'), /monthReopenLines\([\s\S]*repo\.reopenPeriod\(\{[\s\S]*?ledger \}\)/);
    // Closing again after a reopen posts only the difference (ref per month), never twice.
    assert.match(fnBody(service, 'monthCloseLines'), /findLinesByRef\(ids, ref\)[\s\S]*earned - already/);
  });

  it('balances in force honour substitute expiry (requests, adjustments, self-service)', () => {
    assert.match(fnBody(service, 'previewFor'), /balanceOn\(/);
    assert.match(fnBody(service, 'myBalances'), /balanceOn\(/);
    assert.match(fnBody(service, 'adjustBalance'), /balanceOn\(/);
  });

  it('the ledger stays append-only', () => {
    assert.doesNotMatch(repo, /\.update\(leaveLedger\)|\.delete\(leaveLedger\)/);
    assert.doesNotMatch(entitlements, /\.update\(|\.delete\(/);
  });
});

// S24 (4.6b): switching up-front home leave to earned home leave.
const homeLeave = source('lib/services/home-leave.service.ts');

describe('S24 home leave switch (4.6b)', () => {
  it('company-wide only, never from support view, audited, once per person and year', () => {
    const action = fnBody(actions, 'switchHomeLeaveAction');
    assert.match(action, /getImpersonationSession\(\)/);
    assert.match(action, /openYearScope\(\)/);
    assert.match(action, /result: 'SUCCESS'/);
    assert.match(fnBody(actions, 'homeSwitchPreviewAction'), /openYearScope\(\)/);
    for (const name of ['homeSwitchPreview', 'switchHomeLeave']) assert.match(fnBody(homeLeave, name), /assertCompanyWide\(scope\)/, name);
    const run = fnBody(homeLeave, 'switchHomeLeave');
    assert.match(run, /findLinesByRef\([\s\S]*switchRef\(year\.id\)\)[\s\S]*Someone else made this switch/);
    // A person already switched is never switched again.
    assert.match(fnBody(homeLeave, 'upFrontOf'), /l\.ref === switchRef\(year\.id\)\)\) return null/);
  });

  it('reading a home leave year follows the scope; the employee record and self-service pass already-checked people', () => {
    const read = fnBody(actions, 'getHomeLeaveYearAction');
    assert.match(read, /UUID\.test\(employeeId\)/);
    assert.match(read, /homeLeaveFor\(employeeId, await viewScope\(\)\)/);
    assert.match(fnBody(homeLeave, 'homeLeaveFor'), /buildEmployeeScopeCondition\(scope\)[\s\S]*throw new OutOfScopeError\(\)/);
    assert.match(source('lib/services/self-service.service.ts'), /getSessionEmployeeId\(\);\s*return homeLeaveService\.homeLeaveFor\(employeeId, "checked"\)/);
  });

  it('until the switch the month close adds no home leave on top of the up-front days; after it, it does', () => {
    const close = fnBody(service, 'monthCloseLines');
    assert.match(close, /home-earned:\$\{year\}/);
    assert.match(close, /!switched\.has\(l\.employeeId\)/);
    assert.match(close, /if \(upFront\.has\(x\.employeeId\)\) continue/);
  });
});

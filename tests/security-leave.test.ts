import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// S24 (4.6): leave requests, approvals and balances.
const root = join(__dirname, '..');
// LF line endings whatever git checked out (core.autocrlf writes CRLF on Windows).
const source = (file: string) => readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');
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
    assert.match(create, /previewFor\(person, type, input, \{ source: ctx\.source, appliedOn: nepalDateIso\(\) \}\)/);
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
    // F17: the notification centre counts it (the workspace context reads the centre).
    const centre = source('lib/services/notification.service.ts');
    assert.match(centre, /countLeaveWaitingFor\(scope, has\('APPROVE', 'LEAVE_APPROVALS'\)\)/);
    const count = fnBody(service, 'countWaitingFor');
    assert.match(count, /w\.employeeId !== scope\.employeeId && w\.preparedBy !== scope\.userId/);
  });

  it('statutory leave types cannot be changed or switched off in the old editor (no going below the law)', () => {
    const lt = source('lib/services/leave-type.service.ts');
    assert.match(fnBody(lt, 'saveLeaveType'), /existing\?\.isStatutory\) throw new UserFacingError\(STATUTORY_LOCKED\)/);
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

// S24 (4.6b): starting balances when a company starts keeping leave here.
describe('S24 starting balances (4.6b)', () => {
  const leaveRepo = source('lib/repositories/leave.repository.ts');
  it('company-wide only, never from support view, never your own, audited', () => {
    const save = fnBody(actions, 'saveStartingBalancesAction');
    assert.match(save, /getImpersonationSession\(\)/);
    assert.match(save, /openYearScope\(\)/);
    assert.match(save, /result: 'SUCCESS'/);
    assert.match(save, /auditRefusal\(error, scope/);
    assert.match(fnBody(actions, 'startingBalancesAction'), /openYearScope\(\)/);
    const svc = fnBody(homeLeave, 'saveStartingBalances');
    assert.match(svc, /assertCompanyWide\(ctx\.scope\)/);
    assert.match(svc, /isOwnRecord\(ctx\.scope\.employeeId, c\.employeeId\)\)\) throw new OwnAttendanceError/);
    assert.match(svc, /MAX_START_CELLS/);
    assert.match(svc, /c\.days < 0 \|\| c\.days > 999/);
  });

  it('records only the difference, and the start month is fixed once in the same transaction', () => {
    const svc = fnBody(homeLeave, 'saveStartingBalances');
    assert.match(svc, /const diff = r2\(c\.days - cell\.now\)/);
    assert.match(svc, /if \(diff === 0\) continue/);
    const tx = fnBody(leaveRepo, 'saveStartingBalances');
    assert.match(tx, /onConflictDoNothing\(\{ target: systemConfig\.key \}\)/);
    assert.match(tx, /LEAVE_START_CHANGED/);
    assert.match(tx, /postLedgerLines\(p\.lines\.slice\(i, i \+ 500\), tx\)/);
  });

  it('months before the start add or take back no home leave, and do not block opening the next year', () => {
    assert.match(fnBody(service, 'monthCloseLines'), /if \(home && !\(start && p\.period\.end < start\.start\)\)/);
    assert.match(fnBody(service, 'monthReopenLines'), /if \(start && p\.period\.end < start\.start\) return \[\]/);
    assert.match(fnBody(entitlements, 'openMonths'), /!\(start && p\.end < start\.start\)/);
  });

  it('starting balances are never mistaken for the old system up-front days', () => {
    assert.match(fnBody(homeLeave, 'upFrontOf'), /l\.kind === "opening" && !l\.ref/);
    assert.match(fnBody(service, 'monthCloseLines'), /l\.kind === "opening" && !l\.ref/);
  });
});

describe('S24 leave policies (4.6c)', () => {
  const policyActions = source('app/actions/leave-policy.actions.ts');
  const policyService = source('lib/services/leave-policy.service.ts');
  const policyRepo = source('lib/repositories/leave-policy.repository.ts');
  const ruleTypesService = source('lib/services/leave-rule-types.service.ts');

  it('every action checks Leave types with scope, refuses support view and returns safe errors', () => {
    assert.match(fnBody(policyActions, 'policyCtx'), /checkPermissionWithScope\('VIEW', 'LEAVE_TYPES'\)[\s\S]*hasPermission\('EDIT', 'LEAVE_TYPES'\)[\s\S]*hasPermission\('APPROVE', 'LEAVE_TYPES'\)[\s\S]*getImpersonationSession\(\)/);
    for (const name of ['previewLeavePolicyAction', 'proposeLeavePolicyAction', 'decideLeavePolicyAction']) {
      const body = fnBody(policyActions, name);
      assert.match(body, /ensureTenantContext\(\)/, name);
      assert.match(body, /policyCtx\(\)/, name);
      assert.match(body, /fail\(error, 'leave-policy\./, name);
    }
    assert.match(fnBody(policyActions, 'fail'), /toActionError\(error, context\)/);
    assert.match(fnBody(policyActions, 'proposeLeavePolicyAction'), /Support view can't change/);
    assert.match(fnBody(policyService, 'decideChanges'), /if \(ctx\.impersonation\) throw/);
  });

  it('proposing needs Edit and a company-wide role; the minimum is checked when proposed and again when approved', () => {
    for (const name of ['previewChange', 'proposeChange']) assert.match(fnBody(policyService, name), /if \(!ctx\.canEdit \|\| !companyWide\(ctx\)\) throw/, name);
    assert.match(fnBody(policyService, 'planOf'), /policyErrors\(type\.statutoryCode, current, change, floorOn\(type\.statutoryCode, today, exceptions\)\)/);
    assert.match(fnBody(policyService, 'decideChanges'), /const errors = policyErrors\(type\.statutoryCode, current, after, floorOn\(/);
    assert.match(fnBody(policyService, 'decideChanges'), /It can't be approved/);
  });

  it('nobody approves a change they proposed, administrators included; approving needs a company-wide role', () => {
    assert.match(policyService, /const decisionCtx = \(today: string\) => \(\{ approvers: \[\], today, wording: WORDING, preparerMayFinalApprove: false \}\)/);
    assert.match(fnBody(policyService, 'actorOf'), /ctx\.canApprove && companyWide\(ctx\)/);
    assert.match(fnBody(policyActions, 'decideLeavePolicyAction'), /r\.refusal === 'self'\) await recordAuditLog\([\s\S]*DENIED_SELF/);
  });

  it('a change applies only once approved, in one transaction guarded by its status; due parts apply once', () => {
    const decide = fnBody(policyRepo, 'decideChange');
    assert.match(decide, /eq\(leaveTypeChanges\.status, "pending"\)/);
    assert.match(decide, /if \(!done\.length\) return false/);
    assert.match(decide, /if \(p\.status === "approved"\) \{[\s\S]*applyToType/);
    assert.match(decide, /postLedgerLines\(p\.ledger, tx\)/);
    assert.match(fnBody(policyRepo, 'applyDue'), /isNull\(leaveTypeChanges\.appliedAt\)/);
    assert.match(fnBody(policyRepo, 'createChange'), /status: "pending"/);
  });

  it('the top-up is posted once per change (policy: ref) and only for a raise', () => {
    const lines = fnBody(policyService, 'topUpLines');
    assert.match(lines, /ref: `policy:\$\{changeId\}`/);
    assert.match(lines, /plan\.change\.days <= plan\.current\.days\) return/);
  });

  it('statutory types never stay below the minimum; this never stops leave from working', () => {
    const due = fnBody(ruleTypesService, 'applyDueChanges');
    assert.match(due, /raiseToFloor\(t\.statutoryCode, values, floor\)/);
    assert.match(due, /recordSystemChange\(/);
    assert.match(due, /catch \(err\)[\s\S]*return false/);
    assert.match(fnBody(policyRepo, 'recordSystemChange'), /\.for\("update"\)/);
    for (const file of ['lib/services/leave.service.ts', 'lib/services/leave-entitlement.service.ts', 'lib/services/home-leave.service.ts']) {
      assert.doesNotMatch(source(file), /repo\.findRuleTypes\(\)/, `${file} reads leave types without applying due changes`);
    }
  });

  it('only platform code writes exceptions; company code reads them', () => {
    for (const file of ['app/actions/leave-policy.actions.ts', 'lib/services/leave-policy.service.ts', 'lib/repositories/leave-policy.repository.ts', 'lib/services/leave-rule-types.service.ts']) {
      assert.doesNotMatch(source(file), /(insert|update|delete)\(leavePolicyExceptions\)/, file);
    }
  });

  it('the platform can never lower a company setting or create one below the law', () => {
    const sync = source('app/api/platform/policies/sync/route.ts');
    const conflict = sync.slice(sync.indexOf('onConflictDoUpdate({\n              target: leaveTypes.code'), sync.indexOf('// B. Upsert Statutory Overtime Rules'));
    assert.doesNotMatch(conflict, /noOfDays|accumulationCap|maxPaidDays|requiresDocument/);
    assert.match(sync, /lawfulPreset\(lr\.statutoryCode/);
    const company = source('app/api/platform/companies/[id]/route.ts');
    assert.match(company, /if \(existingLT\) continue;/);
    assert.doesNotMatch(company, /update\(leaveTypes\)/);
    assert.match(company, /lawfulPreset\(lt\.code/);
    assert.match(source('lib/platform/provisioning/seed-tenant.ts'), /lawfulPreset\(lt\.code/);
    assert.doesNotMatch(source('lib/platform/provisioning/seed-tenant.ts'), /accumulationCap: String\(lt\.maxAccumulation \|\| 0\)/);
  });

  it('company leave types: a used type is switched off, never deleted; changes audited with safe errors', () => {
    const types = source('lib/services/leave-type.service.ts');
    assert.match(fnBody(types, 'deleteLeaveType'), /leaveTypeInUse\(id\)\) throw new UserFacingError/);
    const typeActions = source('app/actions/leave-type.actions.ts');
    for (const name of ['saveLeaveTypeAction', 'deleteLeaveTypeAction', 'toggleLeaveTypeStatusAction']) {
      const body = fnBody(typeActions, name);
      assert.match(body, /recordAuditLog\(/, name);
      assert.match(body, /toActionError\(error, 'leave-type\./, name);
      assert.doesNotMatch(body, /error\.message/, name);
    }
  });

  it('the old leave type editor still refuses statutory types', () => {
    const types = source('lib/services/leave-type.service.ts');
    assert.match(fnBody(types, 'saveLeaveType'), /existing\?\.isStatutory\) throw new UserFacingError\(STATUTORY_LOCKED\)/);
    assert.match(fnBody(types, 'toggleLeaveTypeStatus'), /isStatutory\) throw new UserFacingError\(STATUTORY_LOCKED\)/);
  });
});

describe('S24 leave exceptions (4.6d)', () => {
  const platform = source('lib/platform/leave-exceptions.ts');
  const policyActions = source('app/actions/leave-policy.actions.ts');
  const policyService = source('lib/services/leave-policy.service.ts');

  it('every platform route needs a platform session and answers with safe errors', () => {
    for (const file of ['app/api/platform/leave-exceptions/route.ts', 'app/api/platform/leave-exceptions/[id]/route.ts', 'app/api/platform/leave-exceptions/requests/[id]/route.ts']) {
      const src = source(file);
      const handlers = src.match(/export async function (GET|POST|PATCH)/g) ?? [];
      assert.ok(handlers.length > 0, file);
      assert.equal((src.match(/await requirePlatformAuth\(request\)/g) ?? []).length, handlers.length, file);
      assert.match(src, /exceptionFailure\(error, 'leave-exceptions\./, file);
    }
    assert.match(fnBody(platform, 'exceptionFailure'), /Something went wrong\. Nothing was changed\./);
  });

  it('a grant is checked by the engine, never overlaps, reviews a request once, and is audited', () => {
    const grant = fnBody(platform, 'grantException');
    assert.match(grant, /exceptionErrors\(p\.input, today\)/);
    assert.match(grant, /overlapping\(e, \{ \.\.\.p\.input, revokedAt: null \}\)/);
    assert.match(grant, /eq\(companyChangeRequests\.kind, LEAVE_EXCEPTION\), eq\(companyChangeRequests\.status, 'PENDING'\)/);
    assert.match(grant, /action: 'LEAVE_EXCEPTION_GRANTED'/);
    assert.match(grant, /pushQuietly\(p\.companyId\)/);
  });

  it('revoking and rejecting need a reason, are audited, and revoking reaches the company', () => {
    const revoke = fnBody(platform, 'revokeException');
    assert.match(revoke, /reason\.length < 5/);
    assert.match(revoke, /isNull\(companyLeaveExceptions\.revokedAt\)/);
    assert.match(revoke, /'LEAVE_EXCEPTION_REVOKED'/);
    assert.match(revoke, /pushQuietly\(done\.companyId\)/);
    const reject = fnBody(platform, 'rejectExceptionRequest');
    assert.match(reject, /reason\.length < 5/);
    assert.match(reject, /'LEAVE_EXCEPTION_REQUEST_REJECTED'/);
    assert.match(source('app/api/platform/policies/sync/route.ts'), /await pushToCompany\(company\.id\)/);
  });

  it('only the platform module writes the company copy of exceptions', () => {
    const walk = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => (statSync(join(root, dir, f)).isDirectory() ? walk(`${dir}/${f}`) : [`${dir}/${f}`]));
    const writers = ['app', 'lib', 'components']
      .flatMap(walk)
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /\.(insert|update|delete)\(leavePolicyExceptions\)/.test(source(f)));
    assert.deepEqual(writers, ['lib/platform/leave-exceptions.ts']);
  });

  it('a company asks only with a company-wide editing role, never from support view, for its own company from the session', () => {
    const ask = fnBody(policyService, 'requestException');
    assert.match(ask, /askingRole\(ctx\)/);
    assert.match(policyService, /if \(ctx\.impersonation\) throw new UserFacingError\("Support view can't ask for exceptions/);
    assert.match(policyService, /if \(!ctx\.canEdit \|\| !companyWide\(ctx\)\) throw new UserFacingError\("Asking for an exception needs/);
    const ctx = fnBody(policyActions, 'policyCtx');
    assert.match(ctx, /resolvePlatformCompanyForTenant\(session\?\.user\?\.tenantSlug/);
    assert.match(fnBody(policyActions, 'requestLeaveExceptionAction'), /policyCtx\(true\)[\s\S]*recordAuditLog\(/);
    assert.match(fnBody(platform, 'cancelExceptionRequest'), /eq\(companyChangeRequests\.companyId, p\.companyId\)/);
  });

  it('company-details requests and leave exceptions never mix', () => {
    assert.match(source('app/api/platform/change-requests/[id]/route.ts'), /if \(req\.kind !== 'company_details'\)/);
    assert.match(source('app/api/platform/change-requests/route.ts'), /eq\(companyChangeRequests\.kind, 'company_details'\)/);
    // 4.12c: the company side lives in lib/platform/company-details.ts (S53).
    const details = source('lib/platform/company-details.ts');
    assert.match(details, /export const COMPANY_DETAILS = 'company_details';/);
    assert.equal((details.match(/eq\(companyChangeRequests\.kind, COMPANY_DETAILS\)/g) ?? []).length, 3);
    assert.match(details, /kind: COMPANY_DETAILS,/);
    assert.doesNotMatch(source('app/actions/company-setup.actions.ts'), /companyChangeRequests/);
  });
});

describe('S24 company leave types and Leave rules retired (4.6e)', () => {
  const typeActions = source('app/actions/leave-type.actions.ts');
  const typeService = source('lib/services/leave-type.service.ts');
  const policyRepo = source('lib/repositories/leave-policy.repository.ts');

  it('every company type action checks Leave types with scope, needs a company-wide role and returns safe errors', () => {
    assert.match(fnBody(typeActions, 'typeCtx'), /checkPermissionWithScope\(action, 'LEAVE_TYPES'\)[\s\S]*companyWide: scope\.scopeType === 'GLOBAL'/);
    for (const name of ['saveLeaveTypeAction', 'previewLeaveTypeThisYearAction', 'deleteLeaveTypeAction', 'toggleLeaveTypeStatusAction']) {
      const body = fnBody(typeActions, name);
      assert.match(body, /ensureTenantContext\(\)/, name);
      assert.match(body, /await typeCtx\('(ADD|EDIT|DELETE)'\)|await typeCtx\(id \? 'EDIT' : 'ADD'\)/, name);
      assert.match(body, /toActionError\(error, 'leave-type\./, name);
    }
    for (const name of ['saveLeaveType', 'previewThisYear', 'deleteLeaveType', 'toggleLeaveTypeStatus']) assert.match(fnBody(typeService, name), /assertCompanyWide\(ctx\)/, name);
  });

  it('the server checks the form itself and never saves a statutory type or a stale edit', () => {
    const save = fnBody(typeService, 'saveLeaveType');
    assert.match(save, /if \(existing\?\.isStatutory\) throw new UserFacingError\(STATUTORY_LOCKED\)/);
    assert.match(save, /options\.version && existing\.updatedAt\.toISOString\(\) !== options\.version/);
    assert.match(fnBody(typeService, 'checkedForm'), /normalizeLeaveTypeForm\([\s\S]*validateLeaveTypeForm\(form\)[\s\S]*Another leave type has this code/);
    const repoSave = fnBody(policyRepo, 'saveCompanyType');
    assert.match(repoSave, /\.for\("update"\)[\s\S]*current\.isStatutory \|\| \(p\.readAt && current\.updatedAt\.getTime\(\) !== p\.readAt\.getTime\(\)\)/);
    assert.match(fnBody(policyRepo, 'companyColumns'), /isStatutory: false,\s*statutoryCode: null,\s*isRight: false/);
    assert.match(repoSave, /source: "company"[\s\S]*approvalRoute: "not_required"/, 'every save is a version in the history');
  });

  it('a used type is never deleted and its kind never changes; "also this year" never takes more than is left', () => {
    assert.match(fnBody(typeService, 'deleteLeaveType'), /leaveTypeInUse\(id\)[\s\S]*Switch it off instead/);
    assert.match(fnBody(typeService, 'saveLeaveType'), /before!\.kind !== form\.kind && \(await repository\.leaveTypeInUse\(existing\.id\)\)/);
    assert.match(fnBody(typeService, 'thisYearLines'), /thisYearChange\(\{[\s\S]*balance: balanceOn\(mine, today\)\.available/);
    assert.match(fnBody(typeService, 'thisYearLines'), /ref: `policy:\$\{changeId\}`/);
  });

  it('rights and statutory leave are never limited by notice, service or yearly limits', () => {
    assert.match(fnBody(source('lib/engines/leave.engine.ts'), 'checkRequest'), /if \(!t\.isStatutory && !t\.isRight\) \{[\s\S]*eligibleAfterDays[\s\S]*noticeDays[\s\S]*maxDaysPerYear[\s\S]*maxDaysInService/);
    assert.match(fnBody(repo, 'findRuleTypes'), /noticeDays: r\.isStatutory \? null : c\.noticeDays/);
    // Notice is counted from the day the request was made, also when it is approved later.
    assert.match(fnBody(service, 'decide'), /appliedOn: String\(a\.appliedDate\)\.slice\(0, 10\)/);
  });

  it('monthly credits post once per month and come back on reopen; reopening one month never touches another', () => {
    const close = fnBody(service, 'monthCloseLines');
    assert.match(close, /creditedMonthly\(t\)[\s\S]*givenYearly\.has\(e\.id\) \|\| !typeAppliesTo\(t, e\)[\s\S]*due - already/);
    assert.match(close, /l\.leaveTypeId === home\.id && l\.ref === ref/);
    assert.match(fnBody(service, 'monthReopenLines'), /findLinesByRef\(p\.employeeIds, ref\)\)\.filter\(\(l\) => l\.ref === ref\)/);
  });

  it('leave salary reads the leave type\'s payout rate; a fixed rate is never below basic', () => {
    const salary = source('lib/services/leave-salary.service.ts');
    assert.match(fnBody(salary, 'payoutOf'), /payoutRate\(leaveType,/);
    // 4.9: every amount is worked out in one place, from the leave type's rate.
    assert.match(salary, /async function amountsFor\(type: LeaveTypeRecord, basic: number, days: number\) \{\s*const pay = await payoutOf\(type\);/);
    assert.equal((salary.match(/calculateLeaveSalary\(/g) ?? []).length, 1);
    assert.match(source('lib/engines/leave-salary.engine.ts'), /Decimal\.max\(new Decimal\(args\.fixedDailyAmount\), new Decimal\(args\.basicSalary\)\.dividedBy\(workDays\)\)/);
  });

  it('nothing writes leave_rules any more; onboarding adds only lawful statutory types', () => {
    for (const file of ['lib/platform/provisioning/seed-tenant.ts', 'lib/repositories/onboarding.repository.ts', 'app/api/platform/policies/sync/route.ts', 'app/api/platform/companies/[id]/route.ts']) {
      assert.doesNotMatch(source(file), /insert\((schema\.)?leaveRules\)|update\((schema\.)?leaveRules\)/, file);
    }
    const onboarding = fnBody(source('lib/repositories/onboarding.repository.ts'), 'bootstrapStatutoryLeavesAndOT');
    assert.match(onboarding, /!STATUTORY_FLOOR\[lt\.code\]\) continue/);
    assert.match(onboarding, /lawfulPreset\(lt\.code/);
    assert.match(source('app/(dashboard)/timeAndLeave/leave-rules/page.tsx'), /redirect\("\/timeAndLeave\/policies\?tab=types"\)/);
  });
});

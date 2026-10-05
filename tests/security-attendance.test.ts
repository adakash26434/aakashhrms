import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { availableActions } from '../lib/engines/approval.engine';

// Security plan S22 (4.5 Attendance): scope on every read and write, nobody
// changes or approves their own attendance (S21), audit, safe errors, one
// row per day, month close guards, payroll never unlocks or writes, scoped
// and audited report export.

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const actions = read('app/actions/attendance.actions.ts');
const service = read('lib/services/attendance.service.ts');
const repo = read('lib/repositories/attendance.repository.ts');

const fnBody = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, name);
  const next = src.indexOf('\nexport async function', start + 10);
  return next > 0 ? src.slice(start, next) : src.slice(start);
};

describe('S22: attendance actions', () => {
  const names = [
    ['setAttendanceOverridesAction', 'EDIT'],
    ['addAttendancePunchesAction', 'ADD'],
    ['voidAttendancePunchAction', 'EDIT'],
    ['createAttendanceAdjustmentAction', 'ADD'],
    ['closeAttendanceMonthAction', 'LOCK'],
    ['reopenAttendanceMonthAction', 'LOCK'],
    ['saveAttendanceRulesAction', 'EDIT'],
  ] as const;
  it('every write checks ATTENDANCE with scope, audits and hides raw errors', () => {
    for (const [name, action] of names) {
      const fn = fnBody(actions, name);
      assert.match(fn, new RegExp(`checkPermissionWithScope\\('${action}', 'ATTENDANCE'\\)`), name);
      assert.match(fn, /recordAuditLog\(/, name);
      assert.match(fn, /fail\(error, /, name);
    }
    // Only messages written for users (UserFacingError) are passed on as they are.
    for (const line of actions.split(/\r?\n/).filter((l) => l.includes('error.message'))) assert.match(line, /UserFacingError/, line);
  });
  it('decisions: View with scope, then the approval engine decides; each audited', () => {
    const fn = fnBody(actions, 'decideAttendanceAdjustmentsAction');
    assert.match(fn, /checkPermissionWithScope\('VIEW', 'ATTENDANCE'\)/);
    assert.match(fn, /hasPermission\('APPROVE', 'ATTENDANCE'\)/);
    assert.match(fn, /slice\(0, MAX_BULK\)/);
    assert.match(fn, /recordAuditLog\(/);
  });
  it('own attendance is refused and audited DENIED_SELF; out of scope DENIED_SCOPE', () => {
    assert.match(actions, /OwnAttendanceError\)[\s\S]*result: DENIED_SELF/);
    assert.match(actions, /OutOfScopeError\)[\s\S]*result: 'DENIED_SCOPE'/);
    assert.match(service, /includesOwnRecord\(scope\.employeeId, cells\.map\(\(c\) => c\.employeeId\)\)/);
  });
  it('the rules are a company administrator control, never platform support', () => {
    const fn = fnBody(actions, 'saveAttendanceRulesAction');
    assert.match(fn, /scope\.scopeType !== 'GLOBAL'/);
    assert.match(fn, /scope\.isImpersonation/);
  });
});

describe('S22: service guards', () => {
  it('reads and writes only employees in scope', () => {
    assert.match(service, /repo\.findEmployees\(buildEmployeeScopeCondition\(scope\)\)/);
    assert.match(fnBody(service, 'getAttendancePage'), /employeesFor\(params\.scope/);
  });
  it('days in closed months, future days and your own days cannot change', () => {
    const guard = service.slice(service.indexOf('async function guardDays'), service.indexOf('const isoDate'));
    assert.match(guard, /throw new OutOfScopeError\(\)/);
    assert.match(guard, /throw new OwnAttendanceError\(\)/);
    assert.match(guard, /closed month/);
    assert.match(guard, /future date/);
  });
  it('closing is refused while adjustments wait, before the month ends, and per branch for branch roles', () => {
    const fn = fnBody(service, 'closeMonth');
    assert.match(fn, /period\.end >= nepalDateIso\(\)/);
    assert.match(fn, /countPendingAdjustments/);
    assert.match(fn, /scope\.scopeType === "BRANCH" && branchIds\.some/);
  });
  it('reopening needs a reason and is refused once payroll is approved or locked', () => {
    const fn = fnBody(service, 'reopenMonth');
    assert.match(fn, /reason\.length < 3/);
    assert.match(fn, /countFinalisedPayrollRuns/);
  });
  it('punches are voided (kept), never deleted', () => {
    assert.ok(!/delete\(attendancePunches\)/.test(repo));
    assert.match(repo, /voidedAt: new Date\(\), voidedBy: userId, voidReason: reason/);
  });
  it('one row per employee and day; decisions apply only while pending', () => {
    assert.match(read('lib/db/schema.ts'), /unique\('attendance_records_emp_date_uq'\)\.on\(table\.employeeId, table\.attendanceDate\)/);
    assert.match(read('lib/db/migrations/0039_attendance_foundation.sql'), /CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_emp_date_uq"/);
    assert.match(repo, /eq\(attendanceAdjustments\.status, "pending"\)\)\)\n\s+\.returning/);
  });
});

describe('S22: payroll and the report', () => {
  const payroll = read('lib/services/payroll.service.ts');
  it('payroll reads attendance (closed or worked out now) without writing or unlocking it', () => {
    assert.ok(!/calculateMonthlyAttendanceAndOt/.test(payroll));
    assert.equal((payroll.match(/attendanceForPayroll\(/g) ?? []).length, 3); // generate, sync, recalculate
    const fn = fnBody(service, 'attendanceForPayroll');
    assert.ok(!/closePeriod|setOverrides|insertPunches/.test(fn));
  });
  it('the attendance report is scoped and its export audited', () => {
    const report = read('app/actions/report.actions.ts');
    assert.match(report, /checkPermissionWithScope\("VIEW", "REPORTS_ATTENDANCE"\)/);
    assert.match(report, /checkPermissionWithScope\("EXPORT", "REPORTS_ATTENDANCE"\)[\s\S]*recordAuditLog/);
    assert.match(read('lib/services/report.service.ts'), /attendanceService\.reportMonth\(scope, /);
  });
});

describe('Adjustment approval (supervisor or approver; never yourself)', () => {
  const words = { ownSubject: 'own attendance', noPermission: 'no permission' };
  const req = (preparedById: string, subject: string) => ({ status: 'pending' as const, preparedById, subjectEmployeeIds: [subject], flow: { type: 'simple' as const, levels: [] }, currentLevel: 0 });
  const ctx = { approvers: [], today: '2026-10-04', wording: words };
  it('a supervisor or approver approves; the employee never does, even as administrator', () => {
    assert.ok(availableActions(req('hr', 'eRam'), { userId: 'sup', employeeId: 'eSup', canApprove: true, isAdministrator: false }, ctx).approve);
    const own = availableActions(req('hr', 'eRam'), { userId: 'ram', employeeId: 'eRam', canApprove: true, isAdministrator: true }, ctx);
    assert.equal(own.approve, null);
    assert.equal(own.finalApprove, false);
    assert.equal(own.reason, 'own attendance');
  });
  it('without approve rights or supervision: no approval, with the reason', () => {
    const a = availableActions(req('hr', 'e1'), { userId: 'x', employeeId: 'eX', canApprove: false, isAdministrator: false }, ctx);
    assert.equal(a.approve, null);
    assert.equal(a.reason, 'no permission');
  });
});

describe('S22 (4.5b): shifts', () => {
  const shiftActions = read('app/actions/shift.actions.ts');
  const shiftService = read('lib/services/shift.service.ts');
  it('defining shifts and branch defaults is a company-wide control, never platform support', () => {
    const control = shiftActions.slice(shiftActions.indexOf('async function companyControl'), shiftActions.indexOf('export async function saveShiftAction'));
    assert.match(control, /checkPermissionWithScope\('EDIT', 'ATTENDANCE'\)/);
    assert.match(control, /scope\.scopeType !== 'GLOBAL'/);
    assert.match(control, /scope\.isImpersonation/);
    for (const name of ['saveShiftAction', 'makeDefaultShiftAction', 'setShiftActiveAction', 'setBranchShiftAction']) {
      const fn = fnBody(shiftActions, name);
      assert.match(fn, /await companyControl\(\)/, name);
      assert.match(fn, /recordAuditLog\(/, name);
      assert.match(fn, /fail\(error, /, name);
    }
  });
  it('assigning, the roster and rotations need Attendance → Edit with scope; refusals audited', () => {
    for (const name of ['assignShiftAction', 'setRosterAction', 'rotateRosterAction']) {
      const fn = fnBody(shiftActions, name);
      assert.match(fn, /checkPermissionWithScope\('EDIT', 'ATTENDANCE'\)/, name);
      assert.match(fn, /recordAuditLog\(/, name);
      assert.match(fn, /auditRefusal\(error, scope, /, name);
    }
    assert.match(shiftActions, /OwnAttendanceError\) await recordAuditLog\([^)]*result: DENIED_SELF/);
    assert.match(shiftActions, /OutOfScopeError\) await recordAuditLog\([^)]*result: 'DENIED_SCOPE'/);
    for (const line of shiftActions.split(/\r?\n/).filter((l) => l.includes('error.message'))) assert.match(line, /UserFacingError/, line);
  });
  it('people in scope only, never your own shift, no closed months, limited batches', () => {
    const guard = shiftService.slice(shiftService.indexOf('async function guardPeople'), shiftService.indexOf('async function activeShift'));
    assert.match(guard, /findEmployees\(buildEmployeeScopeCondition\(scope\)\)/);
    assert.match(guard, /throw new OutOfScopeError\(\)/);
    assert.match(guard, /includesOwnRecord\(scope\.employeeId, employeeIds\)[\s\S]*OwnAttendanceError/);
    assert.match(guard, /findClosedPeriodsOverlapping\(from, to\)/);
    assert.match(guard, /MAX_PEOPLE/);
    for (const name of ['assignShift', 'setRoster', 'rotateRoster']) assert.match(fnBody(shiftService, name), /await guardPeople\(ctx\.scope, /, name);
    // A rotation keeps each shift's weekly offs (4.6a: a GEN → NGT rotation had made Saturdays working days).
    assert.match(fnBody(shiftService, 'rotateRoster'), /rotate\(\{[^}]*offOn: weeklyOffOf\(/);
    assert.match(fnBody(shiftService, 'setRoster'), /MAX_ROSTER_CELLS/);
  });
  it('one roster day per employee and date; shifts are archived, not deleted', () => {
    assert.match(read('lib/db/migrations/0040_attendance_shifts.sql'), /CREATE UNIQUE INDEX IF NOT EXISTS "shift_roster_emp_date_idx"/);
    assert.ok(!/delete\(shifts\)/.test(read('lib/repositories/shift.repository.ts')));
  });
});

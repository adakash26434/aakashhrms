import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S3 / S15 / S17 on the dashboard: sections load only with their permission,
// employee data and payroll sums are scoped, filters are validated.
const root = join(__dirname, '..');
const service = readFileSync(join(root, 'lib/services/dashboard.service.ts'), 'utf8');
const payrollRepo = readFileSync(join(root, 'lib/repositories/payroll.repository.ts'), 'utf8');

describe('Dashboard access (S3)', () => {
  it('checks the permission behind every section', () => {
    for (const perm of ['"VIEW", "EMPLOYEES"', '"VIEW", "ATTENDANCE"', '"VIEW", "LEAVE_APPROVALS"', '"VIEW", "PAYROLL_GENERATE"', '"VIEW", "PAYROLL_REVIEW"', '"VIEW", "AUDIT_LOG"']) {
      assert.ok(service.includes(`hasPermission(${perm})`), perm);
    }
    assert.match(service, /requireAuthenticatedUser\(\)/);
  });

  it('only loads a section when the user may see it', () => {
    assert.match(service, /payroll \? section\("payroll"/);
    assert.match(service, /attendance \? section\("attendance"/);
    assert.match(service, /leaveApprovals \? section\("approvals"/);
    // S59: the activity feed is the company's audit trail: a company-wide role only.
    assert.match(service, /audit && scope\.scopeType === "GLOBAL" \? section\("activity"/);
    assert.match(service, /readiness: employees && payroll && scopedEmployees/);
  });

  it('scopes employee lists, attendance, leave and payroll sums to the user (and branch filter)', () => {
    assert.match(service, /buildEmployeeScopeCondition\(scope\)/);
    assert.match(service, /byEmployeeId\(payrollSlips\.employeeId\)/);
    // Attendance days come from the attendance rules, within the user's scope and the branch filter (4.5).
    assert.match(service, /attendanceService\.attendanceMarks\(scope, monthStart, todayIso, branchId \?\? undefined\)/);
    assert.match(service, /byEmployeeId\(leaveApplications\.employeeId\)/);
    assert.match(service, /pending\.filter\(\(p\) => inScope\(p\.employeeId\)\)/);
  });

  it('offers the branch filter to company-wide users only and validates the id', () => {
    assert.match(service, /scope\.scopeType === "GLOBAL" \? \(allBranches/);
    assert.match(service, /branchOptions\.some\(\(b\) => b\.id === requestedBranch\)/);
    assert.match(service, /parsePeriodOption\(first\(params\.period\)\)/);
  });

  it('payroll sums are parameterised SQL aggregates, not raw strings', () => {
    const fn = payrollRepo.slice(payrollRepo.indexOf('export async function sumSlipsByPeriod'));
    assert.match(fn, /between \$\{args\.fromKey\} and \$\{args\.toKey\}/);
    assert.doesNotMatch(fn, /sql\.raw/);
  });
});

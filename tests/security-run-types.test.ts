import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pay run types (4.8 / F6): an off-cycle run (festival allowance, arrears) pays only lines the
// server works out, is taxed with the marginal method, never touches attendance, loans or the
// salary structure when locked, and never counts as a month of salary elsewhere (arrears, final
// settlement). Its payslip edits pass the same S21 guard as the regular ones.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const body = (src: string, marker: string) => {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, marker);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

const payroll = read('lib/services/payroll.service.ts');
const offCycle = read('lib/services/off-cycle.service.ts');
const feeds = read('lib/repositories/payroll-feeds.repository.ts');
const settlement = read('lib/repositories/settlement.repository.ts');
const control = read('lib/services/payroll-control.service.ts');
const controlRepo = read('lib/repositories/payroll-control.repository.ts');

describe('run types', () => {
  it('locking an off-cycle run seals its payslips and stops there', () => {
    const lock = payroll.slice(payroll.indexOf('await repository.lockAllSlipsForRun(runId);'));
    const stop = lock.indexOf('if (isOffCycle(run.runType)) return;');
    assert.ok(stop > 0 && stop < lock.indexOf('attendanceRecords'), 'returns before sealing attendance');
    assert.ok(stop < lock.indexOf('loanRepayments'), 'returns before loan repayments');
    // S45: no lock writes a salary structure (the loan mirror is the only one left, after the return).
    assert.equal(lock.indexOf('employeeSalaryMap'), -1, 'no salary-structure sync on lock');
    assert.ok(stop < lock.indexOf('syncActiveLoansToSalaryMapping'), 'returns before the loan mirror');
  });

  it('only regular runs count as a paid month of salary (arrears, final settlement)', () => {
    assert.match(body(feeds, 'export async function paidMonths'), /eq\(payrollRuns\.runType, 'REGULAR'\)/);
    assert.match(body(settlement, 'export async function slipMonths'), /eq\(payrollRuns\.runType, 'REGULAR'\)/);
  });

  it('one run of each type per month: duplicates and regeneration look at the same type only', () => {
    assert.match(body(payroll, 'export async function generatePayrollRun'), /runType: 'REGULAR'/);
    assert.match(body(offCycle, 'export async function generateOffCycleRun'), /findPayrollRunByPeriodAndBranch\(\{ payPeriodMonth, payPeriodYear, branchIds, runType \}\)/);
  });

  it('off-cycle amounts come from the server, never from the request', () => {
    const fn = body(offCycle, 'export async function generateOffCycleRun');
    const fields = new Set([...fn.matchAll(/payload\.(\w+)/g)].map((m) => m[1]));
    for (const f of fields) assert.ok(['runType', 'recreateIfExists', 'occasionalAllowanceHeadIds', 'prorateFestival', 'payslipMonth', 'payslipDate', 'departmentIds', 'designationIds', 'employeeCategories', 'employeeIds'].includes(f), `payload.${f}`);
    assert.match(fn, /arrearsService\.arrearsFor\(ids, startStr\)/);
    assert.match(fn, /calculateOffCycleSlip\(/);
  });

  it('off-cycle payslip edits go through the S21 guard first', () => {
    const override = body(payroll, 'export async function overridePayslipAllowanceDeduction');
    assert.ok(override.indexOf('assertNotOwnSlip(payload.slipId') < override.indexOf('offCycleService.recalculateOffCycleSlip('));
    const recalc = body(payroll, 'export async function recalculateEmployeePayslip');
    assert.ok(recalc.indexOf('assertNotOwnSlip(slipId') < recalc.indexOf('offCycleService.recalculateOffCycleSlip('));
    assert.match(body(payroll, 'export async function addPayHeadToPayslip'), /isOffCycle\(run\.runType\)\) throw/);
    assert.match(body(payroll, 'export async function syncPayrollRunAttendance'), /isOffCycle\(run\.runType\)\) throw/);
    assert.match(body(offCycle, 'export async function recalculateOffCycleSlip'), /run\.status !== 'DRAFT'/);
  });

  it('variance compares a run with its own type; maker-checker applies to every type', () => {
    assert.match(controlRepo, /eq\(payrollRuns\.runType, run\.runType \?\? 'REGULAR'\)/);
    assert.doesNotMatch(body(control, 'export async function assertCanMove'), /isOffCycle/);
  });
});

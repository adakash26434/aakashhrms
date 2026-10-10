import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_VARIANCE_PCT, canTransition, normalizeThreshold, pctChange, preflight, runTotals, scopeText, stepOf, variance, varianceOpen, type PreflightInput } from '../lib/engines/payroll-run.engine';
import type { PayrollSlip } from '../lib/types/payroll';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

// 4.8a Payroll run: pre-flight, variance, totals and status rules.

const period = { year: 2083, month: 6, label: 'Aswin 2083', start: '2026-09-17', end: '2026-10-17' };
const person = (o: Partial<PreflightInput['employees'][number]> = {}): PreflightInput['employees'][number] => ({
  id: 'E1',
  name: 'Kushal Pokhrel',
  code: 'EMP-003',
  branchId: 'B1',
  status: 'Active',
  joiningDate: '2024-01-01',
  terminationDate: null,
  salary: 'current',
  hasBank: true,
  hasPan: true,
  overtimeWaiting: 0,
  ...o,
});
const ready = (o: Partial<PreflightInput> = {}): PreflightInput => ({
  runType: 'REGULAR',
  festivalHeads: 0,
  period,
  today: '2026-10-20',
  branches: [{ id: 'B1', name: 'Head Office', closed: true }],
  employees: [person()],
  pendingLeaves: 0,
  pendingSalaryChanges: 0,
  activeFiscalYear: { id: 'FY', label: 'FY 2083/84' },
  slabCount: 6,
  existingRuns: [],
  previousRun: { status: 'LOCKED', label: 'Bhadra 2083' },
  fundsPosted: null,
  checkedAt: '2026-10-20T03:00:00.000Z',
  ...o,
});
const codes = (r: ReturnType<typeof preflight>) => r.problems.map((p) => p.code);

describe('Payroll run: pre-flight (4.8a)', () => {
  it('a ready month has no problems', () => {
    const r = preflight(ready());
    assert.deepEqual(r.problems, []);
    assert.equal(r.blocking, 0);
    assert.equal(r.employees, 1);
  });

  it('what blocks: month not ended, open attendance month, pending leaves or salary changes, no slabs, an existing run', () => {
    assert.ok(codes(preflight(ready({ today: '2026-10-17' }))).includes('month_not_ended'));
    assert.ok(codes(preflight(ready({ branches: [{ id: 'B1', name: 'Head Office', closed: false }] }))).includes('month_open'));
    assert.ok(codes(preflight(ready({ pendingLeaves: 2 }))).includes('pending_leaves'));
    assert.ok(codes(preflight(ready({ pendingSalaryChanges: 1 }))).includes('pending_salary'));
    assert.ok(codes(preflight(ready({ slabCount: 0 }))).includes('no_tax_slabs'));
    assert.ok(codes(preflight(ready({ activeFiscalYear: null }))).includes('no_fiscal_year'));
    assert.ok(codes(preflight(ready({ existingRuns: [{ id: 'R', status: 'DRAFT' }] }))).includes('run_exists'));
    assert.ok(codes(preflight(ready({ existingRuns: [{ id: 'R', status: 'LOCKED' }] }))).includes('run_locked'));
    assert.ok(codes(preflight(ready({ employees: [] }))).includes('no_employees'));
    for (const r of [preflight(ready({ pendingLeaves: 1 })), preflight(ready({ slabCount: 0 }))]) assert.ok(r.blocking > 0);
  });

  it('per employee: no salary or only basic + grade block; waiting overtime blocks; no bank or PAN warn; joiners and leavers inform', () => {
    const r = preflight(ready({ employees: [person({ salary: 'none' }), person({ id: 'E2', code: 'EMP-004', salary: 'setup' }), person({ id: 'E3', overtimeWaiting: 2 }), person({ id: 'E4', hasBank: false, hasPan: false, joiningDate: '2026-10-01' })] }));
    const by = (code: string) => r.problems.filter((p) => p.code === code);
    assert.equal(by('no_salary')[0].severity, 'blocking');
    assert.equal(by('salary_setup')[0].severity, 'blocking');
    assert.equal(by('overtime_waiting')[0].severity, 'blocking');
    assert.equal(by('no_bank')[0].severity, 'warning');
    assert.equal(by('no_pan')[0].severity, 'warning');
    assert.equal(by('joiner')[0].severity, 'info');
    assert.equal(by('no_salary')[0].employeeId, 'E1');
    assert.match(by('no_salary')[0].href ?? '', /salary-mapping\?employee=E1/);
    // Blocking first, then warnings, then information.
    const order = r.problems.map((p) => p.severity);
    assert.deepEqual(order, [...order].sort((a, b) => ({ blocking: 0, warning: 1, info: 2 })[a] - ({ blocking: 0, warning: 1, info: 2 })[b]));
  });

  it('warnings: the previous month not locked; fund contributions not posted', () => {
    assert.ok(codes(preflight(ready({ previousRun: { status: 'UNDER_REVIEW', label: 'Bhadra 2083' } }))).includes('previous_open'));
    assert.ok(codes(preflight(ready({ fundsPosted: false }))).includes('funds_not_posted'));
    assert.ok(!codes(preflight(ready({ fundsPosted: true }))).includes('funds_not_posted'));
    assert.ok(!codes(preflight(ready({ fundsPosted: null }))).includes('funds_not_posted'));
  });
});

const slip = (o: Partial<PayrollSlip>): PayrollSlip =>
  ({
    id: `S-${o.employeeId ?? 'E1'}`,
    payrollRunId: 'R2',
    employeeId: 'E1',
    employeeCode: 'EMP-003',
    employeeName: 'Kushal Pokhrel',
    departmentName: '',
    designationName: '',
    basicSalary: '30000',
    gradeAmount: '0',
    grossEarnings: '40000',
    totalDeductions: '5000',
    netPayable: '35000',
    taxableIncome: '40000',
    tdsThisMonth: '400',
    pfEmployee: '0',
    pfEmployer: '0',
    ssfEmployee: '3300',
    ssfEmployer: '6000',
    citDeduction: '0',
    loanDeduction: '0',
    absentDeduction: '0',
    otAmount: '0',
    bankAccountNumber: '0101',
    bankName: 'NIC',
    payslipMonth: 6,
    payslipDate: null,
    status: 'DRAFT',
    isYearEndReconciliation: false,
    warnings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  }) as PayrollSlip;
const base = { runId: 'R1', label: 'Bhadra 2083' };
const employees = new Map([['E1', { status: 'Active', terminationDate: null }]]);
const vin = (slips: PayrollSlip[], previous: Map<string, PayrollSlip>, extra: Partial<Parameters<typeof variance>[0]> = {}) =>
  variance({ slips, previous, employees, period: { start: period.start, end: period.end }, thresholdPct: 5, base, computedAt: '2026-10-20T03:00:00.000Z', ...extra });

describe('Payroll run: variance against the last locked run (4.8a)', () => {
  it('unchanged pay raises nothing', () => {
    const v = vin([slip({})], new Map([['E1', slip({ payrollRunId: 'R1' })]]));
    assert.deepEqual(v.items, []);
    assert.equal(v.baseRunId, 'R1');
    assert.equal(varianceOpen(v), 0);
  });

  it('gross, net, income tax and SSF beyond the threshold are flagged with the change', () => {
    const v = vin([slip({ grossEarnings: '44000', netPayable: '38000', tdsThisMonth: '480', ssfEmployee: '3300' })], new Map([['E1', slip({ payrollRunId: 'R1' })]]));
    assert.equal(v.items.length, 1);
    assert.deepEqual(
      v.items[0].flags.map((f) => [f.code, f.changePct]),
      [
        ['gross', 10],
        ['net', 8.6],
        ['tds', 20],
      ]
    );
    assert.match(v.items[0].flags[0].text, /Gross earnings up 10%: 40,000\.00 → 44,000\.00/);
    // Below the threshold: nothing.
    assert.deepEqual(vin([slip({ grossEarnings: '41000' })], new Map([['E1', slip({ payrollRunId: 'R1' })]])).items, []);
  });

  it('a changed bank account, a first payslip, a leaver still paid, zero and negative net', () => {
    const v = vin([slip({ bankAccountNumber: '0202' }), slip({ employeeId: 'E2', employeeName: 'New Person' }), slip({ employeeId: 'E3', netPayable: '0' }), slip({ employeeId: 'E4', netPayable: '-200' })], new Map([['E1', slip({ payrollRunId: 'R1' })]]), {
      employees: new Map([
        ['E1', { status: 'Active', terminationDate: null }],
        ['E3', { status: 'Inactive', terminationDate: '2026-09-01' }],
      ]),
    });
    const flags = Object.fromEntries(v.items.map((i) => [i.employeeId, i.flags.map((f) => f.code)]));
    assert.deepEqual(flags.E1, ['bank_changed']);
    assert.deepEqual(flags.E2, ['new_joiner']);
    assert.deepEqual(flags.E3, ['new_joiner', 'leaver_paid']);
    assert.deepEqual(flags.E4, ['new_joiner', 'negative_net']);
  });

  it('with no earlier run, a first payslip is not a flag (every employee would be one)', () => {
    assert.deepEqual(vin([slip({})], new Map(), { base: null }).items, []);
  });

  it('an acknowledgement stands while the same flags are raised, and falls when they change', () => {
    const earlier = vin([slip({ grossEarnings: '44000' })], new Map([['E1', slip({ payrollRunId: 'R1' })]]));
    earlier.items[0].acknowledgedBy = 'U1';
    earlier.items[0].acknowledgedAt = '2026-10-20T04:00:00.000Z';
    earlier.items[0].note = 'Increment approved in Aswin';
    const same = vin([slip({ grossEarnings: '44500' })], new Map([['E1', slip({ payrollRunId: 'R1' })]]), { earlier });
    assert.equal(same.items[0].acknowledgedBy, 'U1');
    assert.equal(varianceOpen(same), 0);
    const changed = vin([slip({ grossEarnings: '44500', bankAccountNumber: '0909' })], new Map([['E1', slip({ payrollRunId: 'R1' })]]), { earlier });
    assert.equal(changed.items[0].acknowledgedBy, null);
    assert.equal(varianceOpen(changed), 1);
  });

  it('the threshold is kept between 1 and 50 percent; nonsense becomes the default', () => {
    assert.equal(normalizeThreshold('7.55'), 7.6);
    assert.equal(normalizeThreshold(0), 1);
    assert.equal(normalizeThreshold(99), 50);
    assert.equal(normalizeThreshold('x'), DEFAULT_VARIANCE_PCT);
    assert.equal(pctChange(0, 100), null);
    assert.equal(pctChange(200, 150), -25);
  });
});

describe('Payroll run: totals and status (4.8a)', () => {
  it('the run figures are the sum of the payslips', () => {
    const t = runTotals([slip({}), slip({ employeeId: 'E2', grossEarnings: '10000.5', totalDeductions: '0.25', netPayable: '10000.25', tdsThisMonth: '0', pfEmployee: '1', ssfEmployee: '0' })]);
    assert.deepEqual(t, { totalGross: '50000.5', totalDeductions: '5000.25', totalNetPayable: '45000.25', totalTds: '400', totalPf: '1', totalSsf: '3300', employeeCount: 2 });
  });

  it('status moves one way: draft → under review → approved → locked, with rejection back to draft', () => {
    assert.equal(canTransition('DRAFT', 'UNDER_REVIEW'), true);
    assert.equal(canTransition('DRAFT', 'APPROVED'), false);
    assert.equal(canTransition('UNDER_REVIEW', 'DRAFT'), true);
    assert.equal(canTransition('APPROVED', 'LOCKED'), true);
    assert.equal(canTransition('LOCKED', 'DRAFT'), false);
    assert.equal(stepOf({ status: 'DRAFT' }, 2), 'variance');
    assert.equal(stepOf({ status: 'DRAFT' }, 0), 'review');
    assert.equal(stepOf({ status: 'UNDER_REVIEW' }, 0), 'approval');
    assert.equal(stepOf({ status: 'LOCKED' }, 0), 'lock');
  });

  it('the scope in words', () => {
    const name = (id: string) => ({ B1: 'Head Office', B2: 'Pokhara' })[id] ?? '';
    assert.equal(scopeText({ branchIds: ['B1', 'B2'], departmentIds: [], employeeIds: [] }, name, 2), 'All branches');
    assert.equal(scopeText({ branchIds: ['B2'], departmentIds: ['D1'], employeeIds: ['E1', 'E2'] }, name, 2), 'Pokhara · 1 dept · 2 chosen');
  });
});

describe('Payroll run: the service reads what the engine decides (4.8a)', () => {
  const service = read('lib/services/payroll.service.ts');

  it('the run totals are recomputed from the payslips after every change (the stored totals used to drift)', () => {
    assert.doesNotMatch(service, /updatePayrollRunTotals/);
    // Merged with main (2026-10-10): the team's refreshRunTotals, after each transaction commits.
    assert.doesNotMatch(service, /recomputeTotals\(/);
    assert.equal((service.match(/await repository\.refreshRunTotals\(run\.id\)/g) ?? []).length, 3);
  });

  it('income tax slabs come from the run\'s own fiscal year, and the month dates from the pay calendar', () => {
    assert.match(service, /findSlabsByFiscalYear\(runYear\.id\)/);
    assert.equal((service.match(/findSlabsByFiscalYear\(run\.fiscalYearId\)/g) ?? []).length, 2);
    assert.doesNotMatch(service, /findAllSlabs\(\)/);
    assert.match(service, /export async function generatePayrollRun[\s\S]*?periodFor\(calendar, payPeriodYear, payPeriodMonth\)/);
    assert.doesNotMatch(service, /getBSMonthRange/);
  });

  it('welfare fund contributions reach the payslip through the team\'s WELFARE_FUND head', () => {
    // Fund postings are kept by BS month: the one the pay month's last day falls in (recordMonthOf).
    assert.match(service, /feedsRepository\.fundContributionsByEmployee\(empIds, bsMonth\.year, bsMonth\.month\)/);
    assert.match(service, /assignedHeads\.push\(\{ \.\.\.toPayHeadObj\(feedHeadRows\.welfare\), amount: fundFeed, isManualOverride: true \}\)/);
  });

  it('a run is generated only after pre-flight, and submitted only with the month closed and every flag acknowledged', () => {
    const run = read('lib/services/payroll-run.service.ts');
    assert.match(run, /export async function generate[\s\S]*?checkNewRun\(raw, ctx\.scope\)[\s\S]*?severity === "blocking"[\s\S]*?throw new UserFacingError/);
    assert.match(run, /export async function submit[\s\S]*?checkRun\(runId\)[\s\S]*?varianceOpenCount\(runId\)[\s\S]*?throw new UserFacingError/);
  });
});

describe('Payroll run: the team pre-flight rules (merge 2026-10-10)', () => {
  it('a missing TDS head blocks; missing PF / SSF / CIT heads warn; an open month only warns when the company allows it', () => {
    const heads = { tds: true, pf: true, ssf: true, cit: true };
    assert.deepEqual(codes(preflight(ready({ statutoryHeads: heads }))), []);
    assert.ok(codes(preflight(ready({ statutoryHeads: { ...heads, tds: false } }))).includes('missing_tds_head'));
    const warn = preflight(ready({ statutoryHeads: { ...heads, cit: false } }));
    assert.equal(warn.problems.find((p) => p.code === 'missing_statutory_head')?.severity, 'warning');
    const open = ready({ branches: [{ id: 'B1', name: 'Head Office', closed: false }] });
    assert.equal(preflight(open).problems.find((p) => p.code === 'month_open')?.severity, 'blocking');
    assert.equal(preflight({ ...open, requireClosedAttendance: false }).problems.find((p) => p.code === 'month_open')?.severity, 'warning');
  });
});

describe('Payroll run: pre-flight for off-cycle runs, openings, loans and the month\'s year (merge 2026-10-10)', () => {
  const messy = ready({
    branches: [{ id: 'B1', name: 'Head Office', closed: false }],
    pendingLeaves: 2,
    employees: [person({ salary: 'setup', overtimeWaiting: 1 }), person({ id: 'E2', code: 'EMP-004', salary: 'none' })],
    statutoryHeads: { tds: true, pf: false, ssf: true, cit: true },
  });

  it('F6: off-cycle runs skip attendance, leave, overtime, set-up and PF / SSF / CIT checks', () => {
    const regular = codes(preflight(messy));
    for (const c of ['month_open', 'pending_leaves', 'salary_setup', 'overtime_waiting', 'missing_statutory_head', 'no_salary']) assert.ok(regular.includes(c), c);
    assert.deepEqual(codes(preflight({ ...messy, runType: 'FESTIVAL', festivalHeads: 1 })), ['no_salary']);
    assert.deepEqual(codes(preflight({ ...messy, runType: 'ARREARS' })), []);
    // A festival allowance is paid inside its month (before the festival); the salary only after it.
    assert.ok(codes(preflight(ready({ today: '2026-10-01' }))).includes('month_not_ended'));
    assert.ok(!codes(preflight(ready({ today: '2026-10-01', runType: 'FESTIVAL', festivalHeads: 1 }))).includes('month_not_ended'));
  });

  it('F6: one run of each kind a month; a festival run needs its heads; TDS is needed by every run', () => {
    assert.match(preflight(ready({ runType: 'FESTIVAL', festivalHeads: 1, existingRuns: [{ id: 'R', status: 'DRAFT' }] })).problems[0].text, /festival allowance run/);
    assert.equal(preflight(ready({ runType: 'ARREARS', existingRuns: [{ id: 'R', status: 'LOCKED' }] })).problems[0].code, 'run_locked');
    assert.ok(codes(preflight(ready({ runType: 'FESTIVAL', festivalHeads: 0 }))).includes('no_festival_head'));
    assert.equal(preflight(ready({ runType: 'ARREARS', statutoryHeads: { tds: false, pf: true, ssf: true, cit: true } })).problems[0].code, 'missing_tds_head');
  });

  it('F15: a month an opening balance covers is blocked for that person, in every kind of run', () => {
    for (const runType of ['REGULAR', 'FESTIVAL', 'ARREARS'] as const) {
      const r = preflight(ready({ runType, festivalHeads: 1, employees: [person({ coveredByOpening: true })] }));
      const found = r.problems.find((p) => p.code === 'covered_by_opening');
      assert.equal(found?.severity, 'blocking', runType);
      assert.equal(found?.employeeId, 'E1');
    }
  });

  it('4.12e: an amount on a label head only warns, in regular runs, with a link to the person', () => {
    const r = preflight(ready({ employees: [person({ labelAmount: true })] }));
    const found = r.problems.find((p) => p.code === 'label_amount');
    assert.equal(found?.severity, 'warning');
    assert.match(found?.text ?? '', /label head \(Basic Salary \/ Grade Amount\)/);
    assert.match(found?.href ?? '', /salary-mapping\?employee=E1/);
    assert.ok(!codes(preflight(ready({ runType: 'FESTIVAL', festivalHeads: 1, employees: [person({ labelAmount: true })] }))).includes('label_amount'));
  });

  it('4.10: a loan amount left on a salary structure only warns, in regular runs', () => {
    assert.equal(preflight(ready({ employees: [person({ loanOnStructure: true })] })).problems.find((p) => p.code === 'loan_on_structure')?.severity, 'warning');
    assert.ok(!codes(preflight(ready({ runType: 'FESTIVAL', festivalHeads: 1, employees: [person({ loanOnStructure: true })] }))).includes('loan_on_structure'));
  });

  it('4.12a: the month\'s own year must exist, be open and have its ladder; the reason is said once', () => {
    const r = preflight(ready({ fiscalYearProblem: 'FY 2084/85 has no tax slabs yet.', activeFiscalYear: { id: 'FY', label: 'FY 2084/85' }, slabCount: 0 }));
    assert.deepEqual(r.problems.map((p) => [p.code, p.severity, p.text]), [['fiscal_year', 'blocking', 'FY 2084/85 has no tax slabs yet.']]);
  });
});


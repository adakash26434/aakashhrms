import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceRow,
  bankRows,
  fiscalMonths,
  leaveMovement,
  loanInstallmentsLeft,
  loanInterest,
  loanStatusLabel,
  maskAccountNumber,
  normalizeLeaveParams,
  normalizeLoanParams,
  normalizeSalaryParams,
  repaymentHow,
  runBranches,
  runOptionLabel,
  salaryColumns,
  salaryLines,
  salaryRows,
  scopeLabel,
  type SlipItem,
} from '../lib/engines/report.engine';
import type { HeadFigures } from '../lib/engines/payslip-view.engine';
import type { DayResult, MonthSummary } from '../lib/types/attendance';

// Reports (4.11): parameters never pass ids outside what was offered (the viewer's scope), the
// salary sheet is the payslip statement line by line, leave movement adds up to the balance the
// leave screens show, and pay figures in the attendance report are opt-in.

const choices = {
  branches: [{ value: 'b1', label: 'Lekhnath' }],
  departments: [{ value: 'd1', label: 'Accounts' }],
  employees: [{ value: 'e1', label: 'Ram · EMP-002' }],
};
const runs = [
  { value: 'r2', label: 'Aswin 2083' },
  { value: 'r1', label: 'Bhadra 2083' },
];

describe('report parameters', () => {
  it('fall back for anything not offered (other branches, unknown runs, made-up views)', () => {
    assert.deepEqual(normalizeSalaryParams({ runId: 'r1', view: 'bank', groupBy: 'branch', branchId: 'b1', departmentId: 'd1', employeeId: 'e1' }, runs, choices), {
      runId: 'r1',
      view: 'bank',
      groupBy: 'branch',
      branchId: 'b1',
      departmentId: 'd1',
      employeeId: 'e1',
    });
    assert.deepEqual(normalizeSalaryParams({ runId: 'draft-run', view: 'everything', groupBy: 'x', branchId: 'other-branch', employeeId: 'someone-else' }, runs, choices), {
      runId: 'r2',
      view: 'sheet',
      groupBy: 'none',
      branchId: '',
      departmentId: '',
      employeeId: '',
    });
    assert.equal(normalizeSalaryParams({}, [], choices).runId, '');
    const leave = normalizeLeaveParams({ fiscalYearId: 'fy-x', view: 'requests', status: 'Withdrawn', reasons: 'yes', leaveTypeId: 't9' }, [{ value: 'fy1', label: '2083/84' }], [{ value: 't1', label: 'Home' }], 'fy1', choices);
    assert.deepEqual([leave.fiscalYearId, leave.view, leave.status, leave.reasons, leave.leaveTypeId], ['fy1', 'requests', 'all', false, '']);
    assert.equal(normalizeLeaveParams({ reasons: true }, [], [], '', choices).reasons, true);
    const months = (id: string) => (id === 'fy1' ? [{ value: '2083-06', label: 'Aswin 2083' }] : []);
    const loan = normalizeLoanParams({ view: 'repayments', month: '2083-07', fiscalYearId: 'fy1' }, [{ value: 'fy1', label: 'FY' }], months, 'fy1', [], choices);
    assert.deepEqual([loan.view, loan.month, loan.status], ['repayments', '', 'running']);
  });

  it('a fiscal year is Shrawan to Ashadh across two BS years', () => {
    const months = fiscalMonths({ startDateBS: '2083-04-01', fromMonth: 4, toMonth: 3 });
    assert.equal(months.length, 12);
    assert.deepEqual(months[0], { value: '2083-04', label: 'Shrawan 2083' });
    assert.deepEqual(months[8], { value: '2083-12', label: 'Chaitra 2083' });
    assert.deepEqual(months[11], { value: '2084-03', label: 'Asar 2084' });
    assert.deepEqual(fiscalMonths({ startDateBS: 'bad', fromMonth: 4, toMonth: 3 }), []);
  });

  it('says what part of the company is covered', () => {
    const name = (id: string) => ({ b1: 'Lekhnath', b2: 'Head Office', d1: 'Accounts' })[id];
    assert.equal(scopeLabel({ scopeType: 'GLOBAL', branchIds: [], departmentIds: [] }, name, name), 'All branches');
    assert.equal(scopeLabel({ scopeType: 'GLOBAL', branchIds: [], departmentIds: [], isImpersonation: true }, name, name), 'All branches (support view)');
    assert.equal(scopeLabel({ scopeType: 'BRANCH', branchIds: ['b1', 'b2'], departmentIds: [] }, name, name), 'Lekhnath, Head Office');
    assert.equal(scopeLabel({ scopeType: 'DEPARTMENT', branchIds: [], departmentIds: ['d1'] }, name, name), 'Accounts');
    assert.equal(scopeLabel({ scopeType: 'BRANCH', branchIds: [], departmentIds: [] }, name, name), 'No branch assigned');
  });

  it('labels runs with their kind, branches and whether they are final', () => {
    const name = (id: string) => ({ b1: 'Lekhnath', b2: 'Head Office' })[id];
    const run = { id: 'r', payPeriodYear: 2083, payPeriodMonth: 6, runType: 'FESTIVAL', status: 'APPROVED', branchIds: ['b1'] };
    assert.equal(runOptionLabel(run, ['b1', 'b2'], name), 'Aswin 2083 · Festival allowance · Lekhnath — approved, not locked');
    assert.equal(runOptionLabel({ ...run, runType: 'REGULAR', status: 'LOCKED', branchIds: ['b1', 'b2'] }, ['b1', 'b2'], name), 'Aswin 2083 · Regular salary — locked');
    assert.equal(runBranches({ branchIds: [] }, ['b1'], name), '');
  });
});

const head = (payHeadId: string, payHeadName: string, headType: 'allowance' | 'deduction', amount: string, role: HeadFigures['role'] = null, isManualOverride = false): HeadFigures => ({
  payHeadId,
  payHeadName,
  headType,
  amount,
  calculatedAmount: amount,
  isManualOverride,
  role,
});

const slipA: SlipItem = {
  slipId: 'sA',
  code: 'EMP-001',
  name: 'Sita Sharma',
  designation: 'Officer',
  department: 'Accounts',
  branch: 'Head Office',
  bankName: 'NIC Asia',
  bankAccount: '0123456789',
  figures: { basicSalary: '30000', gradeAmount: '1000', otAmount: '500', absentDeduction: '0', loanDeduction: '2000', grossEarnings: '41200', totalDeductions: '13410', netPayable: '27790', pfEmployer: '0' },
  heads: [
    head('tr', 'Transport', 'allowance', '1500'),
    head('da', 'Dearness', 'allowance', '2000'),
    head('ssfE', 'SSF employer', 'allowance', '6200', 'ssfEmployer'),
    head('tds', 'TDS', 'deduction', '500', 'tds'),
    // A deduction whose name contains "cit": the old sheet dropped it as if it were CIT.
    head('el', 'Electricity', 'deduction', '300', null, true),
    head('cit', 'CIT', 'deduction', '1000', 'cit'),
    head('ssf', 'SSF 31%', 'deduction', '9610', 'ssf'),
  ],
};
const slipB: SlipItem = {
  slipId: 'sB',
  code: 'EMP-002',
  name: 'Ram Thapa',
  designation: 'Assistant',
  department: 'Loans',
  branch: 'Lekhnath',
  bankName: 'Nabil',
  bankAccount: '',
  figures: { basicSalary: '20000', gradeAmount: '0', otAmount: '0', absentDeduction: '1000', loanDeduction: '0', grossEarnings: '21000', totalDeductions: '2200', netPayable: '18800', pfEmployer: '2000' },
  heads: [head('da', 'Dearness', 'allowance', '2000'), head('pf', 'Provident Fund', 'deduction', '2000', 'pf'), head('tds', 'TDS', 'deduction', '200', 'tds')],
};

describe('salary sheet from payslip statements', () => {
  it('columns in payslip order: earnings, then deductions with statutory first and tax last', () => {
    assert.deepEqual(
      salaryColumns([slipA, slipB]).map((c) => `${c.side[0]}:${c.key}`),
      ['e:basic', 'e:grade', 'e:head:da', 'e:head:tr', 'e:head:ssfE', 'e:ot', 'e:absence', 'd:head:ssf', 'd:head:pf', 'd:head:cit', 'd:head:el', 'd:loan', 'd:head:tds']
    );
    const labels = Object.fromEntries(salaryColumns([slipA]).map((c) => [c.key, c.label]));
    assert.equal(labels['head:el'], 'Electricity');
    assert.equal(labels['head:tds'], 'Income tax (TDS)');
  });

  it('rows carry every line and summary groups that add up to the payslip totals', () => {
    const [a, b] = salaryRows([slipA, slipB]);
    assert.equal(a.lines['head:el'], '300.00');
    assert.equal(a.lines.loan, '2000.00');
    assert.deepEqual([a.gross, a.totalDeductions, a.net], ['41200.00', '13410.00', '27790.00']);
    assert.deepEqual([a.basicGrade, a.allowances, a.retirement, a.tax, a.loan, a.otherDeductions], ['31000.00', '10200.00', '10610.00', '500.00', '2000.00', '300.00']);
    assert.equal(a.adjusted, true);
    assert.equal(a.balanced, true);
    assert.equal(b.lines.absence, '-1000.00');
    assert.equal(b.lines.grade, undefined, 'zero lines are left out');
    assert.deepEqual([b.basicGrade, b.allowances, b.retirement, b.otherDeductions], ['20000.00', '1000.00', '2000.00', '0.00']);
    const broken = salaryRows([{ ...slipB, figures: { ...slipB.figures, grossEarnings: '25000' } }])[0];
    assert.equal(broken.balanced, false);
  });

  it('pay lines: people paid, total, average and lines typed by a reviewer', () => {
    const lines = Object.fromEntries(salaryLines([slipA, slipB]).map((l) => [l.key, l]));
    assert.deepEqual([lines['head:da'].employees, lines['head:da'].total, lines['head:da'].average], [2, '4000.00', '2000.00']);
    assert.deepEqual([lines.absence.employees, lines.absence.total], [1, '-1000.00']);
    assert.equal(lines['head:el'].adjusted, 1);
    assert.equal(lines.basic.total, '50000.00');
  });

  it('bank list: net pay to the account; no account means cash', () => {
    assert.deepEqual(bankRows([slipA, slipB]), [
      { slipId: 'sA', code: 'EMP-001', name: 'Sita Sharma', bank: 'NIC Asia', account: '0123456789', net: '27790.00' },
      { slipId: 'sB', code: 'EMP-002', name: 'Ram Thapa', bank: '', account: '', net: '18800.00' },
    ]);
    assert.equal(bankRows([{ ...slipA, bankName: 'N/A' }])[0].bank, 'Bank not recorded');
    assert.equal(maskAccountNumber('0123456789'), '******6789');
  });
});

describe('attendance rows', () => {
  const day = (over: Partial<DayResult>): DayResult => ({
    date: '2026-10-01',
    dayType: 'present',
    payable: 1,
    unpaid: 0,
    firstIn: null,
    lastOut: null,
    workMinutes: 0,
    lateMinutes: 0,
    earlyMinutes: 0,
    otWorkDayMinutes: 0,
    otOffDayMinutes: 0,
    leaveDays: 0,
    leavePaidDays: 0,
    rule: '',
    flags: [],
    ...over,
  });
  const summary = { calendarDays: 30, notEmployedDays: 0, payableDays: 29.5, presentDays: 20, halfDays: 1, onDutyDays: 0, paidLeaveDays: 2, unpaidLeaveDays: 0, absentDays: 0, missingPunchDays: 0, holidayDays: 1, weeklyOffDays: 4, lateDays: 1, otWorkDayMinutes: 90, otOffDayMinutes: 0 } as MonthSummary;
  const person = {
    id: 'e1',
    employeeCode: 'EMP-002',
    fullName: 'Ram',
    designation: 'Assistant',
    department: 'Loans',
    branch: 'Lekhnath',
    days: [
      day({ firstIn: '2026-10-01T03:25:00.000Z', lastOut: '2026-10-01T11:15:00.000Z', workMinutes: 470, flags: ['late'], lateMinutes: 10, otWorkDayMinutes: 0 }),
      day({ date: '2026-10-02', dayType: 'upcoming', firstIn: '2026-10-02T03:15:00.000Z' }),
    ],
    summary: { ...summary, shiftAllowance: [{ shiftId: 'n1', code: 'N1', name: 'Night', days: 12.5, rate: 300, amount: 3750 }] },
    amounts: { otEarnedAmount: '937.5', leaveDeductionAmount: '0', shiftAllowanceAmount: '3750' },
  };

  it('codes, Nepal clock times, worked time and notes; pay only when allowed', () => {
    const row = attendanceRow(person, false);
    assert.deepEqual(row.days[0], { day: 1, code: 'P', type: 'Present', in: '09:10', out: '17:00', worked: '7:50', note: 'late 10 min' });
    assert.equal(row.days[1].code, '·');
    assert.equal(row.days[1].in, null, 'upcoming days show no times');
    assert.deepEqual([row.employedDays, row.payableDays, row.otWorkDayHours, row.workedHours], [30, 29.5, 1.5, 7.83]);
    assert.equal(row.otPay, null);
    assert.equal(row.absenceDeduction, null);
    // 4.12e: shift allowance days always; the amount only with pay.
    assert.equal(row.shiftDays, 12.5);
    assert.equal(row.shiftAllowance, null);
    const paid = attendanceRow(person, true);
    assert.deepEqual([paid.otPay, paid.absenceDeduction, paid.shiftAllowance], ['937.50', '0.00', '3750.00']);
    // A summary stored before 4.12e has no shift allowance lines.
    assert.equal(attendanceRow({ ...person, summary }, false).shiftDays, 0);
  });
});

describe('leave movement', () => {
  it('brought forward + earned − taken + adjusted − paid out − expired = available (substitute grants expire)', () => {
    const lines = [
      { kind: 'opening' as const, days: 10, entryDate: '2026-07-17', expiresOn: null },
      { kind: 'credit' as const, days: 12, entryDate: '2026-07-17', expiresOn: null },
      { kind: 'grant' as const, days: 1, entryDate: '2026-07-20', expiresOn: '2026-08-10' },
      // A written-off expiry only mirrors the rule's own expiry: never counted twice.
      { kind: 'expired' as const, days: -1, entryDate: '2026-08-11', expiresOn: null },
      { kind: 'taken' as const, days: -3, entryDate: '2026-08-15', expiresOn: null },
      { kind: 'adjusted' as const, days: 0.5, entryDate: '2026-09-01', expiresOn: null },
      { kind: 'paid_out' as const, days: -2, entryDate: '2026-09-05', expiresOn: null },
      { kind: 'lapsed' as const, days: -1, entryDate: '2026-09-10', expiresOn: null },
    ];
    const m = leaveMovement(lines, '2026-10-10');
    assert.deepEqual(m, { broughtForward: 10, earned: 13, taken: 3, adjusted: 0.5, paidOut: 2, expired: 2, available: 16.5 });
    assert.equal(m.broughtForward + m.earned - m.taken + m.adjusted - m.paidOut - m.expired, m.available);
    // Before the grant expires it is still available.
    assert.equal(leaveMovement(lines.slice(0, 3), '2026-08-01').available, 23);
    assert.deepEqual(leaveMovement([], '2026-10-10'), { broughtForward: 0, earned: 0, taken: 0, adjusted: 0, paidOut: 0, expired: 0, available: 0 });
  });
});

describe('loan rows', () => {
  it('status, interest, months left and how a repayment came in', () => {
    assert.equal(loanStatusLabel({ status: 'ACTIVE', closedHow: null }), 'Running');
    assert.equal(loanStatusLabel({ status: 'CLOSED', closedHow: 'written_off' }), 'Written off');
    assert.equal(loanStatusLabel({ status: 'CLOSED', closedHow: 'settlement' }), 'Final settlement');
    assert.equal(loanStatusLabel({ status: 'CLOSED', closedHow: null }), 'Closed');
    assert.equal(loanInterest({ loanAmount: '120000', totalPayable: '127200' }), '7200.00');
    assert.equal(loanInstallmentsLeft({ status: 'ACTIVE', remainingAmount: '116600', installmentAmount: '10600' }), 11);
    assert.equal(loanInstallmentsLeft({ status: 'CLOSED', remainingAmount: '0', installmentAmount: '10600' }), null);
    assert.equal(repaymentHow('SALARY_DEDUCTION', { month: 6, year: 2083 }), 'Payroll, Aswin 2083');
    assert.equal(repaymentHow('SETTLEMENT', null), 'Final settlement');
    assert.equal(repaymentHow('CASH', null), 'Paid in');
  });
});

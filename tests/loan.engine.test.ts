import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  approvalRequestOf,
  burdenPct,
  capLines,
  completedMonths,
  deductsIn,
  installmentsLeft,
  linesTotal,
  loanDecisionCtx,
  loanTerms,
  monthLines,
  monthlyDue,
  normalizeDisburseForm,
  normalizeRequestForm,
  normalizeTypeForm,
  openingTerms,
  readOpeningLoanRow,
  repaidPct,
  requestLimit,
  spreadDeduction,
  validateDecisionNote,
  validateDisburse,
  validateRepayment,
  validateRequest,
  validateTypeForm,
  validateWriteOffReason,
  type RequestFacts,
} from '../lib/engines/loan.engine';
import { availableActions, buildFlow } from '../lib/engines/approval.engine';

// 4.10 loans: the pure rules — loan types, terms, what payroll deducts each month, a typed
// deduction spread over the loans, request limits and eligibility, the approval wording,
// disbursement, repayment and opening balances.

describe('loan types', () => {
  const type = (over: Record<string, unknown> = {}) => normalizeTypeForm({ name: '  Vehicle   loan ', kind: 'loan', maxAmount: 500000, maxSalaryMonths: 0, maxInstallments: 60, interestRate: 6, eligibleAfterMonths: 12, ...over });
  it('is cleaned and accepted', () => {
    const t = type();
    assert.equal(t.name, 'Vehicle loan');
    assert.equal(t.selfService, false);
    assert.equal(t.isActive, true);
    assert.deepEqual(validateTypeForm(t), {});
  });
  it('a salary advance carries no interest and is recovered within a year', () => {
    const advance = type({ kind: 'advance', interestRate: 5, maxInstallments: 3, maxAmount: 0, maxSalaryMonths: 1 });
    assert.equal(advance.interestRate, 0);
    assert.deepEqual(validateTypeForm(advance), {});
    assert.match(validateTypeForm({ ...advance, maxInstallments: 13 }).maxInstallments ?? '', /within 12 months/);
  });
  it('says what is wrong', () => {
    assert.ok(validateTypeForm(type({ name: ' ' })).name);
    assert.ok(validateTypeForm(type({ maxInstallments: 0 })).maxInstallments);
    assert.ok(validateTypeForm(type({ interestRate: 101 })).interestRate);
    assert.ok(validateTypeForm(type({ maxSalaryMonths: 61 })).maxSalaryMonths);
    assert.ok(validateTypeForm(type({ eligibleAfterMonths: 2.5 })).eligibleAfterMonths);
  });
  it('a type employees ask for themselves needs a limit', () => {
    assert.match(validateTypeForm(type({ selfService: true, maxAmount: 0 })).maxAmount ?? '', /set a limit/);
    assert.deepEqual(validateTypeForm(type({ selfService: true, maxAmount: 0, maxSalaryMonths: 2 })), {});
  });
});

describe('loan terms', () => {
  it('flat interest once, installments rounded up so nothing is left over', () => {
    assert.deepEqual(loanTerms(100000, 10, 12), { interest: '10000.00', totalPayable: '110000.00', installment: '9166.67', months: 12, lastInstallment: '9166.63' });
    assert.deepEqual(loanTerms(10000, 0, 3), { interest: '0.00', totalPayable: '10000.00', installment: '3333.34', months: 3, lastInstallment: '3333.32' });
    assert.equal(loanTerms(60000, 0, 12).installment, '5000.00');
  });
});

describe('what payroll deducts', () => {
  const run = { payMonth: '2083-07', periodEnd: '2026-11-15' };
  it('from the first deduction month; loans from before 4.10 from the month they were given', () => {
    assert.equal(deductsIn({ firstDeductionMonth: '2083-07', givenDate: '2026-10-01' }, run), true);
    assert.equal(deductsIn({ firstDeductionMonth: '2083-08', givenDate: '2026-10-01' }, run), false);
    assert.equal(deductsIn({ firstDeductionMonth: null, givenDate: '2026-11-15' }, run), true);
    assert.equal(deductsIn({ firstDeductionMonth: null, givenDate: '2026-11-16' }, run), false);
  });
  it('the installment, or all that is left; never under Rs 1 left for another month', () => {
    assert.equal(monthlyDue({ installment: 5000, remaining: 20000 }).toFixed(2), '5000.00');
    assert.equal(monthlyDue({ installment: 5000, remaining: 1850 }).toFixed(2), '1850.00');
    assert.equal(monthlyDue({ installment: 3333.33, remaining: 3333.34 }).toFixed(2), '3333.34');
    // Already on a payslip of a run not yet locked: only what is beyond it.
    assert.equal(monthlyDue({ installment: 5000, remaining: 7000, reserved: 5000 }).toFixed(2), '2000.00');
    assert.equal(monthlyDue({ installment: 5000, remaining: 5000, reserved: 5000 }).toFixed(2), '0.00');
  });
  it('a line per running loan in order, none for loans not started', () => {
    const lines = monthLines(
      [
        { id: 'a', installment: 4000, remaining: 20000, firstDeductionMonth: '2083-05', givenDate: '2026-08-01' },
        { id: 'b', installment: 3000, remaining: 1500, firstDeductionMonth: null, givenDate: '2026-10-10' },
        { id: 'c', installment: 5000, remaining: 30000, firstDeductionMonth: '2083-08', givenDate: '2026-11-01' },
      ],
      run
    );
    assert.deepEqual(lines, [
      { loanId: 'a', amount: '4000.00' },
      { loanId: 'b', amount: '1500.00' },
    ]);
    assert.equal(linesTotal(lines), '5500.00');
  });
  it('cut to what the pay can bear, the oldest loans first', () => {
    const lines = [
      { loanId: 'a', amount: '4000.00' },
      { loanId: 'b', amount: '1500.00' },
    ];
    assert.deepEqual(capLines(lines, 4500), [
      { loanId: 'a', amount: '4000.00' },
      { loanId: 'b', amount: '500.00' },
    ]);
    assert.deepEqual(capLines(lines, 0), []);
  });
  it('a typed deduction is spread oldest first, up to what each still owes', () => {
    const loans = [
      { loanId: 'a', available: '3000' },
      { loanId: 'b', available: '10000' },
    ];
    assert.deepEqual(spreadDeduction('6,500', loans), { lines: [{ loanId: 'a', amount: '3000.00' }, { loanId: 'b', amount: '3500.00' }] });
    assert.deepEqual(spreadDeduction(0, loans), { lines: [] });
    assert.match((spreadDeduction(13000.5, loans) as { error: string }).error, /At most NPR 13,000\.00/);
    assert.match((spreadDeduction(10, []) as { error: string }).error, /no running loan/);
    assert.ok('error' in spreadDeduction(-1, loans));
    assert.ok('error' in spreadDeduction(1.005, loans));
  });
  it('counts what is left and how much came back', () => {
    assert.equal(installmentsLeft(20000, 5000), 4);
    assert.equal(installmentsLeft(10000.5, 5000), 2);
    assert.equal(installmentsLeft(0, 5000), 0);
    assert.equal(repaidPct(60000, 25000), 41.7);
    // A written-off loan shows what came back, not 100%.
    assert.equal(repaidPct(127200, 17200), 13.5);
    assert.equal(repaidPct(0, 0), 0);
  });
});

describe('loan requests', () => {
  const advance = { name: 'Salary advance', kind: 'advance' as const, isActive: true, selfService: true, maxAmount: 0, maxSalaryMonths: 1, maxInstallments: 3, eligibleAfterMonths: 6 };
  const facts = (over: Partial<RequestFacts> = {}): RequestFacts => ({ type: advance, monthlySalary: 40000, serviceMonths: 24, openOfType: null, ownRequest: true, employeeOk: true, ...over });
  const form = (over: Record<string, unknown> = {}) => normalizeRequestForm({ employeeId: 'e1', loanTypeId: 't1', amount: '35,000', installments: 3, reason: ' Dashain shopping ', ...over });

  it('the limit is the fixed amount, months of basic + grade, or the smaller of both', () => {
    assert.deepEqual(requestLimit({ maxAmount: 0, maxSalaryMonths: 1 }, 40000), { amount: 40000, basis: '1 month of basic + grade', needsSalary: false });
    assert.deepEqual(requestLimit({ maxAmount: 30000, maxSalaryMonths: 1 }, 40000), { amount: 30000, basis: "the type's limit", needsSalary: false });
    assert.equal(requestLimit({ maxAmount: 0, maxSalaryMonths: 1.5 }, 40000).basis, '1.5 months of basic + grade');
    assert.equal(requestLimit({ maxAmount: 0, maxSalaryMonths: 2 }, null).needsSalary, true);
    assert.deepEqual(requestLimit({ maxAmount: 0, maxSalaryMonths: 0 }, null), { amount: null, basis: null, needsSalary: false });
  });
  it('is accepted within the limits', () => {
    const f = form();
    assert.equal(f.amount, 35000);
    assert.equal(f.reason, 'Dashain shopping');
    assert.deepEqual(validateRequest(f, facts()), {});
  });
  it('says what is wrong', () => {
    assert.match(validateRequest(form({ amount: 40000.01 }), facts()).amount ?? '', /At most NPR 40,000\.00 \(1 month of basic \+ grade\)/);
    assert.match(validateRequest(form(), facts({ monthlySalary: null })).amount ?? '', /No salary structure/);
    assert.match(validateRequest(form({ installments: 4 }), facts()).installments ?? '', /At most 3/);
    assert.match(validateRequest(form(), facts({ serviceMonths: 4 })).loanTypeId ?? '', /after 6 months of service \(4 months so far\)/);
    assert.match(validateRequest(form(), facts({ openOfType: 'loan' })).loanTypeId ?? '', /still being repaid/);
    assert.match(validateRequest(form(), facts({ openOfType: 'request' })).loanTypeId ?? '', /already open/);
    assert.match(validateRequest(form({ reason: 'cash' }), facts()).reason ?? '', /at least 5/);
    assert.ok(validateRequest(form(), facts({ employeeOk: false })).employeeId);
    assert.ok(validateRequest(form(), facts({ type: { ...advance, isActive: false } })).loanTypeId);
  });
  it('one\'s own request is only for the types employees ask for themselves', () => {
    const office = { ...advance, selfService: false };
    assert.match(validateRequest(form(), facts({ type: office })).loanTypeId ?? '', /HR requests it/);
    assert.deepEqual(validateRequest(form(), facts({ type: office, ownRequest: false })), {});
  });
  it('service months and the share of salary', () => {
    assert.equal(completedMonths('2025-04-15', '2026-04-14'), 11);
    assert.equal(completedMonths('2025-04-15', '2026-04-15'), 12);
    assert.equal(completedMonths('2026-12-01', '2026-10-10'), 0);
    assert.equal(burdenPct(12000, 40000), 30);
    assert.equal(burdenPct(12000, null), null);
  });
});

describe('approving a loan request (S21, maker-checker)', () => {
  const approvers = [
    { userId: 'hr', name: 'HR', employeeId: 'e-hr', active: true, canApprove: true, delegatedTo: null, delegatedUntil: null },
    { userId: 'boss', name: 'Boss', employeeId: 'e-boss', active: true, canApprove: true, delegatedTo: null, delegatedUntil: null },
  ];
  const ctx = loanDecisionCtx(approvers, 'admin_exempt', '2026-10-10');
  const request = (over: Record<string, unknown> = {}) => approvalRequestOf({ status: 'pending', preparedBy: 'hr', employeeId: 'e1', approvalType: 'simple', approvalLevels: [], currentLevel: 0, ...over });

  it('someone else approves; never the person who asked, never one\'s own loan', () => {
    assert.ok(availableActions(request(), { userId: 'boss', employeeId: 'e-boss', canApprove: true, isAdministrator: false }, ctx).approve);
    const preparer = availableActions(request(), { userId: 'hr', employeeId: 'e-hr', canApprove: true, isAdministrator: false }, ctx);
    assert.equal(preparer.approve, null);
    assert.match(preparer.reason ?? '', /You asked for this loan/);
    const own = availableActions(request({ employeeId: 'e-boss' }), { userId: 'boss', employeeId: 'e-boss', canApprove: true, isAdministrator: true }, ctx);
    assert.equal(own.approve, null);
    assert.equal(own.finalApprove, false);
    assert.match(own.reason ?? '', /your own loan/);
  });
  it('strict maker-checker: an administrator never Final approves what they asked for', () => {
    const admin = { userId: 'hr', employeeId: 'e-hr', canApprove: true, isAdministrator: true };
    assert.equal(availableActions(request(), admin, ctx).finalApprove, true);
    assert.equal(availableActions(request(), admin, loanDecisionCtx(approvers, 'strict', '2026-10-10')).finalApprove, false);
  });
  it('a request about the preparer always waits, even with approvals off; a disbursed one reads as approved', () => {
    const own = buildFlow({ type: 'none', levels: [] }, { preparerId: 'u1', preparerEmployeeId: 'e1', subjectEmployeeIds: ['e1'], approvers });
    assert.equal(own.approvedAtOnce, false);
    assert.equal(approvalRequestOf({ status: 'disbursed', preparedBy: 'hr', employeeId: 'e1', approvalType: null, approvalLevels: null, currentLevel: null }).status, 'approved');
  });
  it('a rejection says why', () => {
    assert.ok(validateDecisionNote('reject', 'no'));
    assert.equal(validateDecisionNote('reject', 'Over the limit'), null);
    assert.equal(validateDecisionNote('approve', ''), null);
  });
});

describe('disbursing, repaying, writing off', () => {
  it('disbursement: when, how, and the month payroll starts', () => {
    const ctx = { today: '2026-10-10', requestedOn: '2026-10-01', payMonths: ['2083-06', '2083-07'] };
    const f = normalizeDisburseForm({ givenDate: '2026-10-09', firstDeductionMonth: '2083-07', paidVia: 'bank', paymentRef: ' TXN-1 ' });
    assert.deepEqual(validateDisburse(f, ctx), {});
    assert.equal(f.paymentRef, 'TXN-1');
    assert.ok(validateDisburse({ ...f, givenDate: '2026-10-11' }, ctx).givenDate);
    assert.ok(validateDisburse({ ...f, givenDate: '2026-09-30' }, ctx).givenDate);
    assert.ok(validateDisburse({ ...f, firstDeductionMonth: '2083-09' }, ctx).firstDeductionMonth);
    assert.ok(validateDisburse({ ...f, paymentRef: '' }, ctx).paymentRef);
    assert.deepEqual(validateDisburse({ ...f, paidVia: 'cash', paymentRef: '' }, ctx), {});
    assert.ok(validateDisburse(normalizeDisburseForm({ ...f, paidVia: 'crypto' }), ctx).paidVia);
  });
  it('a repayment within what is not already on an unlocked payslip', () => {
    const ctx = { today: '2026-10-10', givenDate: '2026-01-01', remaining: 12000, reserved: 5000, reservedIn: 'Kartik 2083' };
    assert.deepEqual(validateRepayment({ date: '2026-10-10', amount: 7000, note: '' }, ctx), {});
    assert.match(validateRepayment({ date: '2026-10-10', amount: 7000.01, note: '' }, ctx).amount ?? '', /At most NPR 7,000\.00 now: NPR 5,000\.00 is on the Kartik 2083 payslip/);
    assert.match(validateRepayment({ date: '2026-10-10', amount: 13000, note: '' }, { ...ctx, reserved: 0 }).amount ?? '', /the balance/);
    assert.ok(validateRepayment({ date: '2025-12-31', amount: 10, note: '' }, ctx).date);
    assert.ok(validateRepayment({ date: '2026-10-11', amount: 10, note: '' }, ctx).date);
  });
  it('a write-off says why', () => {
    assert.ok(validateWriteOffReason('bad debt'));
    assert.equal(validateWriteOffReason('Board decision 2083-07-01: absconded'), null);
  });
});

describe('opening balances (F15)', () => {
  const row = (cells: Record<string, string>) => ({ line: 2, cells: { employeeCode: 'EMP-001', loanType: 'Vehicle loan', givenDate: '2081-04-15', amount: '1,50,000', balance: '60,000', installment: '5,000', ...cells } });
  it('reads a row and the terms it is stored with', () => {
    const r = readOpeningLoanRow(row({}), '2026-10-10');
    assert.deepEqual(r.issues, []);
    assert.equal(r.loan?.repaid, '90000.00');
    assert.deepEqual(openingTerms(r.loan!), { totalPayable: '150000.00', interestRate: '0.00', installmentsLeft: 12 });
    const withInterest = readOpeningLoanRow(row({ repaid: '1,00,000' }), '2026-10-10');
    assert.equal(openingTerms(withInterest.loan!).interestRate, '6.67');
  });
  it('says what is wrong, line by line', () => {
    const bad = readOpeningLoanRow(row({ givenDate: '4/15/2081', balance: '0', installment: 'abc' }), '2026-10-10');
    assert.equal(bad.loan, null);
    assert.deepEqual(bad.issues.map((i) => i.column).sort(), ['Balance to recover', 'Date given (BS)', 'Monthly installment']);
    const warn = readOpeningLoanRow(row({ balance: '1,60,000', installment: '2,00,000' }), '2026-10-10');
    assert.ok(warn.loan);
    assert.deepEqual(warn.issues.map((i) => i.level), ['warning', 'warning']);
  });
});

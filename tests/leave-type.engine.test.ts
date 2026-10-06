import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { changedFields, describeLeaveType, leaveTypeChangeLines, normalizeLeaveTypeForm, payoutRate, validateLeaveTypeForm } from '../lib/engines/leave-type.engine';
import { calculateLeaveSalary } from '../lib/engines/leave-salary.engine';

// 4.6e: company leave types (no legal minimum; each one must make sense).

const form = (over: Record<string, unknown> = {}) => normalizeLeaveTypeForm({ name: 'Study leave', code: 'STUDY', leaveType: 'Pay', kind: 'balance', noOfDays: 10, ...over });

describe('company leave types: what can be saved (4.6e)', () => {
  it('a valid balance, event and no-balance type', () => {
    assert.deepEqual(validateLeaveTypeForm(form()), {});
    assert.deepEqual(validateLeaveTypeForm(form({ kind: 'event', noOfDays: 5, paidDaysPerEvent: 3 })), {});
    assert.deepEqual(validateLeaveTypeForm(form({ leaveType: 'Non-Pay', kind: 'none', maxDaysPerYear: 30, maxDaysInService: 60 })), {});
  });

  it('refuses what makes no sense', () => {
    assert.match(validateLeaveTypeForm(form({ leaveType: 'Non-Pay' })).kind ?? '', /Unpaid leave has no balance/);
    assert.ok(validateLeaveTypeForm(form({ noOfDays: 0 })).noOfDays);
    assert.ok(validateLeaveTypeForm(form({ noOfDays: 2.3 })).noOfDays, 'whole or half days');
    assert.ok(validateLeaveTypeForm(form({ kind: 'event', noOfDays: 5, paidDaysPerEvent: 6 })).paidDaysPerEvent);
    assert.match(validateLeaveTypeForm(form({ kind: 'none', maxDaysPerYear: 30, maxDaysInService: 20 })).maxDaysInService ?? '', /At least the yearly limit/);
    assert.ok(validateLeaveTypeForm(form({ isEncashable: true, encashmentBasis: 'Fixed' })).payoutFixedAmount);
    assert.ok(validateLeaveTypeForm(form({ requiresDocument: true, documentThresholdDays: 0 })).documentThresholdDays);
    assert.ok(validateLeaveTypeForm(form({ noticeDays: 'x' })).noticeDays, 'not a number');
    assert.ok(validateLeaveTypeForm(form({ code: 'study-leave' })).code);
  });

  it('clears what means nothing for the kind; 0 means no limit', () => {
    const none = form({ kind: 'none', noOfDays: 12, carryForward: true, accumulationCap: 20, isEncashable: true, creditMode: 'monthly' });
    assert.equal(none.noOfDays, 0);
    assert.equal(none.carryForward, false);
    assert.equal(none.accumulationCap, null);
    assert.equal(none.isEncashable, false);
    assert.equal(none.creditMode, 'yearly');
    const balance = form({ maxDaysPerYear: 30, paidDaysPerEvent: 3, noticeDays: 0, accumulationCap: 20 });
    assert.equal(balance.maxDaysPerYear, null);
    assert.equal(balance.paidDaysPerEvent, null);
    assert.equal(balance.noticeDays, null);
    assert.equal(balance.accumulationCap, null, 'no carry-over, no cap');
    assert.equal(form({ isEncashable: true, encashmentBasis: 'BasicSalary', payoutFixedAmount: 900 }).payoutFixedAmount, null);
    assert.deepEqual(form({ applicableDepartments: ['a', 'a', 7, ''] }).applicableDepartments, ['a']);
  });

  it('says what it means in one sentence', () => {
    assert.equal(
      describeLeaveType(form({ carryForward: true, accumulationCap: 20, noticeDays: 7 })),
      "Study leave: 10 paid days a year, given at the start of the leave year (a share for joiners), carried over up to 20 days, the rest lapses; 7 days' notice."
    );
    assert.equal(describeLeaveType(form({ name: 'Special unpaid leave', leaveType: 'Non-Pay', kind: 'none', maxDaysPerYear: 30, maxDaysInService: 60 })), 'Special unpaid leave: unpaid, no balance, at most 30 days a year, 60 days over the whole service.');
    assert.match(describeLeaveType(form({ creditMode: 'monthly', noOfDays: 12 })), /earned 1 a month as each attendance month closes/);
  });

  it('the history keeps only what changed, in words', () => {
    const d = changedFields(form(), form({ noOfDays: 12, isActive: false }));
    assert.deepEqual(d.after, { noOfDays: 12, isActive: false });
    assert.deepEqual(leaveTypeChangeLines(d.before, d.after), ['Days: 10 → 12', 'In use: On → Off']);
  });
});

describe('payout rate on the leave type (4.6e)', () => {
  it('statutory leave is basic salary; a company type may set a fixed amount; old types fall back to their leave rule', () => {
    const rule = { encashmentRate: 'FIXED_AMOUNT', encashmentFixedAmount: 800 };
    assert.deepEqual(payoutRate({ isStatutory: true, encashmentBasis: 'Fixed', payoutFixedAmount: 500 }, rule), { rate: 'BASIC_DAILY', fixed: null });
    assert.deepEqual(payoutRate({ isStatutory: false, encashmentBasis: 'Fixed', payoutFixedAmount: 1200 }, rule), { rate: 'FIXED_AMOUNT', fixed: 1200 });
    assert.deepEqual(payoutRate({ isStatutory: false, encashmentBasis: 'BasicSalary', payoutFixedAmount: null }, rule), { rate: 'BASIC_DAILY', fixed: null });
    assert.deepEqual(payoutRate({ isStatutory: false, encashmentBasis: null, payoutFixedAmount: null }, rule), { rate: 'FIXED_AMOUNT', fixed: 800 });
    assert.deepEqual(payoutRate({ isStatutory: false, encashmentBasis: null, payoutFixedAmount: null }, null), { rate: 'BASIC_DAILY', fixed: null });
  });

  it('a fixed amount is never paid below basic salary per day', () => {
    assert.equal(calculateLeaveSalary({ basicSalary: '30000', leaveDays: 2, encashmentRate: 'FIXED_AMOUNT', fixedDailyAmount: 500 }).perDayRate, '1000');
    assert.equal(calculateLeaveSalary({ basicSalary: '30000', leaveDays: 2, encashmentRate: 'FIXED_AMOUNT', fixedDailyAmount: 1500 }).totalAmount, '3000');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import {
  canMove,
  dueDays,
  encashableFromBalance,
  isPayMonth,
  normalizeForm,
  payMonthLabel,
  payMonthOptions,
  sumAmounts,
  validateCancelReason,
  validateForm,
} from '../lib/engines/leave-salary.engine';
import { buildTaxSheet } from '../lib/engines/tax-projection.engine';

// 4.9 leave salary: the pure rules — moves, pay months, which leave is encashed from the balance,
// the form — and the tax projection counting a one-off payment once.

const home = { kind: 'balance', isEncashable: true, isRight: false, isActive: true, statutoryCode: 'HOME', name: 'Home Leave' };
const ctx = { type: home, available: 12.5, payMonths: ['2083-06', '2083-07', '2083-08'] };
const form = (over: Record<string, unknown> = {}) => normalizeForm({ employeeId: 'e1', leaveTypeId: 't1', days: '10', payMonth: '2083-06', note: '  Annual encashment ', ...over });

describe('leave salary moves', () => {
  it('prepared → approved → paid by a pay run; approved → cancelled; nothing after paid or cancelled', () => {
    assert.equal(canMove('DRAFT', 'APPROVED'), true);
    assert.equal(canMove('APPROVED', 'PAID'), true);
    assert.equal(canMove('APPROVED', 'CANCELLED'), true);
    assert.equal(canMove('DRAFT', 'PAID'), false);
    assert.equal(canMove('PAID', 'CANCELLED'), false);
    assert.equal(canMove('CANCELLED', 'APPROVED'), false);
  });
});

describe('pay months', () => {
  it('offers this BS month and the next two, across the year end', () => {
    assert.deepEqual(payMonthOptions({ year: 2083, month: 6 }).map((m) => m.value), ['2083-06', '2083-07', '2083-08']);
    assert.deepEqual(payMonthOptions({ year: 2083, month: 12 }).map((m) => m.label), ['Chaitra 2083', 'Baisakh 2084', 'Jestha 2084']);
  });
  it('names a pay month, and leaves the free text of older records as written', () => {
    assert.equal(payMonthLabel('2083-07'), 'Kartik 2083');
    assert.equal(payMonthLabel('Shrawan (FY 2083/84)'), 'Shrawan (FY 2083/84)');
    assert.equal(isPayMonth('2083-13'), false);
    assert.equal(isPayMonth('2083-01'), true);
  });
});

describe('which leave is encashed from the balance', () => {
  it('a balance type the company pays out — never a right (§51), substitute leave or an inactive type', () => {
    assert.equal(encashableFromBalance(home), true);
    assert.equal(encashableFromBalance({ ...home, isRight: true, statutoryCode: 'SICK' }), false);
    assert.equal(encashableFromBalance({ ...home, statutoryCode: 'SUBSTITUTE' }), false);
    assert.equal(encashableFromBalance({ ...home, isEncashable: false }), false);
    assert.equal(encashableFromBalance({ ...home, isActive: false }), false);
    assert.equal(encashableFromBalance({ ...home, kind: 'event' }), false);
  });
});

describe('the encashment form', () => {
  it('is cleaned and accepted within the balance in force', () => {
    const f = form({ days: '1,0' });
    assert.equal(f.days, 10);
    assert.equal(f.note, 'Annual encashment');
    assert.deepEqual(validateForm(f, ctx), {});
    assert.deepEqual(validateForm(form({ days: 12.5 }), ctx), {});
  });
  it('says what is wrong', () => {
    assert.match(validateForm(form({ days: 13 }), ctx).days ?? '', /Only 12\.5 days available/);
    assert.match(validateForm(form({ days: 1 }), { ...ctx, available: 0 }).days ?? '', /Nothing available/);
    assert.match(validateForm(form({ days: 2.25 }), ctx).days ?? '', /half days/);
    assert.ok(validateForm(form({ days: 0 }), ctx).days);
    assert.ok(validateForm(form({ employeeId: '' }), ctx).employeeId);
    assert.ok(validateForm(form({ payMonth: '2083-05' }), ctx).payMonth);
    assert.match(validateForm(form(), { ...ctx, type: { ...home, isRight: true, name: 'Sick Leave' } }).leaveTypeId ?? '', /right \(Labour Act §51\)/);
    assert.ok(validateForm(form(), { ...ctx, type: null }).leaveTypeId);
  });
  it('a cancellation says why', () => {
    assert.ok(validateCancelReason('no'));
    assert.equal(validateCancelReason('Paid in the settlement instead'), null);
  });
});

describe('amounts', () => {
  it('a year-end line pays its days; record amounts add up in paisa', () => {
    assert.equal(dueDays(-7.5), 7.5);
    assert.equal(sumAmounts(['0.10', '0.20', 1000]), '1000.30');
  });
});

describe('tax on a payment made once (4.9)', () => {
  const taxOn = (annual: Decimal) => annual.times(0.1);
  it('is added to the projected year once, never × the months that remain', () => {
    const regular = buildTaxSheet({ past: [], currentTaxable: 50000, monthsRemaining: 9, taxOn });
    const withOnce = buildTaxSheet({ past: [], currentTaxable: 50000, oneOffTaxable: 30000, monthsRemaining: 9, taxOn });
    assert.equal(withOnce.oneOffTaxable, '30000.00');
    assert.equal(Number(withOnce.projectedAnnualTaxable) - Number(regular.projectedAnnualTaxable), 30000);
    // The month collects the extra tax spread over the months left, not nine times the payment's tax.
    assert.equal(Number(withOnce.tdsThisMonth) - Number(regular.tdsThisMonth), Math.round(3000 / 9));
  });
});

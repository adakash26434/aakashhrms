import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { buildTaxSheet, monthsRemainingFrom } from '../lib/engines/tax-projection.engine';

// Tax projection (F5): remaining tax spread over the remaining months.

// A simple two-band tax: 1% to 500,000, then 10% (annual).
const taxOn = (t: Decimal) => (t.lte(500000) ? t.times(0.01) : new Decimal(5000).plus(t.minus(500000).times(0.1)));

describe('tax projection', () => {
  it('month 1 with no history equals annualising the month (the old behaviour)', () => {
    const s = buildTaxSheet({ past: [], currentTaxable: 60000, monthsRemaining: 12, taxOn });
    assert.equal(s.projectedAnnualTaxable, '720000.00');
    assert.equal(s.annualTax, '27000.00');
    assert.equal(s.tdsThisMonth, '2250');
  });

  it('a steady salary keeps the monthly tax steady', () => {
    const past = Array.from({ length: 5 }, () => ({ taxableIncome: 60000, tds: 2250 }));
    const s = buildTaxSheet({ past, currentTaxable: 60000, monthsRemaining: 7, taxOn });
    assert.equal(s.tdsThisMonth, '2250');
    assert.equal(s.monthsPaid, 5);
  });

  it('a bonus paid earlier is not taxed again: the rest is spread, not re-annualised', () => {
    // Month 1 had a one-off bonus (taxable 160000) taxed at 2250 only (before projection existed).
    const past = [{ taxableIncome: 160000, tds: 2250 }];
    const s = buildTaxSheet({ past, currentTaxable: 60000, monthsRemaining: 11, taxOn });
    // projected = 160000 + 60000×11 = 820000 → tax 5000 + 32000 = 37000; collect 34750 over 11 months.
    assert.equal(s.annualTax, '37000.00');
    assert.equal(s.tdsThisMonth, '3159');
  });

  it('tax already deducted above the projection collects nothing', () => {
    const s = buildTaxSheet({ past: [{ taxableIncome: 10000, tds: 90000 }], currentTaxable: 10000, monthsRemaining: 11, taxOn });
    assert.equal(s.taxToCollect, '0.00');
    assert.equal(s.tdsThisMonth, '0');
  });

  it('a mid-year joiner is taxed on the months they will actually earn', () => {
    const s = buildTaxSheet({ past: [], currentTaxable: 60000, monthsRemaining: 8, taxOn });
    assert.equal(s.projectedAnnualTaxable, '480000.00');
    assert.equal(s.tdsThisMonth, '600');
  });

  it('months remaining follow the fiscal order and stay within 1..12', () => {
    assert.equal(monthsRemainingFrom(1), 12);
    assert.equal(monthsRemainingFrom(12), 1);
    assert.equal(monthsRemainingFrom(0), 12);
    assert.equal(monthsRemainingFrom(99), 1);
  });
});

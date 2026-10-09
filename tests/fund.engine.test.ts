import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contributionRef,
  fundBalance,
  monthlyContribution,
  normalizeFundTypeForm,
  normalizePostingForm,
  postingAmounts,
  previousBsMonth,
  validateFundTypeForm,
  validatePosting,
} from '../lib/engines/fund.engine';

// Welfare funds (G9): paisa-safe arithmetic, idempotent refs, payouts never
// below zero on either share.

describe('fund contributions', () => {
  it('fixed mode contributes the set amounts', () => {
    assert.deepEqual(monthlyContribution({ contributionMode: 'fixed', employeeValue: 200, employerValue: '300.50' }, 25000), {
      employeeAmount: '200.00',
      employerAmount: '300.50',
    });
  });

  it('percent mode takes a share of basic, half-up to the paisa; zero basic contributes nothing', () => {
    assert.deepEqual(monthlyContribution({ contributionMode: 'percent_basic', employeeValue: 1, employerValue: 2 }, '25555.55'), {
      employeeAmount: '255.56',
      employerAmount: '511.11',
    });
    assert.deepEqual(monthlyContribution({ contributionMode: 'percent_basic', employeeValue: 1, employerValue: 2 }, 0), {
      employeeAmount: '0.00',
      employerAmount: '0.00',
    });
  });

  it('refs are stable per fund and BS month; the BS-day-1 job posts the previous month', () => {
    assert.equal(contributionRef('welfare', 2082, 6), 'contrib:welfare:2082-06');
    assert.deepEqual(previousBsMonth(2082, 1), { year: 2081, month: 12 });
    assert.deepEqual(previousBsMonth(2082, 7), { year: 2082, month: 6 });
  });
});

describe('fund balances', () => {
  it('sums signed lines in paisa (no float drift)', () => {
    const balance = fundBalance([
      { employeeAmount: '0.10', employerAmount: '0.20' },
      { employeeAmount: '0.20', employerAmount: '0.10' },
      { employeeAmount: '-0.30', employerAmount: 0 },
    ]);
    assert.deepEqual(balance, { employee: '0.00', employer: '0.30', total: '0.30' });
  });
});

describe('fund type form', () => {
  it('validates code, name and value ranges per mode', () => {
    const errors = validateFundTypeForm(normalizeFundTypeForm({}));
    assert.ok(errors.code && errors.name);
    assert.ok(validateFundTypeForm(normalizeFundTypeForm({ code: 'w', name: 'W', employeeValue: 10, employerValue: 10 })).code);
    assert.ok(validateFundTypeForm(normalizeFundTypeForm({ code: 'welfare', name: 'W', contributionMode: 'percent_basic', employeeValue: 150, employerValue: 0 })).employeeValue);
    assert.ok(validateFundTypeForm(normalizeFundTypeForm({ code: 'welfare', name: 'W', employeeValue: 0, employerValue: 0 })).employeeValue, 'someone must contribute');
    assert.deepEqual(validateFundTypeForm(normalizeFundTypeForm({ code: 'welfare', name: 'Welfare fund', nameNp: 'कल्याण कोष', employeeValue: 100, employerValue: 100 })), {});
  });
});

describe('fund postings', () => {
  const balance = { employee: '500.00', employer: '800.00', total: '1300.00' };

  it('payouts are entered positive, capped per share, stored negative', () => {
    const over = normalizePostingForm({ fundTypeId: 'f', employeeId: 'e', kind: 'payout', employeeAmount: 600, employerAmount: 100 });
    assert.match(validatePosting(over, balance).employeeAmount, /At most 500\.00/);
    const ok = normalizePostingForm({ fundTypeId: 'f', employeeId: 'e', kind: 'payout', employeeAmount: 500, employerAmount: 800 });
    assert.deepEqual(validatePosting(ok, balance), {});
    assert.deepEqual(postingAmounts(ok), { employeeAmount: '-500.00', employerAmount: '-800.00' });
    assert.ok(validatePosting(normalizePostingForm({ fundTypeId: 'f', employeeId: 'e', kind: 'payout', employeeAmount: -5, employerAmount: 0 }), balance).employeeAmount);
  });

  it('openings are non-negative and non-empty', () => {
    assert.ok(validatePosting(normalizePostingForm({ fundTypeId: 'f', employeeId: 'e', kind: 'opening', employeeAmount: 0, employerAmount: 0 }), balance).employeeAmount);
    const ok = normalizePostingForm({ fundTypeId: 'f', employeeId: 'e', kind: 'opening', employeeAmount: 1000, employerAmount: 0 });
    assert.deepEqual(validatePosting(ok, balance), {});
    assert.deepEqual(postingAmounts(ok), { employeeAmount: '1000.00', employerAmount: '0.00' });
  });

  it('adjustments need a note and never take a share below zero', () => {
    const bad = normalizePostingForm({ fundTypeId: 'f', employeeId: 'e', kind: 'adjustment', employeeAmount: -600, employerAmount: 0, note: 'Posted twice in Ashwin.' });
    assert.ok(validatePosting(bad, balance).employeeAmount);
    const noNote = normalizePostingForm({ fundTypeId: 'f', employeeId: 'e', kind: 'adjustment', employeeAmount: -100, employerAmount: 0 });
    assert.ok(validatePosting(noNote, balance).note);
    const ok = normalizePostingForm({ fundTypeId: 'f', employeeId: 'e', kind: 'adjustment', employeeAmount: -100, employerAmount: 50, note: 'Posted twice in Ashwin.' });
    assert.deepEqual(validatePosting(ok, balance), {});
    assert.deepEqual(postingAmounts(ok), { employeeAmount: '-100.00', employerAmount: '50.00' });
  });
});

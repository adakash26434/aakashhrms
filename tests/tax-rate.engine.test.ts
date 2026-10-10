import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import {
  MAX_LADDER_ROWS,
  bandRange,
  describeBand,
  ladderBands,
  ladderChanges,
  ladderIsValid,
  ladderTax,
  normalizeLadder,
  rowsFromSlabs,
  validateLadder,
  type LadderRow,
} from '../lib/engines/tax-rate.engine';
import { calculateAnnualTaxFromSlabs, type EmployeeInput, type TaxSlabInput } from '../lib/engines/payroll.engine';
import type { SystemControlData } from '../lib/types/system-control';

// Tax slabs (4.12): a ladder is edited and saved whole, bands as boundaries — the way payroll
// reads them — and the screen's preview works the tax out exactly as payroll does.

const row = (upTo: number | null, ratePercent: number, fixedDeduction = 0): LadderRow => ({ upTo, ratePercent, fixedDeduction });
const INDIVIDUAL: LadderRow[] = [row(5_00_000, 1), row(7_00_000, 10), row(10_00_000, 20), row(20_00_000, 30), row(50_00_000, 36), row(null, 39)];

describe('tax ladder bands (4.12)', () => {
  it('each band starts where the one before ends; the first at 0', () => {
    assert.deepEqual(
      ladderBands(INDIVIDUAL).map((b) => b.from),
      [0, 5_00_000, 7_00_000, 10_00_000, 20_00_000, 50_00_000]
    );
  });

  it('says what a band covers', () => {
    const bands = ladderBands(INDIVIDUAL);
    assert.equal(bandRange(bands[0]), 'Up to 5,00,000');
    assert.equal(bandRange(bands[1]), '5,00,000 – 7,00,000');
    assert.equal(bandRange(bands[5]), 'Above 50,00,000');
    assert.equal(bandRange({ from: 0, upTo: null }), 'All income');
    assert.equal(describeBand({ from: 5_00_000, upTo: 7_00_000, ratePercent: 10, fixedDeduction: 5_000 }), '5,00,000 – 7,00,000 at 10%, less 5,000');
  });

  it('reads stored slabs, old "+1" chaining included, as exact boundaries', () => {
    const legacy = [
      { amountFrom: 7_00_001, amountTo: null, ratePercent: 20, fixedDeduction: 0 },
      { amountFrom: 0, amountTo: 5_00_000, ratePercent: 1, fixedDeduction: 0 },
      { amountFrom: 5_00_001, amountTo: 7_00_000, ratePercent: 10, fixedDeduction: 0 },
    ];
    const rows = rowsFromSlabs(legacy);
    assert.deepEqual(rows, [row(5_00_000, 1), row(7_00_000, 10), row(null, 20)]);
    // Saved again, the bands no longer drop a rupee between 5,00,000 and 5,00,001.
    assert.deepEqual(ladderBands(rows).map((b) => [b.from, b.upTo]), [[0, 5_00_000], [5_00_000, 7_00_000], [7_00_000, null]]);
  });

  it('takes numbers from the browser and keeps the last band open-ended', () => {
    assert.deepEqual(normalizeLadder([{ upTo: '5,00,000', ratePercent: '1' }, { upTo: 9_00_000, ratePercent: 10, fixedDeduction: '' }]), [row(5_00_000, 1), row(null, 10)]);
    assert.deepEqual(normalizeLadder('nope'), []);
    assert.ok(Number.isNaN(normalizeLadder([{ upTo: 'x', ratePercent: 1 }, { ratePercent: 2 }])[0].upTo as number));
    assert.equal(normalizeLadder(Array.from({ length: 40 }, () => ({ upTo: 1, ratePercent: 1 }))).length, MAX_LADDER_ROWS + 1, 'a flood is cut, and then refused');
  });
});

describe('tax ladder rules (4.12, S49)', () => {
  it('a valid ladder passes', () => {
    assert.ok(ladderIsValid(validateLadder(INDIVIDUAL)));
    assert.ok(ladderIsValid(validateLadder([row(null, 1)])), 'one band for all income');
  });

  it('refuses an empty ladder and too many bands', () => {
    assert.equal(validateLadder([]).form, 'Add at least one band.');
    assert.equal(validateLadder(Array.from({ length: MAX_LADDER_ROWS + 1 }, (_, i) => row(i === MAX_LADDER_ROWS ? null : (i + 1) * 1_00_000, 1))).form, `At most ${MAX_LADDER_ROWS} bands.`);
  });

  it('every band but the last has a top above where it starts, in whole rupees', () => {
    const e = validateLadder([row(5_00_000, 1), row(null, 10), row(4_00_000, 20), row(9_00_000.5, 20), row(null, 30)]).rows;
    assert.match(e[1].upTo!, /Give the income/);
    assert.match(e[2].upTo!, /more than 5,00,000/);
    assert.match(e[3].upTo!, /Whole rupees/);
    assert.equal(e[4], undefined);
    assert.match(validateLadder([row(5_00_000, 1), row(9_00_000, 10)]).rows[1].upTo!, /no upper limit/);
  });

  it('rates run 0–100 with two decimals and never go down', () => {
    const e = validateLadder([row(1_00_000, 101), row(2_00_000, 10.125), row(3_00_000, 20), row(null, 15)]).rows;
    assert.match(e[0].ratePercent!, /0 to 100/);
    assert.match(e[1].ratePercent!, /two decimals/);
    assert.match(e[3].ratePercent!, /never go down/);
    assert.ok(ladderIsValid(validateLadder([row(1_00_000, 0), row(null, 0)])), 'an exempt ladder is allowed');
  });

  it('a fixed amount is whole rupees, 0 or more', () => {
    const e = validateLadder([row(1_00_000, 1, -5), row(null, 10, 2.5)]).rows;
    assert.ok(e[0].fixedDeduction && e[1].fixedDeduction);
  });
});

describe('tax on a yearly income — the same as payroll (4.12)', () => {
  it('works out each band, the SSF exemption and the rebate', () => {
    const plain = ladderTax(INDIVIDUAL, 12_00_000);
    assert.deepEqual(plain.bands.map((b) => b.tax), [5_000, 20_000, 60_000, 60_000, 0, 0]);
    assert.equal(plain.total, 1_45_000);
    assert.equal(ladderTax(INDIVIDUAL, 12_00_000, { ssf: true }).total, 1_40_000, 'no 1% on the first band');
    const woman = ladderTax(INDIVIDUAL, 12_00_000, { rebatePercent: 10 });
    assert.equal(woman.beforeRebate, 1_45_000);
    assert.equal(woman.rebate, 14_500);
    assert.equal(woman.total, 1_30_500);
    assert.equal(ladderTax(INDIVIDUAL, 0).total, 0);
    assert.equal(ladderTax(INDIVIDUAL, -5).total, 0);
    assert.equal(ladderTax([], 10_00_000).total, 0);
  });

  it('a fixed amount never takes a band below zero', () => {
    assert.equal(ladderTax([row(1_00_000, 1, 5_000), row(null, 10)], 2_00_000).total, 10_000);
  });

  const control = { insuranceDiscounts: { womenDiscountPercent: 10, handicappedDiscountPercent: 0 } } as unknown as SystemControlData;
  const employee = (gender: 'Male' | 'Female'): EmployeeInput => ({ id: 'e', category: 'Permanent', gender, isDisabled: false, taxStatus: 'Normal Single', joiningDate: '2020-01-01' });
  const asSlabs = (rows: LadderRow[]): TaxSlabInput[] =>
    ladderBands(rows).map((b, i) => ({ id: String(i), category: 'Normal Single', amountFrom: String(b.from), amountTo: b.upTo === null ? null : String(b.upTo), ratePercent: String(b.ratePercent), fixedDeduction: String(b.fixedDeduction) }));

  it('matches calculateAnnualTaxFromSlabs for the saved bands', () => {
    const ladders = [INDIVIDUAL, [row(5_00_000, 1), row(7_00_000, 10, 2_500), row(null, 20, 12_500)], [row(null, 1)]];
    for (const ladder of ladders) {
      for (const income of [0, 3_50_000, 5_00_000, 6_43_210.55, 12_00_000, 75_00_000]) {
        for (const ssf of [false, true]) {
          for (const gender of ['Male', 'Female'] as const) {
            const payroll = calculateAnnualTaxFromSlabs(new Decimal(income), employee(gender), asSlabs(ladder), control, ssf).toDecimalPlaces(2).toNumber();
            const preview = ladderTax(ladder, income, { ssf, rebatePercent: gender === 'Female' ? 10 : 0 }).total;
            assert.equal(preview, payroll, `${JSON.stringify(ladder)} · ${income} · ssf ${ssf} · ${gender}`);
          }
        }
      }
    }
  });
});

describe('the change list shown before Save (4.12)', () => {
  it('says nothing when nothing changed', () => {
    assert.deepEqual(ladderChanges(INDIVIDUAL, INDIVIDUAL.map((r) => ({ ...r }))), []);
  });

  it('names each changed, added and removed band in words', () => {
    const next = [...INDIVIDUAL.slice(0, 1), row(7_00_000, 12), ...INDIVIDUAL.slice(2, 5), row(1_00_00_000, 39), row(null, 40)];
    assert.deepEqual(ladderChanges(INDIVIDUAL, next), [
      'Band 2: 5,00,000 – 7,00,000 at 10% → 5,00,000 – 7,00,000 at 12%',
      'Band 6: Above 50,00,000 at 39% → 50,00,000 – 1,00,00,000 at 39%',
      'Band 7 added: Above 1,00,00,000 at 40%',
    ]);
    assert.deepEqual(ladderChanges(next, INDIVIDUAL).slice(-1), ['Band 7 removed: Above 1,00,00,000 at 40%']);
  });

  it('a whole new ladder, and one removed', () => {
    assert.deepEqual(ladderChanges([], INDIVIDUAL), ['New ladder: 6 bands']);
    assert.deepEqual(ladderChanges(INDIVIDUAL, []), ['Ladder removed: the Individual ladder is used instead']);
  });
});

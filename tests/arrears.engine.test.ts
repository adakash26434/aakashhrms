import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arrearsForMonths, linesToSettle } from '../lib/engines/arrears.engine';

// Arrears (F7): per-month difference between what the revision in force says
// and what was paid, net of arrears already paid.

const m = (runId: string, periodEnd: string, paid: number, due: number, alreadyPaid = 0) => ({ runId, periodEnd, paid, due, alreadyPaid });

describe('arrears', () => {
  it('sums the monthly differences of a back-dated increase', () => {
    const r = arrearsForMonths([m('r2', '2026-09-15', 40000, 44000), m('r1', '2026-08-15', 40000, 44000)]);
    assert.deepEqual(r.lines.map((l) => l.runId), ['r1', 'r2']);
    assert.equal(r.net, 8000);
    assert.equal(r.payable, 8000);
  });

  it('months that already match produce nothing', () => {
    const r = arrearsForMonths([m('r1', '2026-08-15', 40000, 40000)]);
    assert.deepEqual(r, { lines: [], net: 0, payable: 0 });
  });

  it('arrears paid earlier are not paid twice', () => {
    const r = arrearsForMonths([m('r1', '2026-08-15', 40000, 44000, 4000)]);
    assert.equal(r.net, 0);
    assert.deepEqual(r.lines, []);
  });

  it('a correction after a part-payment pays only the rest', () => {
    const r = arrearsForMonths([m('r1', '2026-08-15', 40000, 46000, 4000)]);
    assert.equal(r.net, 2000);
  });

  it('a net reduction is shown but never paid or settled', () => {
    const r = arrearsForMonths([m('r1', '2026-08-15', 44000, 40000)]);
    assert.equal(r.net, -4000);
    assert.equal(r.payable, 0);
    assert.deepEqual(linesToSettle(r), []);
  });

  it('paisa arithmetic does not drift', () => {
    const r = arrearsForMonths([m('r1', '2026-08-15', 33333.33, 33333.34), m('r2', '2026-09-15', 0.1, 0.3)]);
    assert.equal(r.net, 0.21);
  });
});

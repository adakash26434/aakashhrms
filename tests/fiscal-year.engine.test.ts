import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REOPEN_REASON_MIN,
  cannotClose,
  cannotDelete,
  cannotMakeCurrent,
  cannotReopen,
  fiscalOpeningYearOf,
  fiscalYearDates,
  fiscalYearState,
  nextOpeningYear,
  openingYearOf,
  payMonthYearProblem,
  validateReopenReason,
  type FiscalYearFacts,
} from '../lib/engines/fiscal-year.engine';

// Fiscal years (4.12): made from the opening BS year, one current, closed after they end with
// their pay runs locked, reopened with a reason; a pay run belongs to the year its month falls in.

const facts = (over: Partial<FiscalYearFacts> = {}): FiscalYearFacts => ({
  status: 'Inactive',
  startAD: '2025-07-17',
  endAD: '2026-07-16',
  inUse: [],
  openRuns: 0,
  ...over,
});

describe('fiscal year dates (4.12)', () => {
  it('makes a year from its opening BS year: Shrawan 1 to the last day of Asar', () => {
    assert.deepEqual(fiscalYearDates(2083), {
      label: 'FY 2083/84',
      slug: 'fy-2083-84',
      startBS: '2083-04-01',
      endBS: '2084-03-32',
      startAD: '2026-07-17',
      endAD: '2027-07-16',
      fromMonth: 4,
      toMonth: 3,
    });
    // Asar has 31 or 32 days; the year ends on whichever is its last.
    assert.equal(fiscalYearDates(2084)?.endBS, '2085-03-31');
    assert.equal(fiscalYearDates(2084)?.endAD, '2028-07-14');
  });

  it('labels by the BS years (never the AD ones) and years follow on without a gap', () => {
    for (let y = 2078; y <= 2086; y++) {
      const fy = fiscalYearDates(y)!;
      assert.equal(fy.label, `FY ${y}/${String(y + 1).slice(-2)}`);
      assert.equal(fy.startBS, `${y}-04-01`);
      const next = fiscalYearDates(y + 1)!;
      const dayAfter = new Date(`${fy.endAD}T00:00:00Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      assert.equal(dayAfter.toISOString().slice(0, 10), next.startAD, `${fy.label} → ${next.label}`);
    }
  });

  it('refuses years outside the calendar the app carries', () => {
    for (const bad of [1999, 2099, 2083.5, Number.NaN]) assert.equal(fiscalYearDates(bad), null, String(bad));
  });

  it('a month belongs to the year Shrawan opens', () => {
    assert.equal(fiscalOpeningYearOf(2083, 3), 2082, 'Asar 2083 ends FY 2082/83');
    assert.equal(fiscalOpeningYearOf(2083, 4), 2083, 'Shrawan 2083 opens FY 2083/84');
    assert.equal(fiscalOpeningYearOf(2084, 1), 2083, 'Baisakh 2084 is in FY 2083/84');
    assert.equal(fiscalOpeningYearOf(2083, 12), 2083);
  });

  it('offers the year after the newest, else the one holding today', () => {
    assert.equal(nextOpeningYear([{ startDateBS: '2082-04-01' }, { startDateBS: '2083-04-01' }], { year: 2083, month: 6 }), 2084);
    assert.equal(nextOpeningYear([], { year: 2083, month: 6 }), 2083);
    assert.equal(nextOpeningYear([], { year: 2083, month: 2 }), 2082);
    assert.equal(openingYearOf({ startDateBS: '2083-04-01' }), 2083);
    assert.equal(openingYearOf({ startDateBS: '' }), null);
  });
});

describe('fiscal year life cycle (4.12, S49)', () => {
  const today = '2026-10-10';

  it('states: current, closed, upcoming and past', () => {
    assert.equal(fiscalYearState({ status: 'Active', startAD: '2026-07-17', endAD: '2027-07-16' }, today), 'current');
    assert.equal(fiscalYearState({ status: 'Locked', startAD: '2025-07-17', endAD: '2026-07-16' }, today), 'closed');
    assert.equal(fiscalYearState({ status: 'Inactive', startAD: '2027-07-17', endAD: '2028-07-14' }, today), 'upcoming');
    assert.equal(fiscalYearState({ status: 'Inactive', startAD: '2025-07-17', endAD: '2026-07-16' }, today), 'past');
  });

  it('only an open year is made current — never a closed one', () => {
    assert.equal(cannotMakeCurrent({ status: 'Inactive' }), null);
    assert.match(cannotMakeCurrent({ status: 'Active' })!, /already the current/);
    assert.match(cannotMakeCurrent({ status: 'Locked' })!, /Reopen it first/);
  });

  it('a year is closed after it ends, never the current one, never with pay runs open', () => {
    assert.equal(cannotClose(facts(), today), null);
    assert.match(cannotClose(facts({ status: 'Active' }), today)!, /current year can't be closed/);
    assert.match(cannotClose(facts({ status: 'Locked' }), today)!, /already closed/);
    assert.match(cannotClose(facts({ startAD: '2026-07-17', endAD: '2027-07-16' }), today)!, /after it ends/);
    assert.match(cannotClose(facts({ endAD: today }), today)!, /after it ends/, 'its last day is still in it');
    assert.equal(cannotClose(facts({ openRuns: 1 }), today), '1 pay run of this year is not locked yet. Lock or delete it first.');
    assert.equal(cannotClose(facts({ openRuns: 2 }), today), '2 pay runs of this year are not locked yet. Lock or delete them first.');
  });

  it('only a closed year is reopened, with a reason', () => {
    assert.equal(cannotReopen({ status: 'Locked' }), null);
    assert.ok(cannotReopen({ status: 'Inactive' }));
    assert.ok(cannotReopen({ status: 'Active' }));
    assert.ok(validateReopenReason('x'.repeat(REOPEN_REASON_MIN - 1)));
    assert.ok(validateReopenReason(`   ${'x'.repeat(REOPEN_REASON_MIN - 1)}   `), 'spaces do not count');
    assert.equal(validateReopenReason('IRD notice changed the slabs'), null);
    assert.ok(validateReopenReason('x'.repeat(501)));
  });

  it('only a year nothing uses is deleted', () => {
    assert.equal(cannotDelete(facts()), null);
    assert.ok(cannotDelete(facts({ status: 'Active' })));
    assert.ok(cannotDelete(facts({ status: 'Locked' })));
    assert.equal(cannotDelete(facts({ inUse: ['3 pay runs', '12 leave ledger lines'] })), 'This year is in use (3 pay runs, 12 leave ledger lines), so it stays.');
  });
});

describe('the fiscal year of a pay month (4.12, S49)', () => {
  const open = { label: 'FY 2082/83', status: 'Inactive', hasTaxSlabs: true };

  it('pays a month in its own year, open or current, with its tax slabs', () => {
    assert.equal(payMonthYearProblem(open, 2083, 3), null);
    assert.equal(payMonthYearProblem({ ...open, status: 'Active' }, 2083, 3), null);
  });

  it('names the year to add when none covers the month', () => {
    assert.equal(payMonthYearProblem(null, 2084, 3), 'No fiscal year covers Asar 2084. Add FY 2083/84 under Setup → Fiscal years first.');
    assert.match(payMonthYearProblem(null, 2084, 4)!, /Shrawan 2084\. Add FY 2084\/85/);
  });

  it('refuses a closed year and a year without its tax slabs (a run would withhold no tax)', () => {
    assert.equal(payMonthYearProblem({ ...open, status: 'Locked' }, 2083, 3), 'FY 2082/83 is closed. Reopen it under Setup → Fiscal years to pay Asar 2083.');
    assert.equal(payMonthYearProblem({ ...open, hasTaxSlabs: false }, 2083, 3), 'FY 2082/83 has no tax slabs yet. Set its Individual ladder under Setup → Tax slabs before paying Asar 2083.');
  });
});

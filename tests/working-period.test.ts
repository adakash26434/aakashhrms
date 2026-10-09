import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWorkingPeriod, parseWorkingPeriod, shiftWorkingPeriod, workingPeriodLabel } from '../lib/utils/working-period-pref';

// E1 (4.8b-3): the title bar's working period, kept in a cookie the server validates.

describe('Working period (E1)', () => {
  it('round-trips through the cookie value', () => {
    assert.equal(formatWorkingPeriod({ calendar: 'BS', year: 2083, month: 6 }), 'BS:2083-06');
    assert.deepEqual(parseWorkingPeriod('BS:2083-06', 'BS'), { calendar: 'BS', year: 2083, month: 6 });
    assert.deepEqual(parseWorkingPeriod('AD:2026-10', 'AD'), { calendar: 'AD', year: 2026, month: 10 });
  });

  it('ignores a malformed value, a month out of range, or a period of the other calendar', () => {
    assert.equal(parseWorkingPeriod('2083-06', 'BS'), null);
    assert.equal(parseWorkingPeriod('BS:2083-13', 'BS'), null);
    assert.equal(parseWorkingPeriod('BS:2083-06', 'AD'), null);
    assert.equal(parseWorkingPeriod('BS:2083-06; path=/', 'BS'), null);
    assert.equal(parseWorkingPeriod(undefined, 'BS'), null);
  });

  it('shifts across the year boundary and labels the month', () => {
    assert.deepEqual(shiftWorkingPeriod({ calendar: 'BS', year: 2083, month: 12 }, 1), { calendar: 'BS', year: 2084, month: 1 });
    assert.deepEqual(shiftWorkingPeriod({ calendar: 'AD', year: 2026, month: 1 }, -1), { calendar: 'AD', year: 2025, month: 12 });
    assert.equal(workingPeriodLabel({ calendar: 'BS', year: 2083, month: 6 }), 'Aswin 2083');
    assert.equal(workingPeriodLabel({ calendar: 'AD', year: 2026, month: 10 }), 'October 2026');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, datesIn, periodContaining, periodFor, shiftPeriod, weekdayOf } from '../lib/engines/pay-period.engine';

describe('Attendance months: BS and AD', () => {
  it('AD months have 28–31 days', () => {
    assert.equal(periodFor('AD', 2026, 2).days, 28);
    assert.equal(periodFor('AD', 2028, 2).days, 29);
    assert.equal(periodFor('AD', 2026, 9).days, 30);
    const oct = periodFor('AD', 2026, 10);
    assert.deepEqual([oct.start, oct.end, oct.days, oct.label], ['2026-10-01', '2026-10-31', 31, 'October 2026']);
  });

  it('BS months have 29–32 days and start / end on the right AD dates', () => {
    for (let m = 1; m <= 12; m++) {
      const p = periodFor('BS', 2083, m);
      assert.ok(p.days >= 29 && p.days <= 32, `${p.label} has ${p.days} days`);
      assert.equal(datesIn(p).length, p.days);
      assert.equal(addDays(p.end, 1), periodFor('BS', m === 12 ? 2084 : 2083, m === 12 ? 1 : m + 1).start, `${p.label} runs into the next month`);
    }
    // Today in the app: 18 Aswin 2083 = 4 Oct 2026.
    const aswin = periodContaining('BS', '2026-10-04');
    assert.equal(aswin.label, 'Aswin 2083');
    assert.ok(aswin.start <= '2026-10-04' && aswin.end >= '2026-10-04');
  });

  it('a BS month can cross the AD year end (Poush)', () => {
    const poush = periodFor('BS', 2083, 9);
    assert.ok(poush.start.startsWith('2026-12'));
    assert.ok(poush.end.startsWith('2027-01'));
  });

  it('months step forward and back across years', () => {
    assert.deepEqual([shiftPeriod(periodFor('BS', 2083, 12), 1).year, shiftPeriod(periodFor('BS', 2083, 12), 1).month], [2084, 1]);
    assert.equal(shiftPeriod(periodFor('AD', 2026, 1), -1).label, 'December 2025');
  });

  it('weekdays come from the AD date', () => {
    assert.equal(weekdayOf('2026-10-04'), 0); // Sunday
    assert.equal(weekdayOf('2026-10-03'), 6); // Saturday
  });
});

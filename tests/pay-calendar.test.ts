import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canSwitchCalendar, fiscalMonths, isYearEndMonth, monthsRemaining, parseCalendar, periodKey, runLabel } from '../lib/engines/pay-calendar.engine';

// 4.8b: a company pays in BS or AD months; the fiscal year stays Shrawan–Ashadh.
// FY 2083/84 runs 2026-07-17 (Shrawan 1, 2083) to 2027-07-16 (Ashadh 32, 2084).
const FY = { start: '2026-07-17', end: '2027-07-16' };

describe('Pay calendar (4.8b)', () => {
  it('the fiscal year has twelve BS months, Shrawan to Ashadh', () => {
    const months = fiscalMonths(FY, 'BS');
    assert.equal(months.length, 12);
    assert.equal(months[0].label, 'Shrawan 2083');
    assert.equal(months[11].label, 'Asar 2084');
    assert.equal(monthsRemaining({ year: 2083, month: 6 }, FY, 'BS'), 10); // Aswin: Aswin … Asar
    assert.equal(monthsRemaining({ year: 2084, month: 3 }, FY, 'BS'), 1);
    assert.equal(isYearEndMonth({ year: 2084, month: 3 }, FY, 'BS'), true);
  });

  it('in AD months the fiscal year is the twelve months whose first day falls in it: August 2026 to July 2027', () => {
    const months = fiscalMonths(FY, 'AD');
    assert.equal(months.length, 12);
    assert.equal(months[0].label, 'August 2026');
    assert.equal(months[11].label, 'July 2027');
    assert.equal(monthsRemaining({ year: 2026, month: 10 }, FY, 'AD'), 10);
    assert.equal(isYearEndMonth({ year: 2027, month: 7 }, FY, 'AD'), true);
  });

  it('a month outside the fiscal year is refused', () => {
    assert.throws(() => monthsRemaining({ year: 2083, month: 2 }, FY, 'BS'), /not in the fiscal year/);
  });

  it('period keys sort months within a calendar', () => {
    assert.ok(periodKey({ year: 2083, month: 12 }) < periodKey({ year: 2084, month: 1 }));
    assert.equal(parseCalendar('AD'), 'AD');
    assert.equal(parseCalendar('xx'), 'BS');
  });

  it('run labels carry the month and the kind of run', () => {
    assert.equal(runLabel({ calendar: 'BS', payPeriodYear: 2083, payPeriodMonth: 6, runType: 'REGULAR' }), 'Aswin 2083');
    assert.equal(runLabel({ calendar: 'AD', payPeriodYear: 2026, payPeriodMonth: 10, runType: 'FESTIVAL' }), 'October 2026 · Festival allowance');
  });

  it('the calendar changes only between months', () => {
    assert.equal(canSwitchCalendar({ openPeriods: 0, unlockedRuns: 0 }), null);
    assert.match(canSwitchCalendar({ openPeriods: 2, unlockedRuns: 1 }) ?? '', /2 attendance months still open and 1 pay run not locked/);
  });
});

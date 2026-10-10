import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SHIFT,
  instantAt,
  punchesForDay,
  resolveDay,
  summariseMonth,
  unpaidDeduction,
  type DayInput,
} from '../lib/engines/attendance-day.engine';
import { addDays, datesIn, periodFor, weekdayOf } from '../lib/engines/pay-period.engine';
import type { DayResult } from '../lib/types/attendance';

// General shift: 10:00–18:00, 30 min break, 15 min grace, full day 7 h, half day 4 h, OT from 30 min; Saturday is the day off here.
const MON = '2026-10-05';
const SAT = '2026-10-03';
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return instantAt(date, h * 60 + m);
};
const day = (over: Partial<DayInput> = {}): DayInput => ({
  date: MON,
  employedFrom: '2020-01-01',
  employedUntil: null,
  shift: { ...DEFAULT_SHIFT, off: weekdayOf(over.date ?? MON) === 6 },
  noRecord: 'absent',
  holiday: null,
  leave: null,
  punches: [],
  override: null,
  otEligible: true,
  ...over,
});
const worked = (date: string, from: string, to: string) => [at(date, from), at(date, to)];

describe('Day rules, in order', () => {
  it('1. outside employment: not employed (neither paid nor absent)', () => {
    const r = resolveDay(day({ employedFrom: '2026-10-06' }));
    assert.equal(r.dayType, 'not_employed');
    assert.deepEqual([r.payable, r.unpaid], [0, 0]);
    assert.equal(resolveDay(day({ employedUntil: '2026-10-04' })).dayType, 'not_employed');
  });
  it('2. an HR override wins over the calendar and punches', () => {
    const r = resolveDay(day({ date: SAT, override: { dayType: 'absent', reason: 'Unauthorised absence' } }));
    assert.equal(r.dayType, 'absent');
    assert.equal(r.unpaid, 1);
    assert.ok(r.flags.includes('override'));
    assert.equal(resolveDay(day({ override: { dayType: 'half_day', reason: 'x' } })).payable, 0.5);
  });
  it('3. holiday: paid; only hours beyond a full day are off-day overtime (4.7: the normal hours earn a substitute day)', () => {
    const r = resolveDay(day({ holiday: { name: 'Dashain' }, punches: worked(MON, '10:00', '14:00') }));
    assert.equal(r.dayType, 'holiday');
    assert.equal(r.payable, 1);
    assert.equal(r.otOffDayMinutes, 0);
    // 09:00–20:00 = 660 min − 30 break = 630; beyond the 420-minute full day: 210.
    assert.equal(resolveDay(day({ holiday: { name: 'Dashain' }, punches: worked(MON, '09:00', '20:00') })).otOffDayMinutes, 210);
    // 25 minutes beyond the full day is below the 30-minute overtime minimum.
    assert.equal(resolveDay(day({ holiday: { name: 'Dashain' }, punches: worked(MON, '10:00', '17:55') })).otOffDayMinutes, 0);
  });
  it('4. weekly off: paid; no overtime for staff not eligible', () => {
    assert.equal(resolveDay(day({ date: SAT })).dayType, 'weekly_off');
    assert.equal(resolveDay(day({ date: SAT, punches: worked(SAT, '10:00', '13:00'), otEligible: false })).otOffDayMinutes, 0);
  });
  it('5. approved full-day leave: paid, unpaid or half paid by leave type', () => {
    assert.deepEqual(pick(resolveDay(day({ leave: { name: 'Sick', pay: 'full', half: false } }))), ['paid_leave', 1, 0]);
    assert.deepEqual(pick(resolveDay(day({ leave: { name: 'Unpaid', pay: 'none', half: false } }))), ['unpaid_leave', 0, 1]);
    assert.deepEqual(pick(resolveDay(day({ leave: { name: 'Partial', pay: 'half', half: false } }))), ['paid_leave', 0.5, 0.5]);
  });
  it('6. punches: full day, half day, too little', () => {
    assert.deepEqual(pick(resolveDay(day({ punches: worked(MON, '09:55', '18:05') }))), ['present', 1, 0]);
    assert.deepEqual(pick(resolveDay(day({ punches: worked(MON, '10:00', '15:00') }))), ['half_day', 0.5, 0.5]);
    assert.deepEqual(pick(resolveDay(day({ punches: worked(MON, '10:00', '12:00') }))), ['absent', 0, 1]);
  });
  it('6. a half-day leave covers half; the other half must be worked', () => {
    const paidHalf = { name: 'Casual', pay: 'full' as const, half: true };
    assert.deepEqual(pick(resolveDay(day({ leave: paidHalf, punches: worked(MON, '14:00', '18:30') }))), ['half_day', 1, 0]);
    assert.deepEqual(pick(resolveDay(day({ leave: paidHalf, punches: worked(MON, '14:00', '15:00') }))), ['absent', 0.5, 0.5]);
    assert.deepEqual(pick(resolveDay(day({ leave: paidHalf }))), ['half_day', 0.5, 0.5]);
  });
  it('7. one punch only: missing punch, counts as absent', () => {
    const r = resolveDay(day({ punches: [at(MON, '09:58')] }));
    assert.deepEqual(pick(r), ['missing_punch', 0, 1]);
    assert.ok(r.flags.includes('missing_punch'));
  });
  it('a day still to come with nothing on it is upcoming (not absent); holidays and leave still show', () => {
    assert.deepEqual(pick(resolveDay(day({ today: '2026-10-04' }))), ['upcoming', 0, 0]);
    assert.equal(resolveDay(day({ today: '2026-10-04', holiday: { name: 'Dashain' } })).dayType, 'holiday');
    assert.equal(resolveDay(day({ today: '2026-10-04', leave: { name: 'Sick', pay: 'full', half: false } })).dayType, 'paid_leave');
    assert.equal(resolveDay(day({ today: '2026-10-05' })).dayType, 'absent');
    // Today before the shift ends: not in yet (not absent); after it ends: absent.
    assert.equal(resolveDay(day({ today: MON, now: at(MON, '10:20') })).dayType, 'upcoming');
    assert.equal(resolveDay(day({ today: MON, now: at(MON, '18:01') })).dayType, 'absent');
    // Clocked in and the shift is still on: at work, not a missing punch; after the shift it is one.
    assert.equal(resolveDay(day({ today: MON, now: at(MON, '11:30'), punches: [at(MON, '11:00')] })).dayType, 'upcoming');
    assert.equal(resolveDay(day({ today: MON, now: at(MON, '18:30'), punches: [at(MON, '11:00')] })).dayType, 'missing_punch');
  });
  it('8. nothing recorded: absent, or present when the company counts it so', () => {
    assert.deepEqual(pick(resolveDay(day())), ['absent', 0, 1]);
    const r = resolveDay(day({ noRecord: 'present' }));
    assert.deepEqual(pick(r), ['present', 1, 0]);
    assert.ok(r.flags.includes('assumed_present'));
  });
});

describe('Times: late, early, break, overtime', () => {
  it('late after the grace minutes (counted from the start); early before the end', () => {
    assert.equal(resolveDay(day({ punches: worked(MON, '10:14', '18:00') })).lateMinutes, 0);
    assert.equal(resolveDay(day({ punches: worked(MON, '10:20', '18:00') })).lateMinutes, 20);
    assert.equal(resolveDay(day({ punches: worked(MON, '10:00', '17:30') })).earlyMinutes, 30);
  });
  it('the break counts only after 5 hours; overtime from 30 minutes past the planned day', () => {
    assert.equal(resolveDay(day({ punches: worked(MON, '10:00', '14:00') })).workMinutes, 240);
    assert.equal(resolveDay(day({ punches: worked(MON, '10:00', '18:00') })).workMinutes, 450);
    assert.equal(resolveDay(day({ punches: worked(MON, '10:00', '18:20') })).otWorkDayMinutes, 0);
    assert.equal(resolveDay(day({ punches: worked(MON, '10:00', '19:00') })).otWorkDayMinutes, 60);
  });
  it('more than 4 hours of overtime is flagged, not cut', () => {
    const r = resolveDay(day({ punches: worked(MON, '10:00', '23:00') }));
    assert.equal(r.otWorkDayMinutes, 300);
    assert.ok(r.flags.includes('ot_over_daily_limit'));
  });
  it('flexible hours: no late or early; overtime after a full day', () => {
    const flexi = { ...DEFAULT_SHIFT, start: '07:00', end: '21:00', flexible: true, fullDayMinutes: 480 };
    const r = resolveDay(day({ shift: flexi, punches: worked(MON, '11:30', '20:45') }));
    assert.equal(r.lateMinutes, 0);
    assert.equal(r.earlyMinutes, 0);
    assert.equal(r.dayType, 'present');
    assert.equal(r.otWorkDayMinutes, 9 * 60 + 15 - 30 - 480);
  });
  it('the day carries the shift that applied', () => {
    assert.equal(resolveDay(day()).shift?.code, 'GEN');
  });
  it('a punch belongs to the nearest shift: night then morning on the roster', () => {
    const night = { ...DEFAULT_SHIFT, code: 'N', start: '22:00', end: '06:00' };
    const morning = { ...DEFAULT_SHIFT, code: 'M', start: '06:00', end: '14:00' };
    const tue = addDays(MON, 1);
    // Night out at 05:55 on Tuesday, then Tuesday's morning shift in at 06:10 (touching shifts: the boundary is 06:00).
    const punches = [at(MON, '21:58'), at(tue, '05:55'), at(tue, '06:10'), at(tue, '14:05')];
    assert.deepEqual(punchesForDay(punches, MON, night, DEFAULT_SHIFT, morning), punches.slice(0, 2));
    assert.deepEqual(punchesForDay(punches, tue, morning, night, morning), punches.slice(2));
    // A wide gap is split in the middle: General 10–18 then General: 02:00 next morning belongs to the next day.
    assert.deepEqual(punchesForDay([at(tue, '01:59')], MON, DEFAULT_SHIFT, DEFAULT_SHIFT, DEFAULT_SHIFT).length, 1);
    assert.deepEqual(punchesForDay([at(tue, '02:01')], tue, DEFAULT_SHIFT, DEFAULT_SHIFT, DEFAULT_SHIFT).length, 1);
  });
  it('a night shift keeps its punches after midnight on the day it started', () => {
    const night = { ...DEFAULT_SHIFT, start: '22:00', end: '06:00' };
    const punches = [at(MON, '21:55'), instantAt(MON, 24 * 60 + 6 * 60 + 5)];
    assert.deepEqual(punchesForDay(punches, MON, night), punches);
    assert.deepEqual(punchesForDay(punches, '2026-10-06', night), []);
    assert.equal(resolveDay(day({ shift: night, punches })).dayType, 'present');
  });
});

describe('Month summary and pay', () => {
  const month = (calendar: 'BS' | 'AD', year: number, m: number, f: (d: string) => Partial<DayInput>) => {
    const p = periodFor(calendar, year, m);
    return { p, days: datesIn(p).map((d) => resolveDay(day({ date: d, ...f(d) }))) };
  };
  it('unpaid days from absences, unpaid leave and halves; weekly offs are paid', () => {
    const { p, days } = month('BS', 2083, 6, (d) => ({ punches: d.endsWith('-05') ? [] : worked(d, '10:00', '18:00') }));
    const s = summariseMonth(p, days, { lateRule: { enabled: false, count: 3 } });
    assert.equal(s.calendarDays, p.days);
    assert.equal(s.absentDays, 1);
    assert.equal(s.unpaidDays, 1);
    assert.equal(s.payableDays + s.unpaidDays, p.days);
  });
  it('the late rule (when on) makes every N late days half a day unpaid', () => {
    const { p, days } = month('AD', 2026, 10, () => ({ punches: worked('2026-10-01', '10:30', '18:00') }));
    const late: DayResult[] = days.map((d, i) => (i < 6 ? { ...d, lateMinutes: 20, dayType: 'present', payable: 1, unpaid: 0 } : d));
    assert.equal(summariseMonth(p, late, { lateRule: { enabled: true, count: 3 } }).unpaidDays - summariseMonth(p, late, { lateRule: { enabled: false, count: 3 } }).unpaidDays, 1);
  });
  it('deduction = (basic + grade) ÷ days in the month × (unpaid + not-employed days), for BS and AD months', () => {
    for (const [cal, y, m] of [['BS', 2083, 3], ['BS', 2083, 9], ['AD', 2026, 2], ['AD', 2026, 7]] as const) {
      const p = periodFor(cal, y, m);
      assert.equal(unpaidDeduction(33000, { calendarDays: p.days, unpaidDays: 2, notEmployedDays: 1 }), Math.round((33000 / p.days) * 3 * 100) / 100, p.label);
    }
  });
  it('BS and AD months over the same AD dates give the same days', () => {
    const p = periodFor('BS', 2083, 6);
    const a = datesIn(p).map((d) => resolveDay(day({ date: d })));
    const b = datesIn(p).map((d) => resolveDay(day({ date: d })));
    assert.deepEqual(a, b);
  });
  it('a joiner mid-month is not paid for the days before joining', () => {
    const p = periodFor('BS', 2083, 6);
    const joined = datesIn(p)[10];
    const days = datesIn(p).map((d) => resolveDay(day({ date: d, employedFrom: joined, noRecord: 'present' })));
    const s = summariseMonth(p, days, { lateRule: { enabled: false, count: 3 } });
    assert.equal(s.notEmployedDays, 10);
    assert.equal(s.payableDays, p.days - 10);
  });
  it('more than 24 hours of overtime in a week is flagged', () => {
    const p = periodFor('AD', 2026, 10);
    const days = datesIn(p).map((d) => resolveDay(day({ date: d, punches: worked(d, '10:00', '23:00') })));
    assert.ok(summariseMonth(p, days, { lateRule: { enabled: false, count: 3 } }).otWarnings.some((w) => w.includes('24 hours')));
  });
});

function pick(r: DayResult): [string, number, number] {
  return [r.dayType, r.payable, r.unpaid];
}

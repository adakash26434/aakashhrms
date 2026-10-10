import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHIFT, instantAt, resolveDay, summariseMonth, type DayInput } from '../lib/engines/attendance-day.engine';
import { addDays, datesIn, periodFor } from '../lib/engines/pay-period.engine';
import {
  daysText,
  describeShiftAllowance,
  shiftAllowanceDays,
  shiftAllowanceLines,
  shiftAllowanceTotal,
  shiftPayOf,
  workedPart,
  type ShiftPay,
} from '../lib/engines/shift-allowance.engine';
import { parseShift } from '../lib/engines/shift.engine';
import type { DayResult, ShiftRule } from '../lib/types/attendance';

// Shift allowance (4.12e): a shift may pay an allowance for each day worked on it. A full day or a
// day on duty counts 1, a half day ½ (a half-day leave takes its half), leave and absence nothing;
// work on a holiday or weekly off counts by its hours. The month is days × rate per shift, to the
// paisa; summariseMonth counts it for the attendance month that payroll reads.

const NIGHT: ShiftPay = { code: 'N1', name: 'Night', rate: 300, fullDayMinutes: 420, halfDayMinutes: 240 };
const PAY = new Map([['n1', NIGHT]]);

const result = (over: Partial<DayResult> = {}): DayResult => ({
  date: '2026-10-05',
  dayType: 'present',
  payable: 1,
  unpaid: 0,
  firstIn: null,
  lastOut: null,
  workMinutes: 450,
  lateMinutes: 0,
  earlyMinutes: 0,
  otWorkDayMinutes: 0,
  otOffDayMinutes: 0,
  leaveDays: 0,
  leavePaidDays: 0,
  rule: '',
  flags: [],
  shift: { id: 'n1', code: 'N1', name: 'Night', start: '22:00', end: '06:00', season: null },
  ...over,
});

describe('a day worked on its shift (4.12e)', () => {
  it('a full day or on duty 1, a half day ½; leave, absence and a missing punch nothing', () => {
    assert.equal(workedPart(result(), NIGHT), 1);
    assert.equal(workedPart(result({ dayType: 'on_duty' }), NIGHT), 1);
    assert.equal(workedPart(result({ dayType: 'half_day', payable: 0.5, unpaid: 0.5 }), NIGHT), 0.5);
    for (const dayType of ['paid_leave', 'unpaid_leave', 'absent', 'missing_punch', 'not_employed', 'upcoming'] as const) {
      assert.equal(workedPart(result({ dayType, payable: dayType === 'paid_leave' ? 1 : 0 }), NIGHT), 0, dayType);
    }
  });

  it('a half-day leave takes its half, paid or not', () => {
    // Worked the other half: payable = ½ worked + the paid part of the leave.
    assert.equal(workedPart(result({ dayType: 'half_day', payable: 1, leaveDays: 0.5, leavePaidDays: 0.5 }), NIGHT), 0.5);
    assert.equal(workedPart(result({ dayType: 'half_day', payable: 0.5, leaveDays: 0.5, leavePaidDays: 0 }), NIGHT), 0.5);
    assert.equal(workedPart(result({ dayType: 'half_day', payable: 0.75, leaveDays: 0.5, leavePaidDays: 0.25 }), NIGHT), 0.5);
    // Nothing recorded for the other half: only the leave is paid.
    assert.equal(workedPart(result({ dayType: 'half_day', payable: 0.5, leaveDays: 0.5, leavePaidDays: 0.5, workMinutes: 0 }), NIGHT), 0);
  });

  it('work on a holiday or weekly off counts by its hours', () => {
    assert.equal(workedPart(result({ dayType: 'holiday', workMinutes: 420 }), NIGHT), 1);
    assert.equal(workedPart(result({ dayType: 'weekly_off', workMinutes: 300 }), NIGHT), 0.5);
    assert.equal(workedPart(result({ dayType: 'weekly_off', workMinutes: 239 }), NIGHT), 0);
    assert.equal(workedPart(result({ dayType: 'holiday', workMinutes: 0 }), NIGHT), 0);
  });
});

describe('the month (4.12e)', () => {
  it('only shifts with an allowance count (archived ones too)', () => {
    const pay = shiftPayOf([
      { id: 'gen', code: 'GEN', name: 'General', allowancePerDay: 0, fullDayMinutes: 420, halfDayMinutes: 210 },
      { id: 'n1', code: 'N1', name: 'Night', allowancePerDay: 300, fullDayMinutes: 420, halfDayMinutes: 240 },
    ]);
    assert.deepEqual([...pay.keys()], ['n1']);
    assert.deepEqual(pay.get('n1'), NIGHT);
  });

  it('one line per shift: days × rate to the paisa, half up; days on other shifts or none left out', () => {
    const odd: ShiftPay = { ...NIGHT, code: 'E2', name: 'Evening', rate: 333.33 };
    const days = [
      ...Array.from({ length: 12 }, () => result()),
      result({ dayType: 'half_day', payable: 0.5 }),
      result({ shift: { id: 'e2', code: 'E2', name: 'Evening', start: '14:00', end: '22:00', season: null } }),
      result({ shift: { id: 'gen', code: 'GEN', name: 'General', start: '10:00', end: '18:00', season: null } }),
      result({ shift: null }),
      result({ dayType: 'absent', payable: 0 }),
    ];
    const lines = shiftAllowanceLines(days, new Map([...PAY, ['e2', odd]]));
    assert.deepEqual(lines, [
      { shiftId: 'e2', code: 'E2', name: 'Evening', days: 1, rate: 333.33, amount: 333.33 },
      { shiftId: 'n1', code: 'N1', name: 'Night', days: 12.5, rate: 300, amount: 3750 },
    ]);
    assert.equal(shiftAllowanceTotal(lines), 4083.33);
    assert.equal(shiftAllowanceDays(lines), 13.5);
    // 12½ days × 333.33 = 4,166.625: half a paisa rounds up.
    const evening = { id: 'e2', code: 'E2', name: 'Evening', start: '14:00', end: '22:00', season: null };
    const twelveAndHalf = [...Array.from({ length: 12 }, () => result({ shift: evening })), result({ dayType: 'half_day', payable: 0.5, shift: evening })];
    assert.equal(shiftAllowanceLines(twelveAndHalf, new Map([['e2', odd]]))[0].amount, 4166.63);
    assert.deepEqual(shiftAllowanceLines(days, new Map()), []);
    assert.equal(shiftAllowanceTotal(undefined), 0, 'a summary stored before 4.12e');
  });

  it('in words', () => {
    assert.deepEqual([daysText(0), daysText(0.5), daysText(1), daysText(1.5), daysText(12)], ['0 days', '½ day', '1 day', '1½ days', '12 days']);
    assert.equal(describeShiftAllowance([{ shiftId: 'n1', code: 'N1', name: 'Night', days: 12.5, rate: 300, amount: 3750 }]), 'N1 12½ days × NPR 300 = NPR 3,750');
    assert.equal(describeShiftAllowance([]), 'No shift allowance');
  });

  it('summariseMonth counts the nights worked on a night shift (punches after midnight belong to the night)', () => {
    const night: ShiftRule = { ...DEFAULT_SHIFT, id: 'n1', code: 'N1', name: 'Night', start: '22:00', end: '06:00', fullDayMinutes: 420, halfDayMinutes: 240, off: false };
    const p = periodFor('BS', 2083, 6);
    const days = datesIn(p).map((date, i): DayResult => {
      const input: DayInput = {
        date,
        employedFrom: '2020-01-01',
        employedUntil: null,
        shift: night,
        noRecord: 'absent',
        holiday: null,
        leave: null,
        // Ten nights worked 22:00–06:00, then nothing.
        punches: i < 10 ? [instantAt(date, 22 * 60), instantAt(addDays(date, 1), 6 * 60)] : [],
        override: null,
        otEligible: true,
      };
      return resolveDay(input);
    });
    assert.equal(days.filter((d) => d.dayType === 'present').length, 10);
    const s = summariseMonth(p, days, { lateRule: { enabled: false, count: 3 } }, PAY);
    assert.deepEqual(s.shiftAllowance, [{ shiftId: 'n1', code: 'N1', name: 'Night', days: 10, rate: 300, amount: 3000 }]);
    assert.deepEqual(summariseMonth(p, days, { lateRule: { enabled: false, count: 3 } }).shiftAllowance, [], 'no shift with an allowance');
  });
});

describe('setting the allowance on a shift (4.12e)', () => {
  const base = { code: 'N1', name: 'Night', kind: 'fixed', start: '22:00', end: '06:00', breakMinutes: 30, graceMinutes: 15, fullDayMinutes: 420, halfDayMinutes: 240, otMinimumMinutes: 30, week: [], seasons: [] };
  it('an amount from 0 to 1,00,000 with two decimals; missing is none', () => {
    assert.equal(parseShift({ ...base, week: Array.from({ length: 7 }, () => ({ working: true })), allowancePerDay: '300.5' }).value?.allowancePerDay, 300.5);
    assert.equal(parseShift({ ...base, week: Array.from({ length: 7 }, () => ({ working: true })) }).value?.allowancePerDay, 0);
    assert.equal(parseShift({ ...base, allowancePerDay: -1 }).errors.allowancePerDay, 'An amount from 0 (none) to 1,00,000');
    assert.equal(parseShift({ ...base, allowancePerDay: 100001 }).errors.allowancePerDay, 'An amount from 0 (none) to 1,00,000');
    assert.equal(parseShift({ ...base, allowancePerDay: 'lots' }).errors.allowancePerDay, 'An amount from 0 (none) to 1,00,000');
    assert.equal(parseShift({ ...base, allowancePerDay: 10.555 }).errors.allowancePerDay, 'At most two decimals');
  });
});

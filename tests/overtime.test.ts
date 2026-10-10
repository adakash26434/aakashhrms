import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Decimal from 'decimal.js';
import {
  LAWFUL_OVERTIME,
  OT_LEGAL,
  decidable,
  describeDetail,
  describeRates,
  describeRounding,
  hourlyRate,
  lawful,
  limitBreaches,
  monthOvertime,
  normalizePolicy,
  otDetail,
  otPay,
  payableMinutes,
  roundMinutes,
  seedPolicy,
  validatePolicy,
} from '../lib/engines/overtime.engine';
import { OT_DAILY_LIMIT_MINUTES, OT_WEEKLY_LIMIT_MINUTES } from '../lib/engines/attendance-day.engine';
import type { OvertimeEntry } from '../lib/types/overtime';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

describe('Overtime: the Labour Act rules (4.7)', () => {
  it('the legal numbers: 1.5 times, 4 hours a day, 24 a week, 240 hours a month', () => {
    assert.deepEqual(OT_LEGAL, { minRate: 1.5, dailyMinutes: 240, weeklyMinutes: 1440, hoursPerMonth: 240 });
    // The day engine's limits are the same numbers.
    assert.equal(OT_DAILY_LIMIT_MINUTES, 240);
    assert.equal(OT_WEEKLY_LIMIT_MINUTES, 1440);
  });

  it('the hourly rate includes grade: (basic + grade) ÷ 240', () => {
    assert.equal(hourlyRate({ basic: 30000, grade: 2000 }).toNumber(), new Decimal(32000).dividedBy(240).toNumber());
    assert.equal(hourlyRate({ basic: 24000, grade: 0 }).toNumber(), 100);
  });

  it('pay: hours × hourly rate × the rate for the kind of day', () => {
    // 32,000 ÷ 240 = 133.333…; 2 h × 1.5 = 400; 1 h × 2 = 266.67 → 666.67
    const p = otPay({ work: 120, off: 60 }, { basic: 30000, grade: 2000 }, { workRate: 1.5, offRate: 2 });
    assert.equal(p.amount, 666.67);
    assert.equal(p.hourlyRate, 133.33);
    assert.equal(p.workHours, 2);
    assert.equal(p.offHours, 1);
    // No salary: nothing to pay.
    assert.equal(otPay({ work: 120, off: 0 }, undefined, LAWFUL_OVERTIME).amount, 0);
  });

  it('with grade 0 and the old rates, the amount equals the old formula (basic ÷ 240 × multiplier)', () => {
    const basic = 27500;
    const old = new Decimal(basic).dividedBy(240).times(95 / 60).times(1.5).plus(new Decimal(basic).dividedBy(240).times(40 / 60).times(2)).toDecimalPlaces(2).toNumber();
    assert.equal(otPay({ work: 95, off: 40 }, { basic, grade: 0 }, { workRate: 1.5, offRate: 2 }).amount, old);
  });

  it('rounding down: each day to whole blocks, then added up', () => {
    const down = (rounding: 0 | 15 | 30) => ({ rounding, roundingMode: 'down' as const });
    assert.equal(roundMinutes(44, down(0)), 44);
    assert.equal(roundMinutes(44, down(15)), 30);
    assert.equal(roundMinutes(44, down(30)), 30);
    assert.equal(roundMinutes(29, down(30)), 0);
    const days = [
      { otWorkDayMinutes: 44, otOffDayMinutes: 0 },
      { otWorkDayMinutes: 44, otOffDayMinutes: 50 },
    ];
    // Per day: 30 + 30 = 60 (not 88 → 75 for the month).
    assert.deepEqual(payableMinutes(days, down(15)), { work: 60, off: 45 });
    assert.deepEqual(payableMinutes(days, down(0)), { work: 88, off: 50 });
  });

  it('rounding to the nearest block: a half block or more goes up', () => {
    const nearest = (rounding: 15 | 30) => ({ rounding, roundingMode: 'nearest' as const });
    assert.equal(roundMinutes(104, nearest(15)), 105); // 1 h 44 → 1 h 45
    assert.equal(roundMinutes(97, nearest(15)), 90); // 1 h 37 → 1 h 30
    assert.equal(roundMinutes(98, nearest(15)), 105); // 1 h 38 → 1 h 45
    assert.equal(roundMinutes(104, nearest(30)), 90); // 1 h 44 → 1 h 30
    assert.equal(roundMinutes(105, nearest(30)), 120); // 1 h 45 → 2 h
    assert.deepEqual(payableMinutes([{ otWorkDayMinutes: 44, otOffDayMinutes: 0 }, { otWorkDayMinutes: 44, otOffDayMinutes: 52 }], nearest(15)), { work: 90, off: 45 });
    assert.equal(describeRounding(nearest(30)), 'To the nearest 30 minutes');
    assert.equal(describeRounding({ rounding: 15, roundingMode: 'down' }), 'Down to whole 15 minutes');
    assert.equal(describeRounding({ rounding: 0, roundingMode: 'down' }), 'Not rounded');
  });

  it('a rate below the law is refused; a typing mistake above 5 too', () => {
    assert.deepEqual(validatePolicy(LAWFUL_OVERTIME), {});
    assert.match(validatePolicy({ ...LAWFUL_OVERTIME, workRate: 1.25 }).workRate, /minimum is 1\.5/);
    assert.match(validatePolicy({ ...LAWFUL_OVERTIME, offRate: 1 }).offRate, /minimum is 1\.5/);
    assert.match(validatePolicy({ ...LAWFUL_OVERTIME, offRate: 15 }).offRate, /at most 5/);
  });

  it('stored values are cleaned; older ones below the law are raised to it', () => {
    assert.deepEqual(normalizePolicy({ workRate: '2', offRate: 2.555, rounding: 15, roundingMode: 'nearest', approval: 'auto' }), { workRate: 2, offRate: 2.56, rounding: 15, roundingMode: 'nearest', approval: 'auto' });
    // A policy saved before "nearest" existed rounds down.
    assert.equal(normalizePolicy({ rounding: 30 }).roundingMode, 'down');
    assert.deepEqual(normalizePolicy({ rounding: 7, approval: 'sometimes' }), LAWFUL_OVERTIME);
    assert.deepEqual(lawful({ ...LAWFUL_OVERTIME, workRate: 1, offRate: 1.2 }), LAWFUL_OVERTIME);
    assert.equal(lawful({ ...LAWFUL_OVERTIME, offRate: 2 }).offRate, 2);
  });

  it('a new company starts with the law (or the platform rate, never lower), approval required', () => {
    assert.deepEqual(seedPolicy(), LAWFUL_OVERTIME);
    assert.deepEqual(seedPolicy(1.2), LAWFUL_OVERTIME);
    assert.deepEqual(seedPolicy(2), { ...LAWFUL_OVERTIME, workRate: 2, offRate: 2 });
    assert.equal(seedPolicy(9).workRate, 5);
  });

  it('rates in words', () => {
    assert.equal(describeRates({ workRate: 1.5, offRate: 2 }), '1.5× on working days, 2× beyond a full day on weekly offs and holidays');
  });
});

describe('Overtime: one policy, payroll reads it (4.7)', () => {
  it('month close and payroll figures: the policy decides the minutes, the team\'s otPay and OT rules the rate (merge 2026-10-10)', () => {
    const src = read('lib/services/attendance.service.ts');
    assert.match(src, /function amountsFor\([\s\S]*?monthOvertime\(employeeId, days, entries, policy\)[\s\S]*?otPay\(\{ basic: salary\.basic, workDayMinutes: ot\.paid\.work, offDayMinutes: ot\.paid\.off, multipliers \}\)/);
    assert.match(src, /async function payInputs[\s\S]*?overtimeService\.getPayPolicy\(\)[\s\S]*?overtimeRepo\.findEntries[\s\S]*?otRuleRepository\.findActiveOtRules\(\)[\s\S]*?resolveOtMultipliers\(/);
    assert.doesNotMatch(src, /dividedBy\(240\)/);
  });

  it('before a company saves its own, the policy comes from the old settings with approval automatic, raised to the law', () => {
    const src = read('lib/services/overtime.service.ts');
    assert.match(src, /settings\.officeTime\.otMultiplierOfficeDay[\s\S]*?approval: "auto"[\s\S]*?lawful\(legacy\)/);
  });

  it('the OT rules set the rates (team); the platform never changes a company policy', () => {
    assert.match(read('components/time-and-leave/policies-hub-client.tsx'), /activeTab === "ot-rules" && otRulesData && \(/);
    const sync = read('app/api/platform/policies/sync/route.ts');
    assert.doesNotMatch(sync, /otRules|ot_rules|overtime\.policy|OVERTIME_POLICY_KEY/);
    for (const p of ['app/api/platform/companies/[id]/route.ts', 'lib/platform/provisioning/seed-tenant.ts', 'lib/repositories/onboarding.repository.ts']) {
      const src = read(p);
      assert.doesNotMatch(src, /\botRules\b/, `${p} writes the old table`);
      assert.match(src, /OVERTIME_POLICY_KEY[\s\S]*?seedPolicy\([\s\S]*?onConflictDoNothing\(\)/, `${p} must only seed a company without a policy`);
    }
  });
});

// 4.7b: approvals. 2026-10-04 is a Sunday: 10-04 … 10-10 is one week.
const day = (date: string, work: number, off = 0) => ({ date, otWorkDayMinutes: work, otOffDayMinutes: off });
const entry = (o: Partial<OvertimeEntry> & Pick<OvertimeEntry, 'workDate'>): OvertimeEntry => ({
  id: `e-${o.workDate}-${o.source ?? 'detected'}`,
  employeeId: 'E1',
  source: 'detected',
  dayKind: 'work',
  detectedMinutes: 0,
  requestedMinutes: 0,
  approvedMinutes: 0,
  status: 'approved',
  overLimit: false,
  reason: null,
  preparedBy: null,
  decidedBy: 'U1',
  decidedAt: null,
  decisionNote: null,
  approvalRoute: 'simple',
  createdAt: '2026-10-08T00:00:00.000Z',
  ...o,
});
const required = { approval: 'required' as const, rounding: 0 as const, roundingMode: 'down' as const };
const auto = { ...required, approval: 'auto' as const };

describe('Overtime approvals: what each day pays (4.7b)', () => {
  it('approval required: detected overtime waits and pays nothing until decided', () => {
    const r = monthOvertime('E1', [day('2026-10-05', 90), day('2026-10-06', 0)], [], required);
    assert.equal(r.lines.length, 1);
    assert.equal(r.lines[0].state, 'waiting');
    assert.equal(r.lines[0].paidMinutes, 0);
    assert.equal(r.waiting, 1);
    assert.deepEqual(r.paid, { work: 0, off: 0 });
  });

  it('approved pays the approved minutes (part approval too), rounded by the policy; rejected pays nothing', () => {
    const days = [day('2026-10-05', 104), day('2026-10-06', 60), day('2026-10-10', 0, 120)];
    const entries = [
      entry({ workDate: '2026-10-05', detectedMinutes: 104, approvedMinutes: 104 }),
      entry({ workDate: '2026-10-06', detectedMinutes: 60, approvedMinutes: 0, status: 'rejected' }),
      entry({ workDate: '2026-10-10', dayKind: 'off', detectedMinutes: 120, approvedMinutes: 90 }),
    ];
    const r = monthOvertime('E1', days, entries, { ...required, rounding: 15, roundingMode: 'nearest' });
    assert.deepEqual(r.lines.map((l) => [l.state, l.paidMinutes]), [['approved', 105], ['rejected', 0], ['approved', 90]]);
    assert.deepEqual(r.paid, { work: 105, off: 90 });
    assert.equal(r.waiting, 0);
  });

  it('a decided day whose punches changed since waits again (and pays nothing until decided)', () => {
    const r = monthOvertime('E1', [day('2026-10-05', 150)], [entry({ workDate: '2026-10-05', detectedMinutes: 90, approvedMinutes: 90 })], required);
    assert.equal(r.lines[0].state, 'changed');
    assert.equal(r.lines[0].paidMinutes, 0);
    assert.equal(r.waiting, 1);
    // In automatic mode too: someone decided this day, so someone decides it again.
    assert.equal(monthOvertime('E1', [day('2026-10-05', 150)], [entry({ workDate: '2026-10-05', detectedMinutes: 90, approvedMinutes: 90 })], auto).lines[0].state, 'changed');
  });

  it('automatic: detected overtime is paid, except days over 4 hours, which wait', () => {
    const r = monthOvertime('E1', [day('2026-10-05', 120), day('2026-10-06', 250)], [], auto);
    assert.deepEqual(r.lines.map((l) => [l.state, l.paidMinutes, l.limitText]), [['auto', 120, null], ['waiting', 0, 'Over 4 hours this day']]);
    assert.equal(r.waiting, 1);
  });

  it('automatic: every day of a week over 24 hours waits', () => {
    // 6 days × 4 h 30 = 27 h in one week; each day is also over 4 h. A week of 6 × 4 h 05 = 24.5 h, each day within 4 h 05 > 4 h too, so use 7 × 3 h 30 = 24.5 h.
    const week = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => day(d, 210));
    const r = monthOvertime('E1', [...week, day('2026-10-12', 60)], [], auto);
    assert.equal(r.lines.filter((l) => l.limitText === 'Week over 24 hours').length, 7);
    assert.equal(r.lines.find((l) => l.date === '2026-10-12')!.state, 'auto');
    assert.equal(r.waiting, 7);
    assert.equal(r.paid.work, 60);
  });

  it('overtime added by hand: waits, pays once approved, nothing when withdrawn; it counts towards the limits', () => {
    const manual = (status: OvertimeEntry['status'], approvedMinutes = 0) => entry({ workDate: '2026-10-05', source: 'manual', status, requestedMinutes: 180, approvedMinutes, preparedBy: 'U2' });
    assert.equal(monthOvertime('E1', [], [manual('pending')], auto).lines[0].state, 'waiting');
    assert.equal(monthOvertime('E1', [], [manual('approved', 150)], required).paid.work, 150);
    assert.equal(monthOvertime('E1', [], [manual('withdrawn')], required).lines[0].paidMinutes, 0);
    // 1 h 30 from the punches + 3 h by hand = 4 h 30 that day: over the limit, so the punches part waits in automatic mode.
    const r = monthOvertime('E1', [day('2026-10-05', 90)], [manual('pending')], auto);
    assert.ok(r.lines.every((l) => l.overLimit));
    assert.equal(r.lines.find((l) => l.source === 'detected')!.state, 'waiting');
  });

  it('only this employee’s entries count', () => {
    const r = monthOvertime('E1', [day('2026-10-05', 90)], [entry({ employeeId: 'E2', workDate: '2026-10-05', detectedMinutes: 90, approvedMinutes: 90 })], required);
    assert.equal(r.lines[0].state, 'waiting');
  });

  it('the limits, by day and by week (Sunday to Saturday)', () => {
    const m = limitBreaches(new Map([['2026-10-05', 241], ['2026-10-06', 240], ['2026-10-11', 30]]));
    assert.equal(m.get('2026-10-05'), 'Over 4 hours this day');
    assert.equal(m.has('2026-10-06'), false);
    assert.equal(m.has('2026-10-11'), false);
  });

  it('which days an approver may decide', () => {
    assert.equal(decidable({ state: 'waiting' }), true);
    assert.equal(decidable({ state: 'changed' }), true);
    assert.equal(decidable({ state: 'auto' }), true);
    assert.equal(decidable({ state: 'approved' }), false);
    assert.equal(decidable({ state: 'rejected' }), false);
  });

  it('the payslip line: hours × hourly rate × rate, for each kind of day', () => {
    const d = otDetail({ work: 390, off: 60 }, { basic: 45000, grade: 2950 }, { workRate: 1.5, offRate: 2 });
    assert.equal(d.hourlyRate, 199.79);
    assert.equal(d.workHours, 6.5);
    assert.equal(d.amount, otPay({ work: 390, off: 60 }, { basic: 45000, grade: 2950 }, { workRate: 1.5, offRate: 2 }).amount);
    assert.equal(describeDetail(d), '6.5 h × NPR 199.79 × 1.5 + 1 h × NPR 199.79 × 2 (weekly off / holiday)');
  });
});

describe('Overtime approvals: month close and payroll (4.7b)', () => {
  const src = read('lib/services/attendance.service.ts');

  it('the month is not closed while overtime waits for a decision', () => {
    assert.match(src, /export async function closeMonth[\s\S]*?otWaiting \+= a\.otWaiting[\s\S]*?if \(otWaiting\) throw new UserFacingError/);
  });

  it('a closed month keeps how its overtime was worked out; payroll carries it to the payslip', () => {
    assert.match(src, /summaries\.push\(\{[^}]*otDetail: a\.otDetail/);
    assert.match(read('lib/repositories/attendance.repository.ts'), /otDetail: s\.otDetail/);
    const payroll = read('lib/services/payroll.service.ts');
    assert.equal((payroll.match(/otDetail: (leaveOtCalc|calc)\?\.otDetail \?\? null/g) ?? []).length, 3);
  });

  it('an open month on a payslip says how many overtime days are not paid yet', () => {
    assert.match(src, /waiting for a decision \(not paid yet\)/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Decimal from 'decimal.js';
import {
  LAWFUL_OVERTIME,
  OT_LEGAL,
  describeRates,
  describeRounding,
  hourlyRate,
  lawful,
  normalizePolicy,
  otPay,
  payableMinutes,
  roundMinutes,
  seedPolicy,
  validatePolicy,
} from '../lib/engines/overtime.engine';
import { OT_DAILY_LIMIT_MINUTES, OT_WEEKLY_LIMIT_MINUTES } from '../lib/engines/attendance-day.engine';

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
  it('month close and payroll figures use the overtime engine, not System control multipliers', () => {
    const src = read('lib/services/attendance.service.ts');
    assert.match(src, /function amountsFor\([\s\S]*?payableMinutes\(days, policy\)[\s\S]*?otPay\(minutes, salary, policy\)/);
    assert.match(src, /async function payInputs[\s\S]*?overtimeService\.getPolicy\(\)/);
    assert.doesNotMatch(src, /otMultiplierOfficeDay|otMultiplierOffDay|dividedBy\(240\)/);
  });

  it('before a company saves its own, the policy comes from the old settings with approval automatic, raised to the law', () => {
    const src = read('lib/services/overtime.service.ts');
    assert.match(src, /settings\.officeTime\.otMultiplierOfficeDay[\s\S]*?approval: "auto"[\s\S]*?lawful\(legacy\)/);
  });

  it('the old OT rules screen and table writers are gone; the platform never changes a company policy', () => {
    for (const p of ['app/actions/ot-rule.actions.ts', 'lib/services/ot-rule.service.ts', 'components/ot-rules/ot-rules-client.tsx']) {
      assert.throws(() => read(p), /ENOENT/, `${p} should be removed`);
    }
    const sync = read('app/api/platform/policies/sync/route.ts');
    assert.doesNotMatch(sync, /otRules|ot_rules|overtime\.policy|OVERTIME_POLICY_KEY/);
    for (const p of ['app/api/platform/companies/[id]/route.ts', 'lib/platform/provisioning/seed-tenant.ts', 'lib/repositories/onboarding.repository.ts']) {
      const src = read(p);
      assert.doesNotMatch(src, /\botRules\b/, `${p} writes the old table`);
      assert.match(src, /OVERTIME_POLICY_KEY[\s\S]*?seedPolicy\([\s\S]*?onConflictDoNothing\(\)/, `${p} must only seed a company without a policy`);
    }
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { otPay, resolveOtMultipliers } from '../lib/engines/ot-pay.engine';

// 4.7: the one OT formula and which multipliers it uses.

const rule = (over: Partial<Parameters<typeof resolveOtMultipliers>[0][number]> = {}) => ({ ruleType: 'Hourly', isActive: true, rateOfficeDay: 1.5, rateOffDay: 2, ...over });

describe('multipliers', () => {
  it('System control applies when there is no active hourly rule', () => {
    assert.deepEqual(resolveOtMultipliers([], { work: 1.5, off: 2.5 }), { work: 1.5, off: 2.5, source: 'settings' });
    assert.deepEqual(resolveOtMultipliers([rule({ isActive: false }), rule({ ruleType: 'Fixed' })], { work: 1.5, off: 2 }).source, 'settings');
    assert.equal(resolveOtMultipliers([], {}).source, 'default');
  });

  it('an active hourly rule wins over System control', () => {
    assert.deepEqual(resolveOtMultipliers([rule({ rateOfficeDay: 1.75, rateOffDay: 2.25 })], { work: 1.5, off: 2 }), { work: 1.75, off: 2.25, source: 'rule' });
  });

  it('with several rules the most favourable to staff applies per day type', () => {
    const m = resolveOtMultipliers([rule({ rateOfficeDay: 1.6, rateOffDay: 2 }), rule({ rateOfficeDay: 1.5, rateOffDay: 3 })], {});
    assert.equal(m.work, 1.6);
    assert.equal(m.off, 3);
  });

  it('never below the Labour Act 1.5', () => {
    const low = resolveOtMultipliers([rule({ rateOfficeDay: 1.2, rateOffDay: 1.1 })], {});
    assert.equal(low.work, 1.5);
    assert.equal(low.off, 1.5);
    assert.equal(resolveOtMultipliers([], { work: 1, off: 1.2 }).work, 1.5);
  });
});

describe('otPay', () => {
  it('basic ÷ 240 × hours × multiplier', () => {
    // 24,000 / 240 = 100 an hour; 4 h × 1.5 = 600
    assert.equal(otPay({ basic: 24000, workDayMinutes: 240, offDayMinutes: 0, multipliers: { work: 1.5, off: 2 } }), 600);
    // plus 3 h off day × 2 = 600
    assert.equal(otPay({ basic: 24000, workDayMinutes: 240, offDayMinutes: 180, multipliers: { work: 1.5, off: 2 } }), 1200);
  });

  it('rounds to two decimals and ignores empty or negative inputs', () => {
    assert.equal(otPay({ basic: 25000, workDayMinutes: 50, offDayMinutes: 0, multipliers: { work: 1.5, off: 2 } }), 130.21);
    assert.equal(otPay({ basic: 0, workDayMinutes: 600, offDayMinutes: 0, multipliers: { work: 1.5, off: 2 } }), 0);
    assert.equal(otPay({ basic: 24000, workDayMinutes: -60, offDayMinutes: 0, multipliers: { work: 1.5, off: 2 } }), 0);
  });

  it('a multiplier passed below the floor is lifted to 1.5', () => {
    assert.equal(otPay({ basic: 24000, workDayMinutes: 60, offDayMinutes: 0, multipliers: { work: 1, off: 1 } }), 150);
  });
});

import { validateOtRuleForm } from '../lib/engines/ot-rule.engine';

describe('OT rule form', () => {
  const form = { ruleType: 'Hourly', ruleName: 'Standard', rateOfficeDay: 1.5, rateOffDay: 2, isActive: true } as Parameters<typeof validateOtRuleForm>[0];
  it('hourly multipliers cannot go below the Labour Act minimum', () => {
    assert.deepEqual(validateOtRuleForm(form), {});
    assert.ok(validateOtRuleForm({ ...form, rateOfficeDay: 1.2 }).rateOfficeDay);
    assert.ok(validateOtRuleForm({ ...form, rateOffDay: 1 }).rateOffDay);
  });
  it('fixed rules are per-day amounts and are not held to the multiplier floor', () => {
    assert.deepEqual(validateOtRuleForm({ ...form, ruleType: 'Fixed', rateOfficeDay: 500, rateOffDay: 800 }), {});
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  achievementPct,
  canMove,
  employeeCanEdit,
  normalizeAchievementForm,
  normalizeTargetForm,
  periodLabel,
  rollUpYear,
  scoringValue,
  validateAchievementForm,
  validateReturnReason,
  validateTargetForm,
  weightTotal,
  weightedScore,
} from '../lib/engines/target.engine';

// Targets & achievements (G15): form rules, the status machine, scoring.

const base = { employeeId: 'e1', periodKind: 'month', fy: '2082/83', monthNo: 3, title: 'New savings accounts', unit: 'accounts', targetValue: 40, weight: 50 };

describe('target form', () => {
  it('accepts a complete monthly and yearly target', () => {
    assert.deepEqual(validateTargetForm(normalizeTargetForm(base)), {});
    assert.deepEqual(validateTargetForm(normalizeTargetForm({ ...base, periodKind: 'year', monthNo: null })), {});
  });

  it('a yearly target ignores a month; a monthly one needs 1..12', () => {
    assert.equal(normalizeTargetForm({ ...base, periodKind: 'year', monthNo: 4 }).monthNo, null);
    assert.ok(validateTargetForm(normalizeTargetForm({ ...base, monthNo: 13 })).monthNo);
    assert.ok(validateTargetForm(normalizeTargetForm({ ...base, monthNo: null })).monthNo);
  });

  it('needs title, a positive target, a fiscal year and a weight within 0..100', () => {
    const bad = validateTargetForm(normalizeTargetForm({ ...base, title: ' ', targetValue: 0, fy: '2082', weight: 101, employeeId: '' }));
    for (const k of ['title', 'targetValue', 'fy', 'weight', 'employeeId']) assert.ok(bad[k], k);
    assert.ok(validateTargetForm(normalizeTargetForm({ ...base, targetValue: 'abc' })).targetValue);
  });

  it('weights are summed to two decimals', () => {
    assert.equal(weightTotal([{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.34 }]), 100);
  });
});

describe('achievement form', () => {
  it('zero is allowed, negative and blank are not', () => {
    assert.deepEqual(validateAchievementForm(normalizeAchievementForm({ achievedValue: 0 })), {});
    assert.ok(validateAchievementForm(normalizeAchievementForm({ achievedValue: -1 })).achievedValue);
    assert.ok(validateAchievementForm(normalizeAchievementForm({ achievedValue: '' })).achievedValue);
  });
});

describe('status machine', () => {
  it('follows employee → supervisor → HR and nobody skips a step', () => {
    assert.ok(canMove('set', 'submitted', 'employee'));
    assert.ok(canMove('returned', 'submitted', 'employee'));
    assert.ok(canMove('submitted', 'forwarded', 'supervisor'));
    assert.ok(canMove('submitted', 'returned', 'supervisor'));
    assert.ok(canMove('forwarded', 'closed', 'hr'));
    assert.ok(canMove('forwarded', 'returned', 'hr'));
  });

  it('the wrong person or order is refused', () => {
    assert.ok(!canMove('set', 'forwarded', 'supervisor'));
    assert.ok(!canMove('submitted', 'closed', 'hr'));
    assert.ok(!canMove('submitted', 'forwarded', 'employee'));
    assert.ok(!canMove('forwarded', 'closed', 'supervisor'));
    assert.ok(!canMove('closed', 'returned', 'hr'));
  });

  it('the employee can edit only before submitting or after a return', () => {
    assert.ok(employeeCanEdit('set') && employeeCanEdit('returned'));
    assert.ok(!employeeCanEdit('submitted') && !employeeCanEdit('forwarded') && !employeeCanEdit('closed'));
  });

  it('a return needs a reason', () => {
    assert.ok(validateReturnReason(' ') !== null);
    assert.equal(validateReturnReason('Attach the account list'), null);
  });
});

describe('scoring', () => {
  it('percentage of target', () => {
    assert.equal(achievementPct(40, 30), 75);
    assert.equal(achievementPct(0, 5), 0);
    assert.equal(achievementPct(3, 1), 33.3);
  });

  it('weighted score caps over-achievement and counts missing figures as zero', () => {
    assert.equal(weightedScore([{ weight: 50, target: 10, value: 10 }, { weight: 50, target: 10, value: 5 }]), 75);
    assert.equal(weightedScore([{ weight: 100, target: 10, value: 50 }]), 120);
    assert.equal(weightedScore([{ weight: 50, target: 10, value: 10 }, { weight: 50, target: 10, value: null }]), 50);
    assert.equal(weightedScore([]), null);
    assert.equal(weightedScore([{ weight: 0, target: 10, value: 10 }]), null);
  });

  it('the verified figure wins over the reported one', () => {
    assert.equal(scoringValue(30, 25), 25);
    assert.equal(scoringValue(30, null), 30);
    assert.equal(scoringValue(null, null), null);
  });

  it('the year is the average of the months that have a score', () => {
    assert.equal(rollUpYear([80, null, 100]), 90);
    assert.equal(rollUpYear([null, null]), null);
  });

  it('period labels', () => {
    assert.equal(periodLabel('month', '2082/83', 1), 'Shrawan 2082/83');
    assert.equal(periodLabel('year', '2082/83', null), 'FY 2082/83');
  });
});

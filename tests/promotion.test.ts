import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEIGHTS, normalizeWeights, rankCandidates, scoreCandidate, validateWeights, yearsBetween } from '../lib/engines/promotion.engine';

// Promotion composite: weights, scoring, ranking.

describe('weights', () => {
  it('defaults sum to 100 and validate; a bad split is refused', () => {
    assert.deepEqual(validateWeights(DEFAULT_WEIGHTS), {});
    assert.ok(validateWeights(normalizeWeights({ evaluation: 50, seniority: 30, training: 10 })).evaluation);
    assert.equal(normalizeWeights({ evaluationsCounted: '3.7' }).evaluationsCounted, 3);
  });
});

describe('scoring', () => {
  it('averages the latest N evaluations, caps seniority and training, deducts discipline', () => {
    const s = scoreCandidate({ employeeId: 'a', evaluationTotals: [80, 90, 50], yearsInPost: 5, trainingHours: 60, disciplinaryOutcomes: 1 }, DEFAULT_WEIGHTS);
    assert.equal(s.evaluationAvg, 85); // first two only
    assert.equal(s.evaluationPoints, 51); // 85% of 60
    assert.equal(s.seniorityPoints, 15); // 5 of 10 years × 30
    assert.equal(s.trainingPoints, 10); // capped at 40 h
    assert.equal(s.penalty, 5);
    assert.equal(s.composite, 71);
    assert.equal(s.note, null);
  });

  it('no evaluation → note, zero evaluation points, never negative', () => {
    const s = scoreCandidate({ employeeId: 'b', evaluationTotals: [], yearsInPost: 0.5, trainingHours: 0, disciplinaryOutcomes: 3 }, DEFAULT_WEIGHTS);
    assert.equal(s.evaluationAvg, null);
    assert.equal(s.composite, 0);
    assert.match(s.note ?? '', /No final evaluation/);
  });
});

describe('ranking', () => {
  it('highest composite first, seniority breaks ties, unevaluated last', () => {
    const w = DEFAULT_WEIGHTS;
    const rows = rankCandidates([
      scoreCandidate({ employeeId: 'x', evaluationTotals: [70], yearsInPost: 2, trainingHours: 0, disciplinaryOutcomes: 0 }, w),
      scoreCandidate({ employeeId: 'y', evaluationTotals: [70], yearsInPost: 6, trainingHours: 0, disciplinaryOutcomes: 0 }, w),
      scoreCandidate({ employeeId: 'z', evaluationTotals: [], yearsInPost: 12, trainingHours: 0, disciplinaryOutcomes: 0 }, w),
    ]);
    assert.deepEqual(rows.map((r) => [r.employeeId, r.rank]), [['y', 1], ['x', 2], ['z', null]]);
  });

  it('years between dates', () => {
    assert.equal(yearsBetween('2020-10-09', '2026-10-09'), 6);
    assert.equal(yearsBetween('2026-10-09', '2020-10-09'), 0);
  });
});

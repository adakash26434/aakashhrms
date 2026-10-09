import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeStages,
  allCriteria,
  computeTotals,
  gradeBand,
  maxTotal,
  nextStage,
  normalizeForm,
  stagePercent,
  validateForm,
  validateRaters,
  validateStageMarks,
  type StageScore,
} from '../lib/engines/evaluation.engine';
import { DEFAULT_EVALUATION_TEMPLATE } from '../lib/constants/evaluation-template';

// Performance evaluation (G1): weighted का.स.मू. marks. The default template
// must validate; totals are stage % × weight; raters never include the subject.

const form = normalizeForm(DEFAULT_EVALUATION_TEMPLATE.form as unknown);

/** Marks every criterion of a stage at the same fraction of its max. */
const stageScores = (stage: string, fraction: number): StageScore[] =>
  allCriteria(form).map((c) => ({ stage, criterionId: c.id, marks: Math.round(c.max * fraction * 2) / 2 }));

describe('evaluation form', () => {
  it('the seeded default template is valid, 100 raw marks, three stages', () => {
    assert.deepEqual(validateForm(form), []);
    assert.equal(maxTotal(form), 100);
    assert.deepEqual(activeStages(form), ['supervisor', 'reviewer', 'committee']);
    assert.equal(allCriteria(form).length, 10);
  });

  it('normalize parses untrusted JSON and sorts bands highest first', () => {
    const f = normalizeForm({ weights: { supervisor: '100' }, bands: [{ min: 0, label: 'C' }, { min: 80, label: 'A' }], sections: [{ name: 'S', criteria: [{ name: 'c', max: '10' }] }] });
    assert.equal(f.weights.supervisor, 100);
    assert.equal(f.bands[0].label, 'A');
    assert.equal(f.sections[0].criteria[0].id, 's1c1');
    assert.deepEqual(validateForm(f), []);
  });

  it('rejects weights that do not sum to 100, empty sections, bad maxima, duplicate ids, no floor band', () => {
    assert.ok(validateForm(normalizeForm({ ...DEFAULT_EVALUATION_TEMPLATE.form, weights: { supervisor: 60, reviewer: 30, committee: 20 } })).some((e) => e.includes('sum to 100')));
    assert.ok(validateForm(normalizeForm({ weights: { supervisor: 100 }, bands: [{ min: 0, label: 'X' }], sections: [] })).some((e) => e.includes('section')));
    const dup = normalizeForm({ weights: { supervisor: 100 }, bands: [{ min: 0, label: 'X' }], sections: [{ name: 'S', criteria: [{ id: 'a', name: 'c1', max: 10 }, { id: 'a', name: 'c2', max: 200 }] }] });
    const errors = validateForm(dup);
    assert.ok(errors.some((e) => e.includes('Duplicate')));
    assert.ok(errors.some((e) => e.includes('1–100')));
    assert.ok(validateForm(normalizeForm({ weights: { supervisor: 100 }, bands: [{ min: 60, label: 'ok' }], sections: [{ name: 'S', criteria: [{ name: 'c', max: 10 }] }] })).some((e) => e.includes('start at 0')));
  });
});

describe('evaluation raters (S28)', () => {
  it('every active stage needs its own rater, never the subject', () => {
    assert.ok(validateRaters(form, {}, null).supervisor);
    assert.ok(validateRaters(form, { supervisor: 'u-subject', reviewer: 'u2', committee: 'u3' }, 'u-subject').supervisor);
    const dup = validateRaters(form, { supervisor: 'u1', reviewer: 'u1', committee: 'u3' }, null);
    assert.match(dup.reviewer, /Already rating/);
    assert.deepEqual(validateRaters(form, { supervisor: 'u1', reviewer: 'u2', committee: 'u3' }, 'u9'), {});
  });
});

describe('evaluation marks and totals', () => {
  it('stage marks: all criteria required, 0..max, half marks allowed', () => {
    const complete = Object.fromEntries(allCriteria(form).map((c) => [c.id, c.max]));
    assert.deepEqual(validateStageMarks(form, complete), {});
    assert.deepEqual(validateStageMarks(form, { ...complete, work_quality: 7.5 }), {});
    assert.ok(validateStageMarks(form, { ...complete, work_quality: 10.3 }).work_quality);
    assert.ok(validateStageMarks(form, { ...complete, work_quality: 11 }).work_quality);
    const incomplete = Object.fromEntries(Object.entries(complete).filter(([k]) => k !== 'work_quantity'));
    assert.ok(validateStageMarks(form, incomplete).work_quantity);
  });

  it('a stage percent needs every criterion; totals weight the stages', () => {
    const scores = [...stageScores('supervisor', 0.9), ...stageScores('reviewer', 0.8), ...stageScores('committee', 0.7)];
    assert.equal(stagePercent(form, scores, 'supervisor'), 90);
    assert.equal(stagePercent(form, scores.slice(1), 'supervisor'), null);
    const totals = computeTotals(form, scores)!;
    // 90×0.5 + 80×0.3 + 70×0.2 = 83
    assert.equal(totals.total, 83);
    assert.equal(totals.band, 'Very good');
    assert.equal(totals.bandNp, 'अति उत्तम');
    assert.equal(computeTotals(form, scores.slice(0, 12)), null);
  });

  it('grade bands pick the highest band at or below the total', () => {
    assert.equal(gradeBand(form, 95)!.labelNp, 'उत्कृष्ट');
    assert.equal(gradeBand(form, 80)!.labelNp, 'अति उत्तम');
    assert.equal(gradeBand(form, 59.99)!.labelNp, 'सुधार आवश्यक');
  });

  it('stages advance in order and end at final', () => {
    assert.equal(nextStage(form, 'supervisor'), 'reviewer');
    assert.equal(nextStage(form, 'committee'), 'final');
    const twoStage = normalizeForm({ ...DEFAULT_EVALUATION_TEMPLATE.form, weights: { supervisor: 70, reviewer: 0, committee: 30 } });
    assert.deepEqual(activeStages(twoStage), ['supervisor', 'committee']);
    assert.equal(nextStage(twoStage, 'supervisor'), 'committee');
  });
});

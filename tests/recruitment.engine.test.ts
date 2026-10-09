import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLICANT_STAGES,
  canMoveStage,
  meritOrder,
  normalizeApplicantForm,
  normalizePositionForm,
  normalizeVacancyForm,
  occupancy,
  validateApplicantForm,
  validateMarks,
  validatePositionForm,
  validateVacancyForm,
} from '../lib/engines/recruitment.engine';

// Recruitment & darbandi (G4): stage pipeline, occupancy and merit order.

describe('recruitment stages', () => {
  it('moves forward freely, back one step, rejected from anywhere but hired', () => {
    assert.equal(canMoveStage('applied', 'shortlisted'), true);
    assert.equal(canMoveStage('applied', 'interview'), true, 'skipping ahead is allowed');
    assert.equal(canMoveStage('interview', 'exam'), true, 'one step back corrects');
    assert.equal(canMoveStage('interview', 'applied'), false, 'two steps back is not a correction');
    assert.equal(canMoveStage('exam', 'rejected'), true);
    assert.equal(canMoveStage('hired', 'rejected'), false, 'hired never moves');
    assert.equal(canMoveStage('rejected', 'applied'), true, 're-considered');
    assert.equal(canMoveStage('rejected', 'selected'), false);
    assert.equal(canMoveStage('applied', 'applied'), false);
  });

  it('the seven stages exist', () => {
    assert.deepEqual(APPLICANT_STAGES.map((s) => s.code), ['applied', 'shortlisted', 'exam', 'interview', 'selected', 'hired', 'rejected']);
  });
});

describe('darbandi occupancy', () => {
  it('computes vacant and over without going negative', () => {
    assert.deepEqual(occupancy(5, 3), { positions: 5, filled: 3, vacant: 2, over: 0 });
    assert.deepEqual(occupancy(2, 4), { positions: 2, filled: 4, vacant: 0, over: 2 });
    assert.deepEqual(occupancy(0, 0), { positions: 0, filled: 0, vacant: 0, over: 0 });
  });
});

describe('recruitment forms', () => {
  it('positions: designation, branch and 0–999 required', () => {
    assert.ok(validatePositionForm(normalizePositionForm({})).designationId);
    assert.ok(validatePositionForm(normalizePositionForm({ designationId: 'd', branchId: 'b', positions: -1 })).positions);
    assert.ok(validatePositionForm(normalizePositionForm({ designationId: 'd', branchId: 'b', positions: 'many' })).positions);
    assert.deepEqual(validatePositionForm(normalizePositionForm({ designationId: 'd', branchId: 'b', positions: 3, decisionRef: 'Board 12/2082' })), {});
  });

  it('vacancies: 1–99 openings; malformed deadline dropped', () => {
    const form = normalizeVacancyForm({ designationId: 'd', branchId: 'b', openings: 2, deadlineAd: '15-11-2026' });
    assert.equal(form.deadlineAd, '');
    assert.deepEqual(validateVacancyForm(form), {});
    assert.ok(validateVacancyForm(normalizeVacancyForm({ designationId: 'd', branchId: 'b', openings: 0 })).openings);
  });

  it('applicants: a name, and a shaped email when given', () => {
    assert.ok(validateApplicantForm(normalizeApplicantForm({ fullName: 'A' })).fullName);
    assert.ok(validateApplicantForm(normalizeApplicantForm({ fullName: 'Asha KC', email: 'nope' })).email);
    assert.deepEqual(validateApplicantForm(normalizeApplicantForm({ fullName: 'Asha KC', email: 'asha@example.com' })), {});
  });

  it('marks: 0–100 in halves, empty clears', () => {
    assert.equal(validateMarks(''), null);
    assert.equal(validateMarks('67.5'), null);
    assert.ok(validateMarks('101'));
    assert.ok(validateMarks('66.3'));
    assert.ok(validateMarks('abc'));
  });
});

describe('merit order', () => {
  it('ranks by total then exam; incomplete and rejected sit outside', () => {
    const ranks = meritOrder([
      { id: 'a', stage: 'interview', examMarks: 70, interviewMarks: 20 },
      { id: 'b', stage: 'interview', examMarks: 60, interviewMarks: 30 },
      { id: 'c', stage: 'interview', examMarks: 65, interviewMarks: 25 },
      { id: 'd', stage: 'interview', examMarks: 80, interviewMarks: null },
      { id: 'e', stage: 'rejected', examMarks: 99, interviewMarks: 99 },
    ]);
    // a and b and c all total 90: exam breaks ties → a (70), c (65), b (60)
    assert.equal(ranks.get('a'), 1);
    assert.equal(ranks.get('c'), 2);
    assert.equal(ranks.get('b'), 3);
    assert.equal(ranks.get('d'), undefined);
    assert.equal(ranks.get('e'), undefined);
  });
});

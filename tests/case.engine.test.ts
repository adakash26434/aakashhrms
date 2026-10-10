import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTCOMES,
  acceptsNotes,
  canMove,
  nextStatuses,
  normalizeDecisionForm,
  normalizeOpenForm,
  validateDecision,
  validateNote,
  validateOpenForm,
} from '../lib/engines/case.engine';

// Disciplinary & grievance (G8): status flow, outcomes per category, severity rules.

describe('case status flow', () => {
  it('open → investigating or decided; investigating → decided; decided → closed; closed is final', () => {
    assert.deepEqual(nextStatuses('open'), ['investigating', 'decided']);
    assert.deepEqual(nextStatuses('investigating'), ['decided']);
    assert.deepEqual(nextStatuses('decided'), ['closed']);
    assert.deepEqual(nextStatuses('closed'), []);
    assert.ok(canMove('open', 'decided'));
    assert.ok(!canMove('decided', 'investigating'));
    assert.ok(!canMove('open', 'closed'));
  });

  it('notes are accepted until the case is closed', () => {
    assert.ok(acceptsNotes('decided'));
    assert.ok(!acceptsNotes('closed'));
  });
});

describe('open form', () => {
  it('normalizes unknown category / severity to empty and trims', () => {
    const form = normalizeOpenForm({ category: 'gossip', severity: 'huge', employeeId: ' e1 ', title: '  Late again  ' });
    assert.equal(form.category, '');
    assert.equal(form.severity, '');
    assert.equal(form.employeeId, 'e1');
    assert.equal(form.title, 'Late again');
  });

  it('requires every field and a real description', () => {
    const errors = validateOpenForm(normalizeOpenForm({}));
    assert.deepEqual(Object.keys(errors).sort(), ['category', 'description', 'employeeId', 'severity', 'title']);
    const ok = validateOpenForm(normalizeOpenForm({ category: 'grievance', employeeId: 'e1', severity: 'minor', title: 'Overtime unpaid', description: 'Worked two Saturdays, not paid.' }));
    assert.deepEqual(ok, {});
  });
});

describe('decision', () => {
  const d = (outcome: string, note: string) => normalizeDecisionForm({ outcome, note });

  it('outcome must belong to the category', () => {
    assert.equal(OUTCOMES.disciplinary.length, 6);
    assert.ok(validateDecision('grievance', 'major', d('suspension', 'A long enough reason here')).outcome);
    assert.deepEqual(validateDecision('grievance', 'major', d('upheld', 'Evidence supports the claim.')), {});
  });

  it('needs a written reason', () => {
    assert.ok(validateDecision('disciplinary', 'major', d('written_warning', 'short')).note);
  });

  it('a minor case cannot recommend termination', () => {
    assert.ok(validateDecision('disciplinary', 'minor', d('termination_recommended', 'Repeated and wilful absence.')).outcome);
    assert.deepEqual(validateDecision('disciplinary', 'serious', d('termination_recommended', 'Fraud confirmed by the audit committee.')), {});
  });

  it('a serious case with no action needs a fuller reason', () => {
    assert.ok(validateDecision('disciplinary', 'serious', d('no_action', 'Not enough evidence.')).note);
    assert.deepEqual(validateDecision('disciplinary', 'serious', d('no_action', 'Not enough evidence after interviewing three witnesses.')), {});
  });
});

describe('notes', () => {
  it('3 to 2000 characters', () => {
    assert.ok(validateNote('hi'));
    assert.equal(validateNote('Spoke to the branch manager.'), null);
    assert.ok(validateNote('x'.repeat(2001)));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptsNominations,
  addMonthsIso,
  bondActive,
  bondEnds,
  canMoveProgram,
  earnedHours,
  nextProgramStatuses,
  normalizeMarkForm,
  normalizeProgramForm,
  validateMark,
  validateProgramForm,
} from '../lib/engines/training.engine';

// Training (G7): programme flow, marking rules, service bond dates.

const ok = { title: 'AML / KYC refresher', kind: 'regulatory', startAd: '2026-10-10', endAd: '2026-10-12', hours: 12, cost: 0, bondMonths: 0 };

describe('programme flow', () => {
  it('planned → running → completed; cancel while planned or running; final after that', () => {
    assert.deepEqual(nextProgramStatuses('planned'), ['running', 'cancelled']);
    assert.deepEqual(nextProgramStatuses('running'), ['completed', 'cancelled']);
    assert.deepEqual(nextProgramStatuses('completed'), []);
    assert.ok(canMoveProgram('planned', 'running'));
    assert.ok(!canMoveProgram('planned', 'completed'));
    assert.ok(acceptsNominations('running') && !acceptsNominations('completed'));
  });
});

describe('programme form', () => {
  it('accepts a good form and rejects bad dates, hours and bond', () => {
    assert.deepEqual(validateProgramForm(normalizeProgramForm(ok)), {});
    const bad = validateProgramForm(normalizeProgramForm({ ...ok, endAd: '2026-10-01', hours: 0, bondMonths: 2.5, kind: 'party' }));
    assert.ok(bad.endAd && bad.hours && bad.bondMonths && bad.kind);
  });
});

describe('marking', () => {
  const m = (status: string, score: unknown = '', certificateNo = '') => normalizeMarkForm({ status, score, certificateNo });

  it('attendance needs a running or finished programme; completion needs a completed one', () => {
    assert.ok(validateMark('planned', m('attended')).status);
    assert.deepEqual(validateMark('running', m('attended', 80)), {});
    assert.ok(validateMark('running', m('completed')).status);
    assert.deepEqual(validateMark('completed', m('completed', 91, 'C-2026-14')), {});
    assert.ok(validateMark('completed', m('nominated')).status);
  });

  it('score is 0–100, none for absent; certificate only with completion', () => {
    assert.ok(validateMark('completed', m('completed', 120)).score);
    assert.ok(validateMark('completed', m('absent', 50)).score);
    assert.ok(validateMark('completed', m('attended', '', 'C-1')).certificateNo);
  });
});

describe('service bond', () => {
  it('adds months clamping the day', () => {
    assert.equal(addMonthsIso('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonthsIso('2028-01-31', 1), '2028-02-29');
    assert.equal(addMonthsIso('2026-11-15', 3), '2027-02-15');
  });

  it('no bond → null; active through the end date inclusive', () => {
    assert.equal(bondEnds('2026-10-12', 0), null);
    const end = bondEnds('2026-10-12', 12);
    assert.equal(end, '2027-10-12');
    assert.ok(bondActive(end, '2027-10-12'));
    assert.ok(!bondActive(end, '2027-10-13'));
    assert.ok(!bondActive(null, '2026-10-12'));
  });
});

describe('earned hours', () => {
  it('counts completed programmes only, paisa-safe', () => {
    assert.equal(earnedHours([{ status: 'completed', hours: 12.5 }, { status: 'attended', hours: 8 }, { status: 'completed', hours: 0.1 }]), 12.6);
  });
});

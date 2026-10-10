import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEARANCE_UNITS,
  EXIT_KINDS,
  clearanceProgress,
  completionBlockers,
  normalizeExitForm,
  terminationMirror,
  validateCancelReason,
  validateClearanceDecision,
  validateExitForm,
} from '../lib/engines/exit.engine';

// Exit workflow (G5): a case completes only when every unit cleared and the
// last working day has arrived.

const TODAY = '2026-10-09';
const subject = { id: 'e1', status: 'Active', hasOpenCase: false };

describe('exit form', () => {
  it('normalizes: unknown kinds and malformed dates rejected', () => {
    const form = normalizeExitForm({ kind: 'rage_quit', lastWorkingDayAd: '9/10/2026', employeeId: ' e1 ' });
    assert.equal(form.kind, '');
    assert.equal(form.lastWorkingDayAd, '');
    assert.equal(form.employeeId, 'e1');
  });

  it('requires an active employee without an open case, a kind and the last working day', () => {
    const errors = validateExitForm(normalizeExitForm({}), null, TODAY);
    assert.ok(errors.employeeId && errors.kind && errors.lastWorkingDayAd);
    const base = normalizeExitForm({ employeeId: 'e1', kind: 'resignation', lastWorkingDayAd: '2026-11-15' });
    assert.ok(validateExitForm(base, { ...subject, status: 'Inactive' }, TODAY).employeeId);
    assert.ok(validateExitForm(base, { ...subject, hasOpenCase: true }, TODAY).employeeId);
    assert.deepEqual(validateExitForm(base, subject, TODAY), {});
  });

  it('notice cannot follow the last working day; at most a year ahead; back-dating allowed', () => {
    const bad = normalizeExitForm({ employeeId: 'e1', kind: 'resignation', noticeDate: '2026-12-01', lastWorkingDayAd: '2026-11-15' });
    assert.ok(validateExitForm(bad, subject, TODAY).noticeDate);
    const far = normalizeExitForm({ employeeId: 'e1', kind: 'retirement', lastWorkingDayAd: '2027-11-15' });
    assert.ok(validateExitForm(far, subject, TODAY).lastWorkingDayAd);
    const past = normalizeExitForm({ employeeId: 'e1', kind: 'death', lastWorkingDayAd: '2026-09-01' });
    assert.deepEqual(validateExitForm(past, subject, TODAY), {});
  });
});

describe('exit clearance and completion', () => {
  const all = (status: 'pending' | 'cleared' | 'blocked') => CLEARANCE_UNITS.map((u) => ({ unit: u.code, status }));

  it('tracks progress', () => {
    assert.deepEqual(clearanceProgress(all('cleared')), { cleared: 4, blocked: 0, total: 4 });
    const mixed = [...all('cleared').slice(0, 2), { unit: 'branch', status: 'blocked' as const }, { unit: 'hr', status: 'pending' as const }];
    assert.deepEqual(clearanceProgress(mixed), { cleared: 2, blocked: 1, total: 4 });
  });

  it('completion needs every unit cleared and the day arrived', () => {
    assert.deepEqual(completionBlockers(all('cleared'), '2026-10-09', TODAY), []);
    assert.deepEqual(completionBlockers(all('cleared'), '2026-09-01', TODAY), []);
    const notYet = completionBlockers(all('cleared'), '2026-11-15', TODAY);
    assert.equal(notYet.length, 1);
    assert.match(notYet[0], /has not arrived/);
    const pending = completionBlockers([...all('cleared').slice(0, 3), { unit: 'hr', status: 'pending' }], '2026-09-01', TODAY);
    assert.match(pending[0], /HR has not cleared/);
    assert.match(completionBlockers([{ unit: 'accounts', status: 'blocked' }], '2026-09-01', TODAY)[0], /blocked/);
    const funds = completionBlockers(all('cleared'), '2026-09-01', TODAY, ['Staff welfare fund']);
    assert.equal(funds.length, 1);
    assert.match(funds[0], /Welfare fund balance is still held \(Staff welfare fund\)/);
    const assets = completionBlockers(all('cleared'), '2026-09-01', TODAY, [], ['LAP-001']);
    assert.match(assets[0], /assets are still out \(LAP-001\)/);
    // 4.10: a running loan is recovered first (settlement, repayment or write-off).
    const loan = completionBlockers(all('cleared'), '2026-09-01', TODAY, [], [], '45000.5');
    assert.equal(loan.length, 1);
    assert.match(loan[0], /staff loan still owes NPR 45,000\.50/);
    assert.deepEqual(completionBlockers(all('cleared'), '2026-09-01', TODAY, [], [], '0'), []);
  });

  it('blocking a clearance needs a note; cancel needs a reason', () => {
    assert.deepEqual(validateClearanceDecision('cleared', ''), {});
    assert.ok(validateClearanceDecision('blocked', ' no ').note);
    assert.deepEqual(validateClearanceDecision('blocked', 'Staff loan of the member still outstanding.'), {});
    assert.ok(validateClearanceDecision('done', '').status);
    assert.ok(validateCancelReason('x'));
    assert.equal(validateCancelReason('Opened on the wrong employee.'), null);
  });

  it('the five exit kinds and four units exist', () => {
    assert.deepEqual(EXIT_KINDS.map((k) => k.code), ['resignation', 'retirement', 'contract_end', 'termination', 'death']);
    assert.deepEqual(CLEARANCE_UNITS.map((u) => u.code), ['accounts', 'it_admin', 'branch', 'hr']);
  });

  it('builds the legacy termination mirror row', () => {
    assert.deepEqual(terminationMirror('resignation', { noticeDate: '2026-10-01', lastWorkingDayAd: '2026-11-15', reason: 'Further study' }), {
      informedDate: '2026-10-01',
      terminationDate: '2026-11-15',
      type: 'Resignation',
      reason: 'Further study',
    });
    assert.equal(terminationMirror('contract_end', { noticeDate: '', lastWorkingDayAd: '2026-11-15', reason: '' }).informedDate, null);
  });
});

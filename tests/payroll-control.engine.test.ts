import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  asCheckerMode,
  canApproveRun,
  canPublishRun,
  checkerRefusal,
  slipVisibleToEmployee,
  unresolvedFlags,
  varianceFlags,
  type SlipFact,
} from '../lib/engines/payroll-control.engine';

// 4.8 / F1–F3: variance review, maker-checker, who sees a payslip. Pre-flight is the pay run
// workspace's (tests/payroll-run.test.ts).

const slip = (id: string, net: number, over: Partial<SlipFact> = {}): SlipFact => ({ employeeId: id, code: id.toUpperCase(), name: `Person ${id}`, basic: 30000, gross: net + 3000, net, ot: 0, bankAccount: '0011', ...over });

describe('variance flags', () => {
  it('flags a net change beyond the threshold, in either direction', () => {
    const flags = varianceFlags([slip('a', 40000), slip('b', 24000), slip('c', 30500)], [slip('a', 30000), slip('b', 30000), slip('c', 30000)]);
    assert.deepEqual(flags.map((f) => `${f.employeeId}:${f.code}`).sort(), ['a:net_change', 'b:net_change']);
  });

  it('a new hire is information only; someone dropped from the run needs a look', () => {
    const flags = varianceFlags([slip('a', 30000), slip('n', 20000)], [slip('a', 30000), slip('gone', 25000)]);
    const by = Object.fromEntries(flags.map((f) => [f.code, f]));
    assert.equal(by.new_in_payroll.severity, 'info');
    assert.equal(by.missing_from_run.severity, 'review');
    assert.equal(by.missing_from_run.employeeId, 'gone');
  });

  it('who is missing is not compared when the scope changed', () => {
    const flags = varianceFlags([slip('a', 30000)], [slip('a', 30000), slip('gone', 25000)], { thresholdPct: 15, otPctOfBasic: 50, sameScope: false });
    assert.equal(flags.length, 0);
  });

  it('without a previous run only the single-slip checks apply', () => {
    const flags = varianceFlags([slip('a', 0), slip('b', 30000, { bankAccount: ' ' }), slip('c', 30000, { ot: 20000 })], null);
    assert.deepEqual(flags.map((f) => f.code).sort(), ['no_bank_account', 'non_positive_net', 'ot_high']);
  });

  it('approval waits for every review flag to be acknowledged', () => {
    const flags = varianceFlags([slip('a', 0), slip('n', 20000)], [slip('a', 30000)]);
    const review = flags.filter((f) => f.severity === 'review');
    assert.ok(review.length >= 1);
    assert.ok(!canApproveRun(flags, new Set()));
    assert.equal(unresolvedFlags(flags, new Set([review[0].key])).length, review.length - 1);
    assert.ok(canApproveRun(flags, new Set(review.map((f) => f.key))));
  });

  it('info flags never block', () => {
    assert.ok(canApproveRun(varianceFlags([slip('n', 20000)], []), new Set()));
  });

  it('F13: pay going to a different account from last month needs a look (masked, with how it changed)', () => {
    const flags = varianceFlags([slip('a', 30000, { bankAccount: '0987654321001111', bankChangeNote: 'approved by Hari on 2026-10-10' })], [slip('a', 30000, { bankAccount: '0123456789014821' })]);
    assert.deepEqual(flags.map((f) => f.code), ['bank_changed']);
    assert.equal(flags[0].severity, 'review');
    assert.match(flags[0].detail, /••••4821 last month; this run pays ••••1111 \(approved by Hari on 2026-10-10\)/);
    assert.doesNotMatch(flags[0].detail, /0123456789/);
    // Same account with stray spaces, or last month's slip had none: nothing to compare.
    assert.equal(varianceFlags([slip('a', 30000, { bankAccount: '0011 ' })], [slip('a', 30000)]).length, 0);
    assert.deepEqual(varianceFlags([slip('a', 30000)], [slip('a', 30000, { bankAccount: 'N/A' })]).map((f) => f.code), []);
  });

  it('F13: a record that changed after the run was made is flagged until the run picks it up', () => {
    const stale = varianceFlags([slip('a', 30000, { bankAccount: '0123456789014821', recordBankAccount: '0987654321001111' })], null);
    assert.deepEqual(stale.map((f) => [f.code, f.severity]), [['bank_outdated', 'review']]);
    assert.match(stale[0].detail, /record now has account ••••1111; this run still pays ••••4821/);
    assert.equal(varianceFlags([slip('a', 30000, { recordBankAccount: '0011' })], null).length, 0);
    assert.equal(varianceFlags([slip('a', 30000, { recordBankAccount: null })], null).length, 0);
    // Different accounts with the same last four digits are not shown as "••••0001 → ••••0001".
    const sameEnd = varianceFlags([slip('a', 30000, { bankAccount: '01701100777700001' })], [slip('a', 30000, { bankAccount: '0170110000000001' })]);
    assert.match(sameEnd[0].detail, /different account from last month \(both end ••••0001\)/);
    const sameEndRecord = varianceFlags([slip('a', 30000, { bankAccount: '0170110000000001', recordBankAccount: '01701100777700001' })], null);
    assert.match(sameEndRecord[0].detail, /now has a new account; this run still pays the old one \(both end ••••0001\)/);
    // "N/A" on the slip is no account at all (flagged as such, not as outdated).
    assert.deepEqual(varianceFlags([slip('a', 30000, { bankAccount: 'N/A', recordBankAccount: '0011' })], null).map((f) => f.code), ['no_bank_account']);
  });
});

describe('maker-checker', () => {
  const base = { mode: 'admin_exempt' as const, step: 'approve' as const, generatedBy: 'u1', actor: 'u2', actorIsAdmin: false, runIncludesActor: false };
  it('someone else may approve', () => assert.equal(checkerRefusal(base), null));
  it('the generator may not approve or lock, unless an administrator in the default mode', () => {
    assert.equal(checkerRefusal({ ...base, actor: 'u1' }), 'generator');
    assert.equal(checkerRefusal({ ...base, actor: 'u1', step: 'lock' }), 'generator');
    assert.equal(checkerRefusal({ ...base, actor: 'u1', actorIsAdmin: true }), null);
  });
  it('strict mode has no administrator exemption and refuses a run that pays the approver', () => {
    assert.equal(checkerRefusal({ ...base, mode: 'strict', actor: 'u1', actorIsAdmin: true }), 'generator');
    assert.equal(checkerRefusal({ ...base, mode: 'strict', runIncludesActor: true }), 'own_pay');
    assert.equal(checkerRefusal({ ...base, runIncludesActor: true }), null);
  });
  it('anything but "strict" reads as the default', () => {
    assert.equal(asCheckerMode('strict'), 'strict');
    assert.equal(asCheckerMode('whatever'), 'admin_exempt');
    assert.equal(asCheckerMode(undefined), 'admin_exempt');
  });
});

describe('payslip visibility', () => {
  const day = new Date();
  it('only locked, published and not held', () => {
    assert.ok(slipVisibleToEmployee({ runStatus: 'LOCKED', runPublishedAt: day, slipHeldAt: null }));
    assert.ok(!slipVisibleToEmployee({ runStatus: 'APPROVED', runPublishedAt: day, slipHeldAt: null }));
    assert.ok(!slipVisibleToEmployee({ runStatus: 'LOCKED', runPublishedAt: null, slipHeldAt: null }));
    assert.ok(!slipVisibleToEmployee({ runStatus: 'LOCKED', runPublishedAt: day, slipHeldAt: day }));
  });
  it('publishing needs a locked run that is not yet published', () => {
    assert.ok(canPublishRun('LOCKED', null));
    assert.ok(!canPublishRun('LOCKED', day));
    assert.ok(!canPublishRun('DRAFT', null));
  });
});

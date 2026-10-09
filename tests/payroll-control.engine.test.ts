import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  asCheckerMode,
  canApproveRun,
  canPublishRun,
  checkerRefusal,
  hasBlocker,
  preflightFindings,
  slipVisibleToEmployee,
  unresolvedFlags,
  varianceFlags,
  type PreflightFacts,
  type SlipFact,
} from '../lib/engines/payroll-control.engine';

// 4.8 / F1–F3: variance review, maker-checker, pre-flight, who sees a payslip.

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

describe('pre-flight', () => {
  const clean: PreflightFacts = { openAttendanceBranches: [], employeesWithoutSalary: [], employeesNeedingSetup: [], pendingLeaveCount: 0, employeesWithoutBank: [], employeesWithoutPan: [], existingRunStatus: null, requireClosedAttendance: true };
  it('a clean month has no findings', () => assert.deepEqual(preflightFindings(clean), []));
  it('blockers stop the run, warnings do not', () => {
    const f = preflightFindings({ ...clean, employeesWithoutSalary: ['A (E1)'], employeesWithoutBank: ['B (E2)'] });
    assert.deepEqual(f.map((x) => `${x.code}:${x.severity}`), ['no_salary:blocker', 'no_bank_account:warning']);
    assert.ok(hasBlocker(f));
    assert.ok(!hasBlocker(f.filter((x) => x.severity === 'warning')));
  });
  it('open attendance is a blocker only when the company requires closed months', () => {
    assert.equal(preflightFindings({ ...clean, openAttendanceBranches: ['Lekhnath'] })[0].severity, 'blocker');
    assert.equal(preflightFindings({ ...clean, openAttendanceBranches: ['Lekhnath'], requireClosedAttendance: false })[0].severity, 'warning');
  });
  it('an existing locked run blocks; an unlocked one only warns', () => {
    assert.equal(preflightFindings({ ...clean, existingRunStatus: 'LOCKED' })[0].severity, 'blocker');
    assert.equal(preflightFindings({ ...clean, existingRunStatus: 'DRAFT' })[0].severity, 'warning');
  });
  it('pending leave blocks with the count', () => {
    const f = preflightFindings({ ...clean, pendingLeaveCount: 3 });
    assert.ok(/3 leave application/.test(f[0].title));
  });
});

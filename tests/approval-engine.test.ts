import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDecision,
  availableActions,
  buildFlow,
  isCompanyAdministrator,
  parsePolicy,
  statusText,
  validatePolicy,
  waitingFor,
  type ApprovalActor,
  type ApprovalRequest,
} from '../lib/engines/approval.engine';
import type { ApproverInfo } from '../lib/types/approval';

// Zoho Payroll-style approvals (4.4 follow-up) with S21: nobody approves a
// request about themselves; a preparer never approves their own request except
// an administrator's recorded Final approve.

const person = (userId: string, employeeId: string | null, over: Partial<ApproverInfo> = {}): ApproverInfo => ({
  userId, name: userId.toUpperCase(), employeeId, active: true, canApprove: true, delegatedTo: null, delegatedUntil: null, ...over,
});
// Ram: company administrator (employee eRam). Hari: owner. Gita: finance head. Sita: HR (prepares, cannot approve).
const approvers = [person('ram', 'eRam'), person('hari', 'eHari'), person('gita', 'eGita'), person('sita', 'eSita', { canApprove: false })];
const actor = (id: string, over: Partial<ApprovalActor> = {}): ApprovalActor => {
  const a = approvers.find((x) => x.userId === id)!;
  return { userId: id, employeeId: a.employeeId, canApprove: a.canApprove, isAdministrator: id === 'ram', ...over };
};
const ctx = { approvers, today: '2026-10-04' };
const twoLevels = { type: 'multi_level' as const, levels: ['gita', 'hari'] };
const submit = (policy: Parameters<typeof buildFlow>[0], preparer: string, subjects: string[]) =>
  buildFlow(policy, { preparerId: preparer, preparerEmployeeId: approvers.find((a) => a.userId === preparer)!.employeeId, subjectEmployeeIds: subjects, approvers });
const request = (outcome: ReturnType<typeof submit>, preparer: string, subjects: string[]): ApprovalRequest => ({
  status: 'pending', preparedById: preparer, subjectEmployeeIds: subjects, flow: outcome.flow, currentLevel: outcome.currentLevel,
});

describe('Approval settings', () => {
  it('reads stored settings; older yes / no values become simple / none', () => {
    assert.deepEqual(parsePolicy(null), { type: 'simple', levels: [] });
    assert.deepEqual(parsePolicy(null, 'false'), { type: 'none', levels: [] });
    assert.deepEqual(parsePolicy({ type: 'multi_level', levels: ['a', 'a', 'b', 3] }), { type: 'multi_level', levels: ['a', 'b'] });
    assert.deepEqual(parsePolicy({ type: 'multi_level', levels: [] }), { type: 'simple', levels: [] });
    assert.deepEqual(parsePolicy({ type: 'hack' }), { type: 'simple', levels: [] });
  });
  it('multi-level needs active approvers who can approve, each once', () => {
    assert.deepEqual(validatePolicy(twoLevels, approvers), {});
    assert.ok(validatePolicy({ type: 'multi_level', levels: [] }, approvers).levels);
    assert.ok(validatePolicy({ type: 'multi_level', levels: ['gita', 'gita'] }, approvers)['level.2']);
    assert.ok(validatePolicy({ type: 'multi_level', levels: ['sita'] }, approvers)['level.1']);
    assert.ok(validatePolicy({ type: 'multi_level', levels: ['nobody'] }, approvers)['level.1']);
  });
  it('an administrator is company-wide with Approve, never platform support', () => {
    assert.equal(isCompanyAdministrator({ scopeType: 'GLOBAL' }, true), true);
    assert.equal(isCompanyAdministrator({ scopeType: 'BRANCH' }, true), false);
    assert.equal(isCompanyAdministrator({ scopeType: 'GLOBAL' }, false), false);
    assert.equal(isCompanyAdministrator({ scopeType: 'GLOBAL', isImpersonation: true }, true), false);
  });
});

describe('Submitting', () => {
  it('no approval: counts at once, except a change to the preparer\'s own salary', () => {
    assert.equal(submit({ type: 'none', levels: [] }, 'sita', ['e1']).approvedAtOnce, true);
    const own = submit({ type: 'none', levels: [] }, 'sita', ['e1', 'eSita']);
    assert.equal(own.approvedAtOnce, false);
    assert.equal(own.flow.type, 'simple');
  });
  it('multi-level: starts at Level 1; levels of the preparer or about the approver are skipped', () => {
    const plain = submit(twoLevels, 'sita', ['e1']);
    assert.equal(plain.approvedAtOnce, false);
    assert.equal(plain.currentLevel, 1);
    const gitaPrepared = submit(twoLevels, 'gita', ['e1']);
    assert.equal(gitaPrepared.currentLevel, 2);
    assert.equal(gitaPrepared.flow.levels[0].skipped, 'preparer');
    const aboutHari = submit(twoLevels, 'sita', ['eHari']);
    assert.equal(aboutHari.flow.levels[1].skipped, 'own_salary');
  });
  it('every level skipped: falls back to simple', () => {
    const out = submit({ type: 'multi_level', levels: ['gita'] }, 'gita', ['e1']);
    assert.equal(out.flow.type, 'simple');
    assert.equal(out.flow.fellBack, true);
  });
});

describe('Deciding (multi-level)', () => {
  const r = request(submit(twoLevels, 'sita', ['e1']), 'sita', ['e1']);
  it('only the current level acts; others wait their turn', () => {
    assert.deepEqual(availableActions(r, actor('gita'), ctx).approve, { level: 1, onBehalfOf: null });
    assert.equal(availableActions(r, actor('hari'), ctx).approve, null);
    assert.match(availableActions(r, actor('hari'), ctx).reason ?? '', /Waiting for Level 1: GITA/);
  });
  it('Level 1 moves it to Level 2; the last level approves it', () => {
    const after1 = applyDecision(r, 'approve');
    assert.deepEqual(after1, { status: 'pending', currentLevel: 2, route: null });
    assert.deepEqual(applyDecision({ ...r, currentLevel: 2 }, 'approve'), { status: 'approved', currentLevel: 0, route: 'levels' });
    assert.equal(statusText({ ...r, currentLevel: 2 }, (id) => id.toUpperCase()), 'Level 2 of 2 · HARI');
  });
  it('an administrator may Final approve at any level (recorded); reject needs approve rights', () => {
    const a = availableActions(r, actor('ram'), ctx);
    assert.equal(a.finalApprove, true);
    assert.equal(a.approve, null);
    assert.equal(a.reject, true);
    assert.deepEqual(applyDecision(r, 'final_approve'), { status: 'approved', currentLevel: 0, route: 'final_approve' });
    assert.equal(availableActions(r, actor('sita'), ctx).reject, false);
  });
  it('a delegate acts for the level approver while the delegation lasts', () => {
    const away = { approvers: approvers.map((a) => (a.userId === 'gita' ? { ...a, delegatedTo: 'hari', delegatedUntil: '2026-10-10T00:00:00.000Z' } : a)), today: '2026-10-04' };
    assert.deepEqual(availableActions(r, actor('hari'), away).approve, { level: 1, onBehalfOf: 'gita' });
    assert.equal(availableActions(r, actor('hari'), { ...away, today: '2026-10-11' }).approve, null);
  });
  it('a level approver who can no longer approve leaves it stuck: only Final approve moves it', () => {
    const gone = { approvers: approvers.map((a) => (a.userId === 'gita' ? { ...a, active: false } : a)), today: '2026-10-04' };
    assert.match(availableActions(r, actor('gita'), gone).stuck ?? '', /can no longer approve/);
    assert.equal(availableActions(r, actor('ram'), gone).finalApprove, true);
    assert.equal(waitingFor(r, actor('ram'), gone), true);
  });
});

describe('Your own salary and your own change (S21)', () => {
  it('nobody approves, rejects or Final approves a change to their own salary', () => {
    const aboutRam = request(submit({ type: 'simple', levels: [] }, 'sita', ['e1', 'eRam']), 'sita', ['e1', 'eRam']);
    const a = availableActions(aboutRam, actor('ram'), ctx);
    assert.equal(a.approve, null);
    assert.equal(a.finalApprove, false);
    assert.equal(a.reject, false);
    assert.match(a.reason ?? '', /your own salary/);
    assert.deepEqual(availableActions(aboutRam, actor('hari'), ctx).approve, { level: 0, onBehalfOf: null });
  });
  it('the administrator\'s change to their own salary waits for someone else', () => {
    const out = submit({ type: 'none', levels: [] }, 'ram', ['eRam']);
    assert.equal(out.approvedAtOnce, false);
    const r = request(out, 'ram', ['eRam']);
    assert.equal(availableActions(r, actor('ram'), ctx).finalApprove, false);
    assert.equal(availableActions(r, actor('ram'), ctx).withdraw, true);
    assert.ok(availableActions(r, actor('hari'), ctx).approve);
  });
  it('a preparer never approves their own change; an administrator may Final approve it (recorded)', () => {
    const sitaOwn = request(submit({ type: 'simple', levels: [] }, 'gita', ['e1']), 'gita', ['e1']);
    assert.equal(availableActions(sitaOwn, actor('gita'), ctx).approve, null);
    assert.equal(availableActions(sitaOwn, actor('gita'), ctx).reject, false); // withdraw instead
    const ramOwn = request(submit({ type: 'simple', levels: [] }, 'ram', ['e1']), 'ram', ['e1']);
    const a = availableActions(ramOwn, actor('ram'), ctx);
    assert.equal(a.approve, null);
    assert.equal(a.finalApprove, true);
    assert.equal(waitingFor(ramOwn, actor('ram'), ctx), true);
  });
  it('only the preparer withdraws, and only while it waits', () => {
    const r = request(submit({ type: 'simple', levels: [] }, 'sita', ['e1']), 'sita', ['e1']);
    assert.equal(availableActions(r, actor('sita'), ctx).withdraw, true);
    assert.equal(availableActions(r, actor('hari'), ctx).withdraw, false);
    assert.equal(availableActions({ ...r, status: 'approved' }, actor('sita'), ctx).withdraw, false);
    assert.deepEqual(applyDecision(r, 'withdraw'), { status: 'withdrawn', currentLevel: 0, route: null });
  });
});

describe('Leave policy changes: never approved by the proposer (4.6c)', () => {
  const simple = { status: 'pending' as const, preparedById: 'ram', subjectEmployeeIds: [], flow: { type: 'simple' as const, levels: [] }, currentLevel: 0 };
  const strict = { ...ctx, preparerMayFinalApprove: false };
  it('an administrator who proposed it cannot approve or Final approve it, only withdraw', () => {
    const a = availableActions(simple, actor('ram'), strict);
    assert.equal(a.approve, null);
    assert.equal(a.finalApprove, false);
    assert.equal(a.reject, false);
    assert.equal(a.withdraw, true);
    assert.match(a.reason ?? '', /someone else has to approve it/);
    assert.equal(waitingFor(simple, actor('ram'), strict), false);
  });
  it('another person with Approve can approve; an administrator who did not propose it can Final approve', () => {
    assert.ok(availableActions(simple, actor('gita'), strict).approve);
    assert.equal(availableActions({ ...simple, preparedById: 'gita' }, actor('ram'), strict).finalApprove, true);
  });
  it('salary changes keep "save and approve now" for administrators', () => {
    assert.equal(availableActions(simple, actor('ram'), ctx).finalApprove, true);
  });
});

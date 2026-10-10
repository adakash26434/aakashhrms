import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextRunStep, runConcerns, type RunStepActor, type RunStepFacts } from '../lib/engines/payroll-control.engine';
import { APPROVAL_KINDS, buildCentre, deadlineItems, runItems, runLabel } from '../lib/engines/notification.engine';
import type { Deadline } from '../lib/types/dashboard';
import type { RunWaiting } from '../lib/types/notification';

// F17 notification centre: the pay-run step that waits for a person (the same rules as the move
// itself), which runs concern their scope, and how counts, steps and deadlines become the bell.

const run = (over: Partial<RunStepFacts> = {}): RunStepFacts => ({ status: 'DRAFT', publishedAt: null, generatedBy: 'maker', heldCount: 0, includesActor: false, ...over });
const actor = (over: Partial<RunStepActor> = {}): RunStepActor => ({ userId: 'checker', isAdmin: false, mode: 'admin_exempt', canSend: true, canApprove: true, canLock: true, ...over });

describe('the next step on a pay run', () => {
  it('follows the status, and only with the permission the move needs', () => {
    assert.equal(nextRunStep(run(), actor()), 'send');
    assert.equal(nextRunStep(run(), actor({ canSend: false })), null);
    assert.equal(nextRunStep(run({ status: 'UNDER_REVIEW' }), actor()), 'approve');
    assert.equal(nextRunStep(run({ status: 'UNDER_REVIEW' }), actor({ canApprove: false })), null);
    assert.equal(nextRunStep(run({ status: 'APPROVED' }), actor()), 'lock');
    assert.equal(nextRunStep(run({ status: 'APPROVED' }), actor({ canLock: false })), null);
    assert.equal(nextRunStep(run({ status: 'LOCKED' }), actor()), 'publish');
    assert.equal(nextRunStep(run({ status: 'LOCKED', heldCount: 2 }), actor()), 'publish');
    assert.equal(nextRunStep(run({ status: 'LOCKED', publishedAt: '2026-10-01', heldCount: 2 }), actor()), 'release');
    assert.equal(nextRunStep(run({ status: 'LOCKED', publishedAt: '2026-10-01' }), actor()), null);
    assert.equal(nextRunStep(run({ status: 'LOCKED' }), actor({ canLock: false })), null);
    assert.equal(nextRunStep(run({ status: 'SOMETHING' }), actor()), null);
  });

  it('never offers the maker their own approval or lock (F2), except an administrator in the default mode', () => {
    const mine = { generatedBy: 'checker' };
    assert.equal(nextRunStep(run({ ...mine, status: 'UNDER_REVIEW' }), actor()), null);
    assert.equal(nextRunStep(run({ ...mine, status: 'APPROVED' }), actor()), null);
    assert.equal(nextRunStep(run({ ...mine, status: 'UNDER_REVIEW' }), actor({ isAdmin: true })), 'approve');
    assert.equal(nextRunStep(run({ ...mine, status: 'UNDER_REVIEW' }), actor({ isAdmin: true, mode: 'strict' })), null);
    // Sending a draft and publishing are not maker-checker steps.
    assert.equal(nextRunStep(run(mine), actor()), 'send');
    assert.equal(nextRunStep(run({ ...mine, status: 'LOCKED' }), actor()), 'publish');
  });

  it('strict mode never offers a run that pays the person', () => {
    const paysMe = run({ status: 'UNDER_REVIEW', includesActor: true });
    assert.equal(nextRunStep(paysMe, actor({ mode: 'strict' })), null);
    assert.equal(nextRunStep({ ...paysMe, status: 'APPROVED' }, actor({ mode: 'strict', isAdmin: true })), null);
    assert.equal(nextRunStep(paysMe, actor()), 'approve');
  });
});

describe('which runs concern a person', () => {
  const runFor = (branchIds: string[], departmentIds: string[] | null = []) => ({ branchIds, departmentIds });
  it('company-wide people see every run; self-scoped people none', () => {
    assert.equal(runConcerns(runFor(['b2']), { scopeType: 'GLOBAL', branchIds: [], departmentIds: [] }), true);
    assert.equal(runConcerns(runFor([]), { scopeType: 'SELF', branchIds: [], departmentIds: [] }), false);
  });
  it('branch people see runs for every branch or one of theirs', () => {
    const lekhnath = { scopeType: 'BRANCH' as const, branchIds: ['b1'], departmentIds: [] };
    assert.equal(runConcerns(runFor([]), lekhnath), true);
    assert.equal(runConcerns(runFor(['b1', 'b2']), lekhnath), true);
    assert.equal(runConcerns(runFor(['b2']), lekhnath), false);
  });
  it('department people go by the run\'s departments (none listed: all)', () => {
    const accounts = { scopeType: 'DEPARTMENT' as const, branchIds: [], departmentIds: ['d1'] };
    assert.equal(runConcerns(runFor(['b2'], null), accounts), true);
    assert.equal(runConcerns(runFor(['b2'], ['d1']), accounts), true);
    assert.equal(runConcerns(runFor([], ['d2']), accounts), false);
  });
});

const waiting = (over: Partial<RunWaiting> = {}): RunWaiting => ({ id: 'r1', year: 2083, month: 5, runType: 'REGULAR', step: 'approve', heldCount: 0, generatedByName: 'Hari Thapa', ...over });

describe('pay-run items', () => {
  it('names the month and the run type', () => {
    assert.equal(runLabel(waiting()), 'Bhadra 2083 payroll');
    assert.equal(runLabel(waiting({ runType: 'FESTIVAL', month: 6 })), 'Festival allowance · Aswin 2083');
  });

  it('says what to do, counts each step once, and lists held payslips without counting them', () => {
    const items = runItems([
      waiting({ id: 'held', step: 'release', heldCount: 1 }),
      waiting({ id: 'draft', step: 'send' }),
      waiting({ id: 'pub', step: 'publish', heldCount: 2 }),
      waiting({ id: 'rev', step: 'approve' }),
    ]);
    assert.deepEqual(items.map((i) => i.id), ['run:rev', 'run:pub', 'run:draft', 'run:held']);
    assert.deepEqual(items.map((i) => i.count), [1, 1, 1, 0]);
    assert.deepEqual(items.map((i) => i.tag), ['Approve', 'Publish', 'Send', 'On hold']);
    assert.deepEqual(items.map((i) => i.detail), [
      'Prepared by Hari Thapa — approve it or send it back',
      'Locked — publish the payslips (2 payslips held back)',
      'Draft by Hari Thapa — send it for review',
      '1 payslip held back from employees',
    ]);
    assert.equal(items[0].href, '/payroll?runId=rev');
  });
});

const deadline = (daysLeft: number, over: Partial<Deadline> = {}): Deadline => ({
  id: `tds-2083-5-${daysLeft}`,
  ruleId: 'tds',
  code: 'TDS',
  title: 'Deposit salary TDS',
  authority: 'Inland Revenue Department',
  basis: '',
  forPeriod: 'Bhadra 2083',
  forYear: 2083,
  forMonth: 5,
  dueDate: '2026-10-11',
  daysLeft,
  ...over,
});

describe('deposit deadlines', () => {
  it('lists deposits due within a week and ones just passed, toned by how close they are', () => {
    const items = deadlineItems([deadline(1), deadline(5), deadline(12), deadline(-2)], '/payroll/statutory');
    assert.deepEqual(items.map((i) => [i.tag, i.tone]), [['Tomorrow', 'danger'], ['5 days', 'warning'], ['2 days ago', 'danger']]);
    assert.equal(items[0].detail, 'Due Aswin 25, 2083 · Inland Revenue Department');
    assert.match(items[2].detail, /^Was due Aswin 25, 2083 — check it was deposited$/);
    assert.ok(items.every((i) => i.count === 0 && i.href === '/payroll/statutory'));
  });
});

describe('the centre', () => {
  const input = { approvals: {}, runs: [], deadlines: null, deadlineHref: '/dashboard', enabled: true };

  it('lists only kinds with something waiting, in a fixed order, and counts them on the bell', () => {
    const c = buildCentre({ ...input, approvals: { travel: 2, leave: 3, salary: 0, details: null }, runs: [waiting()] });
    assert.deepEqual(c.items.map((i) => i.id), ['leave', 'travel', 'run:r1']);
    assert.equal(c.total, 6);
    assert.equal(c.items[0].href, '/timeAndLeave/leaves?tab=requests');
    assert.equal(c.urgent, false);
  });

  it('a deposit due within three days is urgent (a dot), never a count; one already passed is not', () => {
    assert.equal(buildCentre({ ...input, deadlines: [deadline(3)] }).urgent, true);
    assert.equal(buildCentre({ ...input, deadlines: [deadline(0)] }).total, 0);
    assert.equal(buildCentre({ ...input, deadlines: [deadline(4)] }).urgent, false);
    assert.equal(buildCentre({ ...input, deadlines: [deadline(-1)] }).urgent, false);
  });

  it('nothing to show for someone who can receive nothing: the bell is hidden', () => {
    assert.deepEqual(buildCentre({ ...input, enabled: false }), { items: [], total: 0, urgent: false, enabled: false });
    // Something waiting (a supervisor's team) still shows it.
    assert.equal(buildCentre({ ...input, enabled: false, approvals: { teamTargets: 1 } }).enabled, true);
  });

  it('every kind links to a screen, opened on what waits', () => {
    const hrefs = Object.fromEntries(APPROVAL_KINDS.map((k) => [k.kind, k.href]));
    assert.equal(hrefs.travel, '/payroll/travel?status=submitted');
    assert.equal(hrefs.targets, '/workforce/targets?status=forwarded');
    assert.equal(hrefs.evaluations, '/workforce/evaluation?status=waiting');
    assert.equal(new Set(APPROVAL_KINDS.map((k) => k.kind)).size, APPROVAL_KINDS.length);
  });
});

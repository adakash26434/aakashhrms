import { BS_MONTHS_EN, formatBSDate } from '@/lib/utils/bs-calendar';
import { toLocalDate } from '@/lib/utils/nepal-time';
import { RUN_TYPE_LABEL, asRunType, isOffCycle } from '@/lib/constants/run-types';
import { deadlineTone, deadlineWhen } from '@/lib/engines/dashboard.engine';
import type { Deadline } from '@/lib/types/dashboard';
import type { ApprovalKind, NotificationCentre, NotificationItem, RunStep, RunWaiting } from '@/lib/types/notification';

// F17 notification centre: pure rules for what the title-bar bell lists. Every module counts
// what waits for this person by its own rules (scope, never one's own record, the approval
// engine, maker-checker); this file turns those counts, the pay-run steps and the statutory
// deposit deadlines into one list and the number on the bell. Nothing here touches the database.

export interface ApprovalKindDef {
  kind: ApprovalKind;
  label: string;
  /** What the person does with them. */
  detail: string;
  href: string;
}

/** The order the bell lists requests in; each link opens the list filtered to what waits. */
export const APPROVAL_KINDS: readonly ApprovalKindDef[] = [
  { kind: 'leave', label: 'Leave requests', detail: 'Approve or reject', href: '/timeAndLeave/leaves?tab=requests' },
  { kind: 'attendance', label: 'Attendance adjustments', detail: 'Corrections and clock-ins away from the office', href: '/timeAndLeave/attendance?tab=adjustments' },
  { kind: 'salary', label: 'Salary changes', detail: 'Revisions waiting for your approval', href: '/workforce/salary-mapping?tab=approvals' },
  { kind: 'details', label: 'Bank, PAN & tax changes', detail: 'Changes waiting for a second person', href: '/workforce/employees/changes' },
  { kind: 'reimbursements', label: 'Reimbursement claims', detail: 'Approve, return or reject', href: '/payroll/reimbursements' },
  { kind: 'travel', label: 'Travel claims', detail: 'Approve, return or reject', href: '/payroll/travel?status=submitted' },
  { kind: 'leavePolicy', label: 'Leave policies', detail: 'Changes to approve, or exceptions ending soon', href: '/timeAndLeave/policies?tab=types' },
  { kind: 'evaluations', label: 'Evaluations to mark', detail: 'Your stage of the evaluation', href: '/workforce/evaluation?status=waiting' },
  { kind: 'targets', label: 'Achievements to close', detail: 'Forwarded by supervisors', href: '/workforce/targets?status=forwarded' },
  { kind: 'teamTargets', label: "Your team's achievements", detail: 'Reported, waiting for you to verify', href: '/self-service/team-targets' },
];

/** Deposits due within this many days (or passed, see `RECENTLY_PASSED_DAYS`) are listed. */
export const DEADLINE_WINDOW_DAYS = 7;
/** Deposits due within this many days put a dot on the bell. */
export const URGENT_DAYS = 3;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Bhadra 2083 payroll", or "Festival allowance · Ashwin 2083" for an off-cycle run. */
export function runLabel(run: Pick<RunWaiting, 'year' | 'month' | 'runType'>): string {
  const period = `${BS_MONTHS_EN[run.month] ?? `Month ${run.month}`} ${run.year}`;
  const type = asRunType(run.runType);
  return isOffCycle(type) ? `${RUN_TYPE_LABEL[type].en} · ${period}` : `${period} payroll`;
}

function runDetail(run: RunWaiting): string {
  const by = run.generatedByName ? ` by ${run.generatedByName}` : '';
  switch (run.step) {
    case 'send':
      return `Draft${by} — send it for review`;
    case 'approve':
      return `Prepared${by} — approve it or send it back`;
    case 'lock':
      return 'Approved — lock it';
    case 'publish':
      return run.heldCount > 0 ? `Locked — publish the payslips (${plural(run.heldCount, 'payslip')} held back)` : 'Locked — publish the payslips to employees';
    case 'release':
      return `${plural(run.heldCount, 'payslip')} held back from employees`;
  }
}

/** Steps that move a run towards payment first; held payslips last. */
const STEP_ORDER: Record<RunStep, number> = { approve: 0, lock: 1, publish: 2, send: 3, release: 4 };
const STEP_TAG: Record<RunStep, string> = { approve: 'Approve', lock: 'Lock', publish: 'Publish', send: 'Send', release: 'On hold' };

export function runItems(runs: readonly RunWaiting[]): NotificationItem[] {
  return [...runs]
    .sort((a, b) => STEP_ORDER[a.step] - STEP_ORDER[b.step])
    .map((run) => ({
      id: `run:${run.id}`,
      group: 'payroll' as const,
      label: runLabel(run),
      detail: runDetail(run),
      // Held payslips are a reminder: listed, not counted.
      count: run.step === 'release' ? 0 : 1,
      href: `/payroll?runId=${encodeURIComponent(run.id)}`,
      tone: 'neutral' as const,
      tag: STEP_TAG[run.step],
    }));
}

/** Statutory deposits due within a week, and ones passed recently (deposits are not tracked yet: F10). */
export function deadlineItems(deadlines: readonly Deadline[], href: string): NotificationItem[] {
  return deadlines
    .filter((d) => d.daysLeft <= DEADLINE_WINDOW_DAYS)
    .map((d) => {
      const due = toLocalDate(d.dueDate);
      const on = due ? formatBSDate(due) : d.dueDate;
      return {
        id: `deadline:${d.id}`,
        group: 'deadlines' as const,
        label: `${d.title} (${d.forPeriod})`,
        detail: d.daysLeft >= 0 ? `Due ${on} · ${d.authority}` : `Was due ${on} — check it was deposited`,
        count: 0,
        href,
        tone: deadlineTone(d.daysLeft),
        tag: deadlineWhen(d.daysLeft),
      };
    });
}

export interface CentreInput {
  /** Waiting counts by kind; a kind this person cannot decide is left out (or null). */
  approvals: Partial<Record<ApprovalKind, number | null>>;
  runs: readonly RunWaiting[];
  /** Upcoming deposits (people who see payroll), or null. */
  deadlines: readonly Deadline[] | null;
  deadlineHref: string;
  /** The person can receive anything at all. */
  enabled: boolean;
}

export function buildCentre(input: CentreInput): NotificationCentre {
  const approvals = APPROVAL_KINDS.flatMap((def): NotificationItem[] => {
    const n = Math.max(0, Math.trunc(input.approvals[def.kind] ?? 0));
    return n > 0 ? [{ id: def.kind, group: 'approvals', label: def.label, detail: def.detail, count: n, href: def.href, tone: 'neutral' }] : [];
  });
  const deadlines = input.deadlines ?? [];
  const items = [...approvals, ...runItems(input.runs), ...deadlineItems(deadlines, input.deadlineHref)];
  return {
    items,
    total: items.reduce((sum, i) => sum + i.count, 0),
    urgent: deadlines.some((d) => d.daysLeft >= 0 && d.daysLeft <= URGENT_DAYS),
    enabled: input.enabled || items.length > 0,
  };
}

export const EMPTY_CENTRE: NotificationCentre = { items: [], total: 0, urgent: false, enabled: false };

// ---- emails ------------------------------------------------------------------------

export interface NoticeEmail {
  subject: string;
  lines: string[];
}

/**
 * The daily "waiting for you" email (scheduled job `approval-digest`): requests and pay-run steps,
 * as the bell counts them. Deposits have their own reminder. Null when nothing waits.
 */
export function digestEmail(centre: NotificationCentre, appUrl: string | null): NoticeEmail | null {
  const waiting = centre.items.filter((i) => i.count > 0);
  if (!waiting.length) return null;
  const total = waiting.reduce((sum, i) => sum + i.count, 0);
  return {
    subject: `${total} waiting for you`,
    lines: [
      'Waiting for you in AakashHRMS this morning:',
      ...waiting.map((i) => (i.group === 'payroll' ? `${i.label}: ${i.detail}` : `${i.label}: ${i.count}`)),
      `Sign in${appUrl ? ` at ${appUrl}` : ''} and open the bell at the top right to act on them.`,
      'Your company sends this email each morning while the daily "Waiting for you" email is switched on (Administration → Scheduled jobs).',
    ],
  };
}

export interface LockoutNoticeInput {
  failedAttempts: number;
  lockMinutes: number;
  /** BS date and Nepal time of the lock, already formatted ("Aswin 24, 2083 at 13:22"). */
  when: string;
  /** The address the attempts came from, when known. */
  ip: string | null;
}

/** S5: the account owner hears once when repeated wrong passwords pause sign-in (no password, no link to click). */
export function lockoutNotice(i: LockoutNoticeInput): NoticeEmail {
  const from = i.ip ? ` from the address ${i.ip}` : '';
  return {
    subject: 'Sign-in to your account was paused',
    lines: [
      `On ${i.when} (Nepal time) a wrong password was entered ${i.failedAttempts} times for your account${from}.`,
      `To protect it, sign-in is paused for ${plural(i.lockMinutes, 'minute')} (longer if the attempts continue). Signing in with the right password after that clears it.`,
      'If this was you, wait and try again, or ask your administrator to reset your password.',
      'If it was not you, tell your administrator. Nobody from the company will ask you for your password.',
    ],
  };
}

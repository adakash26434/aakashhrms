import * as repo from '@/lib/repositories/jobs.repository';
import { applyDueEvents } from '@/lib/services/employee-event.service';
import { postMonthlyContributions } from '@/lib/services/fund.service';
import { sendNoticeEmail } from '@/lib/services/email.service';
import { getCompanyProfileSetup } from '@/lib/repositories/company-setup.repository';
import {
  JOB_DEFINITIONS,
  birthdaysToday,
  complianceReminders,
  isDue,
  probationDue,
  type JobDefinition,
} from '@/lib/engines/scheduler.engine';
import { BS_MONTHS_EN, adToBS } from '@/lib/utils/bs-calendar';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';

// Scheduled jobs (G6): runs inside one tenant's context (the tick route sets
// it per company). Every job claims its day first (claim-first, so two
// overlapping ticks never double-run), then works, then logs. One failing
// job never stops the others.

export interface TenantTickSummary {
  ran: string[];
  skipped: string[];
  errors: string[];
}

type JobResult = { detail: string; items: number };

async function companyName(): Promise<string> {
  const company = await getCompanyProfileSetup().catch(() => null);
  return company?.displayName || company?.legalName || 'AakashHRMS';
}

async function runJob(def: JobDefinition, bsDay: number, bsMonthName: string, previousBsMonthName: string, today: string): Promise<JobResult> {
  if (def.code === 'apply-scheduled-events') {
    const applied = await applyDueEvents();
    return { detail: applied ? `${applied} scheduled event(s) applied.` : 'Nothing due.', items: applied };
  }

  if (def.code === 'fund-contributions') {
    const result = await postMonthlyContributions();
    return { detail: result.funds ? `${result.posted} contribution line(s) posted across ${result.funds} fund(s).` : 'No active funds.', items: result.posted };
  }

  if (def.code === 'compliance-reminders') {
    const reminders = complianceReminders(bsDay, bsMonthName, previousBsMonthName);
    if (!reminders.length) return { detail: 'No deadline falls on this day.', items: 0 };
    const [to, name] = await Promise.all([repo.adminRecipients(), companyName()]);
    let sent = 0;
    for (const r of reminders) {
      const result = await sendNoticeEmail({ to, subject: r.subject, lines: r.lines, companyName: name });
      if (result.success) sent += 1;
    }
    return { detail: `${sent}/${reminders.length} reminder email(s) sent to ${to.length} recipient(s).`, items: sent };
  }

  if (def.code === 'probation-confirmations') {
    const due = probationDue(await repo.probationEmployees(), today);
    if (!due.length) return { detail: 'Nobody past probation without confirmation.', items: 0 };
    const [to, name] = await Promise.all([repo.adminRecipients(), companyName()]);
    const result = await sendNoticeEmail({
      to,
      subject: `${due.length} confirmation${due.length === 1 ? '' : 's'} due`,
      lines: [
        'These employees have served past the probation period without a confirmation decision:',
        ...due.slice(0, 30).map((e) => `${e.fullName} (${e.employeeCode}) — ${e.category}, ${e.daysServed} days since joining`),
        'Record the confirmation (or the decision not to confirm) under Workforce → Lifecycle events.',
      ],
      companyName: name,
    });
    return { detail: `${due.length} due; email ${result.success ? 'sent' : `failed: ${result.error}`}.`, items: due.length };
  }

  if (def.code === 'birthday-greetings') {
    const birthdays = birthdaysToday(await repo.birthdayEmployees(), today);
    if (!birthdays.length) return { detail: 'No birthdays today.', items: 0 };
    const [to, name] = await Promise.all([repo.adminRecipients(), companyName()]);
    const result = await sendNoticeEmail({
      to,
      subject: `Birthday${birthdays.length === 1 ? '' : 's'} today 🎂`,
      lines: [
        `Today (${today}):`,
        ...birthdays.map((e) => `${e.fullName} (${e.employeeCode})`),
      ],
      companyName: name,
    });
    return { detail: `${birthdays.length} birthday(s); email ${result.success ? 'sent' : `failed: ${result.error}`}.`, items: birthdays.length };
  }

  return { detail: 'Unknown job.', items: 0 };
}

/** Runs every due job for the tenant in context. */
export async function runDueJobsForTenant(): Promise<TenantTickSummary> {
  const todayDate = nepalToday();
  const today = toIsoDate(todayDate);
  const bs = adToBS(todayDate);
  const bsMonthName = BS_MONTHS_EN[bs.month] ?? String(bs.month);
  const previousBsMonthName = BS_MONTHS_EN[bs.month === 1 ? 12 : bs.month - 1] ?? String(bs.month - 1);

  await repo.ensureJobRows(JOB_DEFINITIONS.map((j) => j.code));
  const states = new Map((await repo.jobStates()).map((s) => [s.code, s]));

  const summary: TenantTickSummary = { ran: [], skipped: [], errors: [] };
  for (const def of JOB_DEFINITIONS) {
    const state = states.get(def.code);
    const due = isDue(def.cadence, {
      today,
      weekday: todayDate.getDay(),
      bsDay: bs.day,
      lastRunDay: state?.lastRunDay ?? null,
      enabled: state?.enabled ?? true,
    });
    if (!due) {
      summary.skipped.push(def.code);
      continue;
    }
    if (!(await repo.claimJob(def.code, today))) {
      summary.skipped.push(def.code);
      continue;
    }
    const runId = await repo.startRun(def.code);
    try {
      const result = await runJob(def, bs.day, bsMonthName, previousBsMonthName, today);
      await repo.finishRun(runId, 'ok', result.detail, result.items);
      await repo.finishJob(def.code, 'ok', result.detail);
      summary.ran.push(def.code);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Job failed';
      await repo.finishRun(runId, 'error', message, 0).catch(() => {});
      await repo.finishJob(def.code, 'error', message).catch(() => {});
      summary.errors.push(def.code);
    }
  }
  return summary;
}

export { JOB_DEFINITIONS };

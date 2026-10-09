// Scheduled jobs (G6, docs/redesign/06-hrms-gap-analysis.md): pure rules —
// no database access, unit-tested in tests/scheduler.test.ts.
//
// Jobs are code-defined here; lib/services/jobs.service.ts runs the due ones
// when cron hits /api/jobs/tick. Every job is idempotent per Nepal day: a job
// never runs twice on one day, and a missed day is simply skipped (reminders
// repeat on their next due day).

export type JobCadence =
  | { kind: 'daily' }
  | { kind: 'bs-days'; days: number[] } // runs on these days of the BS month
  | { kind: 'weekday'; day: number }; // 0 = Sunday (the Nepali week start)

export interface JobDefinition {
  code: string;
  name: string;
  description: string;
  cadence: JobCadence;
}

export const JOB_DEFINITIONS: readonly JobDefinition[] = [
  {
    code: 'apply-scheduled-events',
    name: 'Apply scheduled lifecycle events',
    description: 'Applies promotions, transfers and confirmations whose effective date has arrived, even if nobody opens the register.',
    cadence: { kind: 'daily' },
  },
  {
    code: 'compliance-reminders',
    name: 'Statutory deadline reminders',
    description: 'SSF deposit (within 15 days of BS month end — reminded on the 10th) and IRD eTDS (by the 25th — reminded on the 20th), emailed to administrators.',
    cadence: { kind: 'bs-days', days: [10, 20] },
  },
  {
    code: 'probation-confirmations',
    name: 'Confirmations due',
    description: 'Weekly list of employees past the probation period but not yet confirmed, emailed to administrators.',
    cadence: { kind: 'weekday', day: 0 },
  },
  {
    code: 'birthday-greetings',
    name: 'Birthdays today',
    description: "Today's birthdays, emailed to administrators for a greeting.",
    cadence: { kind: 'daily' },
  },
];

export const jobDefinition = (code: string) => JOB_DEFINITIONS.find((j) => j.code === code) ?? null;

export interface DueContext {
  /** Nepal day, YYYY-MM-DD (AD). */
  today: string;
  /** 0 = Sunday. */
  weekday: number;
  /** Day of the BS month, 1-based. */
  bsDay: number;
  /** The job's stored last-run day (YYYY-MM-DD AD), if any. */
  lastRunDay: string | null;
  enabled: boolean;
}

/** Once per Nepal day, on the cadence's days; disabled jobs never run. */
export function isDue(cadence: JobCadence, ctx: DueContext): boolean {
  if (!ctx.enabled) return false;
  if (ctx.lastRunDay === ctx.today) return false;
  if (cadence.kind === 'daily') return true;
  if (cadence.kind === 'weekday') return ctx.weekday === cadence.day;
  return cadence.days.includes(ctx.bsDay);
}

// ---------------------------------------------------------------------------
// Reminder builders
// ---------------------------------------------------------------------------

export interface ReminderEmail {
  subject: string;
  lines: string[];
}

/**
 * Statutory reminders for a BS day (F10, first slice): the 10th reminds about
 * the previous month's SSF deposit (due within 15 days of month end), the
 * 20th about this month's TDS eTDS (due by the 25th of the following Nepali
 * month for the previous month's deductions).
 */
export function complianceReminders(bsDay: number, bsMonthName: string, previousBsMonthName: string): ReminderEmail[] {
  const reminders: ReminderEmail[] = [];
  if (bsDay === 10) {
    reminders.push({
      subject: `SSF deposit for ${previousBsMonthName} — due by ${bsMonthName} 15`,
      lines: [
        `The Social Security Fund contribution for ${previousBsMonthName} must be deposited within 15 days of the month's end (10% a year interest applies after that).`,
        'Upload the contribution schedule on the SSF portal and keep the voucher with the payroll records.',
      ],
    });
  }
  if (bsDay === 20) {
    reminders.push({
      subject: `IRD eTDS for ${previousBsMonthName} — due by ${bsMonthName} 25`,
      lines: [
        `The TDS deducted in ${previousBsMonthName} must reach IRD through eTDS by ${bsMonthName} 25.`,
        'File the eTDS return and reconcile it against the salary sheet before submitting.',
      ],
    });
  }
  return reminders;
}

export interface ProbationEmployee {
  fullName: string;
  employeeCode: string;
  category: string;
  confirmationDate: string | null;
  joiningDate: string; // YYYY-MM-DD
  status: string;
}

/**
 * Employees past the probation period but not confirmed: active, not already
 * Permanent, no confirmation date, and joined `probationDays` or more ago.
 */
export function probationDue(employees: ProbationEmployee[], today: string, probationDays = 183): (ProbationEmployee & { daysServed: number })[] {
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  return employees
    .filter((e) => e.status === 'Active' && e.category !== 'Permanent' && !e.confirmationDate && e.joiningDate)
    .map((e) => ({ ...e, daysServed: Math.floor((todayMs - Date.parse(`${e.joiningDate}T00:00:00Z`)) / 86400000) }))
    .filter((e) => Number.isFinite(e.daysServed) && e.daysServed >= probationDays)
    .sort((a, b) => b.daysServed - a.daysServed);
}

export interface BirthdayEmployee {
  fullName: string;
  employeeCode: string;
  dateOfBirth: string; // YYYY-MM-DD
  status: string;
}

/** Active employees whose (AD) birthday is today; Feb 29 counts on Feb 28 in non-leap years. */
export function birthdaysToday(employees: BirthdayEmployee[], today: string): BirthdayEmployee[] {
  const [, month, day] = today.split('-');
  const feb28NonLeap = month === '02' && day === '28' && !isLeapYear(Number(today.slice(0, 4)));
  return employees.filter((e) => {
    if (e.status !== 'Active' || !e.dateOfBirth) return false;
    const [, bMonth, bDay] = e.dateOfBirth.split('-');
    if (bMonth === month && bDay === day) return true;
    return feb28NonLeap && bMonth === '02' && bDay === '29';
  });
}

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

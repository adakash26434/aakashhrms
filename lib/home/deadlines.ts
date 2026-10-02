// Statutory monthly deadlines for the Home "Deadlines" panel.
// Counted from the end of each Bikram Sambat month. These are the commonly
// applied defaults; the company should confirm them with its tax advisor and
// they move to company configuration with F10 (compliance calendar).

import { adToBS, bsToAD, getDaysInBSMonth, BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { addDays, daysBetween, toIsoDate } from "./nepal-time";

export interface StatutoryRule {
  id: "tds" | "ssf";
  code: string;
  title: string;
  /** Days after the end of the BS month in which the deposit is due. */
  daysAfterMonthEnd: number;
  authority: string;
  basis: string;
}

export const STATUTORY_RULES: readonly StatutoryRule[] = [
  {
    id: "tds",
    code: "TDS",
    title: "Deposit salary TDS",
    daysAfterMonthEnd: 25,
    authority: "Inland Revenue Department",
    basis: "Income Tax Act 2058, s. 90: within 25 days after the end of the month",
  },
  {
    id: "ssf",
    code: "SSF",
    title: "Deposit SSF contributions",
    daysAfterMonthEnd: 15,
    authority: "Social Security Fund",
    basis: "Contributions are due within 15 days after the end of the month",
  },
];

export interface Deadline {
  id: string;
  ruleId: StatutoryRule["id"];
  code: string;
  title: string;
  authority: string;
  basis: string;
  /** The BS month the deposit is for, e.g. "Bhadra 2083". */
  forPeriod: string;
  forYear: number;
  forMonth: number;
  /** AD date, YYYY-MM-DD. */
  dueDate: string;
  /** 0 = due today; negative = passed that many days ago (kept for RECENTLY_PASSED_DAYS). */
  daysLeft: number;
}

function monthEnd(year: number, month: number): Date | null {
  const days = getDaysInBSMonth(year, month);
  if (!days) return null;
  return bsToAD(year, month, days);
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/**
 * A deadline that passed this recently stays listed (as "was due"), so a
 * missed deposit does not silently disappear the day after. Deposits are not
 * tracked yet (F10), so the list cannot know whether it was paid.
 */
export const RECENTLY_PASSED_DAYS = 7;

/**
 * Per rule: last month's deposit while it is upcoming or recently passed, and
 * the current month's once last month's date has passed. Sorted by due date.
 */
export function upcomingDeadlines(today: Date, rules: readonly StatutoryRule[] = STATUTORY_RULES): Deadline[] {
  const bs = adToBS(today);
  if (!bs.year) return [];
  const candidates = [previousMonth(bs.year, bs.month), { year: bs.year, month: bs.month }];
  const out: Deadline[] = [];
  for (const rule of rules) {
    for (const period of candidates) {
      const end = monthEnd(period.year, period.month);
      if (!end) continue;
      const due = addDays(end, rule.daysAfterMonthEnd);
      const daysLeft = daysBetween(today, due);
      if (daysLeft < -RECENTLY_PASSED_DAYS) continue;
      out.push({
        id: `${rule.id}-${period.year}-${period.month}`,
        ruleId: rule.id,
        code: rule.code,
        title: rule.title,
        authority: rule.authority,
        basis: rule.basis,
        forPeriod: `${BS_MONTHS_EN[period.month]} ${period.year}`,
        forYear: period.year,
        forMonth: period.month,
        dueDate: toIsoDate(due),
        daysLeft,
      });
      if (daysLeft >= 0) break;
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Tone for a deadline chip: passed or within 3 days → danger, within a week → warning. */
export function deadlineTone(daysLeft: number): "danger" | "warning" | "neutral" {
  if (daysLeft <= 3) return "danger";
  if (daysLeft <= 7) return "warning";
  return "neutral";
}

/** "Today", "Tomorrow", "9 days", "Yesterday", "3 days ago". */
export function deadlineWhen(daysLeft: number): string {
  if (daysLeft === 0) return "Today";
  if (daysLeft === 1) return "Tomorrow";
  if (daysLeft === -1) return "Yesterday";
  return daysLeft > 0 ? `${daysLeft} days` : `${-daysLeft} days ago`;
}

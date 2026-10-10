// Pay calendar (4.8b). Pure: no database access.
// A company pays in Bikram Sambat months or Gregorian months (one calendar
// at a time). The fiscal year stays Shrawan–Ashadh; its months in the
// company calendar are the twelve months whose first day falls in it, so
// with AD months the year-end month is the one containing the fiscal year's
// last day (July for a mid-July year end).

import { periodContaining, periodFor, shiftPeriod, type PayPeriod, type PeriodCalendar } from "@/lib/engines/pay-period.engine";
import { asRunType, RUN_TYPE_LABEL } from "@/lib/constants/run-types";
import { adToBS } from "@/lib/utils/bs-calendar";

/** Sorts months within one calendar (year × 100 + month). */
export function periodKey(p: { year: number; month: number }): number {
  return p.year * 100 + p.month;
}

/** A stored calendar value, cleaned ("AD" or "BS"). */
export function parseCalendar(raw: unknown): PeriodCalendar {
  return raw === "AD" ? "AD" : "BS";
}

export interface FiscalYearDates {
  /** AD dates ("YYYY-MM-DD") of the first and last day. */
  start: string;
  end: string;
}

/** The fiscal year's months in the company calendar: those whose first day is in the year (12 for a whole year). */
export function fiscalMonths(fy: FiscalYearDates, calendar: PeriodCalendar): PayPeriod[] {
  const out: PayPeriod[] = [];
  let p = periodContaining(calendar, fy.start);
  if (p.start < fy.start) p = shiftPeriod(p, 1);
  while (p.start <= fy.end) {
    out.push(p);
    p = shiftPeriod(p, 1);
  }
  return out;
}

/** Months left in the fiscal year from a month on, that month included (1 = the year-end month). */
export function monthsRemaining(period: Pick<PayPeriod, "year" | "month">, fy: FiscalYearDates, calendar: PeriodCalendar): number {
  const key = periodKey(period);
  const months = fiscalMonths(fy, calendar);
  const index = months.findIndex((m) => periodKey(m) === key);
  if (index < 0) throw new Error(`Month ${period.year}-${period.month} is not in the fiscal year ${fy.start} – ${fy.end}`);
  return months.length - index;
}

export function isYearEndMonth(period: Pick<PayPeriod, "year" | "month">, fy: FiscalYearDates, calendar: PeriodCalendar): boolean {
  return monthsRemaining(period, fy, calendar) === 1;
}

/** "Aswin 2083", "October 2026 · Festival bonus". */
export function runLabel(run: { calendar: string; payPeriodYear: number; payPeriodMonth: number; runType?: string }): string {
  let month: string;
  try {
    month = periodFor(parseCalendar(run.calendar), run.payPeriodYear, run.payPeriodMonth).label;
  } catch {
    month = `${run.payPeriodYear}-${String(run.payPeriodMonth).padStart(2, "0")}`;
  }
  const type = run.runType && run.runType !== "REGULAR" ? RUN_TYPE_LABEL[asRunType(run.runType)].en : "";
  return type ? `${month} · ${type}` : month;
}

/** Why the pay calendar cannot change now (null: it can). */
export function canSwitchCalendar(state: { openPeriods: number; unlockedRuns: number }): string | null {
  const parts = [
    state.openPeriods ? `${state.openPeriods} attendance month${state.openPeriods === 1 ? "" : "s"} still open` : "",
    state.unlockedRuns ? `${state.unlockedRuns} pay run${state.unlockedRuns === 1 ? "" : "s"} not locked` : "",
  ].filter(Boolean);
  return parts.length ? `The pay calendar changes only between months: ${parts.join(" and ")}. Close the months and lock or discard the runs first.` : null;
}

/**
 * The fiscal-month index (1 = the first month of the year, 12 = the year-end
 * month) of a pay month, in the company's calendar: BS Shrawan = 1 … Ashadh = 12;
 * AD August = 1 … July = 12 (the AD month that holds the fiscal year's end).
 * The team's tax projection (F5) counts months this way.
 */
export function fiscalMonthIndexFor(calendar: PeriodCalendar, month: number): number {
  if (calendar === "AD") return month >= 8 ? month - 7 : month + 5;
  return month >= 4 ? month - 3 : month + 9;
}

/**
 * The BS month a pay month's records kept by BS month are filed under (loan deduction months,
 * welfare-fund postings, leave salary pay months): the month its last day falls in. A BS pay month
 * is filed under itself.
 */
export function recordMonthOf(period: Pick<PayPeriod, "end">): { year: number; month: number; key: string } {
  const bs = adToBS(new Date(`${period.end}T06:00:00.000Z`));
  return { year: bs.year, month: bs.month, key: `${bs.year}-${String(bs.month).padStart(2, "0")}` };
}

// Payroll period summary for Home. Runs are created per branch, so a period
// (BS month + year) can have several runs; Home shows the period as a whole.

import Decimal from "decimal.js";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import type { PayrollRunStatus } from "@/lib/types/payroll";

export interface RunLike {
  id: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  status: PayrollRunStatus;
  totalGross: string | number;
  totalDeductions: string | number;
  totalNetPayable: string | number;
  totalTds: string | number;
  totalSsf: string | number;
  employeeCount: number;
}

export const RUN_STEPS: readonly PayrollRunStatus[] = ["DRAFT", "UNDER_REVIEW", "APPROVED", "LOCKED"];

export function periodKey(year: number, month: number): number {
  return year * 100 + month;
}

export function periodLabel(year: number, month: number): string {
  return `${BS_MONTHS_EN[month] ?? `Month ${month}`} ${year}`;
}

export interface PeriodSummary {
  year: number;
  month: number;
  label: string;
  /** The least advanced status across the period's runs (the period is only as far as its slowest branch). */
  status: PayrollRunStatus;
  runCount: number;
  statusCounts: Record<PayrollRunStatus, number>;
  gross: number;
  deductions: number;
  net: number;
  tds: number;
  ssf: number;
  employees: number;
}

function sum(runs: RunLike[], pick: (r: RunLike) => string | number): number {
  return runs.reduce((acc, r) => acc.plus(new Decimal(Number(pick(r)) || 0)), new Decimal(0)).toNumber();
}

export function summarizePeriod(runs: RunLike[]): PeriodSummary | null {
  if (runs.length === 0) return null;
  const { payPeriodYear: year, payPeriodMonth: month } = runs[0];
  const statusCounts = { DRAFT: 0, UNDER_REVIEW: 0, APPROVED: 0, LOCKED: 0 } as Record<PayrollRunStatus, number>;
  let slowest = RUN_STEPS.length - 1;
  for (const r of runs) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    const step = RUN_STEPS.indexOf(r.status);
    if (step >= 0 && step < slowest) slowest = step;
  }
  return {
    year,
    month,
    label: periodLabel(year, month),
    status: RUN_STEPS[slowest],
    runCount: runs.length,
    statusCounts,
    gross: sum(runs, (r) => r.totalGross),
    deductions: sum(runs, (r) => r.totalDeductions),
    net: sum(runs, (r) => r.totalNetPayable),
    tds: sum(runs, (r) => r.totalTds),
    ssf: sum(runs, (r) => r.totalSsf),
    employees: runs.reduce((n, r) => n + (r.employeeCount || 0), 0),
  };
}

/** Groups runs by period, newest period first. */
export function groupByPeriod(runs: RunLike[]): RunLike[][] {
  const map = new Map<number, RunLike[]>();
  for (const r of runs) {
    const key = periodKey(r.payPeriodYear, r.payPeriodMonth);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([, group]) => group);
}

export function latestPeriod(runs: RunLike[]): PeriodSummary | null {
  const [latest] = groupByPeriod(runs);
  return latest ? summarizePeriod(latest) : null;
}

export interface TrendPoint {
  key: number;
  label: string;
  shortLabel: string;
  gross: number;
  net: number;
  locked: boolean;
  /** Net change against the previous period, in percent (null for the first point). */
  netChangePct: number | null;
}

/** The last `count` periods, oldest first, with period-on-period change. */
export function payrollTrend(runs: RunLike[], count = 6): TrendPoint[] {
  const periods = groupByPeriod(runs)
    .slice(0, count)
    .reverse()
    .map((group) => summarizePeriod(group)!);
  return periods.map((p, i) => {
    const prev = periods[i - 1];
    const netChangePct = prev && prev.net !== 0 ? Math.round(((p.net - prev.net) / prev.net) * 1000) / 10 : null;
    return {
      key: periodKey(p.year, p.month),
      label: p.label,
      shortLabel: (BS_MONTHS_EN[p.month] ?? "").slice(0, 3),
      gross: p.gross,
      net: p.net,
      locked: p.status === "LOCKED",
      netChangePct,
    };
  });
}

/** A swing beyond this share of net pay is flagged for a second look (F1 preview). */
export const VARIANCE_FLAG_PCT = 10;

/**
 * The period that should be run next: the month after the latest period, but
 * only once that latest period is locked and the month has started.
 */
export function nextPeriodToRun(
  latest: Pick<PeriodSummary, "year" | "month" | "status"> | null,
  today: { year: number; month: number }
): { year: number; month: number; label: string } | null {
  if (latest && latest.status !== "LOCKED") return null;
  const next = latest
    ? latest.month === 12
      ? { year: latest.year + 1, month: 1 }
      : { year: latest.year, month: latest.month + 1 }
    : { year: today.year, month: today.month };
  if (periodKey(next.year, next.month) > periodKey(today.year, today.month)) return null;
  return { ...next, label: periodLabel(next.year, next.month) };
}

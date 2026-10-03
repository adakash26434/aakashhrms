// Dashboard engine (roadmap 4.1): pure functions behind /dashboard.
// No database access; the service feeds it scoped data. Unit tested in
// tests/dashboard.test.ts.

import Decimal from "decimal.js";
import { adToBS, bsToAD, getDaysInBSMonth, BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { addDays, daysBetween, toIsoDate, toLocalDate } from "@/lib/utils/nepal-time";
import { RECENTLY_PASSED_DAYS, STATUTORY_RULES, VARIANCE_FLAG_PCT, type StatutoryRule } from "@/lib/constants/statutory-deadlines";
import type { PayrollRunStatus } from "@/lib/types/payroll";
import type {
  ApprovalPreviewItem,
  AttendanceDayCounts,
  BreakdownSegment,
  CostTotals,
  CostTrendPoint,
  DashboardKpi,
  DashboardPeriodOption,
  Deadline,
  DepartmentCost,
  PeriodCostRow,
  PeriodRef,
  PeriodWindow,
  ReadinessIssue,
  ReadinessIssueId,
  ResolvedPeriod,
  RunPeriodSummary,
  FiscalProgress,
  StatutorySummary,
  UpcomingEvent,
} from "@/lib/types/dashboard";

// ---------------------------------------------------------------------------
// BS pay periods
// ---------------------------------------------------------------------------

/** Nepal's fiscal year starts in Shrawan (month 4). */
export const FISCAL_YEAR_START_MONTH = 4;

export function periodKey(year: number, month: number): number {
  return year * 100 + month;
}

export function periodLabel(year: number, month: number): string {
  return `${BS_MONTHS_EN[month] ?? `Month ${month}`} ${year}`;
}

export function periodShortLabel(month: number): string {
  return (BS_MONTHS_EN[month] ?? "").slice(0, 3);
}

/** Moves a BS period by whole months (negative = earlier). */
export function shiftPeriod(period: PeriodRef, months: number): PeriodRef {
  const index = period.year * 12 + (period.month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function inWindow(row: PeriodRef, window: PeriodWindow): boolean {
  const key = periodKey(row.year, row.month);
  return key >= periodKey(window.from.year, window.from.month) && key <= periodKey(window.to.year, window.to.month);
}

export const PERIOD_OPTIONS: readonly DashboardPeriodOption[] = ["latest", "fy", "12m"];

export function parsePeriodOption(value: unknown): DashboardPeriodOption {
  return typeof value === "string" && (PERIOD_OPTIONS as readonly string[]).includes(value) ? (value as DashboardPeriodOption) : "latest";
}

/**
 * Turns the period filter into the months to show and the months to compare
 * with. `latest` is the newest month that has payroll (or this month when
 * nothing has run yet).
 */
export function resolvePeriod(option: DashboardPeriodOption, latest: PeriodRef | null, today: PeriodRef): ResolvedPeriod {
  const anchor = latest ?? today;
  if (option === "fy") {
    const startYear = today.month >= FISCAL_YEAR_START_MONTH ? today.year : today.year - 1;
    const from = { year: startYear, month: FISCAL_YEAR_START_MONTH };
    const to = periodKey(anchor.year, anchor.month) >= periodKey(from.year, from.month) ? anchor : from;
    return {
      option,
      current: { from, to },
      previous: { from: shiftPeriod(from, -12), to: shiftPeriod(to, -12) },
      label: `FY ${startYear}/${String((startYear + 1) % 100).padStart(2, "0")} to date`,
      compareLabel: "vs same months last year",
    };
  }
  if (option === "12m") {
    const from = shiftPeriod(anchor, -11);
    return {
      option,
      current: { from, to: anchor },
      previous: { from: shiftPeriod(from, -12), to: shiftPeriod(anchor, -12) },
      label: `Last 12 months to ${periodLabel(anchor.year, anchor.month)}`,
      compareLabel: "vs the 12 months before",
    };
  }
  const prev = shiftPeriod(anchor, -1);
  return {
    option: "latest",
    current: { from: anchor, to: anchor },
    previous: { from: prev, to: prev },
    label: periodLabel(anchor.year, anchor.month),
    compareLabel: `vs ${periodLabel(prev.year, prev.month)}`,
  };
}

// ---------------------------------------------------------------------------
// Payroll cost
// ---------------------------------------------------------------------------

const ZERO_TOTALS: CostTotals = {
  gross: 0, net: 0, totalDeductions: 0, tds: 0, pfEmployee: 0, pfEmployer: 0, ssfEmployee: 0, ssfEmployer: 0,
  cit: 0, loan: 0, ot: 0, employeeMonths: 0, employerCost: 0, statutory: 0,
};

const SUM_FIELDS = ["gross", "net", "totalDeductions", "tds", "pfEmployee", "pfEmployer", "ssfEmployee", "ssfEmployer", "cit", "loan", "ot"] as const;

/**
 * Totals over months. The payroll engine adds employer SSF (20%) into gross
 * and deducts the full 31%, while employer PF is not part of gross, so the
 * cost to the company is gross + employer PF.
 */
export function sumCostRows(rows: PeriodCostRow[]): CostTotals {
  if (rows.length === 0) return { ...ZERO_TOTALS };
  const acc = Object.fromEntries(SUM_FIELDS.map((f) => [f, new Decimal(0)])) as Record<(typeof SUM_FIELDS)[number], Decimal>;
  let employeeMonths = 0;
  for (const row of rows) {
    for (const f of SUM_FIELDS) acc[f] = acc[f].plus(new Decimal(row[f] || 0));
    employeeMonths += row.employees || 0;
  }
  const n = (f: (typeof SUM_FIELDS)[number]) => acc[f].toNumber();
  return {
    gross: n("gross"),
    net: n("net"),
    totalDeductions: n("totalDeductions"),
    tds: n("tds"),
    pfEmployee: n("pfEmployee"),
    pfEmployer: n("pfEmployer"),
    ssfEmployee: n("ssfEmployee"),
    ssfEmployer: n("ssfEmployer"),
    cit: n("cit"),
    loan: n("loan"),
    ot: n("ot"),
    employeeMonths,
    employerCost: acc.gross.plus(acc.pfEmployer).toNumber(),
    statutory: acc.tds.plus(acc.ssfEmployee).plus(acc.ssfEmployer).plus(acc.pfEmployee).plus(acc.pfEmployer).plus(acc.cit).toNumber(),
  };
}

/**
 * Where the money went: net pay plus every deduction plus employer PF. The
 * segments add up to the employer cost; "Other" absorbs deductions without
 * their own column (insurance, advances, absence) and is never negative.
 */
export function costBreakdown(t: CostTotals): { total: number; segments: BreakdownSegment[] } {
  const ssf = new Decimal(t.ssfEmployee).plus(t.ssfEmployer);
  const known = new Decimal(t.tds).plus(ssf).plus(t.pfEmployee).plus(t.cit).plus(t.loan);
  const other = Decimal.max(0, new Decimal(t.totalDeductions).minus(known));
  const segments: BreakdownSegment[] = [
    { id: "net", label: "Net pay", amount: t.net },
    { id: "tds", label: "TDS", amount: t.tds },
    { id: "ssf", label: "SSF (31%)", amount: ssf.toNumber() },
    { id: "pf", label: "PF (both sides)", amount: new Decimal(t.pfEmployee).plus(t.pfEmployer).toNumber() },
    { id: "cit", label: "CIT", amount: t.cit },
    { id: "loan", label: "Loan repayments", amount: t.loan },
    { id: "other", label: "Other deductions", amount: other.toNumber() },
  ];
  const total = segments.reduce((acc, s) => acc.plus(s.amount), new Decimal(0)).toNumber();
  return { total, segments: segments.filter((s) => s.amount > 0) };
}

export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function rowFor(rows: PeriodCostRow[], period: PeriodRef): PeriodCostRow | undefined {
  return rows.find((r) => r.year === period.year && r.month === period.month);
}

/** `count` months ending at `end`, oldest first; months without payroll have hasData = false. */
export function costTrend(rows: PeriodCostRow[], end: PeriodRef, count = 12): CostTrendPoint[] {
  const points: CostTrendPoint[] = [];
  let lastCost: number | null = null;
  for (let i = count - 1; i >= 0; i--) {
    const p = shiftPeriod(end, -i);
    const row = rowFor(rows, p);
    const totals = row ? sumCostRows([row]) : null;
    const employerCost = totals?.employerCost ?? 0;
    points.push({
      key: periodKey(p.year, p.month),
      label: periodLabel(p.year, p.month),
      shortLabel: periodShortLabel(p.month),
      net: totals?.net ?? 0,
      deductions: totals?.totalDeductions ?? 0,
      employerExtra: totals?.pfEmployer ?? 0,
      employerCost,
      hasData: !!row,
      locked: !!row?.locked,
      changePct: row ? percentChange(employerCost, lastCost) : null,
    });
    if (row) lastCost = employerCost;
  }
  return points;
}

export function isSwing(changePct: number | null): boolean {
  return changePct !== null && Math.abs(changePct) >= VARIANCE_FLAG_PCT;
}

export interface KpiInputs {
  rows: PeriodCostRow[];
  period: ResolvedPeriod;
  activeHeadcount: number | null;
  joiners: number | null;
  leavers: number | null;
  nextDeadline: Deadline | null;
}

/** The five headline figures for the selected period, with change and a 12-month sparkline. */
export function buildKpis({ rows, period, activeHeadcount, joiners, leavers, nextDeadline }: KpiInputs): DashboardKpi[] {
  const current = rows.filter((r) => inWindow(r, period.current));
  const previous = rows.filter((r) => inWindow(r, period.previous));
  const cur = current.length ? sumCostRows(current) : null;
  const prev = previous.length ? sumCostRows(previous) : null;
  const trend = costTrend(rows, period.current.to, 12);
  const spark = (pick: (t: CostTotals) => number) =>
    trend.map((p) => {
      const row = rows.find((r) => periodKey(r.year, r.month) === p.key);
      return row ? pick(sumCostRows([row])) : null;
    });
  const avg = (t: CostTotals | null) => (t && t.employeeMonths > 0 ? new Decimal(t.employerCost).div(t.employeeMonths).toDecimalPlaces(2).toNumber() : null);

  const make = (
    id: DashboardKpi["id"],
    label: string,
    value: number | null,
    previousValue: number | null,
    hint: string,
    href: string,
    sparkline: (number | null)[],
    format: DashboardKpi["format"] = "amount"
  ): DashboardKpi => {
    const changePct = percentChange(value, previousValue);
    return { id, label, value, previous: previousValue, changePct, tone: isSwing(changePct) ? "warning" : "neutral", hint, href, sparkline, format };
  };

  const net = joiners !== null && leavers !== null ? joiners - leavers : null;
  const deadlineHint = nextDeadline
    ? nextDeadline.daysLeft < 0
      ? `${nextDeadline.code} for ${nextDeadline.forPeriod} was due`
      : `Next: ${nextDeadline.code} in ${nextDeadline.daysLeft === 0 ? "today" : `${nextDeadline.daysLeft} days`}`
    : "TDS, SSF, PF and CIT";

  return [
    make("cost", "Payroll cost", cur?.employerCost ?? null, prev?.employerCost ?? null, "Gross + employer PF", "/reports/salary-sheet", spark((t) => t.employerCost)),
    make("net", "Net pay", cur?.net ?? null, prev?.net ?? null, "Paid to employees' accounts", "/reports/salary-sheet", spark((t) => t.net)),
    make("statutory", "Statutory", cur?.statutory ?? null, prev?.statutory ?? null, deadlineHint, "/reports/tax-ird", spark((t) => t.statutory)),
    {
      ...make(
        "headcount",
        "Active employees",
        activeHeadcount,
        null,
        joiners === null ? "On the payroll today" : `${joiners} joined · ${leavers} left this month`,
        "/workforce/employees",
        trend.map((p) => (p.hasData ? rows.find((r) => periodKey(r.year, r.month) === p.key)?.employees ?? null : null)),
        "count"
      ),
      // Headcount moves with joiners and leavers this month, not with the payroll period.
      changeNote: net === null ? undefined : net === 0 ? "No change this month" : `${net > 0 ? "+" : ""}${net} this month`,
    },
    make("average", "Cost per employee", avg(cur), avg(prev), "Monthly average", "/reports/salary-sheet", spark((t) => (t.employeeMonths ? t.employerCost / t.employeeMonths : 0))),
  ];
}

/** Largest departments first; the rest merge into one "Other" row. */
export function topDepartments(rows: DepartmentCost[], limit = 8): DepartmentCost[] {
  const sorted = [...rows].filter((r) => r.cost > 0 || r.employees > 0).sort((a, b) => b.cost - a.cost);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  return [
    ...head,
    {
      name: `Other (${rest.length})`,
      cost: rest.reduce((acc, r) => acc.plus(r.cost), new Decimal(0)).toNumber(),
      employees: rest.reduce((n, r) => n + r.employees, 0),
    },
  ];
}

// ---------------------------------------------------------------------------
// Pay runs (one run per branch; the month is as far as its slowest branch)
// ---------------------------------------------------------------------------

export interface RunLike {
  id: string;
  payPeriodMonth: number;
  payPeriodYear: number;
  status: PayrollRunStatus;
  totalGross: string | number;
  totalNetPayable: string | number;
  employeeCount: number;
}

export const RUN_STEPS: readonly PayrollRunStatus[] = ["DRAFT", "UNDER_REVIEW", "APPROVED", "LOCKED"];

export function groupRunsByPeriod<T extends RunLike>(runs: T[]): T[][] {
  const map = new Map<number, T[]>();
  for (const r of runs) {
    const key = periodKey(r.payPeriodYear, r.payPeriodMonth);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([, group]) => group);
}

export function summarizeRuns(runs: RunLike[]): RunPeriodSummary | null {
  if (runs.length === 0) return null;
  const { payPeriodYear: year, payPeriodMonth: month } = runs[0];
  const statusCounts = { DRAFT: 0, UNDER_REVIEW: 0, APPROVED: 0, LOCKED: 0 } as Record<PayrollRunStatus, number>;
  let slowest = RUN_STEPS.length - 1;
  for (const r of runs) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    const step = RUN_STEPS.indexOf(r.status);
    if (step >= 0 && step < slowest) slowest = step;
  }
  const total = (pick: (r: RunLike) => string | number) => runs.reduce((acc, r) => acc.plus(new Decimal(Number(pick(r)) || 0)), new Decimal(0)).toNumber();
  return {
    year,
    month,
    label: periodLabel(year, month),
    status: RUN_STEPS[slowest],
    runCount: runs.length,
    statusCounts,
    gross: total((r) => r.totalGross),
    net: total((r) => r.totalNetPayable),
    employees: runs.reduce((n, r) => n + (r.employeeCount || 0), 0),
  };
}

export function latestRunPeriod(runs: RunLike[]): RunPeriodSummary | null {
  const [latest] = groupRunsByPeriod(runs);
  return latest ? summarizeRuns(latest) : null;
}

/** The month to run next: after the latest month, once that month is locked and the new month has begun. */
export function nextPeriodToRun(
  latest: Pick<RunPeriodSummary, "year" | "month" | "status"> | null,
  today: PeriodRef
): (PeriodRef & { label: string }) | null {
  if (latest && latest.status !== "LOCKED") return null;
  const next = latest ? shiftPeriod(latest, 1) : today;
  if (periodKey(next.year, next.month) > periodKey(today.year, today.month)) return null;
  return { ...next, label: periodLabel(next.year, next.month) };
}

// ---------------------------------------------------------------------------
// Attendance this month
// ---------------------------------------------------------------------------

const PRESENT = new Set(["Present", "Half Day"]);
const ON_LEAVE = new Set(["On Leave", "LWOP"]);
const OFF = new Set(["Holiday", "Weekly Off"]);

export interface AttendanceMark {
  employeeId: string;
  date: string;
  status: string;
}

export interface LeaveSpan {
  employeeId: string;
  from: string;
  to: string;
}

/**
 * Daily counts for the given days (AD dates of one BS month, starting at BS
 * day `firstDay`). An employee without a record that day counts as "on leave"
 * when an approved leave covers the day, otherwise as "not recorded" (never
 * silently as present).
 */
export function attendanceByDay(days: string[], employeeIds: string[], marks: AttendanceMark[], leaves: LeaveSpan[], firstDay = 1): AttendanceDayCounts[] {
  const roster = new Set(employeeIds);
  const byDate = new Map<string, Map<string, string>>();
  for (const m of marks) {
    if (!roster.has(m.employeeId)) continue;
    const day = byDate.get(m.date) ?? new Map<string, string>();
    day.set(m.employeeId, m.status);
    byDate.set(m.date, day);
  }
  return days.map((date, index) => {
    const recorded = byDate.get(date) ?? new Map<string, string>();
    let present = 0;
    let leave = 0;
    let absent = 0;
    let off = 0;
    for (const status of recorded.values()) {
      if (PRESENT.has(status)) present++;
      else if (ON_LEAVE.has(status)) leave++;
      else if (OFF.has(status)) off++;
      else if (status === "Absent") absent++;
    }
    const onApprovedLeave = new Set(leaves.filter((l) => l.from <= date && date <= l.to && !recorded.has(l.employeeId) && roster.has(l.employeeId)).map((l) => l.employeeId));
    leave += onApprovedLeave.size;
    const counted = present + leave + absent + off;
    return {
      date,
      day: firstDay + index,
      present,
      leave,
      absent,
      off,
      notRecorded: Math.max(0, roster.size - counted),
    };
  });
}

/** AD dates (YYYY-MM-DD) of the BS month containing `today`, up to and including today. */
export function bsMonthDaysToDate(today: Date): { label: string; days: string[] } {
  const bs = adToBS(today);
  const start = bsToAD(bs.year, bs.month, 1);
  const days: string[] = [];
  for (let i = 0; i < bs.day; i++) days.push(toIsoDate(addDays(start, i)));
  return { label: periodLabel(bs.year, bs.month), days };
}

// ---------------------------------------------------------------------------
// Statutory deadlines
// ---------------------------------------------------------------------------

function monthEnd(year: number, month: number): Date | null {
  const days = getDaysInBSMonth(year, month);
  return days ? bsToAD(year, month, days) : null;
}

/**
 * Per rule: last month's deposit while it is upcoming or passed within
 * RECENTLY_PASSED_DAYS, and the current month's once last month's date has
 * passed. Sorted by due date.
 */
export function upcomingDeadlines(today: Date, rules: readonly StatutoryRule[] = STATUTORY_RULES): Deadline[] {
  const bs = adToBS(today);
  if (!bs.year) return [];
  const thisMonth = { year: bs.year, month: bs.month };
  const candidates = [shiftPeriod(thisMonth, -1), thisMonth];
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
        forPeriod: periodLabel(period.year, period.month),
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

/** Passed or within 3 days → danger; within a week → warning. */
export function deadlineTone(daysLeft: number): "danger" | "warning" | "neutral" {
  if (daysLeft <= 3) return "danger";
  if (daysLeft <= 7) return "warning";
  return "neutral";
}

export function deadlineWhen(daysLeft: number): string {
  if (daysLeft === 0) return "Today";
  if (daysLeft === 1) return "Tomorrow";
  if (daysLeft === -1) return "Yesterday";
  return daysLeft > 0 ? `${daysLeft} days` : `${-daysLeft} days ago`;
}

// ---------------------------------------------------------------------------
// Payroll readiness
// ---------------------------------------------------------------------------

export interface ReadinessEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  panNumber?: string | null;
  bankAccountNumber?: string | null;
  basicSalary?: number | null;
}

/** Nepal PAN: 9 digits. */
export function isValidPan(pan: string | null | undefined): boolean {
  return !!pan && /^\d{9}$/.test(pan.trim());
}

const READINESS_CHECKS: { id: ReadinessIssueId; label: string; impact: string; failing: (e: ReadinessEmployee) => boolean }[] = [
  { id: "pan", label: "PAN missing or invalid", impact: "TDS cannot be reported against the employee", failing: (e) => !isValidPan(e.panNumber) },
  { id: "bank", label: "No bank account", impact: "Left out of the bank transfer file", failing: (e) => !e.bankAccountNumber || e.bankAccountNumber.trim() === "" },
  { id: "basic", label: "Basic salary is zero", impact: "Payslip will calculate as nil", failing: (e) => !(Number(e.basicSalary) > 0) },
];

export const READINESS_SAMPLE_SIZE = 5;

export function payrollReadiness(employees: ReadinessEmployee[], sampleSize = READINESS_SAMPLE_SIZE): ReadinessIssue[] {
  return READINESS_CHECKS.map((check) => {
    const failing = employees.filter(check.failing);
    return {
      id: check.id,
      label: check.label,
      impact: check.impact,
      count: failing.length,
      sample: failing.slice(0, sampleSize).map((e) => ({ id: e.id, name: e.fullName, code: e.employeeCode })),
    };
  })
    .filter((issue) => issue.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Pending approvals preview
// ---------------------------------------------------------------------------

export interface PendingLeaveLike {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  appliedDate: Date | string;
  effectiveFrom: Date | string;
  effectiveTo: Date | string;
  noOfDays: number;
}

function iso(value: Date | string): string {
  const d = toLocalDate(value);
  return d ? toIsoDate(d) : "";
}

/** The oldest waiting requests first (they have waited longest). */
export function approvalsPreview(
  pending: PendingLeaveLike[],
  ctx: { employeeNames: Map<string, string>; leaveTypeNames: Map<string, string>; today: Date },
  limit = 5
): { total: number; items: ApprovalPreviewItem[] } {
  const known = pending.filter((p) => ctx.employeeNames.has(p.employeeId));
  const items = known
    .map((p) => {
      const applied = toLocalDate(p.appliedDate);
      return {
        id: p.id,
        employeeName: ctx.employeeNames.get(p.employeeId)!,
        leaveType: ctx.leaveTypeNames.get(p.leaveTypeId) ?? "Leave",
        days: Number(p.noOfDays) || 0,
        from: iso(p.effectiveFrom),
        to: iso(p.effectiveTo),
        waitingDays: applied ? Math.max(0, daysBetween(applied, ctx.today)) : null,
        applied: applied ? applied.getTime() : 0,
      };
    })
    .sort((a, b) => a.applied - b.applied)
    .slice(0, limit)
    .map(({ id, employeeName, leaveType, days, from, to, waitingDays }) => ({ id, employeeName, leaveType, days, from, to, waitingDays }));
  return { total: known.length, items };
}

// ---------------------------------------------------------------------------
// Statutory liabilities, attendance rate, fiscal progress
// ---------------------------------------------------------------------------

/** What has to be deposited for the period, by head (employee and employer sides apart). */
export function statutorySummary(t: CostTotals): StatutorySummary {
  const rows: StatutorySummary["rows"] = [
    { id: "tds", label: "TDS (income tax)", amount: t.tds },
    { id: "ssfEmployee", label: "SSF, employee 11%", amount: t.ssfEmployee },
    { id: "ssfEmployer", label: "SSF, employer 20%", amount: t.ssfEmployer },
    { id: "pfEmployee", label: "PF, employee", amount: t.pfEmployee },
    { id: "pfEmployer", label: "PF, employer", amount: t.pfEmployer },
    { id: "cit", label: "CIT", amount: t.cit },
  ];
  return { total: t.statutory, rows: rows.filter((r) => r.amount > 0) };
}

/**
 * Attendance rate: present (incl. half days) ÷ (present + absent). Approved
 * leave and days off are excused, so they count neither way; null when no
 * presence or absence was recorded.
 */
export function attendanceRate(days: AttendanceDayCounts[]): number | null {
  let present = 0;
  let expected = 0;
  for (const d of days) {
    present += d.present;
    expected += d.present + d.absent;
  }
  return expected > 0 ? Math.round((present / expected) * 1000) / 10 : null;
}

/** Which month of the Nepal fiscal year (Shrawan = 1) a BS month is. */
export function fiscalProgress(today: PeriodRef): FiscalProgress {
  const startYear = today.month >= FISCAL_YEAR_START_MONTH ? today.year : today.year - 1;
  const month = ((today.month - FISCAL_YEAR_START_MONTH + 12) % 12) + 1;
  return { label: `FY ${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`, month };
}

// ---------------------------------------------------------------------------
// Upcoming: holidays, birthdays, work anniversaries (Bikram Sambat dates)
// ---------------------------------------------------------------------------

export const UPCOMING_WINDOW_DAYS = 30;

/**
 * The next AD date on which a BS month/day recurs, on or after `today`.
 * Days that do not exist in a shorter BS month fall on its last day.
 */
export function nextBsAnniversary(source: Date, today: Date): { date: Date; bsYear: number } | null {
  const bs = adToBS(source);
  if (!bs.year) return null;
  const now = adToBS(today);
  for (const year of [now.year, now.year + 1]) {
    const days = getDaysInBSMonth(year, bs.month);
    if (!days) continue;
    const date = bsToAD(year, bs.month, Math.min(bs.day, days));
    if (daysBetween(today, date) >= 0) return { date, bsYear: year };
  }
  return null;
}

export interface UpcomingInputs {
  today: Date;
  holidays: { id: string; name: string; category: string; startDateAD: Date; endDateAD: Date }[];
  employees: { id: string; fullName: string; dateOfBirth?: Date | null; joiningDate?: Date | null }[];
  windowDays?: number;
  limit?: number;
}

/**
 * The next few weeks at a glance. Birthdays show the day only (never the
 * year or age); anniversaries count whole BS years since joining.
 */
export function upcomingEvents({ today, holidays, employees, windowDays = UPCOMING_WINDOW_DAYS, limit = 8 }: UpcomingInputs): UpcomingEvent[] {
  const events: UpcomingEvent[] = [];
  for (const h of holidays) {
    const start = toLocalDate(h.startDateAD);
    const end = toLocalDate(h.endDateAD) ?? start;
    if (!start || !end) continue;
    if (daysBetween(today, end) < 0) continue; // already over
    const away = Math.max(0, daysBetween(today, start));
    if (away > windowDays) continue;
    const length = daysBetween(start, end) + 1;
    events.push({
      id: `holiday-${h.id}`,
      kind: "holiday",
      date: toIsoDate(daysBetween(today, start) < 0 ? today : start),
      title: h.name,
      detail: length > 1 ? `${length} days` : h.category,
      daysAway: away,
    });
  }
  for (const e of employees) {
    const birthday = e.dateOfBirth ? nextBsAnniversary(e.dateOfBirth, today) : null;
    if (birthday) {
      const away = daysBetween(today, birthday.date);
      if (away <= windowDays) events.push({ id: `birthday-${e.id}`, kind: "birthday", date: toIsoDate(birthday.date), title: e.fullName, detail: "Birthday", daysAway: away });
    }
    const joined = e.joiningDate ? toLocalDate(e.joiningDate) : null;
    const anniversary = joined ? nextBsAnniversary(joined, today) : null;
    if (joined && anniversary) {
      const years = anniversary.bsYear - adToBS(joined).year;
      const away = daysBetween(today, anniversary.date);
      if (years > 0 && away <= windowDays) {
        events.push({ id: `anniversary-${e.id}`, kind: "anniversary", date: toIsoDate(anniversary.date), title: e.fullName, detail: `${years} ${years === 1 ? "year" : "years"} with the company`, daysAway: away });
      }
    }
  }
  const order: Record<UpcomingEvent["kind"], number> = { holiday: 0, anniversary: 1, birthday: 2 };
  return events.sort((a, b) => a.daysAway - b.daysAway || order[a.kind] - order[b.kind] || a.title.localeCompare(b.title)).slice(0, limit);
}


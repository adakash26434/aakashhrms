// Dashboard (/dashboard, roadmap 4.1). The snapshot is built on the server by
// lib/services/dashboard.service.ts from permission-checked, scope-filtered
// data; every section is null when the user may not see it (S3).

import type { PayrollRunStatus } from "./payroll";

/** Period filter: latest pay month, fiscal year to date, last 12 months. */
export type DashboardPeriodOption = "latest" | "fy" | "12m";

export interface PeriodRef {
  year: number;
  month: number;
}

export interface PeriodWindow {
  from: PeriodRef;
  to: PeriodRef;
}

export interface ResolvedPeriod {
  option: DashboardPeriodOption;
  current: PeriodWindow;
  previous: PeriodWindow;
  /** e.g. "Bhadra 2083", "FY 2083/84 to date", "Last 12 months". */
  label: string;
  /** e.g. "vs Shrawan 2083". */
  compareLabel: string;
}

/** One BS pay month, summed over every payslip in scope (SQL SUM, decimal strings mapped to numbers). */
export interface PeriodCostRow {
  year: number;
  month: number;
  gross: number;
  net: number;
  totalDeductions: number;
  tds: number;
  pfEmployee: number;
  pfEmployer: number;
  ssfEmployee: number;
  ssfEmployer: number;
  cit: number;
  loan: number;
  ot: number;
  /** Distinct employees paid in the month. */
  employees: number;
  /** Every run of the month is locked. */
  locked: boolean;
}

export interface CostTotals {
  gross: number;
  net: number;
  totalDeductions: number;
  tds: number;
  pfEmployee: number;
  pfEmployer: number;
  ssfEmployee: number;
  ssfEmployer: number;
  cit: number;
  loan: number;
  ot: number;
  /** Sum of monthly paid employees (employee-months). */
  employeeMonths: number;
  /** Gross (already includes employer SSF) + employer PF. */
  employerCost: number;
  /** TDS + SSF (31%) + PF (employee + employer) + CIT. */
  statutory: number;
}

export interface BreakdownSegment {
  id: "net" | "tds" | "ssf" | "pf" | "cit" | "loan" | "other";
  label: string;
  amount: number;
}

export interface CostTrendPoint {
  key: number;
  label: string;
  shortLabel: string;
  net: number;
  /** Employee-side deductions (TDS, SSF 31%, PF, CIT, loans, other). */
  deductions: number;
  /** Employer PF (employer SSF is already inside gross). */
  employerExtra: number;
  employerCost: number;
  hasData: boolean;
  locked: boolean;
  /** Employer cost change against the previous month with data, in %. */
  changePct: number | null;
}

export type KpiFormat = "amount" | "count";

export interface DashboardKpi {
  id: "cost" | "net" | "statutory" | "headcount" | "average";
  label: string;
  value: number | null;
  format: KpiFormat;
  previous: number | null;
  changePct: number | null;
  /** Large swings get a warning tone; direction alone is never coloured good/bad. */
  tone: "neutral" | "warning";
  hint: string;
  /** Replaces the "vs <period>" change line, e.g. "+1 this month" for headcount. */
  changeNote?: string;
  href: string;
  /** Up to 12 monthly values, oldest first (null = no data that month). */
  sparkline: (number | null)[];
}

export interface DepartmentCost {
  name: string;
  cost: number;
  employees: number;
}

export interface AttendanceDayCounts {
  date: string;
  day: number;
  present: number;
  leave: number;
  absent: number;
  off: number;
  notRecorded: number;
}

export interface RunPeriodSummary {
  year: number;
  month: number;
  label: string;
  /** The least advanced status across the month's branch runs. */
  status: PayrollRunStatus;
  runCount: number;
  statusCounts: Record<PayrollRunStatus, number>;
  gross: number;
  net: number;
  employees: number;
}

export interface DashboardPayRun {
  latest: RunPeriodSummary | null;
  next: (PeriodRef & { label: string }) | null;
}

export interface Deadline {
  id: string;
  ruleId: "tds" | "ssf";
  code: string;
  title: string;
  authority: string;
  basis: string;
  forPeriod: string;
  forYear: number;
  forMonth: number;
  /** AD date, YYYY-MM-DD. */
  dueDate: string;
  /** 0 = today; negative = passed that many days ago. */
  daysLeft: number;
}

export interface DashboardDeadline extends Deadline {
  /** Amount withheld for that month in payroll, when known. */
  amount: number | null;
}

export type ReadinessIssueId = "pan" | "bank" | "basic";

export interface ReadinessIssue {
  id: ReadinessIssueId;
  label: string;
  impact: string;
  count: number;
  sample: { id: string; name: string; code: string }[];
}

export interface ApprovalPreviewItem {
  id: string;
  employeeName: string;
  leaveType: string;
  days: number;
  from: string;
  to: string;
  waitingDays: number | null;
}

/** Amounts to deposit for the selected period, by statutory head. */
export interface StatutorySummary {
  total: number;
  rows: { id: "tds" | "ssfEmployee" | "ssfEmployer" | "pfEmployee" | "pfEmployer" | "cit"; label: string; amount: number }[];
}

export type UpcomingKind = "holiday" | "birthday" | "anniversary";

export interface UpcomingEvent {
  id: string;
  kind: UpcomingKind;
  /** AD date, YYYY-MM-DD. */
  date: string;
  title: string;
  detail: string;
  /** 0 = today. */
  daysAway: number;
}

export interface FiscalProgress {
  label: string;
  /** 1 = Shrawan … 12 = Asar. */
  month: number;
}

export interface DashboardActivity {
  id: string;
  actor: string;
  action: string;
  module: string;
  result: string;
  at: string;
}

export interface DashboardAccess {
  employees: boolean;
  employeesAdd: boolean;
  attendance: boolean;
  leaveApprovals: boolean;
  payroll: boolean;
  payrollGenerate: boolean;
  payrollReview: boolean;
  audit: boolean;
  /** Super-admin support view: read-only. */
  supportView: boolean;
  /** Scope badge for restricted users, e.g. "Pokhara branch". */
  scopeLabel: string | null;
}

export interface DashboardFilters {
  period: ResolvedPeriod;
  branchId: string | null;
  /** Offered only to company-wide (GLOBAL) users. */
  branches: { id: string; name: string }[];
}

export interface DashboardData {
  generatedAt: string;
  todayIso: string;
  displayName: string;
  access: DashboardAccess;
  filters: DashboardFilters;
  kpis: DashboardKpi[] | null;
  costTrend: CostTrendPoint[] | null;
  costBreakdown: { total: number; segments: BreakdownSegment[] } | null;
  departmentCost: DepartmentCost[] | null;
  attendance: { monthLabel: string; total: number; days: AttendanceDayCounts[]; ratePct: number | null } | null;
  statutory: StatutorySummary | null;
  upcoming: UpcomingEvent[] | null;
  fiscalProgress: FiscalProgress;
  payRun: DashboardPayRun | null;
  deadlines: DashboardDeadline[] | null;
  approvals: { total: number; items: ApprovalPreviewItem[] } | null;
  readiness: { checked: number; issues: ReadinessIssue[] } | null;
  leaveByType: { fiscalYear: string; types: { name: string; days: number }[] } | null;
  onLeaveToday: { name: string; leaveType: string; until: string }[] | null;
  headcount: { name: string; count: number }[] | null;
  activity: DashboardActivity[] | null;
  /** Sections that failed to load; shown in place as error panels. */
  failed: string[];
}

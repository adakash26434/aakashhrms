// The Home (work queue) snapshot sent to the browser. Every section is null
// when the user lacks the permission for it: the data is never loaded or
// serialised, rather than hidden in the UI (S3).

import type { Deadline } from "./deadlines";
import type { QueueLeave } from "./leave-queue";
import type { PeriodSummary, TrendPoint } from "./payroll-period";
import type { ReadinessIssue } from "./readiness";

export interface HomeAccess {
  employees: boolean;
  employeesAdd: boolean;
  attendance: boolean;
  leaveApprovals: boolean;
  /** May approve / reject (APPROVE on LEAVE_APPROVALS, and not a support view). */
  leaveDecide: boolean;
  payroll: boolean;
  payrollGenerate: boolean;
  payrollReview: boolean;
  loans: boolean;
  audit: boolean;
  /** Super-admin support view: read-only. */
  supportView: boolean;
  /** Branch / department scope label for restricted users, e.g. "Kathmandu branch". */
  scopeLabel: string | null;
}

export interface HomePayroll {
  latest: PeriodSummary | null;
  next: { year: number; month: number; label: string } | null;
  trend: TrendPoint[];
}

export interface HomeDeadline extends Deadline {
  /** Amount withheld in that period's locked payroll, when known. */
  amount: number | null;
}

export interface HomeWorkforceToday {
  total: number;
  /** Employees with an attendance record today. */
  recorded: number;
  present: number;
  absent: number;
  late: number;
  onLeave: { name: string; leaveType: string; until: string }[];
}

export interface HomeActivity {
  id: string;
  actor: string;
  action: string;
  module: string;
  result: string;
  at: string;
}

export interface HomeData {
  generatedAt: string;
  todayIso: string;
  displayName: string;
  access: HomeAccess;
  approvals: QueueLeave[] | null;
  payroll: HomePayroll | null;
  deadlines: HomeDeadline[] | null;
  readiness: { checked: number; issues: ReadinessIssue[] } | null;
  workforce: HomeWorkforceToday | null;
  headcount: { name: string; count: number }[] | null;
  loans: { active: number; outstanding: number } | null;
  activity: HomeActivity[] | null;
  /** Sections that failed to load (shown as an inline error, not a blank). */
  failed: string[];
}

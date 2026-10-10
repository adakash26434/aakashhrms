// Payroll run (4.8a): the run workspace, pre-flight, variance and approval.

import type { ApprovalFlow, ApprovalPolicy, ApprovalRoute, ApprovalTimelineEntry, ApproverInfo } from "@/lib/types/approval";
import type { PayrollRun, PayrollSlip, PayrollSlipHead } from "@/lib/types/payroll";

/** The steps of a run, in order (template C). */
export const RUN_STEPS = ["setup", "preflight", "calculate", "variance", "review", "approval", "lock"] as const;
export type RunStep = (typeof RUN_STEPS)[number];

export const RUN_STEP_LABEL: Record<RunStep, string> = {
  setup: "Setup",
  preflight: "Pre-flight",
  calculate: "Calculate",
  variance: "Variance",
  review: "Review",
  approval: "Approval",
  lock: "Lock",
};

/** Kinds of run: one list for the workspace and payroll (F6, lib/constants/run-types.ts). */
export { RUN_TYPES, type RunType } from "@/lib/constants/run-types";
import type { RunType } from "@/lib/constants/run-types";

export type ProblemSeverity = "blocking" | "warning" | "info";

/** One pre-flight finding; blocking ones stop the run from being generated or submitted. */
export interface PreflightProblem {
  code: string;
  severity: ProblemSeverity;
  text: string;
  /** The employee it is about (jump-to), when it is about one. */
  employeeId?: string;
  employeeName?: string;
  /** Where to fix it. */
  href?: string;
}

export interface PreflightResult {
  problems: PreflightProblem[];
  blocking: number;
  warnings: number;
  /** Employees the run would include. */
  employees: number;
  checkedAt: string;
}

export type VarianceFlagCode = "gross" | "net" | "tds" | "ssf" | "new_joiner" | "leaver_paid" | "zero_net" | "negative_net" | "bank_changed";

export interface VarianceFlag {
  code: VarianceFlagCode;
  text: string;
  before: number | null;
  after: number | null;
  /** Change in percent against the earlier run (figures only). */
  changePct: number | null;
}

/** One employee's variance against the last locked run, and its acknowledgement. */
export interface VarianceItem {
  slipId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  flags: VarianceFlag[];
  acknowledgedBy: string | null;
  acknowledgedByName?: string | null;
  acknowledgedAt: string | null;
  note: string | null;
}

/** The variance review stored on the run. */
export interface RunVariance {
  /** The LOCKED run compared against (null: the first run). */
  baseRunId: string | null;
  baseLabel: string | null;
  thresholdPct: number;
  computedAt: string;
  items: VarianceItem[];
}

/** What the current user may do with a run now (worked out on the server; checked again on every action). */
export interface RunActions {
  /** Pre-flight again, sync attendance, edit payslips (DRAFT only, not LOCKED). */
  edit: boolean;
  submit: boolean;
  approve: boolean;
  finalApprove: boolean;
  reject: boolean;
  lock: boolean;
  discard: boolean;
  export: boolean;
  /** Plain reason when the user cannot approve. */
  reason: string | null;
  /** The run is stuck at a level whose approver can no longer approve. */
  stuck: string | null;
}

/** A run as the Runs grid and the Run tab show it. */
export interface PayrollRunView extends Omit<PayrollRun, "generatedAt" | "reviewedAt" | "approvedAt" | "lockedAt" | "createdAt" | "updatedAt" | "submittedAt" | "runType" | "calendar" | "approvalType" | "approvalLevels" | "approvalRoute" | "variance"> {
  /** "Aswin 2083", "October 2026 · Festival bonus". */
  label: string;
  calendar: "BS" | "AD";
  runType: RunType;
  /** "All branches" or "Head Office, Pokhara". */
  scopeText: string;
  generatedAt: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  lockedAt: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  preparedByName: string;
  approvalType: "simple" | "multi_level" | null;
  flow: ApprovalFlow;
  currentLevel: number;
  approvalRoute: ApprovalRoute | null;
  variance: RunVariance | null;
  /** Flags still to acknowledge (0 once the variance step is done). */
  varianceOpen: number;
  timeline: ApprovalTimelineEntry[];
  /** "Waiting for Level 1 · Hari Thapa", "Approved", … */
  statusText: string;
  /** Branches of the run whose attendance month is still open (re-checked when the run is read). */
  openMonths: string[];
  can: RunActions;
}

/** The payslips of the selected run, with each employee's heads loaded on demand. */
export interface RunDetail {
  run: PayrollRunView;
  slips: PayrollSlip[];
  preflight: PreflightResult | null;
}

export interface PayrollRunsPageData {
  /** The company's pay calendar (Payroll settings). */
  calendar: "BS" | "AD";
  runs: PayrollRunView[];
  selected: RunDetail | null;
  policy: ApprovalPolicy;
  approvers: ApproverInfo[];
  /** For the New run window. */
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  categories: string[];
  employees: { id: string; name: string; employeeCode: string; branchId: string; departmentId: string; designationId: string; category: string }[];
  occasionalAllowances: { id: string; name: string; isFestivalAllowance: boolean; isRemoteAllowance: boolean }[];
  /** isTds: the income tax head (the pane shows it as "Income tax"); addable: may be added to a payslip by hand (not statutory, not a feed). */
  allPayHeads: { id: string; name: string; code: string; type: "allowance" | "deduction"; isTds: boolean; addable: boolean }[];
  /** The month a new run would be for: the working period, else the month after the last regular run, else the month before today's. */
  suggested: { year: number; month: number };
  today: string;
  currentUserId: string;
  myEmployeeId: string | null;
  permissions: { generate: boolean; edit: boolean; approve: boolean; lock: boolean; delete: boolean; export: boolean; settings: boolean };
}

/** A payslip's heads for the detail pane. */
export interface SlipDetail {
  slip: PayrollSlip;
  heads: PayrollSlipHead[];
}

/** The New run window's payload (checked and generated on the server). */
export interface NewRunInput {
  runType: RunType;
  payPeriodYear: number;
  payPeriodMonth: number;
  branchIds: string[];
  departmentIds: string[];
  designationIds: string[];
  employeeCategories: string[];
  employeeIds: string[];
  /** Regular runs: festival / remote-area heads paid this month too. Festival runs: the festival heads paid. */
  occasionalAllowanceHeadIds: string[];
  payslipDate: string | null;
  /** Replace an existing draft for the same period and branches. */
  recreateIfExists?: boolean;
  /** F6 festival runs: pay in proportion for service under a year (Labour Act §37); default true. */
  prorateFestival?: boolean;
}

// ---------------------------------------------------------------------------
// 4.8b-3 Final settlement
// ---------------------------------------------------------------------------

/** E1: the month chosen in the title bar, in the company's pay calendar. */
export interface WorkingPeriod {
  calendar: "BS" | "AD";
  year: number;
  month: number;
}

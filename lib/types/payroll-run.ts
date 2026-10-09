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

/** Kinds of run (4.8b). */
export const RUN_TYPES = ["REGULAR", "FESTIVAL_BONUS", "ARREARS", "FINAL_SETTLEMENT"] as const;
export type RunType = (typeof RUN_TYPES)[number];

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
  /** Kind Arrears: the employees and months with a difference to pay (ticked in the window). */
  arrears?: ArrearsCandidate[];
  /** Kind Final settlement: the preview for the chosen exit case. */
  settlement?: SettlementPreview;
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
  varianceThresholdPct: number;
  /** For the New run window. */
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  categories: string[];
  employees: { id: string; name: string; employeeCode: string; branchId: string; departmentId: string; designationId: string; category: string }[];
  occasionalAllowances: { id: string; name: string; isFestivalAllowance: boolean; isRemoteAllowance: boolean }[];
  allPayHeads: { id: string; name: string; code: string; type: "allowance" | "deduction" }[];
  /** The month a new run would be for: the working period, else the month after the last regular run, else the month before today's. */
  suggested: { year: number; month: number };
  /** Closed exit cases in scope (kind Final settlement), with the run that settles them when there is one. */
  exitCases: { id: string; employeeId: string; employeeName: string; employeeCode: string; lastWorkingDay: string; kindName: string; runId: string | null }[];
  settlement: SettlementSettings;
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
  occasionalAllowanceHeadIds: string[];
  payslipDate: string | null;
  /** Replace an existing draft for the same period and branches. */
  recreateIfExists?: boolean;
  /** Kind Arrears: the source months to pay, per employee. */
  picks?: { employeeId: string; months: { calendar: "BS" | "AD"; year: number; month: number; kind: "salary" | "attendance" }[] }[];
  /** Kind Final settlement: the closed exit case to settle, and the notice period recovery (NPR). */
  exitCaseId?: string | null;
  noticeRecovery?: string;
}

// ---------------------------------------------------------------------------
// 4.8b Arrears
// ---------------------------------------------------------------------------

/** A month's pay in the parts arrears compare (NPR, 2 decimals). */
export interface ArrearsComponents {
  basic: string;
  grade: string;
  allowances: string;
  otAmount: string;
  absentDeduction: string;
  grossEarnings: string;
  pfEmployee: string;
  pfEmployer: string;
  ssfEmployee: string;
  ssfEmployer: string;
  citDeduction: string;
  otherDeductions: string;
}

/** One source month on an arrears payslip: what was paid, what is due now, the difference. */
export interface ArrearsMonthLine {
  kind: "salary" | "attendance";
  calendar: "BS" | "AD";
  year: number;
  month: number;
  /** "Bhadra 2083" */
  label: string;
  /** `batch:<id>` for a salary revision, `attendance:<periodId>` for a re-closed month. */
  sourceRef: string;
  /** The locked regular payslip of that month. */
  sourceSlipId: string;
  paid: ArrearsComponents;
  due: ArrearsComponents;
  diff: ArrearsComponents;
}

/** What an arrears payslip pays for its month lines. */
export interface ArrearsSlipFigures {
  earnings: { label: string; amount: string }[];
  deductions: { label: string; amount: string }[];
  grossEarnings: string;
  totalDeductions: string;
  /** The positive earnings: taxed once through the projection. */
  taxableGross: string;
  retirement: string;
  cit: string;
  pfEmployee: string;
  pfEmployer: string;
  ssfEmployee: string;
  ssfEmployer: string;
}

/** An employee with months whose pay differs from what was locked (the New run window, kind Arrears). */
export interface ArrearsCandidate {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  lines: ArrearsMonthLine[];
  /** Net effect of every line (earnings − deductions). */
  net: string;
  /** Why it cannot be included now (an arrears run already holds it). */
  blocked: string | null;
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

/** Company rules for a leaver's gratuity (Payroll settings, `payroll.settlement`). */
export interface SettlementSettings {
  /** Percent of the basic salary per month served (Labour Act §53: 8.33). */
  gratuityPctPerMonth: number;
  /** Months of service before any gratuity is due (12). */
  gratuityMinMonths: number;
  /** Flat tax withheld on the gratuity (ITA §88: 5). */
  gratuityWithholdingPct: number;
  /** Pay a gratuity to SSF members too (off: the fund carries it). */
  gratuityForSsfMembers: boolean;
}

export type SettlementLineCode = "MONTH" | "ENCASHMENT" | "GRATUITY" | "FUND_PAYOUT" | "LOAN_CLOSEOUT" | "NOTICE_RECOVERY" | "GRATUITY_TDS";

export interface SettlementFigures {
  earnings: { code: SettlementLineCode; label: string; amount: string }[];
  deductions: { code: SettlementLineCode; label: string; amount: string }[];
  grossEarnings: string;
  /** Without the income tax (worked out once by the projection). */
  totalDeductions: string;
  /** Income taxed through the projection: the month, the encashment, the employer's fund share. */
  taxableGross: string;
  /** The part of taxableGross paid once. */
  oneOffTaxable: string;
  gratuityWithheld: string;
}

/** What a settlement payslip settled (kept on the slip; the LOCK posts it). */
export interface SettlementDetail extends SettlementFigures {
  exitCaseId: string;
  lastWorkingDay: string;
  monthsServed: number;
  /** The last month's pay, or null when that month was already paid in a locked run. */
  month: { label: string; calendar: "BS" | "AD"; year: number; month: number; unpaidDays: number; closed: boolean } | null;
  encashment: { leaveTypeId: string; leaveTypeName: string; days: number; perDay: string; amount: string }[];
  gratuity: { basic: string; months: number; pct: number; amount: string; reason: string | null };
  funds: { fundTypeId: string; code: string; name: string; employee: string; employer: string }[];
  loans: { loanId: string; name: string; remaining: string }[];
  noticeRecovery: string;
}

/** The New run window's preview of a settlement (worked out again at generation). */
export interface SettlementPreview extends SettlementDetail {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  tds: string;
  net: string;
  /** Why it cannot be generated now. */
  blocked: string | null;
}

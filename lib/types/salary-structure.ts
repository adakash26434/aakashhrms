// Salary structure (4.4): each employee's pay as dated revisions (history
// kept), changed one by one or in bulk, optionally approved by a second
// person; standard templates; printable revision letters.

import type { ApprovalFlow, ApprovalPolicy, ApprovalRoute, ApprovalTimelineEntry, ApproverInfo } from "@/lib/types/approval";
import type { PayHeadInput, TaxSlabInput } from "@/lib/engines/payroll.engine";
import type { GradePolicySettings, InsuranceDiscountsSettings, StatutoryDeductionLimitsSettings } from "@/lib/types/system-control";

export const STRUCTURE_TABS = ["structures", "bulk", "approvals", "templates"] as const;
export type StructureTab = (typeof STRUCTURE_TABS)[number];

/**
 * How a pay head behaves in a structure:
 * - amount:   a monthly amount typed per employee (fixed allowances, fixed deductions, CIT)
 * - computed: assigned yes / no; payroll works the amount out (percentage, festival, remote)
 * - scheme:   SSF or PF heads, chosen as the employee's retirement scheme
 * - auto:     never assigned by hand (TDS, overtime, absence, leave)
 */
export type HeadKind = "amount" | "computed" | "scheme" | "auto";
export type RetirementScheme = "ssf" | "pf" | "none";

export interface StructureHead {
  id: string;
  code: string;
  name: string;
  type: "allowance" | "deduction";
  kind: HeadKind;
  /** For scheme heads. */
  scheme?: "ssf" | "pf";
  /** How payroll works it out, in words ("10% of basic + grade", "Festival month only"). */
  rule: string;
  /** Monthly percentage of basic / basic + grade, for previews (0 = not monthly). */
  percent: number;
  percentBase: "basic" | "basicPlusGrade";
  /** Paid only in some months (festival, remote): left out of monthly totals. */
  occasional: boolean;
  /**
   * Onboarding's "Basic Salary" / "Grade Amount" heads: labels for the base pay
   * set in the structure itself. Never offered for new entry; an amount already
   * stored on one is shown (with a warning) because payroll pays it on top.
   */
  labelOnly?: boolean;
  /** The pay head as payroll reads it (flags, calculation, taxable): pay estimates use it. */
  payroll: Omit<PayHeadInput, "amount">;
  /** Departments / designations the head is for (empty = everyone), from Pay heads. */
  appliesTo: { departmentIds: string[]; designationIds: string[] };
}

/** The editable content of a revision. */
export interface StructureLines {
  basic: number;
  gradeCount: number;
  gradeAmount: number;
  gradeManual: boolean;
  scheme: RetirementScheme;
  /** Monthly amount per "amount" head (0 = not assigned). */
  amounts: Record<string, number>;
  /** "computed" heads assigned to the employee. */
  computed: string[];
}

/** One named line of a breakdown (an allowance or a fixed deduction). */
export interface BreakdownItem {
  id: string;
  name: string;
  type: "allowance" | "deduction";
  amount: number;
}

/**
 * A structure's monthly breakdown, in the payslip's terms (SSF shown as the
 * payslip shows it: the employer's 20% in earnings, the full 31% deducted):
 *
 *   Total salary    = basic + grade + allowances
 *   Gross earnings  = total salary + SSF employer 20%
 *   Total deductions = SSF 31% / PF employee + other deductions + income tax
 *   Net payable     = gross earnings − total deductions
 *   Cost to company = gross earnings + PF employer
 */
export interface StructureTotals {
  basic: number;
  grade: number;
  /** Monthly allowances (fixed and percentage; festival / remote left out). */
  allowances: number;
  totalSalary: number;
  /** SSF employer 20% shown in earnings (0 without SSF). */
  employerInEarnings: number;
  grossEarnings: number;
  /** SSF 31% (11% + 20%) or provident fund (employee). */
  retirementDeduction: number;
  /** The employee's own share: SSF 11% or PF employee. */
  retirementEmployee: number;
  /** The company's share: SSF 20% or PF employer. */
  retirementEmployer: number;
  /** Fixed deductions and CIT. */
  otherDeductions: number;
  /** Monthly income tax as payroll would estimate it; null when not estimated (no employee, e.g. a template). */
  incomeTax: number | null;
  totalDeductions: number;
  /** Take-home: gross earnings − total deductions (before income tax when incomeTax is null). */
  netPayable: number;
  /** Total salary − other deductions − the employee's retirement share (stored on the revision as net_amount). */
  netBeforeTax: number;
  costToCompany: number;
  /** Named allowances and fixed deductions, as payroll works them out. */
  items: BreakdownItem[];
  /** Why the estimate could not be worked out (e.g. deductions above earnings). */
  problem?: string;
}

/** The employee details payroll's tax needs. */
export interface PayProfile {
  taxStatus: string;
  isDisabled: boolean;
  category: string;
  gender: string;
  joiningDate: string;
}

/** The company's tax rules for estimates (the active fiscal year's slabs). */
export interface TaxRules {
  slabs: TaxSlabInput[];
  limits: StatutoryDeductionLimitsSettings;
  insurance: InsuranceDiscountsSettings;
}

export type RevisionStatus = "approved" | "pending" | "rejected" | "withdrawn";

export interface RevisionSummary {
  id: string;
  batchId: string | null;
  effectiveFrom: string;
  status: RevisionStatus;
  reason: string;
  lines: StructureLines;
  totals: StructureTotals;
  preparedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  approvedAt: string | null;
}

export interface StructureRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  designationId: string;
  designationName: string;
  levelCode: string;
  /** The level is in Setup (by code or name); if not, templates by level and the level's scale do not apply. */
  levelKnown: boolean;
  category: string;
  /** Joining date (AD, YYYY-MM-DD): a new hire's structure is set up from it. */
  joiningDate: string;
  /** For the income tax estimate. */
  profile: PayProfile;
  /** SSF is the expected scheme: the company has SSF and the employment type allows it. */
  ssfExpected: boolean;
  /**
   * current: an approved structure; future: the latest takes effect later;
   * pending: a change waits for approval; setup: only basic + grade from the
   * employee form (no scheme, no pay heads yet); none: no structure.
   */
  status: "current" | "future" | "pending" | "setup" | "none";
  current: RevisionSummary | null;
  pendingBatchId: string | null;
}

export type BatchKind = "single" | "bulk" | "import" | "hire" | "policy" | "setup";
export type BatchStatus = "pending" | "approved" | "rejected" | "withdrawn";

export type { ApprovalRoute } from "@/lib/types/approval";

export interface BatchLine {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  before: { lines: StructureLines; totals: StructureTotals } | null;
  after: { lines: StructureLines; totals: StructureTotals };
}

export interface BatchRow {
  id: string;
  kind: BatchKind;
  effectiveFrom: string;
  reason: string;
  status: BatchStatus;
  employeeCount: number;
  monthlyChange: number;
  preparedById: string | null;
  preparedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** How it was approved (null while waiting or not approved). */
  approvalRoute: ApprovalRoute | null;
  /** The flow fixed when it was submitted, and the level waiting now. */
  flow: ApprovalFlow;
  currentLevel: number;
  /** Every step: submitted, levels, final approve, rejection, withdrawal. */
  timeline: ApprovalTimelineEntry[];
  createdAt: string;
  lines: BatchLine[];
  /** Every employee in the batch (lines show only those in the user's scope). */
  employeeIds: string[];
}

export interface TemplateRow {
  id: string;
  code: string;
  name: string;
  levelCodes: string[];
  designationIds: string[];
  basicMode: "amount" | "level_start";
  basicAmount: number;
  scheme: RetirementScheme | "keep";
  heads: { payHeadId: string; amount: number }[];
  isActive: boolean;
}

export interface SalaryStructureData {
  tab: StructureTab;
  rows: StructureRow[];
  heads: StructureHead[];
  levels: { code: string; name: string; minSalary: number }[];
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  batches: BatchRow[];
  templates: TemplateRow[];
  gradePolicy: GradePolicySettings | null;
  ssfBase: "BasicSalary" | "BasicPlusGrade";
  pfPercent: number;
  /** Tax rules for the income tax estimate (same as payroll). */
  tax: TaxRules;
  /** Company approval setting for salary changes, and who can approve. */
  approvalPolicy: ApprovalPolicy;
  approvers: ApproverInfo[];
  /** Today (AD, Nepal time): delegations are checked against it. */
  today: string;
  currentUserId: string;
  /** The current user's own salary rules (S21) and approval standing. */
  me: {
    /** Employee record linked to the user account (null: not linked). */
    employeeId: string | null;
    /** Can approve salary changes company-wide (not a platform support login). */
    isAdministrator: boolean;
    /** Other active users who can approve salary changes (for "nobody else can approve"). */
    otherApprovers: number;
  };
  /** Payroll months already approved or locked per employee: the latest period end (AD date). */
  finalisedUntil: Record<string, string>;
  /** Every revision per employee, newest first (history and letters). */
  history: Record<string, RevisionSummary[]>;
  permissions: {
    add: boolean;
    edit: boolean;
    /** Delete templates (salary revisions are never deleted). */
    delete: boolean;
    approve: boolean;
    export: boolean;
  };
}

// ---------------------------------------------------------------------------
// What the browser sends (the server reshapes and re-checks all of it)
// ---------------------------------------------------------------------------

export interface RevisionInput {
  employeeId: string;
  lines: StructureLines;
}

export interface BatchInput {
  /** setup: completing new hires' structures (basic + grade only); may be submitted unchanged. */
  kind: "single" | "bulk" | "import" | "setup";
  effectiveFrom: string;
  reason: string;
  rows: RevisionInput[];
}

export interface TemplateInput {
  code: string;
  name: string;
  levelCodes: string[];
  designationIds: string[];
  basicMode: "amount" | "level_start";
  basicAmount: number;
  scheme: RetirementScheme | "keep";
  heads: { payHeadId: string; amount: number }[];
}

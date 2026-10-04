// Salary structure (4.4): each employee's pay as dated revisions (history
// kept), changed one by one or in bulk, optionally approved by a second
// person; standard templates; printable revision letters.

import type { GradePolicySettings } from "@/lib/types/system-control";

export const STRUCTURE_TABS = ["structures", "bulk", "changes", "templates"] as const;
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

export interface StructureTotals {
  allowances: number;
  /** Fixed deductions + CIT (before tax and retirement). */
  deductions: number;
  retirementEmployee: number;
  retirementEmployer: number;
  gross: number;
  /** Gross − deductions − employee retirement contribution (TDS not included). */
  netBeforeTax: number;
  /** Gross + employer retirement contribution. */
  employerCost: number;
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
  category: string;
  /** current: an approved structure; future: the latest takes effect later; pending: a change waits for approval. */
  status: "current" | "future" | "pending" | "none";
  current: RevisionSummary | null;
  pendingBatchId: string | null;
}

export type BatchKind = "single" | "bulk" | "import" | "hire" | "policy";
export type BatchStatus = "pending" | "approved" | "rejected" | "withdrawn";

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
  createdAt: string;
  lines: BatchLine[];
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
  approvalRequired: boolean;
  currentUserId: string;
  /** Every revision per employee, newest first (history and letters). */
  history: Record<string, RevisionSummary[]>;
  permissions: {
    add: boolean;
    edit: boolean;
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
  kind: "single" | "bulk" | "import";
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

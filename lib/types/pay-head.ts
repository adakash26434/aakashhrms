/**
 * Pay Head Setup — domain types.
 *
 * A Pay Head is a single allowance or deduction line item that can
 * be assigned to an employee via salary mapping. Every pay head
 * has a calculation basis (what it depends on), an optional
 * percentage, applicability rules (departments + positions), and
 * one or more statutory flags (TDS / PF / SSF / Festival / etc).
 *
 * The shape here mirrors the `pay_heads` table from the
 * architecture doc §4.2, plus UI-only fields (`createdAt`,
 * `updatedAt`) for the future audit log. Calculation semantics
 * live in `lib/engines/pay-head.engine.ts`.
 *
 * The 9 statutory flags are:
 *   Festival Allowance, Absent Deduction, Overtime Head,
 *   Leave Head, TDS/Tax Head, PF Head, SSF Head, Remote
 *   Allowance, CIT Head.
 * Each gets display metadata (label + short letter + tooltip).
 */

import type { LucideIcon } from "lucide-react";
import {
  Gift,
  UserX,
  Clock,
  Palmtree,
  Receipt,
  PiggyBank,
  Shield,
  ShieldPlus,
  Wifi,
  Landmark,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type PayHeadType = "allowance" | "deduction";

/**
 * What the pay head is calculated on. "None" means a fixed amount
 * (no calculation basis — just pay the absolute NPR amount).
 */
export type CalcBasis = "BasicSalary" | "BasicPlusGrade" | "None";

/**
 * Parameter name used in formula expressions. In our system:
 *   - "BasicSalary" corresponds to the Basic salary component
 *   - "BasicPlusGrade" corresponds to (Basic + Grade)
 *   - "FixedAmount" corresponds to a flat value with no percentage
 *
 * (Note: The Excel spec calls this "Paramiter" and had values like
 * "Basic", "Basic+Grade", "Fixed". We use standard camelCase,
 * but parameter is "Basic Salary" — same value, just a label).
 */
export type CalcParameter = "BasicSalary" | "BasicPlusGrade" | "FixedAmount";

export const STATUTORY_FLAGS = [
  "isFestivalAllowance",
  "isAbsentDeduct",
  "isOtHead",
  "isLeaveHead",
  "isTdsHead",
  "isPfHead",
  "isSsfHead",
  "isSsfEmployerHead",
  "isRemoteAllowance",
  "isCitHead",
] as const;

export type StatutoryFlag = (typeof STATUTORY_FLAGS)[number];

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export interface StatutoryFlagMeta {
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Display metadata for statutory flags.
 * Grouping:
 *   1. Allowances: Festival, Absent, Overtime, Leave, SSF Employer (20%), Remote
 *   2. Deductions / Statutory: TDS, PF, SSF Total (31%), CIT
 */
export const STATUTORY_FLAG_META: Record<StatutoryFlag, StatutoryFlagMeta> = {
  isFestivalAllowance: {
    label: "Festival Allowance",
    short: "F",
    description: "Applied during festival months (Dashain/Tihar)",
    icon: Gift,
  },
  isAbsentDeduct: {
    label: "Absent Deduction",
    short: "LV",
    description: "Deducted for absent days",
    icon: UserX,
  },
  isOtHead: {
    label: "Overtime Head",
    short: "OT",
    description: "Calculated based on overtime hours",
    icon: Clock,
  },
  isLeaveHead: {
    label: "Leave Head",
    short: "L",
    description: "Calculated based on leave balance",
    icon: Palmtree,
  },
  isTdsHead: {
    label: "TDS / Tax Head",
    short: "TDS",
    description: "Calculates TDS as per tax rate setup",
    icon: Receipt,
  },
  isPfHead: {
    label: "PF Head",
    short: "PF",
    description: "Provident Fund contribution",
    icon: PiggyBank,
  },
  isSsfHead: {
    label: "SSF Total Deduction (31%)",
    short: "SSF",
    description: "Social Security Fund deduction (11% employee + 20% employer)",
    icon: Shield,
  },
  isSsfEmployerHead: {
    label: "SSF Employer Addition (20%)",
    short: "SSF-ER",
    description: "20% Social Security Fund contribution added by company",
    icon: ShieldPlus,
  },
  isRemoteAllowance: {
    label: "Remote Allowance",
    short: "RM",
    description: "Additional allowance for remote workers",
    icon: Wifi,
  },
  isCitHead: {
    label: "CIT Head",
    short: "CIT",
    description: "Citizen Investment Trust deduction",
    icon: Landmark,
  },
};

// ---------------------------------------------------------------------------
// Statutory KPI
// ---------------------------------------------------------------------------

/**
 * The subset of statutory flags that count toward the "Statutory"
 * KPI card.
 */
export const STATUTORY_KPI_FLAGS: StatutoryFlag[] = [
  "isPfHead",
  "isSsfHead",
  "isSsfEmployerHead",
  "isCitHead",
  "isTdsHead",
];

// ---------------------------------------------------------------------------
// Main entity
// ---------------------------------------------------------------------------

export interface PayHead {
  id: string;
  /** Human code, e.g. "PH-001". Server-assigned on create. */
  code: string;
  name: string;
  type: PayHeadType;
  /** Whether this head is part of taxable income. */
  effectOnTax: boolean;
  calcBasis: CalcBasis;
  calcParameter: CalcParameter;
  /** 0–100. Ignored when calcBasis === "None". */
  calcPercent: number;
  /**
   * Department IDs this head applies to. Empty array means
   * "all departments" (per the design's "All Depts" badge).
   */
  applicableDepartmentIds: string[];
  /**
   * Designation IDs this head applies to. Empty array means
   * "all designations".
   */
  applicableDesignationIds: string[];
  /** 9 statutory flags. Only the true ones are stored. */
  flags: Partial<Record<StatutoryFlag, boolean>>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Form data (subset edited by the modal)
// ---------------------------------------------------------------------------

export interface PayHeadFormData {
  name: string;
  type: PayHeadType;
  effectOnTax: boolean;
  calcBasis: CalcBasis;
  calcParameter: CalcParameter;
  calcPercent: number;
  applicableDepartmentIds: string[];
  applicableDesignationIds: string[];
  flags: Partial<Record<StatutoryFlag, boolean>>;
}

// ---------------------------------------------------------------------------
// Aggregate shape returned by the data layer
// ---------------------------------------------------------------------------

export interface PayHeadData {
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  payHeads: PayHead[];
}

// ---------------------------------------------------------------------------
// Display formatters
// ---------------------------------------------------------------------------

/**
 * "BasicSalary" → "Basic Salary"
 * "BasicPlusGrade" → "Basic + Grade"
 * "None" → "None"
 */
export function formatCalcBasis(basis: CalcBasis): string {
  switch (basis) {
    case "BasicSalary":
      return "Basic Salary";
    case "BasicPlusGrade":
      return "Basic + Grade";
    case "None":
      return "None";
  }
}

/**
 * "BasicSalary" → "Basic Salary"
 * "BasicPlusGrade" → "Basic + Grade"
 * "FixedAmount" → "Fixed Amount"
 */
export function formatCalcParameter(param: CalcParameter): string {
  switch (param) {
    case "BasicSalary":
      return "Basic Salary";
    case "BasicPlusGrade":
      return "Basic + Grade";
    case "FixedAmount":
      return "Fixed Amount";
  }
}

export function formatPayHeadType(t: PayHeadType): string {
  return t === "allowance" ? "Allowance" : "Deduction";
}

/**
 * "100" → "100%"; "50" → "50%"; "0" or empty → "—".
 * One decimal place when non-integer (e.g. 7.5 → "7.5%").
 */
export function formatCalcPercent(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "—";
  return `${p % 1 === 0 ? p.toString() : p.toString()}%`;
}

/**
 * "10000" → "10,000" (en-IN thousand separators).
 * Used by the "100%" / "50%" etc. cells in the table.
 */
export function formatNPRAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN");
}

/**
 * Return the list of statutory flag codes that are currently
 * active (true) on this head. Order follows `STATUTORY_FLAGS`.
 */
export function activeFlags(
  flags: Partial<Record<StatutoryFlag, boolean>>,
): StatutoryFlag[] {
  return STATUTORY_FLAGS.filter((f) => flags[f] === true);
}

/**
 * True iff any of the four "primary statutory" flags is on
 * (used by the Statutory KPI card).
 */
export function isStatutory(flags: Partial<Record<StatutoryFlag, boolean>>): boolean {
  return STATUTORY_KPI_FLAGS.some((f) => flags[f] === true);
}

// ---------------------------------------------------------------------------
// Type filter (All / Allowance / Deduction)
// ---------------------------------------------------------------------------

export type TypeFilter = "all" | PayHeadType;

export const TYPE_FILTERS: TypeFilter[] = ["all", "allowance", "deduction"];

export function formatTypeFilter(f: TypeFilter): string {
  switch (f) {
    case "all":
      return "All";
    case "allowance":
      return "Allowance";
    case "deduction":
      return "Deduction";
  }
}

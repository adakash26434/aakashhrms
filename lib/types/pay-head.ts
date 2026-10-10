/**
 * Pay heads — domain types.
 *
 * A pay head is one allowance or deduction line that salary structures and
 * payslips name. What a head is (its role) sets its type and the statutory
 * flag payroll reads; the rules live in lib/engines/pay-head.engine.ts.
 * Applicability lists are department / designation ids; an empty list means
 * everyone.
 */

export type PayHeadType = "allowance" | "deduction";

/** What a share is worked out on; "None" means an amount typed for each employee. */
export type CalcBasis = "BasicSalary" | "BasicPlusGrade" | "None";

/** The stored twin of the basis ("FixedAmount" with "None"). */
export type CalcParameter = "BasicSalary" | "BasicPlusGrade" | "FixedAmount";

/** The flags payroll reads to treat a head specially (each role sets at most one). */
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

export interface PayHead {
  id: string;
  /** "PH-001": given once by the server, never changed. */
  code: string;
  name: string;
  /** F11: Nepali name for the bilingual payslip; null = print the English name. */
  nameNp?: string | null;
  type: PayHeadType;
  /** Counted as taxable income. */
  effectOnTax: boolean;
  calcBasis: CalcBasis;
  calcParameter: CalcParameter;
  /** 0–100; ignored for a typed amount. */
  calcPercent: number;
  /** Department ids it is for; empty = every department. */
  applicableDepartmentIds: string[];
  /** Designation ids it is for; empty = every designation. */
  applicableDesignationIds: string[];
  flags: Partial<Record<StatutoryFlag, boolean>>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 4.12b: the Pay heads screen (lib/engines/pay-head.engine.ts)
// ---------------------------------------------------------------------------

/** What a head is; it sets the type and the statutory flag payroll reads. */
export type PayHeadRole =
  | "allowance"
  | "deduction"
  | "festival"
  | "remote"
  | "overtime"
  | "absence"
  | "leave"
  | "tds"
  | "pf"
  | "ssf"
  | "ssfEmployer"
  | "cit";

/** How the amount is worked out: typed for each employee, or from basic / basic + grade. */
export type PayHeadCalc = "typed" | "basic" | "basicPlusGrade";

export interface PayHeadForm {
  name: string;
  nameNp: string;
  role: PayHeadRole;
  calc: PayHeadCalc;
  /** Percentage of the base (share options only). */
  percent: number;
  /** Counted as taxable income (allowances). */
  taxable: boolean;
  /** Empty: every department / designation. */
  departmentIds: string[];
  designationIds: string[];
}

export type PayHeadFormErrors = Partial<Record<keyof PayHeadForm, string>>;

export interface PayHeadRow {
  id: string;
  code: string;
  name: string;
  nameNp: string | null;
  type: PayHeadType;
  role: PayHeadRole;
  roleLabel: string;
  /** How the amount is worked out, in words. */
  calc: string;
  taxable: boolean;
  appliesTo: string;
  /** Salary structures (any revision), payslip lines and salary templates that use it. */
  usage: { structures: number; payslips: number; templates: number };
  /** Why it keeps its role and sums (null: an ordinary head). */
  system: string | null;
  cannotDelete: string | null;
  form: PayHeadForm;
}

export interface PayHeadsPage {
  heads: PayHeadRow[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  /** Pay heads → Add / Edit / Delete (buttons only; the server checks a company-wide role). */
  can: { add: boolean; edit: boolean; delete: boolean };
}

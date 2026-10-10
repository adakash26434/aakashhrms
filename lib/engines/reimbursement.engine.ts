// Reimbursements (4.8 / F16): pure rules, unit-tested in tests/reimbursement.engine.test.ts.
//
// A type says whether its claims are taxable income, the most one claim may be, the most an
// employee may claim of it in a fiscal year, and whether a bill / receipt number is needed. A claim
// is one bill: draft → submitted → approved (or returned to draft / rejected, each with a note) →
// settled when paid — by the pay run (REIMBURSE / REIMBURSE_TAX lines) or by hand. Nobody decides
// their own claim (S21). Amounts are worked in paisa.

export const REIMBURSEMENT_STATUSES = ["draft", "submitted", "approved", "rejected", "settled"] as const;
export type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];

export function nextStatuses(from: string): ReimbursementStatus[] {
  switch (from) {
    case "draft":
      return ["submitted"];
    case "submitted":
      return ["approved", "rejected", "draft"];
    case "approved":
      return ["settled"];
    default:
      return [];
  }
}
export const canMove = (from: string, to: string): boolean => (nextStatuses(from) as string[]).includes(to);
export const isEditable = (status: string): boolean => status === "draft";
export const asStatus = (s: string): ReimbursementStatus => ((REIMBURSEMENT_STATUSES as readonly string[]).includes(s) ? (s as ReimbursementStatus) : "draft");

/** A claim older than this can't be submitted (bills belong to the year they were paid in). */
export const MAX_CLAIM_AGE_DAYS = 365;
const MAX_AMOUNT = 10_000_000;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : fallback);
const paisa = (v: number | string | null | undefined) => Math.round(Number(v || 0) * 100);
const npr = (p: number) => (p / 100).toFixed(2);
export const nprText = (v: number | string) => `NPR ${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** An amount as typed: a number with at most two decimals, else NaN. */
function amount(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) && Math.round(v * 100) === v * 100 ? v : NaN;
  const t = typeof v === "string" ? v.trim().replace(/,/g, "") : "";
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : t === "" ? 0 : NaN;
}

// ---- types ------------------------------------------------------------------------------------

export interface TypeForm {
  code: string;
  name: string;
  nameNp: string;
  taxable: boolean;
  perClaimCap: number;
  yearlyCap: number;
  receiptRequired: boolean;
  isActive: boolean;
}

export function normalizeTypeForm(raw: unknown): TypeForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    code: str(r.code, 30).toUpperCase().replace(/\s+/g, "_"),
    name: str(r.name, 100),
    nameNp: str(r.nameNp, 100),
    taxable: bool(r.taxable, false),
    perClaimCap: amount(r.perClaimCap),
    yearlyCap: amount(r.yearlyCap),
    receiptRequired: bool(r.receiptRequired, true),
    isActive: bool(r.isActive, true),
  };
}

/** `savedCode`: the code of the type being edited (a code never changes). */
export function validateTypeForm(f: TypeForm, savedCode?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[A-Z][A-Z0-9_]{1,29}$/.test(f.code)) errors.code = "2–30 capital letters, digits or _ (e.g. MEDICAL)";
  else if (savedCode && savedCode !== f.code) errors.code = "A type's code never changes (add a new type instead)";
  if (f.name.length < 2) errors.name = "Give the type a name";
  for (const k of ["perClaimCap", "yearlyCap"] as const) {
    if (Number.isNaN(f[k]) || f[k] < 0 || f[k] > MAX_AMOUNT) errors[k] = "An amount in rupees (0 = no cap)";
  }
  if (!errors.perClaimCap && !errors.yearlyCap && f.perClaimCap > 0 && f.yearlyCap > 0 && f.perClaimCap > f.yearlyCap) errors.perClaimCap = "More than the yearly cap";
  return errors;
}

// ---- claims -----------------------------------------------------------------------------------

export interface ClaimForm {
  employeeId: string;
  typeId: string;
  /** AD "YYYY-MM-DD": the bill's date. */
  expenseDate: string;
  amount: number;
  receiptNo: string;
  description: string;
}

export interface ClaimTypeRule {
  receiptRequired: boolean;
  perClaimCap: number;
  isActive: boolean;
}

export function normalizeClaimForm(raw: unknown): ClaimForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    employeeId: str(r.employeeId, 64),
    typeId: str(r.typeId, 64),
    expenseDate: str(r.expenseDate, 10),
    amount: amount(r.amount),
    receiptNo: str(r.receiptNo, 60),
    description: str(r.description, 500),
  };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** `today`: Nepal's date, AD "YYYY-MM-DD". */
export function validateClaimForm(f: ClaimForm, type: ClaimTypeRule | null, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.employeeId) errors.employeeId = "Choose the employee";
  if (!f.typeId || !type) errors.typeId = "Choose what it is for";
  else if (!type.isActive) errors.typeId = "This type is no longer in use";
  if (!ISO.test(f.expenseDate) || Number.isNaN(Date.parse(`${f.expenseDate}T00:00:00Z`))) errors.expenseDate = "Give the bill's date";
  else if (f.expenseDate > today) errors.expenseDate = "The bill's date can't be in the future";
  else if (daysBetween(f.expenseDate, today) > MAX_CLAIM_AGE_DAYS) errors.expenseDate = `Bills older than ${MAX_CLAIM_AGE_DAYS} days can't be claimed`;
  if (Number.isNaN(f.amount) || f.amount <= 0) errors.amount = "The amount on the bill, in rupees";
  else if (f.amount > MAX_AMOUNT) errors.amount = "That is more than any claim can be";
  else if (type && type.perClaimCap > 0 && paisa(f.amount) > paisa(type.perClaimCap)) errors.amount = `At most ${nprText(type.perClaimCap)} a claim`;
  if (type?.receiptRequired && !f.receiptNo) errors.receiptNo = "The bill / receipt number";
  if (f.description.length < 3) errors.description = "What it was for";
  return errors;
}

/**
 * The yearly cap check: `used` is what the employee already has in the cap's fiscal year (other
 * claims). Null when the claim fits (or there is no cap); otherwise what is left, said.
 */
export function capProblem(yearlyCap: number, used: number, claim: number, typeName: string): string | null {
  if (!(yearlyCap > 0)) return null;
  const left = Math.max(0, paisa(yearlyCap) - paisa(used));
  if (paisa(claim) <= left) return null;
  return left > 0 ? `Only ${nprText(npr(left))} left of the ${nprText(yearlyCap)} a year for ${typeName}` : `The ${nprText(yearlyCap)} a year for ${typeName} is used up`;
}

/** A return or a rejection says why; an approval may. */
export function validateDecisionNote(to: string, note: string): string | null {
  if ((to === "rejected" || to === "draft") && note.trim().length < 3) return to === "draft" ? "Say what to change" : "Say why it is rejected";
  return null;
}

/** What the pay run pays an employee: approved claims summed by taxability. */
export function feedAmounts(claims: readonly { taxable: boolean; amount: string | number }[]): { free: string; taxable: string } {
  let free = 0;
  let taxable = 0;
  for (const c of claims) {
    if (c.taxable) taxable += paisa(c.amount);
    else free += paisa(c.amount);
  }
  return { free: npr(free), taxable: npr(taxable) };
}

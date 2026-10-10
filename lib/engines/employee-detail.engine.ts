import type { ApprovalRequest, ApprovalWording, DecisionContext } from "@/lib/engines/approval.engine";
import type { CheckerMode } from "@/lib/engines/payroll-control.engine";
import { maskAccountNumber } from "@/lib/utils/mask";

// Sensitive employee details (4.8 / F13): the bank account salary is paid into, the PAN tax is
// reported against, and the tax status / disability relief that pick the tax slab. A change to
// them on an existing employee is a recorded change that a second person approves (maker-checker,
// S43) before payroll uses it:
//   - nobody approves a change to their own record (S21), whoever made it;
//   - otherwise it waits for someone with Employees → Approve, unless the company switched these
//     approvals off, or a company administrator saved it and Payroll controls' maker-checker is
//     "administrators may approve their own" (the strict mode makes administrators wait too).
// Pure: no database access.

export const DETAIL_FIELDS = ["bankName", "bankBranch", "bankAccountNumber", "panNumber", "taxStatus", "isDisabled"] as const;
export type DetailField = (typeof DETAIL_FIELDS)[number];

export interface DetailValues {
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  panNumber: string;
  taxStatus: string;
  isDisabled: boolean;
}

/** Some of the fields: what a change touches, before or after. */
export type DetailPatch = Partial<DetailValues>;

export const DETAIL_LABEL: Record<DetailField, string> = {
  bankName: "Bank",
  bankBranch: "Bank branch",
  bankAccountNumber: "Account number",
  panNumber: "PAN",
  taxStatus: "Tax status",
  isDisabled: "Disability relief",
};

/** How the fields read together ("Bank account and PAN"). */
export const DETAIL_GROUPS: readonly { id: "bank" | "pan" | "tax"; label: string; fields: readonly DetailField[] }[] = [
  { id: "bank", label: "Bank account", fields: ["bankName", "bankBranch", "bankAccountNumber"] },
  { id: "pan", label: "PAN", fields: ["panNumber"] },
  { id: "tax", label: "Tax status", fields: ["taxStatus", "isDisabled"] },
];

const TAX_STATUS_LABEL: Record<string, string> = { "Normal Single": "Single", Married: "Married (couple slab)", Widow: "Widow / widower" };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A record's or a form's sensitive values, compared the way they are saved (text trimmed). */
export function detailValues(src: {
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
  panNumber?: string | null;
  taxStatus?: string | null;
  isDisabled?: boolean | null;
}): DetailValues {
  return {
    bankName: text(src.bankName),
    bankBranch: text(src.bankBranch),
    bankAccountNumber: text(src.bankAccountNumber),
    panNumber: text(src.panNumber),
    taxStatus: text(src.taxStatus),
    isDisabled: src.isDisabled === true,
  };
}

/** A stored before / after value read back: only known fields with values of the right kind. */
export function readPatch(raw: unknown): DetailPatch {
  const out: Record<string, string | boolean> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const f of DETAIL_FIELDS) {
    const v = (raw as Record<string, unknown>)[f];
    if (f === "isDisabled" ? typeof v === "boolean" : typeof v === "string") out[f] = v as string | boolean;
  }
  return out as DetailPatch;
}

export interface DetailDiff {
  fields: DetailField[];
  before: DetailPatch;
  after: DetailPatch;
}

/** The fields a save changes, with their values before and after (null: nothing changes). */
export function detailDiff(stored: DetailValues, next: DetailValues): DetailDiff | null {
  const fields = DETAIL_FIELDS.filter((f) => stored[f] !== next[f]);
  if (!fields.length) return null;
  const pick = (v: DetailValues) => Object.fromEntries(fields.map((f) => [f, v[f]])) as DetailPatch;
  return { fields, before: pick(stored), after: pick(next) };
}

/**
 * A save while a change waits: the fields the form moves away from both the record and the
 * waiting change. Keeping the record's value, or sending the waiting value again, is not one.
 */
export function pendingConflicts(stored: DetailValues, next: DetailValues, waiting: DetailPatch): DetailField[] {
  return DETAIL_FIELDS.filter((f) => next[f] !== stored[f] && !(f in waiting && waiting[f] === next[f]));
}

/** Fields whose value on the record is no longer the one the change was made against. */
export function staleFields(current: DetailValues, before: DetailPatch): DetailField[] {
  return DETAIL_FIELDS.filter((f) => f in before && current[f] !== before[f]);
}

export const touchesBank = (patch: DetailPatch) => "bankName" in patch || "bankBranch" in patch || "bankAccountNumber" in patch;

// ---- When a change applies ------------------------------------------------------------------

/** Company setting (Payroll controls): changes wait for a second person, or apply at once. */
export type DetailApproval = "required" | "off";
export const asDetailApproval = (v: unknown): DetailApproval => (v === "off" ? "off" : "required");

export type DetailOutcome =
  | { kind: "apply"; route: "not_required" | "final_approve" }
  | { kind: "pending"; because: "approval" | "own_record" };

export function detailOutcome(i: { approval: DetailApproval; checker: CheckerMode; actorIsAdmin: boolean; ownRecord: boolean }): DetailOutcome {
  // S21: a change to your own record always waits for someone else, administrators included.
  if (i.ownRecord) return { kind: "pending", because: "own_record" };
  if (i.approval === "off") return { kind: "apply", route: "not_required" };
  if (i.actorIsAdmin && i.checker === "admin_exempt") return { kind: "apply", route: "final_approve" };
  return { kind: "pending", because: "approval" };
}

export const REASON_MIN = 5;
export const REASON_MAX = 500;

/** The reason a change is made (shown to the approver); null when it is too short. */
export function cleanReason(raw: unknown): string | null {
  const reason = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ").slice(0, REASON_MAX) : "";
  return reason.length >= REASON_MIN ? reason : null;
}

// ---- Deciding (the approval engine's simple flow) ----------------------------------------------

export const DETAIL_WORDING: ApprovalWording = {
  ownSubject: "This change is to your own record, so someone else has to approve it.",
  noPermission: "You can't approve changes to employee details (Employees → Approve).",
  preparer: "You made this change, so someone else has to approve it.",
};

const STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;
export type DetailStatus = (typeof STATUSES)[number];
export const asDetailStatus = (v: unknown): DetailStatus => (STATUSES as readonly unknown[]).includes(v) ? (v as DetailStatus) : "withdrawn";

/** A change as the approval engine sees it: one approver, the employee it is about as subject. */
export function detailRequest(c: { status: string; preparedBy: string | null; employeeId: string }): ApprovalRequest {
  return { status: asDetailStatus(c.status), preparedById: c.preparedBy, subjectEmployeeIds: [c.employeeId], flow: { type: "simple", levels: [] }, currentLevel: 0 };
}

/** Strict maker-checker: nobody approves a change they made, administrators included. */
export const detailDecisionCtx = (checker: CheckerMode, today: string): DecisionContext => ({
  approvers: [],
  today,
  wording: DETAIL_WORDING,
  preparerMayFinalApprove: checker !== "strict",
});

// ---- Words for screens and the audit trail ----------------------------------------------------

export interface DetailLine {
  field: DetailField;
  label: string;
  from: string;
  to: string;
}

function shown(field: DetailField, value: string | boolean | undefined, reveal: boolean): string {
  if (value === undefined) return "—";
  if (field === "isDisabled") return value ? "Yes" : "No";
  const v = String(value);
  if (!v) return "(none)";
  if (field === "taxStatus") return TAX_STATUS_LABEL[v] ?? v;
  // Account numbers and PAN in full only for people who may edit or approve them (S18).
  if (!reveal && (field === "bankAccountNumber" || field === "panNumber")) return maskAccountNumber(v);
  return v;
}

/** One line per changed field, in form order. */
export function detailLines(before: DetailPatch, after: DetailPatch, reveal: boolean): DetailLine[] {
  return DETAIL_FIELDS.filter((f) => f in after).map((f) => ({ field: f, label: DETAIL_LABEL[f], from: shown(f, before[f], reveal), to: shown(f, after[f], reveal) }));
}

/** A summary inside a sentence: "the bank account and PAN change" (PAN keeps its capitals). */
export const inSentence = (summary: string) => (summary.startsWith("PAN") ? summary : summary.charAt(0).toLowerCase() + summary.slice(1));

/** "Bank account", "Bank account and PAN", "Bank account, PAN and tax status". */
export function detailSummary(fields: readonly string[]): string {
  const groups = DETAIL_GROUPS.filter((g) => g.fields.some((f) => fields.includes(f))).map((g, i) => (i === 0 ? g.label : g.label === "PAN" ? g.label : g.label.toLowerCase()));
  if (groups.length <= 1) return groups[0] ?? "Employee details";
  return `${groups.slice(0, -1).join(", ")} and ${groups[groups.length - 1]}`;
}

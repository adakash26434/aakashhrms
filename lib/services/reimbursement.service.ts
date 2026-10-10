import * as repo from "@/lib/repositories/reimbursement.repository";
import { findEmployeeOptions } from "@/lib/repositories/letter.repository";
import {
  asStatus,
  canMove,
  capProblem,
  isEditable,
  normalizeClaimForm,
  normalizeTypeForm,
  validateClaimForm,
  validateDecisionNote,
  validateTypeForm,
} from "@/lib/engines/reimbursement.engine";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { DENIED_SELF, isOwnRecord } from "@/lib/auth/self-action";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { ReimbursementClaimRow, ReimbursementPage, ReimbursementTypeRow } from "@/lib/types/reimbursement";

// Reimbursements (4.8 / F16): orchestration. A claim is recorded for an active employee in the
// user's scope (or by the employee in self-service, submitted at once); its type's taxability is
// frozen on it when saved. The yearly cap counts the claims still in play when submitting and the
// approved / paid ones when approving. S21: nobody approves, rejects, returns or settles their
// own claim (audited DENIED_SELF); recording and submitting one's own is fine. Approved claims are
// paid by the pay run (payroll-feeds) or marked paid by hand.

export class ReimbursementValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Validation failed");
    this.name = "ReimbursementValidationError";
  }
}

export interface ReimbursementCtx {
  userId: string;
  /** The acting user's own employee record (S21), from the session. */
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

const IN_PLAY = ["submitted", "approved", "settled"] as const;
const COUNTED = ["approved", "settled"] as const;

const toType = (t: repo.TypeRecord): ReimbursementTypeRow => ({
  id: t.id,
  code: t.code,
  name: t.name,
  nameNp: t.nameNp,
  taxable: t.taxable,
  perClaimCap: Number(t.perClaimCap),
  yearlyCap: Number(t.yearlyCap),
  receiptRequired: t.receiptRequired,
  isActive: t.isActive,
});

const toClaim = (c: repo.ClaimJoined, actorEmployeeId: string | null): ReimbursementClaimRow => ({
  id: c.id,
  employeeId: c.employeeId,
  employeeName: c.employeeName,
  employeeCode: c.employeeCode,
  typeId: c.typeId,
  typeCode: c.typeCode,
  typeName: c.typeName,
  typeNameNp: c.typeNameNp,
  expenseDate: String(c.expenseDate).slice(0, 10),
  amount: Number(c.amount),
  receiptNo: c.receiptNo,
  description: c.description,
  taxable: c.taxable,
  status: asStatus(c.status),
  decisionNote: c.decisionNote,
  decidedByName: c.decidedByName,
  createdByName: c.createdByName,
  paidByPayroll: !!c.payrollRunId,
  own: isOwnRecord(actorEmployeeId, c.employeeId),
});

export async function reimbursementPage(ctx: ReimbursementCtx, permissions: ReimbursementPage["permissions"]): Promise<ReimbursementPage> {
  const scope = buildEmployeeScopeCondition(ctx.scope);
  const [claims, types, employees] = await Promise.all([repo.listClaims(scope), repo.listTypes(), findEmployeeOptions(scope)]);
  return {
    claims: claims.map((c) => toClaim(c, ctx.actorEmployeeId)),
    types: types.map(toType),
    employees: employees.map((e) => ({ id: e.id, name: e.fullName, code: e.employeeCode })),
    permissions,
  };
}

/** The signed-in employee's own claims and the types they can claim (self-service). */
export async function ownClaims(ctx: ReimbursementCtx): Promise<{ claims: ReimbursementClaimRow[]; types: ReimbursementTypeRow[] }> {
  if (!ctx.actorEmployeeId) return { claims: [], types: [] };
  const [claims, types] = await Promise.all([repo.listClaims(buildEmployeeScopeCondition(ctx.scope)), repo.listTypes()]);
  return {
    claims: claims.filter((c) => c.employeeId === ctx.actorEmployeeId).map((c) => toClaim(c, ctx.actorEmployeeId)),
    types: types.filter((t) => t.isActive).map(toType),
  };
}

export async function saveType(id: string | null, raw: unknown, ctx: ReimbursementCtx): Promise<ReimbursementTypeRow> {
  const form = normalizeTypeForm(raw);
  const saved = id ? await repo.findType(id) : null;
  if (id && !saved) throw new UserFacingError("Not found: this type no longer exists.");
  const errors = validateTypeForm(form, saved?.code);
  if (Object.keys(errors).length) throw new ReimbursementValidationError(errors);
  const write: repo.TypeWrite = {
    code: form.code,
    name: form.name,
    nameNp: form.nameNp || null,
    taxable: form.taxable,
    perClaimCap: form.perClaimCap.toFixed(2),
    yearlyCap: form.yearlyCap.toFixed(2),
    receiptRequired: form.receiptRequired,
    isActive: form.isActive,
  };
  try {
    const row = id ? await repo.updateType(id, write, ctx.userId) : await repo.insertType(write, ctx.userId);
    if (!row) throw new UserFacingError("Not found: this type no longer exists.");
    return toType(row);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") throw new ReimbursementValidationError({ code: "Another type has this code" });
    throw error;
  }
}

/** The yearly cap for a claim: null when it fits. */
async function yearlyCapProblem(
  claim: { id?: string; employeeId: string; typeId: string; expenseDate: string; amount: number },
  type: repo.TypeRecord,
  counted: readonly string[]
): Promise<string | null> {
  const cap = Number(type.yearlyCap);
  if (!(cap > 0)) return null;
  const fy = await repo.fiscalYearOf(claim.expenseDate);
  if (!fy) return "No fiscal year covers the bill's date: set it up under Setup → Fiscal year first.";
  const used = await repo.usedBetween(claim.employeeId, claim.typeId, fy.from, fy.to, counted, claim.id);
  return capProblem(cap, used, claim.amount, type.name);
}

/**
 * Saves a claim: a draft (new or edited) or, with `submit`, submitted at once (self-service).
 * Amount, date, bill number and the type's caps are checked here; the type's taxability is frozen.
 */
export async function saveClaim(id: string | null, raw: unknown, ctx: ReimbursementCtx, opts: { submit?: boolean } = {}): Promise<ReimbursementClaimRow> {
  const form = normalizeClaimForm(raw);
  const type = form.typeId ? await repo.findType(form.typeId) : null;
  const errors = validateClaimForm(form, type ? { receiptRequired: type.receiptRequired, perClaimCap: Number(type.perClaimCap), isActive: type.isActive } : null, nepalDateIso());
  if (Object.keys(errors).length) throw new ReimbursementValidationError(errors);

  const scope = buildEmployeeScopeCondition(ctx.scope);
  if (id) {
    const existing = await repo.findClaim(id, scope);
    if (!existing) throw new UserFacingError("Not found: this claim is not in your scope.");
    if (!isEditable(existing.status)) throw new UserFacingError("Only a draft can be edited (return it to draft first).");
    if (existing.employeeId !== form.employeeId) throw new ReimbursementValidationError({ employeeId: "A claim stays with the employee it was opened for." });
  }
  if (!(await repo.activeEmployeeInScope(form.employeeId, scope))) throw new ReimbursementValidationError({ employeeId: "This employee is not active in your scope." });
  if (opts.submit) {
    const problem = await yearlyCapProblem({ ...form, id: id ?? undefined }, type!, IN_PLAY);
    if (problem) throw new ReimbursementValidationError({ amount: problem });
  }

  const write: repo.ClaimWrite = {
    employeeId: form.employeeId,
    typeId: form.typeId,
    expenseDate: form.expenseDate,
    amount: form.amount.toFixed(2),
    receiptNo: form.receiptNo || null,
    description: form.description,
    taxable: type!.taxable,
  };
  const row = id ? await repo.updateDraft(id, write, ctx.userId) : await repo.insertClaim(write, opts.submit ? "submitted" : "draft", ctx.userId);
  if (!row) throw new UserFacingError("Someone already submitted this claim — refresh.");
  return toClaim((await repo.findClaim(row.id))!, ctx.actorEmployeeId);
}

export async function moveClaim(id: string, to: string, note: string, ctx: ReimbursementCtx): Promise<ReimbursementClaimRow> {
  const existing = await repo.findClaim(id, buildEmployeeScopeCondition(ctx.scope));
  if (!existing) throw new UserFacingError("Not found: this claim is not in your scope.");
  if (!canMove(existing.status, to)) throw new UserFacingError(`A ${existing.status} claim cannot move to ${to}.`);

  // S21: deciding or settling your own claim is refused; submitting your own draft is fine.
  if (to !== "submitted" && isOwnRecord(ctx.actorEmployeeId, existing.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: to === "settled" ? "LOCK" : "APPROVE", module: "REIMBURSEMENTS", recordId: id, result: DENIED_SELF });
    throw new UserFacingError("Your own claim must be decided by someone else.");
  }
  const problem = validateDecisionNote(to, note);
  if (problem) throw new ReimbursementValidationError({ note: problem });

  if (to === "submitted" || to === "approved") {
    const type = await repo.findType(existing.typeId);
    if (!type) throw new UserFacingError("This claim's type no longer exists.");
    if (to === "submitted" && !type.isActive) throw new ReimbursementValidationError({ typeId: "This type is no longer in use" });
    const capIssue = await yearlyCapProblem(
      { id: existing.id, employeeId: existing.employeeId, typeId: existing.typeId, expenseDate: String(existing.expenseDate).slice(0, 10), amount: Number(existing.amount) },
      type,
      to === "submitted" ? IN_PLAY : COUNTED
    );
    if (capIssue) throw new ReimbursementValidationError({ amount: capIssue });
  }

  if (!(await repo.moveClaim(id, existing.status, to, note.trim() || null, ctx.userId))) throw new UserFacingError("Someone already changed this claim — refresh.");
  return toClaim((await repo.findClaim(id))!, ctx.actorEmployeeId);
}

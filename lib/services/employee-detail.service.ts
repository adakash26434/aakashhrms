import { availableActions, isCompanyAdministrator, waitingFor, type ApprovalActor } from "@/lib/engines/approval.engine";
import {
  DETAIL_LABEL,
  DETAIL_WORDING,
  REASON_MIN,
  asDetailApproval,
  asDetailStatus,
  cleanReason,
  detailDecisionCtx,
  detailDiff,
  detailLines,
  detailOutcome,
  detailRequest,
  detailSummary,
  detailValues,
  inSentence,
  pendingConflicts,
  readPatch,
  staleFields,
  touchesBank,
  type DetailApproval,
  type DetailOutcome,
  type DetailValues,
} from "@/lib/engines/employee-detail.engine";
import { CONTROL_KEYS, asCheckerMode, type CheckerMode } from "@/lib/engines/payroll-control.engine";
import * as repo from "@/lib/repositories/employee-detail.repository";
import { readConfig } from "@/lib/repositories/payroll-control.repository";
import { findUserNames } from "@/lib/repositories/salary-structure.repository";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { isOwnRecord } from "@/lib/auth/self-action";
import { asRunType, isOffCycle, RUN_TYPE_LABEL } from "@/lib/constants/run-types";
import { UserFacingError } from "@/lib/errors/action-error";
import { adToBSString, BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { nepalDateIso, nepalToday } from "@/lib/utils/nepal-time";
import { isUuid } from "@/lib/utils/uuid";
import type { ApprovalTimelineEntry } from "@/lib/types/approval";
import type { DetailChangesPage, DetailChangeView, DetailDecisionResult, DetailFormInfo } from "@/lib/types/employee-detail";

// Sensitive employee details (4.8 / F13): a change to the bank account, PAN or tax status of an
// existing employee is recorded with the employee's save and either applies with it (approvals
// off, or a company administrator in the default maker-checker mode) or waits for a second person
// with Employees → Approve (S43). Approving applies it in one claim-first transaction that also
// checks the record still has the values the change was made against, and moves the new bank
// details onto the employee's draft payslips. The rules are in employee-detail.engine.

export interface DetailCtx {
  scope: ScopeFilter;
  userId: string;
  /** Employees → Approve. */
  canApprove: boolean;
  /** Employees → Edit: sees account numbers and PAN in full, as in the edit form (S18). */
  canEdit: boolean;
}

/** A decision refused because of who is asking (the action audits it). */
export class DetailDecisionRefused extends UserFacingError {
  constructor(message: string, public refusal: "self" | "permission" | "scope", public employeeId: string | null = null) {
    super(message);
    this.name = "DetailDecisionRefused";
  }
}

const WAITING = "A change to this is waiting for approval. Approve, reject or withdraw it first (Employees → Detail changes).";

async function settings(): Promise<{ approval: DetailApproval; checker: CheckerMode }> {
  const [approval, checker] = await Promise.all([readConfig(CONTROL_KEYS.detailApproval), readConfig(CONTROL_KEYS.checker)]);
  return { approval: asDetailApproval(approval), checker: asCheckerMode(checker) };
}

/** The person acting, for the approval engine. Platform support (impersonation) never approves. */
function actorOf(ctx: Pick<DetailCtx, "scope" | "userId" | "canApprove">): ApprovalActor {
  const canApprove = ctx.canApprove && !ctx.scope.isImpersonation;
  return { userId: ctx.userId, employeeId: ctx.scope.employeeId ?? null, canApprove, isAdministrator: isCompanyAdministrator(ctx.scope, canApprove) };
}

// ---- saving (the employee form) -----------------------------------------------------------------

export interface DetailPlan {
  /** What the record is saved with now: the form's values, or the stored ones while a change waits. */
  values: DetailValues;
  /** The change to record inside the employee's save transaction (null: nothing changes). */
  change: repo.NewChange | null;
  /** Bank details to put on draft payslips when the change applies with the save. */
  refreshBank: { bankName: string; bankAccountNumber: string } | null;
  outcome: DetailOutcome | null;
  summary: string;
}

export type DetailPlanResult = { ok: true; plan: DetailPlan } | { ok: false; errors: Record<string, string> };

type DetailSource = Parameters<typeof detailValues>[0];

/**
 * What saving the employee form does to the sensitive details of an existing employee. A change
 * needs a reason; while one waits, the fields stay as they are (sending them unchanged, or the
 * waiting values again, is fine; anything else is refused field by field).
 */
export async function planSave(
  employeeId: string,
  stored: DetailSource,
  form: DetailSource,
  reason: unknown,
  ctx: Pick<DetailCtx, "scope" | "userId" | "canApprove">,
): Promise<DetailPlanResult> {
  const before = detailValues(stored);
  const next = detailValues(form);
  const unchanged: DetailPlanResult = { ok: true, plan: { values: before, change: null, refreshBank: null, outcome: null, summary: "" } };
  const pending = await repo.findPending(employeeId);
  if (pending) {
    const conflicts = pendingConflicts(before, next, readPatch(pending.after));
    return conflicts.length ? { ok: false, errors: Object.fromEntries(conflicts.map((f) => [f, WAITING])) } : unchanged;
  }
  const diff = detailDiff(before, next);
  if (!diff) return unchanged;
  const summary = detailSummary(diff.fields);
  const why = cleanReason(reason);
  if (!why) return { ok: false, errors: { detailReason: `Say why the ${inSentence(summary)} changes (at least ${REASON_MIN} characters); the approver reads it.` } };

  const { approval, checker } = await settings();
  const actor = actorOf(ctx);
  const outcome = detailOutcome({ approval, checker, actorIsAdmin: actor.isAdministrator, ownRecord: isOwnRecord(ctx.scope.employeeId, employeeId) });
  const applies = outcome.kind === "apply";
  return {
    ok: true,
    plan: {
      values: applies ? next : before,
      change: {
        employeeId,
        before: diff.before as Record<string, string | boolean>,
        after: diff.after as Record<string, string | boolean>,
        reason: why,
        preparedBy: ctx.userId,
        appliedRoute: applies ? outcome.route : null,
      },
      refreshBank: applies && touchesBank(diff.after) ? { bankName: next.bankName, bankAccountNumber: next.bankAccountNumber } : null,
      outcome,
      summary,
    },
  };
}

/** True for the database's "one waiting change per employee" refusal (two saves at once). */
export const isOnePendingViolation = (error: unknown) => error instanceof Error && /employee_detail_changes_one_pending/.test(`${error.message} ${String((error as { constraint_name?: unknown }).constraint_name ?? "")}`);

export const WAITING_MESSAGE = WAITING;

/** The form's view: a change already waiting, and what a save of a change will do for this user. */
export async function formInfo(employeeId: string | null, ctx: DetailCtx): Promise<DetailFormInfo> {
  const s = await settings();
  const outcome = detailOutcome({ approval: s.approval, checker: s.checker, actorIsAdmin: actorOf(ctx).isAdministrator, ownRecord: isOwnRecord(ctx.scope.employeeId, employeeId) });
  const onSave: DetailFormInfo["onSave"] = outcome.kind === "apply" ? (outcome.route === "final_approve" ? "apply_admin" : "apply_off") : outcome.because === "own_record" ? "wait_own" : "wait";
  if (!employeeId) return { pending: null, onSave };
  const [row] = await repo.findChanges({ employeeId, status: "pending", limit: 1 });
  if (!row) return { pending: null, onSave };
  // The form holds the full values already (Employees → Edit).
  const [view] = await toViews([row], ctx, true);
  return { pending: { id: view.id, summary: view.summary, lines: view.lines, preparedBy: view.preparedBy, preparedAt: view.preparedAt, reason: view.reason }, onSave };
}

// ---- views -------------------------------------------------------------------------------------

async function toViews(rows: repo.ChangeWithEmployee[], ctx: DetailCtx, reveal: boolean): Promise<DetailChangeView[]> {
  if (!rows.length) return [];
  const [{ checker }, steps] = await Promise.all([settings(), repo.findActions(rows.map((r) => r.id))]);
  const names = await findUserNames([...rows.flatMap((r) => [r.preparedBy ?? "", r.decidedBy ?? ""]), ...steps.map((s) => s.actorId ?? "")]);
  const nameOf = (id: string | null) => (id ? names.get(id) ?? "Unknown user" : "System");
  const actor = actorOf(ctx);
  const decision = detailDecisionCtx(checker, nepalDateIso());
  const timeline = new Map<string, ApprovalTimelineEntry[]>();
  for (const s of steps) {
    const list = timeline.get(s.requestId) ?? [];
    list.push({ id: s.id, level: s.level, action: s.action as ApprovalTimelineEntry["action"], actorId: s.actorId, actorName: nameOf(s.actorId), onBehalfOfName: null, note: s.note, at: s.createdAt.toISOString() });
    timeline.set(s.requestId, list);
  }
  return rows.map((r) => {
    const before = readPatch(r.before);
    const after = readPatch(r.after);
    const request = detailRequest(r);
    const can = availableActions(request, actor, decision);
    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      employeeCode: r.employeeCode,
      status: asDetailStatus(r.status),
      summary: detailSummary(Object.keys(after)),
      lines: detailLines(before, after, reveal),
      reason: r.reason,
      preparedBy: nameOf(r.preparedBy),
      preparedAt: r.preparedAt.toISOString(),
      decidedBy: r.decidedBy ? nameOf(r.decidedBy) : null,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      decisionNote: r.decisionNote,
      route: r.approvalRoute,
      timeline: timeline.get(r.id) ?? [],
      can: { approve: !!can.approve || can.finalApprove, reject: can.reject, withdraw: can.withdraw, reason: can.reason },
      waitingForMe: waitingFor(request, actor, decision),
    };
  });
}

/** Everything the Detail changes screen shows: changes about employees in the viewer's scope. */
export async function changesPage(ctx: DetailCtx): Promise<DetailChangesPage> {
  const reveal = ctx.canEdit || ctx.canApprove;
  const [rows, s] = await Promise.all([repo.findChanges({ scope: buildEmployeeScopeCondition(ctx.scope), limit: 300 }), settings()]);
  return { rows: await toViews(rows, ctx, reveal), reveal, approval: s.approval, checker: s.checker };
}

/** The change waiting for one employee (the record page's banner); the caller checked the scope. */
export async function pendingFor(employeeId: string, ctx: DetailCtx): Promise<DetailChangeView | null> {
  const [row] = await repo.findChanges({ employeeId, status: "pending", limit: 1 });
  return row ? (await toViews([row], ctx, ctx.canEdit || ctx.canApprove))[0] : null;
}

/** Waiting changes in scope, and those this person can decide now (the register's count). */
export async function pendingCounts(scope: ScopeFilter, canApprove: boolean): Promise<{ pending: number; waitingForMe: number }> {
  const rows = await repo.findChanges({ scope: buildEmployeeScopeCondition(scope), status: "pending", limit: 500 });
  if (!rows.length || scope.isImpersonation) return { pending: rows.length, waitingForMe: 0 };
  const { checker } = await settings();
  const actor = actorOf({ scope, userId: scope.userId, canApprove });
  const decision = detailDecisionCtx(checker, nepalDateIso());
  return { pending: rows.length, waitingForMe: rows.filter((r) => waitingFor(detailRequest(r), actor, decision)).length };
}

/** Waiting changes this person can decide now (the title-bar bell). */
export async function countWaitingFor(scope: ScopeFilter, canApprove: boolean): Promise<number> {
  return (await pendingCounts(scope, canApprove)).waitingForMe;
}

// ---- deciding ------------------------------------------------------------------------------------

const runLabel = (r: { month: number; year: number; status: string; runType: string }) => {
  const type = asRunType(r.runType);
  return `${BS_MONTHS_EN[r.month] ?? r.month} ${r.year}${isOffCycle(type) ? ` · ${RUN_TYPE_LABEL[type].en}` : ""} (${r.status === "UNDER_REVIEW" ? "under review" : "approved"})`;
};

/**
 * Approve, reject (with a reason) or withdraw (the person who made it) one waiting change. The
 * approval engine decides who may act: never the employee it is about, never its maker except a
 * company administrator's Final approve in the default maker-checker mode.
 */
export async function decide(id: unknown, decision: unknown, note: unknown, ctx: DetailCtx): Promise<DetailDecisionResult> {
  if (decision !== "approve" && decision !== "reject" && decision !== "withdraw") throw new UserFacingError("Choose approve, reject or withdraw.");
  if (!isUuid(id)) throw new UserFacingError("That change no longer exists. Refresh the page.");
  if (ctx.scope.isImpersonation) throw new DetailDecisionRefused("Support view can't decide changes to employee details.", "permission");
  const [row] = await repo.findChanges({ id, scope: buildEmployeeScopeCondition(ctx.scope), limit: 1 });
  if (!row) {
    const [outside] = await repo.findChanges({ id, limit: 1 });
    if (outside) throw new DetailDecisionRefused("That change no longer exists. Refresh the page.", "scope", outside.employeeId);
    throw new UserFacingError("That change no longer exists. Refresh the page.");
  }
  if (row.status !== "pending") throw new UserFacingError(`This change was already ${row.status}. Refresh the page.`);

  const { checker } = await settings();
  const actor = actorOf(ctx);
  const can = availableActions(detailRequest(row), actor, detailDecisionCtx(checker, nepalDateIso()));
  const self = isOwnRecord(actor.employeeId, row.employeeId) || row.preparedBy === ctx.userId;
  const text = typeof note === "string" ? note.trim().replace(/\s+/g, " ").slice(0, 500) : "";

  let status: "approved" | "rejected" | "withdrawn";
  let action: "approved" | "final_approved" | "rejected" | "withdrawn";
  let route: "simple" | "final_approve" | null = null;
  if (decision === "withdraw") {
    if (!can.withdraw) throw new UserFacingError("Only the person who made a change can withdraw it.");
    [status, action] = ["withdrawn", "withdrawn"];
  } else if (decision === "reject") {
    if (!can.reject) {
      const reason = row.preparedBy === ctx.userId ? "You made this change: withdraw it instead." : can.reason ?? DETAIL_WORDING.noPermission;
      throw new DetailDecisionRefused(reason, self ? "self" : "permission", row.employeeId);
    }
    if (text.length < 3) throw new UserFacingError("Say why the change is rejected.");
    [status, action] = ["rejected", "rejected"];
  } else {
    if (can.approve) [action, route] = ["approved", "simple"];
    else if (can.finalApprove) [action, route] = ["final_approved", "final_approve"];
    else throw new DetailDecisionRefused(can.reason ?? DETAIL_WORDING.noPermission, self ? "self" : "permission", row.employeeId);
    status = "approved";
  }

  const before = readPatch(row.before);
  const after = readPatch(row.after);
  const done = await repo.inTransaction(async (tx) => {
    const claimed = await repo.claimTx(tx, row.id, { status, actorId: ctx.userId, note: text || null, route });
    if (!claimed) return null;
    let draftSlips = 0;
    if (status === "approved") {
      const current = await repo.currentValuesTx(tx, row.employeeId);
      if (!current) throw new UserFacingError("This employee no longer exists.");
      // Nothing may have changed the record since the change was made (the form locks these fields).
      const stale = staleFields(detailValues(current), before);
      if (stale.length) {
        throw new UserFacingError(`The record's ${stale.map((f) => DETAIL_LABEL[f].toLowerCase()).join(", ")} changed after this change was made. Reject it and make the change again.`);
      }
      await repo.writeValuesTx(tx, row.employeeId, current.bankRowId, after);
      if (touchesBank(after)) {
        draftSlips = await repo.refreshDraftSlipsTx(tx, row.employeeId, { bankName: after.bankName ?? current.bankName, bankAccountNumber: after.bankAccountNumber ?? current.bankAccountNumber });
      }
    }
    await repo.insertActionTx(tx, { requestId: row.id, actorId: ctx.userId, action, note: text || null });
    return { draftSlips };
  });
  if (!done) throw new UserFacingError("Someone else decided this change a moment ago. Refresh the page.");

  const runs = status === "approved" && touchesBank(after) ? (await repo.runsInReview(row.employeeId)).map(runLabel) : [];
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    status,
    fields: Object.keys(after),
    summary: detailSummary(Object.keys(after)),
    draftSlips: done.draftSlips,
    runsInReview: runs,
  };
}

// ---- for the payroll variance review ---------------------------------------------------------------

/** How each employee's bank account last changed ("changed by Ram, approved by Hari on 2083-06-24 BS"). */
export async function bankChangeNotes(employeeIds: string[]): Promise<Map<string, string>> {
  const latest = new Map<string, repo.ChangeRow>();
  for (const r of await repo.approvedChangesFor(employeeIds)) {
    if (!latest.has(r.employeeId) && touchesBank(readPatch(r.after))) latest.set(r.employeeId, r);
  }
  if (!latest.size) return new Map();
  const names = await findUserNames([...latest.values()].flatMap((r) => [r.preparedBy ?? "", r.decidedBy ?? ""]));
  const by = (id: string | null) => (id ? names.get(id) ?? "an unknown user" : "the system");
  return new Map(
    [...latest].map(([employeeId, r]) => {
      const on = `${adToBSString(nepalToday(r.decidedAt ?? r.preparedAt))} BS`;
      const note =
        r.approvalRoute === "not_required"
          ? `changed by ${by(r.preparedBy)} on ${on}, approvals off`
          : r.approvalRoute === "final_approve" && r.decidedBy === r.preparedBy
            ? `changed by ${by(r.preparedBy)} as company administrator on ${on}`
            : `changed by ${by(r.preparedBy)}, approved by ${by(r.decidedBy)} on ${on}`;
      return [employeeId, note];
    }),
  );
}

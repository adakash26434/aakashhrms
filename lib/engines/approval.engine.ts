// Approval engine (4.4 follow-up), after Zoho Payroll's approvals:
// - a company policy per module: none, simple (any approver) or multi-level
//   (named approvers in order, each level after the previous one);
// - company administrators may Final Approve at any stage;
// - S21: nobody approves a request about themselves (their own salary), and a
//   request's preparer is never its approver, except an administrator's Final
//   Approve.
// Pure: no database access. Salary changes use it now; pay runs (4.8) and
// loans (4.10) reuse it.

import { includesOwnRecord } from "@/lib/auth/self-action";
import type {
  ApprovalFlow,
  ApprovalPolicy,
  ApprovalRoute,
  ApprovalType,
  ApproverInfo,
  AvailableActions,
  FlowLevel,
} from "@/lib/types/approval";

export const MAX_APPROVAL_LEVELS = 5;

/** The person acting on a request. */
export interface ApprovalActor {
  userId: string;
  /** Employee record linked to the account (null: not linked). */
  employeeId: string | null;
  /** The module's Approve permission. */
  canApprove: boolean;
  /** Company administrator: Approve, company-wide scope, a company user (never platform support). */
  isAdministrator: boolean;
}

/** Company administrator for approvals: Approve, company-wide (GLOBAL), and never a platform impersonation. */
export function isCompanyAdministrator(scope: { scopeType: string; isImpersonation?: boolean }, canApprove: boolean): boolean {
  return canApprove && scope.scopeType === "GLOBAL" && !scope.isImpersonation;
}

/** A pending or decided request as the engine sees it. */
export interface ApprovalRequest {
  status: "pending" | "approved" | "rejected" | "withdrawn";
  preparedById: string | null;
  /** Employees the request is about (S21). */
  subjectEmployeeIds: readonly string[];
  flow: ApprovalFlow;
  /** Multi-level: the level waiting now (0 for simple or decided). */
  currentLevel: number;
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/** Reads a stored policy; anything unknown becomes simple. Older yes / no settings map to simple / none. */
export function parsePolicy(stored: unknown, legacy?: string | null): ApprovalPolicy {
  if (stored && typeof stored === "object") {
    const raw = stored as { type?: unknown; levels?: unknown };
    const type: ApprovalType = raw.type === "none" || raw.type === "multi_level" ? raw.type : "simple";
    const levels = Array.isArray(raw.levels) ? [...new Set(raw.levels.filter((x): x is string => typeof x === "string" && x.length > 0))].slice(0, MAX_APPROVAL_LEVELS) : [];
    return { type: type === "multi_level" && !levels.length ? "simple" : type, levels: type === "multi_level" ? levels : [] };
  }
  if (legacy === "false" || legacy === "off") return { type: "none", levels: [] };
  return { type: "simple", levels: [] };
}

/** Errors in a policy before saving (key "levels" or "level.N"). */
export function validatePolicy(policy: ApprovalPolicy, approvers: readonly ApproverInfo[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!["none", "simple", "multi_level"].includes(policy.type)) errors.type = "Choose how changes are approved";
  if (policy.type !== "multi_level") return errors;
  if (!policy.levels.length) errors.levels = "Add at least one approver";
  if (policy.levels.length > MAX_APPROVAL_LEVELS) errors.levels = `At most ${MAX_APPROVAL_LEVELS} levels`;
  const seen = new Set<string>();
  policy.levels.forEach((id, i) => {
    const key = `level.${i + 1}`;
    const a = approvers.find((x) => x.userId === id);
    if (!id) errors[key] = "Choose an approver";
    else if (seen.has(id)) errors[key] = "This person is already a level";
    else if (!a || !a.active) errors[key] = "This user is not active";
    else if (!a.canApprove) errors[key] = "This user cannot approve salary changes (give their role Approve)";
    seen.add(id);
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export type SubmitOutcome =
  | { approvedAtOnce: true; route: ApprovalRoute; flow: ApprovalFlow; currentLevel: 0 }
  | { approvedAtOnce: false; flow: ApprovalFlow; currentLevel: number; ownSubject: boolean };

/**
 * The flow a new request gets. A level is skipped when its approver prepared
 * the request or is one of the employees it is about; when every level is
 * skipped the request falls back to simple. With no approval, a request about
 * the preparer still waits (simple), because nobody approves their own.
 */
export function buildFlow(
  policy: ApprovalPolicy,
  ctx: { preparerId: string; preparerEmployeeId: string | null; subjectEmployeeIds: readonly string[]; approvers: readonly ApproverInfo[] }
): SubmitOutcome {
  const ownSubject = includesOwnRecord(ctx.preparerEmployeeId, ctx.subjectEmployeeIds);
  const simple: ApprovalFlow = { type: "simple", levels: [] };
  if (policy.type === "none") {
    return ownSubject ? { approvedAtOnce: false, flow: simple, currentLevel: 0, ownSubject } : { approvedAtOnce: true, route: "not_required", flow: simple, currentLevel: 0 };
  }
  if (policy.type === "simple" || !policy.levels.length) return { approvedAtOnce: false, flow: simple, currentLevel: 0, ownSubject };
  const levels: FlowLevel[] = policy.levels.map((userId, i) => {
    const approver = ctx.approvers.find((a) => a.userId === userId);
    const skipped = userId === ctx.preparerId ? "preparer" : includesOwnRecord(approver?.employeeId ?? null, ctx.subjectEmployeeIds) ? "own_salary" : null;
    return { level: i + 1, userId, skipped };
  });
  const first = levels.find((l) => !l.skipped);
  if (!first) return { approvedAtOnce: false, flow: { type: "simple", levels, fellBack: true }, currentLevel: 0, ownSubject };
  return { approvedAtOnce: false, flow: { type: "multi_level", levels }, currentLevel: first.level, ownSubject };
}

// ---------------------------------------------------------------------------
// Deciding
// ---------------------------------------------------------------------------

const activeDelegate = (approver: ApproverInfo | undefined, actorId: string, today: string) =>
  !!approver && approver.delegatedTo === actorId && !!approver.delegatedUntil && approver.delegatedUntil.slice(0, 10) >= today;

/** What this person may do with a request now, and the plain reason when they cannot approve. */
export function availableActions(request: ApprovalRequest, actor: ApprovalActor, ctx: { approvers: readonly ApproverInfo[]; today: string }): AvailableActions {
  const none: AvailableActions = { approve: null, finalApprove: false, reject: false, withdraw: false, reason: null, stuck: null };
  if (request.status !== "pending") return { ...none, reason: `This change was already ${request.status}.` };
  const preparer = !!actor.userId && request.preparedById === actor.userId;
  const ownSubject = includesOwnRecord(actor.employeeId, request.subjectEmployeeIds);
  const out: AvailableActions = { ...none, withdraw: preparer };
  out.finalApprove = actor.isAdministrator && !ownSubject;

  let reason: string | null = null;
  if (ownSubject) reason = "This change includes your own salary, so someone else has to approve it.";
  else if (request.flow.type === "simple") {
    if (preparer) reason = actor.isAdministrator ? null : "You prepared this change, so someone else has to approve it.";
    else if (!actor.canApprove) reason = "You cannot approve salary changes.";
    else out.approve = { level: 0, onBehalfOf: null };
  } else {
    const level = request.flow.levels.find((l) => l.level === request.currentLevel);
    const approver = ctx.approvers.find((a) => a.userId === level?.userId);
    if (!level) reason = "This change has no level waiting.";
    else if (!approver || !approver.active || !approver.canApprove) {
      out.stuck = `The Level ${level.level} approver (${approver?.name ?? "removed user"}) can no longer approve. A company administrator can Final approve, or update the approval settings for new changes.`;
      reason = out.stuck;
    } else if (preparer) reason = actor.isAdministrator ? null : "You prepared this change, so someone else has to approve it.";
    else if (actor.userId === level.userId) out.approve = { level: level.level, onBehalfOf: null };
    else if (activeDelegate(approver, actor.userId, ctx.today)) out.approve = { level: level.level, onBehalfOf: level.userId };
    else reason = `Waiting for Level ${level.level}: ${approver.name}.`;
  }
  // Rejecting: whoever may approve now, or an administrator (never the preparer: they withdraw).
  out.reject = !preparer && !ownSubject && (!!out.approve || out.finalApprove);
  // The reason stays when an administrator could still Final approve ("Waiting for Level 1: …").
  out.reason = out.approve ? null : reason;
  return out;
}

export type Decision = "approve" | "final_approve" | "reject" | "withdraw";

/** The request after a decision (status, the level now waiting, and how it was approved). */
export function applyDecision(request: ApprovalRequest, decision: Decision): { status: ApprovalRequest["status"]; currentLevel: number; route: ApprovalRoute | null } {
  if (decision === "reject") return { status: "rejected", currentLevel: 0, route: null };
  if (decision === "withdraw") return { status: "withdrawn", currentLevel: 0, route: null };
  if (decision === "final_approve") return { status: "approved", currentLevel: 0, route: "final_approve" };
  if (request.flow.type === "simple") return { status: "approved", currentLevel: 0, route: "simple" };
  const next = request.flow.levels.find((l) => l.level > request.currentLevel && !l.skipped);
  return next ? { status: "pending", currentLevel: next.level, route: null } : { status: "approved", currentLevel: 0, route: "levels" };
}

/** "Level 1 of 2 · Hari Thapa", "Waiting for an approver", or the decided status. */
export function statusText(request: Pick<ApprovalRequest, "status" | "flow" | "currentLevel">, nameOf: (userId: string) => string): string {
  if (request.status !== "pending") return request.status.charAt(0).toUpperCase() + request.status.slice(1);
  if (request.flow.type === "simple") return "Waiting for an approver";
  const active = request.flow.levels.filter((l) => !l.skipped);
  const index = active.findIndex((l) => l.level === request.currentLevel);
  const level = active[index];
  return level ? `Level ${index + 1} of ${active.length} · ${nameOf(level.userId)}` : "Waiting";
}

/** True when this person can act on the request now (for "Waiting for me" and the bell). */
export function waitingFor(request: ApprovalRequest, actor: ApprovalActor, ctx: { approvers: readonly ApproverInfo[]; today: string }): boolean {
  const a = availableActions(request, actor, ctx);
  // Administrators see everything they could Final approve only when it is theirs to move: their own request, or one that is stuck.
  return !!a.approve || (a.finalApprove && (request.preparedById === actor.userId || !!a.stuck));
}

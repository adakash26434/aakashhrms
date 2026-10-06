import * as policyRepo from "@/lib/repositories/leave-policy.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import { findUserNames } from "@/lib/repositories/salary-structure.repository";
import type { NewLedgerLine } from "@/lib/repositories/leave.repository";
import { ruleTypes } from "@/lib/services/leave-rule-types.service";
import { leaveYearOf, postingYear } from "@/lib/services/leave.service";
import { availableActions, isCompanyAdministrator, waitingFor, type ApprovalActor, type ApprovalRequest, type ApprovalWording } from "@/lib/engines/approval.engine";
import { creditedYearly, fmt } from "@/lib/engines/leave.engine";
import { EDITABLE, LAW, asksWhen, changeLines, dayAfter, diffValues, endingSoon, exceptionSettings, floorOn, policyErrors, splitChange, topUpDays, valuesOf } from "@/lib/engines/leave-policy.engine";
import { cancelExceptionRequest, createExceptionRequest, exceptionRequestsFor, readExceptionInput, type CompanyExceptionRequest } from "@/lib/platform/leave-exceptions";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type { ApprovalActionKind, ApprovalRoute, ApprovalTimelineEntry } from "@/lib/types/approval";
import type { LeaveRuleType } from "@/lib/types/leave";
import {
  POLICY_SETTINGS,
  type LeavePolicyPageData,
  type ExceptionRequestRow,
  type PolicyApplies,
  type PolicyChangeStatus,
  type PolicyChangeView,
  type PolicyException,
  type PolicyPreview,
  type PolicySetting,
  type PolicyTypeRow,
  type PolicyValues,
} from "@/lib/types/leave-policy";

// Leave policies (4.6c). A company changes statutory leave only in the
// employees' favour: one person proposes (Leave types → Edit, company-wide),
// another approves (Leave types → Approve, company-wide, or a company
// administrator's Final approve), never the proposer (S21). The minimum (the
// Labour Act, lowered only by a platform exception in force) is checked when
// proposed and again when approved. Days a year can wait for the next leave
// year or top everyone up now; everything else applies on approval.

export class PolicyValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Leave policy validation failed");
    this.name = "PolicyValidationError";
  }
}

export interface PolicyCtx {
  scope: ScopeFilter;
  userId: string;
  /** Leave types → Approve. */
  canApprove: boolean;
  /** Leave types → Edit. */
  canEdit: boolean;
  /** Platform support view: can look, never propose or decide. */
  impersonation: boolean;
  /** The company on the platform (for exception requests); null when it can't be resolved. */
  companyId?: string | null;
  /** Who is asking (the platform shows it with the request). */
  email?: string | null;
}

const WORDING: ApprovalWording = {
  ownSubject: "This change is about your own record, so someone else has to approve it.",
  noPermission: "You can't approve leave policy changes (Leave types → Approve, company-wide).",
  preparer: "You proposed this change, so someone else has to approve it.",
};

const companyWide = (ctx: PolicyCtx) => ctx.scope.scopeType === "GLOBAL" && !ctx.impersonation;

function actorOf(ctx: PolicyCtx): ApprovalActor {
  const canApprove = ctx.canApprove && companyWide(ctx);
  return { userId: ctx.userId, employeeId: ctx.scope.employeeId ?? null, canApprove, isAdministrator: isCompanyAdministrator(ctx.scope, ctx.canApprove) && !ctx.impersonation };
}

function requestOf(c: policyRepo.ChangeRow): ApprovalRequest {
  const status = c.status === "replaced" ? "approved" : (c.status as ApprovalRequest["status"]);
  return { status, preparedById: c.preparedBy, subjectEmployeeIds: [], flow: { type: "simple", levels: [] }, currentLevel: 0 };
}

const decisionCtx = (today: string) => ({ approvers: [], today, wording: WORDING, preparerMayFinalApprove: false });

/** The statutory types a company can set (active, with editable settings). */
const policyTypes = (types: LeaveRuleType[]) => types.filter((t) => t.isStatutory && t.isActive && t.statutoryCode && EDITABLE[t.statutoryCode]);

/** Keeps only known settings with values of the right kind (anything else stays for the engine to refuse). */
function readValues(raw: unknown): Partial<PolicyValues> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(POLICY_SETTINGS as readonly string[]).includes(k)) {
      out[k] = v; // refused by policyErrors as not editable
      continue;
    }
    if (k === "allowHalfDay") out[k] = v === true || v === "true" ? true : v === false || v === "false" ? false : v;
    else if (k === "dayBasis") out[k] = v;
    else if (v === null || v === "") out[k] = k === "certificateAfter" ? null : v;
    else out[k] = typeof v === "number" ? v : Number(v);
  }
  return out as Partial<PolicyValues>;
}

interface Plan {
  type: LeaveRuleType;
  current: PolicyValues;
  change: Partial<PolicyValues>;
  applies: PolicyApplies;
  effectiveFrom: string | null;
  errors: Record<string, string>;
  year: { id: string; label: string; start: string; end: string } | null;
}

async function planOf(input: unknown, today: string, exceptions: PolicyException[]): Promise<Plan> {
  const i = (input && typeof input === "object" ? input : {}) as { leaveTypeId?: unknown; values?: unknown; applies?: unknown };
  const type = policyTypes(await ruleTypes()).find((t) => t.id === i.leaveTypeId);
  if (!type || !type.statutoryCode) throw new UserFacingError("Choose a statutory leave type.");
  const current = valuesOf(type);
  const change = diffValues(current, readValues(i.values));
  const year = await leaveYearOf(today);
  const nextStart = year ? dayAfter(year.end) : null;
  const when = asksWhen(type, change);
  const applies: PolicyApplies = when ? (i.applies === "top_up" ? "top_up" : "next_year") : "approval";
  const effectiveFrom = applies === "next_year" ? nextStart : null;
  const errors = policyErrors(type.statutoryCode, current, change, floorOn(type.statutoryCode, today, exceptions));
  // Days a year that wait for the next leave year must meet the minimum on that day too.
  if (!errors.days && effectiveFrom && change.days !== undefined) {
    const later = policyErrors(type.statutoryCode, current, { days: change.days }, floorOn(type.statutoryCode, effectiveFrom, exceptions));
    if (later.days) errors.days = later.days;
  }
  if (applies === "next_year" && !nextStart) errors.applies = "There is no current leave year: add the fiscal year in Company setup first.";
  if (applies === "top_up" && !year) errors.applies = "There is no current leave year to top up.";
  return { type, current, change, applies, effectiveFrom, errors, year };
}

/** Top-up lines for "also this year": everyone employed in the leave year, pro-rata from joining. */
async function topUpLines(plan: Plan, changeId: string, userId: string | null, today: string): Promise<{ lines: NewLedgerLine[]; examples: { name: string; days: number }[] }> {
  const t = plan.type;
  if (plan.applies !== "top_up" || !plan.year || plan.change.days === undefined || plan.change.days <= plan.current.days) return { lines: [], examples: [] };
  const people = (await attendanceRepo.findEmployees()).filter(
    (p) => p.joiningDate <= plan.year!.end && (!p.terminationDate || p.terminationDate >= today) && (t.genderApplicable === "All" || t.genderApplicable === p.gender)
  );
  const fiscalYearId = await postingYear(plan.year.id);
  const out: NewLedgerLine[] = [];
  const examples: { name: string; days: number }[] = [];
  for (const p of people) {
    const days = topUpDays(plan.current.days, plan.change.days, p.joiningDate, plan.year);
    if (days <= 0) continue;
    out.push({
      employeeId: p.id,
      leaveTypeId: t.id,
      fiscalYearId,
      entryDate: today,
      kind: "credit",
      days,
      note: `Policy change: ${t.name} ${fmt(plan.current.days)} → ${fmt(plan.change.days)} days a year${p.joiningDate > plan.year.start ? ", pro-rata from joining" : ""}`,
      ref: `policy:${changeId}`,
      createdBy: userId,
    });
    examples.push({ name: p.fullName, days });
  }
  return { lines: out, examples };
}

/** What a proposal would do, in words, and what stops it. */
export async function previewChange(input: unknown, ctx: PolicyCtx): Promise<PolicyPreview> {
  if (!ctx.canEdit || !companyWide(ctx)) throw new UserFacingError("Changing leave policies needs a company-wide role with Leave types → Edit.");
  const today = nepalDateIso();
  const plan = await planOf(input, today, await policyRepo.findExceptions());
  const later = splitChange(plan.change, plan.applies, creditedYearly(plan.type)).later;
  const lines = (Object.keys(plan.change) as PolicySetting[]).map((setting) => ({ setting, text: changeLines(plan.current, { [setting]: plan.change[setting] })[0] }));
  let topUp: PolicyPreview["topUp"] = null;
  if (plan.applies === "top_up") {
    const t = await topUpLines(plan, "preview", null, today);
    topUp = { people: t.lines.length, examples: t.examples.slice(0, 3) };
  }
  return { lines, deferred: Object.keys(later) as PolicySetting[], applies: plan.applies, effectiveFrom: plan.effectiveFrom, topUp, errors: plan.errors };
}

/** Saves a proposal; it waits for a second person. */
export async function proposeChange(input: unknown, ctx: PolicyCtx): Promise<{ id: string; typeName: string; otherApprovers: number }> {
  if (!ctx.canEdit || !companyWide(ctx)) throw new UserFacingError("Changing leave policies needs a company-wide role with Leave types → Edit.");
  const reason = String((input as { reason?: unknown })?.reason ?? "").trim().slice(0, 500);
  const today = nepalDateIso();
  const plan = await planOf(input, today, await policyRepo.findExceptions());
  const errors = { ...plan.errors };
  if (reason.length < 5) errors.reason = "Say why (at least a few words)";
  if (Object.keys(errors).length) throw new PolicyValidationError(errors);
  if ((await policyRepo.findPendingChanges()).some((c) => c.leaveTypeId === plan.type.id)) {
    throw new UserFacingError(`A change to ${plan.type.name} is already waiting. Decide or withdraw it first.`);
  }
  const before = Object.fromEntries(Object.keys(plan.change).map((k) => [k, plan.current[k as PolicySetting]])) as Partial<PolicyValues>;
  let id: string;
  try {
    id = await policyRepo.createChange({ leaveTypeId: plan.type.id, before, after: plan.change, reason, applies: plan.applies, effectiveFrom: plan.effectiveFrom, preparedBy: ctx.userId });
  } catch (err) {
    if (err instanceof Error && /leave_type_changes_one_pending|unique/i.test(err.message)) throw new UserFacingError(`A change to ${plan.type.name} is already waiting. Decide or withdraw it first.`);
    throw err;
  }
  const others = (await policyRepo.findPolicyApprovers()).filter((a) => a.userId !== ctx.userId).length;
  return { id, typeName: plan.type.name, otherApprovers: others };
}

export type PolicyDecision = "approve" | "final_approve" | "reject" | "withdraw";

export interface DecisionResult {
  id: string;
  ok: boolean;
  error?: string;
  refusal?: "self" | "permission";
  typeName?: string;
  status?: PolicyChangeStatus;
}

/** Approve / Final approve / reject (reason) / withdraw some waiting changes, each on its own. */
export async function decideChanges(ids: string[], decision: PolicyDecision, note: string | null, ctx: PolicyCtx): Promise<DecisionResult[]> {
  if (ctx.impersonation) throw new UserFacingError("Support view can't decide leave policy changes.");
  const today = nepalDateIso();
  const [types, exceptions] = await Promise.all([ruleTypes(), policyRepo.findExceptions()]);
  const actor = actorOf(ctx);
  const out: DecisionResult[] = [];
  for (const id of ids) {
    const c = await policyRepo.findChange(id);
    const type = c ? types.find((t) => t.id === c.leaveTypeId) : undefined;
    if (!c || !type || !type.statutoryCode || c.source !== "company") {
      out.push({ id, ok: false, error: "This change no longer exists." });
      continue;
    }
    const can = availableActions(requestOf(c), actor, decisionCtx(today));
    const preparer = c.preparedBy === ctx.userId;
    let action: ApprovalActionKind;
    let status: Exclude<PolicyChangeStatus, "pending" | "replaced">;
    let route: ApprovalRoute | null = null;
    if (decision === "withdraw") {
      if (!can.withdraw) {
        out.push({ id, ok: false, error: c.status === "pending" ? "Only the person who proposed it can withdraw it." : can.reason ?? "This change was already decided." });
        continue;
      }
      action = "withdrawn";
      status = "withdrawn";
    } else if (decision === "reject") {
      if (!can.reject) {
        out.push({ id, ok: false, error: preparer ? "Withdraw your own proposal instead." : can.reason ?? WORDING.noPermission, refusal: preparer ? "self" : "permission" });
        continue;
      }
      if (!note || note.trim().length < 3) {
        out.push({ id, ok: false, error: "Say why it is rejected." });
        continue;
      }
      action = "rejected";
      status = "rejected";
    } else {
      const allowed = decision === "approve" ? !!can.approve : can.finalApprove;
      if (!allowed) {
        out.push({ id, ok: false, error: can.reason ?? WORDING.noPermission, refusal: preparer ? "self" : "permission" });
        continue;
      }
      action = decision === "approve" ? "approved" : "final_approved";
      status = "approved";
      route = decision === "approve" ? "simple" : "final_approve";
    }

    let now: Partial<PolicyValues> | undefined;
    let complete = false;
    let ledger: NewLedgerLine[] = [];
    let replaces: string[] = [];
    if (status === "approved") {
      // The minimum again, on today's values and exceptions (they may have changed since it was proposed).
      const current = valuesOf(type);
      const after = c.after as Partial<PolicyValues>;
      const applies = c.applies as PolicyApplies;
      const effectiveFrom = c.effectiveFrom ? String(c.effectiveFrom).slice(0, 10) : null;
      const errors = policyErrors(type.statutoryCode, current, after, floorOn(type.statutoryCode, effectiveFrom && effectiveFrom > today ? effectiveFrom : today, exceptions));
      if (Object.keys(errors).length) {
        out.push({ id, ok: false, error: `It can't be approved: ${Object.values(errors)[0]}` });
        continue;
      }
      const split = splitChange(after, applies, creditedYearly(type));
      // Approved after its date: everything applies now.
      const due = !effectiveFrom || effectiveFrom <= today;
      now = due ? after : split.now;
      complete = due || !Object.keys(split.later).length;
      if (applies === "top_up") {
        const year = await leaveYearOf(today);
        const plan: Plan = { type, current, change: after, applies, effectiveFrom: null, errors: {}, year };
        ledger = (await topUpLines(plan, c.id, ctx.userId, today)).lines;
      }
      const changed = Object.keys(after);
      replaces = (await policyRepo.findChanges([type.id]))
        .filter((o) => o.id !== c.id && o.status === "approved" && !o.appliedAt)
        .filter((o) => Object.keys(splitChange(o.after as Partial<PolicyValues>, o.applies as PolicyApplies, true).later).some((k) => changed.includes(k)))
        .map((o) => o.id);
    }
    const done = await policyRepo.decideChange({ id, leaveTypeId: type.id, status, route, actorId: ctx.userId, action, note: note?.trim() || null, now, complete, ledger, replaces });
    out.push(done ? { id, ok: true, typeName: type.name, status } : { id, ok: false, error: "Someone else decided it first." });
  }
  return out;
}

function viewOf(c: policyRepo.ChangeRow, timeline: ApprovalTimelineEntry[], names: Map<string, string>, actor: ApprovalActor, today: string): PolicyChangeView {
  return {
    id: c.id,
    leaveTypeId: c.leaveTypeId,
    before: c.before as Partial<PolicyValues>,
    after: c.after as Partial<PolicyValues>,
    reason: c.reason,
    applies: c.applies as PolicyApplies,
    effectiveFrom: c.effectiveFrom ? String(c.effectiveFrom).slice(0, 10) : null,
    status: c.status as PolicyChangeStatus,
    source: c.source as "company" | "system",
    preparedBy: c.preparedBy ? names.get(c.preparedBy) ?? "Unknown user" : "System",
    preparedAt: c.preparedAt.toISOString(),
    decidedBy: c.decidedBy ? names.get(c.decidedBy) ?? "Unknown user" : null,
    decidedAt: c.decidedAt ? c.decidedAt.toISOString() : null,
    decisionNote: c.decisionNote,
    appliedAt: c.appliedAt ? c.appliedAt.toISOString() : null,
    scheduled: c.status === "approved" && !c.appliedAt,
    timeline,
    can: availableActions(requestOf(c), actor, decisionCtx(today)),
  };
}

/** Everything the Leave types screen shows for statutory leave. */
export async function policyPage(ctx: PolicyCtx): Promise<LeavePolicyPageData> {
  const today = nepalDateIso();
  const [types, exceptions, approvers, year] = await Promise.all([ruleTypes(), policyRepo.findExceptions(), policyRepo.findPolicyApprovers(), leaveYearOf(today)]);
  const rows = policyTypes(types);
  let requests: CompanyExceptionRequest[] = [];
  let platformUnavailable = false;
  if (ctx.companyId) {
    try {
      requests = await exceptionRequestsFor(ctx.companyId);
    } catch {
      platformUnavailable = true;
    }
  }
  const changes = await policyRepo.findChanges(rows.map((t) => t.id));
  const actions = await policyRepo.findApprovalActions(changes.map((c) => c.id));
  const names = await findUserNames([...changes.flatMap((c) => [c.preparedBy ?? "", c.decidedBy ?? ""]), ...actions.map((a) => a.actorId ?? "")]);
  const actor = actorOf(ctx);
  const views = changes.map((c) =>
    viewOf(
      c,
      actions
        .filter((a) => a.requestId === c.id)
        .map((a) => ({ id: a.id, level: a.level, action: a.action as ApprovalTimelineEntry["action"], actorId: a.actorId, actorName: a.actorId ? names.get(a.actorId) ?? "Unknown user" : "System", onBehalfOfName: null, note: a.note, at: a.createdAt.toISOString() })),
      names,
      actor,
      today
    )
  );
  const typeRows: PolicyTypeRow[] = rows.map((t) => {
    const mine = views.filter((v) => v.leaveTypeId === t.id);
    return {
      id: t.id,
      name: t.name,
      statutoryCode: t.statutoryCode!,
      law: LAW[t.statutoryCode!] ?? "Labour Act",
      values: valuesOf(t),
      floor: floorOn(t.statutoryCode!, today, exceptions).floor,
      floorSource: floorOn(t.statutoryCode!, today, exceptions).source,
      editable: EDITABLE[t.statutoryCode!],
      creditedYearly: creditedYearly(t),
      exceptions: exceptions.filter((e) => e.statutoryCode === t.statutoryCode),
      exceptionSettings: exceptionSettings(t.statutoryCode!),
      exceptionRequests: requests.filter((r) => r.input.statutoryCode === t.statutoryCode).map(requestRow),
      pending: mine.find((v) => v.status === "pending") ?? null,
      scheduled: mine.find((v) => v.scheduled) ?? null,
      history: mine.filter((v) => v.status !== "pending"),
    };
  });
  const waiting = changes.filter((c) => c.status === "pending" && waitingFor(requestOf(c), actor, decisionCtx(today))).length;
  return {
    today,
    leaveYear: year ? { label: year.label, start: year.start, end: year.end } : null,
    nextYearStart: year ? dayAfter(year.end) : null,
    types: typeRows,
    permissions: { propose: ctx.canEdit && companyWide(ctx), approve: actor.canApprove, isAdministrator: actor.isAdministrator, askException: ctx.canEdit && companyWide(ctx) && !!ctx.companyId },
    endingSoon: endingSoon(exceptions, today).map((e) => ({ typeName: rows.find((t) => t.statutoryCode === e.statutoryCode)?.name ?? e.statutoryCode, exception: e })),
    platformUnavailable,
    otherApprovers: approvers.filter((a) => a.userId !== ctx.userId).map((a) => a.name),
    waitingForMe: waiting,
  };
}

/**
 * For the bell: leave policy changes this user can approve now, plus (for
 * people who can change policies) exceptions that end within 30 days.
 */
export async function countPolicyWaitingFor(ctx: PolicyCtx): Promise<number> {
  try {
    const today = nepalDateIso();
    const actor = actorOf(ctx);
    const waiting = actor.canApprove ? (await policyRepo.findPendingChanges()).filter((c) => waitingFor(requestOf(c), actor, decisionCtx(today))).length : 0;
    const ending = ctx.canEdit && companyWide(ctx) ? endingSoon(await policyRepo.findExceptions(), today).length : 0;
    return waiting + ending;
  } catch {
    return 0;
  }
}

function requestRow(r: CompanyExceptionRequest): ExceptionRequestRow {
  return {
    id: r.id,
    setting: r.input.setting as PolicySetting,
    value: r.input.value,
    legalBasis: r.input.legalBasis,
    reference: r.input.reference,
    validFrom: r.input.validFrom,
    validUntil: r.input.validUntil,
    reason: r.reason,
    status: r.status as ExceptionRequestRow["status"],
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt,
    rejectionReason: r.rejectionReason,
    granted: r.granted,
  };
}

const askingRole = (ctx: PolicyCtx) => {
  if (ctx.impersonation) throw new UserFacingError("Support view can't ask for exceptions for the company.");
  if (!ctx.canEdit || !companyWide(ctx)) throw new UserFacingError("Asking for an exception needs a company-wide role with Leave types → Edit.");
  if (!ctx.companyId) throw new UserFacingError("The platform could not be reached. Try again later.");
  return ctx.companyId;
};

/**
 * Asks the platform to lower one Labour Act minimum for this company, with
 * the directive. Nothing changes until the platform grants it, and then the
 * company still proposes the change with a second person's approval.
 */
export async function requestException(input: unknown, ctx: PolicyCtx): Promise<{ id: string; typeName: string }> {
  const companyId = askingRole(ctx);
  const i = readExceptionInput(input);
  const type = policyTypes(await ruleTypes()).find((t) => t.statutoryCode === i.statutoryCode);
  if (!type) throw new UserFacingError("Choose a statutory leave type.");
  const reason = String((input as { reason?: unknown })?.reason ?? "");
  const current = valuesOf(type);
  const id = await createExceptionRequest({
    companyId,
    userId: ctx.userId,
    email: ctx.email || "unknown",
    input: i,
    reason,
    current: { leaveType: type.name, setting: i.setting, companyValue: current[i.setting as PolicySetting] ?? null, lawMinimum: (floorOn(i.statutoryCode, nepalDateIso(), []).floor as Record<string, number | undefined>)[i.setting] ?? null },
  });
  return { id, typeName: type.name };
}

/** Withdraws the company's own waiting exception request. */
export async function cancelExceptionAsk(requestId: string, ctx: PolicyCtx): Promise<void> {
  const companyId = askingRole(ctx);
  await cancelExceptionRequest({ companyId, requestId });
}

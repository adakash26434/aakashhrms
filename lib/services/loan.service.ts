import Decimal from "decimal.js";
import * as repo from "@/lib/repositories/loan.repository";
import { withOpenCase } from "@/lib/repositories/exit.repository";
import { findEmployeeOptions } from "@/lib/repositories/letter.repository";
import { readConfig, writeConfig } from "@/lib/repositories/payroll-control.repository";
import { findApprovers } from "@/lib/repositories/salary-structure.repository";
import { findInForceByEmployeeIds } from "@/lib/repositories/salary-mapping.repository";
import { applyDecision, availableActions, buildFlow, isCompanyAdministrator, parsePolicy, statusText, validatePolicy, waitingFor, type ApprovalActor, type Decision } from "@/lib/engines/approval.engine";
import { CONTROL_KEYS, asCheckerMode, type CheckerMode } from "@/lib/engines/payroll-control.engine";
import * as engine from "@/lib/engines/loan.engine";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { DENIED_SELF, isOwnRecord } from "@/lib/auth/self-action";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso, nepalToday } from "@/lib/utils/nepal-time";
import { bsMonthOf, payMonthLabel, payMonthOptions } from "@/lib/utils/pay-month";
import { isUuid } from "@/lib/utils/uuid";
import type { ApprovalActionKind, ApprovalPolicy, ApprovalRoute, ApprovalTimelineEntry, ApproverInfo } from "@/lib/types/approval";
import type { LoanDetail, LoanRequestPreview, LoanRequestRow, LoanRow, LoansPage, LoanTypeRow, MyLoansData, MyLoanType } from "@/lib/types/loan";

// Loans and salary advances (4.10): orchestration. A request is made for an active employee in
// the user's scope (or by the employee in self-service, for the types that allow it) and decided
// through the approval engine (company policy `approvals.loans`: none / simple / multi-level).
// S21: nobody approves, disburses, repays or writes off their own loan, and the person who asked
// never approves it (an administrator's Final approve aside, unless maker-checker is strict);
// refusals are audited DENIED_SELF. An approved request is disbursed into a loan with its terms
// frozen; payroll recovers it (loan-payroll.service). An approved final settlement holds the
// employee's loans until it is paid, which closes them.

export class LoanValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Validation failed");
    this.name = "LoanValidationError";
  }
}

export interface LoanCtx {
  userId: string;
  scope: ScopeFilter;
  /** Loans → Approve. */
  canApprove: boolean;
}

/** What the viewer may do, for the rows' buttons (the actions check again). */
interface ViewPerms {
  add: boolean;
}

export const POLICY_KEY = "approvals.loans";
const MODULE = "LOANS" as const;
const NO_PERMISSION_TO_APPROVE = "This user cannot approve loans (give their role Loans → Approve)";

const today = () => nepalDateIso();
/** Months payroll may start deducting a loan disbursed now: this BS month and the next three. */
const firstMonths = () => payMonthOptions(bsMonthOf(nepalToday()), 4);
const money = (v: Decimal.Value) => new Decimal(v || 0).toFixed(2);
const nprText = (v: Decimal.Value) => `NPR ${engine.npr(v)}`;

async function settings(): Promise<{ policy: ApprovalPolicy; checker: CheckerMode }> {
  const [raw, checker] = await Promise.all([readConfig(POLICY_KEY), readConfig(CONTROL_KEYS.checker)]);
  let stored: unknown = null;
  try {
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }
  return { policy: parsePolicy(stored), checker: asCheckerMode(checker) };
}

/** The person acting, for the approval engine. Platform support (impersonation) never approves. */
function actorOf(ctx: LoanCtx): ApprovalActor {
  const canApprove = ctx.canApprove && !ctx.scope.isImpersonation;
  return { userId: ctx.userId, employeeId: ctx.scope.employeeId ?? null, canApprove, isAdministrator: isCompanyAdministrator(ctx.scope, canApprove) };
}

/** S21: nobody acts on their own loan. Audited DENIED_SELF, then refused. */
async function refuseOwn(ctx: LoanCtx, employeeId: string, recordId: string, action: "APPROVE" | "EDIT" | "DELETE" | "ADD", message: string): Promise<void> {
  if (!isOwnRecord(ctx.scope.employeeId, employeeId)) return;
  await recordAuditLog({ userId: ctx.userId, action, module: MODULE, recordId, result: DENIED_SELF });
  throw new UserFacingError(message);
}

const refuseSupport = (ctx: LoanCtx) => {
  if (ctx.scope.isImpersonation) throw new UserFacingError("Platform support cannot change loans.");
};

/** Basic + grade in force today, per employee. */
async function monthlySalaries(employeeIds: string[]): Promise<Map<string, number>> {
  const map = await findInForceByEmployeeIds(employeeIds, today());
  return new Map([...map].map(([id, m]) => [id, new Decimal(m.basicSalary || 0).plus(m.gradeAmount || 0).toNumber()]));
}

// ---- views --------------------------------------------------------------------------------------

interface LoanFacts {
  reserved: Map<string, repo.Reserved>;
  held: Set<string>;
  untouched: Set<string>;
  viewer: string | null;
}

async function loanFacts(rows: repo.LoanJoined[], viewer: string | null): Promise<LoanFacts> {
  const running = rows.filter((l) => l.status === "ACTIVE");
  const [reserved, held, untouched] = await Promise.all([
    repo.reservedByLoan(running.map((l) => l.id)),
    repo.heldBySettlement([...new Set(running.map((l) => l.employeeId))]),
    repo.untouched(rows.filter((l) => l.source === "opening").map((l) => l.id)),
  ]);
  return { reserved, held, untouched, viewer };
}

function toLoanRow(l: repo.LoanJoined, f: LoanFacts): LoanRow {
  const reserved = f.reserved.get(l.id);
  const running = l.status === "ACTIVE";
  return {
    id: l.id,
    employeeId: l.employeeId,
    employeeName: l.employeeName,
    employeeCode: l.employeeCode,
    typeId: l.loanTypeId,
    typeName: l.typeName,
    kind: engine.asLoanKind(l.kind),
    source: l.source === "opening" ? "opening" : "disbursed",
    givenDate: String(l.givenDate).slice(0, 10),
    amount: Number(l.loanAmount),
    interestRate: Number(l.interestRate),
    totalPayable: Number(l.totalPayable),
    installment: Number(l.installmentAmount),
    installments: l.noOfInstallments,
    firstDeductionMonth: l.firstDeductionMonth,
    returned: Number(l.totalReturned),
    remaining: Number(l.remainingAmount),
    repaidPct: engine.repaidPct(l.totalPayable, l.totalReturned),
    installmentsLeft: running ? engine.installmentsLeft(l.remainingAmount, l.installmentAmount) : 0,
    reserved: reserved ? Number(reserved.amount) : 0,
    reservedIn: reserved ? reserved.months.map(payMonthLabel) : [],
    status: running ? "ACTIVE" : "CLOSED",
    closedHow: engine.asClosedHow(l.closedHow),
    closedAt: l.closedAt ? l.closedAt.toISOString() : null,
    writtenOff: Number(l.writtenOffAmount),
    paidVia: (engine.PAID_VIA as readonly string[]).includes(l.paidVia ?? "") ? (l.paidVia as engine.PaidVia) : null,
    paymentRef: l.paymentRef,
    note: l.note,
    closeNote: l.closeNote,
    createdByName: l.createdByName,
    requestId: l.requestId,
    own: isOwnRecord(f.viewer, l.employeeId),
    heldBySettlement: running && f.held.has(l.employeeId),
    removable: l.source === "opening" && f.untouched.has(l.id),
  };
}

const ACTION_KINDS: readonly ApprovalActionKind[] = ["submitted", "approved", "final_approved", "rejected", "withdrawn", "skipped", "not_required"];

async function toRequestRows(rows: repo.RequestJoined[], ctx: LoanCtx, perms: ViewPerms, approvers: readonly ApproverInfo[], checker: CheckerMode): Promise<LoanRequestRow[]> {
  if (!rows.length) return [];
  const [steps, held] = await Promise.all([repo.findActions(rows.map((r) => r.id)), repo.heldBySettlement([...new Set(rows.map((r) => r.employeeId))])]);
  const nameOf = (id: string | null) => (id ? approvers.find((a) => a.userId === id)?.name ?? "Unknown user" : "System");
  const timeline = new Map<string, ApprovalTimelineEntry[]>();
  for (const s of steps) {
    const list = timeline.get(s.requestId) ?? [];
    list.push({
      id: s.id,
      level: s.level,
      action: (ACTION_KINDS as readonly string[]).includes(s.action) ? (s.action as ApprovalActionKind) : "submitted",
      actorId: s.actorId,
      actorName: nameOf(s.actorId),
      onBehalfOfName: s.onBehalfOf ? nameOf(s.onBehalfOf) : null,
      note: s.note,
      at: s.createdAt.toISOString(),
    });
    timeline.set(s.requestId, list);
  }
  const actor = actorOf(ctx);
  const decision = engine.loanDecisionCtx(approvers, checker, today());
  return rows.map((r) => {
    const status = engine.asRequestStatus(r.status);
    const request = engine.approvalRequestOf(r);
    const can = availableActions(request, actor, decision);
    const own = isOwnRecord(ctx.scope.employeeId, r.employeeId);
    const disburseReason =
      status !== "approved" ? "Only an approved request is disbursed" : !perms.add || ctx.scope.isImpersonation ? "You can't disburse loans (Loans → Add)" : own ? "Your own loan is disbursed by someone else" : held.has(r.employeeId) ? "Their final settlement is approved: no new loan" : null;
    const text =
      status === "pending" ? statusText(request, nameOf) : status === "approved" ? "Approved · to disburse" : status === "disbursed" ? "Disbursed" : status === "rejected" ? "Rejected" : "Withdrawn";
    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      employeeCode: r.employeeCode,
      typeId: r.loanTypeId,
      typeName: r.typeName,
      kind: engine.asLoanKind(r.kind),
      amount: Number(r.amount),
      installments: r.installments,
      interestRate: Number(r.interestRate),
      terms: engine.loanTerms(r.amount, r.interestRate, r.installments),
      reason: r.reason,
      source: r.source === "self_service" ? "self_service" : "office",
      status,
      statusText: text,
      preparedByName: r.preparedByName,
      requestedAt: r.createdAt.toISOString(),
      decidedByName: r.decidedByName,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      decisionNote: r.decisionNote,
      route: (r.approvalRoute as ApprovalRoute | null) ?? null,
      flow: request.flow,
      currentLevel: request.currentLevel,
      timeline: timeline.get(r.id) ?? [],
      loanId: r.loanId,
      can: { approve: !!can.approve || can.finalApprove, reject: can.reject, withdraw: can.withdraw, disburse: !disburseReason, reason: can.reason, disburseReason },
      waitingForMe: status === "pending" && waitingFor(request, actor, decision),
      own,
    };
  });
}

const typeRow = (t: repo.TypeRow & { inUse?: number }): LoanTypeRow => ({
  id: t.id,
  name: t.name,
  nameNp: t.nameNp,
  kind: engine.asLoanKind(t.kind),
  maxAmount: Number(t.maxAmount),
  maxSalaryMonths: Number(t.maxSalaryMonths),
  maxInstallments: t.maxInstallments,
  interestRate: Number(t.interestRate),
  eligibleAfterMonths: t.eligibleAfterMonths,
  selfService: t.selfService,
  isActive: t.isActive,
  inUse: t.inUse ?? 0,
});

/** Everything the Loans screen shows, within the viewer's scope. */
export async function loansPage(ctx: LoanCtx, permissions: LoansPage["permissions"]): Promise<LoansPage> {
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const [loanRows, requestRows, types, employees, approvers, s] = await Promise.all([
    repo.listLoans(scopeCondition),
    repo.listRequests(scopeCondition),
    repo.listTypes(),
    findEmployeeOptions(scopeCondition),
    findApprovers(MODULE),
    settings(),
  ]);
  const [facts, requests] = await Promise.all([loanFacts(loanRows, ctx.scope.employeeId ?? null), toRequestRows(requestRows, ctx, permissions, approvers, s.checker)]);
  const loans = loanRows.map((l) => toLoanRow(l, facts));
  const running = loans.filter((l) => l.status === "ACTIVE");
  const actor = actorOf(ctx);
  return {
    loans,
    requests,
    types: types.map(typeRow),
    employees: employees.map((e) => ({ id: e.id, name: e.fullName, code: e.employeeCode })),
    payMonths: firstMonths(),
    policy: s.policy,
    approvers: approvers.map((a) => ({ userId: a.userId, name: a.name, employeeId: a.employeeId, active: a.active, canApprove: a.canApprove })),
    me: { userId: ctx.userId, employeeId: ctx.scope.employeeId ?? null, isAdministrator: actor.isAdministrator, otherApprovers: approvers.filter((a) => a.active && a.canApprove && a.userId !== ctx.userId).length },
    totals: {
      running: running.length,
      outstanding: Number(running.reduce((sum, l) => sum.plus(l.remaining), new Decimal(0)).toFixed(2)),
      monthly: Number(running.reduce((sum, l) => sum.plus(engine.monthlyDue({ installment: l.installment, remaining: l.remaining })), new Decimal(0)).toFixed(2)),
      waitingForMe: requests.filter((r) => r.waitingForMe).length,
      toDisburse: requests.filter((r) => r.status === "approved").length,
    },
    today: today(),
    permissions,
  };
}

/** One loan with its repayments and what unlocked payslips will deduct. */
export async function loanDetail(id: unknown, ctx: LoanCtx): Promise<LoanDetail> {
  if (!isUuid(id)) throw new UserFacingError("That loan no longer exists. Refresh the page.");
  const loan = await repo.findLoan(id, buildEmployeeScopeCondition(ctx.scope));
  if (!loan) throw new UserFacingError("That loan is not in your scope.");
  const [facts, repayments, pending] = await Promise.all([loanFacts([loan], ctx.scope.employeeId ?? null), repo.repaymentsOf(loan.id), repo.pendingLinesOf(loan.id)]);
  return {
    loan: toLoanRow(loan, facts),
    repayments: repayments.map((r) => ({
      id: r.id,
      date: r.date,
      amount: Number(r.amount),
      method: r.method === "SALARY_DEDUCTION" || r.method === "SETTLEMENT" ? r.method : "CASH",
      payMonth: r.runYear && r.runMonth ? payMonthLabel(`${r.runYear}-${String(r.runMonth).padStart(2, "0")}`) : null,
      note: r.note,
      byName: r.byName,
    })),
    pending: pending.map((p) => ({ payMonth: payMonthLabel(`${p.year}-${String(p.month).padStart(2, "0")}`), amount: Number(p.amount), status: p.status })),
  };
}

/** Pending requests this person can decide now (the title-bar bell): in scope, never their own. */
export async function countWaitingFor(scope: ScopeFilter, canApprove: boolean): Promise<number> {
  if (scope.isImpersonation) return 0;
  const rows = await repo.pendingRequests(buildEmployeeScopeCondition(scope));
  if (!rows.length) return 0;
  const [approvers, { checker }] = await Promise.all([findApprovers(MODULE), settings()]);
  const actor = actorOf({ userId: scope.userId, scope, canApprove });
  const decision = engine.loanDecisionCtx(approvers, checker, today());
  return rows.filter((r) => waitingFor(engine.approvalRequestOf(r), actor, decision)).length;
}

// ---- requests -----------------------------------------------------------------------------------

interface RequestPlan {
  form: engine.RequestForm;
  facts: engine.RequestFacts;
  type: repo.TypeRow | null;
  errors: Record<string, string>;
  runningMonthly: string;
}

/** The facts a request is checked against (scope, salary in force, service, one at a time). */
async function planRequest(raw: unknown, ctx: LoanCtx): Promise<RequestPlan> {
  const form = engine.normalizeRequestForm(raw);
  const known = isUuid(form.employeeId);
  const [type, employeeOk, employee, salaries, open, leaving, runningMonthly] = await Promise.all([
    isUuid(form.loanTypeId) ? repo.findType(form.loanTypeId) : Promise.resolve(null),
    known ? repo.activeEmployeeInScope(form.employeeId, buildEmployeeScopeCondition(ctx.scope)) : Promise.resolve(false),
    known ? repo.employeeFacts(form.employeeId) : Promise.resolve(null),
    known ? monthlySalaries([form.employeeId]) : Promise.resolve(new Map<string, number>()),
    known && isUuid(form.loanTypeId) ? repo.openOfType(form.employeeId, form.loanTypeId) : Promise.resolve(null),
    known ? withOpenCase([form.employeeId]) : Promise.resolve(new Set<string>()),
    known ? repo.runningInstallments(form.employeeId) : Promise.resolve("0"),
  ]);
  const facts: engine.RequestFacts = {
    type: type
      ? {
          name: type.name,
          kind: engine.asLoanKind(type.kind),
          isActive: type.isActive,
          selfService: type.selfService,
          maxAmount: Number(type.maxAmount),
          maxSalaryMonths: Number(type.maxSalaryMonths),
          maxInstallments: type.maxInstallments,
          eligibleAfterMonths: type.eligibleAfterMonths,
        }
      : null,
    monthlySalary: salaries.get(form.employeeId) ?? null,
    serviceMonths: employee ? engine.completedMonths(employee.joiningDate, today()) : null,
    openOfType: open,
    ownRequest: isOwnRecord(ctx.scope.employeeId, form.employeeId),
    employeeOk,
  };
  const errors = engine.validateRequest(form, facts);
  // Someone leaving is settled in the final settlement: no new loan.
  if (!errors.employeeId && leaving.has(form.employeeId)) errors.employeeId = "Leaving (an exit case is open): no new loan or advance";
  return { form, facts, type, errors, runningMonthly };
}

function routeText(outcome: ReturnType<typeof buildFlow>, approvers: readonly ApproverInfo[]): string {
  if (outcome.approvedAtOnce) return "Approved once saved: approvals for loans are off. It is then disbursed.";
  if (outcome.ownSubject) return "It is about your own record: someone else approves it.";
  if (outcome.flow.type === "multi_level") {
    const name = (id: string) => approvers.find((a) => a.userId === id)?.name ?? "Unknown user";
    return `Goes to ${outcome.flow.levels.filter((l) => !l.skipped).map((l, i) => `Level ${i + 1}: ${name(l.userId)}`).join(", then ")}.`;
  }
  return "Waits for anyone who can approve loans (not you).";
}

/** What a request would be, worked out while the window is filled (nothing is saved). */
export async function previewRequest(raw: unknown, ctx: LoanCtx): Promise<LoanRequestPreview> {
  const plan = await planRequest(raw, ctx);
  const [{ policy }, approvers] = await Promise.all([settings(), findApprovers(MODULE)]);
  const limit = plan.facts.type ? engine.requestLimit(plan.facts.type, plan.facts.monthlySalary) : { amount: null, basis: null, needsSalary: false };
  const terms = plan.type && plan.form.amount > 0 && Number.isInteger(plan.form.installments) && plan.form.installments > 0 ? engine.loanTerms(plan.form.amount, plan.type.interestRate, plan.form.installments) : null;
  const outcome = buildFlow(policy, { preparerId: ctx.userId, preparerEmployeeId: ctx.scope.employeeId ?? null, subjectEmployeeIds: plan.form.employeeId ? [plan.form.employeeId] : [], approvers });
  return {
    limit: limit.amount,
    limitBasis: limit.basis,
    needsSalary: limit.needsSalary,
    monthlySalary: plan.facts.monthlySalary,
    terms,
    runningMonthly: Number(plan.runningMonthly),
    burdenPct: engine.burdenPct(new Decimal(plan.runningMonthly).plus(terms?.installment ?? 0), plan.facts.monthlySalary),
    serviceMonths: plan.facts.serviceMonths,
    route: routeText(outcome, approvers),
    problems: plan.errors,
  };
}

const ONE_OPEN = /loan_requests_one_open_key/;
const isOneOpenViolation = (error: unknown) => error instanceof Error && ONE_OPEN.test(`${error.message} ${String((error as { constraint_name?: unknown }).constraint_name ?? "")}`);

/**
 * Records a request. Self-service requests (and office requests about one's own record) are only
 * for types employees ask for themselves; a request about the person asking always waits for
 * someone else, even with approvals off.
 */
export async function prepareRequest(raw: unknown, ctx: LoanCtx, opts: { selfService?: boolean } = {}): Promise<LoanRequestRow> {
  refuseSupport(ctx);
  const plan = await planRequest(raw, ctx);
  if (Object.keys(plan.errors).length) throw new LoanValidationError(plan.errors);
  const type = plan.type!;
  const [{ policy, checker }, approvers] = await Promise.all([settings(), findApprovers(MODULE)]);
  const outcome = buildFlow(policy, { preparerId: ctx.userId, preparerEmployeeId: ctx.scope.employeeId ?? null, subjectEmployeeIds: [plan.form.employeeId], approvers });
  const actions: repo.NewAction[] = [{ level: 0, actorId: ctx.userId, action: "submitted", note: null }];
  for (const l of outcome.flow.levels.filter((x) => x.skipped)) {
    actions.push({ level: l.level, actorId: null, action: "skipped", note: l.skipped === "preparer" ? "Asked for it, so passed over" : "Their own loan, so passed over" });
  }
  if (outcome.approvedAtOnce) actions.push({ level: 0, actorId: null, action: "not_required", note: "Approvals for loans are off" });
  try {
    const row = await repo.insertRequest(
      {
        employeeId: plan.form.employeeId,
        loanTypeId: type.id,
        amount: money(plan.form.amount),
        installments: plan.form.installments,
        interestRate: money(type.interestRate),
        reason: plan.form.reason,
        source: opts.selfService ? "self_service" : "office",
        status: outcome.approvedAtOnce ? "approved" : "pending",
        preparedBy: ctx.userId,
        approvalType: outcome.flow.type,
        approvalLevels: outcome.flow.levels.map((l) => ({ level: l.level, userId: l.userId, skipped: l.skipped ?? null })),
        currentLevel: outcome.currentLevel,
        approvalRoute: outcome.approvedAtOnce ? outcome.route : null,
        decidedAt: outcome.approvedAtOnce ? new Date() : null,
      },
      actions
    );
    const [view] = await toRequestRows([(await repo.findRequest(row.id))!], ctx, { add: true }, approvers, checker);
    return view;
  } catch (error: unknown) {
    if (isOneOpenViolation(error)) throw new LoanValidationError({ loanTypeId: `${type.name}: a request is already open` });
    throw error;
  }
}

export interface DecisionResult {
  id: string;
  employeeId: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  amount: string;
  /** The level now waiting (multi-level), when still pending. */
  nextLevel: number;
}

/**
 * Approve (a level, or a company administrator's Final approve), reject with a reason, or
 * withdraw (the person who asked). The approval engine decides who may: never about one's own
 * loan, never the person who asked (unless an administrator, and maker-checker is not strict).
 */
export async function decideRequest(id: unknown, decision: unknown, note: unknown, ctx: LoanCtx): Promise<DecisionResult> {
  if (decision !== "approve" && decision !== "reject" && decision !== "withdraw") throw new UserFacingError("Choose approve, reject or withdraw.");
  if (!isUuid(id)) throw new UserFacingError("That request no longer exists. Refresh the page.");
  refuseSupport(ctx);
  const row = await repo.findRequest(id, buildEmployeeScopeCondition(ctx.scope));
  if (!row) throw new UserFacingError("That request is not in your scope.");
  if (row.status !== "pending") throw new UserFacingError(`This request was already ${row.status}. Refresh the page.`);

  const [{ checker }, approvers] = await Promise.all([settings(), findApprovers(MODULE)]);
  const actor = actorOf(ctx);
  const request = engine.approvalRequestOf(row);
  const can = availableActions(request, actor, engine.loanDecisionCtx(approvers, checker, today()));
  const text = typeof note === "string" ? note.trim().replace(/\s+/g, " ").slice(0, 500) : "";
  const own = isOwnRecord(actor.employeeId, row.employeeId);

  let step: Decision;
  let action: ApprovalActionKind;
  if (decision === "withdraw") {
    if (!can.withdraw) throw new UserFacingError("Only the person who asked for it can withdraw a request.");
    [step, action] = ["withdraw", "withdrawn"];
  } else {
    const allowed = decision === "reject" ? can.reject : !!can.approve || can.finalApprove;
    if (!allowed) {
      if (own || row.preparedBy === ctx.userId) await recordAuditLog({ userId: ctx.userId, action: "APPROVE", module: MODULE, recordId: row.id, result: DENIED_SELF });
      throw new UserFacingError(decision === "reject" && row.preparedBy === ctx.userId ? "You asked for it: withdraw it instead." : can.reason ?? engine.LOAN_WORDING.noPermission);
    }
    if (decision === "reject") {
      const problem = engine.validateDecisionNote("reject", text);
      if (problem) throw new LoanValidationError({ note: problem });
      [step, action] = ["reject", "rejected"];
    } else [step, action] = can.approve ? ["approve", "approved"] : ["final_approve", "final_approved"];
  }

  const next = applyDecision(request, step);
  const done = await repo.decideRequest(
    row.id,
    row.currentLevel,
    { status: next.status, currentLevel: next.currentLevel, route: next.route, decidedBy: ctx.userId, note: text || null },
    { level: step === "approve" ? can.approve?.level ?? 0 : 0, actorId: ctx.userId, onBehalfOf: step === "approve" ? can.approve?.onBehalfOf ?? null : null, action, note: text || null }
  );
  if (!done) throw new UserFacingError("Someone else decided this request a moment ago. Refresh the page.");
  return { id: row.id, employeeId: row.employeeId, status: next.status, amount: row.amount, nextLevel: next.currentLevel };
}

/**
 * Pays out an approved request: the loan is written with its terms frozen (rate, total, the
 * installment) and the month payroll starts deducting. Never one's own; never for someone whose
 * final settlement is approved or who already has a loan of the type running.
 */
export async function disburseRequest(id: unknown, raw: unknown, ctx: LoanCtx): Promise<LoanRow> {
  if (!isUuid(id)) throw new UserFacingError("That request no longer exists. Refresh the page.");
  refuseSupport(ctx);
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const row = await repo.findRequest(id, scopeCondition);
  if (!row) throw new UserFacingError("That request is not in your scope.");
  if (row.status !== "approved") throw new UserFacingError(row.status === "disbursed" ? "This request was already disbursed." : "Only an approved request is disbursed.");
  await refuseOwn(ctx, row.employeeId, row.id, "ADD", "Your own loan is disbursed by someone else.");
  const [active, leaving, held, open] = await Promise.all([
    repo.activeEmployeeInScope(row.employeeId, scopeCondition),
    withOpenCase([row.employeeId]),
    repo.heldBySettlement([row.employeeId]),
    repo.runningLoansFor([row.employeeId]),
  ]);
  if (!active) throw new UserFacingError(`${row.employeeName} is not active: the loan can't be paid out.`);
  if (leaving.has(row.employeeId) || held.has(row.employeeId)) throw new UserFacingError(`${row.employeeName} is leaving (an exit case is open): reject the request instead.`);
  if (open.some((l) => l.loanTypeId === row.loanTypeId)) throw new UserFacingError(`${row.employeeName} already has a ${row.typeName} running (one at a time).`);

  const form = engine.normalizeDisburseForm(raw);
  const errors = engine.validateDisburse(form, { today: today(), requestedOn: nepalDateIso(row.createdAt), payMonths: firstMonths().map((m) => m.value) });
  if (Object.keys(errors).length) throw new LoanValidationError(errors);
  const terms = engine.loanTerms(row.amount, row.interestRate, row.installments);
  const loan = await repo.disburse(row.id, {
    employeeId: row.employeeId,
    loanTypeId: row.loanTypeId,
    givenDate: form.givenDate,
    source: "disbursed",
    loanAmount: money(row.amount),
    interestRate: money(row.interestRate),
    totalPayable: terms.totalPayable,
    installmentAmount: terms.installment,
    noOfInstallments: row.installments,
    firstDeductionMonth: form.firstDeductionMonth,
    totalReturned: "0",
    remainingAmount: terms.totalPayable,
    status: "ACTIVE",
    paidVia: form.paidVia || null,
    paymentRef: form.paymentRef || null,
    note: form.note || null,
    createdBy: ctx.userId,
  });
  if (!loan) throw new UserFacingError("Someone already disbursed this request. Refresh the page.");
  const joined = (await repo.findLoan(loan.id))!;
  return toLoanRow(joined, await loanFacts([joined], ctx.scope.employeeId ?? null));
}

// ---- repayment, write-off -----------------------------------------------------------------------

async function runningLoanInScope(id: unknown, ctx: LoanCtx): Promise<repo.LoanJoined> {
  if (!isUuid(id)) throw new UserFacingError("That loan no longer exists. Refresh the page.");
  refuseSupport(ctx);
  const loan = await repo.findLoan(id, buildEmployeeScopeCondition(ctx.scope));
  if (!loan) throw new UserFacingError("That loan is not in your scope.");
  if (loan.status !== "ACTIVE") throw new UserFacingError("This loan is already closed.");
  return loan;
}

async function refuseHeld(loan: repo.LoanJoined): Promise<void> {
  if ((await repo.heldBySettlement([loan.employeeId])).has(loan.employeeId)) {
    throw new UserFacingError(`${loan.employeeName}'s final settlement is approved and recovers this loan when it is paid.`);
  }
}

/** A repayment received outside payroll (cash, a transfer): never more than unlocked payslips leave. */
export async function recordRepayment(id: unknown, raw: unknown, ctx: LoanCtx): Promise<{ loan: LoanRow; amount: number }> {
  const loan = await runningLoanInScope(id, ctx);
  await refuseOwn(ctx, loan.employeeId, loan.id, "EDIT", "Your own loan's repayments are recorded by someone else.");
  await refuseHeld(loan);
  const reserved = (await repo.reservedByLoan([loan.id])).get(loan.id);
  const form = engine.normalizeRepaymentForm(raw);
  const errors = engine.validateRepayment(form, {
    today: today(),
    givenDate: String(loan.givenDate),
    remaining: Number(loan.remainingAmount),
    reserved: reserved ? Number(reserved.amount) : 0,
    reservedIn: reserved ? reserved.months.map(payMonthLabel).join(", ") : null,
  });
  if (Object.keys(errors).length) throw new LoanValidationError(errors);
  const posted = await repo.inTransaction((tx) =>
    repo.postPayment(tx, { loanId: loan.id, employeeId: loan.employeeId, amount: money(form.amount), date: form.date, method: "CASH", note: form.note || null, userId: ctx.userId, keepReserved: true, closedHow: "repaid" })
  );
  if (!posted) throw new UserFacingError("The balance changed a moment ago (a pay run or another repayment). Refresh and try again.");
  const joined = (await repo.findLoan(loan.id))!;
  return { loan: toLoanRow(joined, await loanFacts([joined], ctx.scope.employeeId ?? null)), amount: Number(money(form.amount)) };
}

/** Closes what is left as written off (with the decision's reason); never while an unlocked payslip deducts it. */
export async function writeOffLoan(id: unknown, reason: unknown, ctx: LoanCtx): Promise<LoanRow> {
  const loan = await runningLoanInScope(id, ctx);
  await refuseOwn(ctx, loan.employeeId, loan.id, "APPROVE", "Your own loan is written off by someone else.");
  await refuseHeld(loan);
  const problem = engine.validateWriteOffReason(reason);
  if (problem) throw new LoanValidationError({ reason: problem });
  const reserved = (await repo.reservedByLoan([loan.id])).get(loan.id);
  if (reserved) throw new UserFacingError(`${nprText(reserved.amount)} of it is on the ${reserved.months.map(payMonthLabel).join(", ")} payslip, not yet locked: lock that run (or recalculate the payslip) first.`);
  const row = await repo.writeOff(loan.id, String(reason).trim().replace(/\s+/g, " ").slice(0, 500), ctx.userId);
  if (!row) throw new UserFacingError("The loan changed a moment ago. Refresh and try again.");
  const joined = (await repo.findLoan(loan.id))!;
  return toLoanRow(joined, await loanFacts([joined], ctx.scope.employeeId ?? null));
}

/** Removes a loan carried from the old system that nothing has touched yet (typed by mistake). */
export async function removeOpeningLoan(id: unknown, ctx: LoanCtx): Promise<{ id: string; employeeId: string; remaining: string }> {
  if (!isUuid(id)) throw new UserFacingError("That loan no longer exists. Refresh the page.");
  refuseSupport(ctx);
  const loan = await repo.findLoan(id, buildEmployeeScopeCondition(ctx.scope));
  if (!loan) throw new UserFacingError("That loan is not in your scope.");
  if (loan.source !== "opening") throw new UserFacingError("Only a loan carried from the old system can be removed; repay or write off the others.");
  await refuseOwn(ctx, loan.employeeId, loan.id, "DELETE", "Your own loans are changed by someone else.");
  const removed = await repo.deleteOpeningLoan(loan.id);
  if (!removed) throw new UserFacingError("A payslip or a repayment already touched it, so it stays: repay or write it off instead.");
  return { id: removed.id, employeeId: removed.employeeId, remaining: removed.remainingAmount };
}

// ---- loan types and approval settings -----------------------------------------------------------

const isUniqueName = (error: unknown) => !!error && typeof error === "object" && (error as { code?: string }).code === "23505";

export async function saveType(id: unknown, raw: unknown): Promise<LoanTypeRow> {
  const form = engine.normalizeTypeForm(raw);
  const errors = engine.validateTypeForm(form);
  if (Object.keys(errors).length) throw new LoanValidationError(errors);
  if (id && !isUuid(id)) throw new UserFacingError("That loan type no longer exists.");
  const write: repo.TypeWrite = {
    name: form.name,
    nameNp: form.nameNp || null,
    kind: form.kind,
    maxAmount: money(form.maxAmount),
    maxSalaryMonths: money(form.maxSalaryMonths),
    maxInstallments: form.maxInstallments,
    interestRate: money(form.interestRate),
    eligibleAfterMonths: form.eligibleAfterMonths,
    selfService: form.selfService,
    isActive: form.isActive,
  };
  try {
    const row = id ? await repo.updateType(id as string, write) : await repo.insertType(write);
    if (!row) throw new UserFacingError("That loan type no longer exists.");
    return typeRow(row);
  } catch (error: unknown) {
    if (isUniqueName(error)) throw new LoanValidationError({ name: "Another loan type has this name" });
    throw error;
  }
}

export async function deleteType(id: unknown): Promise<{ id: string; name: string }> {
  if (!isUuid(id)) throw new UserFacingError("That loan type no longer exists.");
  const type = await repo.findType(id);
  if (!type) throw new UserFacingError("That loan type no longer exists.");
  if (!(await repo.deleteUnusedType(id))) throw new UserFacingError(`${type.name} has loans or requests: switch it off (not offered) instead.`);
  return { id: type.id, name: type.name };
}

/** The loan approval setting, who can approve, and how many requests wait (Setup → Approvals). */
export async function approvalSettings(): Promise<{ policy: ApprovalPolicy; approvers: ApproverInfo[]; pending: number }> {
  const [{ policy }, approvers, pending] = await Promise.all([settings(), findApprovers(MODULE), repo.pendingRequests()]);
  return { policy, approvers, pending: pending.length };
}

/** Who approves loans from now on; requests already waiting keep the approvers they were sent to. */
export async function saveApprovalPolicy(raw: unknown): Promise<{ policy: ApprovalPolicy; pendingKept: number }> {
  const policy = parsePolicy(raw);
  const requested = raw && typeof raw === "object" ? (raw as { type?: unknown }).type : undefined;
  if (requested === "multi_level" && policy.type !== "multi_level") throw new LoanValidationError({ levels: "Add at least one approver" });
  const approvers = await findApprovers(MODULE);
  const errors = validatePolicy(policy, approvers, NO_PERMISSION_TO_APPROVE);
  if (Object.keys(errors).length) throw new LoanValidationError(errors);
  await writeConfig(POLICY_KEY, JSON.stringify({ type: policy.type, levels: policy.levels }));
  return { policy, pendingKept: (await repo.pendingRequests()).length };
}

// ---- self-service -------------------------------------------------------------------------------

/** The signed-in employee's own loans, requests and the types they may ask for (employee from the caller's session). */
export async function ownLoans(ctx: LoanCtx): Promise<MyLoansData> {
  const employeeId = ctx.scope.employeeId;
  if (!employeeId) return { loans: [], requests: [], types: [] };
  const [loanRows, requestRows, types, approvers, s, salaries, employee] = await Promise.all([
    repo.employeeLoans(employeeId),
    repo.employeeRequests(employeeId),
    repo.selfServiceTypes(),
    findApprovers(MODULE),
    settings(),
    monthlySalaries([employeeId]),
    repo.employeeFacts(employeeId),
  ]);
  const [facts, requests] = await Promise.all([loanFacts(loanRows, employeeId), toRequestRows(requestRows, ctx, { add: false }, approvers, s.checker)]);
  const loans = loanRows.map((l) => toLoanRow(l, facts));
  const salary = salaries.get(employeeId) ?? null;
  const serviceMonths = employee ? engine.completedMonths(employee.joiningDate, today()) : null;
  const myTypes: MyLoanType[] = types.map((t) => {
    const limit = engine.requestLimit({ maxAmount: Number(t.maxAmount), maxSalaryMonths: Number(t.maxSalaryMonths) }, salary);
    const running = loans.some((l) => l.typeId === t.id && l.status === "ACTIVE");
    const open = requests.some((r) => r.typeId === t.id && (r.status === "pending" || r.status === "approved"));
    const blocked: MyLoanType["blocked"] =
      serviceMonths !== null && t.eligibleAfterMonths > serviceMonths ? "service" : running ? "running" : open ? "open" : limit.needsSalary ? "salary" : null;
    return {
      id: t.id,
      name: t.name,
      nameNp: t.nameNp,
      kind: engine.asLoanKind(t.kind),
      maxInstallments: t.maxInstallments,
      interestRate: Number(t.interestRate),
      limit: limit.amount,
      blocked,
      eligibleAfterMonths: t.eligibleAfterMonths,
    };
  });
  return { loans, requests, types: myTypes };
}

// ---- final settlement (F8) ----------------------------------------------------------------------

/** Runs work in one transaction with the loans (the settlement's payment). */
export const inTransaction = repo.inTransaction;

/** Why a settlement recovering `settled` for loans can't be approved now (null: it can). */
export async function settlementLoanProblem(employeeId: string, settled: Decimal.Value): Promise<string | null> {
  const { outstanding, reserved, reservedMonths } = await repo.outstandingOf(employeeId);
  if (Number(reserved) > 0) {
    return `The ${reservedMonths.map(payMonthLabel).join(", ")} pay run (not locked yet) still deducts ${nprText(reserved)} from their loans: lock it and prepare the settlement again, or remove their payslip from that run.`;
  }
  if (!new Decimal(outstanding).eq(new Decimal(settled || 0))) {
    return `Their loans owe ${nprText(outstanding)} now and the settlement recovers ${nprText(settled)}: prepare the settlement again.`;
  }
  return null;
}

/** Inside the transaction that marks a settlement paid: the loans it recovers are repaid and closed. */
export async function closeLoansBySettlementTx(tx: repo.Tx, employeeId: string, settled: Decimal.Value, p: { userId: string; date: string; ref: string | null }): Promise<number> {
  const running = await repo.runningLoansForUpdate(tx, employeeId);
  const owed = running.reduce((sum, l) => sum.plus(l.remaining), new Decimal(0));
  if (!owed.eq(new Decimal(settled || 0))) throw new UserFacingError(`Their loans owe ${nprText(owed)} now and the settlement recovers ${nprText(settled)}: the loans changed after it was approved.`);
  for (const l of running) {
    const ok = await repo.postPayment(tx, {
      loanId: l.id,
      employeeId,
      amount: money(l.remaining),
      date: p.date,
      method: "SETTLEMENT",
      note: p.ref ? `Final settlement · ${p.ref}` : "Final settlement",
      userId: p.userId,
      keepReserved: false,
      closedHow: "settlement",
    });
    if (!ok) throw new UserFacingError("A loan changed while the settlement was being paid. Refresh and try again.");
  }
  return running.length;
}

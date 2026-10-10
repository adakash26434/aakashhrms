import * as repo from "@/lib/repositories/leave-salary.repository";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import * as leaveRuleRepository from "@/lib/repositories/leave-rule.repository";
import { findInForceByEmployeeIds } from "@/lib/repositories/salary-mapping.repository";
import { findEmployeeOptions } from "@/lib/repositories/letter.repository";
import { withOpenCase } from "@/lib/repositories/exit.repository";
import { ruleTypes } from "@/lib/services/leave-rule-types.service";
import { leaveYearOf, myBalances, postingYear } from "@/lib/services/leave.service";
import {
  asLeaveSalaryStatus,
  calculateLeaveSalary,
  dueDays,
  encashableFromBalance,
  fmtDays,
  isPayMonth,
  normalizeForm,
  payMonthLabel,
  payMonthOf,
  payMonthOptions,
  validateCancelReason,
  validateForm,
} from "@/lib/engines/leave-salary.engine";
import { payoutRate } from "@/lib/engines/leave-type.engine";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { DENIED_SELF, isOwnRecord } from "@/lib/auth/self-action";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { adToBS, BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { nepalDateIso, nepalToday } from "@/lib/utils/nepal-time";
import type { EncashmentRate } from "@/lib/types/leave-rule";
import type { LeaveTypeRecord } from "@/lib/types/leave-type";
import type { LeaveSalaryDue, LeaveSalaryPage, LeaveSalaryPreview, LeaveSalaryRow, LeaveSalaryTypeOption } from "@/lib/types/leave-salary";

// Leave salary (4.9): orchestration. Leave paid out in money — the days over the limit when a
// leave year opened (already off the balance) and days encashed from the balance in force — is
// prepared for an active employee in the user's scope, approved by someone else (never for one's
// own record, S21; never by the person who prepared it), and paid on the next regular pay run on
// LEAVE_ENCASH (taxable; the payslip's tax projection withholds the TDS). Leaving employees are
// paid in the final settlement (F8). Amounts are frozen when prepared: basic in force ÷ 30, or the
// leave type's fixed rate, never below basic.

export class LeaveSalaryValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Validation failed");
    this.name = "LeaveSalaryValidationError";
  }
}

export interface LeaveSalaryCtx {
  userId: string;
  /** The acting user's own employee record (S21), from the session. */
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

const LEAVING = "This person is leaving (an exit case is open): leave is paid in the final settlement (Workforce → Exit).";
const NOT_ACTIVE = "This person is not active: leave of someone who left is paid in the final settlement.";
const NO_SALARY = "This person has no salary structure in force, so the day's rate can't be worked out.";

/**
 * A day's payout rate: the leave type's (statutory leave always basic salary per day, §49; a
 * company type's fixed amount is never paid below basic per day). Types saved before 4.6e without
 * a rate fall back to their leave rule.
 */
export async function payoutOf(leaveType: LeaveTypeRecord): Promise<{ encashmentRate: EncashmentRate; fixedDailyAmount: number }> {
  const oldRule = leaveType.encashmentBasis || leaveType.isStatutory ? null : await leaveRuleRepository.findLeaveRuleByLeaveTypeId(leaveType.id);
  const rate = payoutRate(leaveType, oldRule ? { encashmentRate: oldRule.encashmentRate ?? null, encashmentFixedAmount: oldRule.encashmentFixedAmount ?? null } : null);
  return { encashmentRate: rate.rate, fixedDailyAmount: rate.fixed ?? 0 };
}

const rateText = (p: { encashmentRate: EncashmentRate; fixedDailyAmount: number }) =>
  p.encashmentRate === "FIXED_AMOUNT" && p.fixedDailyAmount > 0 ? `Rs ${p.fixedDailyAmount.toLocaleString("en-IN")} a day (never below basic ÷ 30)` : "Basic ÷ 30 a day";

/** The day's rate and the amount, frozen on the record. */
async function amountsFor(type: LeaveTypeRecord, basic: number, days: number) {
  const pay = await payoutOf(type);
  const r = calculateLeaveSalary({
    basicSalary: String(basic),
    leaveDays: days,
    workingDays: 30,
    encashmentRate: pay.encashmentRate,
    fixedDailyAmount: pay.encashmentRate === "FIXED_AMOUNT" ? pay.fixedDailyAmount : undefined,
  });
  return { perDayRate: r.perDayRate, totalAmount: r.totalAmount, rateBasis: pay.encashmentRate, rateText: rateText(pay) };
}

async function basicsInForce(employeeIds: string[]): Promise<Map<string, number>> {
  const map = await findInForceByEmployeeIds(employeeIds, nepalDateIso());
  return new Map([...map].map(([id, m]) => [id, Number(m.basicSalary) || 0]));
}

const thisPayMonth = () => {
  const bs = adToBS(nepalToday());
  return { year: bs.year, month: bs.month };
};

/** The employee as the record needs them: in scope and active, not leaving. */
async function employeeProblem(employeeId: string, scope: ScopeFilter): Promise<string | null> {
  if (!employeeId || !(await repo.activeEmployeeInScope(employeeId, buildEmployeeScopeCondition(scope)))) return "Choose an active employee in your scope.";
  if ((await withOpenCase([employeeId])).has(employeeId)) return LEAVING;
  return null;
}

/** The balance in force today for one leave (the ledger, substitute grants past expiry excluded). */
async function available(employeeId: string, leaveTypeId: string): Promise<{ days: number; fiscalYearId: string | null; leaveYear: string | null }> {
  const mine = await myBalances(employeeId);
  const b = mine.balances.find((x) => x.leaveTypeId === leaveTypeId);
  return { days: b?.balance ?? 0, fiscalYearId: mine.fiscalYearId ?? null, leaveYear: ("fiscalYearLabel" in mine ? mine.fiscalYearLabel : null) ?? null };
}

async function encashableType(leaveTypeId: string) {
  const rule = (await ruleTypes()).find((t) => t.id === leaveTypeId) ?? null;
  const record = rule ? await leaveRepository.findLeaveTypeById(leaveTypeId) : null;
  return { rule, record: record ?? null };
}

// ---- the page --------------------------------------------------------------------------

function toRow(r: repo.RecordJoined, ctx: LeaveSalaryCtx): LeaveSalaryRow {
  const status = asLeaveSalaryStatus(r.status);
  const before = !r.basicSalary && r.source === "balance" && !isPayMonth(r.paymentPeriod);
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    leaveTypeId: r.leaveTypeId,
    leaveTypeName: r.leaveTypeName,
    source: before ? "before" : r.source === "year_end" ? "year_end" : "balance",
    leaveYear: r.leaveYear,
    days: Number(r.leaveDays),
    perDayRate: Number(r.perDayRate),
    amount: Number(r.totalAmount),
    basicSalary: r.basicSalary === null ? null : Number(r.basicSalary),
    rateBasis: r.rateBasis === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : r.rateBasis === "BASIC_DAILY" ? "BASIC_DAILY" : null,
    payMonth: r.paymentPeriod,
    payMonthLabel: payMonthLabel(r.paymentPeriod),
    status,
    note: r.note,
    preparedBy: r.createdBy,
    preparedByName: r.createdByName,
    preparedAt: r.createdAt.toISOString(),
    approvedByName: r.approvedByName,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    cancelReason: r.cancelReason,
    paidWith: r.runYear && r.runMonth ? `${BS_MONTHS_EN[r.runMonth] ?? r.runMonth} ${r.runYear}` : null,
    legacyTds: status === "PAID" && !r.payrollRunId && Number(r.tdsAmount) > 0 ? Number(r.tdsAmount) : null,
    own: isOwnRecord(ctx.actorEmployeeId, r.employeeId),
    mine: r.createdBy === ctx.userId,
  };
}

/** What a prepared year-end record freezes besides what the screen shows. */
interface DueFrozen {
  rateBasis: EncashmentRate | null;
  basic: number;
  fiscalYearId: string;
}

async function dueRows(lines: repo.DueLine[], ctx: LeaveSalaryCtx): Promise<{ rows: LeaveSalaryDue[]; frozen: Map<string, DueFrozen> }> {
  const ids = [...new Set(lines.map((l) => l.employeeId))];
  const [basics, leaving] = await Promise.all([basicsInForce(ids), withOpenCase(ids)]);
  const types = new Map<string, LeaveTypeRecord | null>();
  for (const id of new Set(lines.map((l) => l.leaveTypeId))) types.set(id, (await leaveRepository.findLeaveTypeById(id)) ?? null);
  const rows: LeaveSalaryDue[] = [];
  const frozen = new Map<string, DueFrozen>();
  for (const l of lines) {
    const days = dueDays(l.days);
    const basic = basics.get(l.employeeId) ?? 0;
    const type = types.get(l.leaveTypeId) ?? null;
    const problem = l.employeeStatus !== "Active" ? NOT_ACTIVE : leaving.has(l.employeeId) ? LEAVING : !(basic > 0) || !type ? NO_SALARY : null;
    const amounts = problem || !type ? null : await amountsFor(type, basic, days);
    frozen.set(l.id, { rateBasis: amounts?.rateBasis ?? null, basic, fiscalYearId: l.fiscalYearId });
    rows.push({
      lineId: l.id,
      employeeId: l.employeeId,
      employeeName: l.employeeName,
      employeeCode: l.employeeCode,
      leaveTypeId: l.leaveTypeId,
      leaveTypeName: l.leaveTypeName,
      leaveYear: l.leaveYear,
      days,
      perDayRate: amounts ? Number(amounts.perDayRate) : null,
      amount: amounts ? Number(amounts.totalAmount) : null,
      problem,
      own: isOwnRecord(ctx.actorEmployeeId, l.employeeId),
    });
  }
  return { rows, frozen };
}

export async function leaveSalaryPage(ctx: LeaveSalaryCtx, permissions: LeaveSalaryPage["permissions"]): Promise<LeaveSalaryPage> {
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const [records, lines, employees, rules] = await Promise.all([repo.listRecords(scopeCondition), repo.dueLines(scopeCondition), findEmployeeOptions(scopeCondition), ruleTypes()]);
  const types: LeaveSalaryTypeOption[] = [];
  for (const t of rules.filter(encashableFromBalance)) {
    const record = await leaveRepository.findLeaveTypeById(t.id);
    if (record) types.push({ id: t.id, name: t.name, code: t.code, rateText: rateText(await payoutOf(record)) });
  }
  return {
    rows: records.map((r) => toRow(r, ctx)),
    due: (await dueRows(lines, ctx)).rows,
    employees: employees.map((e) => ({ id: e.id, name: e.fullName, code: e.employeeCode })),
    types,
    payMonths: payMonthOptions(thisPayMonth()),
    permissions,
  };
}

/** What a new encashment from the balance would pay (the window works it out as it is filled). */
export async function previewEncashment(raw: unknown, ctx: LeaveSalaryCtx): Promise<LeaveSalaryPreview> {
  const f = normalizeForm(raw);
  const empty: LeaveSalaryPreview = { available: 0, leaveYear: null, basicSalary: null, perDayRate: null, amount: null, rateText: null, problem: null };
  if (!f.employeeId || !f.leaveTypeId) return empty;
  const problem = await employeeProblem(f.employeeId, ctx.scope);
  if (problem) return { ...empty, problem };
  const { rule, record } = await encashableType(f.leaveTypeId);
  if (!rule || !record || !encashableFromBalance(rule)) return { ...empty, problem: "This leave is not encashed from the balance." };
  const [have, basics] = await Promise.all([available(f.employeeId, f.leaveTypeId), basicsInForce([f.employeeId])]);
  const basic = basics.get(f.employeeId) ?? 0;
  if (!(basic > 0)) return { ...empty, available: have.days, leaveYear: have.leaveYear, problem: NO_SALARY };
  const days = Number.isFinite(f.days) && f.days > 0 ? f.days : 1;
  const a = await amountsFor(record, basic, days);
  return {
    available: have.days,
    leaveYear: have.leaveYear,
    basicSalary: basic,
    perDayRate: Number(a.perDayRate),
    amount: Number.isFinite(f.days) && f.days > 0 ? Number(a.totalAmount) : null,
    rateText: a.rateText,
    problem: have.days > 0 ? null : "Nothing available to encash.",
  };
}

// ---- preparing -------------------------------------------------------------------------

/** An encashment from the balance in force: a draft for someone else to approve. */
export async function prepareEncashment(raw: unknown, ctx: LeaveSalaryCtx): Promise<repo.RecordRow> {
  const f = normalizeForm(raw);
  const months = payMonthOptions(thisPayMonth()).map((m) => m.value);
  const { rule, record } = f.leaveTypeId ? await encashableType(f.leaveTypeId) : { rule: null, record: null };
  const have = f.employeeId && rule ? await available(f.employeeId, f.leaveTypeId) : null;
  const errors = validateForm(f, { type: rule, available: have?.days ?? null, payMonths: months });
  if (Object.keys(errors).length) throw new LeaveSalaryValidationError(errors);

  const problem = await employeeProblem(f.employeeId, ctx.scope);
  if (problem) throw new LeaveSalaryValidationError({ employeeId: problem });
  if (await repo.draftExists(f.employeeId, f.leaveTypeId)) {
    throw new LeaveSalaryValidationError({ leaveTypeId: `An encashment of ${rule!.name} for this person is already being prepared: finish or delete it first.` });
  }
  const basic = (await basicsInForce([f.employeeId])).get(f.employeeId) ?? 0;
  if (!(basic > 0)) throw new LeaveSalaryValidationError({ employeeId: NO_SALARY });
  const a = await amountsFor(record!, basic, f.days);
  const [row] = await repo.insertRecords([
    {
      employeeId: f.employeeId,
      leaveTypeId: f.leaveTypeId,
      source: "balance",
      encashmentType: "VOLUNTARY",
      fiscalYearId: have?.fiscalYearId ?? null,
      leaveDays: String(f.days),
      basicSalary: basic.toFixed(2),
      rateBasis: a.rateBasis,
      perDayRate: a.perDayRate,
      totalAmount: a.totalAmount,
      tdsAmount: "0",
      paymentPeriod: f.payMonth,
      paymentMethod: "BANK_TRANSFER",
      status: "DRAFT",
      note: f.note || null,
      createdBy: ctx.userId,
    },
  ]);
  return row;
}

/**
 * Drafts for the chosen days over the limit at a year's opening (within scope, not yet in a
 * record). Lines that can't be prepared now (leaving, not active, no salary) are skipped, saying why.
 */
export async function prepareDue(raw: unknown, ctx: LeaveSalaryCtx): Promise<{ prepared: number; skipped: string[] }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ids = Array.isArray(r.lineIds) ? [...new Set(r.lineIds.filter((x): x is string => typeof x === "string"))].slice(0, 501) : [];
  const payMonth = typeof r.payMonth === "string" ? r.payMonth : "";
  if (!ids.length) throw new UserFacingError("Choose the days to prepare first.");
  if (ids.length > 500) throw new UserFacingError("Prepare at most 500 at a time.");
  if (!payMonthOptions(thisPayMonth()).some((m) => m.value === payMonth)) throw new LeaveSalaryValidationError({ payMonth: "Choose the pay month" });

  const lines = await repo.dueLines(buildEmployeeScopeCondition(ctx.scope), ids);
  const { rows, frozen } = await dueRows(lines, ctx);
  const ready = rows.filter((d) => !d.problem && d.amount !== null && d.perDayRate !== null);
  const skipped = [
    ...rows.filter((d) => d.problem).map((d) => `${d.employeeName} (${d.leaveTypeName}): ${d.problem}`),
    ...(lines.length < ids.length ? [`${ids.length - lines.length} line(s) were prepared by someone else meanwhile, or are outside your scope.`] : []),
  ];
  const note = typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 500) : null;
  const writes: repo.RecordWrite[] = ready.map((d) => {
    const f = frozen.get(d.lineId)!;
    return {
      employeeId: d.employeeId,
      leaveTypeId: d.leaveTypeId,
      source: "year_end",
      sourceLineId: d.lineId,
      encashmentType: "ANNUAL_EXCESS",
      fiscalYearId: f.fiscalYearId,
      leaveDays: String(d.days),
      basicSalary: f.basic.toFixed(2),
      rateBasis: f.rateBasis,
      perDayRate: d.perDayRate!.toFixed(2),
      totalAmount: d.amount!.toFixed(2),
      tdsAmount: "0",
      paymentPeriod: payMonth,
      paymentMethod: "BANK_TRANSFER",
      status: "DRAFT",
      note,
      createdBy: ctx.userId,
    };
  });
  try {
    await repo.insertRecords(writes);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "23505") throw new UserFacingError("Some of these days were prepared by someone else a moment ago. Refresh and try again.");
    throw error;
  }
  return { prepared: writes.length, skipped };
}

async function scopedRecord(id: string, ctx: LeaveSalaryCtx): Promise<repo.RecordJoined> {
  const record = typeof id === "string" && id ? await repo.findRecord(id, buildEmployeeScopeCondition(ctx.scope)) : null;
  if (!record) throw new UserFacingError("Not found: this leave salary is not in your scope.");
  return record;
}

/** A draft's days (balance encashments), pay month and note; the amount is worked out again. */
export async function updateDraft(id: string, raw: unknown, ctx: LeaveSalaryCtx): Promise<repo.RecordRow> {
  const record = await scopedRecord(id, ctx);
  if (record.status !== "DRAFT") throw new UserFacingError("Only a draft is changed.");
  const f = normalizeForm({ ...(raw && typeof raw === "object" ? raw : {}), employeeId: record.employeeId, leaveTypeId: record.leaveTypeId });
  const months = payMonthOptions(thisPayMonth()).map((m) => m.value);
  if (record.source === "year_end") {
    if (!months.includes(f.payMonth)) throw new LeaveSalaryValidationError({ payMonth: "Choose the pay month" });
    const row = await repo.updateDraft(id, { paymentPeriod: f.payMonth, note: f.note || null });
    if (!row) throw new UserFacingError("This leave salary was decided a moment ago. Refresh the page.");
    return row;
  }
  const { rule, record: type } = await encashableType(record.leaveTypeId);
  const have = await available(record.employeeId, record.leaveTypeId);
  const errors = validateForm(f, { type: rule, available: have.days, payMonths: months });
  if (Object.keys(errors).length) throw new LeaveSalaryValidationError(errors);
  const basic = (await basicsInForce([record.employeeId])).get(record.employeeId) ?? 0;
  if (!(basic > 0)) throw new LeaveSalaryValidationError({ days: NO_SALARY });
  const a = await amountsFor(type!, basic, f.days);
  const row = await repo.updateDraft(id, {
    leaveDays: String(f.days),
    basicSalary: basic.toFixed(2),
    rateBasis: a.rateBasis,
    perDayRate: a.perDayRate,
    totalAmount: a.totalAmount,
    paymentPeriod: f.payMonth,
    fiscalYearId: have.fiscalYearId,
    note: f.note || null,
  });
  if (!row) throw new UserFacingError("This leave salary was decided a moment ago. Refresh the page.");
  return row;
}

export async function deleteDraft(id: string, ctx: LeaveSalaryCtx): Promise<repo.RecordJoined> {
  const record = await scopedRecord(id, ctx);
  if (record.status !== "DRAFT") throw new UserFacingError("Only a draft is deleted; cancel an approved one instead.");
  if (!(await repo.deleteDraft(id))) throw new UserFacingError("This leave salary was decided a moment ago. Refresh the page.");
  return record;
}

// ---- deciding --------------------------------------------------------------------------

async function refuseOwn(ctx: LeaveSalaryCtx, record: repo.RecordJoined, step: "approve" | "cancel"): Promise<void> {
  const own = isOwnRecord(ctx.actorEmployeeId, record.employeeId);
  const mine = step === "approve" && record.createdBy === ctx.userId;
  if (!own && !mine) return;
  await recordAuditLog({ userId: ctx.userId, action: "APPROVE", module: "LEAVE_SALARY", recordId: record.id, result: DENIED_SELF, newValues: { step, reason: own ? "own_record" : "preparer" } });
  throw new UserFacingError(
    own ? "This is your own leave salary: someone else decides it." : "You prepared this leave salary: someone else approves it (maker-checker)."
  );
}

/**
 * Approves a draft: never one's own record (S21), never by whoever prepared it. A balance
 * encashment's days leave the balance in the same transaction (re-checked now); the next regular
 * pay run from its pay month pays it.
 */
export async function approveRecord(id: string, ctx: LeaveSalaryCtx): Promise<repo.RecordRow> {
  const record = await scopedRecord(id, ctx);
  if (record.status !== "DRAFT") throw new UserFacingError(`This leave salary is already ${asLeaveSalaryStatus(record.status).toLowerCase()}.`);
  await refuseOwn(ctx, record, "approve");
  const problem = await employeeProblem(record.employeeId, ctx.scope);
  if (problem) throw new UserFacingError(problem);

  const days = Number(record.leaveDays);
  const ledger: leaveRepository.NewLedgerLine[] = [];
  if (record.source === "balance") {
    const have = await available(record.employeeId, record.leaveTypeId);
    if (days > have.days) throw new UserFacingError(`Only ${fmtDays(have.days)} of ${record.leaveTypeName} are available now; change the draft.`);
    const year = await leaveYearOf(nepalDateIso());
    if (!year) throw new UserFacingError("There is no leave year for today: open it first (Leaves → Balances).");
    const ref = `leave-salary:${record.id}`;
    if (!(await repo.postedRefs(record.employeeId, [ref])).has(ref)) {
      ledger.push({
        employeeId: record.employeeId,
        leaveTypeId: record.leaveTypeId,
        fiscalYearId: await postingYear(year.id),
        entryDate: nepalDateIso(),
        kind: "paid_out",
        days: -days,
        note: `Leave salary: ${fmtDays(days)} paid with the pay run`,
        ref,
        createdBy: ctx.userId,
      });
    }
  }
  const now = thisPayMonth();
  const payMonth = isPayMonth(record.paymentPeriod) ? record.paymentPeriod : payMonthOf(now.year, now.month);
  const row = await repo.approve(id, ctx.userId, payMonth, ledger);
  if (!row) throw new UserFacingError("This leave salary was decided a moment ago. Refresh the page.");
  return row;
}

/** Cancels an approved record no pay run has taken (never one's own); a balance encashment's days come back. */
export async function cancelRecord(id: string, reason: unknown, ctx: LeaveSalaryCtx): Promise<repo.RecordRow> {
  const record = await scopedRecord(id, ctx);
  if (record.status !== "APPROVED" || record.payrollRunId) {
    throw new UserFacingError(record.status === "PAID" || record.payrollRunId ? "A pay run has already paid this leave salary." : "Only an approved leave salary is cancelled; delete a draft instead.");
  }
  await refuseOwn(ctx, record, "cancel");
  const problem = validateCancelReason(reason);
  if (problem) throw new LeaveSalaryValidationError({ reason: problem });
  const days = Number(record.leaveDays);
  const ledger: leaveRepository.NewLedgerLine[] = [];
  if (record.source === "balance") {
    const ref = `leave-salary-cancel:${record.id}`;
    const posted = await repo.postedRefs(record.employeeId, [`leave-salary:${record.id}`, ref]);
    const year = await leaveYearOf(nepalDateIso());
    if (posted.has(`leave-salary:${record.id}`) && !posted.has(ref)) {
      if (!year) throw new UserFacingError("There is no leave year for today to give the days back to: open it first (Leaves → Balances).");
      ledger.push({
        employeeId: record.employeeId,
        leaveTypeId: record.leaveTypeId,
        fiscalYearId: await postingYear(year.id),
        entryDate: nepalDateIso(),
        kind: "paid_out",
        days,
        note: "Leave salary cancelled: the days come back",
        ref,
        createdBy: ctx.userId,
      });
    }
  }
  const row = await repo.cancel(id, ctx.userId, String(reason).trim().slice(0, 500), ledger);
  if (!row) throw new UserFacingError("This leave salary was paid or changed a moment ago. Refresh the page.");
  return row;
}

/** The bell: drafts someone else prepared, in scope, never about the counting person's own record. Call it for Approve only. */
export async function countWaitingFor(scope: ScopeFilter): Promise<number> {
  return repo.countDraftsFor(buildEmployeeScopeCondition(scope), { userId: scope.userId, employeeId: scope.employeeId });
}

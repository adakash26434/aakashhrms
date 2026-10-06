import * as repo from "@/lib/repositories/leave.repository";
import { ruleTypes } from "@/lib/services/leave-rule-types.service";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import * as shiftService from "@/lib/services/shift.service";
import { findUserNames } from "@/lib/repositories/salary-structure.repository";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { isOwnRecord } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { AttendanceValidationError, OutOfScopeError, OwnAttendanceError } from "@/lib/services/attendance-errors";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { addDays, periodContaining } from "@/lib/engines/pay-period.engine";
import { applyDecision, availableActions, isCompanyAdministrator, type ApprovalWording } from "@/lib/engines/approval.engine";
import { balanceOn, capOf, checkRequest, countDays, creditedMonthly, fmt, homeLeaveEarned, ledgerSummary, monthlyCredit, plainLedgerNote, creditedYearly, splitPaid, typeAppliesTo, yearShare, type CalendarDay } from "@/lib/engines/leave.engine";
import type { ApprovalTimelineEntry } from "@/lib/types/approval";
import type { EmployeeBalancesRow, LeaveDayDetail, LeaveHalf, LeavePageData, LeavePay, LeavePerson, LeavePreview, LeaveRequestView, LeaveRuleType, LeaveStatus, LeaveTabId, LedgerLine } from "@/lib/types/leave";

// Leaves (4.6). One service for HR and self-service: the server counts the
// days from the employee's own calendar (shift weekly offs, branch
// holidays), splits pay, checks the request, and keeps every balance change
// in the ledger. Approvals: the employee's supervisor or someone with Leave
// approvals → Approve in scope; company administrators Final approve; never
// the employee themselves (S21). Days in closed attendance months don't
// change.

export { AttendanceValidationError as LeaveValidationError, OutOfScopeError, OwnAttendanceError as OwnLeaveError };

const WORDING: ApprovalWording = {
  ownSubject: "This is your own leave, so someone else has to approve it.",
  noPermission: "Only the employee's supervisor or someone with Leave approvals → Approve can approve this.",
};
const MAX_SPAN_DAYS = 200;

type Person = attendanceRepo.AttendanceEmployee;

// ---------------------------------------------------------------------------
// People, leave years and calendars
// ---------------------------------------------------------------------------

/** Employees in scope who are employed at some point between two dates (or now). */
async function employeesFor(scope: ScopeFilter): Promise<Person[]> {
  return attendanceRepo.findEmployees(buildEmployeeScopeCondition(scope));
}

const localDay = (d: Date | string) => new Date(new Date(d).getTime() + 345 * 60000).toISOString().slice(0, 10);

export interface LeaveYear {
  id: string;
  label: string;
  start: string;
  end: string;
}

/** Every leave year (= fiscal year, Labour Act §50), oldest first, with Nepal dates. */
export async function leaveYears(): Promise<LeaveYear[]> {
  const years = await fiscalYearRepository.findAllFiscalYears();
  return years.map((f) => ({ id: f.id, label: f.label, start: localDay(f.startDateAD), end: localDay(f.endDateAD) })).sort((a, b) => a.start.localeCompare(b.start));
}

/** The leave year a date falls in. */
export async function leaveYearOf(date: string): Promise<LeaveYear | null> {
  return (await leaveYears()).find((f) => date >= f.start && date <= f.end) ?? null;
}

/** Leave years whose balances were carried into a later year (from → into): closed for leave. */
export async function rolledYears(): Promise<Map<string, string>> {
  const openings = await repo.findOpenings();
  return new Map(openings.filter((o) => o.fromFiscalYearId).map((o) => [o.fromFiscalYearId!, o.fiscalYearId]));
}

/** The year a line meant for `fiscalYearId` goes into: the year its balances were carried into, if it was opened since. */
export async function postingYear(fiscalYearId: string, rolled?: Map<string, string>): Promise<string> {
  const map = rolled ?? (await rolledYears());
  let id = fiscalYearId;
  for (let i = 0; i < 20 && map.has(id); i++) id = map.get(id)!;
  return id;
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length <= MAX_SPAN_DAYS; d = addDays(d)) out.push(d);
  return out;
}

/** People's days between two dates: off on their weekly off (shift / roster) or a holiday for them. */
export async function calendarsFor(people: Person[], from: string, to: string): Promise<Map<string, CalendarDay[]>> {
  const out = new Map<string, CalendarDay[]>();
  if (!people.length) return out;
  const [ctx, holidays] = await Promise.all([shiftService.loadShiftContext(people.map((p) => p.id), from, to), attendanceRepo.findHolidays(from, to)]);
  const dates = datesBetween(from, to);
  for (const person of people) {
    out.set(
      person.id,
      dates.map((date) => {
        const holiday = holidays.find(
          (h) => date >= h.start && date <= h.end && (!h.branchIds.length || h.branchIds.includes(person.branchId)) && (!/women/i.test(h.name) || person.gender === "Female")
        );
        if (holiday) return { date, off: true, why: `Holiday: ${holiday.name}` };
        if (shiftService.shiftOn(ctx, person, date).plan.off) return { date, off: true, why: "Weekly off" };
        return { date, off: false };
      })
    );
  }
  return out;
}

async function calendarFor(person: Person, from: string, to: string): Promise<CalendarDay[]> {
  return (await calendarsFor([person], from, to)).get(person.id) ?? [];
}

// ---------------------------------------------------------------------------
// Preview and checks (the server's own count; never the browser's)
// ---------------------------------------------------------------------------

interface RequestInput {
  leaveTypeId: string;
  from: string;
  to: string;
  half: LeaveHalf | null;
  certificateNote: string;
}

const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function parseInput(raw: unknown): { input: RequestInput | null; errors: Record<string, string> } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const from = isoDate(r.from);
  const to = isoDate(r.to) ?? from;
  const leaveTypeId = typeof r.leaveTypeId === "string" ? r.leaveTypeId : "";
  if (!leaveTypeId) errors.leaveTypeId = "Choose the leave type";
  if (!from) errors.from = "Choose the first day";
  if (from && to && to < from) errors.to = "The last day is before the first";
  if (from && to && to >= from && datesBetween(from, to).length > MAX_SPAN_DAYS) errors.to = `At most ${MAX_SPAN_DAYS} days in one request`;
  const half = r.half === "first" || r.half === "second" ? r.half : null;
  const certificateNote = typeof r.certificateNote === "string" ? r.certificateNote.trim().slice(0, 300) : "";
  if (Object.keys(errors).length) return { input: null, errors };
  return { input: { leaveTypeId, from: from!, to: to!, half, certificateNote }, errors };
}

/** What a request would take: days counted and skipped, pay, balance, and why it can't be made. */
async function previewFor(
  person: Person,
  type: LeaveRuleType,
  input: RequestInput,
  asked: { source: "hr" | "self_service"; appliedOn: string },
  excludeId?: string
): Promise<LeavePreview & { fiscalYearId: string | null }> {
  const [calendar, year, requests, overrides, closed, rolled] = await Promise.all([
    calendarFor(person, input.from, input.to),
    leaveYearOf(input.from),
    repo.findRequests({ employeeIds: [person.id], statuses: ["Pending", "Approved"] }),
    attendanceRepo.findOverrides([person.id], input.from, input.to),
    attendanceRepo.findClosedPeriodsOverlapping(input.from, input.to),
    rolledYears(),
  ]);
  const { counted, skipped, days } = countDays(calendar, type.dayBasis, input.half);
  const { detail, paidDays, unpaidDays } = splitPaid(counted, type);
  const countedDates = new Set(counted.map((c) => c.date));
  // Overlap: another waiting / approved request on a counted day (two different halves of one day may both stand).
  const overlaps = requests.filter((r) => {
    if (r.id === excludeId) return false;
    const dates = r.daysDetail ? r.daysDetail.map((d) => d.date) : datesBetween(String(r.effectiveFrom).slice(0, 10), String(r.effectiveTo).slice(0, 10));
    if (!dates.some((d) => countedDates.has(d))) return false;
    return !(input.half && r.half && r.half !== input.half && dates.length === 1 && dates[0] === input.from);
  }).length;
  const hrDays = [...countedDates].filter((d) => overrides.has(`${person.id}|${d}`)).length;
  const isClosed = closed.some((p) => p.branchId === person.branchId);

  let balance: LeavePreview["balance"] = null;
  if (type.kind === "balance" && year) {
    const ledger = await repo.findLedger([person.id], year.id);
    // Substitute leave: only grants still valid on the first day of the leave count (oldest first, §42).
    const now = balanceOn(ledger.filter((l) => l.leaveTypeId === type.id), input.from).available;
    const waiting = requests
      .filter((r) => r.id !== excludeId && r.status === "Pending" && r.leaveTypeId === type.id && r.fiscalYearId === year.id)
      .reduce((n, r) => n + Number(r.noOfDays), 0);
    balance = { now, waiting, after: Math.round((now - waiting - days) * 100) / 100 };
  }
  // Company types with a yearly or whole-service limit (4.6e): days in the person's other waiting and approved requests.
  const others = requests.filter((r) => r.id !== excludeId && r.leaveTypeId === type.id);
  const usedInService = Math.round(others.reduce((n, r) => n + Number(r.noOfDays), 0) * 100) / 100;
  const usedThisYear = Math.round(others.filter((r) => year && r.fiscalYearId === year.id).reduce((n, r) => n + Number(r.noOfDays), 0) * 100) / 100;
  const { problems, notes } = checkRequest({
    type,
    person: { gender: person.gender, departmentId: person.departmentId, designationId: person.designationId, joiningDate: person.joiningDate, terminationDate: person.terminationDate },
    from: input.from,
    to: input.to,
    half: input.half,
    days,
    leaveYear: year ? { start: year.start, end: year.end } : null,
    overlaps,
    hrDays,
    closed: isClosed,
    available: balance ? Math.round((balance.now - balance.waiting) * 100) / 100 : null,
    certificateNote: input.certificateNote,
    appliedOn: asked.appliedOn,
    source: asked.source,
    usedThisYear,
    usedInService,
  });
  if (!year) problems.push("These dates are outside every fiscal year set up. Ask HR.");
  // A leave year whose balances were carried into the next one takes no more balance leave.
  if (year && type.kind === "balance" && rolled.has(year.id)) problems.push(`${year.label} is closed for leave: its balances were carried into the next year.`);
  // Short of home leave: say which finished months haven't added theirs yet (it comes with the month close).
  if (year && type.statutoryCode === "HOME" && balance && balance.after < 0) {
    const waitingMonths = await monthsWaitingForClose(person.branchId, year);
    if (waitingMonths.length) notes.push(`Home leave is added when each attendance month is closed. ${waitingMonths.join(", ")} ${waitingMonths.length === 1 ? "has" : "have"} ended but ${waitingMonths.length === 1 ? "isn't" : "aren't"} closed yet, so ${waitingMonths.length === 1 ? "its days aren't" : "their days aren't"} in the balance.`);
  }
  return { days, paidDays, unpaidDays, detail, skipped, balance, problems, notes, fiscalYearId: year?.id ?? null };
}

/**
 * Attendance months of a leave year that have ended but aren't closed for a
 * branch (from when the company started keeping leave here). Attendance
 * months are BS months until payroll supports AD months (4.8).
 */
export async function monthsWaitingForClose(branchId: string, year: LeaveYear): Promise<string[]> {
  const today = nepalDateIso();
  const start = await repo.findLeaveStart();
  const from = start && start.start > year.start ? start.start : year.start;
  const closed = (await attendanceRepo.findClosedPeriodsOverlapping(from, today)).filter((c) => c.branchId === branchId);
  const out: string[] = [];
  for (let d = from; d <= year.end; ) {
    const p = periodContaining("BS", d);
    if (p.end >= today) break;
    if (!closed.some((c) => c.calendar === p.calendar && c.periodYear === p.year && c.periodMonth === p.month)) out.push(p.label);
    d = addDays(p.end, 1);
  }
  return out;
}

async function typeById(id: string): Promise<LeaveRuleType> {
  const t = (await ruleTypes()).find((x) => x.id === id);
  if (!t) throw new UserFacingError("That leave type no longer exists. Refresh the page.");
  return t;
}

/** HR: the preview for someone in scope. */
export async function preview(raw: unknown, ctx: { scope: ScopeFilter }): Promise<LeavePreview> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { employeeId?: unknown };
  const { input, errors } = parseInput(raw);
  if (!input) throw new AttendanceValidationError(errors);
  const person = (await employeesFor(ctx.scope)).find((e) => e.id === r.employeeId);
  if (!person) throw new OutOfScopeError();
  const { fiscalYearId: _fy, ...p } = await previewFor(person, await typeById(input.leaveTypeId), input, { source: "hr", appliedOn: nepalDateIso() });
  void _fy;
  return p;
}

/** Self-service: the preview for the signed-in employee. */
export async function previewOwn(raw: unknown, employeeId: string): Promise<LeavePreview> {
  const { input, errors } = parseInput(raw);
  if (!input) throw new AttendanceValidationError(errors);
  const [person] = await attendanceRepo.findEmployeesByIds([employeeId]);
  if (!person) throw new UserFacingError("Your employee record was not found. Contact HR.");
  const { fiscalYearId: _fy, ...p } = await previewFor(person, await typeById(input.leaveTypeId), input, { source: "self_service", appliedOn: nepalDateIso() });
  void _fy;
  return p;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * A new request: HR on behalf of someone in scope, or the employee from
 * self-service. The server counts the days; anything the checks refuse is
 * refused here.
 */
export async function createRequest(
  raw: unknown,
  ctx: { userId: string; source: "hr" | "self_service"; scope?: ScopeFilter; selfEmployeeId?: string }
): Promise<{ id: string; employeeId: string; days: number }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const { input, errors } = parseInput(raw);
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 500) : "";
  if (reason.length < 3) errors.reason = "Give a short reason";
  if (!input || Object.keys(errors).length) throw new AttendanceValidationError(errors);
  let person: Person | undefined;
  if (ctx.source === "self_service") [person] = await attendanceRepo.findEmployeesByIds([ctx.selfEmployeeId ?? ""]);
  else person = (await employeesFor(ctx.scope!)).find((e) => e.id === r.employeeId);
  if (!person) throw ctx.source === "self_service" ? new UserFacingError("Your employee record was not found. Contact HR.") : new OutOfScopeError();
  const type = await typeById(input.leaveTypeId);
  const p = await previewFor(person, type, input, { source: ctx.source, appliedOn: nepalDateIso() });
  if (p.problems.length) throw new UserFacingError(p.problems[0]);
  const id = await repo.insertRequest({
    employeeId: person.id,
    leaveTypeId: type.id,
    fiscalYearId: p.fiscalYearId!,
    from: input.from,
    to: input.to,
    half: input.half,
    days: p.days,
    paidDays: p.paidDays,
    unpaidDays: p.unpaidDays,
    detail: p.detail,
    reason,
    certificateNote: input.certificateNote || null,
    ssfClaim: r.ssfClaim === true,
    source: ctx.source,
    preparedBy: ctx.userId,
    appliedDate: nepalDateIso(),
  });
  return { id, employeeId: person.id, days: p.days };
}

export type LeaveDecision = "approve" | "final_approve" | "reject" | "withdraw" | "cancel";

const statusOf = (s: string) => (s === "Pending" ? "pending" : s === "Approved" ? "approved" : s === "Rejected" ? "rejected" : "withdrawn") as "pending" | "approved" | "rejected" | "withdrawn";

/**
 * Approve, Final approve, reject (reason), withdraw (the person who raised
 * it, or the employee, while it waits) or cancel an approved leave
 * (approver or HR; reason; only in open attendance months). Approval re-checks
 * the balance and the closed months; the days go to the ledger in the same
 * transaction.
 */
export async function decide(
  id: string,
  decision: LeaveDecision,
  noteRaw: unknown,
  ctx: { scope: ScopeFilter; userId: string; canApprove: boolean; canEdit: boolean; selfService?: boolean }
): Promise<{ employeeId: string; status: LeaveStatus }> {
  const a = await repo.findRequestById(id);
  if (!a) throw new UserFacingError("That leave request no longer exists. Refresh the page.");
  const [person] = await attendanceRepo.findEmployeesByIds([a.employeeId]);
  if (!person) throw new UserFacingError("That employee no longer exists.");
  const inScope = !ctx.selfService && (await employeesFor(ctx.scope)).some((e) => e.id === person.id);
  const supervisor = !!ctx.scope.employeeId && person.supervisorId === ctx.scope.employeeId;
  const own = isOwnRecord(ctx.scope.employeeId, person.id);
  if (!inScope && !supervisor && !own && a.preparedBy !== ctx.userId) throw new OutOfScopeError();
  const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, 500) || null : null;
  const type = await typeById(a.leaveTypeId);
  const days = Number(a.noOfDays) || 0;
  const today = nepalDateIso();

  // Cancel an approved leave: the days come back (balance types).
  if (decision === "cancel") {
    if (a.status !== "Approved") throw new UserFacingError("Only approved leave can be cancelled; withdraw a waiting request instead.");
    if (own) throw new OwnAttendanceError("You can't cancel your own approved leave. Ask HR or your approver.");
    if (!((ctx.canApprove && inScope) || supervisor || (ctx.canEdit && inScope))) throw new UserFacingError("Only an approver or HR can cancel approved leave.");
    if (!note || note.length < 3) throw new AttendanceValidationError({ note: "Give a reason for cancelling" });
    await guardOpen(person, String(a.effectiveFrom).slice(0, 10), String(a.effectiveTo).slice(0, 10));
    const ok = await repo.decideRequest({
      id,
      expectedStatus: "Approved",
      status: "Cancelled",
      route: a.approvalRoute,
      actorId: ctx.userId,
      action: "withdrawn",
      note,
      cancelReason: note,
      // Days of a year already carried over come back in the year they were carried into.
      ledger: type.kind === "balance" ? [{ employeeId: person.id, leaveTypeId: type.id, fiscalYearId: await postingYear(a.fiscalYearId), entryDate: today, kind: "returned", days, applicationId: id, note: `Cancelled: ${note}`, createdBy: ctx.userId }] : [],
    });
    if (!ok) throw new UserFacingError("Someone else changed this leave a moment ago. Refresh the page.");
    return { employeeId: person.id, status: "Cancelled" };
  }

  if (a.status !== "Pending") throw new UserFacingError(`This request is already ${a.status.toLowerCase()}.`);
  const request = { status: statusOf(a.status), preparedById: a.preparedBy, subjectEmployeeIds: [a.employeeId], flow: { type: "simple" as const, levels: [] }, currentLevel: 0 };
  const actor = { userId: ctx.userId, employeeId: ctx.scope.employeeId, canApprove: (ctx.canApprove && inScope) || supervisor, isAdministrator: isCompanyAdministrator(ctx.scope, ctx.canApprove) };
  const can = availableActions(request, actor, { approvers: [], today, wording: WORDING });

  // Withdraw: the person who raised it, or the employee themselves.
  if (decision === "withdraw") {
    if (!can.withdraw && !own) throw new UserFacingError("Only the person who raised it, or the employee, can withdraw it.");
    const ok = await repo.decideRequest({ id, expectedStatus: "Pending", status: "Cancelled", route: null, actorId: ctx.userId, action: "withdrawn", note, cancelReason: note ?? "Withdrawn", ledger: [] });
    if (!ok) throw new UserFacingError("Someone else decided this request a moment ago. Refresh the page.");
    return { employeeId: person.id, status: "Cancelled" };
  }

  const refuse = (msg: string | null, fallback: string): never => {
    if (own) throw new OwnAttendanceError(WORDING.ownSubject);
    throw new UserFacingError(msg ?? fallback);
  };
  if (decision === "approve" && !can.approve) refuse(can.reason, "You cannot approve this request.");
  if (decision === "final_approve" && !can.finalApprove) refuse(can.reason, "Only a company administrator can Final approve.");
  if (decision === "reject" && !can.reject) refuse(a.preparedBy === ctx.userId ? "You raised this request: withdraw it instead." : can.reason, "You cannot reject this request.");
  if (decision === "reject" && (!note || note.length < 3)) {
    throw new AttendanceValidationError({ note: type.isRight ? "Say which condition is not met (Labour Act §51: this leave is a right)" : "Give the work reason for refusing (Labour Act §51)" });
  }

  const next = applyDecision(request, decision);
  const ledger: repo.NewLedgerLine[] = [];
  if (next.status === "approved") {
    // Re-check now: the balance, overlaps, closed months, employment.
    const p = await previewFor(person, type, {
      leaveTypeId: type.id,
      from: String(a.effectiveFrom).slice(0, 10),
      to: String(a.effectiveTo).slice(0, 10),
      half: (a.half as LeaveHalf | null) ?? null,
      certificateNote: a.certificateNote ?? "",
    }, { source: a.source === "self_service" ? "self_service" : "hr", appliedOn: String(a.appliedDate).slice(0, 10) }, id);
    const blocking = p.problems.filter((x) => !x.startsWith(`${type.name} is not in use`));
    if (blocking.length) throw new UserFacingError(`Can't approve: ${blocking[0]}`);
    if (type.kind === "balance") ledger.push({ employeeId: person.id, leaveTypeId: type.id, fiscalYearId: a.fiscalYearId, entryDate: String(a.effectiveFrom).slice(0, 10), kind: "taken", days: -days, applicationId: id, note: `Leave ${fmt(days)} day${days === 1 ? "" : "s"}`, createdBy: ctx.userId });
  }
  const ok = await repo.decideRequest({
    id,
    expectedStatus: "Pending",
    status: next.status === "approved" ? "Approved" : next.status === "rejected" ? "Rejected" : "Pending",
    route: next.route,
    actorId: ctx.userId,
    action: decision === "approve" ? "approved" : decision === "final_approve" ? "final_approved" : "rejected",
    note,
    ledger,
  });
  if (!ok) throw new UserFacingError("Someone else decided this request a moment ago. Refresh the page.");
  return { employeeId: person.id, status: next.status === "approved" ? "Approved" : "Rejected" };
}

/** Refuses changes to days in a closed attendance month for the person's branch. */
async function guardOpen(person: Person, from: string, to: string) {
  const closed = await attendanceRepo.findClosedPeriodsOverlapping(from, to);
  if (closed.some((p) => p.branchId === person.branchId)) throw new UserFacingError("Some of these days are in a closed attendance month. Reopen the month first.");
}

/** HR: add or take days from a balance, with a reason (never your own balance). */
export async function adjustBalance(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ employeeId: string; leaveTypeId: string; days: number }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const days = Number(r.days);
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 300) : "";
  if (!Number.isFinite(days) || days === 0 || Math.abs(days) > 365 || Math.round(days * 2) !== days * 2) errors.days = "Whole or half days, not zero (use minus to take days away)";
  if (reason.length < 3) errors.reason = "Give a reason";
  if (Object.keys(errors).length) throw new AttendanceValidationError(errors);
  const person = (await employeesFor(ctx.scope)).find((e) => e.id === r.employeeId);
  if (!person) throw new OutOfScopeError();
  if (isOwnRecord(ctx.scope.employeeId, person.id)) throw new OwnAttendanceError("You can't adjust your own leave balance. Ask someone else.");
  const type = await typeById(typeof r.leaveTypeId === "string" ? r.leaveTypeId : "");
  if (type.kind !== "balance") throw new UserFacingError(`${type.name} has no balance to adjust.`);
  const today = nepalDateIso();
  const year = await leaveYearOf(today);
  if (!year) throw new UserFacingError("No fiscal year covers today. Set one up first.");
  if (days < 0) {
    const ledger = await repo.findLedger([person.id], year.id);
    const now = balanceOn(ledger.filter((l) => l.leaveTypeId === type.id), today).available;
    if (now + days < 0) throw new AttendanceValidationError({ days: `Only ${fmt(now)} days to take away` });
  }
  await repo.postLedgerLines([{ employeeId: person.id, leaveTypeId: type.id, fiscalYearId: year.id, entryDate: today, kind: "adjusted", days, note: reason, createdBy: ctx.userId }]);
  return { employeeId: person.id, leaveTypeId: type.id, days };
}

// ---------------------------------------------------------------------------
// For attendance: approved leave per day
// ---------------------------------------------------------------------------

/** Approved leave on each day (employee|date → name, pay, half) with the request's own counted days. */
export async function approvedLeaveDays(employeeIds: string[], from: string, to: string): Promise<Map<string, { name: string; pay: LeavePay; half: boolean }>> {
  const out = new Map<string, { name: string; pay: LeavePay; half: boolean }>();
  if (!employeeIds.length) return out;
  const [requests, types] = await Promise.all([repo.findRequests({ employeeIds, from, to, statuses: ["Approved"] }), ruleTypes()]);
  const typeOf = new Map(types.map((t) => [t.id, t]));
  for (const r of requests) {
    const t = typeOf.get(r.leaveTypeId);
    const name = t?.name ?? "Leave";
    // Requests before 4.6 have no counted days: every date, the type's pay, half from the old duration field.
    const days: LeaveDayDetail[] =
      r.daysDetail ??
      datesBetween(String(r.effectiveFrom).slice(0, 10), String(r.effectiveTo).slice(0, 10)).map((date) => ({ date, part: r.duration === "Half Day" ? 0.5 : 1, pay: t?.pay ?? "full" }));
    for (const d of days) if (d.date >= from && d.date <= to) out.set(`${r.employeeId}|${d.date}`, { name, pay: d.pay, half: d.part < 1 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Waiting for this user (title-bar bell)
// ---------------------------------------------------------------------------

/** Waiting requests this user can decide: supervisees', or anyone's in scope with Approve; never their own or ones they raised. */
export async function countWaitingFor(scope: ScopeFilter, canApprove: boolean): Promise<number> {
  const waiting = await repo.findRequests({ statuses: ["Pending"] });
  if (!waiting.length) return 0;
  const [inScope, people] = await Promise.all([canApprove ? employeesFor(scope) : Promise.resolve([] as Person[]), attendanceRepo.findEmployeesByIds([...new Set(waiting.map((w) => w.employeeId))])]);
  const scoped = new Set(inScope.map((e) => e.id));
  const sup = new Map(people.map((e) => [e.id, e.supervisorId]));
  return waiting.filter((w) => w.employeeId !== scope.employeeId && w.preparedBy !== scope.userId && (scoped.has(w.employeeId) || (!!scope.employeeId && sup.get(w.employeeId) === scope.employeeId))).length;
}

// ---------------------------------------------------------------------------
// The Leaves page
// ---------------------------------------------------------------------------

export async function getLeavePage(params: { tab: LeaveTabId; scope: ScopeFilter; userId: string; permissions: LeavePageData["permissions"] }): Promise<LeavePageData> {
  const today = nepalDateIso();
  const [types, people, branches, departments, year] = await Promise.all([
    ruleTypes(),
    employeesFor(params.scope),
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    leaveYearOf(today),
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const active = people.filter((e) => e.status === "Active" || (e.terminationDate && e.terminationDate >= addDays(today, -90)));
  const view = (e: Person): LeavePerson => ({
    id: e.id,
    employeeCode: e.employeeCode,
    fullName: e.fullName,
    gender: e.gender,
    branchId: e.branchId,
    branchName: branchName.get(e.branchId) ?? "",
    departmentId: e.departmentId,
    departmentName: deptName.get(e.departmentId) ?? "",
    designationId: e.designationId,
    supervisorId: e.supervisorId,
  });
  // Requests: waiting ones, and anything from 3 months back on, for people in scope (and supervisees).
  const scopeIds = new Set(people.map((e) => e.id));
  const all = await repo.findRequests({ from: addDays(today, -92) });
  const supervisees = params.scope.employeeId ? (await attendanceRepo.findEmployees()).filter((e) => e.supervisorId === params.scope.employeeId) : [];
  const visiblePeople = new Map([...people, ...supervisees].map((e) => [e.id, e]));
  const rows = all.filter((r) => scopeIds.has(r.employeeId) || visiblePeople.has(r.employeeId));
  const [timeline, typeOf] = [await repo.findTimeline(rows.map((r) => r.id)), new Map(types.map((t) => [t.id, t]))];
  const names = await findUserNames([...rows.flatMap((r) => [r.preparedBy ?? "", r.reviewedById ?? ""]), ...timeline.map((t) => t.actorId ?? "")]);
  const canApprove = params.permissions.approve;
  const actorBase = { userId: params.userId, employeeId: params.scope.employeeId, isAdministrator: isCompanyAdministrator(params.scope, canApprove) };
  const requests: LeaveRequestView[] = rows.map((r) => {
    const e = visiblePeople.get(r.employeeId)!;
    const supervisor = !!params.scope.employeeId && e.supervisorId === params.scope.employeeId;
    const own = isOwnRecord(params.scope.employeeId, e.id);
    const can = availableActions(
      { status: statusOf(r.status), preparedById: r.preparedBy, subjectEmployeeIds: [r.employeeId], flow: { type: "simple", levels: [] }, currentLevel: 0 },
      { ...actorBase, canApprove: (canApprove && scopeIds.has(e.id)) || supervisor },
      { approvers: [], today, wording: WORDING }
    );
    return {
      id: r.id,
      employee: view(e),
      leaveTypeId: r.leaveTypeId,
      leaveTypeName: typeOf.get(r.leaveTypeId)?.name ?? "Leave",
      from: String(r.effectiveFrom).slice(0, 10),
      to: String(r.effectiveTo).slice(0, 10),
      half: (r.half as LeaveHalf | null) ?? (r.duration === "Half Day" ? "first" : null),
      days: Number(r.noOfDays) || 0,
      paidDays: r.paidDays !== null ? Number(r.paidDays) : Number(r.noOfDays) || 0,
      unpaidDays: r.unpaidDays !== null ? Number(r.unpaidDays) : 0,
      detail: r.daysDetail ?? null,
      reason: r.reason,
      certificateNote: r.certificateNote,
      ssfClaim: r.ssfClaim,
      status: r.status as LeaveStatus,
      source: r.source === "self_service" ? "self_service" : "hr",
      preparedBy: r.preparedBy ? names.get(r.preparedBy) ?? "Unknown user" : r.source === "self_service" ? e.fullName : "HR",
      appliedDate: String(r.appliedDate).slice(0, 10),
      decidedBy: r.reviewedById ? names.get(r.reviewedById) ?? null : null,
      decidedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      decisionNote: r.reviewRemarks,
      cancelReason: r.cancelReason,
      timeline: timeline
        .filter((t) => t.requestId === r.id)
        .map(
          (t): ApprovalTimelineEntry => ({
            id: t.id,
            level: t.level,
            action: t.action as ApprovalTimelineEntry["action"],
            actorId: t.actorId,
            actorName: t.actorId ? names.get(t.actorId) ?? "Unknown user" : "System",
            onBehalfOfName: null,
            note: t.note,
            at: t.createdAt.toISOString(),
          })
        ),
      can: {
        approve: !!can.approve,
        finalApprove: can.finalApprove && !can.approve,
        reject: can.reject,
        withdraw: r.status === "Pending" && (can.withdraw || own),
        cancel: r.status === "Approved" && !own && ((canApprove && scopeIds.has(e.id)) || supervisor || (params.permissions.edit && scopeIds.has(e.id))),
        reason: can.reason,
      },
    };
  });

  // Balances for the leave year: the ledger sums, and days in waiting requests.
  let balances: EmployeeBalancesRow[] = [];
  if (year) {
    const balanceTypes = types.filter((t) => t.kind === "balance" && t.isActive);
    const ledger = await repo.findLedger(active.map((e) => e.id), year.id);
    balances = active.map((e) => ({
      employee: view(e),
      cells: balanceTypes
        .filter((t) => t.genderApplicable === "All" || t.genderApplicable === e.gender)
        .map((t) => {
          const lines = ledger.filter((l) => l.employeeId === e.id && l.leaveTypeId === t.id);
          return {
            leaveTypeId: t.id,
            balance: balanceOn(lines, today).available,
            taken: Math.round(-lines.filter((l) => l.kind === "taken" || l.kind === "returned").reduce((n, l) => n + l.days, 0) * 100) / 100,
            waiting: rows.filter((r) => r.employeeId === e.id && r.leaveTypeId === t.id && r.status === "Pending").reduce((n, r) => n + Number(r.noOfDays), 0),
          };
        }),
    }));
  }

  return {
    tab: params.tab,
    today,
    fiscalYear: year,
    types,
    requests,
    balances,
    people: active.map(view),
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    currentUserId: params.userId,
    myEmployeeId: params.scope.employeeId,
    permissions: params.permissions,
    // Filled by the page for their tabs (leave-entitlement.service).
    substitute: null,
    calendar: null,
    homeSwitch: null,
    homeMonthsToClose: [],
    leaveStart: null,
    branchFilter: "",
  };
}

/** One person's ledger for the leave year (Balances pane), within scope. */
export async function ledgerFor(employeeId: string, scope: ScopeFilter): Promise<(LedgerLine & { createdByName: string | null })[]> {
  if (!(await employeesFor(scope)).some((e) => e.id === employeeId)) throw new OutOfScopeError();
  const year = await leaveYearOf(nepalDateIso());
  if (!year) return [];
  const lines = await repo.findLedger([employeeId], year.id);
  const names = await findUserNames(lines.map((l) => l.createdBy ?? ""));
  return lines.map((l) => ({ ...l, note: plainLedgerNote(l.note), createdByName: l.createdBy ? names.get(l.createdBy) ?? null : null }));
}

// ---------------------------------------------------------------------------
// Self-service (the employee comes from the session, never the browser)
// ---------------------------------------------------------------------------

/** The employee's balances for the leave year (balance types only), from the ledger. */
export async function myBalances(employeeId: string) {
  const [person] = await attendanceRepo.findEmployeesByIds([employeeId]);
  const year = await leaveYearOf(nepalDateIso());
  if (!person || !year) return { balances: [], fiscalYearId: year?.id };
  const [types, ledger] = await Promise.all([ruleTypes(), repo.findLedger([employeeId], year.id)]);
  const balances = types
    .filter((t) => t.kind === "balance" && t.isActive && (t.genderApplicable === "All" || t.genderApplicable === person.gender))
    .map((t) => {
      const lines = ledger.filter((l) => l.leaveTypeId === t.id);
      const s = ledgerSummary(lines);
      // Usable today (substitute grants past their expiry no longer count).
      return { id: t.id, leaveTypeId: t.id, leaveTypeName: t.name, leaveTypeCode: t.code, allotted: s.allotted, taken: s.taken, carriedForward: s.carriedForward, balance: balanceOn(lines, nepalDateIso()).available };
    });
  return { balances, fiscalYearId: year.id, fiscalYearLabel: year.label };
}

/**
 * What would be paid if the employee left today (Labour Act §49: accumulated
 * home and sick leave, up to 90 / 45 days, at the last basic salary; an
 * encashable company type up to its cap). Leave salary (4.9) pays it.
 */
export async function payableOnLeaving(employeeId: string): Promise<{ leaveTypeName: string; days: number; cap: number | null }[]> {
  const [{ balances }, types] = await Promise.all([myBalances(employeeId), ruleTypes()]);
  return balances.flatMap((b) => {
    const t = types.find((x) => x.id === b.leaveTypeId);
    if (!t || !(t.statutoryCode === "HOME" || t.statutoryCode === "SICK" || (!t.isStatutory && t.isEncashable))) return [];
    const cap = capOf(t);
    return [{ leaveTypeName: t.name, days: Math.max(0, cap === null ? b.balance : Math.min(b.balance, cap)), cap }];
  });
}

/** Types the employee can ask for (active, for their gender, department and designation; the server checks the rest). */
export async function myRequestableTypes(employeeId: string): Promise<LeaveRuleType[]> {
  const [person] = await attendanceRepo.findEmployeesByIds([employeeId]);
  if (!person) return [];
  return (await ruleTypes()).filter((t) => t.isActive && typeAppliesTo(t, person));
}

/** The employee withdraws their own waiting request. */
export async function withdrawOwn(id: string, employeeId: string, userId: string): Promise<void> {
  const a = await repo.findRequestById(id);
  if (!a || a.employeeId !== employeeId) throw new UserFacingError("That leave request was not found.");
  if (a.status !== "Pending") throw new UserFacingError(`This request is already ${a.status.toLowerCase()}; ask HR to cancel approved leave.`);
  const ok = await repo.decideRequest({ id, expectedStatus: "Pending", status: "Cancelled", route: null, actorId: userId, action: "withdrawn", note: null, cancelReason: "Withdrawn by the employee", ledger: [] });
  if (!ok) throw new UserFacingError("This request was decided a moment ago. Refresh the page.");
}

// ---------------------------------------------------------------------------
// 4.6b: entitlements posted with attendance (month close / reopen) and at hire
// ---------------------------------------------------------------------------

export const monthRef = (period: { calendar: string; year: number; month: number }) => `accrual:${period.calendar}-${period.year}-${period.month}`;

/**
 * Leave lines that go with closing an attendance month (same transaction):
 * home leave earned, paid days ÷ 20 (Labour Act §43; closing again after a
 * reopen posts only the difference), and substitute days that expired
 * unused by the month end, written off.
 */
export async function monthCloseLines(p: {
  period: { calendar: string; year: number; month: number; label: string; end: string };
  fiscalYearId: string;
  paidDays: { employeeId: string; days: number }[];
  userId: string;
}): Promise<repo.NewLedgerLine[]> {
  const ids = p.paidDays.map((x) => x.employeeId);
  if (!ids.length) return [];
  const types = await ruleTypes();
  const home = types.find((t) => t.statutoryCode === "HOME" && t.kind === "balance" && t.isActive);
  const substitute = types.find((t) => t.statutoryCode === "SUBSTITUTE" && t.kind === "balance");
  const rolled = await rolledYears();
  const lines: repo.NewLedgerLine[] = [];
  // Months before the company started keeping leave here are in the starting balances.
  const start = await repo.findLeaveStart();
  if (home && !(start && p.period.end < start.start)) {
    const ref = monthRef(p.period);
    const year = await postingYear(p.fiscalYearId, rolled);
    const posted = await repo.findLinesByRef(ids, ref);
    // Before 4.6 the whole year's home leave was given up front (the `opening`
    // lines of the 4.6a backfill). Until HR switches that year to earned home
    // leave (home-leave.service), nothing more is earned in it; the switch
    // adds the closed months' days.
    const yearLines = (await repo.findLedger(ids, year)).filter((l) => l.leaveTypeId === home.id);
    const switched = new Set(yearLines.filter((l) => l.ref === `home-earned:${year}`).map((l) => l.employeeId));
    // Only the old system's lines (no ref); starting balances (ref start:…) are not up-front days.
    const upFront = new Set(yearLines.filter((l) => l.kind === "opening" && !l.ref && l.days > 0 && !switched.has(l.employeeId)).map((l) => l.employeeId));
    for (const x of p.paidDays) {
      if (upFront.has(x.employeeId)) continue;
      const earned = homeLeaveEarned(x.days, home.accrualEveryDays);
      const already = Math.round(posted.filter((l) => l.employeeId === x.employeeId && l.leaveTypeId === home.id && l.ref === ref).reduce((n, l) => n + l.days, 0) * 100) / 100;
      const diff = Math.round((earned - already) * 100) / 100;
      if (diff === 0) continue;
      lines.push({
        employeeId: x.employeeId,
        leaveTypeId: home.id,
        fiscalYearId: year,
        entryDate: p.period.end,
        kind: "accrual",
        days: diff,
        note: already ? `${p.period.label}: ${fmt(x.days)} paid days, corrected after a reopen` : `${p.period.label}: ${fmt(x.days)} paid days ÷ ${home.accrualEveryDays ?? 20}`,
        ref,
        createdBy: p.userId,
      });
    }
  }
  // Company types given month by month (4.6e): days a year ÷ 12 for the part of the month each
  // person was employed. Someone already given this year's days at the year start (before the
  // type was switched to monthly) gets nothing more this year; closing again after a reopen posts
  // only the difference.
  const monthly = types.filter((t) => t.isActive && creditedMonthly(t));
  if (monthly.length && !(start && p.period.end < start.start)) {
    const ref = monthRef(p.period);
    const year = await postingYear(p.fiscalYearId, rolled);
    const posted = await repo.findLinesByRef(ids, ref);
    const yearLines = await repo.findLedger(ids, year);
    const people = await attendanceRepo.findEmployeesByIds(ids);
    const month = { start: periodContaining(p.period.calendar === "AD" ? "AD" : "BS", p.period.end).start, end: p.period.end };
    for (const t of monthly) {
      const givenYearly = new Set(yearLines.filter((l) => l.leaveTypeId === t.id && l.kind === "credit" && l.ref !== null && (l.ref.startsWith("opening:") || l.ref.startsWith("credit:"))).map((l) => l.employeeId));
      for (const e of people) {
        if (givenYearly.has(e.id) || !typeAppliesTo(t, e)) continue;
        const due = monthlyCredit(t.days, month, { joiningDate: e.joiningDate, terminationDate: e.terminationDate });
        const already = Math.round(posted.filter((l) => l.employeeId === e.id && l.leaveTypeId === t.id && l.ref === ref).reduce((n, l) => n + l.days, 0) * 100) / 100;
        const diff = Math.round((due - already) * 100) / 100;
        if (diff === 0) continue;
        lines.push({
          employeeId: e.id,
          leaveTypeId: t.id,
          fiscalYearId: year,
          entryDate: p.period.end,
          kind: "credit",
          days: diff,
          note: already ? `${p.period.label}: corrected after a reopen` : `${p.period.label}: ${fmt(t.days)} days a year ÷ 12${due < Math.round((t.days / 12) * 100) / 100 ? ", for the days employed" : ""}`,
          ref,
          createdBy: p.userId,
        });
      }
    }
  }
  if (substitute) {
    const all = await repo.findTypeLines(ids, substitute.id);
    const done = new Set(all.filter((l) => l.kind === "expired" && l.ref).map((l) => `${l.employeeId}|${l.ref}`));
    const dayAfter = addDays(p.period.end, 1);
    for (const id of ids) {
      // Grants live in one year at a time (opening carries the valid ones over), so per year is enough.
      const byYear = new Map<string, typeof all>();
      for (const l of all.filter((x) => x.employeeId === id)) byYear.set(l.fiscalYearId, [...(byYear.get(l.fiscalYearId) ?? []), l]);
      for (const [yearId, yl] of byYear) {
        for (const e of balanceOn(yl, dayAfter).expired) {
          const ref = `expiry:${e.id}`;
          if (!e.id || done.has(`${id}|${ref}`)) continue;
          lines.push({ employeeId: id, leaveTypeId: substitute.id, fiscalYearId: await postingYear(yearId, rolled), entryDate: e.expiresOn, kind: "expired", days: -e.days, note: `Not taken by ${e.expiresOn} (Labour Act §42: within 21 days)`, ref, createdBy: p.userId });
        }
      }
    }
  }
  return lines;
}

/** Reopening an attendance month takes its home leave back (closing again posts it afresh). */
export async function monthReopenLines(p: { period: { calendar: string; year: number; month: number; label: string; end: string }; employeeIds: string[]; reason: string; userId: string }): Promise<repo.NewLedgerLine[]> {
  // A month before the start is in the starting balances: reopening it changes no leave.
  const start = await repo.findLeaveStart();
  if (start && p.period.end < start.start) return [];
  const ref = monthRef(p.period);
  // The ref is matched as a prefix ("accrual:BS-2083-1" would also find months 10–12): keep this month's lines only.
  const posted = (await repo.findLinesByRef(p.employeeIds, ref)).filter((l) => l.ref === ref);
  const rolled = await rolledYears();
  const lines: repo.NewLedgerLine[] = [];
  const keys = new Map<string, typeof posted>();
  for (const l of posted) keys.set(`${l.employeeId}|${l.leaveTypeId}`, [...(keys.get(`${l.employeeId}|${l.leaveTypeId}`) ?? []), l]);
  for (const [, ls] of keys) {
    const net = Math.round(ls.reduce((n, l) => n + l.days, 0) * 100) / 100;
    if (net === 0) continue;
    lines.push({
      employeeId: ls[0].employeeId,
      leaveTypeId: ls[0].leaveTypeId,
      fiscalYearId: await postingYear(ls[ls.length - 1].fiscalYearId, rolled),
      entryDate: p.period.end,
      // Home leave earned (accrual) or a monthly credit (credit), taken back the same way.
      kind: ls[0].kind,
      days: -net,
      note: `${p.period.label} reopened: ${p.reason}`,
      ref,
      createdBy: p.userId,
    });
  }
  return lines;
}

/**
 * A new employee's yearly credits (sick 12, company types), pro-rata from
 * joining (Labour Act §44); home leave is earned and substitute leave
 * granted, so they start at 0.
 */
export async function creditOnJoining(employee: { id: string; gender: string; joiningDate: string | null; departmentId?: string | null; designationId?: string | null }): Promise<void> {
  const today = nepalDateIso();
  const join = employee.joiningDate ?? today;
  const year = await leaveYearOf(join > today ? join : today);
  if (!year) return;
  const types = (await ruleTypes()).filter((t) => t.isActive && creditedYearly(t) && typeAppliesTo(t, employee));
  const ref = `credit:${year.id}`;
  const already = new Set((await repo.findLinesByRef([employee.id], ref)).map((l) => l.leaveTypeId));
  const joined = join > year.start;
  await repo.postLedgerLines(
    types
      .filter((t) => !already.has(t.id))
      .map((t) => ({
        employeeId: employee.id,
        leaveTypeId: t.id,
        fiscalYearId: year.id,
        entryDate: joined ? join : year.start,
        kind: "credit" as const,
        days: yearShare(t, t.days, join, year),
        note: joined ? `${year.label}, pro-rata from joining` : year.label,
        ref,
        createdBy: null,
      }))
      .filter((l) => l.days > 0)
  );
}

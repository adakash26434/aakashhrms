import * as repo from "@/lib/repositories/attendance.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as salaryMappingRepository from "@/lib/repositories/salary-mapping.repository";
import * as shiftService from "@/lib/services/shift.service";
import { approvedLeaveDays, monthCloseLines, monthReopenLines } from "@/lib/services/leave.service";
import * as checkinRepo from "@/lib/repositories/checkin.repository";
import { findUserNames } from "@/lib/repositories/salary-structure.repository";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { includesOwnRecord, isOwnRecord } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { AttendanceValidationError, OutOfScopeError, OwnAttendanceError } from "@/lib/services/attendance-errors";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { applyDecision, availableActions, isCompanyAdministrator, type ApprovalWording, type Decision } from "@/lib/engines/approval.engine";
import { addDays, datesIn, periodContaining, periodFor, type PayPeriod } from "@/lib/engines/pay-period.engine";
import { plannedWeekMinutes, shiftSummary, shiftWarnings } from "@/lib/engines/shift.engine";
import { clockMinutes, instantAt, localClock, punchesForDay, resolveDay, summariseMonth, unpaidDeduction } from "@/lib/engines/attendance-day.engine";
import { OT_MAX_ENTRY_MINUTES, decidable, monthOvertime, otDetail } from "@/lib/engines/overtime.engine";
import * as overtimeService from "@/lib/services/overtime.service";
import * as overtimeRepo from "@/lib/repositories/overtime.repository";
import type { OvertimeDayView, OvertimeDetail, OvertimeEntry, OvertimeLine, OvertimePolicy } from "@/lib/types/overtime";
import type { ApprovalTimelineEntry } from "@/lib/types/approval";
import {
  ADJUSTMENT_KINDS,
  OVERRIDE_TYPES,
  REMOTE_KINDS,
  type AdjustmentKind,
  type AdjustmentView,
  type AttendancePageData,
  type AttendanceRules,
  type AttendanceTab,
  type BranchMonth,
  type DayResult,
  type MonthSummary,
  type OverrideType,
  type PunchView,
  type RegisterEmployee,
  type RegisterRow,
  type RosterRow,
  type ShiftView,
} from "@/lib/types/attendance";

// Attendance (4.5): the day rules applied to people, punches, approved leave,
// holidays and HR overrides; the register; adjustments (regularization) with
// approval; month close per branch; and the figures payroll reads. Every
// entry point takes the user's scope; S21: nobody edits, overrides or
// approves their own attendance.

const WORDING: ApprovalWording = {
  ownSubject: "This is your own attendance, so someone else has to approve it.",
  noPermission: "Only the employee's supervisor or someone with Attendance → Approve can approve this.",
};
const MAX_CELLS = 2000;
const OT_WORDING: ApprovalWording = {
  ownSubject: "This is your own overtime, so someone else has to decide it.",
  noPermission: "Only the employee's supervisor or someone with Attendance → Approve can decide overtime.",
  preparer: "You added this overtime, so someone else has to approve it.",
};

// ---------------------------------------------------------------------------
// Rules (company work schedule + attendance-only settings)
// ---------------------------------------------------------------------------

interface StoredRules {
  noRecord?: unknown;
  lateRule?: { enabled?: unknown; count?: unknown };
  webCheckIn?: { enabled?: unknown };
}

/** Company-wide attendance rules (working hours live in shifts, 4.5b). */
export async function getRules(): Promise<AttendanceRules> {
  const storedRaw = await repo.getRulesJson();
  const stored = (storedRaw && typeof storedRaw === "object" ? storedRaw : {}) as StoredRules;
  const late = stored.lateRule ?? {};
  return {
    // AD months come with payroll runs in AD months (4.8); until then attendance months are BS.
    calendar: "BS",
    noRecord: stored.noRecord === "present" ? "present" : "absent",
    lateRule: { enabled: late.enabled === true, count: Math.max(1, Math.min(10, Number(late.count) || 3)) },
    // Off until HR sets web clock-in up (4.5c).
    webCheckIn: { enabled: stored.webCheckIn?.enabled === true },
  };
}

/** Saves the company-wide rules (what a day with nothing recorded counts as, the late rule). */
export async function saveRules(raw: unknown): Promise<AttendanceRules> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lateCount = Number(r.lateCount);
  if (!Number.isInteger(lateCount) || lateCount < 1 || lateCount > 10) throw new AttendanceValidationError({ lateCount: "Between 1 and 10" });
  const storedRaw = await repo.getRulesJson();
  const stored = storedRaw && typeof storedRaw === "object" ? storedRaw : {};
  await repo.setRulesJson({
    ...stored,
    noRecord: r.noRecord === "present" ? "present" : "absent",
    lateRule: { enabled: r.lateEnabled === true, count: lateCount },
    webCheckIn: { enabled: r.webCheckIn === true },
  });
  return getRules();
}

export { AttendanceValidationError, OwnAttendanceError, OutOfScopeError };

// ---------------------------------------------------------------------------
// Resolving days
// ---------------------------------------------------------------------------

type Employee = repo.AttendanceEmployee;

interface Context {
  rules: AttendanceRules;
  ot: Map<string, boolean>;
  holidays: Awaited<ReturnType<typeof repo.findHolidays>>;
  /** Approved leave per employee|date (the request's own counted days, 4.6). */
  leaves: Awaited<ReturnType<typeof approvedLeaveDays>>;
  punches: Map<string, string[]>;
  overrides: Awaited<ReturnType<typeof repo.findOverrides>>;
  shifts: shiftService.ShiftContext;
  today: string;
  now: string;
}

/** Everything the day rules need for some employees between two dates. */
async function loadContext(employees: Employee[], from: string, to: string, rules?: AttendanceRules): Promise<Context> {
  const ids = employees.map((e) => e.id);
  const [r, ot, holidays, leaves, punchRows, overrides, shifts] = await Promise.all([
    rules ? Promise.resolve(rules) : getRules(),
    repo.findOtEligibility(),
    repo.findHolidays(from, to),
    approvedLeaveDays(ids, from, to),
    // Night shifts reach into the next morning: read a day either side.
    repo.findPunches(ids, instantAt(addDays(from, -1), 0), instantAt(addDays(to, 2), 0)),
    repo.findOverrides(ids, from, to),
    shiftService.loadShiftContext(ids, from, to),
  ]);
  const punches = new Map<string, string[]>();
  for (const p of punchRows) punches.set(p.employeeId, [...(punches.get(p.employeeId) ?? []), p.punchedAt]);
  return { rules: r, ot, holidays, leaves, punches, overrides, shifts, today: nepalDateIso(), now: new Date().toISOString() };
}

/** Migration 0039 marked days typed in the old screen with this note; say it in plain words. */
const plainNote = (text: string | null) => (text === "Recorded before 4.5" ? "Entered in the old attendance screen" : text);

/** How one employee-day counts. */
function resolveFor(ctx: Context, e: Employee, date: string): DayResult {
  // The day's shift, and the shifts either side (a punch belongs to the nearest shift).
  const shift = shiftService.shiftOn(ctx.shifts, e, date).plan;
  const prev = shiftService.shiftOn(ctx.shifts, e, addDays(date, -1)).plan;
  const next = shiftService.shiftOn(ctx.shifts, e, addDays(date, 1)).plan;
  const holiday = ctx.holidays.find(
    (h) =>
      date >= h.start &&
      date <= h.end &&
      (!h.branchIds.length || h.branchIds.includes(e.branchId)) &&
      // International Women's Day is a holiday for women only (Labour Act: 14 public holidays for women).
      (!/women/i.test(h.name) || e.gender === "Female")
  );
  const l = ctx.leaves.get(`${e.id}|${date}`);
  const override = ctx.overrides.get(`${e.id}|${date}`);
  return resolveDay({
    date,
    employedFrom: e.joiningDate,
    employedUntil: e.terminationDate,
    shift,
    noRecord: ctx.rules.noRecord,
    holiday: holiday ? { name: holiday.name } : null,
    leave: l ?? null,
    punches: punchesForDay(ctx.punches.get(e.id) ?? [], date, shift, prev, next),
    override: override ? { dayType: override.type, reason: plainNote(override.reason) ?? "" } : null,
    otEligible: ctx.ot.get(e.category) ?? true,
    today: ctx.today,
    now: ctx.now,
  });
}

/** Employees in scope who were employed at some point in a date range. */
async function employeesFor(scope: ScopeFilter, from: string, to: string, filter: { branchId?: string; departmentId?: string } = {}): Promise<Employee[]> {
  const all = await repo.findEmployees(buildEmployeeScopeCondition(scope));
  return all.filter(
    (e) =>
      e.joiningDate <= to &&
      (!e.terminationDate || e.terminationDate >= from) &&
      (e.status === "Active" || !!e.terminationDate) &&
      (!filter.branchId || e.branchId === filter.branchId) &&
      (!filter.departmentId || e.departmentId === filter.departmentId)
  );
}

/**
 * Days worked on a weekly off or a holiday (4.6b: substitute leave, Labour
 * Act §42), for people in scope between two dates, with the minutes worked
 * and the shift's full and half day.
 */
export async function workedOffDays(
  scope: ScopeFilter,
  from: string,
  to: string
): Promise<{ employeeId: string; date: string; why: string; firstIn: string | null; lastOut: string | null; workMinutes: number; otOffMinutes: number; fullDayMinutes: number; halfDayMinutes: number }[]> {
  if (to < from) return [];
  const people = await employeesFor(scope, from, to);
  if (!people.length) return [];
  const ctx = await loadContext(people, from, to);
  const out: Awaited<ReturnType<typeof workedOffDays>> = [];
  for (const e of people) {
    for (const date of datesBetween(from, to)) {
      const r = resolveFor(ctx, e, date);
      if ((r.dayType !== "weekly_off" && r.dayType !== "holiday") || r.workMinutes <= 0) continue;
      const plan = shiftService.shiftOn(ctx.shifts, e, date).plan;
      out.push({
        employeeId: e.id,
        date,
        why: r.dayType === "holiday" ? `Holiday: ${r.holidayName ?? "public holiday"}` : "Weekly off",
        firstIn: r.firstIn,
        lastOut: r.lastOut,
        workMinutes: r.workMinutes,
        otOffMinutes: r.otOffDayMinutes,
        fullDayMinutes: plan.fullDayMinutes,
        halfDayMinutes: plan.halfDayMinutes,
      });
    }
  }
  return out;
}

/** Status words per day for older screens (dashboard, employee record), from the same rules. */
export async function attendanceMarks(scope: ScopeFilter, from: string, to: string, branchId?: string): Promise<{ employeeId: string; date: string; status: string }[]> {
  const people = await employeesFor(scope, from, to, { branchId });
  const ctx = await loadContext(people, from, to);
  const dates = datesBetween(from, to);
  const out: { employeeId: string; date: string; status: string }[] = [];
  for (const e of people) for (const d of dates) {
    const r = resolveFor(ctx, e, d);
    if (r.dayType !== "not_employed" && r.dayType !== "upcoming") out.push({ employeeId: e.id, date: d, status: repo.LEGACY_STATUS[r.dayType] });
  }
  return out;
}

/**
 * One employee's days (employee record page): the same rules as the
 * register. The caller has already checked access to this employee.
 */
export async function daysForEmployee(employeeId: string, from: string, to: string) {
  const people = await repo.findEmployeesByIds([employeeId]);
  if (!people.length) return [];
  const ctx = await loadContext(people, from, to);
  return datesBetween(from, to)
    .map((d) => resolveFor(ctx, people[0], d))
    .filter((r) => r.dayType !== "not_employed")
    .map((r) => ({
      date: r.date,
      status: repo.LEGACY_STATUS[r.dayType],
      inTime: localClock(r.firstIn) || null,
      outTime: localClock(r.lastOut) || null,
      workHours: Math.round((r.workMinutes / 60) * 100) / 100,
      isLate: r.lateMinutes > 0,
    }));
}

/**
 * Paid days so far in some open months (home leave view, 4.6b): the same
 * rules as the register, up to a day; nothing is written. Per employee,
 * keyed `year-month`.
 */
export async function paidDaysSoFar(employeeIds: string[], periods: PayPeriod[], upTo: string): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  const started = periods.filter((p) => p.start <= upTo);
  const people = started.length && employeeIds.length ? await repo.findEmployeesByIds(employeeIds) : [];
  if (!people.length) return out;
  const rules = await getRules();
  const from = started.map((p) => p.start).sort()[0];
  const ends = started.map((p) => (p.end < upTo ? p.end : upTo)).sort();
  const c = await loadContext(people, from, ends[ends.length - 1], rules);
  for (const e of people) {
    const months = new Map<string, number>();
    for (const p of started) {
      const results = datesIn(p)
        .filter((d) => d <= upTo)
        .map((d) => resolveFor(c, e, d));
      months.set(`${p.year}-${p.month}`, summariseMonth(p, results, rules).payableDays);
    }
    out.set(e.id, months);
  }
  return out;
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d)) out.push(d);
  return out;
}

// ---------------------------------------------------------------------------
// Page data
// ---------------------------------------------------------------------------

export async function getAttendancePage(params: {
  tab: AttendanceTab;
  scope: ScopeFilter;
  userId: string;
  year?: number;
  month?: number;
  branchId?: string;
  permissions: AttendancePageData["permissions"];
  /** The signed-in user's IP (Check-in tab: "Add this network"). */
  clientIp?: string;
}): Promise<AttendancePageData> {
  const today = nepalDateIso();
  const rules = await getRules();
  let period: PayPeriod;
  try {
    period = params.year && params.month ? periodFor(rules.calendar, params.year, params.month) : periodContaining(rules.calendar, today);
  } catch {
    period = periodContaining(rules.calendar, today);
  }
  const [branches, departments, people] = await Promise.all([
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    employeesFor(params.scope, period.start, period.end, { branchId: params.branchId }),
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const view = (e: Employee): RegisterEmployee => ({
    id: e.id,
    employeeCode: e.employeeCode,
    attendanceCode: e.attendanceCode,
    fullName: e.fullName,
    branchId: e.branchId,
    branchName: branchName.get(e.branchId) ?? "",
    departmentId: e.departmentId,
    departmentName: deptName.get(e.departmentId) ?? "",
    supervisorId: e.supervisorId,
  });

  const periods = await repo.findPeriods(period.calendar, period.year, period.month);
  const closedBranches = new Set(periods.filter((p) => p.status === "closed").map((p) => p.branchId));

  // Register (and close overview) for the month.
  const ctx = await loadContext(people, period.start, period.end, rules);
  const dates = datesIn(period);
  const register: RegisterRow[] = people.map((e) => {
    const days = dates.map((d) => resolveFor(ctx, e, d));
    return { employee: view(e), days, summary: summariseMonth(period, days, rules), locked: closedBranches.has(e.branchId) };
  });

  // Today (when today is in the month shown; otherwise its own read).
  let todayRows: AttendancePageData["todayRows"] = [];
  if (params.tab === "today") {
    const todayPeople = today >= period.start && today <= period.end ? people : await employeesFor(params.scope, today, today, { branchId: params.branchId });
    const tctx = today >= period.start && today <= period.end ? ctx : await loadContext(todayPeople, today, today, rules);
    todayRows = todayPeople.map((e) => ({ employee: view(e), day: resolveFor(tctx, e, today) })).filter((r) => r.day.dayType !== "not_employed");
  }

  // Punch log for the month.
  const ids = people.map((e) => e.id);
  const punchRows = params.tab === "punches" ? await repo.findPunches(ids, instantAt(period.start, 0), instantAt(addDays(period.end, 1), 0), { includeVoided: true }) : [];
  const adjustmentRows = await repo.findAdjustments({ employeeIds: ids, from: addDays(period.start, -62), to: period.end });
  const timeline = await repo.findAdjustmentTimeline(adjustmentRows.map((a) => a.id));
  // Overtime (4.7b): every day with overtime this month, and the decisions taken.
  const [otEntries, { policy: otPolicy }] = await Promise.all([overtimeRepo.findEntries({ employeeIds: ids, from: period.start, to: period.end }), overtimeService.getPolicy()]);
  const otTimeline = await overtimeRepo.findTimeline(otEntries.map((x) => x.id));
  const names = await findUserNames([
    ...punchRows.map((p) => p.createdBy ?? ""),
    ...adjustmentRows.flatMap((a) => [a.preparedBy ?? "", a.decidedBy ?? ""]),
    ...[...timeline, ...otTimeline].flatMap((t) => [t.actorId ?? "", t.onBehalfOf ?? ""]),
    ...otEntries.flatMap((x) => [x.preparedBy ?? "", x.decidedBy ?? ""]),
  ]);
  const person = new Map(people.map((e) => [e.id, e]));

  const canApprove = params.permissions.approve;
  const actor = { userId: params.userId, employeeId: params.scope.employeeId, canApprove, isAdministrator: isCompanyAdministrator(params.scope, canApprove) };
  const adjustments: AdjustmentView[] = adjustmentRows.map((a) => {
    const e = person.get(a.employeeId);
    const supervisor = !!e && !!params.scope.employeeId && e.supervisorId === params.scope.employeeId;
    const can = availableActions(
      { status: a.status as AdjustmentView["status"], preparedById: a.preparedBy, subjectEmployeeIds: [a.employeeId], flow: { type: "simple", levels: [] }, currentLevel: 0 },
      { ...actor, canApprove: canApprove || supervisor },
      { approvers: [], today, wording: WORDING }
    );
    return {
      id: a.id,
      employeeId: a.employeeId,
      employeeName: e?.fullName ?? "",
      employeeCode: e?.employeeCode ?? "",
      date: String(a.attendanceDate).slice(0, 10),
      kind: a.kind as AdjustmentKind,
      requestedIn: a.requestedIn ? a.requestedIn.toISOString() : null,
      requestedOut: a.requestedOut ? a.requestedOut.toISOString() : null,
      place:
        a.kind === "remote_in" || a.kind === "remote_out"
          ? { ip: a.ip, distanceM: a.distanceM, accuracyM: a.accuracyM, latitude: a.latitude === null ? null : Number(a.latitude), longitude: a.longitude === null ? null : Number(a.longitude) }
          : null,
      reason: a.reason,
      source: a.source === "self_service" ? "self_service" : "hr",
      status: a.status as AdjustmentView["status"],
      preparedById: a.preparedBy,
      preparedBy: a.preparedBy ? names.get(a.preparedBy) ?? "Unknown user" : "System",
      createdAt: a.createdAt.toISOString(),
      decidedBy: a.decidedBy ? names.get(a.decidedBy) ?? null : null,
      decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
      decisionNote: a.decisionNote,
      approvalRoute: a.approvalRoute,
      timeline: timeline
        .filter((t) => t.requestId === a.id)
        .map(
          (t): ApprovalTimelineEntry => ({
            id: t.id,
            level: t.level,
            action: t.action as ApprovalTimelineEntry["action"],
            actorId: t.actorId,
            actorName: t.actorId ? names.get(t.actorId) ?? "Unknown user" : "System",
            onBehalfOfName: t.onBehalfOf ? names.get(t.onBehalfOf) ?? null : null,
            note: t.note,
            at: t.createdAt.toISOString(),
          })
        ),
      can: { approve: !!can.approve, finalApprove: can.finalApprove && !can.approve, reject: can.reject, withdraw: can.withdraw, reason: can.reason },
    };
  });

  const timelineOf = (rows: typeof timeline, id: string): ApprovalTimelineEntry[] =>
    rows
      .filter((t) => t.requestId === id)
      .map((t) => ({
        id: t.id,
        level: t.level,
        action: t.action as ApprovalTimelineEntry["action"],
        actorId: t.actorId,
        actorName: t.actorId ? names.get(t.actorId) ?? "Unknown user" : "System",
        onBehalfOfName: t.onBehalfOf ? names.get(t.onBehalfOf) ?? null : null,
        note: t.note,
        at: t.createdAt.toISOString(),
      }));
  const overtime: OvertimeDayView[] = register.flatMap((row) => {
    const e = person.get(row.employee.id)!;
    const supervisor = !!params.scope.employeeId && e.supervisorId === params.scope.employeeId;
    return monthOvertime(e.id, row.days, otEntries, otPolicy).lines.map((l) => {
      const day = row.days.find((d) => d.date === l.date);
      const can = overtimeActions(l, { ...actor, canApprove: canApprove || supervisor }, row.locked, today);
      return {
        ...l,
        key: `${l.employeeId}|${l.date}|${l.source}`,
        employeeName: e.fullName,
        employeeCode: e.employeeCode,
        branchId: e.branchId,
        firstIn: day?.firstIn ?? null,
        lastOut: day?.lastOut ?? null,
        workMinutes: day?.workMinutes ?? 0,
        shiftText: day?.shift ? `${day.shift.code} ${day.shift.start}–${day.shift.end}` : null,
        dayText: day?.rule ?? "",
        locked: row.locked,
        preparedByName: l.entry?.preparedBy ? names.get(l.entry.preparedBy) ?? "Unknown user" : null,
        decidedByName: l.entry?.decidedBy ? names.get(l.entry.decidedBy) ?? "Unknown user" : null,
        timeline: l.entry ? timelineOf(otTimeline, l.entry.id) : [],
        can,
      };
    });
  });

  const punches: PunchView[] = punchRows.map((p) => ({
    id: p.id,
    employeeId: p.employeeId,
    employeeName: person.get(p.employeeId)?.fullName ?? "",
    employeeCode: person.get(p.employeeId)?.employeeCode ?? "",
    punchedAt: p.punchedAt,
    kind: p.kind,
    source: p.source,
    ip: p.ip,
    latitude: p.latitude,
    longitude: p.longitude,
    note: plainNote(p.note),
    createdByName: p.createdBy ? names.get(p.createdBy) ?? null : null,
    voidedAt: p.voidedAt,
    voidReason: p.voidReason,
  }));

  // Month close: one row per branch in scope that has people this month.
  const finalised = period.calendar === "BS" ? (await repo.countFinalisedPayrollRuns(period.year, period.month)) > 0 : false;
  const branchIds = [...new Set(people.map((e) => e.branchId))];
  const months: BranchMonth[] = branchIds.map((b) => {
    const rows = register.filter((r) => r.employee.branchId === b);
    const p = periods.find((x) => x.branchId === b);
    return {
      branchId: b,
      branchName: branchName.get(b) ?? "",
      status: p?.status === "closed" ? "closed" : "open",
      employees: rows.length,
      unpaidDays: round2(rows.reduce((n, r) => n + r.summary.unpaidDays + r.summary.notEmployedDays, 0)),
      otHours: round2(rows.reduce((n, r) => n + (r.summary.otWorkDayMinutes + r.summary.otOffDayMinutes) / 60, 0)),
      missingPunchDays: rows.reduce((n, r) => n + r.summary.missingPunchDays, 0),
      pendingAdjustments: adjustments.filter((a) => a.status === "pending" && a.date >= period.start && a.date <= period.end && person.get(a.employeeId)?.branchId === b).length,
      waitingOvertime: overtime.filter((o) => o.branchId === b && (o.state === "waiting" || o.state === "changed")).length,
      closedBy: p?.closedBy ? names.get(p.closedBy) ?? null : null,
      closedAt: p?.closedAt ? p.closedAt.toISOString() : null,
      reopenReason: p?.reopenReason ?? null,
      payrollFinalised: finalised,
    };
  });

  // Shifts (all, archived included) with how many people work them today, and the roster for the month.
  const { shifts: defs, defaultId } = await shiftService.listShifts();
  const todayShifts = today >= period.start && today <= period.end ? ctx.shifts : await shiftService.loadShiftContext(ids, today, today);
  const peopleToday = new Map<string, number>();
  for (const e of people) {
    if (e.joiningDate > today || (e.terminationDate && e.terminationDate < today)) continue;
    const id = shiftService.shiftOn({ ...todayShifts, roster: new Map() }, e, today).shiftId;
    if (id) peopleToday.set(id, (peopleToday.get(id) ?? 0) + 1);
  }
  const shifts: ShiftView[] = defs.map((d) => ({
    ...d,
    people: peopleToday.get(d.id) ?? 0,
    summary: shiftSummary(d),
    weekMinutes: plannedWeekMinutes(d),
    warnings: shiftWarnings(d),
    branchNames: branches.filter((b) => ctx.shifts.branchDefaults.get(b.id) === d.id).map((b) => b.name),
  }));
  const roster: RosterRow[] =
    params.tab === "roster"
      ? people.map((e) => ({
          employee: view(e),
          days: dates.map((d) => {
            const s = shiftService.shiftOn(ctx.shifts, e, d);
            return { date: d, shiftId: s.shiftId, code: s.plan.code, off: s.plan.off, source: s.source, note: s.note };
          }),
          assignments: (ctx.shifts.assignments.get(e.id) ?? []).filter((a) => a.from <= period.end && (!a.to || a.to >= period.start)).map((a) => ({ shiftId: a.shiftId, from: a.from, to: a.to })),
          locked: closedBranches.has(e.branchId),
        }))
      : [];

  return {
    tab: params.tab,
    today,
    period: { calendar: period.calendar, year: period.year, month: period.month, start: period.start, end: period.end, days: period.days, label: period.label },
    rules,
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    branchId: params.branchId ?? "",
    register,
    todayRows,
    punches,
    adjustments,
    overtime,
    overtimePolicy: { approval: otPolicy.approval, rounding: otPolicy.rounding, roundingMode: otPolicy.roundingMode, workRate: otPolicy.workRate, offRate: otPolicy.offRate },
    months: months.sort((a, b) => a.branchName.localeCompare(b.branchName)),
    shifts,
    defaultShiftId: defaultId,
    roster,
    branchDefaults: Object.fromEntries(branches.map((b) => [b.id, ctx.shifts.branchDefaults.get(b.id) ?? null])),
    winterHours: params.tab === "shifts" ? await shiftService.winterSuggestion() : null,
    checkin: params.tab === "checkin" ? await checkinSettings(params.clientIp ?? "unknown") : null,
    currentUserId: params.userId,
    myEmployeeId: params.scope.employeeId,
    permissions: params.permissions,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The Check-in tab: each branch's rule and the allowed-anywhere list. */
async function checkinSettings(myIp: string): Promise<NonNullable<AttendancePageData["checkin"]>> {
  const [rows, people, exceptions] = await Promise.all([checkinRepo.findBranchCheckins(), checkinRepo.countActiveByBranch(), checkinRepo.findExceptions()]);
  return {
    branches: rows.map((b) => ({ branchId: b.id, branchName: b.name, rule: b.rule, networks: b.networks, latitude: b.latitude, longitude: b.longitude, radiusM: b.radiusM, people: people.get(b.id) ?? 0 })),
    exceptions,
    myIp,
  };
}

/**
 * One employee's days between two dates with the same rules as the register
 * (self-service clock card and My attendance). The caller has already
 * resolved the employee from the session.
 */
export async function ownDays(employeeId: string, from: string, to: string): Promise<{ employee: Employee; days: DayResult[] } | null> {
  const people = await repo.findEmployeesByIds([employeeId]);
  if (!people.length) return null;
  const ctx = await loadContext(people, from, to);
  return { employee: people[0], days: datesBetween(from, to).map((d) => resolveFor(ctx, people[0], d)) };
}

/**
 * One employee's overtime for some days (self-service My attendance, 4.7b):
 * each day's overtime and where it stands, with the same rules as the
 * Overtime tab. The caller has already resolved the employee from the session.
 */
export async function ownOvertime(employeeId: string, days: readonly DayResult[], from: string, to: string): Promise<{ lines: OvertimeLine[]; approval: OvertimePolicy["approval"] }> {
  const [entries, { policy }] = await Promise.all([overtimeRepo.findEntries({ employeeIds: [employeeId], from, to }), overtimeService.getPolicy()]);
  return { lines: monthOvertime(employeeId, days, entries, policy).lines, approval: policy.approval };
}

// ---------------------------------------------------------------------------
// Changing days: HR overrides, manual punches, voids
// ---------------------------------------------------------------------------

/** Checks the people are in scope, not the user (S21), and their days are in open months. */
async function guardDays(scope: ScopeFilter, cells: { employeeId: string; date: string }[]): Promise<Map<string, Employee>> {
  if (!cells.length) throw new UserFacingError("Nothing to change.");
  const from = cells.reduce((m, c) => (c.date < m ? c.date : m), cells[0].date);
  const to = cells.reduce((m, c) => (c.date > m ? c.date : m), cells[0].date);
  const people = await employeesFor(scope, from, to);
  const byId = new Map(people.map((e) => [e.id, e]));
  if (cells.some((c) => !byId.has(c.employeeId))) throw new OutOfScopeError();
  if (includesOwnRecord(scope.employeeId, cells.map((c) => c.employeeId))) throw new OwnAttendanceError();
  const closed = await repo.findClosedPeriodsOverlapping(from, to);
  const blocked = cells.find((c) => closed.some((p) => p.branchId === byId.get(c.employeeId)!.branchId && c.date >= String(p.startDate) && c.date <= String(p.endDate)));
  if (blocked) throw new UserFacingError(`${byId.get(blocked.employeeId)!.fullName}'s attendance for ${blocked.date} is in a closed month. Reopen the month first.`);
  if (cells.some((c) => c.date > nepalDateIso())) throw new UserFacingError("Attendance can't be set for a future date.");
  return byId;
}

const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Sets or clears HR overrides (register cells): one reason for the whole change. */
export async function setOverrides(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ count: number }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { cells?: unknown; reason?: unknown };
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 300) : "";
  if (reason.length < 3) throw new AttendanceValidationError({ reason: "Give a short reason" });
  const cells = (Array.isArray(r.cells) ? r.cells : []).slice(0, MAX_CELLS + 1).map((c) => {
    const x = (c && typeof c === "object" ? c : {}) as { employeeId?: unknown; date?: unknown; type?: unknown };
    const date = isoDate(x.date);
    const type = x.type === null ? null : (OVERRIDE_TYPES as readonly string[]).includes(String(x.type)) ? (x.type as OverrideType) : undefined;
    if (!date || typeof x.employeeId !== "string" || type === undefined) throw new UserFacingError("Some cells are not valid. Refresh and try again.");
    return { employeeId: x.employeeId, date, type };
  });
  if (cells.length > MAX_CELLS) throw new UserFacingError(`Change at most ${MAX_CELLS} days at a time.`);
  const unique = new Map(cells.map((c) => [`${c.employeeId}|${c.date}`, c]));
  const list = [...unique.values()];
  await guardDays(ctx.scope, list);
  const fy = new Map<string, string>();
  for (const c of list) if (!fy.has(c.date)) fy.set(c.date, await repo.fiscalYearFor(c.date));
  await repo.setOverrides(list.map((c) => ({ ...c, reason, fiscalYearId: fy.get(c.date)! })), ctx.userId);
  return { count: list.length };
}

/** Adds an HR punch pair or single punch for a day ("HH:MM"; an out before the in is the next morning). */
export async function addManualPunches(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ added: number }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { employeeId?: unknown; date?: unknown; in?: unknown; out?: unknown; note?: unknown };
  const date = isoDate(r.date);
  const employeeId = typeof r.employeeId === "string" ? r.employeeId : "";
  const inAt = typeof r.in === "string" && r.in ? clockMinutes(r.in) : null;
  const outAtRaw = typeof r.out === "string" && r.out ? clockMinutes(r.out) : null;
  const errors: Record<string, string> = {};
  if (!date) errors.date = "Choose the day";
  if (typeof r.in === "string" && r.in && inAt === null) errors.in = "Use a time like 09:58";
  if (typeof r.out === "string" && r.out && outAtRaw === null) errors.out = "Use a time like 18:05";
  if (inAt === null && outAtRaw === null && !errors.in && !errors.out) errors.in = "Give a check-in or check-out time";
  const note = typeof r.note === "string" ? r.note.trim().slice(0, 300) : "";
  if (note.length < 3) errors.note = "Say why it is entered by hand";
  if (Object.keys(errors).length) throw new AttendanceValidationError(errors);
  await guardDays(ctx.scope, [{ employeeId, date: date! }]);
  const outAt = outAtRaw !== null && inAt !== null && outAtRaw <= inAt ? outAtRaw + 1440 : outAtRaw;
  const rows: repo.NewPunch[] = [];
  if (inAt !== null) rows.push({ employeeId, punchedAt: instantAt(date!, inAt), kind: "in", source: "manual", note, createdBy: ctx.userId });
  if (outAt !== null) rows.push({ employeeId, punchedAt: instantAt(date!, outAt), kind: "out", source: "manual", note, createdBy: ctx.userId });
  return { added: await repo.insertPunches(rows) };
}

/** Voids a punch (kept in the log with who and why). */
export async function voidPunch(punchId: string, reasonRaw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ employeeId: string }> {
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim().slice(0, 300) : "";
  if (reason.length < 3) throw new AttendanceValidationError({ reason: "Give a short reason" });
  const p = await repo.findPunchById(punchId);
  if (!p) throw new UserFacingError("That punch no longer exists. Refresh the page.");
  const day = new Date(p.punchedAt.getTime() + 345 * 60000).toISOString().slice(0, 10);
  await guardDays(ctx.scope, [{ employeeId: p.employeeId, date: day }]);
  if (!(await repo.voidPunch(punchId, ctx.userId, reason))) throw new UserFacingError("That punch was already voided.");
  return { employeeId: p.employeeId };
}

// ---------------------------------------------------------------------------
// Adjustments (regularization)
// ---------------------------------------------------------------------------

/**
 * Raises an adjustment for an employee-day (HR on someone's behalf now;
 * from self-service later). It waits for the employee's supervisor or
 * someone with Attendance → Approve; never the employee themselves.
 */
export async function createAdjustment(raw: unknown, ctx: { scope: ScopeFilter; userId: string; source?: "hr" | "self_service" }): Promise<{ id: string; employeeId: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const employeeId = typeof r.employeeId === "string" ? r.employeeId : "";
  const date = isoDate(r.date);
  const kind = (ADJUSTMENT_KINDS as readonly string[]).includes(String(r.kind)) ? (r.kind as AdjustmentKind) : null;
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 500) : "";
  const inMin = typeof r.in === "string" && r.in ? clockMinutes(r.in) : null;
  const outMinRaw = typeof r.out === "string" && r.out ? clockMinutes(r.out) : null;
  if (!employeeId) errors.employeeId = "Choose the employee";
  if (!date) errors.date = "Choose the day";
  if (!kind) errors.kind = "Choose what to correct";
  if (reason.length < 3) errors.reason = "Give a short reason";
  if ((kind === "missed_in" || kind === "wrong_time") && inMin === null) errors.in = "Give the check-in time";
  if ((kind === "missed_out" || kind === "wrong_time") && outMinRaw === null) errors.out = "Give the check-out time";
  if (Object.keys(errors).length) throw new AttendanceValidationError(errors);
  // Raising one for yourself is fine (it waits for someone else); the S21 check here is scope and an open month.
  const people = await employeesFor(ctx.scope, date!, date!);
  if (!people.some((e) => e.id === employeeId) && !isOwnRecord(ctx.scope.employeeId, employeeId)) throw new OutOfScopeError();
  const closed = await repo.findClosedPeriodsOverlapping(date!, date!);
  const branch = people.find((e) => e.id === employeeId)?.branchId;
  if (closed.some((p) => p.branchId === branch)) throw new UserFacingError("That day is in a closed month. Reopen the month first.");
  if (date! > nepalDateIso()) throw new UserFacingError("Attendance can't be adjusted for a future date.");
  const pending = (await repo.findAdjustments({ employeeIds: [employeeId], from: date!, to: date!, status: "pending" })).filter((a) => !(REMOTE_KINDS as readonly string[]).includes(a.kind));
  if (pending.length) throw new UserFacingError("An adjustment for that day is already waiting. Decide or withdraw it first.");
  const outMin = outMinRaw !== null && inMin !== null && outMinRaw <= inMin ? outMinRaw + 1440 : outMinRaw;
  const id = await repo.createAdjustment({
    employeeId,
    date: date!,
    kind: kind!,
    requestedIn: inMin !== null ? instantAt(date!, inMin) : null,
    requestedOut: outMin !== null ? instantAt(date!, outMin) : null,
    reason,
    source: ctx.source ?? "hr",
    preparedBy: ctx.userId,
  });
  return { id, employeeId };
}

/**
 * Approve, Final approve (company administrator), reject (reason) or
 * withdraw (preparer) an adjustment. Approvers: the employee's supervisor
 * or someone with Attendance → Approve in scope; never the employee (S21).
 * Approving adds its punches (or the On duty / Present override).
 */
export async function decideAdjustment(id: string, decision: Decision, noteRaw: unknown, ctx: { scope: ScopeFilter; userId: string; canApprove: boolean }): Promise<{ employeeId: string; status: string }> {
  const a = await repo.findAdjustmentById(id);
  if (!a) throw new UserFacingError("That adjustment no longer exists. Refresh the page.");
  const date = String(a.attendanceDate).slice(0, 10);
  const all = await repo.findEmployees();
  const e = all.find((x) => x.id === a.employeeId);
  if (!e) throw new UserFacingError("That employee no longer exists.");
  const inScope = (await employeesFor(ctx.scope, date, date)).some((x) => x.id === e.id);
  const supervisor = !!ctx.scope.employeeId && e.supervisorId === ctx.scope.employeeId;
  if (!inScope && !supervisor && a.preparedBy !== ctx.userId) throw new OutOfScopeError();
  const request = { status: a.status as "pending" | "approved" | "rejected" | "withdrawn", preparedById: a.preparedBy, subjectEmployeeIds: [a.employeeId], flow: { type: "simple" as const, levels: [] }, currentLevel: 0 };
  const actor = { userId: ctx.userId, employeeId: ctx.scope.employeeId, canApprove: (ctx.canApprove && inScope) || supervisor, isAdministrator: isCompanyAdministrator(ctx.scope, ctx.canApprove) };
  const can = availableActions(request, actor, { approvers: [], today: nepalDateIso(), wording: WORDING });
  const own = isOwnRecord(ctx.scope.employeeId, a.employeeId);
  const refuse = (msg: string | null, fallback: string) => {
    if (own && decision !== "withdraw") throw new OwnAttendanceError(WORDING.ownSubject);
    throw new UserFacingError(msg ?? fallback);
  };
  if (decision === "approve" && !can.approve) refuse(can.reason, "You cannot approve this adjustment.");
  if (decision === "final_approve" && !can.finalApprove) refuse(can.reason, "Only a company administrator can Final approve.");
  if (decision === "reject" && !can.reject) refuse(a.preparedBy === ctx.userId ? "You raised this adjustment: withdraw it instead." : can.reason, "You cannot reject this adjustment.");
  if (decision === "withdraw" && !can.withdraw) throw new UserFacingError("Only the person who raised it can withdraw it, while it waits.");
  const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, 300) || null : null;
  if (decision === "reject" && (!note || note.length < 3)) throw new AttendanceValidationError({ note: "Give a reason for rejecting" });
  const next = applyDecision(request, decision);
  if (next.status === "approved") {
    const closed = await repo.findClosedPeriodsOverlapping(date, date);
    if (closed.some((p) => p.branchId === e.branchId)) throw new UserFacingError("That day is now in a closed month. Reopen the month first.");
  }
  // Approval: on duty / mark present become an override; times become punches.
  const punches: repo.NewPunch[] = [];
  if (next.status === "approved") {
    if (a.kind === "on_duty" || a.kind === "mark_present") {
      await repo.setOverrides([{ employeeId: a.employeeId, date, type: a.kind === "on_duty" ? "on_duty" : "present", reason: `Adjustment approved: ${a.reason}`, fiscalYearId: await repo.fiscalYearFor(date) }], ctx.userId);
    }
    // A remote clock-in becomes the web punch it was, with where it was made.
    const remote = a.kind === "remote_in" || a.kind === "remote_out";
    const place = remote
      ? { source: "web" as const, ip: a.ip, latitude: a.latitude === null ? null : Number(a.latitude), longitude: a.longitude === null ? null : Number(a.longitude), accuracyM: a.accuracyM, note: `Outside the office, approved: ${a.reason}` }
      : { source: "adjustment" as const, note: a.reason };
    if (a.requestedIn) punches.push({ employeeId: a.employeeId, punchedAt: a.requestedIn.toISOString(), kind: "in", createdBy: ctx.userId, ...place });
    if (a.requestedOut) punches.push({ employeeId: a.employeeId, punchedAt: a.requestedOut.toISOString(), kind: "out", createdBy: ctx.userId, ...place });
  }
  const ok = await repo.decideAdjustment({
    id,
    status: next.status === "pending" ? "approved" : next.status,
    route: next.route,
    actorId: ctx.userId,
    onBehalfOf: null,
    action: decision === "approve" ? "approved" : decision === "final_approve" ? "final_approved" : decision === "reject" ? "rejected" : "withdrawn",
    note,
    punches,
  });
  if (!ok) throw new UserFacingError("Someone else acted on this adjustment a moment ago. Refresh the page.");
  return { employeeId: a.employeeId, status: next.status };
}

// ---------------------------------------------------------------------------
// Overtime (4.7b): decisions and overtime added by hand
// ---------------------------------------------------------------------------

/** What this person may do with an overtime day (the Overtime tab's buttons; the server checks again). */
function overtimeActions(
  line: OvertimeLine,
  actor: { userId: string; employeeId: string | null; canApprove: boolean; isAdministrator: boolean },
  locked: boolean,
  today: string
): OvertimeDayView["can"] {
  const none = { approve: false, finalApprove: false, reject: false, withdraw: false };
  if (locked) return { ...none, reason: "The month is closed for this branch." };
  const manual = line.source === "manual" && line.entry;
  if (!decidable(line)) return { ...none, reason: null };
  const can = availableActions(
    { status: "pending", preparedById: manual ? line.entry!.preparedBy : null, subjectEmployeeIds: [line.employeeId], flow: { type: "simple", levels: [] }, currentLevel: 0 },
    actor,
    { approvers: [], today, wording: OT_WORDING }
  );
  return { approve: !!can.approve, finalApprove: can.finalApprove && !can.approve, reject: can.reject, withdraw: !!manual && can.withdraw, reason: can.reason };
}

/** One employee's overtime for the month containing a day (the same lines as the Overtime tab). */
async function overtimeMonthOf(e: Employee, date: string) {
  const rules = await getRules();
  const period = periodContaining(rules.calendar, date);
  const [c, entries, { policy }] = await Promise.all([
    loadContext([e], period.start, period.end, rules),
    overtimeRepo.findEntries({ employeeIds: [e.id], from: period.start, to: period.end }),
    overtimeService.getPolicy(),
  ]);
  const days = datesIn(period).map((d) => resolveFor(c, e, d));
  return { days, ot: monthOvertime(e.id, days, entries, policy), eligible: c.ot.get(e.category) ?? true };
}

/**
 * Approve (all or part), Final approve, reject or withdraw one overtime day,
 * sent as `employeeId|date|source`. Approvers: the employee's supervisor or
 * someone with Attendance → Approve in scope; company administrators Final
 * approve; never the employee themselves (S21) or the person who added it.
 * Days over the legal limits need a reason to approve; closed months are refused.
 */
export async function decideOvertime(key: string, decision: Decision, raw: unknown, ctx: { scope: ScopeFilter; userId: string; canApprove: boolean }): Promise<{ employeeId: string; date: string; status: string; minutes: number }> {
  const [employeeId = "", dateRaw = "", source = ""] = String(key).split("|");
  const date = isoDate(dateRaw);
  if (!employeeId || !date || (source !== "detected" && source !== "manual")) throw new UserFacingError("That overtime day is not valid. Refresh the page.");
  const r = (raw && typeof raw === "object" ? raw : {}) as { minutes?: unknown; note?: unknown };
  const [e] = await repo.findEmployeesByIds([employeeId]);
  if (!e) throw new UserFacingError("That employee no longer exists.");
  const { ot } = await overtimeMonthOf(e, date);
  const line = ot.lines.find((l) => l.date === date && l.source === source);
  if (!line) throw new UserFacingError("There is no overtime on that day any more. Refresh the page.");
  const inScope = (await employeesFor(ctx.scope, date, date)).some((x) => x.id === e.id);
  const supervisor = !!ctx.scope.employeeId && e.supervisorId === ctx.scope.employeeId;
  const preparer = source === "manual" && line.entry?.preparedBy === ctx.userId;
  if (!inScope && !supervisor && !preparer) throw new OutOfScopeError();
  const closed = await repo.findClosedPeriodsOverlapping(date, date);
  if (closed.some((p) => p.branchId === e.branchId)) throw new UserFacingError("That day is in a closed month. Reopen the month first.");
  if (!decidable(line)) throw new UserFacingError(decision === "withdraw" ? "Only overtime that is still waiting can be withdrawn." : "This overtime was already decided.");
  if (decision === "withdraw" && source !== "manual") throw new UserFacingError("Only overtime added by hand can be withdrawn.");

  const request = { status: "pending" as const, preparedById: source === "manual" ? line.entry?.preparedBy ?? null : null, subjectEmployeeIds: [e.id], flow: { type: "simple" as const, levels: [] }, currentLevel: 0 };
  const actor = { userId: ctx.userId, employeeId: ctx.scope.employeeId, canApprove: (ctx.canApprove && inScope) || supervisor, isAdministrator: isCompanyAdministrator(ctx.scope, ctx.canApprove) };
  const can = availableActions(request, actor, { approvers: [], today: nepalDateIso(), wording: OT_WORDING });
  const own = isOwnRecord(ctx.scope.employeeId, e.id);
  const refuse = (msg: string | null, fallback: string) => {
    if (own && decision !== "withdraw") throw new OwnAttendanceError(OT_WORDING.ownSubject);
    throw new UserFacingError(msg ?? fallback);
  };
  if (decision === "approve" && !can.approve) refuse(can.reason, "You cannot approve this overtime.");
  if (decision === "final_approve" && !can.finalApprove) refuse(can.reason, "Only a company administrator can Final approve.");
  if (decision === "reject" && !can.reject) refuse(preparer ? "You added this overtime: withdraw it instead." : can.reason, "You cannot reject this overtime.");
  if (decision === "withdraw" && !can.withdraw) throw new UserFacingError("Only the person who added it can withdraw it, while it waits.");

  const note = typeof r.note === "string" ? r.note.trim().slice(0, 300) || null : null;
  const approving = decision === "approve" || decision === "final_approve";
  if (decision === "reject" && (!note || note.length < 3)) throw new AttendanceValidationError({ note: "Give a reason for rejecting" });
  if (approving && line.overLimit && (!note || note.length < 3)) throw new AttendanceValidationError({ note: `${line.limitText ?? "Over the legal limit"}: say why it is approved` });
  let minutes = line.minutes;
  if (approving && r.minutes !== undefined && r.minutes !== null && r.minutes !== "") {
    const m = Number(r.minutes);
    if (!Number.isInteger(m) || m < 1 || m > line.minutes) throw new AttendanceValidationError({ minutes: `Between 1 and ${line.minutes} minutes` });
    minutes = m;
  }
  const next = applyDecision(request, decision);
  const status = next.status === "pending" ? "approved" : next.status;
  const decided = {
    status,
    approvedMinutes: status === "approved" ? minutes : 0,
    overLimit: line.overLimit,
    route: next.route,
    actorId: ctx.userId,
    action: (decision === "approve" ? "approved" : decision === "final_approve" ? "final_approved" : decision === "reject" ? "rejected" : "withdrawn") as "approved" | "final_approved" | "rejected" | "withdrawn",
    note,
  };
  const ok =
    source === "manual"
      ? await overtimeRepo.decideManual({ ...decided, id: line.entry!.id })
      : await overtimeRepo.decideDetected({ ...decided, employeeId: e.id, date, dayKind: line.kind, detectedMinutes: line.minutes, previous: line.entry });
  if (!ok) throw new UserFacingError("Someone else decided this overtime a moment ago. Refresh the page.");
  return { employeeId: e.id, date, status, minutes: decided.approvedMinutes };
}

/**
 * Overtime added by hand (worked without punches): the day, the minutes and
 * why. It waits for the employee's supervisor or an attendance approver.
 * Never for yourself (S21), out of scope, in a closed month or in the future.
 */
export async function addOvertime(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ id: string; employeeId: string; date: string; minutes: number }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const employeeId = typeof r.employeeId === "string" ? r.employeeId : "";
  const date = isoDate(r.date);
  const minutes = Number(r.minutes);
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 500) : "";
  if (!employeeId) errors.employeeId = "Choose the employee";
  if (!date) errors.date = "Choose the day";
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > OT_MAX_ENTRY_MINUTES) errors.minutes = `Between 1 minute and ${OT_MAX_ENTRY_MINUTES / 60} hours`;
  if (reason.length < 3) errors.reason = "Say what the overtime was for";
  if (Object.keys(errors).length) throw new AttendanceValidationError(errors);
  const people = await guardDays(ctx.scope, [{ employeeId, date: date! }]);
  const e = people.get(employeeId)!;
  const { days, eligible } = await overtimeMonthOf(e, date!);
  if (!eligible) throw new UserFacingError(`${e.fullName}'s employment type does not get overtime (Organization → Employment types).`);
  const day = days.find((d) => d.date === date);
  if (!day || day.dayType === "not_employed") throw new UserFacingError(`${e.fullName} was not employed on that day.`);
  const id = await overtimeRepo.createManual({ employeeId, date: date!, dayKind: day.dayType === "weekly_off" || day.dayType === "holiday" ? "off" : "work", minutes, reason, preparedBy: ctx.userId });
  if (!id) throw new UserFacingError("Overtime added by hand for that day is already waiting or approved. Decide or withdraw it first.");
  return { id, employeeId, date: date!, minutes };
}

/** Overtime days waiting for a decision in a BS month, per employee (payroll pre-flight, 4.8a). */
export async function overtimeWaitingFor(employeeIds: string[], bsYear: number, bsMonth: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!employeeIds.length) return out;
  const rules = await getRules();
  const period = periodFor("BS", bsYear, bsMonth);
  const people = await repo.findEmployeesByIds(employeeIds);
  const [c, entries, { policy }] = await Promise.all([loadContext(people, period.start, period.end, rules), overtimeRepo.findEntries({ employeeIds, from: period.start, to: period.end }), overtimeService.getPolicy()]);
  for (const e of people) {
    const days = datesIn(period).map((d) => resolveFor(c, e, d));
    const waiting = monthOvertime(e.id, days, entries, policy).waiting;
    if (waiting) out.set(e.id, waiting);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Month close and reopen (per branch)
// ---------------------------------------------------------------------------

/**
 * Adjustments (and remote clock-ins) this user can decide now: their
 * supervisees', or anyone's in scope with Attendance → Approve; never their
 * own or ones they raised (the title bar's waiting count).
 */
export async function countAdjustmentsWaitingFor(scope: ScopeFilter, canApprove: boolean): Promise<number> {
  const pending = await repo.findAdjustments({ status: "pending" });
  if (!pending.length) return 0;
  const [inScope, people] = await Promise.all([
    canApprove ? repo.findEmployees(buildEmployeeScopeCondition(scope)) : Promise.resolve([]),
    repo.findEmployeesByIds([...new Set(pending.map((a) => a.employeeId))]),
  ]);
  const scoped = new Set(inScope.map((e) => e.id));
  const supervisor = new Map(people.map((e) => [e.id, e.supervisorId]));
  return pending.filter(
    (a) =>
      a.employeeId !== scope.employeeId &&
      a.preparedBy !== scope.userId &&
      (scoped.has(a.employeeId) || (!!scope.employeeId && supervisor.get(a.employeeId) === scope.employeeId))
  ).length;
}

/**
 * Overtime pay and the unpaid-day deduction for a month (4.7): the overtime
 * the policy lets through (approved, or detected when approval is automatic;
 * 4.7b), each day rounded, paid at (basic + grade) ÷ 240 × the policy's rate
 * for that kind of day (overtime.engine.ts).
 */
function amountsFor(employeeId: string, summary: MonthSummary, days: readonly DayResult[], entries: readonly OvertimeEntry[], salary: { basic: number; grade: number } | undefined, policy: OvertimePolicy) {
  const ot = monthOvertime(employeeId, days, entries, policy);
  const detail = otDetail(ot.paid, salary, policy);
  return {
    otEarnedAmount: detail.amount,
    otDetail: detail,
    otMinutes: ot.paid,
    otWaiting: ot.waiting,
    leaveDeductionAmount: salary ? unpaidDeduction(salary.basic + salary.grade, summary) : 0,
  };
}

async function payInputs(employeeIds: string[], period: { start: string; end: string }) {
  const [salaries, { policy }, entries] = await Promise.all([
    salaryMappingRepository.findInForceByEmployeeIds(employeeIds, period.end),
    overtimeService.getPolicy(),
    overtimeRepo.findEntries({ employeeIds, from: period.start, to: period.end }),
  ]);
  const salary = new Map([...salaries].map(([id, m]) => [id, { basic: Number(m.basicSalary) || 0, grade: Number(m.gradeAmount) || 0 }]));
  return { salary, policy, entries };
}

/** BS month number of a period (summaries keep it for today's payroll reads). */
const bsMonthOf = (p: PayPeriod) => (p.calendar === "BS" ? p.month : periodContaining("BS", p.start).month);

/**
 * Closes a month for branches: every day resolved and stored, summaries
 * written and locked. Refused while adjustments wait, for branches outside
 * the user's scope, or when nothing is open.
 */
export async function closeMonth(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ branches: number; employees: number; homeLeaveDays: number; homeLeavePeople: number }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { year?: unknown; month?: unknown; branchIds?: unknown };
  const rules = await getRules();
  let period: PayPeriod;
  try {
    period = periodFor(rules.calendar, Number(r.year), Number(r.month));
  } catch {
    throw new UserFacingError("Choose a month to close.");
  }
  // Every day must have happened: a month is closed after its last day.
  if (period.end >= nepalDateIso()) throw new UserFacingError(`${period.label} can be closed after its last day.`);
  const branchIds = Array.isArray(r.branchIds) ? [...new Set(r.branchIds.filter((x): x is string => typeof x === "string"))] : [];
  if (!branchIds.length) throw new UserFacingError("Choose at least one branch.");
  if (ctx.scope.scopeType === "DEPARTMENT" || ctx.scope.scopeType === "SELF") throw new UserFacingError("Closing a month needs a company-wide or branch role.");
  if (ctx.scope.scopeType === "BRANCH" && branchIds.some((b) => !ctx.scope.branchIds.includes(b))) throw new OutOfScopeError();
  const existing = await repo.findPeriods(period.calendar, period.year, period.month);
  const allPeople = await employeesFor({ ...ctx.scope, scopeType: ctx.scope.scopeType === "BRANCH" ? "BRANCH" : "GLOBAL" }, period.start, period.end);
  const pay = await payInputs(allPeople.map((e) => e.id), period);
  let employeesClosed = 0;
  let homeLeaveDays = 0;
  const homeLeavePeople = new Set<string>();
  for (const branchId of branchIds) {
    if (existing.some((p) => p.branchId === branchId && p.status === "closed")) throw new UserFacingError("That month is already closed for a branch you chose. Refresh the page.");
    const people = allPeople.filter((e) => e.branchId === branchId);
    const waiting = await repo.countPendingAdjustments(people.map((e) => e.id), period.start, period.end);
    if (waiting) throw new UserFacingError(`${waiting} adjustment${waiting === 1 ? " is" : "s are"} still waiting for this month. Decide them first.`);
    const c = await loadContext(people, period.start, period.end, rules);
    const fyStart = await repo.fiscalYearFor(period.start);
    const fyEnd = await repo.fiscalYearFor(period.end);
    const days: { employeeId: string; fiscalYearId: string; result: DayResult }[] = [];
    const summaries: repo.SummaryWrite[] = [];
    let otWaiting = 0;
    for (const e of people) {
      const results = datesIn(period).map((d) => resolveFor(c, e, d));
      for (const res of results) days.push({ employeeId: e.id, fiscalYearId: res.date < period.end && fyStart !== fyEnd ? await repo.fiscalYearFor(res.date) : fyEnd, result: res });
      const summary = summariseMonth(period, results, rules);
      const a = amountsFor(e.id, summary, results, pay.entries, pay.salary.get(e.id), pay.policy);
      otWaiting += a.otWaiting;
      summaries.push({ employeeId: e.id, fiscalYearId: fyEnd, bsMonth: bsMonthOf(period), summary, otEarnedAmount: a.otEarnedAmount, otDetail: a.otDetail, otMinutes: a.otMinutes, leaveDeductionAmount: a.leaveDeductionAmount });
    }
    // 4.7b: overtime is paid as decided, so every overtime day waiting for a decision is decided first.
    if (otWaiting) throw new UserFacingError(`${otWaiting} overtime day${otWaiting === 1 ? " is" : "s are"} still waiting for a decision this month. Decide ${otWaiting === 1 ? "it" : "them"} on the Overtime tab first.`);
    // Home leave earned (paid days ÷ 20) and expired substitute days go with the close, in the same transaction (4.6b).
    const ledger = await monthCloseLines({
      period: { calendar: period.calendar, year: period.year, month: period.month, label: period.label, end: period.end },
      fiscalYearId: fyEnd,
      paidDays: summaries.map((x) => ({ employeeId: x.employeeId, days: x.summary.payableDays })),
      userId: ctx.userId,
    });
    await repo.closePeriod({ period: { calendar: period.calendar, year: period.year, month: period.month, start: period.start, end: period.end, days: period.days }, branchId, userId: ctx.userId, days, summaries, ledger });
    employeesClosed += people.length;
    for (const l of ledger.filter((x) => x.kind === "accrual")) {
      homeLeaveDays += l.days;
      homeLeavePeople.add(l.employeeId);
    }
  }
  return { branches: branchIds.length, employees: employeesClosed, homeLeaveDays: Math.round(homeLeaveDays * 100) / 100, homeLeavePeople: homeLeavePeople.size };
}

/** Reopens a branch month (reason required); refused once that month's payroll is approved or locked. */
export async function reopenMonth(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ branchId: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { year?: unknown; month?: unknown; branchId?: unknown; reason?: unknown };
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 300) : "";
  if (reason.length < 3) throw new AttendanceValidationError({ reason: "Give a reason for reopening" });
  const rules = await getRules();
  let period: PayPeriod;
  try {
    period = periodFor(rules.calendar, Number(r.year), Number(r.month));
  } catch {
    throw new UserFacingError("Choose a month.");
  }
  const branchId = typeof r.branchId === "string" ? r.branchId : "";
  if (ctx.scope.scopeType === "DEPARTMENT" || ctx.scope.scopeType === "SELF") throw new UserFacingError("Reopening a month needs a company-wide or branch role.");
  if (ctx.scope.scopeType === "BRANCH" && !ctx.scope.branchIds.includes(branchId)) throw new OutOfScopeError();
  if (period.calendar === "BS" && (await repo.countFinalisedPayrollRuns(period.year, period.month)) > 0) {
    throw new UserFacingError("Payroll for this month is already approved or locked, so its attendance can't be reopened. Corrections will be paid as arrears once the payroll run supports them.");
  }
  const p = (await repo.findPeriods(period.calendar, period.year, period.month)).find((x) => x.branchId === branchId);
  if (!p || p.status !== "closed") throw new UserFacingError("That month is not closed for this branch.");
  const people = (await repo.findEmployees()).filter((e) => e.branchId === branchId);
  // The month's home leave is taken back with the reopen; closing again posts it afresh (4.6b).
  const ledger = await monthReopenLines({ period: { calendar: period.calendar, year: period.year, month: period.month, label: period.label, end: period.end }, employeeIds: people.map((e) => e.id), reason, userId: ctx.userId });
  const ok = await repo.reopenPeriod({ periodId: p.id, employeeIds: people.map((e) => e.id), start: period.start, end: period.end, calendar: period.calendar, year: period.year, month: period.month, userId: ctx.userId, reason, ledger });
  if (!ok) throw new UserFacingError("Someone else reopened it a moment ago. Refresh the page.");
  return { branchId };
}

// ---------------------------------------------------------------------------
// Attendance report (Reports → Attendance): the same rules, within scope
// ---------------------------------------------------------------------------

export interface ReportPerson {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentId: string;
  designationId: string;
  branchId: string;
  days: DayResult[];
  summary: MonthSummary;
  amounts: PayrollAttendance;
}

/** A BS month for the attendance report: every person in scope, their days, summary and pay effect. */
export async function reportMonth(scope: ScopeFilter, bsYear: number, bsMonth: number, filter: { branchId?: string; departmentId?: string; designationId?: string; employeeId?: string }): Promise<{ period: PayPeriod; people: ReportPerson[] }> {
  const rules = await getRules();
  const period = periodFor("BS", bsYear, bsMonth);
  const people = (await employeesFor(scope, period.start, period.end, { branchId: filter.branchId, departmentId: filter.departmentId })).filter(
    (e) => (!filter.designationId || e.designationId === filter.designationId) && (!filter.employeeId || e.id === filter.employeeId)
  );
  const ctx = await loadContext(people, period.start, period.end, rules);
  const amounts = await attendanceForPayroll(people.map((e) => e.id), { bsYear, bsMonth, start: period.start, end: period.end });
  const today = nepalDateIso();
  return {
    period,
    people: people.map((e) => {
      const days = datesIn(period).map((d) => resolveFor(ctx, e, d));
      // Days after today are not counted yet.
      const summary = summariseMonth(period, days.filter((d) => d.date <= today), rules);
      return { id: e.id, employeeCode: e.employeeCode, fullName: e.fullName, departmentId: e.departmentId, designationId: e.designationId, branchId: e.branchId, days, summary, amounts: amounts.get(e.id)! };
    }),
  };
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

export interface PayrollAttendance {
  leaveDeductionAmount: string;
  otEarnedAmount: string;
  /** How the overtime amount was worked out (null: a month closed before 4.7b). */
  otDetail: OvertimeDetail | null;
  unpaidDays: number;
  /** From a closed month (true) or worked out now without saving (false). */
  closed: boolean;
  otWarnings: string | null;
}

/**
 * Attendance figures for a payroll month: the closed summary when the
 * month is closed, otherwise worked out now from the same rules (nothing is
 * written, nothing is unlocked).
 */
export async function attendanceForPayroll(employeeIds: string[], run: { bsYear: number; bsMonth: number; start: string; end: string }): Promise<Map<string, PayrollAttendance>> {
  const out = new Map<string, PayrollAttendance>();
  if (!employeeIds.length) return out;
  const closed = await repo.findClosedSummaries(employeeIds, "BS", run.bsYear, run.bsMonth);
  for (const s of closed) {
    out.set(s.employeeId, {
      leaveDeductionAmount: String(s.leaveDeductionAmount ?? "0"),
      otEarnedAmount: String(s.otEarnedAmount ?? "0"),
      otDetail: s.otDetail ?? null,
      unpaidDays: (Number(s.unpaidDays) || 0) + (Number(s.notEmployedDays) || 0),
      closed: true,
      otWarnings: s.otWarnings,
    });
  }
  const open = employeeIds.filter((id) => !out.has(id));
  if (!open.length) return out;
  const rules = await getRules();
  let period: PayPeriod;
  try {
    period = periodFor("BS", run.bsYear, run.bsMonth);
  } catch {
    period = { calendar: "BS", year: run.bsYear, month: run.bsMonth, start: run.start, end: run.end, days: datesBetween(run.start, run.end).length, label: "" };
  }
  const people = (await repo.findEmployees()).filter((e) => open.includes(e.id));
  const c = await loadContext(people, period.start, period.end, rules);
  const pay = await payInputs(people.map((e) => e.id), period);
  for (const e of people) {
    const days = datesIn(period).map((d) => resolveFor(c, e, d));
    const summary = summariseMonth(period, days, rules);
    const a = amountsFor(e.id, summary, days, pay.entries, pay.salary.get(e.id), pay.policy);
    // Overtime waiting for a decision is not paid yet: say so on the payslip.
    const waiting = a.otWaiting ? [`${a.otWaiting} overtime day${a.otWaiting === 1 ? "" : "s"} waiting for a decision (not paid yet)`] : [];
    out.set(e.id, {
      leaveDeductionAmount: String(a.leaveDeductionAmount),
      otEarnedAmount: String(a.otEarnedAmount),
      otDetail: a.otDetail,
      unpaidDays: summary.unpaidDays + summary.notEmployedDays,
      closed: false,
      otWarnings: [...summary.otWarnings, ...waiting].join("\n") || null,
    });
  }
  return out;
}

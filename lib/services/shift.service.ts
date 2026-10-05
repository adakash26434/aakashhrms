import * as repo from "@/lib/repositories/shift.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import { getCompanyWorkSchedule, saveCompanyWorkSchedule } from "@/lib/repositories/company-setup.repository";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { includesOwnRecord } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { AttendanceValidationError, OutOfScopeError, OwnAttendanceError } from "@/lib/services/attendance-errors";
import { addDays, WEEKDAYS } from "@/lib/engines/pay-period.engine";
import { clockMinutes, DEFAULT_SHIFT } from "@/lib/engines/attendance-day.engine";
import { MAX_ROTATION_DAYS, parseShift, plannedMinutes, rotate, shiftForDay, shiftWarnings, weekFromOffs, weeklyOffOf, type ShiftInput } from "@/lib/engines/shift.engine";
import type { ShiftDefinition, ShiftRule, ShiftSource } from "@/lib/types/attendance";

// Shifts (4.5b): company-wide roles define shifts (the actions check that);
// people in scope get them by dated assignment, by day on the roster, or
// through their branch's or the company's default. Nobody changes their own
// shift (it decides their late and overtime: S21), and days in closed
// months don't change.

export const MAX_PEOPLE = 500;
export const MAX_ROSTER_CELLS = 6000;

// ---------------------------------------------------------------------------
// The default shift
// ---------------------------------------------------------------------------

/**
 * Creates the General shift once, from Company setup's work schedule (office
 * time, break, grace, half day, weekly offs) and the attendance rules saved
 * in 4.5a (full day, OT minimum), so nothing changes until shifts are added.
 */
export async function ensureDefaultShift(): Promise<void> {
  if ((await repo.countShifts()) > 0) return;
  const [ws, storedRaw] = await Promise.all([getCompanyWorkSchedule(), attendanceRepo.getRulesJson()]);
  const stored = (storedRaw && typeof storedRaw === "object" ? storedRaw : {}) as { fullDayMinutes?: unknown; otMinimumMinutes?: unknown };
  const start = clockMinutes(ws.coreStartTime) !== null ? ws.coreStartTime.padStart(5, "0") : DEFAULT_SHIFT.start;
  const end = clockMinutes(ws.coreEndTime) !== null ? ws.coreEndTime.padStart(5, "0") : DEFAULT_SHIFT.end;
  const breakMinutes = Number.isFinite(ws.lunchBreakMinutes) ? Math.max(0, Math.min(180, Math.round(ws.lunchBreakMinutes))) : 30;
  const halfDayMinutes = Math.max(30, Math.round((ws.halfDayThresholdHours || 4) * 60));
  const planned = plannedMinutes(start, end, breakMinutes);
  const full = Number(stored.fullDayMinutes);
  const otMin = Number(stored.otMinimumMinutes);
  await repo.createDefaultShift({
    code: "GEN",
    name: "General",
    color: "green",
    kind: "fixed",
    start,
    end,
    breakMinutes,
    graceMinutes: Math.max(0, Math.min(120, Math.round(ws.gracePeriodMinutes ?? 15))),
    fullDayMinutes: Number.isFinite(full) && full >= halfDayMinutes ? Math.round(full) : Math.max(halfDayMinutes, planned - 60),
    halfDayMinutes,
    otMinimumMinutes: Number.isFinite(otMin) && otMin >= 0 ? Math.round(otMin) : 30,
    week: weekFromOffs(ws.weeklyOffDays ?? []),
    seasons: [],
  });
}

/** Every shift (the General shift is created on first read). */
export async function listShifts(): Promise<{ shifts: ShiftDefinition[]; defaultId: string | null }> {
  await ensureDefaultShift();
  const shifts = await repo.findShifts();
  return { shifts, defaultId: shifts.find((s) => s.isDefault)?.id ?? null };
}

/**
 * Company setup → Work schedule shows the default shift (one source): its
 * hours, break, grace, half day, weekly offs and winter season are copied
 * there whenever the default shift changes.
 */
async function syncWorkSchedule(): Promise<void> {
  const shifts = await repo.findShifts();
  const d = shifts.find((s) => s.isDefault);
  if (!d) return;
  const ws = await getCompanyWorkSchedule();
  const offs = WEEKDAYS.filter((_, i) => !d.week[i]?.working);
  const winter = d.seasons.find((x) => /winter/i.test(x.name));
  await saveCompanyWorkSchedule({
    ...ws,
    coreStartTime: d.start,
    coreEndTime: d.end,
    lunchBreakMinutes: d.breakMinutes,
    gracePeriodMinutes: d.graceMinutes,
    halfDayThresholdHours: Math.round((d.halfDayMinutes / 60) * 100) / 100,
    weeklyOffDays: [...offs],
    workingDaysPerWeek: 7 - offs.length,
    ...(winter ? { winterStartTime: winter.start, winterEndTime: winter.end } : {}),
  });
}

/** Company setup's winter time (saved there, never used before 4.5b): offered as a season in the shift window. */
export async function winterSuggestion(): Promise<{ start: string; end: string }> {
  const ws = await getCompanyWorkSchedule();
  return { start: ws.winterStartTime || "09:00", end: ws.winterEndTime || "16:00" };
}

// ---------------------------------------------------------------------------
// Which shift applies (read by the attendance service)
// ---------------------------------------------------------------------------

export interface ShiftContext {
  shifts: Map<string, ShiftDefinition>;
  defaultId: string | null;
  branchDefaults: Map<string, string | null>;
  assignments: Map<string, repo.AssignmentRow[]>;
  roster: Map<string, repo.RosterEntry>;
}

/** Shifts, assignments, roster days and branch defaults for some employees between two dates (a day either side for night shifts). */
export async function loadShiftContext(employeeIds: string[], from: string, to: string): Promise<ShiftContext> {
  const [{ shifts, defaultId }, branchDefaults, assignments, roster] = await Promise.all([
    listShifts(),
    repo.findBranchDefaults(),
    repo.findAssignments(employeeIds, addDays(from, -1), addDays(to, 1)),
    repo.findRoster(employeeIds, addDays(from, -1), addDays(to, 1)),
  ]);
  const byEmployee = new Map<string, repo.AssignmentRow[]>();
  for (const a of assignments) byEmployee.set(a.employeeId, [...(byEmployee.get(a.employeeId) ?? []), a]);
  return {
    shifts: new Map(shifts.map((s) => [s.id, s])),
    defaultId,
    branchDefaults,
    assignments: byEmployee,
    roster: new Map(roster.map((r) => [`${r.employeeId}|${r.date}`, r])),
  };
}

/** An employee's shift on a day, and where it came from. */
export function shiftOn(ctx: ShiftContext, e: { id: string; branchId: string }, date: string): { plan: ShiftRule; source: ShiftSource; shiftId: string | null; note: string | null } {
  const r = ctx.roster.get(`${e.id}|${date}`);
  const pick = shiftForDay(
    date,
    {
      roster: r ? { shiftId: r.shiftId, off: r.off } : null,
      assignments: ctx.assignments.get(e.id) ?? [],
      branchDefaultId: ctx.branchDefaults.get(e.branchId) ?? null,
      companyDefaultId: ctx.defaultId,
    },
    ctx.shifts
  );
  return { ...pick, note: r?.note ?? null };
}

// ---------------------------------------------------------------------------
// Defining shifts (company-wide roles; the action checks the role)
// ---------------------------------------------------------------------------

const toWrite = (v: ShiftInput): repo.ShiftWrite => ({ ...v });

/** Adds or changes a shift. Returns its id and the Labour Act reminders. */
export async function saveShift(raw: unknown, ctx: { userId: string }): Promise<{ id: string; created: boolean; warnings: string[]; code: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { id?: unknown };
  const { value, errors } = parseShift(raw);
  if (!value) throw new AttendanceValidationError(errors);
  const id = typeof r.id === "string" && r.id ? r.id : null;
  const same = await repo.findShiftByCode(value.code);
  if (same && same.id !== id) throw new AttendanceValidationError({ code: `${value.code} is already used by ${same.name}` });
  if (id) {
    if (!(await repo.updateShift(id, toWrite(value), ctx.userId))) throw new UserFacingError("That shift no longer exists. Refresh the page.");
    await syncWorkSchedule();
    return { id, created: false, warnings: shiftWarnings(value), code: value.code };
  }
  const newId = await repo.insertShift(toWrite(value), ctx.userId);
  return { id: newId, created: true, warnings: shiftWarnings(value), code: value.code };
}

export async function makeDefault(id: string, ctx: { userId: string }): Promise<{ code: string }> {
  const s = await repo.findShiftById(id);
  if (!s) throw new UserFacingError("That shift no longer exists. Refresh the page.");
  await repo.setDefaultShift(id, ctx.userId);
  await syncWorkSchedule();
  return { code: s.code };
}

/** Archives a shift (kept for the days that used it) or brings it back. Refused for the default and while in use from today on. */
export async function setActive(id: string, active: boolean, ctx: { userId: string; today: string }): Promise<{ code: string }> {
  const s = await repo.findShiftById(id);
  if (!s) throw new UserFacingError("That shift no longer exists. Refresh the page.");
  if (!active) {
    if (s.isDefault) throw new UserFacingError("The company default can't be archived. Make another shift the default first.");
    const use = await repo.shiftUseFrom(id, ctx.today);
    const parts = [use.assignments && `${use.assignments} assignment${use.assignments === 1 ? "" : "s"}`, use.rosterDays && `${use.rosterDays} roster day${use.rosterDays === 1 ? "" : "s"}`, use.branches && `${use.branches} branch default${use.branches === 1 ? "" : "s"}`].filter(Boolean);
    if (parts.length) throw new UserFacingError(`${s.code} is still used (${parts.join(", ")}). Move those people to another shift first.`);
  }
  if (!(await repo.setShiftActive(id, active, ctx.userId))) throw new UserFacingError("That shift can't be changed. Refresh the page.");
  return { code: s.code };
}

/** A branch's default shift (null = the company default). */
export async function setBranchDefault(branchId: string, shiftId: string | null): Promise<void> {
  if (shiftId) {
    const s = await repo.findShiftById(shiftId);
    if (!s || !s.active) throw new UserFacingError("Choose an active shift.");
  }
  if (!(await repo.setBranchDefault(branchId, shiftId))) throw new UserFacingError("That branch no longer exists. Refresh the page.");
}

// ---------------------------------------------------------------------------
// Assigning (people in scope; never your own; open months only)
// ---------------------------------------------------------------------------

const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** People in scope, not the user (S21), with no closed month between the dates for their branch. */
async function guardPeople(scope: ScopeFilter, employeeIds: string[], from: string, to: string): Promise<Map<string, attendanceRepo.AttendanceEmployee>> {
  if (!employeeIds.length) throw new UserFacingError("Choose the people first.");
  if (employeeIds.length > MAX_PEOPLE) throw new UserFacingError(`Choose at most ${MAX_PEOPLE} people at a time.`);
  const people = await attendanceRepo.findEmployees(buildEmployeeScopeCondition(scope));
  const byId = new Map(people.map((e) => [e.id, e]));
  if (employeeIds.some((id) => !byId.has(id))) throw new OutOfScopeError();
  if (includesOwnRecord(scope.employeeId, employeeIds)) throw new OwnAttendanceError("You can't change your own shift: it decides your late and overtime. Ask someone else.");
  const closed = await attendanceRepo.findClosedPeriodsOverlapping(from, to);
  for (const id of employeeIds) {
    const p = closed.find((c) => c.branchId === byId.get(id)!.branchId);
    if (p) throw new UserFacingError(`${byId.get(id)!.fullName}'s attendance from ${String(p.startDate)} to ${String(p.endDate)} is closed. Choose dates after that, or reopen the month first.`);
  }
  return byId;
}

async function activeShift(id: unknown): Promise<ShiftDefinition> {
  const s = typeof id === "string" && id ? await repo.findShiftById(id) : null;
  if (!s || !s.active) throw new AttendanceValidationError({ shiftId: "Choose an active shift" });
  return s;
}

/** Gives people a shift from a date (to a date, or ongoing). */
export async function assignShift(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ count: number; shiftCode: string; from: string; to: string | null }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const from = isoDate(r.from);
  const to = r.to ? isoDate(r.to) : null;
  const errors: Record<string, string> = {};
  if (!from) errors.from = "Choose the first day";
  if (r.to && !to) errors.to = "Choose a valid last day";
  if (from && to && to < from) errors.to = "The last day is before the first";
  const ids = Array.isArray(r.employeeIds) ? [...new Set(r.employeeIds.filter((x): x is string => typeof x === "string"))] : [];
  if (Object.keys(errors).length) throw new AttendanceValidationError(errors);
  const shift = await activeShift(r.shiftId);
  await guardPeople(ctx.scope, ids, from!, to ?? "9999-12-31");
  const note = typeof r.note === "string" ? r.note.trim().slice(0, 300) || null : null;
  await repo.assign(ids.map((employeeId) => ({ employeeId, shiftId: shift.id, from: from!, to, note })), ctx.userId);
  return { count: ids.length, shiftCode: shift.code, from: from!, to };
}

/** Roster cells: a shift code's id, OFF, or clear (back to the usual shift). One note for the change. */
export async function setRoster(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<{ count: number }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { cells?: unknown; note?: unknown };
  const list = (Array.isArray(r.cells) ? r.cells : []).slice(0, MAX_ROSTER_CELLS + 1).map((c) => {
    const x = (c && typeof c === "object" ? c : {}) as { employeeId?: unknown; date?: unknown; shiftId?: unknown; off?: unknown; clear?: unknown };
    const date = isoDate(x.date);
    if (!date || typeof x.employeeId !== "string") throw new UserFacingError("Some cells are not valid. Refresh and try again.");
    return { employeeId: x.employeeId, date, shiftId: typeof x.shiftId === "string" ? x.shiftId : null, off: x.off === true, clear: x.clear === true };
  });
  if (!list.length) throw new UserFacingError("Nothing to change.");
  if (list.length > MAX_ROSTER_CELLS) throw new UserFacingError(`Change at most ${MAX_ROSTER_CELLS} days at a time.`);
  const cells = [...new Map(list.map((c) => [`${c.employeeId}|${c.date}`, c])).values()];
  const shiftIds = [...new Set(cells.filter((c) => !c.clear && !c.off).map((c) => c.shiftId))];
  if (shiftIds.some((id) => !id)) throw new UserFacingError("Some cells have no shift. Type a shift code or OFF.");
  for (const id of shiftIds) await activeShift(id);
  const from = cells.reduce((m, c) => (c.date < m ? c.date : m), cells[0].date);
  const to = cells.reduce((m, c) => (c.date > m ? c.date : m), cells[0].date);
  await guardPeople(ctx.scope, [...new Set(cells.map((c) => c.employeeId))], from, to);
  const note = typeof r.note === "string" ? r.note.trim().slice(0, 300) || null : null;
  await repo.setRoster(cells, note, ctx.userId);
  return { count: cells.length };
}

/** Fills the roster from a rotation: shifts (or OFF) in order, each for N days, between two dates. */
export async function rotateRoster(
  raw: unknown,
  ctx: { scope: ScopeFilter; userId: string }
): Promise<{ people: number; days: number; from: string; to: string; steps: string; everyDays: number }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const from = isoDate(r.from);
  const to = isoDate(r.to);
  const everyDays = Number(r.everyDays);
  const startAt = Number(r.startAt ?? 0);
  if (!from) errors.from = "Choose the first day";
  if (!to) errors.to = "Choose the last day";
  if (from && to && to < from) errors.to = "The last day is before the first";
  if (from && to && to >= from && Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 > MAX_ROTATION_DAYS) errors.to = `At most ${MAX_ROTATION_DAYS} days at a time`;
  if (!Number.isInteger(everyDays) || everyDays < 1 || everyDays > 31) errors.everyDays = "Between 1 and 31 days";
  const order = Array.isArray(r.shiftIds) ? r.shiftIds.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  if (order.length < 2) errors.shiftIds = "Choose at least two steps";
  if (!Number.isInteger(startAt) || startAt < 0 || startAt >= Math.max(1, order.length)) errors.startAt = "Choose where the rotation starts";
  if (Object.keys(errors).length) throw new AttendanceValidationError(errors);
  const used = new Map<string, ShiftDefinition>();
  for (const id of new Set(order.filter((x) => x !== "OFF"))) used.set(id, await activeShift(id));
  const ids = Array.isArray(r.employeeIds) ? [...new Set(r.employeeIds.filter((x): x is string => typeof x === "string"))] : [];
  // Each step's shift keeps its own weekly offs; OFF steps give rotating days off.
  const days = rotate({ shiftIds: order, everyDays, from: from!, to: to!, startAt, offOn: weeklyOffOf([...used.values()]) });
  if (ids.length * days.length > MAX_ROSTER_CELLS) throw new UserFacingError(`That is ${ids.length * days.length} roster days; fill at most ${MAX_ROSTER_CELLS} at a time.`);
  await guardPeople(ctx.scope, ids, from!, to!);
  const note = typeof r.note === "string" ? r.note.trim().slice(0, 300) || null : "Rotation";
  await repo.setRoster(
    ids.flatMap((employeeId) => days.map((d) => ({ employeeId, date: d.date, shiftId: d.shiftId, off: d.off, clear: false }))),
    note,
    ctx.userId
  );
  const steps = order.map((id) => (id === "OFF" ? "OFF" : used.get(id)!.code)).join(" → ");
  return { people: ids.length, days: days.length, from: from!, to: to!, steps, everyDays };
}

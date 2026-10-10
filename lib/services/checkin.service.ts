import * as repo from "@/lib/repositories/checkin.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as attendanceService from "@/lib/services/attendance.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { AttendanceValidationError } from "@/lib/services/attendance-errors";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { addDays, periodContaining, periodFor, type PayPeriod } from "@/lib/engines/pay-period.engine";
import { DEFAULT_SHIFT, dayWindow, localClock, summariseMonth } from "@/lib/engines/attendance-day.engine";
import { CHECKIN_RULES, DEFAULT_RADIUS_M, MIN_GAP_SECONDS, decideClock, nextKind, parseLocation, parseNetwork, type CheckinRule } from "@/lib/engines/checkin.engine";
import type { ClockStatus, DayResult, MonthSummary } from "@/lib/types/attendance";

// Web clock-in (4.5c). The employee is always the signed-in user (the
// action resolves them from the session), the time is the server's, the IP
// is the proxy-trusted one, and the distance is worked out here. Inside the
// allowed place a web punch is saved; outside, the employee may send it for
// approval as a remote clock-in (an adjustment their supervisor or someone
// with Attendance → Approve decides; never themselves).

const ms = (iso: string) => new Date(iso).getTime();

/** The day a clock-in now belongs to: today, or yesterday while a night shift that started yesterday is still being worked. */
async function currentDay(employeeId: string, now: string) {
  const today = nepalDateIso(new Date(now));
  const yesterday = addDays(today, -1);
  const own = await attendanceService.ownDays(employeeId, yesterday, today);
  if (!own) throw new UserFacingError("Your employee record was not found. Contact HR.");
  const [dayBefore, day] = own.days;
  const plan = (d: DayResult) => ({ ...DEFAULT_SHIFT, start: d.shift?.start ?? DEFAULT_SHIFT.start, end: d.shift?.end ?? DEFAULT_SHIFT.end });
  const todayWindow = dayWindow(today, plan(day));
  const useYesterday = ms(now) < ms(todayWindow.from);
  const chosen = useYesterday ? dayBefore : day;
  const date = useYesterday ? yesterday : today;
  return { employee: own.employee, date, day: chosen, window: dayWindow(date, plan(chosen)) };
}

/** What the clock card shows: today's shift, punches, waiting requests, and whether clocking is possible. */
export async function clockStatus(employeeId: string): Promise<ClockStatus> {
  const now = new Date().toISOString();
  const [rules, cur] = await Promise.all([attendanceService.getRules(), currentDay(employeeId, now)]);
  const { employee, date, day, window } = cur;
  const [branch, punches, remote, closed] = await Promise.all([
    repo.findBranchCheckin(employee.branchId),
    repo.findOwnPunches(employeeId, window.from, window.to),
    repo.findOwnRemote(employeeId, window.from, window.to),
    attendanceRepo.findClosedPeriodsOverlapping(date, date),
  ]);
  const rule: CheckinRule = branch?.rule ?? "off";
  const waiting = remote.filter((r) => r.status === "pending");
  let unavailableReason: string | null = null;
  if (!rules.webCheckIn.enabled || rule === "off") unavailableReason = "Web clock-in is not switched on for your branch. Ask HR.";
  else if (day.dayType === "not_employed" || (employee.status !== "Active" && !employee.terminationDate)) unavailableReason = "You can't clock in: you are not employed today.";
  else if (closed.some((p) => p.branchId === employee.branchId)) unavailableReason = "This month's attendance is closed for your branch. Ask HR for an adjustment.";
  return {
    employeeName: employee.fullName,
    branchName: branch?.name ?? "",
    today: date,
    available: unavailableReason === null,
    rule,
    wantsLocation: rule === "location" || rule === "network_or_location" || rule === "network_and_location",
    unavailableReason,
    next: nextKind(punches.length + waiting.length),
    shift: day.shift ? { code: day.shift.code, name: day.shift.name, start: day.shift.start, end: day.shift.end, off: day.dayType === "weekly_off" } : null,
    punches: punches.map((p) => ({ at: p.at, kind: p.kind, source: p.source, note: p.note })),
    waiting: remote.map((r) => ({ at: r.at, kind: r.kind, status: r.status, reason: r.reason })),
    dayType: day.dayType,
    dayRule: day.rule,
    workMinutes: day.workMinutes,
    firstIn: day.firstIn,
    lastOut: day.lastOut,
  };
}

export interface ClockResult {
  /** punch: saved; remote_needed: outside, nothing saved yet; remote_sent: waiting for approval. */
  outcome: "punch" | "remote_needed" | "remote_sent";
  kind: "in" | "out";
  at: string;
  message: string;
}

/**
 * Clocks the employee in or out now. Everything is decided here: the time,
 * in or out, the IP check, the distance. Outside the allowed place nothing
 * is saved unless the employee confirms with a reason (remote clock-in).
 */
export async function clock(employeeId: string, raw: unknown, ctx: { ip: string; userId: string }): Promise<ClockResult> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { location?: unknown; remote?: unknown; reason?: unknown };
  const status = await clockStatus(employeeId);
  if (!status.available) throw new UserFacingError(status.unavailableReason ?? "Web clock-in is not available.");
  const now = new Date().toISOString();
  const last = [...status.punches.map((p) => p.at), ...status.waiting.filter((w) => w.status === "pending").map((w) => w.at)].sort().pop();
  if (last && ms(now) - ms(last) < MIN_GAP_SECONDS * 1000) throw new UserFacingError(`You clocked ${status.next === "in" ? "out" : "in"} at ${localClock(last)}, a moment ago.`);

  const [me] = await attendanceRepo.findEmployeesByIds([employeeId]);
  const [rules, branch, exception] = await Promise.all([attendanceService.getRules(), repo.findBranchCheckin(me?.branchId ?? ""), repo.hasException(employeeId, status.today)]);
  if (!me || !branch) throw new UserFacingError("Your branch was not found. Contact HR.");
  const location = parseLocation(r.location);
  const decision = decideClock({
    companyEnabled: rules.webCheckIn.enabled,
    branch: { name: branch.name, rule: branch.rule, networks: branch.networks, point: branch.latitude !== null && branch.longitude !== null ? { lat: branch.latitude, lng: branch.longitude } : null, radiusM: branch.radiusM },
    ip: ctx.ip,
    location,
    exception,
  });
  const kind = status.next;
  if (decision.outcome === "off") throw new UserFacingError(decision.reason);

  if (decision.outcome === "punch") {
    const added = await attendanceRepo.insertPunches([
      {
        employeeId,
        punchedAt: now,
        kind,
        source: "web",
        ip: ctx.ip === "unknown" ? null : ctx.ip,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        accuracyM: location?.accuracy ?? null,
        note: `Web clock-${kind}: ${decision.reason}`,
        createdBy: ctx.userId,
      },
    ]);
    if (!added) throw new UserFacingError("That clock-in was already recorded.");
    return { outcome: "punch", kind, at: now, message: `Clocked ${kind} at ${localClock(now)} (${decision.reason}).` };
  }

  // Outside the allowed place: ask first; send for approval only with a reason.
  if (r.remote !== true) return { outcome: "remote_needed", kind, at: now, message: decision.reason };
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 300) : "";
  if (reason.length < 3) throw new AttendanceValidationError({ reason: "Say why you are clocking in outside the office" });
  await attendanceRepo.createAdjustment({
    employeeId,
    date: status.today,
    kind: kind === "in" ? "remote_in" : "remote_out",
    requestedIn: kind === "in" ? now : null,
    requestedOut: kind === "out" ? now : null,
    reason,
    source: "self_service",
    preparedBy: ctx.userId,
    place: { ip: ctx.ip === "unknown" ? null : ctx.ip, latitude: location?.lat ?? null, longitude: location?.lng ?? null, accuracyM: location?.accuracy ?? null, distanceM: decision.distanceM },
  });
  return { outcome: "remote_sent", kind, at: now, message: `Clock-${kind} at ${localClock(now)} sent for approval. It counts once your supervisor approves it.` };
}

// ---------------------------------------------------------------------------
// My attendance (self-service): a month with the same rules
// ---------------------------------------------------------------------------

export interface MyMonth {
  period: PayPeriod;
  today: string;
  days: DayResult[];
  summary: MonthSummary;
  requests: { id: string; kind: "remote_in" | "remote_out"; at: string; status: string; reason: string }[];
  /** 4.7b: each overtime day and where it stands; how the company decides overtime. */
  overtime: import("@/lib/types/overtime").OvertimeLine[];
  overtimeApproval: "required" | "auto";
}

export async function myMonth(employeeId: string, year?: number, month?: number): Promise<MyMonth> {
  const rules = await attendanceService.getRules();
  const today = nepalDateIso();
  let period: PayPeriod;
  try {
    period = year && month ? periodFor(rules.calendar, year, month) : periodContaining(rules.calendar, today);
  } catch {
    period = periodContaining(rules.calendar, today);
  }
  const own = await attendanceService.ownDays(employeeId, period.start, period.end);
  if (!own) throw new UserFacingError("Your employee record was not found. Contact HR.");
  const counted = own.days.filter((d) => d.date <= today);
  const fromInstant = new Date(Date.parse(`${period.start}T00:00:00Z`) - 6 * 3600 * 1000).toISOString();
  const toInstant = new Date(Date.parse(`${period.end}T00:00:00Z`) + 36 * 3600 * 1000).toISOString();
  const [requests, ot] = await Promise.all([repo.findOwnRemote(employeeId, fromInstant, toInstant), attendanceService.ownOvertime(employeeId, counted, period.start, period.end)]);
  return { period, today, days: own.days, summary: summariseMonth(period, counted, rules), requests, overtime: ot.lines, overtimeApproval: ot.approval };
}

// ---------------------------------------------------------------------------
// Settings (company-wide roles; the actions check the role)
// ---------------------------------------------------------------------------

/** A branch's web clock-in: rule, networks, office point and radius. */
export async function saveBranch(raw: unknown): Promise<{ branchName: string; rule: CheckinRule }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const branchId = typeof r.branchId === "string" ? r.branchId : "";
  const rule = (CHECKIN_RULES as readonly string[]).includes(String(r.rule)) ? (r.rule as CheckinRule) : null;
  if (!rule) errors.rule = "Choose a rule";
  const networks = (Array.isArray(r.networks) ? r.networks : []).filter((n): n is string => typeof n === "string").map((n) => n.trim()).filter(Boolean);
  if (networks.length > 30) errors.networks = "At most 30 networks";
  const bad = networks.find((n) => !parseNetwork(n));
  if (bad) errors.networks = `"${bad.slice(0, 40)}" is not an address or range (e.g. 103.10.28.5 or 103.10.28.0/24)`;
  const coord = (v: unknown) => (v === null || v === "" || v === undefined ? null : Number(v));
  const latitude = coord(r.latitude);
  const longitude = coord(r.longitude);
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) errors.latitude = "Between -90 and 90";
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) errors.longitude = "Between -180 and 180";
  if ((latitude === null) !== (longitude === null)) errors.latitude = "Give both latitude and longitude, or neither";
  const radiusM = Number(r.radiusM ?? DEFAULT_RADIUS_M);
  if (!Number.isInteger(radiusM) || radiusM < 25 || radiusM > 5000) errors.radiusM = "Between 25 and 5,000 metres";
  if ((rule === "network" || rule === "network_and_location") && !networks.length) errors.networks = "Add the office network";
  if ((rule === "location" || rule === "network_and_location") && latitude === null) errors.latitude = "Set the office location";
  if (rule === "network_or_location" && !networks.length && latitude === null) errors.networks = "Add the office network or set the office location";
  if (Object.keys(errors).length) throw new AttendanceValidationError(errors);
  const branch = await repo.findBranchCheckin(branchId);
  if (!branch) throw new UserFacingError("That branch no longer exists. Refresh the page.");
  const round = (n: number | null) => (n === null ? null : Math.round(n * 1e6) / 1e6);
  await repo.saveBranchCheckin(branchId, { rule: rule!, networks: [...new Set(networks)], latitude: round(latitude), longitude: round(longitude), radiusM });
  return { branchName: branch.name, rule: rule! };
}

/** Lets someone clock in from anywhere (no approval) from a date, until a date or ongoing. */
export async function addException(raw: unknown, ctx: { userId: string; myEmployeeId: string | null }): Promise<{ employeeId: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const employeeId = typeof r.employeeId === "string" ? r.employeeId : "";
  const from = iso(r.from) ?? nepalDateIso();
  const to = r.to ? iso(r.to) : null;
  const reason = typeof r.reason === "string" ? r.reason.trim().slice(0, 300) : "";
  if (!employeeId) errors.employeeId = "Choose the employee";
  if (r.to && !to) errors.to = "Choose a valid last day";
  if (to && to < from) errors.to = "The last day is before the first";
  if (reason.length < 3) errors.reason = "Say why (e.g. Field sales, client visit)";
  if (Object.keys(errors).length) throw new AttendanceValidationError(errors);
  // S21: nobody exempts themselves from the location check.
  if (ctx.myEmployeeId && ctx.myEmployeeId === employeeId) throw new UserFacingError("You can't allow yourself to clock in from anywhere. Ask someone else.");
  if (!(await attendanceRepo.findEmployeesByIds([employeeId])).length) throw new UserFacingError("That employee no longer exists.");
  await repo.addException({ employeeId, from, to, reason, createdBy: ctx.userId });
  return { employeeId };
}

export async function removeException(id: string): Promise<{ employeeId: string }> {
  const e = await repo.findExceptionById(id);
  if (!e || !(await repo.removeException(id))) throw new UserFacingError("That entry no longer exists. Refresh the page.");
  return { employeeId: e.employeeId };
}

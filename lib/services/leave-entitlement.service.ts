import * as repo from "@/lib/repositories/leave.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as attendanceService from "@/lib/services/attendance.service";
import * as leaveService from "@/lib/services/leave.service";
import { findUserNames } from "@/lib/repositories/salary-structure.repository";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { isOwnRecord } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { AttendanceValidationError, OutOfScopeError, OwnAttendanceError } from "@/lib/services/attendance-errors";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { addDays, bsDayOf, periodContaining, periodFor, weekdayOf } from "@/lib/engines/pay-period.engine";
import { fmt, planOpening, type BalanceLine } from "@/lib/engines/leave.engine";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import type { LeaveCalendarData, LeaveCalendarCell, LeavePerson, OpeningPreview, SubstituteSuggestion } from "@/lib/types/leave";

// Leave entitlements (4.6b): opening a leave year (carry-over with the
// Labour Act caps, the excess marked to be paid out, yearly credits),
// substitute leave for days worked on a weekly off or holiday (HR grants,
// 21-day expiry), and the leave calendar. Home leave earned at month close
// lives with the month close (leave.service monthCloseLines).

type Person = attendanceRepo.AttendanceEmployee;

/** A date in words for messages, both calendars: "1 Shrawan 2084 (17 Jul 2027)". */
function longDate(iso: string): string {
  const bs = bsDayOf(iso);
  const ad = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${bs.day} ${BS_MONTHS_EN[bs.month]} ${bs.year} (${ad})`;
}

/** How long a substitute grant lasts and how far back suggestions go (Labour Act §42: within 21 days). */
const SUBSTITUTE_WINDOW_DAYS = 21;
export const MAX_GRANTS = 100;

function personView(e: Person, names: { branch: Map<string, string>; dept: Map<string, string> }): LeavePerson {
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    fullName: e.fullName,
    gender: e.gender,
    branchId: e.branchId,
    branchName: names.branch.get(e.branchId) ?? "",
    departmentId: e.departmentId,
    departmentName: names.dept.get(e.departmentId) ?? "",
    designationId: e.designationId,
    supervisorId: e.supervisorId,
  };
}

async function nameMaps() {
  const [branches, departments] = await Promise.all([branchRepository.findAllBranches(), departmentRepository.findAllDepartments()]);
  return { branch: new Map(branches.map((b) => [b.id, b.name])), dept: new Map(departments.map((d) => [d.id, d.name])) };
}

// ---------------------------------------------------------------------------
// Opening a leave year (company-wide)
// ---------------------------------------------------------------------------

/**
 * What opening the next leave year would do, and what stops it: the year
 * must exist and have started, no request of the old year may still wait,
 * and every attendance month of the old year must be closed for branches
 * that close months (so the last month's home leave is counted).
 */
export async function openingPreview(scope: ScopeFilter): Promise<OpeningPreview> {
  if (scope.scopeType !== "GLOBAL") throw new UserFacingError("Opening a leave year needs a company-wide role.");
  const today = nepalDateIso();
  const [years, openings, types, people, names] = await Promise.all([leaveService.leaveYears(), repo.findOpenings(), repo.findRuleTypes(), attendanceRepo.findEmployees(), nameMaps()]);
  const opened = new Set(openings.map((o) => o.fiscalYearId));
  const openedYears = years.filter((y) => opened.has(y.id));
  const from = openedYears.at(-1) ?? null;
  const target = from ? years.find((y) => y.start > from.end) ?? null : await leaveService.leaveYearOf(today);
  const openedBy = await findUserNames(openings.map((o) => o.openedBy ?? ""));
  const history = openings
    .map((o) => ({ label: years.find((y) => y.id === o.fiscalYearId)?.label ?? "Leave year", openedAt: o.openedAt.toISOString(), by: o.openedBy ? openedBy.get(o.openedBy) ?? "Unknown user" : "Set up automatically", people: o.people, note: o.note }))
    .reverse();
  const balanceTypes = types.filter((t) => t.kind === "balance" && t.isActive);
  const nextStart = !target && from ? addDays(from.end, 1) : null;
  // What must be true before the year can be opened, in the order to deal with it.
  const checks: OpeningPreview["checks"] = [];
  checks.push({
    label: target ? `${target.label} is set up as a fiscal year` : "The next fiscal year is set up",
    ok: !!target,
    fix: target ? null : from ? `Add the fiscal year that starts on ${longDate(nextStart!)} in Company setup → Fiscal years. It can be opened from that day.` : "No fiscal year covers today. Add one in Company setup → Fiscal years.",
  });
  if (target) {
    checks.push({ label: `${target.label} has started`, ok: today >= target.start, fix: today >= target.start ? null : `It starts on ${longDate(target.start)}. You can open it from that day; until then the figures below are a preview as of today.` });
    if (opened.has(target.id)) checks.push({ label: `${target.label} is not open yet`, ok: false, fix: "It has already been opened. Nothing more to do." });
  }
  if (from) {
    const waiting = (await repo.findRequests({ statuses: ["Pending"] })).filter((r) => r.fiscalYearId === from.id).length;
    checks.push({
      label: `No leave requests of ${from.label} are waiting`,
      ok: waiting === 0,
      fix: waiting ? `${waiting} ${waiting === 1 ? "request is" : "requests are"} still waiting. Approve, reject or withdraw ${waiting === 1 ? "it" : "them"} on the Requests tab.` : null,
    });
    const open = await openMonths(from, people);
    checks.push({
      label: `Every attendance month of ${from.label} is closed`,
      ok: open.length === 0,
      fix: open.length ? `Close ${open.slice(0, 4).join(", ")}${open.length > 4 ? ` and ${open.length - 4} more` : ""} in Attendance, so the home leave earned in ${open.length === 1 ? "it" : "them"} is counted.` : null,
    });
  }
  const problems = checks.filter((c) => !c.ok).map((c) => c.fix ?? c.label);
  const base = { from, target, history, checks, problems, nextStart, types: balanceTypes.map((t) => ({ id: t.id, name: t.name })) };
  if (!target) return { ...base, rows: [], totals: { people: 0, carried: 0, paidOut: 0, lapsed: 0, credited: 0 } };
  const plan = await planFor(target, from, people);
  const typeKind = new Map(balanceTypes.map((t) => [t.id, t]));
  const rowsByPerson = new Map<string, OpeningPreview["rows"][number]>();
  for (const r of plan.rows) {
    const e = people.find((p) => p.id === r.employeeId)!;
    if (!typeKind.has(r.leaveTypeId)) continue;
    const row = rowsByPerson.get(e.id) ?? { employee: personView(e, names), cells: [] };
    row.cells.push(r);
    rowsByPerson.set(e.id, row);
  }
  const sum = (f: (r: (typeof plan.rows)[number]) => number) => Math.round(plan.rows.reduce((n, r) => n + f(r), 0) * 100) / 100;
  return {
    ...base,
    rows: [...rowsByPerson.values()].sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName)),
    totals: {
      people: rowsByPerson.size,
      carried: sum((r) => r.carry),
      paidOut: sum((r) => (r.overKind === "paid_out" ? r.over : 0)),
      lapsed: sum((r) => (r.overKind === "lapsed" ? r.over : 0)),
      credited: sum((r) => r.credit),
    },
  };
}

async function planFor(target: leaveService.LeaveYear, from: leaveService.LeaveYear | null, people: Person[]) {
  const types = await repo.findRuleTypes();
  const ids = people.map((p) => p.id);
  const [oldLedger, newLedger] = await Promise.all([from ? repo.findLedger(ids, from.id) : Promise.resolve([]), repo.findLedger(ids, target.id)]);
  const oldLines = new Map<string, BalanceLine[]>();
  for (const l of oldLedger) oldLines.set(`${l.employeeId}|${l.leaveTypeId}`, [...(oldLines.get(`${l.employeeId}|${l.leaveTypeId}`) ?? []), l]);
  const creditedInNewYear = new Set(newLedger.filter((l) => l.kind === "credit" || l.kind === "opening").map((l) => `${l.employeeId}|${l.leaveTypeId}`));
  return planOpening({
    types,
    people: people.map((p) => ({ id: p.id, gender: p.gender, joiningDate: p.joiningDate, terminationDate: p.terminationDate })),
    oldYear: from ? { id: from.id, label: from.label, end: from.end } : null,
    newYear: target,
    oldLines,
    creditedInNewYear,
  });
}

/** Attendance months of a year still open, for branches that close months (from their first closed month on). */
async function openMonths(year: leaveService.LeaveYear, people: Person[]): Promise<string[]> {
  const rules = await attendanceService.getRules();
  const closedEver = await attendanceRepo.findClosedPeriodsOverlapping("1900-01-01", "2999-12-31");
  const branchNames = (await nameMaps()).branch;
  const out: string[] = [];
  const branches = [...new Set(people.filter((p) => !p.terminationDate || p.terminationDate >= year.start).map((p) => p.branchId))];
  for (const branchId of branches) {
    const mine = closedEver.filter((c) => c.branchId === branchId);
    if (!mine.length) continue;
    const first = mine.map((c) => String(c.startDate).slice(0, 10)).sort()[0];
    const closed = new Set(mine.filter((c) => c.calendar === rules.calendar).map((c) => `${c.periodYear}-${c.periodMonth}`));
    for (let d = year.start; d <= year.end; ) {
      const p = periodContaining(rules.calendar, d);
      if (p.end >= first && !closed.has(`${p.year}-${p.month}`)) out.push(`${p.label} (${branchNames.get(branchId) ?? "branch"})`);
      d = addDays(p.end, 1);
    }
  }
  return out;
}

/** Opens the next leave year: carries balances over, marks the excess to be paid out, credits the year. Once per year. */
export async function openYear(scope: ScopeFilter, userId: string): Promise<{ label: string; people: number; lines: number }> {
  const preview = await openingPreview(scope);
  if (!preview.target) throw new UserFacingError(preview.problems[0] ?? "There is no leave year to open.");
  if (preview.problems.length) throw new UserFacingError(preview.problems[0]);
  const people = await attendanceRepo.findEmployees();
  const plan = await planFor(preview.target, preview.from, people);
  const ok = await repo.openYear({
    fiscalYearId: preview.target.id,
    fromFiscalYearId: preview.from?.id ?? null,
    people: preview.totals.people,
    note: preview.from ? `Carried over from ${preview.from.label}` : null,
    openedBy: userId,
    lines: plan.lines.map((l) => ({ ...l, createdBy: userId })),
  });
  if (!ok) throw new UserFacingError(`${preview.target.label} was opened a moment ago. Refresh the page.`);
  return { label: preview.target.label, people: preview.totals.people, lines: plan.lines.length };
}

// ---------------------------------------------------------------------------
// Substitute leave (Labour Act §42): suggested from attendance, granted by HR
// ---------------------------------------------------------------------------

const halfOrFull = (workMinutes: number, full: number, half: number): 1 | 0.5 | 0 => (workMinutes >= full ? 1 : workMinutes >= half ? 0.5 : 0);

/** Days worked on a weekly off or holiday in the last 21 days, for people in scope, with what was decided. */
export async function substituteSuggestions(scope: ScopeFilter): Promise<SubstituteSuggestion[]> {
  const today = nepalDateIso();
  const from = addDays(today, -SUBSTITUTE_WINDOW_DAYS);
  const to = addDays(today, -1);
  const [worked, types, people, names] = await Promise.all([
    attendanceService.workedOffDays(scope, from, to),
    repo.findRuleTypes(),
    attendanceRepo.findEmployees(buildEmployeeScopeCondition(scope)),
    nameMaps(),
  ]);
  const substitute = types.find((t) => t.statutoryCode === "SUBSTITUTE" && t.kind === "balance");
  if (!substitute || !worked.length) return [];
  const decided = await repo.findLinesByRef([...new Set(worked.map((w) => w.employeeId))], "substitute:");
  const by = await findUserNames(decided.map((l) => l.createdBy ?? ""));
  const byId = new Map(people.map((p) => [p.id, p]));
  return worked
    .filter((w) => byId.has(w.employeeId))
    .map((w) => {
      const line = decided.find((l) => l.employeeId === w.employeeId && l.ref === `substitute:${w.date}`);
      const suggested = halfOrFull(w.workMinutes, w.fullDayMinutes, w.halfDayMinutes);
      return {
        employee: personView(byId.get(w.employeeId)!, names),
        date: w.date,
        why: w.why,
        firstIn: w.firstIn,
        lastOut: w.lastOut,
        workMinutes: w.workMinutes,
        otOffMinutes: w.otOffMinutes,
        suggested,
        expiresOn: addDays(w.date, substitute.expiryDays ?? SUBSTITUTE_WINDOW_DAYS),
        decided: line
          ? { granted: line.kind === "grant", days: line.days, note: line.note, by: line.createdBy ? by.get(line.createdBy) ?? "Unknown user" : null, at: line.createdAt }
          : null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.employee.fullName.localeCompare(b.employee.fullName));
}

/**
 * HR grants substitute leave for days worked on a weekly off or holiday
 * (full or half day; expires 21 days after the day worked), or records that
 * it is not granted (reason). Never for yourself (S21); only days the
 * attendance rules show as worked, within 21 days, decided once.
 */
export async function grantSubstitute(
  raw: unknown,
  ctx: { scope: ScopeFilter; userId: string }
): Promise<{ employeeId: string; date: string; days: number }[]> {
  const items = (Array.isArray(raw) ? raw : []).slice(0, MAX_GRANTS + 1).map((x) => {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "";
    const days = r.days === 1 || r.days === 0.5 || r.days === 0 ? (r.days as 0 | 0.5 | 1) : -1;
    const note = typeof r.note === "string" ? r.note.trim().slice(0, 300) : "";
    return { employeeId: typeof r.employeeId === "string" ? r.employeeId : "", date, days, note };
  });
  if (!items.length) throw new UserFacingError("Choose the days first.");
  if (items.length > MAX_GRANTS) throw new UserFacingError(`Decide at most ${MAX_GRANTS} days at a time.`);
  if (items.some((i) => !i.employeeId || !i.date || i.days < 0)) throw new UserFacingError("Some days are not valid. Refresh and try again.");
  if (items.some((i) => i.days === 0 && i.note.length < 3)) throw new AttendanceValidationError({ note: "Say why it is not granted (e.g. paid as overtime)" });
  if (items.some((i) => isOwnRecord(ctx.scope.employeeId, i.employeeId))) throw new OwnAttendanceError("You can't grant substitute leave to yourself. Ask someone else.");
  const suggestions = await substituteSuggestions(ctx.scope);
  const types = await repo.findRuleTypes();
  const substitute = types.find((t) => t.statutoryCode === "SUBSTITUTE" && t.kind === "balance");
  if (!substitute || !substitute.isActive) throw new UserFacingError("Substitute leave is not in use.");
  const rolled = await leaveService.rolledYears();
  const lines: repo.NewLedgerLine[] = [];
  for (const i of items) {
    const s = suggestions.find((x) => x.employee.id === i.employeeId && x.date === i.date);
    if (!s) {
      const inScope = (await attendanceRepo.findEmployees(buildEmployeeScopeCondition(ctx.scope))).some((e) => e.id === i.employeeId);
      if (!inScope) throw new OutOfScopeError();
      throw new UserFacingError(`No day worked on a weekly off or holiday on ${i.date} in the last ${SUBSTITUTE_WINDOW_DAYS} days for that person.`);
    }
    if (s.decided) throw new UserFacingError(`${s.employee.fullName}'s ${i.date} is already decided. Refresh the page.`);
    const year = await leaveService.leaveYearOf(i.date);
    if (!year) throw new UserFacingError("No fiscal year covers that day.");
    lines.push({
      employeeId: i.employeeId,
      leaveTypeId: substitute.id,
      fiscalYearId: await leaveService.postingYear(year.id, rolled),
      entryDate: i.date,
      kind: i.days === 0 ? "not_granted" : "grant",
      days: i.days,
      note: i.days === 0 ? `Not granted: ${i.note}` : `${s.why}, worked ${fmt(Math.round((s.workMinutes / 60) * 10) / 10)} h${i.note ? ` · ${i.note}` : ""}`,
      expiresOn: i.days === 0 ? null : s.expiresOn,
      ref: `substitute:${i.date}`,
      createdBy: ctx.userId,
    });
  }
  // Two people deciding the same day at once: the second finds it decided.
  const again = await repo.findLinesByRef([...new Set(items.map((i) => i.employeeId))], "substitute:");
  if (lines.some((l) => again.some((a) => a.employeeId === l.employeeId && a.ref === l.ref))) throw new UserFacingError("Someone else decided some of these days a moment ago. Refresh the page.");
  await repo.postLedgerLines(lines);
  return items.map((i) => ({ employeeId: i.employeeId, date: i.date, days: i.days }));
}

// ---------------------------------------------------------------------------
// Leave calendar (who is on leave in a month)
// ---------------------------------------------------------------------------

/** A BS month: people in scope, their weekly offs and holidays, approved and waiting leave per day. */
export async function leaveCalendar(scope: ScopeFilter, bsYear: number, bsMonth: number): Promise<LeaveCalendarData> {
  let period;
  try {
    period = periodFor("BS", bsYear, bsMonth);
  } catch {
    period = periodContaining("BS", nepalDateIso());
  }
  const [all, types, names] = await Promise.all([attendanceRepo.findEmployees(buildEmployeeScopeCondition(scope)), repo.findRuleTypes(), nameMaps()]);
  const people = all
    .filter((e) => e.joiningDate <= period.end && (!e.terminationDate || e.terminationDate >= period.start) && (e.status === "Active" || !!e.terminationDate))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const [calendars, requests] = await Promise.all([
    leaveService.calendarsFor(people, period.start, period.end),
    repo.findRequests({ employeeIds: people.map((p) => p.id), from: period.start, to: period.end, statuses: ["Pending", "Approved"] }),
  ]);
  const typeOf = new Map(types.map((t) => [t.id, t]));
  const dates: string[] = [];
  for (let d = period.start; d <= period.end; d = addDays(d, 1)) dates.push(d);
  return {
    period: { year: period.year, month: period.month, label: period.label, start: period.start, end: period.end },
    days: dates.map((date) => ({ date, bsDay: bsDayOf(date).day, weekday: weekdayOf(date) })),
    types: types.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name, code: t.code })),
    rows: people.map((e) => {
      const cells: Record<string, LeaveCalendarCell> = {};
      for (const c of calendars.get(e.id) ?? []) if (c.off) cells[c.date] = { off: c.why?.startsWith("Holiday") ? "holiday" : "weekly", offName: c.why ?? null, leave: null };
      for (const r of requests.filter((x) => x.employeeId === e.id)) {
        const t = typeOf.get(r.leaveTypeId);
        const counted = r.daysDetail ?? [];
        const span = counted.length ? counted.map((d) => ({ date: d.date, part: d.part, pay: d.pay })) : [];
        if (!span.length) for (let d = String(r.effectiveFrom).slice(0, 10); d <= String(r.effectiveTo).slice(0, 10); d = addDays(d, 1)) span.push({ date: d, part: r.duration === "Half Day" ? 0.5 : 1, pay: t?.pay ?? "full" });
        for (const d of span) {
          if (d.date < period.start || d.date > period.end) continue;
          cells[d.date] = { ...(cells[d.date] ?? { off: null, offName: null }), leave: { requestId: r.id, code: t?.code ?? "L", name: t?.name ?? "Leave", status: r.status === "Approved" ? "Approved" : "Pending", half: d.part < 1, unpaid: d.pay === "none" } };
        }
      }
      return { employee: personView(e, names), cells };
    }),
  };
}

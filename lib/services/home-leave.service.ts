import * as repo from "@/lib/repositories/leave.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as attendanceService from "@/lib/services/attendance.service";
import * as leaveService from "@/lib/services/leave.service";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { UserFacingError } from "@/lib/errors/action-error";
import { OutOfScopeError } from "@/lib/services/attendance-errors";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { addDays, periodContaining, type PayPeriod } from "@/lib/engines/pay-period.engine";
import { balanceOn, fmt, homeLeaveEarned, homeLeaveMonths, type HomeMonthInput } from "@/lib/engines/leave.engine";
import type { EmployeeBalancesRow, HomeLeaveYear, HomeSwitchPreview, LeavePageData, LeavePerson, LeaveRuleType, LedgerLine } from "@/lib/types/leave";

// Home leave (Labour Act §43, 4.6b): 1 day for every 20 paid days, added
// when each attendance month is closed. This service shows a person's year
// month by month (what each closed month added, what an open month has
// earned so far, the most the year can give), and makes the one-time switch
// for a year whose home leave the old system gave up front.

type Person = attendanceRepo.AttendanceEmployee;
type Line = LedgerLine & { employeeId: string };
type Year = leaveService.LeaveYear;

/** The ledger line that replaces a year's up-front home leave with what was earned (once per person and year). */
const switchRef = (yearId: string) => `home-earned:${yearId}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

async function homeType(): Promise<LeaveRuleType | null> {
  return (await repo.findRuleTypes()).find((t) => t.statutoryCode === "HOME" && t.kind === "balance" && t.isActive) ?? null;
}

/** The attendance months of a leave year, in the attendance calendar. */
function monthsOf(year: Year, calendar: "BS" | "AD"): PayPeriod[] {
  const out: PayPeriod[] = [];
  for (let d = year.start; d <= year.end; ) {
    const p = periodContaining(calendar, d);
    out.push(p);
    d = addDays(p.end, 1);
  }
  return out;
}

/** What the old system gave up front for the year, still to be switched (null = nothing to switch). */
function upFrontOf(lines: readonly Line[], year: Year, home: LeaveRuleType): number | null {
  if (lines.some((l) => l.ref === switchRef(year.id))) return null;
  const opening = lines.filter((l) => l.kind === "opening").reduce((n, l) => n + l.days, 0);
  if (opening <= 0) return null;
  // The old system's yearly allotment was at most the type's days; anything above it was carried from earlier years.
  return r2(Math.min(opening, home.days > 0 ? home.days : 18));
}

/**
 * Home leave for a leave year, per person: closed months from what was
 * posted, open months from attendance so far (worked out for everyone in
 * one pass, nothing written).
 */
export async function homeLeaveYears(people: readonly Person[], options: { year?: Year | null } = {}): Promise<Map<string, HomeLeaveYear>> {
  const out = new Map<string, HomeLeaveYear>();
  const today = nepalDateIso();
  const [home, year, rules] = await Promise.all([homeType(), options.year === undefined ? leaveService.leaveYearOf(today) : Promise.resolve(options.year), attendanceService.getRules()]);
  if (!home || !year || !people.length) return out;
  const ids = people.map((p) => p.id);
  const months = monthsOf(year, rules.calendar);
  const [ledger, accruals, closed] = await Promise.all([
    repo.findLedger(ids, year.id),
    repo.findLinesByRef(ids, "accrual:"),
    attendanceRepo.findClosedPeriodsOverlapping(year.start, year.end),
  ]);
  const closedKey = new Set(closed.filter((c) => c.calendar === rules.calendar).map((c) => `${c.branchId}|${c.periodYear}-${c.periodMonth}`));
  // Open months that have started (up to yesterday: today isn't over), for everyone at once.
  const openMonths = months.filter((p) => p.start < today && people.some((e) => !closedKey.has(`${e.branchId}|${p.year}-${p.month}`)));
  const liveAll = await attendanceService.paidDaysSoFar(ids, openMonths, addDays(today, -1));
  for (const e of people) {
    const lines = ledger.filter((l) => l.employeeId === e.id && l.leaveTypeId === home.id);
    const upFront = upFrontOf(lines, year, home);
    // The up-front part of the old opening line: still to switch, or already taken back by the switch line.
    const switched = -lines.filter((l) => l.ref === switchRef(year.id)).reduce((n, l) => n + l.days, 0);
    const opening = lines.filter((l) => l.kind === "opening").reduce((n, l) => n + l.days, 0);
    const broughtForward = r2(lines.filter((l) => l.kind === "carried_forward").reduce((n, l) => n + l.days, 0) + opening - (upFront ?? switched));
    const earned = r2(lines.filter((l) => l.kind === "accrual").reduce((n, l) => n + l.days, 0));
    const taken = r2(-lines.filter((l) => l.kind === "taken" || l.kind === "returned").reduce((n, l) => n + l.days, 0));
    const balance = balanceOn(lines, today).available;
    const isClosed = (p: PayPeriod) => closedKey.has(`${e.branchId}|${p.year}-${p.month}`);
    const live = liveAll.get(e.id) ?? new Map<string, number>();
    const input: HomeMonthInput[] = months.map((p) => ({
      label: p.label,
      start: p.start,
      end: p.end,
      closed: isClosed(p),
      closedPaidDays: null,
      posted: r2(accruals.filter((a) => a.employeeId === e.id && a.leaveTypeId === home.id && a.ref === leaveService.monthRef(p)).reduce((n, a) => n + a.days, 0)),
      livePaidDays: live.get(`${p.year}-${p.month}`) ?? null,
    }));
    const plan = homeLeaveMonths({ months: input, joiningDate: e.joiningDate, terminationDate: e.terminationDate, today, everyDays: home.accrualEveryDays });
    out.set(e.id, {
      employeeId: e.id,
      yearLabel: year.label,
      broughtForward,
      earned,
      taken,
      other: r2(balance - (broughtForward + earned + (upFront ?? 0) - taken)),
      balance,
      upTo: r2(broughtForward + plan.upTo),
      givenUpFront: upFront,
      months: plan.months,
    });
  }
  // Paid days of closed months, for the month table (one read per closed month).
  for (const p of months) {
    const rows = await attendanceRepo.findClosedSummaries(ids, rules.calendar, p.year, p.month);
    for (const s of rows) {
      const m = out.get(s.employeeId)?.months.find((x) => x.start === p.start && x.status === "closed");
      if (m) m.paidDays = Number(s.payableDays) || 0;
    }
  }
  return out;
}

/**
 * One person's home leave year (Balances pane, employee record,
 * self-service), with open months worked out from attendance. `"checked"`:
 * the caller has already checked access (the employee record, or the
 * session's own employee in self-service); otherwise the scope decides.
 */
export async function homeLeaveFor(employeeId: string, scope: ScopeFilter | "checked"): Promise<HomeLeaveYear | null> {
  const people = scope === "checked" ? await attendanceRepo.findEmployeesByIds([employeeId]) : (await attendanceRepo.findEmployees(buildEmployeeScopeCondition(scope))).filter((e) => e.id === employeeId);
  if (!people.length) {
    if (scope === "checked") return null;
    throw new OutOfScopeError();
  }
  return (await homeLeaveYears(people)).get(employeeId) ?? null;
}

/** Adds home leave figures to the Balances grid and says whether this year's switch is still to be made. */
export async function addHomeLeave(data: LeavePageData, scope: ScopeFilter): Promise<void> {
  const home = data.types.find((t) => t.statutoryCode === "HOME" && t.kind === "balance" && t.isActive);
  if (!home || !data.fiscalYear) return;
  const shown = new Set(data.balances.map((b) => b.employee.id));
  const people = (await attendanceRepo.findEmployees(buildEmployeeScopeCondition(scope))).filter((p) => shown.has(p.id));
  const years = await homeLeaveYears(people);
  let pending = 0;
  let given = 0;
  data.balances = data.balances.map((row): EmployeeBalancesRow => {
    const y = years.get(row.employee.id);
    if (!y) return row;
    if (y.givenUpFront !== null) {
      pending++;
      given += y.givenUpFront;
    }
    return { ...row, cells: row.cells.map((c) => (c.leaveTypeId === home.id ? { ...c, home: { earned: y.earned, upTo: y.upTo, givenUpFront: y.givenUpFront } } : c)) };
  });
  data.homeSwitch = pending ? { people: pending, givenUpFront: r2(given) } : null;
}

// ---------------------------------------------------------------------------
// The one-time switch: up-front home leave → earned month by month
// ---------------------------------------------------------------------------

async function personView(): Promise<(e: Person) => LeavePerson> {
  const [branches, departments] = await Promise.all([branchRepository.findAllBranches(), departmentRepository.findAllDepartments()]);
  const b = new Map(branches.map((x) => [x.id, x.name]));
  const d = new Map(departments.map((x) => [x.id, x.name]));
  return (e) => ({ id: e.id, employeeCode: e.employeeCode, fullName: e.fullName, gender: e.gender, branchId: e.branchId, branchName: b.get(e.branchId) ?? "", departmentId: e.departmentId, departmentName: d.get(e.departmentId) ?? "", designationId: e.designationId, supervisorId: e.supervisorId });
}

/** What the switch posts: per person, the up-front days taken back and each closed month's days added. */
async function planSwitch() {
  const today = nepalDateIso();
  const [home, year, rules] = await Promise.all([homeType(), leaveService.leaveYearOf(today), attendanceService.getRules()]);
  if (!home) throw new UserFacingError("Home leave is not in use.");
  if (!year) throw new UserFacingError("No fiscal year covers today.");
  const people = await attendanceRepo.findEmployees();
  const ids = people.map((p) => p.id);
  const months = monthsOf(year, rules.calendar);
  const [ledger, accruals, closed] = await Promise.all([repo.findLedger(ids, year.id), repo.findLinesByRef(ids, "accrual:"), attendanceRepo.findClosedPeriodsOverlapping(year.start, year.end)]);
  const closedKey = new Set(closed.filter((c) => c.calendar === rules.calendar).map((c) => `${c.branchId}|${c.periodYear}-${c.periodMonth}`));
  const summaries = new Map<string, Map<string, number>>();
  for (const p of months.filter((m) => closed.some((c) => c.calendar === rules.calendar && c.periodYear === m.year && c.periodMonth === m.month))) {
    for (const s of await attendanceRepo.findClosedSummaries(ids, rules.calendar, p.year, p.month)) {
      const m = summaries.get(s.employeeId) ?? new Map<string, number>();
      m.set(`${p.year}-${p.month}`, Number(s.payableDays) || 0);
      summaries.set(s.employeeId, m);
    }
  }
  const postIn = await leaveService.postingYear(year.id);
  const plan: { person: Person; givenUpFront: number; broughtForward: number; earnedSoFar: number; taken: number; balanceNow: number; lines: repo.NewLedgerLine[] }[] = [];
  for (const e of people) {
    const lines = ledger.filter((l) => l.employeeId === e.id && l.leaveTypeId === home.id);
    const upFront = upFrontOf(lines, year, home);
    if (upFront === null) continue;
    const out: repo.NewLedgerLine[] = [
      {
        employeeId: e.id,
        leaveTypeId: home.id,
        fiscalYearId: postIn,
        entryDate: today,
        kind: "adjusted",
        days: -upFront,
        note: `Home leave is now earned month by month (Labour Act §43: 1 day per ${home.accrualEveryDays ?? 20} paid days). The ${fmt(upFront)} days given up front for ${year.label} are replaced by the days earned.`,
        ref: switchRef(year.id),
        createdBy: null,
      },
    ];
    let earnedSoFar = 0;
    for (const p of months) {
      if (!closedKey.has(`${e.branchId}|${p.year}-${p.month}`)) continue;
      const paid = summaries.get(e.id)?.get(`${p.year}-${p.month}`);
      if (paid === undefined) continue;
      const ref = leaveService.monthRef(p);
      const already = accruals.filter((a) => a.employeeId === e.id && a.leaveTypeId === home.id && a.ref === ref).reduce((n, a) => n + a.days, 0);
      const diff = r2(homeLeaveEarned(paid, home.accrualEveryDays) - already);
      earnedSoFar += homeLeaveEarned(paid, home.accrualEveryDays);
      if (diff !== 0) out.push({ employeeId: e.id, leaveTypeId: home.id, fiscalYearId: postIn, entryDate: p.end, kind: "accrual", days: diff, note: `${p.label}: ${fmt(paid)} paid days ÷ ${home.accrualEveryDays ?? 20}`, ref, createdBy: null });
    }
    const opening = lines.filter((l) => l.kind === "opening").reduce((n, l) => n + l.days, 0);
    plan.push({
      person: e,
      givenUpFront: upFront,
      broughtForward: r2(lines.filter((l) => l.kind === "carried_forward").reduce((n, l) => n + l.days, 0) + opening - upFront),
      earnedSoFar: r2(earnedSoFar),
      taken: r2(-lines.filter((l) => l.kind === "taken" || l.kind === "returned").reduce((n, l) => n + l.days, 0)),
      balanceNow: balanceOn(lines, today).available,
      lines: out,
    });
  }
  return { year, months, closedKey, plan };
}

const assertCompanyWide = (scope: ScopeFilter) => {
  if (scope.scopeType !== "GLOBAL") throw new UserFacingError("Switching home leave needs a company-wide role.");
};

/** What switching this year's home leave to earned would do, per person. */
export async function homeSwitchPreview(scope: ScopeFilter): Promise<HomeSwitchPreview> {
  assertCompanyWide(scope);
  const { year, months, closedKey, plan } = await planSwitch();
  const view = await personView();
  return {
    year,
    months: months.map((p) => ({ label: p.label, closed: [...closedKey].some((k) => k.endsWith(`|${p.year}-${p.month}`)) })).filter((m, i) => m.closed || months[i].start <= nepalDateIso()),
    rows: plan
      .map((x) => ({
        employee: view(x.person),
        givenUpFront: x.givenUpFront,
        broughtForward: x.broughtForward,
        earnedSoFar: x.earnedSoFar,
        taken: x.taken,
        balanceNow: x.balanceNow,
        balanceAfter: r2(x.balanceNow - x.givenUpFront + x.earnedSoFar),
      }))
      .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName)),
  };
}

/** Makes the switch for everyone still on up-front home leave this year, in one transaction. Once per person and year. */
export async function switchHomeLeave(scope: ScopeFilter, userId: string): Promise<{ yearLabel: string; people: number }> {
  assertCompanyWide(scope);
  const { year, plan } = await planSwitch();
  if (!plan.length) throw new UserFacingError("Home leave is already earned month by month for everyone this year.");
  // Someone else switching at the same moment: whoever posts second finds the lines there.
  const again = await repo.findLinesByRef(plan.map((x) => x.person.id), switchRef(year.id));
  if (again.length) throw new UserFacingError("Someone else made this switch a moment ago. Refresh the page.");
  await repo.postLedgerLines(plan.flatMap((x) => x.lines.map((l) => ({ ...l, createdBy: userId }))));
  return { yearLabel: year.label, people: plan.length };
}

import * as repository from "@/lib/repositories/holiday.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import {
  HOLIDAY_CATEGORY,
  auditedHoliday,
  closedProblem,
  daysInclusive,
  describeBranches,
  fiscalYearLabel,
  fiscalYearOf,
  holidayFormIsValid,
  holidayWrite,
  normalizeHolidayForm,
  sameBranches,
  scopeProblem,
  validateHolidayForm,
  type ClosedMonth,
} from "@/lib/engines/holiday.engine";
import { periodFor, type PeriodCalendar } from "@/lib/engines/pay-period.engine";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { bsStringToAD } from "@/lib/utils/bs-calendar";
import { nepalDateIso, toIsoDate } from "@/lib/utils/nepal-time";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type { Holiday, HolidayAppliesTo, HolidayFormErrors, HolidayRow, HolidaySaveResult, HolidaysPage } from "@/lib/types/holiday";

// Holiday calendar (4.12c, S52). Who may change a holiday follows the user's scope: a company-wide
// role for every branch, a branch role for its own branches (scopeProblem), never platform
// support; nothing that moves a holiday's days, branches or who gets it lands in a closed
// attendance month (closedProblem); every change is audited.

export class HolidayValidationError extends UserFacingError {
  constructor(public errors: HolidayFormErrors) {
    super("Check the highlighted fields.");
    this.name = "HolidayValidationError";
  }
}

export interface HolidayCtx {
  scope: ScopeFilter;
  userId: string;
}

/** The AD day "YYYY-MM-DD" of a stored BS day ("" outside the calendar). */
function adOf(bs: string): string {
  const d = bsStringToAD(bs);
  return d && !Number.isNaN(d.getTime()) ? toIsoDate(d) : "";
}

function monthLabel(calendar: string, year: number, month: number): string {
  try {
    return periodFor(calendar as PeriodCalendar, year, month).label;
  } catch {
    return `${year}-${month}`;
  }
}

/** Closed attendance months (any branch) between two AD days. */
async function closedMonths(from: string, to: string): Promise<ClosedMonth[]> {
  const rows = await attendanceRepo.findClosedPeriodsOverlapping(from, to);
  return rows.map((r) => ({ branchId: r.branchId, startDate: String(r.startDate), endDate: String(r.endDate), label: monthLabel(r.calendar, r.periodYear, r.periodMonth) }));
}

const branchNames = (branches: { id: string; name: string }[]) => new Map(branches.map((b) => [b.id, b.name]));

export async function holidaysPage(scope: ScopeFilter, can: HolidaysPage["can"]): Promise<HolidaysPage> {
  const [holidays, branches] = await Promise.all([repository.findAllHolidays(), branchRepository.findAllBranches()]);
  const names = branchNames(branches);
  // A branch role sees the holidays for every branch and its own branches'.
  const visible = scope.scopeType === "BRANCH" ? holidays.filter((h) => !h.branchIds.length || h.branchIds.some((id) => scope.branchIds.includes(id))) : holidays;
  const dated = visible.map((h) => ({ h, from: adOf(h.startDate), to: adOf(h.endDate) })).filter((d) => d.from && d.to);
  const first = dated.reduce((m, d) => (d.from < m ? d.from : m), "9999-12-31");
  const last = dated.reduce((m, d) => (d.to > m ? d.to : m), "0000-01-01");
  const closed = dated.length ? await closedMonths(first, last) : [];
  const branchName = (id: string) => names.get(id) ?? "A branch";

  const rows: HolidayRow[] = dated
    .map(({ h, from, to }) => ({
      id: h.id,
      name: h.name,
      category: h.category,
      categoryLabel: HOLIDAY_CATEGORY[h.category]?.label ?? h.category,
      fromBs: h.startDate,
      toBs: h.endDate,
      fromAd: from,
      toAd: to,
      days: daysInclusive(from, to),
      fiscalYear: fiscalYearOf(from),
      appliesTo: h.appliesTo,
      branches: describeBranches(h.branchIds, names),
      locked: scopeProblem(scope, h.branchIds) ?? closedProblem({ from, to, branchIds: h.branchIds }, closed, branchName),
      form: { name: h.name, category: h.category, from, to, appliesTo: h.appliesTo, branchIds: [...h.branchIds] },
    }))
    .sort((a, b) => a.fromAd.localeCompare(b.fromAd) || a.name.localeCompare(b.name));

  const current = fiscalYearOf(nepalDateIso());
  const years = [...new Set([current, current + 1, ...rows.map((r) => r.fiscalYear)])].sort((a, b) => b - a);
  const pickable = scope.isImpersonation ? [] : scope.scopeType === "GLOBAL" ? branches : scope.scopeType === "BRANCH" ? branches.filter((b) => scope.branchIds.includes(b.id)) : [];
  return {
    holidays: rows,
    branches: pickable.map((b) => ({ id: b.id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name)),
    fiscalYears: years.map((year) => ({ year, label: fiscalYearLabel(year) })),
    currentFiscalYear: current,
    companyWide: scope.scopeType === "GLOBAL" && !scope.isImpersonation,
    can,
  };
}

/** Approved leave of the people a holiday reaches, inside its days (counted before the holiday existed). */
async function approvedLeaveInside(h: { from: string; to: string; branchIds: readonly string[]; appliesTo: HolidayAppliesTo }): Promise<number> {
  const people = (await attendanceRepo.findEmployees()).filter(
    (e) => (!h.branchIds.length || (!!e.branchId && h.branchIds.includes(e.branchId))) && (h.appliesTo !== "women" || e.gender === "Female")
  );
  if (!people.length) return 0;
  return (await leaveRepository.findRequests({ employeeIds: people.map((p) => p.id), from: h.from, to: h.to, statuses: ["Approved"] })).length;
}

/** Adds a holiday (id null) or saves one. */
export async function saveHoliday(id: string | null, raw: unknown, ctx: HolidayCtx): Promise<HolidaySaveResult> {
  const [holidays, branches] = await Promise.all([repository.findAllHolidays(), branchRepository.findAllBranches()]);
  const names = branchNames(branches);
  const current = id ? holidays.find((h) => h.id === id) ?? null : null;
  if (id && !current) throw new UserFacingError("That holiday no longer exists.");
  // The user must cover the branches the holiday has, and the ones it gets.
  const asWas = current ? scopeProblem(ctx.scope, current.branchIds) : null;
  if (asWas) throw new UserFacingError(asWas);

  const form = normalizeHolidayForm(raw);
  const errors = validateHolidayForm(form, {
    others: holidays.filter((h) => h.id !== id).map((h) => ({ name: h.name, from: adOf(h.startDate) })),
    branchIds: branches.map((b) => b.id),
    current,
  });
  const reach = scopeProblem(ctx.scope, form.branchIds);
  if (reach && !errors.branchIds) errors.branchIds = reach;
  if (!holidayFormIsValid(errors)) throw new HolidayValidationError(errors);
  const write = holidayWrite(form);

  // Its days, branches or who gets it change attendance: never inside a closed month, before or after.
  const touchesDays = !current || write.startDate !== current.startDate || write.endDate !== current.endDate || write.appliesTo !== current.appliesTo || !sameBranches(write.branchIds, current.branchIds);
  if (touchesDays) {
    const was = current ? { from: adOf(current.startDate), to: adOf(current.endDate), branchIds: current.branchIds } : null;
    const closed = await closedMonths(was && was.from < form.from ? was.from : form.from, was && was.to > form.to ? was.to : form.to);
    const branchName = (bid: string) => names.get(bid) ?? "A branch";
    const problem = (was ? closedProblem(was, closed, branchName) : null) ?? closedProblem({ from: form.from, to: form.to, branchIds: write.branchIds }, closed, branchName);
    if (problem) throw new UserFacingError(problem);
  }
  const leaveInside = () => (touchesDays ? approvedLeaveInside({ from: form.from, to: form.to, branchIds: write.branchIds, appliesTo: write.appliesTo }) : Promise.resolve(0));

  if (!current) {
    const created = await repository.insertHoliday(write);
    await recordAuditLog({ userId: ctx.userId, action: "ADD", module: "HOLIDAYS", recordId: `${created.name} (${created.startDate})`, newValues: auditedHoliday(created, names) });
    return { id: created.id, name: created.name, leaveInside: await leaveInside() };
  }

  const before = auditedHoliday(current, names);
  const after = auditedHoliday({ ...current, ...write }, names);
  // Branches are compared by id: two branches may share a name.
  const changed = (Object.keys(after) as (keyof typeof after)[]).filter((k) => (k === "branches" ? !sameBranches(current.branchIds, write.branchIds) : after[k] !== before[k]));
  if (!changed.length) throw new UserFacingError("Nothing changed.");
  const saved = await repository.updateHoliday(current.id, write);
  if (!saved) throw new UserFacingError("That holiday no longer exists.");
  await recordAuditLog({
    userId: ctx.userId,
    action: "EDIT",
    module: "HOLIDAYS",
    recordId: `${saved.name} (${saved.startDate})`,
    oldValues: Object.fromEntries(changed.map((k) => [k, before[k]])),
    newValues: Object.fromEntries(changed.map((k) => [k, after[k]])),
  });
  return { id: saved.id, name: saved.name, leaveInside: await leaveInside() };
}

/** Deletes a holiday the user's scope covers, outside closed attendance months. */
export async function deleteHoliday(id: string, ctx: HolidayCtx): Promise<Pick<Holiday, "name">> {
  const [current, branches] = await Promise.all([repository.findHolidayById(id), branchRepository.findAllBranches()]);
  if (!current) throw new UserFacingError("That holiday no longer exists.");
  const names = branchNames(branches);
  const reach = scopeProblem(ctx.scope, current.branchIds);
  if (reach) throw new UserFacingError(reach);
  const span = { from: adOf(current.startDate), to: adOf(current.endDate), branchIds: current.branchIds };
  const problem = closedProblem(span, await closedMonths(span.from, span.to), (bid) => names.get(bid) ?? "A branch");
  if (problem) throw new UserFacingError(problem);
  if (!(await repository.deleteHoliday(id))) throw new UserFacingError("That holiday no longer exists.");
  await recordAuditLog({ userId: ctx.userId, action: "DELETE", module: "HOLIDAYS", recordId: `${current.name} (${current.startDate})`, oldValues: auditedHoliday(current, names) });
  return { name: current.name };
}

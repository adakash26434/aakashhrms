import * as repository from "@/lib/repositories/fiscal-year.repository";
import {
  cannotClose,
  cannotDelete,
  cannotMakeCurrent,
  cannotReopen,
  fiscalOpeningYearOf,
  fiscalYearDates,
  fiscalYearState,
  isOverlapping,
  nextOpeningYear,
  openingYearOf,
  payMonthYearProblem,
  validateReopenReason,
  type FiscalYearFacts,
} from "@/lib/engines/fiscal-year.engine";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { getTodayBS } from "@/lib/utils/bs-calendar";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { FiscalYear, FiscalYearRow, FiscalYearsPage } from "@/lib/types/fiscal-year";

// Fiscal years (4.12, S49): a Nepali fiscal year is made from its opening BS year (Shrawan 1 to
// the end of Asar), never typed dates. Exactly one is current; making another current only moves
// the current one aside — a closed year is never touched. A year is closed after it ends, with
// its pay runs locked; it is reopened only with a reason. A year nothing uses yet can be deleted
// with its own tax slabs. Every change is audited. Callers check FISCAL_YEAR (Add / Edit / Lock)
// with a company-wide role (checkCompanyControl). A pay run belongs to the year its month falls in (fiscalYearForPayMonth).

export interface FiscalYearCtx {
  userId: string;
}

const localDay = (d: Date) => nepalDateIso(new Date(d));

async function factsOf(fy: FiscalYear): Promise<FiscalYearFacts> {
  const [usage, openRuns] = await Promise.all([repository.usageByYear(), repository.openRunsByYear()]);
  return factsFrom(fy, usage, openRuns);
}

function factsFrom(fy: FiscalYear, usage: Map<string, repository.YearUsage[]>, openRuns: Map<string, number>): FiscalYearFacts {
  return {
    status: fy.status,
    startAD: localDay(fy.startDateAD),
    endAD: localDay(fy.endDateAD),
    inUse: (usage.get(fy.id) ?? []).map((u) => `${u.count.toLocaleString("en-IN")} ${u.label}`),
    openRuns: openRuns.get(fy.id) ?? 0,
  };
}

/** What the viewer may do (buttons only — every action re-checks on the server). */
export async function fiscalYearsPage(can: FiscalYearsPage["can"]): Promise<FiscalYearsPage> {
  const [years, slabCounts, usage, openRuns] = await Promise.all([repository.findAllFiscalYears(), repository.slabCounts(), repository.usageByYear(), repository.openRunsByYear()]);
  const today = nepalDateIso();
  const rows: FiscalYearRow[] = years.map((fy) => {
    const facts = factsFrom(fy, usage, openRuns);
    const slabs: Record<string, number> = {};
    for (const c of slabCounts.filter((s) => s.fiscalYearId === fy.id)) slabs[c.category] = c.n;
    return {
      id: fy.id,
      label: fy.label,
      startBS: fy.startDateBS,
      endBS: fy.endDateBS,
      startAD: facts.startAD,
      endAD: facts.endAD,
      status: fy.status,
      state: fiscalYearState(facts, today),
      inUse: facts.inUse,
      openRuns: facts.openRuns,
      slabs,
      blocked: { makeCurrent: cannotMakeCurrent(facts), close: cannotClose(facts, today), reopen: cannotReopen(facts), delete: cannotDelete(facts) },
    };
  });
  rows.sort((a, b) => b.startAD.localeCompare(a.startAD));
  const bsToday = getTodayBS();
  return { years: rows, today, nextYear: nextOpeningYear(years, { year: bsToday.year, month: bsToday.month }), can };
}

async function yearOrThrow(id: string): Promise<FiscalYear> {
  const fy = await repository.findFiscalYearById(id);
  if (!fy) throw new UserFacingError("That fiscal year no longer exists.");
  return fy;
}

const audit = (ctx: FiscalYearCtx, action: "ADD" | "EDIT" | "DELETE", fy: { label: string }, values: Record<string, unknown>) =>
  recordAuditLog({ userId: ctx.userId, action, module: "FISCAL_YEAR", recordId: fy.label, newValues: values });

const CHANGED = "The year changed meanwhile. Refresh and try again.";

/** A new fiscal year from its opening BS year, optionally with a copy of another year's tax slabs. */
export async function createFiscalYear(raw: unknown, ctx: FiscalYearCtx): Promise<FiscalYear> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bsYear = Number(r.bsYear);
  const dates = fiscalYearDates(bsYear);
  if (!dates) throw new UserFacingError("Give the BS year the fiscal year opens in (for example 2084 for FY 2084/85).");
  const all = await repository.findAllFiscalYears();
  if (all.some((y) => openingYearOf(y) === bsYear || y.slug === dates.slug)) throw new UserFacingError(`${dates.label} already exists.`);
  const candidate = { label: dates.label, slug: dates.slug, fromMonth: 4 as const, toMonth: 3 as const, startDateAD: new Date(dates.startAD), endDateAD: new Date(dates.endAD) };
  if (isOverlapping(candidate, all)) throw new UserFacingError(`${dates.label} would overlap a fiscal year that already exists.`);
  const copyFrom = typeof r.copySlabsFrom === "string" && all.some((y) => y.id === r.copySlabsFrom) ? r.copySlabsFrom : null;
  const created = await repository.insertYearWithSlabs(
    { label: dates.label, slug: dates.slug, fromMonth: 4, toMonth: 3, startDateBS: dates.startBS, endDateBS: dates.endBS, startDateAD: dates.startAD, endDateAD: dates.endAD },
    copyFrom
  );
  await audit(ctx, "ADD", created, { startBS: dates.startBS, endBS: dates.endBS, copiedTaxSlabsFrom: copyFrom ? all.find((y) => y.id === copyFrom)?.label : null });
  return created;
}

/** Makes the year current (leave, reports and new screens default to it). */
export async function makeCurrent(id: string, ctx: FiscalYearCtx): Promise<void> {
  const fy = await yearOrThrow(id);
  const blocked = cannotMakeCurrent(fy);
  if (blocked) throw new UserFacingError(blocked);
  const before = (await repository.findAllFiscalYears()).find((y) => y.status === "Active");
  if (!(await repository.makeCurrent(id))) throw new UserFacingError(CHANGED);
  await audit(ctx, "EDIT", fy, { change: "made current", previousCurrent: before?.label ?? null });
}

/** Closes a year that has ended, with every pay run of it locked. */
export async function closeYear(id: string, ctx: FiscalYearCtx): Promise<void> {
  const fy = await yearOrThrow(id);
  const blocked = cannotClose(await factsOf(fy), nepalDateIso());
  if (blocked) throw new UserFacingError(blocked);
  if (!(await repository.moveStatus(id, "Inactive", "Locked"))) throw new UserFacingError(CHANGED);
  await audit(ctx, "EDIT", fy, { change: "closed" });
}

/** Reopens a closed year, with the reason on the audit line. */
export async function reopenYear(id: string, reason: string, ctx: FiscalYearCtx): Promise<void> {
  const fy = await yearOrThrow(id);
  const blocked = cannotReopen(fy) ?? validateReopenReason(reason);
  if (blocked) throw new UserFacingError(blocked);
  if (!(await repository.moveStatus(id, "Locked", "Inactive"))) throw new UserFacingError(CHANGED);
  await audit(ctx, "EDIT", fy, { change: "reopened", reason: reason.trim() });
}

const isForeignKeyViolation = (e: unknown) => !!e && typeof e === "object" && ((e as { code?: string }).code === "23503" || (e as { cause?: { code?: string } }).cause?.code === "23503");

/** Deletes a year nothing uses yet, with its own tax slabs. */
export async function deleteYear(id: string, ctx: FiscalYearCtx): Promise<void> {
  const fy = await yearOrThrow(id);
  const blocked = cannotDelete(await factsOf(fy));
  if (blocked) throw new UserFacingError(blocked);
  try {
    if (!(await repository.deleteYearWithSlabs(id))) throw new UserFacingError(CHANGED);
  } catch (error) {
    // Something started using the year since it was checked.
    if (isForeignKeyViolation(error)) throw new UserFacingError(`${fy.label} is in use now, so it stays.`);
    throw error;
  }
  await audit(ctx, "DELETE", fy, { startBS: fy.startDateBS, endBS: fy.endDateBS });
}

/** The fiscal year a BS pay month falls in, and why it can't be paid there (null: it can). */
export async function payMonthFiscalYear(bsYear: number, bsMonth: number): Promise<{ fiscalYear: FiscalYear | null; problem: string | null }> {
  const fiscalYear = (await repository.findByOpeningYear(fiscalOpeningYearOf(bsYear, bsMonth))) ?? null;
  const hasTaxSlabs = fiscalYear ? await repository.hasIndividualLadder(fiscalYear.id) : false;
  return { fiscalYear, problem: payMonthYearProblem(fiscalYear && { label: fiscalYear.label, status: fiscalYear.status, hasTaxSlabs }, bsYear, bsMonth) };
}

/** The year a pay run of this month belongs to, not simply the current one (UserFacingError when none covers it or it is closed). */
export async function fiscalYearForPayMonth(bsYear: number, bsMonth: number): Promise<FiscalYear> {
  const { fiscalYear, problem } = await payMonthFiscalYear(bsYear, bsMonth);
  if (problem || !fiscalYear) throw new UserFacingError(problem ?? "No fiscal year covers this month.");
  return fiscalYear;
}

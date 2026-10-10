/**
 * Holidays (4.12c) — pure logic for the Holiday calendar and the service.
 *
 * A holiday runs from one AD day to another (stored in BS beside them), for
 * every branch or chosen ones, for everyone or women only. Attendance and
 * leave decide whether a day is a holiday for someone with `holidayApplies`
 * only. Who may change a holiday follows the user's scope (a company-wide
 * role for every branch, a branch role for its own branches), and nothing
 * changes inside a closed attendance month. Tests: tests/holiday.engine.test.ts.
 */

import { fiscalOpeningYearOf, formatFiscalYearLabel } from "@/lib/engines/fiscal-year.engine";
import { bsDayOf } from "@/lib/engines/pay-period.engine";
import { HOLIDAY_CATEGORIES, type Holiday, type HolidayAppliesTo, type HolidayCategory, type HolidayForm, type HolidayFormErrors } from "@/lib/types/holiday";

export const HOLIDAY_CATEGORY: Record<HolidayCategory, { label: string; hint: string }> = {
  "major-festival": { label: "Major festival", hint: "Several days: Dashain, Tihar" },
  "cultural-festival": { label: "Cultural festival", hint: "A religious or cultural day: Maghe Sankranti, Shree Panchami" },
  "regional-festival": { label: "Regional festival", hint: "Kept in some places (Chhath, Gai Jatra): usually for chosen branches" },
  "national-holiday": { label: "National holiday", hint: "A gazetted public holiday: Constitution Day, New Year" },
  "international-holiday": { label: "International day", hint: "Labour Day, International Women's Day" },
};

export const APPLIES_TO_LABEL: Record<HolidayAppliesTo, string> = { everyone: "Everyone", women: "Women only" };

export const NAME_MAX = 60;
/** Longest holiday, in days (Dashain with the days around it fits). */
export const MAX_DAYS = 30;

const pad = (n: number) => String(n).padStart(2, "0");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A real AD calendar day "YYYY-MM-DD". */
export function isAdDate(v: string): boolean {
  if (!ISO.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Days from one AD date to another, both counted. */
export const daysInclusive = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** The BS date "YYYY-MM-DD" of an AD date. */
export function bsIsoOf(adIso: string): string {
  const b = bsDayOf(adIso);
  return `${b.year}-${pad(b.month)}-${pad(b.day)}`;
}

/** The opening BS year of the fiscal year (Shrawan–Asar) an AD date falls in. */
export function fiscalYearOf(adIso: string): number {
  const b = bsDayOf(adIso);
  return fiscalOpeningYearOf(b.year, b.month);
}

export const fiscalYearLabel = (openingYear: number) => formatFiscalYearLabel(openingYear);

/**
 * Whether a holiday gives this person this day off: the day is inside it, it
 * covers their branch (no branches: all), and a women-only day reaches women.
 */
export function holidayApplies(
  h: { start: string; end: string; branchIds: readonly string[]; appliesTo: HolidayAppliesTo },
  person: { branchId: string | null; gender: string | null },
  date: string
): boolean {
  return (
    date >= h.start &&
    date <= h.end &&
    (!h.branchIds.length || (!!person.branchId && h.branchIds.includes(person.branchId))) &&
    (h.appliesTo !== "women" || person.gender === "Female")
  );
}

/** "All branches", or the branches by name. */
export function describeBranches(ids: readonly string[], names: ReadonlyMap<string, string>): string {
  if (!ids.length) return "All branches";
  return ids
    .map((id) => names.get(id) ?? "a deleted branch")
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

/** "2083-06-24 BS" or "2083-06-24 – 2083-06-28 BS". */
export const describeDates = (fromBs: string, toBs: string) => (fromBs === toBs ? `${fromBs} BS` : `${fromBs} – ${toBs} BS`);

// ---------------------------------------------------------------------------
// Who may change a holiday, and when
// ---------------------------------------------------------------------------

export interface HolidayScope {
  scopeType: string;
  branchIds: readonly string[];
  isImpersonation?: boolean;
}

/** Why this user can't set a holiday for these branches (null: they can). No branches: every branch. */
export function scopeProblem(scope: HolidayScope, branchIds: readonly string[]): string | null {
  if (scope.isImpersonation) return "Platform support cannot change the holiday calendar.";
  if (scope.scopeType === "GLOBAL") return null;
  if (scope.scopeType !== "BRANCH") return "Holidays are set per branch: only a company-wide or branch role can change them.";
  if (!branchIds.length) return "A holiday for every branch needs a company-wide role: choose your branches instead.";
  if (branchIds.some((id) => !scope.branchIds.includes(id))) return "You can set holidays for your own branches only.";
  return null;
}

export interface ClosedMonth {
  branchId: string;
  /** AD "YYYY-MM-DD". */
  startDate: string;
  endDate: string;
  /** "Aswin 2083". */
  label: string;
}

/** The closed attendance month a holiday's days would change (null: none). No branches: every branch. */
export function closedProblem(h: { from: string; to: string; branchIds: readonly string[] }, closed: readonly ClosedMonth[], branchName: (id: string) => string): string | null {
  const hit = closed.find((c) => c.startDate <= h.to && c.endDate >= h.from && (!h.branchIds.length || h.branchIds.includes(c.branchId)));
  return hit ? `${branchName(hit.branchId)}'s attendance for ${hit.label} is closed: reopen that month first.` : null;
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))].slice(0, 200) : []);
const text = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** The form from the browser: known categories and choices only. */
export function normalizeHolidayForm(raw: unknown): HolidayForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const category = HOLIDAY_CATEGORIES.includes(r.category as HolidayCategory) ? (r.category as HolidayCategory) : ("" as HolidayCategory);
  const from = text(r.from);
  const to = text(r.to) || from;
  return {
    name: text(r.name),
    category,
    from,
    to,
    appliesTo: r.appliesTo === "women" ? "women" : r.appliesTo === "everyone" ? "everyone" : ("" as HolidayAppliesTo),
    branchIds: ids(r.branchIds),
  };
}

export const NEW_HOLIDAY: HolidayForm = { name: "", category: "national-holiday", from: "", to: "", appliesTo: "everyone", branchIds: [] };

/** The checks the window can make on its own. */
export function validateHolidayFields(f: HolidayForm): HolidayFormErrors {
  const e: HolidayFormErrors = {};
  if (!f.name) e.name = "Give the holiday a name.";
  else if (f.name.length > NAME_MAX) e.name = `At most ${NAME_MAX} characters.`;
  if (!HOLIDAY_CATEGORIES.includes(f.category)) e.category = "Choose a category.";
  if (!isAdDate(f.from)) e.from = "Choose the first day.";
  if (!isAdDate(f.to)) e.to = "Choose the last day.";
  else if (isAdDate(f.from) && f.to < f.from) e.to = "The last day is before the first.";
  else if (isAdDate(f.from) && daysInclusive(f.from, f.to) > MAX_DAYS) e.to = `At most ${MAX_DAYS} days.`;
  if (f.appliesTo !== "everyone" && f.appliesTo !== "women") e.appliesTo = "Choose who gets the day off.";
  return e;
}

/**
 * Checks a holiday against the others: a name once in a fiscal year (the
 * same holiday comes back every year), branches that exist (one already on
 * the holiday may stay).
 */
export function validateHolidayForm(
  f: HolidayForm,
  ctx: { others: readonly { name: string; from: string }[]; branchIds: readonly string[]; current: { branchIds: readonly string[] } | null }
): HolidayFormErrors {
  const e = validateHolidayFields(f);
  if (!e.name && !e.from) {
    const year = fiscalYearOf(f.from);
    const name = f.name.toLowerCase();
    if (ctx.others.some((o) => o.name.trim().toLowerCase() === name && isAdDate(o.from) && fiscalYearOf(o.from) === year)) e.name = `${fiscalYearLabel(year)} already has a holiday with this name.`;
  }
  if (f.branchIds.some((id) => !ctx.branchIds.includes(id) && !ctx.current?.branchIds.includes(id))) e.branchIds = "A chosen branch no longer exists.";
  return e;
}

export const holidayFormIsValid = (e: HolidayFormErrors) => Object.keys(e).length === 0;

export interface HolidayWrite {
  name: string;
  category: HolidayCategory;
  /** BS "YYYY-MM-DD". */
  startDate: string;
  endDate: string;
  appliesTo: HolidayAppliesTo;
  branchIds: string[];
}

/** What is stored for a checked form: BS days, branches in order. */
export const holidayWrite = (f: HolidayForm): HolidayWrite => ({
  name: f.name,
  category: f.category,
  startDate: bsIsoOf(f.from),
  endDate: bsIsoOf(f.to),
  appliesTo: f.appliesTo,
  branchIds: [...f.branchIds].sort(),
});

/** Whether two holidays are for the same branches (order aside). */
export const sameBranches = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");

/** What the audit line keeps of a holiday. */
export const auditedHoliday = (h: Pick<Holiday, "name" | "category" | "startDate" | "endDate" | "appliesTo" | "branchIds">, names: ReadonlyMap<string, string>) => ({
  name: h.name,
  dates: describeDates(h.startDate, h.endDate),
  category: HOLIDAY_CATEGORY[h.category]?.label ?? h.category,
  for: APPLIES_TO_LABEL[h.appliesTo] ?? h.appliesTo,
  branches: describeBranches(h.branchIds, names),
});

/**
 * Tax slabs engine (4.12) — pure, framework-agnostic ladder logic.
 *
 * A category's ladder for a fiscal year is edited and saved as a whole.
 * Bands are boundaries ("5,00,000 – 7,00,000" taxes the next 2 lakh), the
 * way payroll's calculateAnnualTaxFromSlabs reads them (to − from): the
 * first band starts at 0, each starts where the one before ends, the last
 * has no top and rates never go down. Used by the Tax slabs screen (editor,
 * preview, change list) and re-checked by tax-rate.service before a save.
 * Tests: tests/tax-rate.engine.test.ts.
 */

import type { TaxLadderRow, TaxSlab } from "@/lib/types/tax-rate";

export const MAX_LADDER_ROWS = 12;

/** One band as edited: where it ends (null: "and above") and its rate. Where it starts is the band before's end. */
export type LadderRow = TaxLadderRow;

export interface LadderBand extends LadderRow {
  from: number;
}

const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : NaN);

/** Rows from the browser: numbers only, the last band open-ended. */
export function normalizeLadder(raw: unknown): LadderRow[] {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_LADDER_ROWS + 1) : [];
  return list.map((r, i) => {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const last = i === list.length - 1;
    const upTo = last || o.upTo === null || o.upTo === "" || o.upTo === undefined ? null : num(o.upTo);
    return { upTo, ratePercent: num(o.ratePercent), fixedDeduction: o.fixedDeduction === undefined || o.fixedDeduction === "" ? 0 : num(o.fixedDeduction) };
  });
}

/** The bands with where each starts. */
export function ladderBands(rows: readonly LadderRow[]): LadderBand[] {
  let from = 0;
  return rows.map((r) => {
    const band = { ...r, from };
    if (r.upTo !== null && Number.isFinite(r.upTo)) from = r.upTo;
    return band;
  });
}

export interface LadderErrors {
  form?: string;
  rows: Record<number, { upTo?: string; ratePercent?: string; fixedDeduction?: string }>;
}

const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;

/** Every band ends above where it starts, rates never go down, the last band is open-ended. */
export function validateLadder(rows: readonly LadderRow[]): LadderErrors {
  const errors: LadderErrors = { rows: {} };
  const put = (i: number, field: "upTo" | "ratePercent" | "fixedDeduction", message: string) => {
    errors.rows[i] = { ...errors.rows[i], [field]: message };
  };
  if (!rows.length) return { form: "Add at least one band.", rows: {} };
  if (rows.length > MAX_LADDER_ROWS) errors.form = `At most ${MAX_LADDER_ROWS} bands.`;
  const bands = ladderBands(rows);
  bands.forEach((b, i) => {
    const last = i === bands.length - 1;
    if (last) {
      if (b.upTo !== null) put(i, "upTo", "The last band has no upper limit (and above).");
    } else if (b.upTo === null || !Number.isFinite(b.upTo)) {
      put(i, "upTo", "Give the income this band goes up to.");
    } else if (!Number.isInteger(b.upTo)) {
      put(i, "upTo", "Whole rupees only.");
    } else if (b.upTo <= b.from) {
      put(i, "upTo", `Must be more than ${b.from.toLocaleString("en-IN")}.`);
    }
    if (!Number.isFinite(b.ratePercent) || b.ratePercent < 0 || b.ratePercent > 100) put(i, "ratePercent", "A rate from 0 to 100.");
    else if (decimals(b.ratePercent) > 2) put(i, "ratePercent", "At most two decimals.");
    else if (i > 0 && Number.isFinite(bands[i - 1].ratePercent) && b.ratePercent < bands[i - 1].ratePercent) put(i, "ratePercent", "Rates never go down as income goes up.");
    if (!Number.isFinite(b.fixedDeduction) || b.fixedDeduction < 0 || !Number.isInteger(b.fixedDeduction)) put(i, "fixedDeduction", "Whole rupees, 0 or more.");
  });
  return errors;
}

export const ladderIsValid = (e: LadderErrors) => !e.form && Object.keys(e.rows).length === 0;

export interface LadderTaxOptions {
  /** Contributes to SSF: the first band's 1% (social security tax) is not charged — as payroll does. */
  ssf?: boolean;
  /** A rebate on the whole tax, e.g. the women's rebate from Rules & controls (percent). */
  rebatePercent?: number;
}

export interface LadderTaxBand extends LadderBand {
  /** Income taxed in this band and the tax on it (before any rebate). */
  taxed: number;
  tax: number;
  /** The rate actually charged (0 for the SSF exemption). */
  rate: number;
}

const money = (n: number) => Math.round(n * 100) / 100 + 0;

/**
 * Tax on a yearly taxable income under the ladder, the way payroll works it
 * out (calculateAnnualTaxFromSlabs): every band's income at its rate less its
 * fixed amount (never below 0), the SSF exemption on a first band of 1%, then
 * the rebate on the total.
 */
export function ladderTax(rows: readonly LadderRow[], income: number, options: LadderTaxOptions = {}): { total: number; beforeRebate: number; rebate: number; bands: LadderTaxBand[] } {
  let left = Math.max(0, Number.isFinite(income) ? income : 0);
  let sum = 0;
  const bands = ladderBands(rows).map((b) => {
    const width = b.upTo === null ? left : Math.max(0, b.upTo - b.from);
    const taxed = Math.max(0, Math.min(left, width));
    left -= taxed;
    const rate = options.ssf && b.from === 0 && b.ratePercent === 1 ? 0 : b.ratePercent;
    const tax = taxed > 0 ? Math.max(0, (taxed * rate) / 100 - b.fixedDeduction) : 0;
    sum += tax;
    return { ...b, taxed, rate, tax: money(tax) };
  });
  const rebatePercent = Math.min(100, Math.max(0, options.rebatePercent ?? 0));
  const rebate = (sum * rebatePercent) / 100;
  return { total: money(sum - rebate), beforeRebate: money(sum), rebate: money(rebate), bands };
}

const rupees = (n: number) => n.toLocaleString("en-IN");

/** The income a band covers: "Up to 5,00,000", "5,00,000 – 7,00,000", "Above 50,00,000". */
export function bandRange(b: Pick<LadderBand, "from" | "upTo">): string {
  if (b.upTo === null) return b.from === 0 ? "All income" : `Above ${rupees(b.from)}`;
  return b.from === 0 ? `Up to ${rupees(b.upTo)}` : `${rupees(b.from)} – ${rupees(b.upTo)}`;
}

/** A band in words: "5,00,000 – 7,00,000 at 10%", "Above 50,00,000 at 39%", "less 5,000" when it has a fixed amount. */
export function describeBand(b: LadderBand): string {
  return `${bandRange(b)} at ${b.ratePercent}%${b.fixedDeduction ? `, less ${rupees(b.fixedDeduction)}` : ""}`;
}

/** What saving `after` over `before` changes, band by band, in words (empty: nothing). */
export function ladderChanges(before: readonly LadderRow[], after: readonly LadderRow[]): string[] {
  const was = ladderBands(before);
  const now = ladderBands(after);
  if (!was.length && now.length) return [`New ladder: ${now.length} band${now.length === 1 ? "" : "s"}`];
  if (was.length && !now.length) return ["Ladder removed: the Individual ladder is used instead"];
  const out: string[] = [];
  for (let i = 0; i < Math.max(was.length, now.length); i++) {
    const a = was[i];
    const b = now[i];
    if (a && b) {
      const same = a.from === b.from && a.upTo === b.upTo && a.ratePercent === b.ratePercent && a.fixedDeduction === b.fixedDeduction;
      if (!same) out.push(`Band ${i + 1}: ${describeBand(a)} → ${describeBand(b)}`);
    } else if (b) out.push(`Band ${i + 1} added: ${describeBand(b)}`);
    else if (a) out.push(`Band ${i + 1} removed: ${describeBand(a)}`);
  }
  return out;
}

/** A stored ladder (either the old "+1" chaining or boundaries) as rows to edit. */
export function rowsFromSlabs(slabs: readonly Pick<TaxSlab, "amountFrom" | "amountTo" | "ratePercent" | "fixedDeduction">[]): LadderRow[] {
  return [...slabs]
    .sort((a, b) => a.amountFrom - b.amountFrom)
    .map((s, i, all) => ({ upTo: i === all.length - 1 ? null : s.amountTo, ratePercent: s.ratePercent, fixedDeduction: s.fixedDeduction }));
}

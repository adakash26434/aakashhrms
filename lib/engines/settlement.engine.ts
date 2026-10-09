import Decimal from "decimal.js";
import type { SettlementFigures, SettlementSettings } from "@/lib/types/payroll-run";

// 4.8b-3 Final settlement: the rules that need no database. Labour Act §53 (gratuity 8.33% of
// the basic salary per month served, from one year of service; an SSF member's gratuity is in
// the fund), §49 (accumulated home and sick leave paid at the last basic salary), ITA §88
// (retirement payments withheld at a flat rate).

export const DEFAULT_SETTLEMENT_SETTINGS: SettlementSettings = {
  gratuityPctPerMonth: 8.33,
  gratuityMinMonths: 12,
  gratuityWithholdingPct: 5,
  gratuityForSsfMembers: false,
};

const num = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

/** Settings as saved (a JSON value in system_config); anything missing or odd falls back to the default. */
export function parseSettlementSettings(raw: unknown): SettlementSettings {
  let o: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") o = parsed as Record<string, unknown>;
    } catch {
      o = {};
    }
  } else if (raw && typeof raw === "object") o = raw as Record<string, unknown>;
  const d = DEFAULT_SETTLEMENT_SETTINGS;
  return {
    gratuityPctPerMonth: num(o.gratuityPctPerMonth, d.gratuityPctPerMonth),
    gratuityMinMonths: Math.round(num(o.gratuityMinMonths, d.gratuityMinMonths)),
    gratuityWithholdingPct: num(o.gratuityWithholdingPct, d.gratuityWithholdingPct),
    gratuityForSsfMembers: o.gratuityForSsfMembers === true || o.gratuityForSsfMembers === "true",
  };
}

export function validateSettlementSettings(s: SettlementSettings): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(s.gratuityPctPerMonth >= 0 && s.gratuityPctPerMonth <= 100)) errors.gratuityPctPerMonth = "Between 0 and 100 percent";
  if (!(Number.isInteger(s.gratuityMinMonths) && s.gratuityMinMonths >= 0 && s.gratuityMinMonths <= 120)) errors.gratuityMinMonths = "Whole months, 0 to 120";
  if (!(s.gratuityWithholdingPct >= 0 && s.gratuityWithholdingPct <= 100)) errors.gratuityWithholdingPct = "Between 0 and 100 percent";
  return errors;
}

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Whole months served from the joining date to the last working day (inclusive). */
export function monthsServed(joiningDate: string, lastWorkingDay: string): number {
  const a = utc(joiningDate);
  const b = utc(lastWorkingDay);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  // The day after the last working day: a 1st-to-end month counts as one month.
  const end = new Date(b.getTime() + 86400000);
  let months = (end.getUTCFullYear() - a.getUTCFullYear()) * 12 + (end.getUTCMonth() - a.getUTCMonth());
  if (end.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

const money = (d: Decimal) => d.toDecimalPlaces(2).toString();

/** Gratuity for the service, or why there is none. */
export function gratuityAmount(i: { basic: string | number; months: number; ssfMember: boolean; settings: SettlementSettings }): { amount: string; reason: string | null } {
  if (i.ssfMember && !i.settings.gratuityForSsfMembers) return { amount: "0", reason: "SSF member: the Social Security Fund carries the gratuity" };
  if (i.months < i.settings.gratuityMinMonths) return { amount: "0", reason: `Under ${i.settings.gratuityMinMonths} months of service` };
  const amount = new Decimal(i.basic).times(i.settings.gratuityPctPerMonth).div(100).times(i.months);
  return { amount: money(amount), reason: null };
}

/** A leave type's encashment: days at basic per day (÷ 30) or at the type's fixed daily amount. */
export function encashmentAmount(i: { days: number; basic: string | number; rate: "BASIC_DAILY" | "FIXED_AMOUNT"; fixed: number | null }): { perDay: string; amount: string } {
  const perDay = i.rate === "FIXED_AMOUNT" && i.fixed && i.fixed > 0 ? new Decimal(i.fixed) : new Decimal(i.basic).div(30);
  return { perDay: money(perDay), amount: money(perDay.times(i.days)) };
}

export interface SettlementFiguresInput {
  /** The last month's pay (null when it was already paid in a locked run). */
  month: { label: string; grossEarnings: string; statutoryDeductions: { label: string; amount: string }[]; taxableGross: string } | null;
  encashment: { label: string; amount: string }[];
  gratuity: { amount: string; withholdingPct: number };
  funds: { label: string; employee: string; employer: string }[];
  loans: { label: string; remaining: string }[];
  noticeRecovery: string;
}

/**
 * The settlement payslip's lines. Taxed once through the projection: the
 * month's pay, the leave encashment and the employer's fund share; the
 * employee's own fund money is not income; the gratuity is withheld at its
 * own flat rate and never enters the projection.
 */
export function settlementFigures(i: SettlementFiguresInput): SettlementFigures {
  const earnings: SettlementFigures["earnings"] = [];
  const deductions: SettlementFigures["deductions"] = [];
  let gross = new Decimal(0);
  let total = new Decimal(0);
  let taxable = new Decimal(0);
  let oneOff = new Decimal(0);
  if (i.month) {
    earnings.push({ code: "MONTH", label: `Pay for ${i.month.label}`, amount: i.month.grossEarnings });
    gross = gross.plus(i.month.grossEarnings);
    taxable = taxable.plus(i.month.taxableGross);
    for (const d of i.month.statutoryDeductions) {
      deductions.push({ code: "MONTH", label: d.label, amount: d.amount });
      total = total.plus(d.amount);
    }
  }
  for (const e of i.encashment) {
    if (new Decimal(e.amount).lte(0)) continue;
    earnings.push({ code: "ENCASHMENT", label: e.label, amount: e.amount });
    gross = gross.plus(e.amount);
    taxable = taxable.plus(e.amount);
    oneOff = oneOff.plus(e.amount);
  }
  const gratuity = new Decimal(i.gratuity.amount);
  let withheld = new Decimal(0);
  if (gratuity.gt(0)) {
    earnings.push({ code: "GRATUITY", label: "Gratuity", amount: money(gratuity) });
    gross = gross.plus(gratuity);
    withheld = gratuity.times(i.gratuity.withholdingPct).div(100).toDecimalPlaces(2);
    if (withheld.gt(0)) {
      deductions.push({ code: "GRATUITY_TDS", label: `Tax withheld on gratuity (${i.gratuity.withholdingPct}%)`, amount: money(withheld) });
      total = total.plus(withheld);
    }
  }
  for (const f of i.funds) {
    const amount = new Decimal(f.employee).plus(f.employer);
    if (amount.lte(0)) continue;
    earnings.push({ code: "FUND_PAYOUT", label: `${f.label} payout`, amount: money(amount) });
    gross = gross.plus(amount);
    taxable = taxable.plus(f.employer);
    oneOff = oneOff.plus(f.employer);
  }
  for (const l of i.loans) {
    if (new Decimal(l.remaining).lte(0)) continue;
    deductions.push({ code: "LOAN_CLOSEOUT", label: `${l.label} closed out`, amount: l.remaining });
    total = total.plus(l.remaining);
  }
  const notice = new Decimal(i.noticeRecovery || 0);
  if (notice.gt(0)) {
    deductions.push({ code: "NOTICE_RECOVERY", label: "Notice period recovery", amount: money(notice) });
    total = total.plus(notice);
  }
  return {
    earnings,
    deductions,
    grossEarnings: money(gross),
    totalDeductions: money(total),
    taxableGross: money(Decimal.max(0, taxable)),
    oneOffTaxable: money(oneOff),
    gratuityWithheld: money(withheld),
  };
}

/** Why the slip cannot be paid as it stands (null when it can). */
export function settlementShortfall(f: Pick<SettlementFigures, "grossEarnings" | "totalDeductions">, tds: string | number): string | null {
  const net = new Decimal(f.grossEarnings).minus(f.totalDeductions).minus(tds);
  return net.lt(0) ? `The deductions (${new Decimal(f.totalDeductions).plus(tds).toFixed(2)}) are more than the pay (${f.grossEarnings}): collect the balance before locking, or reduce the notice recovery.` : null;
}

import Decimal from "decimal.js";
import { buildTaxSheet, type PastMonth, type TaxSheet } from "@/lib/engines/tax-projection.engine";

// Full & final settlement (4.8 / F8). Pure: the service gathers the facts, this
// turns them into dated, labelled lines and a net figure. Every amount is rounded
// to the paisa per line, so the statement adds up exactly as printed.
//
//   earnings   = salary for unpaid days + leave encashment + gratuity (if the company pays it)
//   deductions = notice-period shortfall + loan outstanding + final TDS
//   net        = earnings − deductions        (welfare-fund balances are paid under Funds, shown apart)
//
// The final TDS closes the fiscal year for the person: tax on (earlier taxable income +
// this settlement's taxable lines) minus the TDS already deducted, never below zero.

export type LineSide = "earning" | "deduction";
export type LineCode = "salary" | "leave" | "gratuity" | "notice" | "loan" | "tds";

export interface SettlementLine {
  code: LineCode;
  side: LineSide;
  label: string;
  labelNp: string;
  /** How the amount was worked out, in words, for the statement. */
  basis: string;
  amount: string;
}

export interface SalaryPeriod {
  label: string;
  workedDays: number;
  monthDays: number;
}

export interface LeaveEncashment {
  leaveType: string;
  days: number;
  perDayRate: string;
}

export interface SettlementPolicy {
  /** Notice the company requires of a resigning employee, in days. 0 = no recovery. */
  noticeDays: number;
  gratuity: {
    enabled: boolean;
    /** Completed years of service before gratuity is payable. */
    minYears: number;
    /** Months of basic salary paid per completed year of service. */
    monthsPerYear: number;
  };
}

export const DEFAULT_POLICY: SettlementPolicy = {
  noticeDays: 0,
  gratuity: { enabled: false, minYears: 0, monthsPerYear: 0 },
};

export interface SettlementInput {
  kind: string;
  monthlyBasic: string;
  monthlyGrade: string;
  periods: SalaryPeriod[];
  leave: LeaveEncashment[];
  /** Days between the notice and the last working day (resignation only). */
  noticeServedDays: number | null;
  yearsOfService: number;
  loanOutstanding: string;
  past: readonly PastMonth[];
  taxOn: (annualTaxable: Decimal) => Decimal;
  policy: SettlementPolicy;
}

export interface Settlement {
  lines: SettlementLine[];
  earnings: string;
  deductions: string;
  net: string;
  taxSheet: TaxSheet | null;
  /** True when the deductions exceed the earnings: the employee owes the company. */
  recovery: boolean;
}

const money = (v: Decimal.Value) => new Decimal(v || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function normalizePolicy(raw: unknown): SettlementPolicy {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const g = (r.gratuity && typeof r.gratuity === "object" ? r.gratuity : {}) as Record<string, unknown>;
  const num = (v: unknown, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
  };
  return {
    noticeDays: Math.floor(num(r.noticeDays, 365)),
    gratuity: {
      enabled: g.enabled === true,
      minYears: Math.floor(num(g.minYears, 50)),
      monthsPerYear: num(g.monthsPerYear, 12),
    },
  };
}

export function validatePolicy(p: SettlementPolicy): Record<string, string> {
  const errors: Record<string, string> = {};
  if (p.gratuity.enabled && p.gratuity.monthsPerYear <= 0) errors.monthsPerYear = "Enter the months of basic salary paid per year of service.";
  return errors;
}

/** Completed years between two ISO dates (AD), never negative. */
export function completedYears(joiningAd: string, lastDayAd: string): number {
  const a = new Date(`${joiningAd}T00:00:00Z`);
  const b = new Date(`${lastDayAd}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  const beforeAnniversary = b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

export function buildSettlement(i: SettlementInput): Settlement {
  const lines: SettlementLine[] = [];
  const monthly = new Decimal(i.monthlyBasic || 0).plus(i.monthlyGrade || 0);

  // 1. Salary for the days not yet paid by a payroll run (basic + grade, pro rata by BS month).
  let salary = new Decimal(0);
  const parts: string[] = [];
  for (const p of i.periods) {
    if (p.workedDays <= 0 || p.monthDays <= 0) continue;
    const days = Math.min(p.workedDays, p.monthDays);
    salary = salary.plus(money(monthly.times(days).dividedBy(p.monthDays)));
    parts.push(`${p.label} ${days}/${p.monthDays}`);
  }
  if (salary.gt(0)) {
    lines.push({
      code: "salary",
      side: "earning",
      label: "Salary for unpaid days",
      labelNp: "बाँकी दिनको तलब",
      basis: `Basic + grade ${money(monthly).toFixed(2)} × days worked ÷ days in month (${parts.join(", ")})`,
      amount: salary.toFixed(2),
    });
  }

  // 2. Leave encashment (the rate already comes from the leave type).
  for (const l of i.leave) {
    const amount = money(new Decimal(l.perDayRate || 0).times(l.days));
    if (l.days <= 0 || amount.lte(0)) continue;
    lines.push({
      code: "leave",
      side: "earning",
      label: `Leave encashment — ${l.leaveType}`,
      labelNp: `बिदा साटो रकम — ${l.leaveType}`,
      basis: `${l.days} day(s) × ${money(l.perDayRate).toFixed(2)} per day`,
      amount: amount.toFixed(2),
    });
  }

  // 3. Gratuity, only when the company has switched it on and the person qualifies.
  let gratuity = new Decimal(0);
  const g = i.policy.gratuity;
  if (g.enabled && g.monthsPerYear > 0 && i.yearsOfService >= Math.max(1, g.minYears) && i.kind !== "termination") {
    gratuity = money(new Decimal(i.monthlyBasic || 0).times(g.monthsPerYear).times(i.yearsOfService));
    if (gratuity.gt(0)) {
      lines.push({
        code: "gratuity",
        side: "earning",
        label: "Gratuity",
        labelNp: "उपदान",
        basis: `Basic ${money(i.monthlyBasic).toFixed(2)} × ${g.monthsPerYear} month(s) × ${i.yearsOfService} completed year(s)`,
        amount: gratuity.toFixed(2),
      });
    }
  }

  // 4. Notice shortfall: a resigning employee who leaves early repays the missing days.
  if (i.kind === "resignation" && i.policy.noticeDays > 0 && i.noticeServedDays !== null && i.noticeServedDays < i.policy.noticeDays) {
    const short = i.policy.noticeDays - Math.max(0, i.noticeServedDays);
    const amount = money(monthly.dividedBy(30).times(short));
    if (amount.gt(0)) {
      lines.push({
        code: "notice",
        side: "deduction",
        label: "Notice period shortfall",
        labelNp: "सूचना अवधि घटी",
        basis: `${short} day(s) short of ${i.policy.noticeDays} × ${money(monthly.dividedBy(30)).toFixed(2)} per day`,
        amount: amount.toFixed(2),
      });
    }
  }

  // 5. Loans still running are recovered from what is owed.
  const loan = money(i.loanOutstanding);
  if (loan.gt(0)) {
    lines.push({
      code: "loan",
      side: "deduction",
      label: "Loan outstanding",
      labelNp: "बाँकी ऋण",
      basis: "Remaining principal of active loans",
      amount: loan.toFixed(2),
    });
  }

  // 6. Final TDS on the taxable lines (salary and leave; gratuity is not taxed here).
  const taxable = salary.plus(lines.filter((l) => l.code === "leave").reduce((s, l) => s.plus(l.amount), new Decimal(0)));
  let taxSheet: TaxSheet | null = null;
  if (taxable.gt(0)) {
    taxSheet = buildTaxSheet({ past: i.past, currentTaxable: taxable, monthsRemaining: 1, taxOn: i.taxOn });
    const tds = money(taxSheet.taxToCollect);
    if (tds.gt(0)) {
      lines.push({
        code: "tds",
        side: "deduction",
        label: "Income tax (final TDS)",
        labelNp: "आयकर (अन्तिम टीडीएस)",
        basis: `Tax on ${money(taxSheet.projectedAnnualTaxable).toFixed(2)} (earlier months + this settlement) less ${money(taxSheet.ytdTds).toFixed(2)} already deducted`,
        amount: tds.toFixed(2),
      });
    }
  }

  const sum = (side: LineSide) => lines.filter((l) => l.side === side).reduce((s, l) => s.plus(l.amount), new Decimal(0));
  const earnings = sum("earning");
  const deductions = sum("deduction");
  const net = earnings.minus(deductions);
  return {
    lines,
    earnings: earnings.toFixed(2),
    deductions: deductions.toFixed(2),
    net: net.toFixed(2),
    taxSheet,
    recovery: net.lt(0),
  };
}

// ── Workflow ────────────────────────────────────────────────────────────────

export type SettlementStatus = "draft" | "approved" | "paid";

/** The only moves: draft → approved → paid. A different person approves than prepared. */
export function canMove(from: SettlementStatus, to: SettlementStatus, preparedBy: string, actor: string): string | null {
  if (from === "draft" && to === "approved") return preparedBy === actor ? "Someone other than the preparer must approve the settlement." : null;
  if (from === "approved" && to === "paid") return null;
  return `A ${from} settlement cannot move to ${to}.`;
}

// Arrears (4.8b). Pure: no database access.
// A locked payslip is never changed. When a month already paid should have
// been paid differently (a back-dated salary revision, attendance corrected
// after the lock), the difference is worked out component by component and
// paid in an ARREARS run, one line per source month.

import Decimal from "decimal.js";
import type { PayrollSlip, PayrollSlipHead } from "@/lib/types/payroll";
import type { ArrearsComponents, ArrearsMonthLine, ArrearsSlipFigures } from "@/lib/types/payroll-run";

export const ARREARS_COMPONENTS = ["basic", "grade", "allowances", "otAmount", "absentDeduction", "grossEarnings", "pfEmployee", "pfEmployer", "ssfEmployee", "ssfEmployer", "citDeduction", "otherDeductions"] as const;

/** Differences smaller than a paisa are rounding, not arrears. */
const MATERIAL = 0.01;

const d = (v: string | number | null | undefined) => new Decimal(v || 0);
const s = (v: Decimal) => v.toDecimalPlaces(2).toString();

export const ZERO_COMPONENTS: ArrearsComponents = Object.fromEntries(ARREARS_COMPONENTS.map((k) => [k, "0"])) as unknown as ArrearsComponents;

/**
 * A payslip's pay broken into the parts arrears compare: basic, grade, the
 * allowance heads (festival, OT and the unpaid-day deduction excluded: they
 * have their own parts), overtime, unpaid days, gross, retirement
 * contributions, CIT and the other deduction heads (loans, funds and income
 * tax are not compared: they are settled at the time).
 */
export function componentsOf(
  slip: Pick<PayrollSlip, "basicSalary" | "gradeAmount" | "grossEarnings" | "otAmount" | "absentDeduction" | "pfEmployee" | "pfEmployer" | "ssfEmployee" | "ssfEmployer" | "citDeduction">,
  heads: readonly Pick<PayrollSlipHead, "headType" | "calculatedAmount" | "payHeadId">[],
  flags: { isStatutory: (payHeadId: string) => boolean; isOtOrAbsent: (payHeadId: string) => boolean }
): ArrearsComponents {
  let allowances = new Decimal(0);
  let other = new Decimal(0);
  for (const h of heads) {
    if (flags.isStatutory(h.payHeadId) || flags.isOtOrAbsent(h.payHeadId)) continue;
    if (h.headType === "allowance") allowances = allowances.plus(d(h.calculatedAmount));
    else other = other.plus(d(h.calculatedAmount));
  }
  return {
    basic: s(d(slip.basicSalary)),
    grade: s(d(slip.gradeAmount)),
    allowances: s(allowances),
    otAmount: s(d(slip.otAmount)),
    absentDeduction: s(d(slip.absentDeduction)),
    grossEarnings: s(d(slip.grossEarnings)),
    pfEmployee: s(d(slip.pfEmployee)),
    pfEmployer: s(d(slip.pfEmployer)),
    ssfEmployee: s(d(slip.ssfEmployee)),
    ssfEmployer: s(d(slip.ssfEmployer)),
    citDeduction: s(d(slip.citDeduction)),
    otherDeductions: s(other),
  };
}

export function sumComponents(list: readonly ArrearsComponents[]): ArrearsComponents {
  const out: Record<string, Decimal> = {};
  for (const k of ARREARS_COMPONENTS) out[k] = new Decimal(0);
  for (const c of list) for (const k of ARREARS_COMPONENTS) out[k] = out[k].plus(d(c[k]));
  return Object.fromEntries(ARREARS_COMPONENTS.map((k) => [k, s(out[k])])) as unknown as ArrearsComponents;
}

/** due − paid, and whether any part is worth paying. */
export function diffComponents(due: ArrearsComponents, paid: ArrearsComponents): { diff: ArrearsComponents; material: boolean } {
  const diff = Object.fromEntries(ARREARS_COMPONENTS.map((k) => [k, s(d(due[k]).minus(d(paid[k])))])) as unknown as ArrearsComponents;
  const material = ARREARS_COMPONENTS.some((k) => d(diff[k]).abs().gte(MATERIAL));
  return { diff, material };
}

/**
 * What an arrears payslip pays for a set of month lines: one earning per
 * month (basic + grade + allowances + overtime − unpaid days, as a difference;
 * a negative month becomes a recovery), the employee's retirement and CIT
 * differences as deductions (negative → refunded as an earning), and the
 * taxable one-off for the tax projection (the positive earnings).
 */
export function arrearsSlipFigures(lines: readonly ArrearsMonthLine[]): ArrearsSlipFigures {
  const earnings: ArrearsSlipFigures["earnings"] = [];
  const deductions: ArrearsSlipFigures["deductions"] = [];
  let gross = new Decimal(0);
  let totalDeductions = new Decimal(0);
  let taxable = new Decimal(0);
  let retirement = new Decimal(0);
  let cit = new Decimal(0);
  let pfEmployee = new Decimal(0);
  let pfEmployer = new Decimal(0);
  let ssfEmployee = new Decimal(0);
  let ssfEmployer = new Decimal(0);
  for (const l of lines) {
    // The gross difference, not the sum of the parts: slips made before 4.8 split the heads
    // differently (the grade as a head, the employer's SSF inside the gross), so the parts explain
    // the line without defining it.
    const pay = d(l.diff.grossEarnings);
    if (pay.gt(0)) {
      earnings.push({ label: `Arrears · ${l.label}`, amount: s(pay) });
      gross = gross.plus(pay);
      taxable = taxable.plus(pay);
    } else if (pay.lt(0)) {
      deductions.push({ label: `Recovery · ${l.label}`, amount: s(pay.abs()) });
      totalDeductions = totalDeductions.plus(pay.abs());
    }
    const employeeSide = d(l.diff.pfEmployee).plus(l.diff.ssfEmployee).plus(l.diff.citDeduction).plus(l.diff.otherDeductions);
    if (employeeSide.gt(0)) {
      deductions.push({ label: `Contributions · ${l.label}`, amount: s(employeeSide) });
      totalDeductions = totalDeductions.plus(employeeSide);
    } else if (employeeSide.lt(0)) {
      earnings.push({ label: `Contributions refunded · ${l.label}`, amount: s(employeeSide.abs()) });
      gross = gross.plus(employeeSide.abs());
    }
    retirement = retirement.plus(l.diff.pfEmployee).plus(l.diff.ssfEmployee).plus(l.diff.ssfEmployer);
    cit = cit.plus(l.diff.citDeduction);
    pfEmployee = pfEmployee.plus(l.diff.pfEmployee);
    pfEmployer = pfEmployer.plus(l.diff.pfEmployer);
    ssfEmployee = ssfEmployee.plus(l.diff.ssfEmployee);
    ssfEmployer = ssfEmployer.plus(l.diff.ssfEmployer);
  }
  return {
    earnings,
    deductions,
    grossEarnings: s(gross),
    totalDeductions: s(totalDeductions),
    taxableGross: s(taxable),
    retirement: s(Decimal.max(0, retirement)),
    cit: s(Decimal.max(0, cit)),
    pfEmployee: s(pfEmployee),
    pfEmployer: s(pfEmployer),
    ssfEmployee: s(ssfEmployee),
    ssfEmployer: s(ssfEmployer),
  };
}

/** "Bhadra 2083: salary revision" / "attendance corrected". */
export function describeLine(l: Pick<ArrearsMonthLine, "label" | "kind">): string {
  return `${l.label}: ${l.kind === "salary" ? "salary revision" : "attendance corrected"}`;
}

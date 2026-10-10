/**
 * Rules & controls (4.12b) — pure logic for the company rules payroll reads:
 * retirement and insurance limits, the remote-area cap, the women's rebate,
 * SSF, the overtime multipliers used when no overtime rule is active, and
 * the grade policy. The form is flat; `applyRulesForm` merges it back into
 * the stored settings without touching anything else. Shared by the screen
 * (live checks, the change list before Save) and the service (the real
 * check). Tests: tests/rules.engine.test.ts.
 */

import { DEFAULT_GRADE_POLICY } from "@/lib/engines/grade-policy.engine";
import { OT_MIN_MULTIPLIER } from "@/lib/engines/ot-pay.engine";
import type { GradeCalculationMethod, GradePolicySettings, RulesChange, RulesErrors, RulesForm, SsfBase, SystemControlData } from "@/lib/types/system-control";

export type RuleUnit = "npr" | "percent" | "times" | "days" | "grades" | "yesno" | "ssfBase" | "gradeMethod";

export const RULE_FIELDS: Record<keyof RulesForm, { label: string; unit: RuleUnit }> = {
  pfMaxPercent: { label: "PF, at most this share of basic + grade", unit: "percent" },
  citLimit: { label: "CIT counted a year", unit: "npr" },
  retirementLimit: { label: "Retirement contributions counted a year", unit: "npr" },
  lifeInsuranceLimit: { label: "Life insurance premium a year", unit: "npr" },
  healthInsuranceLimit: { label: "Health insurance premium a year", unit: "npr" },
  houseInsuranceLimit: { label: "House insurance premium a year", unit: "npr" },
  remoteAreaLimit: { label: "Remote area allowance, most a payment", unit: "npr" },
  womenRebatePercent: { label: "Women's tax rebate", unit: "percent" },
  companyHasSsf: { label: "The company is in SSF", unit: "yesno" },
  ssfBase: { label: "SSF worked out on", unit: "ssfBase" },
  otWorkDay: { label: "Overtime on a working day", unit: "times" },
  otOffDay: { label: "Overtime on an off day", unit: "times" },
  gradeMethod: { label: "Grade policy", unit: "gradeMethod" },
  gradeDaysInMonth: { label: "Days in a month (one grade = basic ÷ days)", unit: "days" },
  gradePercent: { label: "Share of basic per grade", unit: "percent" },
  gradeAmount: { label: "Amount per grade", unit: "npr" },
  gradeMax: { label: "Most grades counted", unit: "grades" },
};

export const RULE_KEYS = Object.keys(RULE_FIELDS) as (keyof RulesForm)[];

export const SSF_BASE_LABEL: Record<SsfBase, string> = {
  BasicPlusGrade: "Basic + grade",
  BasicSalary: "Basic salary only",
};

export const GRADE_METHODS: { value: GradeCalculationMethod; label: string; hint: string }[] = [
  { value: "STATUTORY_DAILY_RATE", label: "One day's basic per grade", hint: "Basic ÷ days in a month — the usual rule in Nepal" },
  { value: "PERCENTAGE_OF_BASIC", label: "A share of basic per grade", hint: "e.g. 3.33% of basic for each grade" },
  { value: "FIXED_AMOUNT_PER_GRADE", label: "A fixed amount per grade", hint: "The same rupees for each grade, whatever the basic" },
  { value: "MANUAL_INPUT", label: "Typed in for each employee", hint: "No formula: the grade amount is typed in Salary structure" },
  { value: "DISABLED_NO_GRADES", label: "Grades are not used", hint: "Pay is basic only: every worked-out grade becomes 0" },
];

export const GRADE_METHOD_LABEL = Object.fromEntries(GRADE_METHODS.map((m) => [m.value, m.label])) as Record<GradeCalculationMethod, string>;

/** The most the multipliers may be set to (a typing slip, not a law). */
export const OT_MAX_MULTIPLIER = 5;

const finite = (n: unknown, fallback = 0) => (typeof n === "number" && Number.isFinite(n) ? n : fallback);

/** The form from the stored settings. */
export function rulesFormOf(s: SystemControlData): RulesForm {
  const g = s.gradePolicy ?? DEFAULT_GRADE_POLICY;
  return {
    pfMaxPercent: finite(s.statutoryDeductionLimits.pfMaximumLimitPercent),
    citLimit: finite(s.statutoryDeductionLimits.citLimitNpr),
    retirementLimit: finite(s.statutoryDeductionLimits.retirementFundLimitNpr),
    lifeInsuranceLimit: finite(s.insuranceDiscounts.lifeInsuranceNpr),
    healthInsuranceLimit: finite(s.insuranceDiscounts.medicalInsuranceNpr),
    houseInsuranceLimit: finite(s.insuranceDiscounts.houseInsuranceNpr),
    remoteAreaLimit: finite(s.insuranceDiscounts.remoteAllowanceNpr),
    womenRebatePercent: finite(s.insuranceDiscounts.womenDiscountPercent),
    companyHasSsf: !!s.statutoryDeductionLimits.companyHasSsf,
    ssfBase: s.statutoryDeductionLimits.ssfContributionBase === "BasicSalary" ? "BasicSalary" : "BasicPlusGrade",
    otWorkDay: finite(s.officeTime.otMultiplierOfficeDay, 1.5),
    otOffDay: finite(s.officeTime.otMultiplierOffDay, 2),
    gradeMethod: g.calculationMethod,
    gradeDaysInMonth: finite(g.daysInMonthForDailyRate, 30),
    gradePercent: finite(g.fixedGradePercent),
    gradeAmount: finite(g.fixedAmountPerGrade),
    gradeMax: finite(g.maxGradesAllowedPerLevel),
  };
}

const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : NaN);

/** The form from the browser: numbers, yes / no and the known choices only. */
export function normalizeRulesForm(raw: unknown): RulesForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const method = GRADE_METHODS.some((m) => m.value === r.gradeMethod) ? (r.gradeMethod as GradeCalculationMethod) : ("" as GradeCalculationMethod);
  return {
    pfMaxPercent: num(r.pfMaxPercent),
    citLimit: num(r.citLimit),
    retirementLimit: num(r.retirementLimit),
    lifeInsuranceLimit: num(r.lifeInsuranceLimit),
    healthInsuranceLimit: num(r.healthInsuranceLimit),
    houseInsuranceLimit: num(r.houseInsuranceLimit),
    remoteAreaLimit: num(r.remoteAreaLimit),
    womenRebatePercent: num(r.womenRebatePercent),
    companyHasSsf: r.companyHasSsf === true,
    ssfBase: r.ssfBase === "BasicSalary" ? "BasicSalary" : "BasicPlusGrade",
    otWorkDay: num(r.otWorkDay),
    otOffDay: num(r.otOffDay),
    gradeMethod: method,
    gradeDaysInMonth: num(r.gradeDaysInMonth),
    gradePercent: num(r.gradePercent),
    gradeAmount: num(r.gradeAmount),
    gradeMax: num(r.gradeMax),
  };
}

const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;
const RUPEE_CAP = 1_00_00_00_000;

/** Every field in range; the grade policy's own figure is required for its method. */
export function validateRulesForm(f: RulesForm): RulesErrors {
  const e: RulesErrors = {};
  const percent = (k: keyof RulesForm, v: number) => {
    if (!Number.isFinite(v) || v < 0 || v > 100) e[k] = "0 to 100.";
    else if (decimals(v) > 2) e[k] = "At most two decimals.";
  };
  const rupees = (k: keyof RulesForm, v: number) => {
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v) || v > RUPEE_CAP) e[k] = "Whole rupees, 0 or more.";
  };
  percent("pfMaxPercent", f.pfMaxPercent);
  rupees("citLimit", f.citLimit);
  rupees("retirementLimit", f.retirementLimit);
  rupees("lifeInsuranceLimit", f.lifeInsuranceLimit);
  rupees("healthInsuranceLimit", f.healthInsuranceLimit);
  rupees("houseInsuranceLimit", f.houseInsuranceLimit);
  rupees("remoteAreaLimit", f.remoteAreaLimit);
  percent("womenRebatePercent", f.womenRebatePercent);
  for (const k of ["otWorkDay", "otOffDay"] as const) {
    const v = f[k];
    if (!Number.isFinite(v) || v < OT_MIN_MULTIPLIER) e[k] = `At least ${OT_MIN_MULTIPLIER} (Labour Act 2074).`;
    else if (v > OT_MAX_MULTIPLIER) e[k] = `At most ${OT_MAX_MULTIPLIER}.`;
    else if (decimals(v) > 2) e[k] = "At most two decimals.";
  }
  if (!GRADE_METHODS.some((m) => m.value === f.gradeMethod)) e.gradeMethod = "Choose how grades are worked out.";
  if (!Number.isInteger(f.gradeDaysInMonth) || f.gradeDaysInMonth < 1 || f.gradeDaysInMonth > 32) e.gradeDaysInMonth = "1 to 32 days.";
  percent("gradePercent", f.gradePercent);
  if (!e.gradePercent && f.gradeMethod === "PERCENTAGE_OF_BASIC" && !(f.gradePercent > 0)) e.gradePercent = "Give the share of basic one grade is.";
  rupees("gradeAmount", f.gradeAmount);
  if (!e.gradeAmount && f.gradeMethod === "FIXED_AMOUNT_PER_GRADE" && !(f.gradeAmount > 0)) e.gradeAmount = "Give the amount one grade is.";
  if (!Number.isInteger(f.gradeMax) || f.gradeMax < 0 || f.gradeMax > 100) e.gradeMax = "0 (no limit) to 100 grades.";
  return e;
}

export const rulesAreValid = (e: RulesErrors) => Object.keys(e).length === 0;

/** A value in words, for the change list and the audit line. */
export function formatRule(key: keyof RulesForm, value: RulesForm[keyof RulesForm]): string {
  const unit = RULE_FIELDS[key].unit;
  switch (unit) {
    case "npr":
      return `NPR ${Number(value).toLocaleString("en-IN")}`;
    case "percent":
      return `${value}%`;
    case "times":
      return `${value}×`;
    case "days":
      return `${value} days`;
    case "grades":
      return Number(value) === 0 ? "No limit" : `${value} grade${value === 1 ? "" : "s"}`;
    case "yesno":
      return value ? "Yes" : "No";
    case "ssfBase":
      return SSF_BASE_LABEL[value as SsfBase] ?? String(value);
    case "gradeMethod":
      return GRADE_METHOD_LABEL[value as GradeCalculationMethod] ?? String(value);
  }
}

const same = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : a === b);

/** What saving `after` over `before` changes, field by field, in words. */
export function rulesChanges(before: RulesForm, after: RulesForm): RulesChange[] {
  return RULE_KEYS.filter((k) => !same(before[k], after[k])).map((k) => ({ key: k, label: RULE_FIELDS[k].label, from: formatRule(k, before[k]), to: formatRule(k, after[k]) }));
}

/** The grade policy the form describes (the promotion rule, not on the form, is kept). */
export function gradePolicyOf(f: RulesForm, base: GradePolicySettings | undefined = undefined): GradePolicySettings {
  const b = base ?? DEFAULT_GRADE_POLICY;
  return {
    calculationMethod: f.gradeMethod,
    daysInMonthForDailyRate: f.gradeDaysInMonth,
    fixedGradePercent: f.gradePercent,
    fixedAmountPerGrade: f.gradeAmount,
    maxGradesAllowedPerLevel: f.gradeMax,
    promotionRule: b.promotionRule,
  };
}

/** Whether the grade amounts it works out can differ: the method, its own figure, or the cap. */
export function gradePolicyChanged(before: RulesForm, after: RulesForm): boolean {
  if (before.gradeMethod !== after.gradeMethod) return true;
  switch (after.gradeMethod) {
    case "STATUTORY_DAILY_RATE":
      return !same(before.gradeDaysInMonth, after.gradeDaysInMonth) || !same(before.gradeMax, after.gradeMax);
    case "PERCENTAGE_OF_BASIC":
      return !same(before.gradePercent, after.gradePercent) || !same(before.gradeMax, after.gradeMax);
    case "FIXED_AMOUNT_PER_GRADE":
      return !same(before.gradeAmount, after.gradeAmount) || !same(before.gradeMax, after.gradeMax);
    default:
      return false;
  }
}

/** The stored settings with the form's rules put in; everything else is kept as it is. */
export function applyRulesForm(s: SystemControlData, f: RulesForm): SystemControlData {
  return {
    ...s,
    officeTime: { ...s.officeTime, otMultiplierOfficeDay: f.otWorkDay, otMultiplierOffDay: f.otOffDay },
    statutoryDeductionLimits: {
      ...s.statutoryDeductionLimits,
      pfMaximumLimitPercent: f.pfMaxPercent,
      citLimitNpr: f.citLimit,
      retirementFundLimitNpr: f.retirementLimit,
      companyHasSsf: f.companyHasSsf,
      ssfContributionBase: f.ssfBase,
      handicappedDeductionPercent: 0,
    },
    insuranceDiscounts: {
      ...s.insuranceDiscounts,
      lifeInsuranceNpr: f.lifeInsuranceLimit,
      medicalInsuranceNpr: f.healthInsuranceLimit,
      houseInsuranceNpr: f.houseInsuranceLimit,
      remoteAllowanceNpr: f.remoteAreaLimit,
      womenDiscountPercent: f.womenRebatePercent,
      handicappedDiscountPercent: 0,
    },
    gradePolicy: gradePolicyOf(f, s.gradePolicy),
  };
}

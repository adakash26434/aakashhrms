// Salary structure (4.4): pure rules. How pay heads behave in a structure,
// monthly totals for previews (the same SSF rule as payroll), grade by the
// policy, validation, revisions in force, batch summaries, approval rules,
// templates and CSV import matching. No database access here.

import Decimal from "decimal.js";
import { isLabelHead, labelNames } from "@/lib/constants/label-heads";
import { calculateTotalGradeAmount, DEFAULT_GRADE_POLICY } from "@/lib/engines/grade-policy.engine";
import {
  calculatePayslip,
  isSsfDeductionHead,
  isSsfEmployerHead,
  NegativeNetPayableError,
  ssfContribution,
  type PayHeadInput,
} from "@/lib/engines/payroll.engine";
import type { GradePolicySettings, SystemControlData } from "@/lib/types/system-control";
import type {
  BreakdownItem,
  HeadKind,
  PayProfile,
  RetirementScheme,
  StructureHead,
  StructureLines,
  StructureTab,
  StructureTotals,
  TaxRules,
  TemplateRow,
} from "@/lib/types/salary-structure";
import { STRUCTURE_TABS } from "@/lib/types/salary-structure";

// ---------------------------------------------------------------------------
// Pay heads
// ---------------------------------------------------------------------------

export interface PayHeadLike {
  id: string;
  code: string;
  name: string;
  type: string;
  calcBasis: string;
  calcParameter: string;
  calcPercent: string | number | null;
  isFestivalAllowance: boolean;
  isAbsentDeduct: boolean;
  isOtHead: boolean;
  isLeaveHead: boolean;
  isTdsHead: boolean;
  isPfHead: boolean;
  isSsfHead: boolean;
  isSsfEmployerHead?: boolean;
  isRemoteAllowance: boolean;
  isCitHead: boolean;
  /** Part of taxable income (payroll's effectOnTax). */
  effectOnTax?: boolean;
  applicableDepartmentIds?: string[];
  applicableDesignationIds?: string[];
}

/** The pay head as payroll's calculatePayslip reads it (without an amount). */
function payrollView(h: PayHeadLike): Omit<PayHeadInput, "amount"> {
  const like = { code: h.code, name: h.name, type: h.type, isSsfHead: h.isSsfHead, isSsfEmployerHead: h.isSsfEmployerHead } as Parameters<typeof isSsfDeductionHead>[0];
  return {
    id: h.id,
    code: h.code,
    name: h.name,
    type: h.type === "deduction" ? "deduction" : "allowance",
    effectOnTax: h.effectOnTax ?? true,
    isFestivalAllowance: h.isFestivalAllowance,
    isAbsentDeduct: h.isAbsentDeduct,
    isOtHead: h.isOtHead,
    isLeaveHead: h.isLeaveHead,
    isTdsHead: h.isTdsHead,
    isPfHead: h.isPfHead,
    // As payroll.service reads them: name / code conventions count too.
    isSsfHead: Boolean(h.isSsfHead || isSsfDeductionHead(like)),
    isSsfEmployerHead: Boolean(h.isSsfEmployerHead || isSsfEmployerHead(like)),
    isRemoteAllowance: h.isRemoteAllowance,
    isCitHead: h.isCitHead,
    calcBasis: h.calcBasis,
    calcParameter: h.calcParameter,
    calcPercent: String(Number(h.calcPercent) || 0),
    isManualOverride: false,
  };
}

/** How a pay head behaves in a salary structure (see HeadKind). */
export function classifyHead(h: PayHeadLike): StructureHead {
  const percent = Number(h.calcPercent) || 0;
  const percentBase = h.calcBasis === "BasicPlusGrade" ? "basicPlusGrade" : "basic";
  const base = {
    id: h.id,
    code: h.code,
    name: h.name,
    type: (h.type === "deduction" ? "deduction" : "allowance") as "allowance" | "deduction",
    percent: 0,
    percentBase: percentBase as "basic" | "basicPlusGrade",
    occasional: false,
    payroll: payrollView(h),
    appliesTo: { departmentIds: h.applicableDepartmentIds ?? [], designationIds: h.applicableDesignationIds ?? [] },
  };
  const like = { code: h.code, name: h.name, type: h.type, isSsfHead: h.isSsfHead, isSsfEmployerHead: h.isSsfEmployerHead } as Parameters<typeof isSsfDeductionHead>[0];
  let kind: HeadKind;
  let rule: string;
  let scheme: "ssf" | "pf" | undefined;
  if (isLabelHead(h)) {
    // Onboarding's "Basic Salary" / "Grade Amount" heads are labels (4.12e): payroll takes basic
    // and grade from the structure itself. An amount a structure still holds on one is paid on top
    // of them until it is revised away; no change takes a new one (validateLines).
    return { ...base, kind: "amount", labelOnly: true, rule: `A label for ${labelNames(h)}: holds no amount (one still held is paid on top of ${labelNames(h)})` };
  } else if (h.isTdsHead || h.isOtHead || h.isAbsentDeduct || h.isLeaveHead) {
    kind = "auto";
    rule = h.isTdsHead ? "Income tax, worked out by payroll" : h.isOtHead ? "From overtime" : "From attendance and leave";
  } else if (h.isSsfHead || h.isSsfEmployerHead || isSsfDeductionHead(like) || isSsfEmployerHead(like)) {
    kind = "scheme";
    scheme = "ssf";
    rule = "SSF: 11% employee, 20% employer";
  } else if (h.isPfHead) {
    kind = "scheme";
    scheme = "pf";
    rule = "Provident fund";
  } else if (h.isFestivalAllowance) {
    return { ...base, kind: "computed", rule: "Festival month only", occasional: true };
  } else if (h.isRemoteAllowance) {
    return { ...base, kind: "computed", rule: "Remote-area months only", occasional: true };
  } else if (percent > 0 && h.calcParameter !== "FixedAmount" && h.calcBasis !== "None") {
    return { ...base, kind: "computed", percent, rule: `${percent}% of ${percentBase === "basic" ? "basic" : "basic + grade"}` };
  } else {
    kind = "amount";
    rule = h.isCitHead ? "CIT: monthly amount" : "Monthly amount";
  }
  return { ...base, kind, rule, scheme };
}

// ---------------------------------------------------------------------------
// Lines ↔ stored pay-head rows
// ---------------------------------------------------------------------------

export const EMPTY_LINES: StructureLines = { basic: 0, gradeCount: 0, gradeAmount: 0, gradeManual: false, scheme: "none", amounts: {}, computed: [] };

/** A revision's stored pay heads as editable lines. */
export function linesFromHeads(
  base: { basic: number; gradeCount: number; gradeAmount: number; gradeManual: boolean },
  stored: readonly { payHeadId: string; amount: number }[],
  heads: readonly StructureHead[]
): StructureLines {
  const byId = new Map(heads.map((h) => [h.id, h]));
  const lines: StructureLines = { ...base, scheme: "none", amounts: {}, computed: [] };
  for (const s of stored) {
    const h = byId.get(s.payHeadId);
    if (!h) continue;
    if (h.kind === "scheme") lines.scheme = h.scheme === "pf" && lines.scheme !== "ssf" ? "pf" : "ssf";
    else if (h.kind === "computed") lines.computed.push(h.id);
    else if (h.kind === "amount") lines.amounts[h.id] = Number(s.amount) || 0;
  }
  return lines;
}

/** The pay-head rows to store for some lines (scheme heads are assigned with amount 0: payroll works them out). */
export function headsFromLines(lines: StructureLines, heads: readonly StructureHead[]): { payHeadId: string; amount: number }[] {
  const out: { payHeadId: string; amount: number }[] = [];
  for (const h of heads) {
    if (h.kind === "amount" && (lines.amounts[h.id] ?? 0) > 0) out.push({ payHeadId: h.id, amount: round2(lines.amounts[h.id]) });
    else if (h.kind === "computed" && lines.computed.includes(h.id)) out.push({ payHeadId: h.id, amount: 0 });
    else if (h.kind === "scheme" && lines.scheme !== "none" && h.scheme === lines.scheme) out.push({ payHeadId: h.id, amount: 0 });
  }
  return out;
}

const round2 = (n: number) => new Decimal(n || 0).toDecimalPlaces(2).toNumber();

// ---------------------------------------------------------------------------
// Grade and totals
// ---------------------------------------------------------------------------

/** The grade amount these lines get: typed by hand, or worked out by the policy. */
export function gradeAmountFor(lines: Pick<StructureLines, "basic" | "gradeCount" | "gradeAmount" | "gradeManual">, policy: GradePolicySettings | null | undefined): number {
  const p = policy ?? DEFAULT_GRADE_POLICY;
  if (p.calculationMethod === "DISABLED_NO_GRADES") return 0;
  if (p.calculationMethod === "MANUAL_INPUT" || lines.gradeManual) return round2(lines.gradeAmount);
  return calculateTotalGradeAmount(lines.basic, lines.gradeCount, p);
}

export interface TotalsSettings {
  ssfBase: "BasicSalary" | "BasicPlusGrade";
  /** Provident fund percentage (employee and employer each). */
  pfPercent: number;
}

const toNum = (d: Decimal) => d.toDecimalPlaces(2).toNumber();

/**
 * Monthly breakdown without an employee (no income tax), in the payslip's
 * terms (see StructureTotals): for templates, and as a fallback. With an
 * employee, use estimatePay.
 */
export function structureTotals(lines: StructureLines, heads: readonly StructureHead[], settings: TotalsSettings): StructureTotals {
  const basic = new Decimal(lines.basic || 0);
  const grade = new Decimal(lines.gradeAmount || 0);
  const basicPlusGrade = basic.plus(grade);
  let allowances = new Decimal(0);
  let deductions = new Decimal(0);
  const items: BreakdownItem[] = [];
  for (const h of heads) {
    let amount = new Decimal(0);
    if (h.kind === "amount") amount = new Decimal(lines.amounts[h.id] || 0);
    else if (h.kind === "computed" && lines.computed.includes(h.id) && !h.occasional && h.percent > 0) {
      amount = (h.percentBase === "basic" ? basic : basicPlusGrade).times(h.percent).dividedBy(100);
    }
    if (amount.isZero()) continue;
    items.push({ id: h.id, name: h.name, type: h.type, amount: toNum(amount) });
    if (h.type === "allowance") allowances = allowances.plus(amount);
    else deductions = deductions.plus(amount);
  }
  let employee = new Decimal(0);
  let employer = new Decimal(0);
  if (lines.scheme === "ssf") {
    const s = ssfContribution(basic, grade, settings.ssfBase);
    employee = s.employee;
    employer = s.employer;
  } else if (lines.scheme === "pf") {
    employee = basicPlusGrade.times(settings.pfPercent).dividedBy(100).toDecimalPlaces(2);
    employer = employee;
  }
  const totalSalary = basicPlusGrade.plus(allowances);
  // Payslip style: the employer's SSF 20% is shown in earnings and the full 31% deducted.
  const inEarnings = lines.scheme === "ssf" ? employer : new Decimal(0);
  const grossEarnings = totalSalary.plus(inEarnings);
  const retirement = lines.scheme === "ssf" ? employee.plus(employer) : employee;
  const totalDeductions = deductions.plus(retirement);
  return {
    basic: toNum(basic),
    grade: toNum(grade),
    allowances: toNum(allowances),
    totalSalary: toNum(totalSalary),
    employerInEarnings: toNum(inEarnings),
    grossEarnings: toNum(grossEarnings),
    retirementDeduction: toNum(retirement),
    retirementEmployee: toNum(employee),
    retirementEmployer: toNum(employer),
    otherDeductions: toNum(deductions),
    incomeTax: null,
    totalDeductions: toNum(totalDeductions),
    netPayable: toNum(grossEarnings.minus(totalDeductions)),
    netBeforeTax: toNum(totalSalary.minus(deductions).minus(employee)),
    costToCompany: toNum(lines.scheme === "pf" ? grossEarnings.plus(employer) : grossEarnings),
    items,
  };
}

/** Payroll's own ids for SSF lines when the company has no SSF pay heads, and the estimate's TDS stand-in. */
const SYNTHETIC_SSF = new Set(["head-ssf-er", "head-ssf"]);
const ESTIMATE_TDS_ID = "estimate-tds";

/**
 * The pay heads payroll gives calculatePayslip for these lines, as
 * payroll.service does when it runs a month: the stored rows, a TDS head
 * always, and both SSF heads when SSF is chosen.
 */
export function payrollHeadsFor(lines: StructureLines, heads: readonly StructureHead[]): PayHeadInput[] {
  const byId = new Map(heads.map((h) => [h.id, h]));
  const out: PayHeadInput[] = headsFromLines(lines, heads).map((s) => ({ ...byId.get(s.payHeadId)!.payroll, amount: String(s.amount) }));
  const master = (pick: (h: Omit<PayHeadInput, "amount">) => boolean) => heads.find((h) => pick(h.payroll))?.payroll;
  if (!out.some((h) => h.isTdsHead)) {
    const tds = master((h) => h.isTdsHead);
    out.push(
      tds
        ? { ...tds, amount: "0" }
        : {
            ...payrollView({ id: ESTIMATE_TDS_ID, code: "TDS", name: "Income tax", type: "deduction", calcBasis: "None", calcParameter: "FixedAmount", calcPercent: 0, isFestivalAllowance: false, isAbsentDeduct: false, isOtHead: false, isLeaveHead: false, isTdsHead: true, isPfHead: false, isSsfHead: false, isRemoteAllowance: false, isCitHead: false }),
            amount: "0",
          }
    );
  }
  const hasSsf = out.some((h) => h.isSsfHead || h.isSsfEmployerHead || isSsfEmployerHead(h) || isSsfDeductionHead(h) || h.name.toLowerCase().includes("ssf"));
  if (hasSsf) {
    if (!out.some((h) => isSsfEmployerHead(h))) {
      const er = master((h) => isSsfEmployerHead(h));
      if (er) out.push({ ...er, amount: "0" });
    }
    if (!out.some((h) => isSsfDeductionHead(h))) {
      const ee = master((h) => isSsfDeductionHead(h));
      if (ee) out.push({ ...ee, amount: "0" });
    }
  }
  return out;
}

/**
 * The monthly breakdown as payroll works it out for this employee: the same
 * calculatePayslip a pay run uses (SSF / PF, CIT and insurance relief, tax
 * slabs, contract and trainee rules), for an ordinary month without overtime,
 * absence, festival / remote allowances or loans. Never re-implement pay maths.
 */
export function estimatePay(lines: StructureLines, heads: readonly StructureHead[], profile: PayProfile, tax: TaxRules, settings: TotalsSettings): StructureTotals {
  const plain = structureTotals(lines, heads, settings);
  if (!(lines.basic > 0)) return plain;
  const byId = new Map(heads.map((h) => [h.id, h]));
  try {
    const r = calculatePayslip({
      employee: { id: "estimate", category: profile.category, gender: profile.gender, isDisabled: profile.isDisabled, taxStatus: profile.taxStatus, joiningDate: profile.joiningDate },
      salaryMap: { basicSalary: String(lines.basic || 0), gradePercent: "0", gradeAmount: String(lines.gradeAmount || 0) },
      assignedHeads: payrollHeadsFor(lines, heads),
      attendanceCalc: { leaveDeductionAmount: "0", otEarnedAmount: "0" },
      loanDeduction: "0",
      systemControl: { statutoryDeductionLimits: tax.limits, insuranceDiscounts: tax.insurance } as SystemControlData,
      taxSlabs: tax.slabs,
      isFestivalMonth: false,
      isRemoteMonth: false,
      isYearEnd: false,
    });
    const d = (v: string) => new Decimal(v || 0);
    const basic = d(r.basicSalary);
    const grade = d(r.gradeAmount);
    const ssfEr = d(r.ssfEmployer);
    const ssfEe = d(r.ssfEmployee);
    const pfEe = d(r.pfEmployee);
    const pfEr = d(r.pfEmployer);
    const tds = d(r.tdsThisMonth);
    const gross = d(r.grossEarnings);
    const totalSalary = gross.minus(ssfEr);
    const retirement = pfEe.plus(ssfEe).plus(ssfEr);
    const totalDeductions = d(r.totalDeductions);
    const other = totalDeductions.minus(retirement).minus(tds);
    const employeeShare = ssfEe.gt(0) ? ssfEe : pfEe;
    const items: BreakdownItem[] = [];
    for (const h of r.heads) {
      const head = byId.get(h.payHeadId);
      // Retirement and tax have their own rows in the breakdown.
      if (SYNTHETIC_SSF.has(h.payHeadId) || h.payHeadId === ESTIMATE_TDS_ID || head?.kind === "scheme" || head?.payroll.isTdsHead) continue;
      const amount = d(h.calculatedAmount);
      if (amount.isZero()) continue;
      items.push({ id: h.payHeadId, name: head?.name ?? h.payHeadName, type: h.headType, amount: toNum(amount) });
    }
    return {
      basic: toNum(basic),
      grade: toNum(grade),
      allowances: toNum(totalSalary.minus(basic).minus(grade)),
      totalSalary: toNum(totalSalary),
      employerInEarnings: toNum(ssfEr),
      grossEarnings: toNum(gross),
      retirementDeduction: toNum(retirement),
      retirementEmployee: toNum(employeeShare),
      retirementEmployer: toNum(ssfEr.gt(0) ? ssfEr : pfEr),
      otherDeductions: toNum(other),
      incomeTax: toNum(tds),
      totalDeductions: toNum(totalDeductions),
      netPayable: toNum(d(r.netPayable)),
      netBeforeTax: toNum(totalSalary.minus(other).minus(employeeShare)),
      costToCompany: toNum(gross.plus(pfEr)),
      items,
    };
  } catch (err) {
    const problem =
      err instanceof NegativeNetPayableError
        ? "Deductions are more than earnings: payroll would refuse this salary."
        : err instanceof Error
          ? err.message
          : "The estimate could not be worked out.";
    return { ...plain, problem };
  }
}

/** Is a pay head meant for this employee (Pay heads → applicable departments / designations; empty = everyone)? */
export function headAppliesTo(h: Pick<StructureHead, "appliesTo">, employee: { departmentId: string; designationId: string }): boolean {
  const { departmentIds, designationIds } = h.appliesTo;
  return (departmentIds.length === 0 || departmentIds.includes(employee.departmentId)) && (designationIds.length === 0 || designationIds.includes(employee.designationId));
}

// ---------------------------------------------------------------------------
// Validation and changes
// ---------------------------------------------------------------------------

export interface LinesCheck {
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/**
 * Field keys: "basic", "gradeCount", "gradeAmount", "scheme", or a pay head id. `current` is the
 * structure being revised (4.12e: a label head keeps an amount it already holds, or goes to 0;
 * it never takes a new one).
 */
export function validateLines(lines: StructureLines, heads: readonly StructureHead[], levelStartingSalary = 0, current: Pick<StructureLines, "amounts"> | null = null): LinesCheck {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  if (!Number.isFinite(lines.basic) || lines.basic <= 0) errors.basic = "Basic salary must be more than 0";
  else if (lines.basic > 100_000_000) errors.basic = "That basic salary looks wrong";
  else if (levelStartingSalary > 0 && lines.basic < levelStartingSalary) warnings.basic = `Below the level's starting salary (${levelStartingSalary.toLocaleString("en-IN")})`;
  if (!Number.isInteger(lines.gradeCount) || lines.gradeCount < 0 || lines.gradeCount > 99) errors.gradeCount = "Grade count must be a whole number from 0 to 99";
  if (!Number.isFinite(lines.gradeAmount) || lines.gradeAmount < 0) errors.gradeAmount = "Grade amount cannot be negative";
  if (!["ssf", "pf", "none"].includes(lines.scheme)) errors.scheme = "Choose SSF, PF or None";
  const known = new Set(heads.filter((h) => h.kind === "amount").map((h) => h.id));
  for (const [id, amount] of Object.entries(lines.amounts)) {
    const head = heads.find((h) => h.id === id);
    if (!known.has(id)) errors[id] = "Unknown pay head";
    else if (!Number.isFinite(amount) || amount < 0) errors[id] = "Amount cannot be negative";
    else if (amount > 0 && head?.labelOnly) {
      const held = current?.amounts[id] ?? 0;
      if (Math.abs(amount - held) >= 0.005) {
        errors[id] = held > 0 ? `A label holds no amount: keep the ${held.toLocaleString("en-IN")} it holds for now, or set it to 0 and put what is due on an allowance` : "A label holds no amount: set it to 0 and put the amount on an allowance";
      } else warnings[id] = "A label: this is paid on top of basic / grade until it is set to 0 (put it on an allowance if it is still due)";
    }
  }
  return { errors, warnings };
}

/** Above this share a basic-salary change is flagged as a possible typo ("1,20,000" for "12,000"). */
export const LARGE_CHANGE = 0.5;

/** A warning when the basic salary moves by more than half (up or down); null otherwise. */
export function largeChangeWarning(before: number | null | undefined, after: number): string | null {
  if (!before || before <= 0 || !Number.isFinite(after)) return null;
  const share = (after - before) / before;
  if (Math.abs(share) <= LARGE_CHANGE) return null;
  return `Basic ${share > 0 ? "rises" : "falls"} by ${Math.round(Math.abs(share) * 100)}%: check for a typo`;
}

/** Which parts changed between two structures (keys as in validateLines). */
export function changedLines(before: StructureLines | null, after: StructureLines): string[] {
  if (!before) return ["new"];
  const out: string[] = [];
  if (before.basic !== after.basic) out.push("basic");
  if (before.gradeCount !== after.gradeCount) out.push("gradeCount");
  if (before.gradeAmount !== after.gradeAmount || before.gradeManual !== after.gradeManual) out.push("gradeAmount");
  if (before.scheme !== after.scheme) out.push("scheme");
  const ids = new Set([...Object.keys(before.amounts), ...Object.keys(after.amounts)]);
  for (const id of ids) if ((before.amounts[id] ?? 0) !== (after.amounts[id] ?? 0)) out.push(id);
  const b = [...before.computed].sort().join(",");
  const a = [...after.computed].sort().join(",");
  if (a !== b) out.push("computed");
  return out;
}

/** Employees changed and the change in monthly total salary (basic + grade + allowances) across a batch. */
export function batchSummary(rows: readonly { before: StructureTotals | null; after: StructureTotals }[]): { employeeCount: number; monthlyChange: number; before: number; after: number } {
  let before = new Decimal(0);
  let after = new Decimal(0);
  for (const r of rows) {
    before = before.plus(r.before?.totalSalary ?? 0);
    after = after.plus(r.after.totalSalary);
  }
  return { employeeCount: rows.length, monthlyChange: after.minus(before).toNumber(), before: before.toNumber(), after: after.toNumber() };
}

// ---------------------------------------------------------------------------
// Revisions in force and approval
// ---------------------------------------------------------------------------

export interface RevisionLike {
  id: string;
  effectiveFrom: string;
  status: string;
  createdAt: string | Date;
}

const later = (a: RevisionLike, b: RevisionLike) =>
  a.effectiveFrom > b.effectiveFrom || (a.effectiveFrom === b.effectiveFrom && new Date(a.createdAt).getTime() > new Date(b.createdAt).getTime());

/** The approved revision in force on a date (YYYY-MM-DD): the latest effective on or before it. */
export function revisionInForce<T extends RevisionLike>(revisions: readonly T[], onDate: string): T | null {
  let pick: T | null = null;
  for (const r of revisions) {
    if (r.status !== "approved" || r.effectiveFrom > onDate) continue;
    if (!pick || later(r, pick)) pick = r;
  }
  return pick;
}

/** The current revision: the latest approved one (it may take effect in the future). */
export function latestApproved<T extends RevisionLike>(revisions: readonly T[]): T | null {
  let pick: T | null = null;
  for (const r of revisions) if (r.status === "approved" && (!pick || later(r, pick))) pick = r;
  return pick;
}

// ---------------------------------------------------------------------------
// Payroll already paid (no arrears yet: a change must not reach into those months)
// ---------------------------------------------------------------------------

/**
 * Employees whose payroll is approved or locked for a month the change would
 * reach: payroll uses the revision in force at each month's end, so a change
 * effective on or before a finalised period end would rewrite paid months.
 * Returns employeeId → that latest finalised period end.
 */
export function finalisedConflicts(effectiveFrom: string, finalisedUntil: Readonly<Record<string, string>>, employeeIds: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of employeeIds) {
    const until = finalisedUntil[id];
    if (until && effectiveFrom <= until) out.set(id, until);
  }
  return out;
}

/** The first day a change may take effect for these employees (the day after the latest finalised month), or null. */
export function earliestOpenDate(finalisedUntil: Readonly<Record<string, string>>, employeeIds: readonly string[]): string | null {
  const ends = employeeIds.map((id) => finalisedUntil[id]).filter((d): d is string => !!d).sort();
  const last = ends[ends.length - 1];
  if (!last) return null;
  const d = new Date(`${last}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * An employee's level as a level code: the saved value may be the code or the
 * level's name (older records). Anything else is returned as saved, and
 * templates by level and the level's scale then do not apply.
 */
export function resolveLevelCode(saved: string, levels: readonly { code: string; name: string }[]): string {
  const v = saved.trim().toLowerCase();
  if (!v) return saved;
  return levels.find((l) => l.code.trim().toLowerCase() === v || l.name.trim().toLowerCase() === v)?.code ?? saved;
}

/** Does a template fit an employee (level and / or designation; empty lists match everyone)? */
export function templateFits(t: Pick<TemplateRow, "levelCodes" | "designationIds">, employee: { levelCode: string; designationId: string }): boolean {
  return (t.levelCodes.length === 0 || t.levelCodes.includes(employee.levelCode)) && (t.designationIds.length === 0 || t.designationIds.includes(employee.designationId));
}

/**
 * Lines after applying a template; grade count and "by hand" are kept, the
 * grade is recalculated. The template replaces the allowances and deductions.
 * With the employee given, pay heads limited (Pay heads) to other departments /
 * designations are left out for them.
 */
export function applyTemplate(
  template: Pick<TemplateRow, "basicMode" | "basicAmount" | "scheme" | "heads">,
  current: StructureLines,
  heads: readonly StructureHead[],
  levelStartingSalary: number,
  policy: GradePolicySettings | null | undefined,
  employee?: { departmentId: string; designationId: string }
): StructureLines {
  const byId = new Map(heads.map((h) => [h.id, h]));
  const basic = template.basicMode === "level_start" ? levelStartingSalary || current.basic : template.basicAmount || current.basic;
  const amounts: Record<string, number> = {};
  const computed: string[] = [];
  for (const th of template.heads) {
    const h = byId.get(th.payHeadId);
    if (!h) continue;
    if (employee && !headAppliesTo(h, employee)) continue;
    if (h.kind === "amount") amounts[h.id] = round2(th.amount);
    else if (h.kind === "computed") computed.push(h.id);
  }
  const scheme: RetirementScheme = template.scheme === "keep" ? current.scheme : template.scheme;
  const next = { ...current, basic, amounts, computed, scheme };
  return { ...next, gradeAmount: gradeAmountFor(next, policy) };
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

/** Numbers as people type them in Nepal: "1,20,000", "NPR 25000", "25000.50", "-" or blank = 0. */
export function parseAmount(text: string): number | null {
  const t = String(text ?? "").trim().replace(/^npr\s*/i, "").replace(/rs\.?\s*/i, "").replace(/,/g, "").replace(/\s/g, "");
  if (t === "" || t === "-") return 0;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export interface ImportColumn {
  id: string;
  /** Header text in the CSV (matched case-insensitively). */
  header: string;
  kind: "number" | "scheme" | "yesno";
}

export interface ImportResult {
  /** Values per employee code per column id. */
  values: Map<string, Record<string, number | string | boolean>>;
  unknownCodes: string[];
  unknownColumns: string[];
  errors: { code: string; column: string; message: string }[];
}

/**
 * Matches an imported CSV to the table: rows by "Employee code", columns by
 * header. Unknown codes and columns are reported, never guessed.
 */
export function matchImport(rows: readonly string[][], columns: readonly ImportColumn[], knownCodes: ReadonlySet<string>): ImportResult {
  const result: ImportResult = { values: new Map(), unknownCodes: [], unknownColumns: [], errors: [] };
  if (!rows.length) return result;
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const codeAt = header.findIndex((h) => h === "employee code" || h === "code");
  if (codeAt < 0) {
    result.errors.push({ code: "", column: "Employee code", message: 'The file needs an "Employee code" column' });
    return result;
  }
  const map = header.map((h, i) => (i === codeAt || h === "employee" || h === "name" || h === "" ? null : columns.find((c) => c.header.toLowerCase() === h) ?? undefined));
  header.forEach((h, i) => {
    if (map[i] === undefined) result.unknownColumns.push(rows[0][i]);
  });
  for (const row of rows.slice(1)) {
    const code = (row[codeAt] ?? "").trim();
    if (!code) continue;
    if (!knownCodes.has(code)) {
      result.unknownCodes.push(code);
      continue;
    }
    const values: Record<string, number | string | boolean> = {};
    row.forEach((cell, i) => {
      const col = map[i];
      if (!col) return;
      if (col.kind === "number") {
        const n = parseAmount(cell);
        if (n === null || n < 0) result.errors.push({ code, column: col.header, message: `"${cell}" is not an amount` });
        else values[col.id] = n;
      } else if (col.kind === "scheme") {
        const v = cell.trim().toLowerCase();
        if (v === "ssf" || v === "pf" || v === "none" || v === "") values[col.id] = v || "none";
        else result.errors.push({ code, column: col.header, message: "Use SSF, PF or None" });
      } else {
        const v = cell.trim().toLowerCase();
        if (["yes", "y", "1", "true"].includes(v)) values[col.id] = true;
        else if (["no", "n", "0", "false", ""].includes(v)) values[col.id] = false;
        else result.errors.push({ code, column: col.header, message: "Use Yes or No" });
      }
    });
    result.values.set(code, values);
  }
  return result;
}

// ---------------------------------------------------------------------------
// New hires: setting up the structure after basic + grade
// ---------------------------------------------------------------------------

/**
 * Only basic + grade, as saved from the employee form: the current revision
 * came from a hire and has no retirement scheme and no pay heads yet.
 */
export function needsSetup(current: { lines: StructureLines } | null, batchKind: string | null | undefined): boolean {
  if (!current || batchKind !== "hire") return false;
  const l = current.lines;
  return l.scheme === "none" && l.computed.length === 0 && Object.values(l.amounts).every((a) => !a);
}

/** Rows that Add new / Bulk add cover: no structure yet, or basic + grade only. */
export function needsStructure(row: { status: string }): boolean {
  return row.status === "none" || row.status === "setup";
}

/** Active templates for an employee: those that fit first, then the rest (by name). */
export function templatesFor(templates: readonly TemplateRow[], employee: { levelCode: string; designationId: string }): { fitting: TemplateRow[]; other: TemplateRow[] } {
  const active = templates.filter((t) => t.isActive).sort((a, b) => a.name.localeCompare(b.name));
  return { fitting: active.filter((t) => templateFits(t, employee)), other: active.filter((t) => !templateFits(t, employee)) };
}

/**
 * A structure being added (Add new / Bulk add) with a template (or none). The
 * template brings the allowances and deductions; the scheme is the template's,
 * else SSF when it is expected.
 * - With basic + grade from the employee form (`levelStart` omitted), they are kept.
 * - With no salary yet (`levelStart` given), the template's basic applies
 *   (its amount, or the level's starting salary).
 */
export function setupLines(
  current: StructureLines,
  template: Pick<TemplateRow, "basicMode" | "basicAmount" | "scheme" | "heads"> | null,
  ssfExpected: boolean,
  heads: readonly StructureHead[],
  policy: GradePolicySettings | null | undefined,
  opts: { levelStart?: number | null; employee?: { departmentId: string; designationId: string } } = {}
): StructureLines {
  const keepBasic = opts.levelStart == null;
  const scheme = (base: StructureLines): RetirementScheme => (template && template.scheme !== "keep" ? template.scheme : ssfExpected ? "ssf" : base.scheme);
  if (!keepBasic) {
    const base = template ? applyTemplate(template, current, heads, opts.levelStart ?? 0, policy, opts.employee) : { ...current };
    return { ...base, scheme: scheme(base) };
  }
  const base = template ? applyTemplate({ ...template, basicMode: "amount", basicAmount: current.basic }, current, heads, 0, policy, opts.employee) : { ...current };
  return { ...base, basic: current.basic, gradeAmount: current.gradeAmount, scheme: scheme(base) };
}

/**
 * For the Templates list: how many employees each template fits, and the other
 * active templates that fit some of the same people (the first by name is the
 * one Add new picks for them).
 */
export function templateCoverage(
  templates: readonly TemplateRow[],
  employees: readonly { levelCode: string; designationId: string }[]
): Map<string, { count: number; overlaps: string[] }> {
  const out = new Map<string, { count: number; overlaps: string[] }>(templates.map((t) => [t.id, { count: 0, overlaps: [] }]));
  for (const e of employees) {
    const fit = templates.filter((t) => templateFits(t, e));
    for (const t of fit) out.get(t.id)!.count++;
    const active = fit.filter((t) => t.isActive);
    for (const t of active) {
      const entry = out.get(t.id)!;
      for (const o of active) if (o.id !== t.id && !entry.overlaps.includes(o.name)) entry.overlaps.push(o.name);
    }
  }
  return out;
}

/** The date a new hire's structure starts: the joining date, or the first day payroll is still open. */
export function setupEffectiveFrom(joiningDate: string, employeeId: string, finalisedUntil: Readonly<Record<string, string>>): string {
  const open = earliestOpenDate(finalisedUntil, [employeeId]);
  return open && open > joiningDate ? open : joiningDate;
}

/** The tab to open: a known one, else Structures. */
export function resolveStructureTab(raw: string | undefined | null): StructureTab {
  if (raw === "changes") return "approvals"; // the tab's earlier name
  return (STRUCTURE_TABS as readonly string[]).includes(raw ?? "") ? (raw as StructureTab) : "structures";
}

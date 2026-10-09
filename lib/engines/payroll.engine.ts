import Decimal from "decimal.js";
import type { SystemControlData } from "@/lib/types/system-control";
import type { TDSCalculation, PayrollCalculationResult, SlabTaxDetail, TaxDetail, YtdFigures } from "@/lib/types/payroll";

// Standard Custom error
export class NegativeNetPayableError extends Error {
  constructor(public employeeId: string, public netPayable: string) {
    super(`Calculated net payable is negative (${netPayable}) for employee ${employeeId}. Deductions exceed gross earnings.`);
    this.name = "NegativeNetPayableError";
  }
}

/**
 * Thrown when a required statutory pay head (PF, SSF, CIT, TDS) is not found
 * in the pay heads master table. Payroll generation should not proceed with
 * fake/placeholder UUIDs as that would break FK integrity.
 */
export class MissingStatutoryHeadError extends Error {
  constructor(public headType: string) {
    super(`Required statutory pay head '${headType}' is not configured in the Pay Heads master. Please add it in Setup → Pay Heads before generating payroll.`);
    this.name = "MissingStatutoryHeadError";
  }
}

// Interface for pay head data processed in engine
export interface PayHeadInput {
  id: string;
  code: string;
  name: string;
  type: "allowance" | "deduction";
  effectOnTax: boolean;
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
  calcBasis: string;
  calcParameter: string;
  calcPercent: string;
  amount: string; // The base assigned amount
  isManualOverride?: boolean;
  overrideReason?: string | null;
}

/**
 * SSF contributions (Contribution-Based Social Security Act 2074): the employee
 * pays 11% and the employer 20% (31% deposited), worked out on the company's
 * SSF contribution base: basic + grade (the default) or basic only.
 */
export function ssfContribution(
  basicSalary: Decimal.Value,
  gradeAmount: Decimal.Value,
  base: "BasicSalary" | "BasicPlusGrade" | undefined
): { base: Decimal; employee: Decimal; employer: Decimal; total: Decimal } {
  const basic = new Decimal(basicSalary || 0);
  const amount = base === "BasicSalary" ? basic : basic.plus(new Decimal(gradeAmount || 0));
  const employee = amount.times(0.11).toDecimalPlaces(2);
  const employer = amount.times(0.2).toDecimalPlaces(2);
  return { base: amount, employee, employer, total: employee.plus(employer) };
}

/**
 * Helper to identify SSF employer contribution head from various database conventions:
 * - flag isSsfEmployerHead === true
 * - allowance type + code SSF-ER, SSF_ER, SSFER
 * - allowance type + name contains ("ssf" or "social security") and ("employer" or "er")
 */
export function isSsfEmployerHead(head: { isSsfEmployerHead?: boolean; isSsfHead?: boolean; code?: string; name?: string; type?: string }): boolean {
  if (head.isSsfEmployerHead) return true;
  const name = (head.name || '').toLowerCase();
  const code = (head.code || '').toUpperCase();
  const isAllowance = head.type === 'allowance';
  if (isAllowance && (code === 'SSF-ER' || code === 'SSF_ER' || code === 'SSFER')) return true;
  if (isAllowance && ((name.includes('ssf') || name.includes('social security')) && (name.includes('employer') || name.includes('er')))) return true;
  return false;
}

/**
 * Helper to identify SSF employee/total deduction head from various database conventions:
 * - flag isSsfHead === true and type is deduction (or not specified)
 * - code SSF, SSF-EE, SSF_EE, SSFEE
 * - deduction type + name contains "ssf" or "social security"
 */
export function isSsfDeductionHead(head: { isSsfEmployerHead?: boolean; isSsfHead?: boolean; code?: string; name?: string; type?: string }): boolean {
  if (head.isSsfHead && (head.type === 'deduction' || !head.type)) return true;
  const name = (head.name || '').toLowerCase();
  const code = (head.code || '').toUpperCase();
  const isDeduction = head.type === 'deduction';
  if (code === 'SSF' || code === 'SSF-EE' || code === 'SSF_EE' || code === 'SSFEE') return true;
  if (isDeduction && (name.includes('ssf') || name.includes('social security'))) return true;
  return false;
}

export interface TaxSlabInput {
  id: string;
  category: string; // "Normal Single" | "Married" | "Widow" | "Handicapped"
  amountFrom: string;
  amountTo: string | null;
  ratePercent: string;
  fixedDeduction: string;
}

export interface EmployeeInput {
  id: string;
  category: string; // "Permanent" | "Temporary" | "OutSource" | "Consultant" | "Trainee" | "Volunteer" | "Contract"
  gender: string; // "Male" | "Female" | "Other"
  isDisabled: boolean; // Corresponds to handicapped discount
  taxStatus: string; // "Normal Single" | "Married" | "Widow" | "Handicapped"
  joiningDate: string;
}

export interface SalaryMapInput {
  basicSalary: string;
  gradePercent: string;
  gradeAmount: string;
}

export interface AttendanceCalcInput {
  leaveDeductionAmount: string;
  otEarnedAmount: string;
}

/** 4.8b: what the tax projection starts from (year to date) and how many months are left. */
export interface TaxInput {
  ytd: YtdFigures;
  /** Months of the fiscal year from this one on, this one included (1 = the year-end month). */
  monthsRemaining: number;
  /** Taxable amounts paid once (bonus, arrears): not projected over the remaining months. Default: the festival heads. */
  oneOffTaxable?: string;
}

/** Nothing paid yet this fiscal year. */
export const EMPTY_YTD: YtdFigures = { taxableGross: "0", retirement: "0", cit: "0", tds: "0", months: 0 };

/**
 * Calculates a single employee's payslip breakdown.
 * Pure function with no database imports and no side effects.
 */
export function calculatePayslip(args: {
  employee: EmployeeInput;
  salaryMap: SalaryMapInput;
  assignedHeads: PayHeadInput[];
  attendanceCalc: AttendanceCalcInput;
  loanDeduction: string;
  /** 4.8a: welfare fund contributions (employee share), deducted after tax like a loan instalment. */
  fundDeduction?: string;
  systemControl: SystemControlData;
  taxSlabs: TaxSlabInput[];
  isFestivalMonth: boolean;
  isRemoteMonth: boolean;
  /** 4.8b: the income tax is projected from the year to date over the remaining months. */
  tax: TaxInput;
}): PayrollCalculationResult {
  const {
    employee,
    salaryMap,
    assignedHeads,
    attendanceCalc,
    loanDeduction,
    fundDeduction = "0",
    systemControl,
    taxSlabs,
    isFestivalMonth,
    isRemoteMonth,
    tax,
  } = args;

  const basic = new Decimal(salaryMap.basicSalary);
  const grade = new Decimal(salaryMap.gradeAmount);
  const basicPlusGrade = basic.plus(grade);

  const category = employee.category;
  const isTraineeOrVolunteer = category === "Trainee" || category === "Volunteer";
  const isContractor = category === "Contract";

  // ---------------------------------------------------------------------------
  // 1. Process Allowances and Deductions
  // ---------------------------------------------------------------------------
  let pfEmployee = new Decimal(0);
  let pfEmployer = new Decimal(0);
  let ssfEmployee = new Decimal(0);
  let ssfEmployer = new Decimal(0);
  let citDeduction = new Decimal(0);

  const calculatedHeads: Array<{
    payHeadId: string;
    payHeadName: string;
    headType: 'allowance' | 'deduction';
    amount: string;
    calculatedAmount: string;
  }> = [];

  let totalAllowances = new Decimal(0);
  let totalDeductions = new Decimal(0);
  let taxableAllowancesSum = new Decimal(0);
  // Festival bonus paid this month: taxable once, not projected over the remaining months (4.8b).
  let festivalTaxable = new Decimal(0);

  // Separate OT and leave calculations as they are handled in attendanceCalc
  const otAmount = new Decimal(attendanceCalc.otEarnedAmount);
  const absentDeduction = new Decimal(attendanceCalc.leaveDeductionAmount);

  // We loop through assigned heads
  for (const head of assignedHeads) {
    // Skip statutory heads and attendance heads as they are computed separately
    if (
      head.isPfHead || 
      head.isSsfHead || 
      head.isSsfEmployerHead ||
      isSsfEmployerHead(head) ||
      isSsfDeductionHead(head) ||
      head.isCitHead || 
      head.isTdsHead || 
      head.isOtHead || 
      head.isAbsentDeduct || 
      head.isLeaveHead
    ) {
      continue;
    }

    let headAmount = new Decimal(head.amount || 0);

    // Apply specific logic for Festival & Remote allowances based on parameters
    if (head.isFestivalAllowance) {
      if (head.isManualOverride) {
        // Explicit manual override or payslip attachment must always be honored
        headAmount = new Decimal(head.amount || 0);
      } else {
        if (!isFestivalMonth) continue; // Skip in non-festival months
        if (head.calcBasis === "BasicSalary") {
          headAmount = basic;
        } else if (head.calcBasis === "BasicPlusGrade") {
          headAmount = basicPlusGrade;
        } else if (new Decimal(head.calcPercent || 0).gt(0)) {
          headAmount = basicPlusGrade.times(new Decimal(head.calcPercent).dividedBy(100));
        } else if (headAmount.lte(0)) {
          headAmount = basic;
        }
      }
    } else if (head.isRemoteAllowance) {
      if (head.isManualOverride) {
        // Explicit manual override or payslip attachment must always be honored
        headAmount = new Decimal(head.amount || 0);
      } else {
        if (!isRemoteMonth) continue; // Skip if not active for remote work
        if (head.calcBasis === "BasicSalary" && new Decimal(head.calcPercent || 0).gt(0)) {
          headAmount = basic.times(new Decimal(head.calcPercent).dividedBy(100));
        } else if (head.calcBasis === "BasicPlusGrade" && new Decimal(head.calcPercent || 0).gt(0)) {
          headAmount = basicPlusGrade.times(new Decimal(head.calcPercent).dividedBy(100));
        }
        const limit = new Decimal(systemControl.insuranceDiscounts.remoteAllowanceNpr);
        if (headAmount.gt(limit)) {
          headAmount = limit;
        }
      }
    } else {
      // General allowances and non-statutory deductions
      const calcPct = new Decimal(head.calcPercent || 0);
      const isFixed = head.calcParameter === "FixedAmount" || head.calcBasis === "None";

      // If percentage is specified (> 0) and not strictly configured as fixed amount, calculate by formula (unless manually overridden)
      if (!head.isManualOverride && !isFixed && calcPct.gt(0)) {
        if (head.calcBasis === "BasicSalary") {
          headAmount = basic.times(calcPct.dividedBy(100));
        } else if (head.calcBasis === "BasicPlusGrade") {
          headAmount = basicPlusGrade.times(calcPct.dividedBy(100));
        }
      }
      // Otherwise, the explicit assigned head.amount from employee salary mapping is preserved
    }

    // Capture specific categories
    if (head.type === "allowance") {
      totalAllowances = totalAllowances.plus(headAmount);
      if (head.effectOnTax) {
        taxableAllowancesSum = taxableAllowancesSum.plus(headAmount);
        if (head.isFestivalAllowance) festivalTaxable = festivalTaxable.plus(headAmount);
      }
    } else if (head.type === "deduction") {
      totalDeductions = totalDeductions.plus(headAmount);
    }

    calculatedHeads.push({
      payHeadId: head.id,
      payHeadName: head.name,
      headType: head.type,
      amount: head.amount,
      calculatedAmount: headAmount.toDecimalPlaces(2).toString(),
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Statutory Calculations (PF/SSF/CIT)
  // ---------------------------------------------------------------------------
  let ssfTotal = new Decimal(0);

  // Skip statutory benefits for Trainees, Volunteers, and Contractors
  if (!isTraineeOrVolunteer && !isContractor) {
    const hasSsfEnrolled = assignedHeads.some(
      (h) => (h.isSsfHead || h.isSsfEmployerHead) && (new Decimal(h.amount || 0).gt(0) || new Decimal(h.calcPercent || 0).gt(0) || h.isSsfHead || h.isSsfEmployerHead)
    );

    if (hasSsfEnrolled) {
      // SSF active: employee 11% deduction, employer 20% addition, 31% total deposited; worked out
      // on the company's SSF contribution base (basic + grade by default), see ssfContribution().
      const ssfDeductHead = assignedHeads.find((h) => h.isSsfHead);

      if (ssfDeductHead && ssfDeductHead.calcParameter === "FixedAmount" && new Decimal(ssfDeductHead.amount || 0).gt(0)) {
        ssfEmployee = new Decimal(ssfDeductHead.amount).toDecimalPlaces(2);
        ssfEmployer = ssfEmployee.times(20 / 11).toDecimalPlaces(2);
      } else {
        const ssf = ssfContribution(basic, basicPlusGrade.minus(basic), systemControl.statutoryDeductionLimits.ssfContributionBase);
        ssfEmployee = ssf.employee;
        ssfEmployer = ssf.employer;
      }
      ssfTotal = ssfEmployee.plus(ssfEmployer);
    } else {
      // PF active: capped at pfMaximumLimitPercent (e.g. 30% of basic)
      const pfHead = assignedHeads.find((h) => h.isPfHead);
      if (pfHead) {
        let rawPf = new Decimal(0);

        if (pfHead.calcParameter === "FixedAmount" && new Decimal(pfHead.amount || 0).gt(0)) {
          rawPf = new Decimal(pfHead.amount);
        } else if (new Decimal(pfHead.calcPercent || 0).gt(0)) {
          rawPf = basicPlusGrade.times(new Decimal(pfHead.calcPercent).dividedBy(100));
        } else {
          // Standard Nepal statutory PF rate is 10%
          rawPf = basicPlusGrade.times(0.10);
        }

        const pfLimit = basicPlusGrade.times(
          new Decimal(systemControl.statutoryDeductionLimits.pfMaximumLimitPercent).dividedBy(100)
        );
        pfEmployee = Decimal.min(rawPf, pfLimit).toDecimalPlaces(2);
        pfEmployer = pfEmployee; // Equal contribution
      }
    }

    // CIT Calculation
    const citHead = assignedHeads.find((h) => h.isCitHead);
    if (citHead && new Decimal(citHead.amount || 0).gt(0)) {
      citDeduction = new Decimal(citHead.amount).toDecimalPlaces(2);
    }
  }

  // Add the computed statutory components to our breakdown and totals
  if (pfEmployee.gt(0)) {
    const pfHeadObj = assignedHeads.find((h) => h.isPfHead);
    if (!pfHeadObj) {
      throw new MissingStatutoryHeadError('Provident Fund (PF)');
    }
    calculatedHeads.push({
      payHeadId: pfHeadObj.id,
      payHeadName: pfHeadObj.name,
      headType: "deduction",
      amount: pfHeadObj.amount || "0",
      calculatedAmount: pfEmployee.toString()
    });
    totalDeductions = totalDeductions.plus(pfEmployee);
  }

  if (ssfEmployee.gt(0)) {
    // 1. Employer SSF Addition (+20% in gross earnings / allowances)
    const employerHeadObj = assignedHeads.find((h) => isSsfEmployerHead(h));
    if (employerHeadObj) {
      totalAllowances = totalAllowances.plus(ssfEmployer);
      if (employerHeadObj.effectOnTax) {
        taxableAllowancesSum = taxableAllowancesSum.plus(ssfEmployer);
      }
      calculatedHeads.push({
        payHeadId: employerHeadObj.id,
        payHeadName: employerHeadObj.name,
        headType: "allowance",
        amount: employerHeadObj.amount || "0",
        calculatedAmount: ssfEmployer.toString()
      });
    } else {
      totalAllowances = totalAllowances.plus(ssfEmployer);
      taxableAllowancesSum = taxableAllowancesSum.plus(ssfEmployer);
      calculatedHeads.push({
        payHeadId: 'head-ssf-er',
        payHeadName: 'SSF - Employer Contribution (20%)',
        headType: 'allowance',
        amount: '0',
        calculatedAmount: ssfEmployer.toString()
      });
    }

    // 2. Total SSF Deduction (-31% from gross earnings)
    const ssfHeadObj = assignedHeads.find((h) => isSsfDeductionHead(h)) || assignedHeads.find((h) => h.isSsfHead);
    if (ssfHeadObj) {
      totalDeductions = totalDeductions.plus(ssfTotal);
      calculatedHeads.push({
        payHeadId: ssfHeadObj.id,
        payHeadName: ssfHeadObj.name,
        headType: "deduction",
        amount: ssfHeadObj.amount || "0",
        calculatedAmount: ssfTotal.toString()
      });
    } else {
      totalDeductions = totalDeductions.plus(ssfTotal);
      calculatedHeads.push({
        payHeadId: 'head-ssf',
        payHeadName: 'Social Security Fund (SSF 31%)',
        headType: 'deduction',
        amount: '0',
        calculatedAmount: ssfTotal.toString()
      });
    }
  }

  if (citDeduction.gt(0)) {
    const citHeadObj = assignedHeads.find((h) => h.isCitHead);
    if (!citHeadObj) {
      throw new MissingStatutoryHeadError('Citizen Investment Trust (CIT)');
    }
    calculatedHeads.push({
      payHeadId: citHeadObj.id,
      payHeadName: citHeadObj.name,
      headType: "deduction",
      amount: citHeadObj.amount || "0",
      calculatedAmount: citDeduction.toString()
    });
    totalDeductions = totalDeductions.plus(citDeduction);
  }

  // ---------------------------------------------------------------------------
  // 3. Gross Earnings and Loan Deductions
  // ---------------------------------------------------------------------------
  // Total monthly gross = basic + grade + allowances + OT - absentDeduction
  const monthlyGross = basicPlusGrade.plus(totalAllowances).plus(otAmount).minus(absentDeduction);

  // Taxable monthly gross considers only taxable allowances
  const taxableMonthlyGross = Decimal.max(0, basicPlusGrade.plus(taxableAllowancesSum).plus(otAmount).minus(absentDeduction));
  
  // Total deductions include the loan instalment and welfare fund contributions (4.8a).
  const loanVal = new Decimal(loanDeduction);
  const fundVal = new Decimal(fundDeduction || 0);
  totalDeductions = totalDeductions.plus(loanVal).plus(fundVal);

  // ---------------------------------------------------------------------------
  // 4. TDS (Tax) Engine Calculations
  // ---------------------------------------------------------------------------
  let tdsThisMonth = new Decimal(0);

  // Check if employee actually has insurance deduction heads assigned
  const medicalHead = assignedHeads.find(
    (h) => h.type === "deduction" && (
      h.name.toLowerCase().includes("medical insurance") ||
      h.name.toLowerCase().includes("health insurance") ||
      h.name.includes("स्वास्थ्य बीमा")
    )
  );
  const houseHead = assignedHeads.find(
    (h) => h.type === "deduction" && (
      h.name.toLowerCase().includes("house insurance") ||
      h.name.toLowerCase().includes("home insurance") ||
      h.name.includes("घर बीमा")
    )
  );
  const lifeHead = assignedHeads.find(
    (h) => h.type === "deduction" && (
      h.name.toLowerCase().includes("life insurance") ||
      h.name.includes("जीवन बीमा")
    )
  );

  const medicalLimit = new Decimal(systemControl.insuranceDiscounts.medicalInsuranceNpr ?? 20000);
  const medicalAnnual = medicalHead
    ? Decimal.min(new Decimal(medicalHead.amount || 0).times(12), medicalLimit)
    : new Decimal(0);

  const houseLimit = new Decimal(systemControl.insuranceDiscounts.houseInsuranceNpr ?? 5000);
  const houseAnnual = houseHead
    ? Decimal.min(new Decimal(houseHead.amount || 0).times(12), houseLimit)
    : new Decimal(0);

  const lifeLimit = new Decimal(systemControl.insuranceDiscounts.lifeInsuranceNpr ?? 40000);
  const lifeAnnual = lifeHead
    ? Decimal.min(new Decimal(lifeHead.amount || 0).times(12), lifeLimit)
    : new Decimal(0);

  const totalInsuranceDeduction = medicalAnnual.plus(houseAnnual).plus(lifeAnnual);
  const monthlyInsuranceDeduct = totalInsuranceDeduction.dividedBy(12);

  // 4.8b: one projection for every month: the year to date plus this month plus the remaining
  // months at this month's regular pay, less the tax already deducted, spread over what is left.
  const oneOffTaxable = tax.oneOffTaxable !== undefined ? new Decimal(tax.oneOffTaxable || 0) : festivalTaxable;
  const projected = projectTds({
    employee,
    taxSlabs,
    systemControl,
    monthlyGross,
    taxableMonthlyGross,
    oneOffTaxable,
    retirementThisMonth: pfEmployee.plus(ssfTotal),
    citThisMonth: citDeduction,
    insuranceAnnual: totalInsuranceDeduction,
    ssfEnrolled: ssfEmployee.gt(0),
    ytd: tax.ytd,
    monthsRemaining: tax.monthsRemaining,
  });
  tdsThisMonth = projected.tdsThisMonth;

  // Add TDS to deductions
  if (tdsThisMonth.gt(0)) {
    totalDeductions = totalDeductions.plus(tdsThisMonth);
    const tdsHeadObj = assignedHeads.find(h => h.isTdsHead);
    if (!tdsHeadObj) {
      throw new MissingStatutoryHeadError('Tax Deducted at Source (TDS)');
    }
    calculatedHeads.push({
      payHeadId: tdsHeadObj.id,
      payHeadName: tdsHeadObj.name,
      headType: "deduction",
      amount: tdsHeadObj.amount || "0",
      calculatedAmount: tdsThisMonth.toString()
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Final Net Payable & Taxable Income
  // ---------------------------------------------------------------------------
  const netPayable = monthlyGross.minus(totalDeductions);
  if (netPayable.lt(0)) {
    throw new NegativeNetPayableError(employee.id, netPayable.toString());
  }

  // Monthly net taxable income after allowable pre-tax deductions
  const monthlyTaxableIncome = Decimal.max(
    0,
    taxableMonthlyGross
      .minus(pfEmployee)
      .minus(ssfTotal)
      .minus(citDeduction)
      .minus(monthlyInsuranceDeduct)
  ).toDecimalPlaces(2);

  return {
    basicSalary: basic.toString(),
    gradeAmount: grade.toString(),
    grossEarnings: monthlyGross.toDecimalPlaces(2).toString(),
    totalDeductions: totalDeductions.toDecimalPlaces(2).toString(),
    netPayable: netPayable.toDecimalPlaces(2).toString(),
    taxableIncome: monthlyTaxableIncome.toString(),
    tdsThisMonth: tdsThisMonth.toString(),
    pfEmployee: pfEmployee.toString(),
    pfEmployer: pfEmployer.toString(),
    ssfEmployee: ssfEmployee.toString(),
    ssfEmployer: ssfEmployer.toString(),
    citDeduction: citDeduction.toString(),
    loanDeduction: loanVal.toString(),
    absentDeduction: absentDeduction.toString(),
    otAmount: otAmount.toString(),
    fundDeduction: fundVal.toDecimalPlaces(2).toString(),
    taxDetail: projected.detail,
    isYearEndReconciliation: projected.detail.monthsRemaining <= 1,
    heads: calculatedHeads
  };
}

// ---------------------------------------------------------------------------
// 4.8b Income tax: year-to-date projection
// ---------------------------------------------------------------------------

export interface TdsInput {
  employee: EmployeeInput;
  taxSlabs: TaxSlabInput[];
  systemControl: SystemControlData;
  monthlyGross: Decimal;
  taxableMonthlyGross: Decimal;
  /** Part of taxableMonthlyGross paid once (bonus, arrears). */
  oneOffTaxable: Decimal;
  /** PF + SSF this month, employee and employer sides. */
  retirementThisMonth: Decimal;
  citThisMonth: Decimal;
  /** Insurance relief for the year (already capped). */
  insuranceAnnual: Decimal;
  ssfEnrolled: boolean;
  ytd: YtdFigures;
  monthsRemaining: number;
}

const ROUND0 = (d: Decimal) => d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

/**
 * This month's income tax. Annual taxable income is projected as the year to
 * date + this month + the remaining months at this month's regular taxable
 * pay (one-offs such as a festival bonus or arrears are counted once);
 * retirement contributions and CIT likewise, within the Act's limits; the
 * annual tax on that, less the tax already deducted, is spread over the
 * remaining months. In the year-end month (1 remaining) it reconciles exactly.
 * Contract staff: a flat 15% of gross (ITA §88). Trainees and volunteers: none.
 */
export function projectTds(i: TdsInput): { tdsThisMonth: Decimal; detail: TaxDetail } {
  const rem = Math.max(1, Math.floor(i.monthsRemaining || 1));
  const ytd = i.ytd ?? EMPTY_YTD;
  const s = (d: Decimal) => d.toDecimalPlaces(2).toString();
  const month = { taxableGross: s(i.taxableMonthlyGross), oneOffTaxable: s(i.oneOffTaxable), retirement: s(i.retirementThisMonth), cit: s(i.citThisMonth), insuranceAnnual: s(i.insuranceAnnual) };
  const category = i.employee.category;
  if (category === "Contract") {
    const tds = ROUND0(i.monthlyGross.times(0.15));
    return { tdsThisMonth: tds, detail: { method: "flat15", monthsRemaining: rem, ytd, month, projected: { gross: "0", retirement: "0", cit: "0", taxable: "0" }, annualTax: "0", tdsThisMonth: tds.toString() } };
  }
  if (category === "Trainee" || category === "Volunteer") {
    return { tdsThisMonth: new Decimal(0), detail: { method: "none", monthsRemaining: rem, ytd, month, projected: { gross: "0", retirement: "0", cit: "0", taxable: "0" }, annualTax: "0", tdsThisMonth: "0" } };
  }
  const regular = Decimal.max(0, i.taxableMonthlyGross.minus(i.oneOffTaxable));
  const projGross = new Decimal(ytd.taxableGross || 0).plus(i.taxableMonthlyGross).plus(regular.times(rem - 1));
  const projRetirement = new Decimal(ytd.retirement || 0).plus(i.retirementThisMonth.times(rem));
  const projCit = Decimal.min(new Decimal(ytd.cit || 0).plus(i.citThisMonth.times(rem)), new Decimal(i.systemControl.statutoryDeductionLimits.citLimitNpr));
  const retirementCap = Decimal.min(projGross.dividedBy(3), new Decimal(i.systemControl.statutoryDeductionLimits.retirementFundLimitNpr));
  const retirementAllowed = Decimal.min(projRetirement.plus(projCit), retirementCap);
  const projTaxable = Decimal.max(0, projGross.minus(retirementAllowed).minus(i.insuranceAnnual));
  const annualTax = calculateAnnualTaxFromSlabs(projTaxable, i.employee, i.taxSlabs, i.systemControl, i.ssfEnrolled);
  const tds = ROUND0(Decimal.max(0, annualTax.minus(new Decimal(ytd.tds || 0))).dividedBy(rem));
  return {
    tdsThisMonth: tds,
    detail: {
      method: "ytd",
      monthsRemaining: rem,
      ytd,
      month,
      projected: { gross: s(projGross), retirement: s(retirementAllowed), cit: s(projCit), taxable: s(projTaxable) },
      annualTax: s(annualTax),
      tdsThisMonth: tds.toString(),
    },
  };
}

/** The year to date from LOCKED payslips of the fiscal year (older slips without a tax detail count their gross as taxable). */
export function ytdFromSlips(slips: readonly { grossEarnings: string; pfEmployee: string; ssfEmployee: string; ssfEmployer: string; citDeduction: string; tdsThisMonth: string; taxDetail?: TaxDetail | null }[]): YtdFigures {
  let taxable = new Decimal(0);
  let retirement = new Decimal(0);
  let cit = new Decimal(0);
  let tds = new Decimal(0);
  for (const x of slips) {
    taxable = taxable.plus(x.taxDetail?.month.taxableGross ?? x.grossEarnings ?? 0);
    retirement = retirement.plus(x.pfEmployee || 0).plus(x.ssfEmployee || 0).plus(x.ssfEmployer || 0);
    cit = cit.plus(x.citDeduction || 0);
    tds = tds.plus(x.tdsThisMonth || 0);
  }
  const s = (d: Decimal) => d.toDecimalPlaces(2).toString();
  return { taxableGross: s(taxable), retirement: s(retirement), cit: s(cit), tds: s(tds), months: slips.length };
}

/**
 * A festival bonus payslip (4.8b, run type FESTIVAL_BONUS): only the festival
 * heads, worked out as in a regular month (basic, basic + grade or a percent),
 * taxed once through the projection. No PF, SSF, CIT, attendance, loans or funds.
 */
export function calculateBonusSlip(args: {
  employee: EmployeeInput;
  salaryMap: SalaryMapInput;
  festivalHeads: PayHeadInput[];
  tdsHead: PayHeadInput | undefined;
  systemControl: SystemControlData;
  taxSlabs: TaxSlabInput[];
  ssfEnrolled: boolean;
  tax: Pick<TaxInput, "ytd" | "monthsRemaining">;
}): PayrollCalculationResult {
  const basic = new Decimal(args.salaryMap.basicSalary || 0);
  const basicPlusGrade = basic.plus(args.salaryMap.gradeAmount || 0);
  const heads: PayrollCalculationResult["heads"] = [];
  let gross = new Decimal(0);
  let taxable = new Decimal(0);
  for (const head of args.festivalHeads) {
    let amount = new Decimal(head.amount || 0);
    if (!head.isManualOverride) {
      if (head.calcBasis === "BasicSalary") amount = basic;
      else if (head.calcBasis === "BasicPlusGrade") amount = basicPlusGrade;
      else if (new Decimal(head.calcPercent || 0).gt(0)) amount = basicPlusGrade.times(new Decimal(head.calcPercent).dividedBy(100));
      else if (amount.lte(0)) amount = basic;
    }
    gross = gross.plus(amount);
    if (head.effectOnTax) taxable = taxable.plus(amount);
    heads.push({ payHeadId: head.id, payHeadName: head.name, headType: "allowance", amount: head.amount, calculatedAmount: amount.toDecimalPlaces(2).toString() });
  }
  const projected = projectTds({
    employee: args.employee,
    taxSlabs: args.taxSlabs,
    systemControl: args.systemControl,
    monthlyGross: gross,
    taxableMonthlyGross: taxable,
    oneOffTaxable: taxable,
    retirementThisMonth: new Decimal(0),
    citThisMonth: new Decimal(0),
    insuranceAnnual: new Decimal(0),
    ssfEnrolled: args.ssfEnrolled,
    ytd: args.tax.ytd,
    monthsRemaining: args.tax.monthsRemaining,
  });
  const tds = projected.tdsThisMonth;
  if (tds.gt(0)) {
    if (!args.tdsHead) throw new MissingStatutoryHeadError("Tax Deducted at Source (TDS)");
    heads.push({ payHeadId: args.tdsHead.id, payHeadName: args.tdsHead.name, headType: "deduction", amount: args.tdsHead.amount || "0", calculatedAmount: tds.toString() });
  }
  const zero = "0";
  return {
    basicSalary: zero,
    gradeAmount: zero,
    grossEarnings: gross.toDecimalPlaces(2).toString(),
    totalDeductions: tds.toString(),
    netPayable: gross.minus(tds).toDecimalPlaces(2).toString(),
    taxableIncome: taxable.toDecimalPlaces(2).toString(),
    tdsThisMonth: tds.toString(),
    pfEmployee: zero,
    pfEmployer: zero,
    ssfEmployee: zero,
    ssfEmployer: zero,
    citDeduction: zero,
    loanDeduction: zero,
    absentDeduction: zero,
    otAmount: zero,
    fundDeduction: zero,
    taxDetail: projected.detail,
    isYearEndReconciliation: projected.detail.monthsRemaining <= 1,
    heads,
  };
}

/**
 * Calculates progressive annual tax liability using progressive tax slabs.
 */
function calculateAnnualTaxFromSlabs(
  taxableIncome: Decimal,
  employee: EmployeeInput,
  taxSlabs: TaxSlabInput[],
  systemControl: SystemControlData,
  isSsfEnrolled?: boolean
): Decimal {
  // Determine target slab category:
  // - If employee is disabled, use "Handicapped" slabs configured by company.
  // - "Widow" status calculates from "Normal Single".
  // - Otherwise use employee.taxStatus.
  let targetCategory = employee.taxStatus;
  if (employee.isDisabled) {
    targetCategory = "Handicapped";
  } else if (targetCategory === "Widow") {
    targetCategory = "Normal Single";
  }

  // Sort slabs ascending by amountFrom
  let activeSlabs = taxSlabs
    .filter(slab => slab.category === targetCategory)
    .sort((a, b) => new Decimal(a.amountFrom).minus(new Decimal(b.amountFrom)).toNumber());

  // Default to single tax slabs if category matching is empty
  if (activeSlabs.length === 0 && targetCategory !== "Normal Single") {
    activeSlabs = taxSlabs
      .filter(slab => slab.category === "Normal Single")
      .sort((a, b) => new Decimal(a.amountFrom).minus(new Decimal(b.amountFrom)).toNumber());
  }

  let annualTax = new Decimal(0);
  let remainingIncome = new Decimal(taxableIncome);

  for (const slab of activeSlabs) {
    const from = new Decimal(slab.amountFrom);
    const to = slab.amountTo ? new Decimal(slab.amountTo) : null;
    let rate = new Decimal(slab.ratePercent).dividedBy(100);
    const fixedDed = new Decimal(slab.fixedDeduction || 0);

    // Section 1(1) of Schedule 1 of Nepal Income Tax Act:
    // Individual contributing to Social Security Fund is exempt from 1% SST on first bracket
    if (isSsfEnrolled && from.eq(0) && (rate.eq(0.01) || slab.ratePercent === "1")) {
      rate = new Decimal(0);
    }

    const slabRange = to ? to.minus(from) : remainingIncome;
    const incomeInSlab = Decimal.min(remainingIncome, slabRange);

    // Progressive tax: marginal rate on income in this slab, minus bracket-level deduction
    const taxAmount = Decimal.max(0, incomeInSlab.times(rate).minus(fixedDed));
    annualTax = annualTax.plus(taxAmount);

    remainingIncome = remainingIncome.minus(incomeInSlab);
    if (remainingIncome.lte(0)) break;
  }

  // Apply gender discount (e.g. 10% discount for female)
  if (employee.gender === "Female") {
    const disc = new Decimal(systemControl.insuranceDiscounts.womenDiscountPercent).dividedBy(100);
    annualTax = annualTax.times(new Decimal(1).minus(disc));
  }

  // Handicapped relief is primarily handled via the "Handicapped" tax slabs above.
  // The System Control discount is defaulted to 0% and editable only by superadmins.
  const handicappedDiscPercent = Number(systemControl.insuranceDiscounts?.handicappedDiscountPercent ?? 0);
  if (employee.isDisabled && handicappedDiscPercent > 0) {
    const disc = new Decimal(handicappedDiscPercent).dividedBy(100);
    annualTax = annualTax.times(new Decimal(1).minus(disc));
  }

  return annualTax;
}

import Decimal from "decimal.js";
import type { SystemControlData } from "@/lib/types/system-control";
import type { 
  TDSCalculation, 
  PayrollCalculationResult,
  SlabTaxDetail
} from "@/lib/types/payroll";
import { isAshadh } from "@/lib/utils/fiscal-year.utils";

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
  isRemoteAllowance: boolean;
  isCitHead: boolean;
  calcBasis: string;
  calcParameter: string;
  calcPercent: string;
  amount: string; // The base assigned amount
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

export interface HistoricalPayslipInput {
  grossEarnings: string;
  pfEmployee: string;
  citDeduction: string;
  tdsThisMonth: string;
  // Deducted insurance from pay head amounts for actual annual deduction check
  medicalInsurance?: string;
  houseInsurance?: string;
  lifeInsurance?: string;
}

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
  systemControl: SystemControlData;
  taxSlabs: TaxSlabInput[];
  isFestivalMonth: boolean;
  isRemoteMonth: boolean;
  // If month 12 (Ashadh), pass historical payslips to run year-end reconciliation
  isYearEnd: boolean;
  historicalPayslips?: HistoricalPayslipInput[];
}): PayrollCalculationResult {
  const {
    employee,
    salaryMap,
    assignedHeads,
    attendanceCalc,
    loanDeduction,
    systemControl,
    taxSlabs,
    isFestivalMonth,
    isRemoteMonth,
    isYearEnd,
    historicalPayslips = []
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

  // Separate OT and leave calculations as they are handled in attendanceCalc
  const otAmount = new Decimal(attendanceCalc.otEarnedAmount);
  const absentDeduction = new Decimal(attendanceCalc.leaveDeductionAmount);

  // We loop through assigned heads
  for (const head of assignedHeads) {
    if (head.isPfHead || head.isSsfHead || head.isCitHead || head.isTdsHead) {
      continue;
    }

    let headAmount = new Decimal(head.amount);

    // Apply specific logic for Festival & Remote allowances based on parameters
    if (head.isFestivalAllowance) {
      if (!isFestivalMonth) continue; // Skip in non-festival months
      // Festival bonus is typically equal to basic or basic+grade
      if (head.calcBasis === "BasicSalary") {
        headAmount = basic;
      } else if (head.calcBasis === "BasicPlusGrade") {
        headAmount = basicPlusGrade;
      }
    }

    if (head.isRemoteAllowance) {
      if (!isRemoteMonth) continue; // Skip if not active for remote work
      // Check limit from system_control
      const limit = new Decimal(systemControl.insuranceDiscounts.remoteAllowanceNpr);
      if (headAmount.gt(limit)) {
        headAmount = limit;
      }
    }

    // Process calculations based on percentages if required
    if (head.calcBasis === "BasicSalary" && !head.isFestivalAllowance) {
      const pct = new Decimal(head.calcPercent).dividedBy(100);
      headAmount = basic.times(pct);
    } else if (head.calcBasis === "BasicPlusGrade" && !head.isFestivalAllowance) {
      const pct = new Decimal(head.calcPercent).dividedBy(100);
      headAmount = basicPlusGrade.times(pct);
    }

    // Capture specific categories
    if (head.type === "allowance") {
      totalAllowances = totalAllowances.plus(headAmount);
      if (head.effectOnTax) {
        taxableAllowancesSum = taxableAllowancesSum.plus(headAmount);
      }
    } else if (head.type === "deduction") {
      // We will compute CIT and PF/SSF separately as they are statutory
      if (head.isPfHead || head.isSsfHead || head.isCitHead) {
        // Handled below, we don't accumulate it here
      } else {
        totalDeductions = totalDeductions.plus(headAmount);
      }
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
  // Skip statutory benefits for Trainees, Volunteers, and Contractors
  if (!isTraineeOrVolunteer && !isContractor) {
    if (systemControl.statutoryDeductionLimits.companyHasSsf) {
      // SSF active: Employee 11% of gross, Employer 20% of gross
      // gross for SSF is basic + grade
      ssfEmployee = basicPlusGrade.times(0.11).toDecimalPlaces(2);
      ssfEmployer = basicPlusGrade.times(0.20).toDecimalPlaces(2);
    } else {
      // PF active: capped at pfMaximumLimitPercent (e.g. 30% of basic)
      // Check if employee has a PF head assigned to get percentage
      const pfHead = assignedHeads.find(h => h.isPfHead);
      const pfPct = pfHead ? new Decimal(pfHead.calcPercent) : new Decimal(10);
      
      const rawPf = basicPlusGrade.times(pfPct.dividedBy(100));
      const pfLimit = basicPlusGrade.times(new Decimal(systemControl.statutoryDeductionLimits.pfMaximumLimitPercent).dividedBy(100));
      
      pfEmployee = Decimal.min(rawPf, pfLimit).toDecimalPlaces(2);
      pfEmployer = pfEmployee; // Equal contribution
    }

    // CIT Calculation
    const citHead = assignedHeads.find(h => h.isCitHead);
    if (citHead) {
      const rawCit = new Decimal(citHead.amount);
      // CIT annual limit check happens during TDS calculation. Monthly is just the mapped amount
      citDeduction = rawCit.toDecimalPlaces(2);
    }
  }

  // Add the computed statutory components to our breakdown and totals
  if (pfEmployee.gt(0)) {
    const pfHeadObj = assignedHeads.find(h => h.isPfHead);
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
  }
  if (ssfEmployee.gt(0)) {
    const ssfHeadObj = assignedHeads.find(h => h.isSsfHead);
    if (!ssfHeadObj) {
      throw new MissingStatutoryHeadError('Social Security Fund (SSF)');
    }
    calculatedHeads.push({
      payHeadId: ssfHeadObj.id,
      payHeadName: ssfHeadObj.name,
      headType: "deduction",
      amount: ssfHeadObj.amount || "0",
      calculatedAmount: ssfEmployee.toString()
    });
  }
  if (citDeduction.gt(0)) {
    const citHeadObj = assignedHeads.find(h => h.isCitHead);
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
  }

  // Accumulate statutory employee shares to deductions
  totalDeductions = totalDeductions.plus(pfEmployee).plus(ssfEmployee).plus(citDeduction);

  // ---------------------------------------------------------------------------
  // 3. Gross Earnings and Loan Deductions
  // ---------------------------------------------------------------------------
  // grossEarnings = basic + grade + allowances + OT - absentDeduction
  const monthlyGross = basicPlusGrade.plus(totalAllowances).plus(otAmount).minus(absentDeduction);
  
  // Total deductions include loan installment
  const loanVal = new Decimal(loanDeduction);
  totalDeductions = totalDeductions.plus(loanVal);

  // ---------------------------------------------------------------------------
  // 4. TDS (Tax) Engine Calculations
  // ---------------------------------------------------------------------------
  let tdsThisMonth = new Decimal(0);

  if (isContractor) {
    // Contractors are subject to flat 15% TDS on gross earnings under Section 89 of Nepal Income Tax Act
    tdsThisMonth = monthlyGross.times(0.15).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  } else if (!isTraineeOrVolunteer) {
    // Standard employee tax slab calculation
    if (isYearEnd) {
      // Ashadh year-end tax reconciliation
      const totalPastGross = historicalPayslips.reduce((sum, p) => sum.plus(new Decimal(p.grossEarnings)), new Decimal(0));
      const actualAnnualGross = totalPastGross.plus(monthlyGross);

      const totalPastPf = historicalPayslips.reduce((sum, p) => sum.plus(new Decimal(p.pfEmployee)), new Decimal(0));
      const actualPf = totalPastPf.plus(pfEmployee);

      const totalPastCit = historicalPayslips.reduce((sum, p) => sum.plus(new Decimal(p.citDeduction)), new Decimal(0));
      const actualCit = totalPastCit.plus(citDeduction);

      // Extract insurance premiums if provided in history or standard settings
      // We assume standard monthly mapping premium * 12 or sum of actuals
      let medicalPremium = new Decimal(systemControl.insuranceDiscounts.medicalInsuranceNpr);
      let housePremium = new Decimal(systemControl.insuranceDiscounts.houseInsuranceNpr);
      let lifePremium = new Decimal(systemControl.insuranceDiscounts.lifeInsuranceNpr);

      // Cap deductions annually
      const capPf = actualPf; // Capped in monthly calculations already
      const capCit = Decimal.min(actualCit, new Decimal(systemControl.statutoryDeductionLimits.citLimitNpr));
      const totalInsurance = medicalPremium.plus(housePremium).plus(lifePremium);
      const capInsurance = Decimal.min(totalInsurance, new Decimal(25000)); // Cap total insurance at standard limits or sum of individual caps

      const actualDeductions = capPf.plus(capCit).plus(capInsurance);
      const actualTaxable = Decimal.max(0, actualAnnualGross.minus(actualDeductions));

      const actualAnnualTax = calculateAnnualTaxFromSlabs(actualTaxable, employee, taxSlabs, systemControl);
      const tdsAlreadyDeducted = historicalPayslips.reduce((sum, p) => sum.plus(new Decimal(p.tdsThisMonth)), new Decimal(0));

      const finalTds = actualAnnualTax.minus(tdsAlreadyDeducted);
      tdsThisMonth = Decimal.max(0, finalTds).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    } else {
      // Months 1-11: Projected estimate
      const projectedAnnualGross = monthlyGross.times(12);
      const pfAnnual = pfEmployee.times(12);
      const citAnnual = citDeduction.times(12);

      // Read insurance limits from system controls
      const medicalLimit = new Decimal(systemControl.insuranceDiscounts.medicalInsuranceNpr);
      const houseLimit = new Decimal(systemControl.insuranceDiscounts.houseInsuranceNpr);
      const lifeLimit = new Decimal(systemControl.insuranceDiscounts.lifeInsuranceNpr);

      // For projections, assume max allowable deduction if insurance heads exist (or standard limits)
      // Cap individual types
      const medicalDeduct = Decimal.min(medicalLimit, new Decimal(20000)); // medical insurance annual cap
      const houseDeduct = Decimal.min(houseLimit, new Decimal(5000));
      const lifeDeduct = Decimal.min(lifeLimit, new Decimal(25000));
      const insuranceDeduction = medicalDeduct.plus(houseDeduct).plus(lifeDeduct);

      // Capped CIT
      const citCapped = Decimal.min(citAnnual, new Decimal(systemControl.statutoryDeductionLimits.citLimitNpr));

      const totalDeductionsProjected = pfAnnual.plus(citCapped).plus(insuranceDeduction);
      const projectedTaxable = Decimal.max(0, projectedAnnualGross.minus(totalDeductionsProjected));

      const estimatedAnnualTax = calculateAnnualTaxFromSlabs(projectedTaxable, employee, taxSlabs, systemControl);
      tdsThisMonth = estimatedAnnualTax.dividedBy(12).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    }
  }

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
  // 5. Final Net Payable
  // ---------------------------------------------------------------------------
  const netPayable = monthlyGross.minus(totalDeductions);
  if (netPayable.lt(0)) {
    throw new NegativeNetPayableError(employee.id, netPayable.toString());
  }

  return {
    basicSalary: basic.toString(),
    gradeAmount: grade.toString(),
    grossEarnings: monthlyGross.toDecimalPlaces(2).toString(),
    totalDeductions: totalDeductions.toDecimalPlaces(2).toString(),
    netPayable: netPayable.toDecimalPlaces(2).toString(),
    taxableIncome: isYearEnd ? monthlyGross.toString() : monthlyGross.toString(), // Used for reporting
    tdsThisMonth: tdsThisMonth.toString(),
    pfEmployee: pfEmployee.toString(),
    pfEmployer: pfEmployer.toString(),
    ssfEmployee: ssfEmployee.toString(),
    ssfEmployer: ssfEmployer.toString(),
    citDeduction: citDeduction.toString(),
    loanDeduction: loanVal.toString(),
    absentDeduction: absentDeduction.toString(),
    otAmount: otAmount.toString(),
    heads: calculatedHeads
  };
}

/**
 * Calculates progressive annual tax liability using progressive tax slabs.
 */
function calculateAnnualTaxFromSlabs(
  taxableIncome: Decimal,
  employee: EmployeeInput,
  taxSlabs: TaxSlabInput[],
  systemControl: SystemControlData
): Decimal {
  // Sort slabs ascending by amountFrom
  const sortedSlabs = [...taxSlabs]
    .filter(slab => slab.category === employee.taxStatus)
    .sort((a, b) => new Decimal(a.amountFrom).minus(new Decimal(b.amountFrom)).toNumber());

  // Default to single tax slabs if category matching is empty
  const activeSlabs = sortedSlabs.length > 0 ? sortedSlabs : [...taxSlabs]
    .filter(slab => slab.category === "Normal Single")
    .sort((a, b) => new Decimal(a.amountFrom).minus(new Decimal(b.amountFrom)).toNumber());

  let annualTax = new Decimal(0);
  let remainingIncome = new Decimal(taxableIncome);

  for (const slab of activeSlabs) {
    const from = new Decimal(slab.amountFrom);
    const to = slab.amountTo ? new Decimal(slab.amountTo) : null;
    const rate = new Decimal(slab.ratePercent).dividedBy(100);
    const fixedDed = new Decimal(slab.fixedDeduction || 0);

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

  // Apply handicapped discount (e.g. 50% discount)
  if (employee.isDisabled) {
    const disc = new Decimal(systemControl.statutoryDeductionLimits.handicappedDeductionPercent).dividedBy(100);
    annualTax = annualTax.times(new Decimal(1).minus(disc));
  }

  return annualTax;
}

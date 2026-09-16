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
  isSsfEmployerHead?: boolean;
  isRemoteAllowance: boolean;
  isCitHead: boolean;
  calcBasis: string;
  calcParameter: string;
  calcPercent: string;
  amount: string; // The base assigned amount
  isManualOverride?: boolean;
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
    // Skip statutory heads and attendance heads as they are computed separately
    if (
      head.isPfHead || 
      head.isSsfHead || 
      head.isSsfEmployerHead ||
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
      // SSF active: Employee 11% deduction on basic, Employer 20% addition on basic, Total 31% deduction
      const ssfDeductHead = assignedHeads.find((h) => h.isSsfHead);
      const ssfEmployerHead = assignedHeads.find((h) => h.isSsfEmployerHead);
      const ssfHeadRef = ssfDeductHead || ssfEmployerHead;
      const ssfBasis = (ssfHeadRef && ssfHeadRef.calcBasis === "BasicPlusGrade") ? basicPlusGrade : basic;

      if (ssfDeductHead && ssfDeductHead.calcParameter === "FixedAmount" && new Decimal(ssfDeductHead.amount || 0).gt(0)) {
        ssfEmployee = new Decimal(ssfDeductHead.amount).toDecimalPlaces(2);
        ssfEmployer = ssfEmployee.times(20 / 11).toDecimalPlaces(2);
      } else {
        ssfEmployee = ssfBasis.times(0.11).toDecimalPlaces(2);
        ssfEmployer = ssfBasis.times(0.20).toDecimalPlaces(2);
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
    const employerHeadObj = assignedHeads.find((h) => h.isSsfEmployerHead || (h.type === "allowance" && (h.isSsfHead || h.code === "SSF-ER")));
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
    const ssfHeadObj = assignedHeads.find((h) => h.isSsfHead && h.type === "deduction") || assignedHeads.find((h) => h.isSsfHead);
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
  
  // Total deductions include loan installment
  const loanVal = new Decimal(loanDeduction);
  totalDeductions = totalDeductions.plus(loanVal);

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

  if (isContractor) {
    // Contractors are subject to flat 15% TDS on gross earnings under Section 89 of Nepal Income Tax Act
    tdsThisMonth = monthlyGross.times(0.15).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  } else if (!isTraineeOrVolunteer) {
    // Standard employee tax slab calculation
    if (isYearEnd) {
      // Ashadh year-end tax reconciliation
      const totalPastGross = historicalPayslips.reduce((sum, p) => sum.plus(new Decimal(p.grossEarnings)), new Decimal(0));
      const actualAnnualGross = totalPastGross.plus(monthlyGross);

      const totalPastPf = historicalPayslips.reduce((sum, p) => sum.plus(new Decimal(p.pfEmployee || 0)), new Decimal(0));
      const actualPfSsf = totalPastPf.plus(pfEmployee).plus(ssfTotal);

      const totalPastCit = historicalPayslips.reduce((sum, p) => sum.plus(new Decimal(p.citDeduction || 0)), new Decimal(0));
      const actualCit = totalPastCit.plus(citDeduction);

      const capCit = Decimal.min(actualCit, new Decimal(systemControl.statutoryDeductionLimits.citLimitNpr));
      const oneThirdActual = actualAnnualGross.dividedBy(3);
      const maxRetirement = Decimal.min(oneThirdActual, new Decimal(systemControl.statutoryDeductionLimits.retirementFundLimitNpr));
      const capRetirement = Decimal.min(actualPfSsf.plus(capCit), maxRetirement);

      const actualDeductions = capRetirement.plus(totalInsuranceDeduction);
      const actualTaxable = Decimal.max(0, actualAnnualGross.minus(actualDeductions));

      const actualAnnualTax = calculateAnnualTaxFromSlabs(actualTaxable, employee, taxSlabs, systemControl, ssfEmployee.gt(0));
      const tdsAlreadyDeducted = historicalPayslips.reduce((sum, p) => sum.plus(new Decimal(p.tdsThisMonth)), new Decimal(0));

      const finalTds = actualAnnualTax.minus(tdsAlreadyDeducted);
      tdsThisMonth = Decimal.max(0, finalTds).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    } else {
      // Months 1-11: Projected estimate based on taxable monthly gross
      const projectedAnnualTaxableGross = taxableMonthlyGross.times(12);
      const retirementAnnual = pfEmployee.plus(ssfTotal).times(12);
      const citAnnual = citDeduction.times(12);
      const citCapped = Decimal.min(citAnnual, new Decimal(systemControl.statutoryDeductionLimits.citLimitNpr));

      const oneThirdIncome = projectedAnnualTaxableGross.dividedBy(3);
      const retirementLimit = Decimal.min(oneThirdIncome, new Decimal(systemControl.statutoryDeductionLimits.retirementFundLimitNpr));
      const totalRetirementDeduction = Decimal.min(retirementAnnual.plus(citCapped), retirementLimit);

      const totalDeductionsProjected = totalRetirementDeduction.plus(totalInsuranceDeduction);
      const projectedTaxable = Decimal.max(0, projectedAnnualTaxableGross.minus(totalDeductionsProjected));

      const estimatedAnnualTax = calculateAnnualTaxFromSlabs(projectedTaxable, employee, taxSlabs, systemControl, ssfEmployee.gt(0));
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

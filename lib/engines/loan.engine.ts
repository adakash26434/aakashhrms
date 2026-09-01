// =============================================================================
// PHASE 5: STAFF LOANS MODULE — Pure Business Logic Engine
// No database access, no side effects. Only computation and validation.
// =============================================================================

import Decimal from "decimal.js";
import type {
  Loan,
  LoanType,
  LoanTypeFormData,
  LoanTypeValidationErrors,
  DisburseLoanFormData,
  DisbursementValidationErrors,
  RepaymentFormData,
  RepaymentValidationErrors,
  LoanKPIs,
} from "@/lib/types/loan";

// ---------------------------------------------------------------------------
// Validation: Loan Types
// ---------------------------------------------------------------------------

export function validateLoanType(
  data: LoanTypeFormData,
): LoanTypeValidationErrors {
  const errors: LoanTypeValidationErrors = {};

  if (!data.name.trim()) errors.name = "Loan type name is required";
  if (data.maxAmount <= 0) errors.maxAmount = "Max amount must be greater than 0";
  if (data.maxInstallments <= 0) errors.maxInstallments = "Max installments must be greater than 0";
  if (data.interestRate < 0) errors.interestRate = "Interest rate cannot be negative";

  return errors;
}

// ---------------------------------------------------------------------------
// Validation: Loan Disbursement
// ---------------------------------------------------------------------------

export function validateDisbursement(
  data: DisburseLoanFormData,
  loanType: LoanType,
): DisbursementValidationErrors {
  const errors: DisbursementValidationErrors = {};

  if (!data.employeeId) errors.employeeId = "Employee is required";
  if (!data.loanTypeId) errors.loanTypeId = "Loan type is required";
  if (!data.givenDate) errors.givenDate = "Given date is required";

  if (data.loanAmount <= 0) {
    errors.loanAmount = "Loan amount must be greater than 0";
  } else if (loanType.maxAmount > 0 && data.loanAmount > loanType.maxAmount) {
    errors.loanAmount = `Amount exceeds maximum of Rs. ${loanType.maxAmount.toLocaleString()}`;
  }

  if (data.noOfInstallments <= 0) {
    errors.noOfInstallments = "Number of installments must be greater than 0";
  } else if (loanType.maxInstallments > 0 && data.noOfInstallments > loanType.maxInstallments) {
    errors.noOfInstallments = `Exceeds maximum of ${loanType.maxInstallments} installments`;
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Validation: Repayment
// ---------------------------------------------------------------------------

export function validateRepayment(
  data: RepaymentFormData,
  remainingBalance: number,
): RepaymentValidationErrors {
  const errors: RepaymentValidationErrors = {};

  if (!data.loanId) errors.loanId = "Loan is required";
  if (!data.repaymentDate) errors.repaymentDate = "Repayment date is required";

  if (data.amountPaid <= 0) {
    errors.amountPaid = "Amount must be greater than 0";
  } else if (data.amountPaid > remainingBalance) {
    errors.amountPaid = `Amount exceeds remaining balance of Rs. ${remainingBalance.toLocaleString()}`;
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Computation: Installment Calculator (Flat-Rate Interest)
// ---------------------------------------------------------------------------

/**
 * Calculates the fixed monthly installment for a flat-rate loan.
 *
 * Formula: installment = (principal + (principal × interestRate / 100)) / installments
 *
 * Uses decimal.js for financial precision.
 */
export function calculateInstallmentAmount(
  principal: number,
  interestRate: number,
  installments: number,
): number {
  if (installments <= 0) return 0;

  const p = new Decimal(principal);
  const r = new Decimal(interestRate);
  const totalInterest = p.times(r).dividedBy(100);
  const totalPayable = p.plus(totalInterest);
  const installment = totalPayable.dividedBy(installments).toDecimalPlaces(2);

  return installment.toNumber();
}

/**
 * Calculates the total payable amount (principal + flat interest).
 */
export function calculateTotalPayable(
  principal: number,
  interestRate: number,
): number {
  const p = new Decimal(principal);
  const r = new Decimal(interestRate);
  const totalInterest = p.times(r).dividedBy(100);
  return p.plus(totalInterest).toDecimalPlaces(2).toNumber();
}

// ---------------------------------------------------------------------------
// Computation: KPIs
// ---------------------------------------------------------------------------

export function calculateLoanKPIs(loans: Loan[]): LoanKPIs {
  let totalActive = 0;
  let totalClosed = 0;
  let totalDisbursed = 0;
  let totalRemaining = 0;
  let totalRecovered = 0;
  let monthlyEMI = 0;

  for (const loan of loans) {
    totalDisbursed += loan.loanAmount;
    totalRecovered += loan.totalReturned;
    if (loan.status === "ACTIVE") {
      totalActive++;
      totalRemaining += loan.remainingAmount;
      monthlyEMI += loan.installmentAmount;
    } else {
      totalClosed++;
    }
  }

  const recoveryProgress =
    totalDisbursed > 0
      ? Number(new Decimal(totalRecovered).dividedBy(totalDisbursed).times(100).toDecimalPlaces(1))
      : 0;

  return {
    totalActive,
    totalDisbursed: Number(new Decimal(totalDisbursed).toDecimalPlaces(2)),
    totalRemaining: Number(new Decimal(totalRemaining).toDecimalPlaces(2)),
    totalClosed,
    totalRecovered: Number(new Decimal(totalRecovered).toDecimalPlaces(2)),
    monthlyEMI: Number(new Decimal(monthlyEMI).toDecimalPlaces(2)),
    recoveryProgress,
  };
}

// ---------------------------------------------------------------------------
// Computation: Repayment Progress (0–100%)
// ---------------------------------------------------------------------------

export function calculateLoanProgress(loan: Loan): number {
  if (loan.loanAmount <= 0) return 0;
  const total = new Decimal(loan.loanAmount);
  const returned = new Decimal(loan.totalReturned);
  const progress = returned.dividedBy(total).times(100).toDecimalPlaces(1);
  return Math.min(progress.toNumber(), 100);
}

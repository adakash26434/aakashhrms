// =============================================================================
// PHASE 5: STAFF LOANS MODULE — Service Layer
// Orchestrates Engine (validation/computation) + Repository (DB access).
// =============================================================================

import * as repository from "@/lib/repositories/loan.repository";
import * as engine from "@/lib/engines/loan.engine";
import { findAll } from "@/lib/repositories/employee.repository";
import Decimal from "decimal.js";
import type {
  LoanType,
  Loan,
  LoanRepayment,
  LoanTypeFormData,
  LoanTypeValidationErrors,
  DisburseLoanFormData,
  DisbursementValidationErrors,
  RepaymentFormData,
  RepaymentValidationErrors,
  LoanKPIs,
  LoanLookupData,
} from "@/lib/types/loan";

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class LoanTypeValidationError extends Error {
  constructor(public errors: LoanTypeValidationErrors) {
    super("Loan type validation failed");
    this.name = "LoanTypeValidationError";
  }
}

export class DisbursementValidationError extends Error {
  constructor(public errors: DisbursementValidationErrors) {
    super("Loan disbursement validation failed");
    this.name = "DisbursementValidationError";
  }
}

export class RepaymentValidationError extends Error {
  constructor(public errors: RepaymentValidationErrors) {
    super("Repayment validation failed");
    this.name = "RepaymentValidationError";
  }
}

// ---------------------------------------------------------------------------
// Reads: Lookup Data (for modal dropdowns)
// ---------------------------------------------------------------------------

export async function getLoanLookupData(): Promise<LoanLookupData> {
  const [loanTypesList, employeesList] = await Promise.all([
    repository.findAllLoanTypes(),
    findAll({
      search: "",
      departmentId: "all",
      branchId: "all",
      category: "all",
      status: "all",
    }),
  ]);

  return {
    loanTypes: loanTypesList
      .filter((lt) => lt.isActive)
      .map((lt) => ({
        id: lt.id,
        name: lt.name,
        interestRate: lt.interestRate,
        maxAmount: lt.maxAmount,
        maxInstallments: lt.maxInstallments,
      })),
    employees: employeesList
      .filter((emp) => emp.status === "Active")
      .map((emp) => ({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        code: emp.employeeCode,
      })),
  };
}

// ---------------------------------------------------------------------------
// Reads: Loan Types + KPIs
// ---------------------------------------------------------------------------

export async function getLoanTypesWithKPIs(): Promise<{
  loanTypes: LoanType[];
  kpis: { total: number; active: number; inactive: number };
}> {
  const loanTypesList = await repository.findAllLoanTypes();
  return {
    loanTypes: loanTypesList,
    kpis: {
      total: loanTypesList.length,
      active: loanTypesList.filter((lt) => lt.isActive).length,
      inactive: loanTypesList.filter((lt) => !lt.isActive).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Reads: Loans + KPIs
// ---------------------------------------------------------------------------

export async function getLoansWithKPIs(): Promise<{
  loans: Loan[];
  kpis: LoanKPIs;
}> {
  const loansList = await repository.findAllLoans();
  const kpis = engine.calculateLoanKPIs(loansList);
  return { loans: loansList, kpis };
}

// ---------------------------------------------------------------------------
// Reads: Repayment History
// ---------------------------------------------------------------------------

export async function getLoanRepayments(loanId: string): Promise<LoanRepayment[]> {
  return repository.findRepaymentsByLoan(loanId);
}

// ---------------------------------------------------------------------------
// Reads: Active Loans by Employee (for repayment modal dropdown)
// ---------------------------------------------------------------------------

export async function getActiveLoansByEmployee(employeeId: string): Promise<Loan[]> {
  return repository.findActiveLoansByEmployee(employeeId);
}

// ---------------------------------------------------------------------------
// Writes: Loan Type CRUD
// ---------------------------------------------------------------------------

export async function saveLoanType(
  id: string | null,
  data: LoanTypeFormData,
): Promise<LoanType> {
  // Validate via engine
  const errors = engine.validateLoanType(data);
  if (Object.keys(errors).length > 0) {
    throw new LoanTypeValidationError(errors);
  }

  if (id) {
    const updated = await repository.updateLoanType(id, data);
    if (!updated) throw new Error("Loan type not found");
    return updated;
  } else {
    return repository.createLoanType(data);
  }
}

export async function deleteLoanType(id: string): Promise<void> {
  const existing = await repository.findLoanTypeById(id);
  if (!existing) throw new Error("Loan type not found");

  const success = await repository.deleteLoanType(id);
  if (!success) throw new Error("Failed to delete loan type");
}

// ---------------------------------------------------------------------------
// Writes: Disburse Loan
// ---------------------------------------------------------------------------

export async function disburseLoan(data: DisburseLoanFormData): Promise<Loan> {
  // 1. Fetch the loan type for validation constraints
  const loanType = await repository.findLoanTypeById(data.loanTypeId);
  if (!loanType) throw new Error("Loan type not found");

  // 2. Validate via engine
  const errors = engine.validateDisbursement(data, loanType);
  if (Object.keys(errors).length > 0) {
    throw new DisbursementValidationError(errors);
  }

  // 3. Compute financials via engine
  const installmentAmount = engine.calculateInstallmentAmount(
    data.loanAmount,
    loanType.interestRate,
    data.noOfInstallments,
  );
  const totalPayable = engine.calculateTotalPayable(
    data.loanAmount,
    loanType.interestRate,
  );

  // 4. Persist
  return repository.createLoan({
    employeeId: data.employeeId,
    loanTypeId: data.loanTypeId,
    givenDate: data.givenDate,
    loanAmount: new Decimal(data.loanAmount).toDecimalPlaces(2).toString(),
    installmentAmount: new Decimal(installmentAmount).toDecimalPlaces(2).toString(),
    noOfInstallments: data.noOfInstallments,
    remainingAmount: new Decimal(totalPayable).toDecimalPlaces(2).toString(),
  });
}

// ---------------------------------------------------------------------------
// Writes: Record Repayment (Cash)
// ---------------------------------------------------------------------------

export async function recordRepayment(data: RepaymentFormData): Promise<LoanRepayment> {
  // 1. Fetch the loan
  const loan = await repository.findLoanById(data.loanId);
  if (!loan) throw new Error("Loan not found");
  if (loan.status === "CLOSED") throw new Error("This loan is already closed");

  // 2. Validate via engine
  const errors = engine.validateRepayment(data, loan.remainingAmount);
  if (Object.keys(errors).length > 0) {
    throw new RepaymentValidationError(errors);
  }

  // 3. Compute new balances
  const amountPaid = new Decimal(data.amountPaid);
  const newTotalReturned = new Decimal(loan.totalReturned).plus(amountPaid).toDecimalPlaces(2);
  const newRemaining = new Decimal(loan.remainingAmount).minus(amountPaid).toDecimalPlaces(2);
  const newStatus = newRemaining.lte(0) ? "CLOSED" : "ACTIVE";

  // 4. Persist atomically via transactional repo call
  return repository.createRepayment({
    loanId: data.loanId,
    employeeId: loan.employeeId,
    repaymentDate: data.repaymentDate,
    amountPaid: amountPaid.toDecimalPlaces(2).toString(),
    paymentMethod: "CASH",
    newTotalReturned: newTotalReturned.toString(),
    newRemainingAmount: newRemaining.toString(),
    newStatus,
  });
}

// =============================================================================
// PHASE 5: STAFF LOANS MODULE — Type Definitions
// =============================================================================

// --- Enums / Literal Types ---
export type LoanStatus = "ACTIVE" | "CLOSED";
export type PaymentMethod = "CASH" | "SALARY_DEDUCTION";

// --- Domain Interfaces (mapped from DB rows) ---

export interface LoanType {
  id: string;
  name: string;
  maxAmount: number;
  maxInstallments: number;
  interestRate: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Loan {
  id: string;
  employeeId: string;
  loanTypeId: string;
  givenDate: string; // YYYY-MM-DD
  loanAmount: number;
  installmentAmount: number;
  noOfInstallments: number;
  totalReturned: number;
  remainingAmount: number;
  status: LoanStatus;
  createdAt: Date;
  updatedAt: Date;
  // Enriched fields (joined)
  employeeName: string;
  employeeCode: string;
  loanTypeName: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  employeeId: string;
  repaymentDate: string; // YYYY-MM-DD
  amountPaid: number;
  paymentMethod: PaymentMethod;
  payrollSlipId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Form Data (what the UI sends to actions) ---

export interface LoanTypeFormData {
  name: string;
  maxAmount: number;
  maxInstallments: number;
  interestRate: number;
  isActive: boolean;
}

export interface DisburseLoanFormData {
  employeeId: string;
  loanTypeId: string;
  givenDate: string; // YYYY-MM-DD
  loanAmount: number;
  noOfInstallments: number;
}

export interface RepaymentFormData {
  loanId: string;
  amountPaid: number;
  repaymentDate: string; // YYYY-MM-DD
}

// --- Validation Error Shapes ---

export interface LoanTypeValidationErrors {
  name?: string;
  maxAmount?: string;
  maxInstallments?: string;
  interestRate?: string;
}

export interface DisbursementValidationErrors {
  employeeId?: string;
  loanTypeId?: string;
  givenDate?: string;
  loanAmount?: string;
  noOfInstallments?: string;
}

export interface RepaymentValidationErrors {
  loanId?: string;
  amountPaid?: string;
  repaymentDate?: string;
}

// --- KPIs ---

export interface LoanKPIs {
  totalActive: number;
  totalDisbursed: number;   // Sum of loanAmount for all loans
  totalRemaining: number;   // Sum of remainingAmount for active loans
  totalClosed: number;
  totalRecovered: number;   // Sum of totalReturned for all loans
  monthlyEMI: number;       // Sum of installmentAmount for active loans
  recoveryProgress: number; // (totalRecovered / totalDisbursed) * 100
}

// --- Lookup Data (for modal dropdowns) ---

export interface LoanLookupData {
  employees: { id: string; name: string; code: string }[];
  loanTypes: {
    id: string;
    name: string;
    interestRate: number;
    maxAmount: number;
    maxInstallments: number;
  }[];
}

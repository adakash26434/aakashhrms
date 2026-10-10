// Loans and salary advances (4.10): what the screens read. Amounts are numbers (NPR, two
// decimals); dates are AD ISO strings (shown BS-first); pay months are BS "YYYY-MM".

import type { ApprovalFlow, ApprovalPolicy, ApprovalRoute, ApprovalTimelineEntry } from "@/lib/types/approval";
import type { ClosedHow, LoanKind, LoanRequestStatus, LoanTerms, PaidVia } from "@/lib/engines/loan.engine";

export type { ClosedHow, LoanKind, LoanRequestStatus, LoanTerms, PaidVia };

export interface LoanTypeRow {
  id: string;
  name: string;
  nameNp: string | null;
  kind: LoanKind;
  maxAmount: number;
  maxSalaryMonths: number;
  maxInstallments: number;
  interestRate: number;
  eligibleAfterMonths: number;
  selfService: boolean;
  isActive: boolean;
  /** Loans and requests of this type (a type in use is deactivated, never deleted). */
  inUse: number;
}

export interface LoanRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  typeId: string;
  typeName: string;
  kind: LoanKind;
  /** disbursed here, or carried from the old system */
  source: "disbursed" | "opening";
  givenDate: string;
  amount: number;
  interestRate: number;
  totalPayable: number;
  installment: number;
  installments: number;
  /** BS month payroll deducts from (null: from the month it was given). */
  firstDeductionMonth: string | null;
  returned: number;
  remaining: number;
  repaidPct: number;
  installmentsLeft: number;
  /** On payslips of runs not yet locked. */
  reserved: number;
  /** Pay months of those payslips ("Kartik 2083"). */
  reservedIn: string[];
  status: "ACTIVE" | "CLOSED";
  closedHow: ClosedHow | null;
  closedAt: string | null;
  writtenOff: number;
  paidVia: PaidVia | null;
  paymentRef: string | null;
  note: string | null;
  closeNote: string | null;
  createdByName: string | null;
  requestId: string | null;
  /** The viewer's own loan (S21: someone else repays it or writes it off). */
  own: boolean;
  /** An approved final settlement recovers it when paid: nothing else moves it now. */
  heldBySettlement: boolean;
  /** A carried loan nothing has touched yet (can be removed). */
  removable: boolean;
}

export interface LoanRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  typeId: string;
  typeName: string;
  kind: LoanKind;
  amount: number;
  installments: number;
  interestRate: number;
  terms: LoanTerms;
  reason: string;
  source: "office" | "self_service";
  status: LoanRequestStatus;
  /** "Level 1 of 2 · Hari Thapa", "Waiting for an approver", "To disburse", … */
  statusText: string;
  preparedByName: string | null;
  requestedAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  route: ApprovalRoute | null;
  flow: ApprovalFlow;
  currentLevel: number;
  timeline: ApprovalTimelineEntry[];
  loanId: string | null;
  can: { approve: boolean; reject: boolean; withdraw: boolean; disburse: boolean; reason: string | null; disburseReason: string | null };
  waitingForMe: boolean;
  own: boolean;
}

export interface LoanRepaymentRow {
  id: string;
  date: string;
  amount: number;
  method: "CASH" | "SALARY_DEDUCTION" | "SETTLEMENT";
  /** The pay month of the payslip that deducted it ("Kartik 2083"). */
  payMonth: string | null;
  note: string | null;
  byName: string | null;
}

export interface LoanDetail {
  loan: LoanRow;
  repayments: LoanRepaymentRow[];
  /** On payslips not yet locked. */
  pending: { payMonth: string; amount: number; status: string }[];
}

export interface LoanApproverOption {
  userId: string;
  name: string;
  employeeId: string | null;
  active: boolean;
  canApprove: boolean;
}

export interface LoansPage {
  loans: LoanRow[];
  requests: LoanRequestRow[];
  types: LoanTypeRow[];
  /** Active employees in the viewer's scope. */
  employees: { id: string; name: string; code: string }[];
  /** Months payroll may start deducting a loan disbursed now. */
  payMonths: { value: string; label: string }[];
  policy: ApprovalPolicy;
  approvers: LoanApproverOption[];
  me: { userId: string; employeeId: string | null; isAdministrator: boolean; otherApprovers: number };
  totals: { running: number; outstanding: number; monthly: number; waitingForMe: number; toDisburse: number };
  today: string;
  permissions: {
    add: boolean;
    edit: boolean;
    remove: boolean;
    approve: boolean;
    /** Approval settings and loan types: company-wide users only. */
    settings: boolean;
    types: boolean;
  };
}

/** What a request would be, worked out while the window is filled (nothing is saved). */
export interface LoanRequestPreview {
  limit: number | null;
  limitBasis: string | null;
  needsSalary: boolean;
  monthlySalary: number | null;
  terms: LoanTerms | null;
  /** What the employee's running loans deduct a month now. */
  runningMonthly: number;
  /** Running installments plus this one as a share of basic + grade. */
  burdenPct: number | null;
  serviceMonths: number | null;
  /** What saving does: approved at once, waits for an approver, waits for named levels. */
  route: string;
  problems: Record<string, string>;
}

/** Self-service: a type the employee may ask for, with their own limit. */
export interface MyLoanType {
  id: string;
  name: string;
  nameNp: string | null;
  kind: LoanKind;
  maxInstallments: number;
  interestRate: number;
  limit: number | null;
  /** Why it can't be asked for now: months of service, one running, a request open, no salary structure. */
  blocked: "service" | "running" | "open" | "salary" | null;
  eligibleAfterMonths: number;
}

export interface MyLoansData {
  loans: LoanRow[];
  requests: LoanRequestRow[];
  types: MyLoanType[];
}

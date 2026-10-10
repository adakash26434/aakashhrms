import type { ReimbursementStatus } from "@/lib/engines/reimbursement.engine";

/** A reimbursement type (4.8 / F16). Caps are rupees; 0 = no cap. */
export interface ReimbursementTypeRow {
  id: string;
  code: string;
  name: string;
  nameNp: string | null;
  taxable: boolean;
  perClaimCap: number;
  yearlyCap: number;
  receiptRequired: boolean;
  isActive: boolean;
}

export interface ReimbursementClaimRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  typeId: string;
  typeCode: string;
  typeName: string;
  typeNameNp: string | null;
  /** AD "YYYY-MM-DD": the bill's date. */
  expenseDate: string;
  amount: number;
  receiptNo: string | null;
  description: string;
  taxable: boolean;
  status: ReimbursementStatus;
  decisionNote: string | null;
  decidedByName: string | null;
  createdByName: string | null;
  /** Settled through a pay run (false + settled = paid by hand). */
  paidByPayroll: boolean;
  /** The viewer's own claim: someone else decides it (S21). */
  own: boolean;
}

export interface ReimbursementPage {
  claims: ReimbursementClaimRow[];
  types: ReimbursementTypeRow[];
  /** Active employees in the viewer's scope (whom a claim may be recorded for). */
  employees: { id: string; name: string; code: string }[];
  permissions: { add: boolean; manage: boolean; approve: boolean; settle: boolean };
}

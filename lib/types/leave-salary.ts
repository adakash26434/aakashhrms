// Leave salary (4.9): leave paid out in money through the pay run. See lib/engines/leave-salary.engine.ts.

export type LeaveSalaryStatus = "DRAFT" | "APPROVED" | "PAID" | "CANCELLED";
/** year_end: the excess at a leave year's opening (already off the balance); balance: encashed from the balance in force; before: recorded before 4.9. */
export type LeaveSalarySourceView = "year_end" | "balance" | "before";

export interface LeaveSalaryRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  leaveTypeId: string;
  leaveTypeName: string;
  source: LeaveSalarySourceView;
  /** The leave year the days come from (FY label), when known. */
  leaveYear: string | null;
  days: number;
  perDayRate: number;
  amount: number;
  /** Basic in force when prepared (since 4.9). */
  basicSalary: number | null;
  rateBasis: "BASIC_DAILY" | "FIXED_AMOUNT" | null;
  /** "Kartik 2083": the regular pay run that pays it (or a later one); free text before 4.9. */
  payMonth: string;
  payMonthLabel: string;
  status: LeaveSalaryStatus;
  note: string | null;
  preparedBy: string | null;
  preparedByName: string | null;
  preparedAt: string;
  approvedByName: string | null;
  approvedAt: string | null;
  cancelReason: string | null;
  /** The pay run that paid it ("Kartik 2083"), or null (paid by hand before 4.9, or not paid). */
  paidWith: string | null;
  /** TDS recorded on records paid by hand before 4.9 (since then the payslip withholds it). */
  legacyTds: number | null;
  /** The record is about the viewer's own employee record (S21: someone else decides). */
  own: boolean;
  /** The viewer prepared it (maker-checker: someone else approves). */
  mine: boolean;
}

/** Days over the limit at a leave year's opening, not yet in a record. */
export interface LeaveSalaryDue {
  lineId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveYear: string | null;
  days: number;
  /** What it would pay if prepared today (basic in force ÷ 30, or the type's fixed rate). */
  perDayRate: number | null;
  amount: number | null;
  /** Why it can't be prepared now (no salary, leaving, not active). */
  problem: string | null;
  own: boolean;
}

export interface LeaveSalaryTypeOption {
  id: string;
  name: string;
  code: string;
  /** "Basic ÷ 30" or "Rs 1,200 a day (never below basic)". */
  rateText: string;
}

export interface LeaveSalaryPage {
  rows: LeaveSalaryRow[];
  due: LeaveSalaryDue[];
  employees: { id: string; name: string; code: string }[];
  /** Types whose balance may be encashed in service (not rights, not substitute leave). */
  types: LeaveSalaryTypeOption[];
  payMonths: { value: string; label: string }[];
  permissions: { add: boolean; edit: boolean; remove: boolean; approve: boolean };
}

/** What a new encashment would be, worked out on the server as the form is filled. */
export interface LeaveSalaryPreview {
  available: number;
  leaveYear: string | null;
  basicSalary: number | null;
  perDayRate: number | null;
  amount: number | null;
  rateText: string | null;
  /** Something that stops it whatever the days (no salary, leaving, nothing to encash). */
  problem: string | null;
}

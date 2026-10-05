export type LeaveTypeCategory = "Pay" | "Non-Pay";
export type LeaveDuration = "Full Day" | "Half Day";
export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  leaveType: LeaveTypeCategory;
  noOfDays: number;
  carryForward: boolean;
  applicableDepartments: string[];
  applicableDesignations: string[];
  isActive: boolean;
}

export interface EmployeeLeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId: string;
  allotted: number;
  taken: number;
  carriedForward: number;
  balance: number;
}

export interface LeaveApplication {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  appliedDate: Date;
  effectiveFrom: Date;
  effectiveTo: Date;
  duration: LeaveDuration;
  noOfDays: number;
  reason: string;
  remarks: string | null;
  status: LeaveStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewRemarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveApplicationFormData {
  employeeId: string;
  leaveTypeId: string;
  effectiveFrom: string;
  effectiveTo: string;
  duration: LeaveDuration;
  noOfDays: number;
  reason: string;
  remarks: string;
}

export interface LeaveFilter {
  search?: string;
  status?: LeaveStatus | "all";
  leaveTypeId?: string | "all";
  dateFrom?: string;
  dateTo?: string;
}

export interface LeaveKPIs {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

export interface LeaveApplicationValidationErrors {
  employeeId?: string;
  leaveTypeId?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  duration?: string;
  noOfDays?: string;
  reason?: string;
}
// ---------------------------------------------------------------------------
// 4.6 Leaves: kinds, counting, the ledger, requests and balances
// ---------------------------------------------------------------------------

/** balance: earned / credited days (home, sick, substitute); event: days per event (maternity, maternity care, mourning); none: no balance (unpaid leave). */
export const LEAVE_KINDS = ["balance", "event", "none"] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];

/** working: weekly offs and holidays inside the leave are not counted; calendar: every day counts. */
export const DAY_BASES = ["working", "calendar"] as const;
export type DayBasis = (typeof DAY_BASES)[number];

export type LeaveHalf = "first" | "second";

/** Pay of a type: full (Pay), none (Non-Pay) or half (Partial-Pay). */
export type LeavePay = "full" | "none" | "half";

/** A leave type as the rules need it. */
export interface LeaveRuleType {
  id: string;
  name: string;
  code: string;
  statutoryCode: string | null;
  isStatutory: boolean;
  kind: LeaveKind;
  dayBasis: DayBasis;
  pay: LeavePay;
  /** Days a year (balance) or per event (event). */
  days: number;
  /** Event leave: the first N counted days are paid, the rest unpaid (maternity 60). */
  paidDaysPerEvent: number | null;
  maxDaysPerRequest: number | null;
  allowHalfDay: boolean;
  /** Labour Act §51: sick, mourning and maternity leave are rights, not facilities. */
  isRight: boolean;
  genderApplicable: "All" | "Male" | "Female";
  applicableDepartments: string[];
  applicableDesignations: string[];
  requiresDocument: boolean;
  documentThresholdDays: number | null;
  accumulationCap: number | null;
  /** Company types: what is left at the year end carries over (up to the cap); statutory balance types always do (§49). */
  carryForward: boolean;
  /** What can't be carried over is paid out (true) or lapses (false). */
  isEncashable: boolean;
  /** Home leave: 1 day per N paid days (Labour Act §43: 20). */
  accrualEveryDays: number | null;
  /** Substitute leave: a grant expires N days after the day worked (§42: 21). */
  expiryDays: number | null;
  isActive: boolean;
}

/** One counted day of a request: whole (1) or half (0.5), and how it is paid. */
export interface LeaveDayDetail {
  date: string;
  part: number;
  pay: LeavePay;
}

export const LEDGER_KINDS = ["opening", "credit", "accrual", "grant", "not_granted", "taken", "returned", "adjusted", "carried_forward", "paid_out", "expired", "lapsed"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  opening: "Opening balance",
  credit: "Yearly credit",
  accrual: "Earned (days worked)",
  grant: "Granted",
  not_granted: "Not granted",
  taken: "Taken",
  returned: "Returned (cancelled)",
  adjusted: "Adjusted by HR",
  carried_forward: "Carried forward",
  paid_out: "To be paid out",
  expired: "Expired",
  lapsed: "Lapsed",
};

export interface LedgerLine {
  id: string;
  leaveTypeId: string;
  entryDate: string;
  kind: LedgerKind;
  days: number;
  applicationId: string | null;
  note: string | null;
  expiresOn: string | null;
  /** What the line is for, so it is never posted twice (accrual:BS-2083-6, substitute:2026-10-10, opening:<year>, expiry:<grant>). */
  ref: string | null;
  createdBy: string | null;
  createdAt: string;
}

export const LEAVE_TABS = ["requests", "balances", "substitute", "calendar"] as const;
export type LeaveTabId = (typeof LEAVE_TABS)[number];

export interface LeavePerson {
  id: string;
  employeeCode: string;
  fullName: string;
  gender: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  designationId: string;
  supervisorId: string | null;
}

export interface LeaveRequestView {
  id: string;
  employee: LeavePerson;
  leaveTypeId: string;
  leaveTypeName: string;
  from: string;
  to: string;
  half: LeaveHalf | null;
  days: number;
  paidDays: number;
  unpaidDays: number;
  /** The days counted (null for requests made before 4.6). */
  detail: LeaveDayDetail[] | null;
  reason: string;
  certificateNote: string | null;
  ssfClaim: boolean;
  status: LeaveStatus;
  source: "hr" | "self_service";
  preparedBy: string;
  appliedDate: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelReason: string | null;
  timeline: import("@/lib/types/approval").ApprovalTimelineEntry[];
  /** What the current user may do (worked out on the server). */
  can: { approve: boolean; finalApprove: boolean; reject: boolean; withdraw: boolean; cancel: boolean; reason: string | null };
}

export interface LeaveBalanceCell {
  leaveTypeId: string;
  balance: number;
  taken: number;
  /** Days in waiting requests. */
  waiting: number;
}

export interface EmployeeBalancesRow {
  employee: LeavePerson;
  cells: LeaveBalanceCell[];
}

/** A day worked on a weekly off or holiday in the last 21 days (substitute leave, Labour Act §42). */
export interface SubstituteSuggestion {
  employee: LeavePerson;
  date: string;
  why: string;
  firstIn: string | null;
  lastOut: string | null;
  workMinutes: number;
  /** Off-day overtime the attendance rules count for the day (paid at the off-day rate). */
  otOffMinutes: number;
  /** From the minutes worked: a full day (1), half (0.5), or less than half (0). */
  suggested: 1 | 0.5 | 0;
  expiresOn: string;
  decided: { granted: boolean; days: number; note: string | null; by: string | null; at: string } | null;
}

/** What opening the next leave year would do. */
export interface OpeningPreview {
  from: { id: string; label: string; start: string; end: string } | null;
  target: { id: string; label: string; start: string; end: string } | null;
  /** Why it can't be opened now (empty = it can). */
  problems: string[];
  /** The same, as a checklist: each condition, whether it is met, and what to do if not. */
  checks: { label: string; ok: boolean; fix: string | null }[];
  /** When there is no year to open yet: the day the next one starts. */
  nextStart: string | null;
  types: { id: string; name: string }[];
  rows: { employee: LeavePerson; cells: import("@/lib/engines/leave.engine").OpeningRow[] }[];
  totals: { people: number; carried: number; paidOut: number; lapsed: number; credited: number };
  history: { label: string; openedAt: string; by: string; people: number; note: string | null }[];
}

export interface LeaveCalendarCell {
  off: "weekly" | "holiday" | null;
  offName: string | null;
  leave: { requestId: string; code: string; name: string; status: "Approved" | "Pending"; half: boolean; unpaid: boolean } | null;
}

/** Who is on leave in a BS month. */
export interface LeaveCalendarData {
  period: { year: number; month: number; label: string; start: string; end: string };
  days: { date: string; bsDay: number; weekday: number }[];
  types: { id: string; name: string; code: string }[];
  rows: { employee: LeavePerson; cells: Record<string, LeaveCalendarCell> }[];
}

export interface LeavePageData {
  tab: LeaveTabId;
  today: string;
  fiscalYear: { id: string; label: string; start: string; end: string } | null;
  types: LeaveRuleType[];
  requests: LeaveRequestView[];
  balances: EmployeeBalancesRow[];
  people: LeavePerson[];
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  currentUserId: string;
  myEmployeeId: string | null;
  permissions: { add: boolean; edit: boolean; approve: boolean; openYear: boolean };
  /** Substitute tab: days worked on a weekly off or holiday (loaded with that tab). */
  substitute: SubstituteSuggestion[] | null;
  /** Calendar tab: the month shown (loaded with that tab). */
  calendar: LeaveCalendarData | null;
}

/** The server's answer to "how many days would this be?" */
export interface LeavePreview {
  days: number;
  paidDays: number;
  unpaidDays: number;
  detail: LeaveDayDetail[];
  skipped: { date: string; why: string }[];
  /** Balance kinds: the balance now, waiting requests, and after this request. */
  balance: { now: number; waiting: number; after: number } | null;
  /** Why it can't be requested (empty = it can). */
  problems: string[];
  /** Notes that don't block (certificate needed, §51 right). */
  notes: string[];
}

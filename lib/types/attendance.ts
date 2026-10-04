import type { PeriodCalendar } from "@/lib/engines/pay-period.engine";


export const ATTENDANCE_STATUSES = [
  "Present",
  "Absent",
  "Half Day",
  "On Leave",
  "LWOP",
  "Holiday",
  "Weekly Off",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/**
 * Single daily attendance record for an employee.
 */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  attendanceCode: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  branchId: string;
  branchName: string;
  fiscalYearId: string;
  attendanceDate: string; // YYYY-MM-DD (AD source of truth)
  bsDate: string; // YYYY-MM-DD (Bikram Sambat display snapshot)
  status: AttendanceStatus;
  inTime: string | null; // e.g. "10:05 AM"
  outTime: string | null; // e.g. "05:15 PM"
  workHours: number;
  otHoursOfficeDay: number;
  otHoursOffDay: number;
  isLate: boolean;
  isManualEntry: boolean;
  remarks: string | null;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Monthly summarized calculation and pre-payroll lock record.
 */
export interface LeaveOtCalculation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  fiscalYearId: string;
  bsMonth: number; // 1 (Baisakh) to 12 (Chaitra)
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  payLeaveDays: number;
  nonPayLeaveDays: number; // LWOP
  totalOtHoursOffice: number;
  totalOtHoursOff: number;
  otEarnedAmount: number; // Computed in NPR
  leaveDeductionAmount: number; // Computed in NPR
  otWarnings: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Form payload for logging or editing a single daily attendance punch.
 */
export interface AttendanceFormData {
  employeeId: string;
  fiscalYearId?: string;
  attendanceDate: string;
  status: AttendanceStatus;
  inTime: string;
  outTime: string;
  workHours: number;
  otHoursOfficeDay: number;
  otHoursOffDay: number;
  isLate: boolean;
  remarks: string;
}

/**
 * Item structure for 1-click bulk daily attendance posting.
 */
export interface AttendanceBulkItem {
  employeeId: string;
  status: AttendanceStatus;
  inTime?: string;
  outTime?: string;
  workHours?: number;
  otHoursOfficeDay?: number;
  otHoursOffDay?: number;
  remarks?: string;
}

/**
 * Filter state for the attendance dashboard.
 */
export interface AttendanceFilter {
  search: string;
  departmentId: string | "all";
  branchId: string | "all";
  date: string; // Selected date to view daily punches (defaults to today)
  status: AttendanceStatus | "all";
  isLateOnly: boolean;
}

/**
 * Top-level KPI metrics computed for the selected date.
 */
export interface AttendanceKPIs {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  onLeaveCount: number;
  totalOtHours: number;
}

/**
 * Aggregate dataset returned by the service/action layer for initial page render.
 */
export interface AttendanceData {
  records: AttendanceRecord[];
  employees: {
    id: string;
    employeeCode: string;
    attendanceCode: string;
    fullName: string;
    departmentId: string;
    departmentName: string;
    branchId: string;
    branchName: string;
  }[];
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  activeFiscalYear: { id: string; label: string };
  kpis: AttendanceKPIs;
  selectedDate: string;
}

export interface AttendanceValidationErrors {
  employeeId?: string;
  attendanceDate?: string;
  status?: string;
  workHours?: string;
  otHours?: string;
}
// ---------------------------------------------------------------------------
// 4.5 Attendance: punches, day rules, month summaries, adjustments
// ---------------------------------------------------------------------------

/** How a day counts. */
export const DAY_TYPES = [
  "present",
  "half_day",
  "absent",
  "missing_punch",
  "on_duty",
  "paid_leave",
  "unpaid_leave",
  "holiday",
  "weekly_off",
  "not_employed",
  "upcoming",
] as const;
export type DayType = (typeof DAY_TYPES)[number];

/** Register codes and names for each day type. */
export const DAY_CODE: Record<DayType, { code: string; name: string }> = {
  present: { code: "P", name: "Present" },
  half_day: { code: "½", name: "Half day" },
  absent: { code: "A", name: "Absent" },
  missing_punch: { code: "MP", name: "Missing punch" },
  on_duty: { code: "OD", name: "On duty" },
  paid_leave: { code: "PL", name: "Paid leave" },
  unpaid_leave: { code: "UL", name: "Unpaid leave" },
  holiday: { code: "HO", name: "Holiday" },
  weekly_off: { code: "WO", name: "Weekly off" },
  not_employed: { code: "—", name: "Not employed" },
  upcoming: { code: "·", name: "Upcoming" },
};

/**
 * Day types HR may set by hand (an override, with a reason). Paid / unpaid
 * leave set here is for days recorded before leave applications reached
 * attendance (4.5); new leave goes through the leave module.
 */
export const OVERRIDE_TYPES = ["present", "absent", "half_day", "on_duty", "paid_leave", "unpaid_leave"] as const satisfies readonly DayType[];
export type OverrideType = (typeof OVERRIDE_TYPES)[number];

/** Working time for a day: the company office time now, named shifts in 4.5b. */
export interface ShiftRule {
  id: string | null;
  name: string;
  /** Local (Nepal) times "HH:MM". A shift whose end is not after its start crosses midnight. */
  start: string;
  end: string;
  breakMinutes: number;
  graceMinutes: number;
  /** Minutes worked for a full day / a half day. */
  fullDayMinutes: number;
  halfDayMinutes: number;
  /** Extra minutes below this are not overtime. */
  otMinimumMinutes: number;
  /** Weekly off days, 0 Sunday … 6 Saturday. */
  weeklyOffs: number[];
}

/** Company attendance rules (one source: system_config "attendance.*"). */
export interface AttendanceRules {
  /** Attendance (and pay) months: BS now; AD with payroll runs in AD months (4.8). */
  calendar: PeriodCalendar;
  /** A working day with nothing recorded counts as … */
  noRecord: "absent" | "present";
  /** "Every N late days = half a day unpaid" (off unless enabled). */
  lateRule: { enabled: boolean; count: number };
  /** The default working time (General). */
  shift: ShiftRule;
}

/** An approved leave on a day, as the day rules need it. */
export interface DayLeave {
  name: string;
  /** Pay: full, none (Non-Pay) or half (Partial-Pay). */
  pay: "full" | "none" | "half";
  /** Half-day leave (covers half the day). */
  half: boolean;
}

/** One day's result for an employee. */
export interface DayResult {
  date: string;
  dayType: DayType;
  /** Paid part of the day (0, 0.5 or 1) and unpaid part. Not-employed days are neither. */
  payable: number;
  unpaid: number;
  firstIn: string | null;
  lastOut: string | null;
  workMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  otWorkDayMinutes: number;
  otOffDayMinutes: number;
  /** Part of the day on approved leave (0, 0.5, 1) and the paid part of that. */
  leaveDays: number;
  leavePaidDays: number;
  /** Plain words: why the day counts this way. */
  rule: string;
  flags: ("late" | "early" | "missing_punch" | "ot_over_daily_limit" | "assumed_present" | "override")[];
  holidayName?: string | null;
  leaveName?: string | null;
}

/** One employee's month, ready for payroll. */
export interface MonthSummary {
  calendar: PeriodCalendar;
  periodYear: number;
  periodMonth: number;
  start: string;
  end: string;
  /** Days in the month (the daily-rate divisor). */
  calendarDays: number;
  payableDays: number;
  /** Unpaid days (absent, unpaid leave, unpaid halves, late rule). */
  unpaidDays: number;
  notEmployedDays: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  missingPunchDays: number;
  onDutyDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  holidayDays: number;
  weeklyOffDays: number;
  lateDays: number;
  earlyDays: number;
  otWorkDayMinutes: number;
  otOffDayMinutes: number;
  /** OT over the legal limits (4 h a day, 24 h a week): flagged, not cut. */
  otWarnings: string[];
}

export const PUNCH_SOURCES = ["manual", "web", "device", "import", "adjustment"] as const;
export type PunchSource = (typeof PUNCH_SOURCES)[number];

export const ADJUSTMENT_KINDS = ["missed_in", "missed_out", "wrong_time", "on_duty", "mark_present"] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

export const ADJUSTMENT_KIND_LABEL: Record<AdjustmentKind, string> = {
  missed_in: "Missed check-in",
  missed_out: "Missed check-out",
  wrong_time: "Wrong time recorded",
  on_duty: "On duty (field work)",
  mark_present: "Mark present",
};

/** Attendance page tabs (4.5). */
export const ATTENDANCE_TABS = ["today", "register", "adjustments", "close", "punches"] as const;
export type AttendanceTab = (typeof ATTENDANCE_TABS)[number];

export interface RegisterEmployee {
  id: string;
  employeeCode: string;
  attendanceCode: string;
  fullName: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  supervisorId: string | null;
}

export interface RegisterRow {
  employee: RegisterEmployee;
  days: DayResult[];
  summary: MonthSummary;
  /** Days that cannot change (their branch month is closed). */
  locked: boolean;
}

export interface PunchView {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  punchedAt: string;
  kind: string;
  source: PunchSource;
  ip: string | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  createdByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface AdjustmentView {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  date: string;
  kind: AdjustmentKind;
  requestedIn: string | null;
  requestedOut: string | null;
  reason: string;
  source: "hr" | "self_service";
  status: "pending" | "approved" | "rejected" | "withdrawn";
  preparedById: string | null;
  preparedBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  approvalRoute: string | null;
  timeline: import("@/lib/types/approval").ApprovalTimelineEntry[];
  /** What the current user may do with it (worked out on the server). */
  can: { approve: boolean; finalApprove: boolean; reject: boolean; withdraw: boolean; reason: string | null };
}

export interface BranchMonth {
  branchId: string;
  branchName: string;
  status: "open" | "closed";
  employees: number;
  unpaidDays: number;
  otHours: number;
  missingPunchDays: number;
  pendingAdjustments: number;
  closedBy: string | null;
  closedAt: string | null;
  reopenReason: string | null;
  /** Payroll for this month is approved or locked: it cannot be reopened. */
  payrollFinalised: boolean;
}

export interface AttendancePageData {
  tab: AttendanceTab;
  today: string;
  period: { calendar: "BS" | "AD"; year: number; month: number; start: string; end: string; days: number; label: string };
  rules: AttendanceRules;
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  /** The branch filter in use ("" = all). */
  branchId: string;
  register: RegisterRow[];
  todayRows: { employee: RegisterEmployee; day: DayResult }[];
  punches: PunchView[];
  adjustments: AdjustmentView[];
  months: BranchMonth[];
  currentUserId: string;
  myEmployeeId: string | null;
  permissions: { add: boolean; edit: boolean; approve: boolean; lock: boolean; export: boolean; settings: boolean };
}

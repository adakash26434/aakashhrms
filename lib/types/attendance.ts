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

/**
 * One employee's working time on one day: their shift's hours for that
 * weekday and season (4.5b), or a day off. Worked out by
 * `lib/engines/shift.engine.ts`; the day rules only read it.
 */
export interface ShiftRule {
  id: string | null;
  code: string;
  name: string;
  /** Local (Nepal) times "HH:MM". A shift whose end is not after its start crosses midnight. Flexible: the window to work in. */
  start: string;
  end: string;
  breakMinutes: number;
  graceMinutes: number;
  /** Minutes worked for a full day / a half day. */
  fullDayMinutes: number;
  halfDayMinutes: number;
  /** Extra minutes below this are not overtime. */
  otMinimumMinutes: number;
  /** A weekly off (from the shift's week, or OFF on the roster). */
  off: boolean;
  /** Flexible hours: no late or early; overtime after a full day's hours. */
  flexible: boolean;
  /** The season whose hours apply ("Winter"), if any. */
  season?: string | null;
}

// ---------------------------------------------------------------------------
// 4.5b Shifts: defined by the company, assigned to people, rostered by day
// ---------------------------------------------------------------------------

export const SHIFT_KINDS = ["fixed", "flexible"] as const;
export type ShiftKind = (typeof SHIFT_KINDS)[number];

/** Shift colours (design tokens, so they follow light and dark themes). */
export const SHIFT_COLORS = ["green", "blue", "amber", "rose", "slate"] as const;
export type ShiftColor = (typeof SHIFT_COLORS)[number];

/** A weekday in a shift's week (index 0 Sunday … 6 Saturday): working or off, with its own hours when they differ. */
export interface ShiftWeekDay {
  working: boolean;
  start?: string | null;
  end?: string | null;
}

/** Hours for a BS date range that comes back every year (Winter: Kartik 16 – Magh 15). */
export interface ShiftSeason {
  name: string;
  fromMonth: number;
  fromDay: number;
  toMonth: number;
  toDay: number;
  start: string;
  end: string;
}

/** A shift as the company defines it. */
export interface ShiftDefinition {
  id: string;
  code: string;
  name: string;
  color: ShiftColor;
  kind: ShiftKind;
  start: string;
  end: string;
  breakMinutes: number;
  graceMinutes: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  otMinimumMinutes: number;
  /** Seven days, Sunday first. */
  week: ShiftWeekDay[];
  seasons: ShiftSeason[];
  isDefault: boolean;
  active: boolean;
}

/** A shift on the Shifts tab. */
export interface ShiftView extends ShiftDefinition {
  /** People whose shift it is today (assignment, branch or company default). */
  people: number;
  /** Plain summary: "09:00–17:00 · Sat, Sun off · Winter 09:00–16:00". */
  summary: string;
  /** Planned hours in a normal week (minutes). */
  weekMinutes: number;
  /** Labour Act reminders for this shift. */
  warnings: string[];
  /** Branches that use it as their default. */
  branchNames: string[];
}

/** Where a day's shift came from. */
export type ShiftSource = "roster" | "assignment" | "branch" | "company";

/** One roster row: an employee's shift for each day of the month. */
export interface RosterRow {
  employee: RegisterEmployee;
  days: { date: string; shiftId: string | null; code: string; off: boolean; source: ShiftSource; note: string | null }[];
  /** The employee's assignments that touch the month. */
  assignments: { shiftId: string; from: string; to: string | null }[];
  locked: boolean;
}

/** Company attendance rules (one source: system_config "attendance.*"). Working hours live in shifts. */
export interface AttendanceRules {
  /** Attendance (and pay) months: BS now; AD with payroll runs in AD months (4.8). */
  calendar: PeriodCalendar;
  /** A working day with nothing recorded counts as … */
  noRecord: "absent" | "present";
  /** "Every N late days = half a day unpaid" (off unless enabled). */
  lateRule: { enabled: boolean; count: number };
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
  /** The shift that applied (code, name, hours that day). */
  shift?: { id: string | null; code: string; name: string; start: string; end: string; season: string | null } | null;
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
export const ATTENDANCE_TABS = ["today", "register", "roster", "shifts", "adjustments", "close", "punches"] as const;
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
  /** Shifts (all, archived included) and the company default. */
  shifts: ShiftView[];
  defaultShiftId: string | null;
  roster: RosterRow[];
  /** Each branch's default shift (null = the company default). */
  branchDefaults: Record<string, string | null>;
  /** Company setup's winter time, offered as a season in the shift window (Shifts tab only). */
  winterHours: { start: string; end: string } | null;
  currentUserId: string;
  myEmployeeId: string | null;
  /** settings: rules and shift definitions (company-wide roles); edit: overrides, assignments and roster. */
  permissions: { add: boolean; edit: boolean; approve: boolean; lock: boolean; export: boolean; settings: boolean };
}

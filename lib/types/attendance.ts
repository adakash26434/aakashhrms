
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
    firstName: string;
    lastName: string;
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
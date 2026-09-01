
import type {
  AttendanceRecord,
  AttendanceFormData,
  AttendanceFilter,
  AttendanceKPIs,
  AttendanceValidationErrors,
} from "@/lib/types/attendance";

/**
 * Validate an attendance form submission.
 */
export function validateAttendanceRecord(
  data: AttendanceFormData,
  validEmployeeIds: string[]
): AttendanceValidationErrors {
  const errors: AttendanceValidationErrors = {};

  if (!data.employeeId) {
    errors.employeeId = "Employee is required.";
  } else if (!validEmployeeIds.includes(data.employeeId)) {
    errors.employeeId = "Selected employee does not exist.";
  }

  if (!data.attendanceDate || !data.attendanceDate.includes("-")) {
    errors.attendanceDate = "A valid date (YYYY-MM-DD) is required.";
  }

  if (!Number.isFinite(data.workHours) || data.workHours < 0 || data.workHours > 24) {
    errors.workHours = "Work hours must be between 0 and 24.";
  }

  if (
    !Number.isFinite(data.otHoursOfficeDay) ||
    data.otHoursOfficeDay < 0 ||
    !Number.isFinite(data.otHoursOffDay) ||
    data.otHoursOffDay < 0
  ) {
    errors.otHours = "Overtime hours cannot be negative.";
  }

  return errors;
}

/**
 * Parse a time string (e.g., "10:05 AM" or "17:15") into total minutes from midnight.
 */
export function parseTimeToMinutes(timeStr: string | null): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const cleaned = timeStr.trim().toUpperCase();
  
  // Check for AM/PM format
  const meridiemMatch = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (meridiemMatch) {
    let hour = parseInt(meridiemMatch[1], 10);
    const minute = parseInt(meridiemMatch[2], 10);
    const meridiem = meridiemMatch[3];
    if (hour === 12) hour = meridiem === "AM" ? 0 : 12;
    else if (meridiem === "PM") hour += 12;
    return hour * 60 + minute;
  }

  // Check for 24-hour format (e.g., "14:30")
  const twentyFourMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourMatch) {
    const hour = parseInt(twentyFourMatch[1], 10);
    const minute = parseInt(twentyFourMatch[2], 10);
    return hour * 60 + minute;
  }

  return null;
}

/**
 * Calculate elapsed working hours between check-in and check-out times.
 */
export function calculateWorkHours(inTime: string | null, outTime: string | null): number {
  const inMins = parseTimeToMinutes(inTime);
  const outMins = parseTimeToMinutes(outTime);
  if (inMins === null || outMins === null || outMins <= inMins) return 0;
  
  const diffHours = (outMins - inMins) / 60;
  return Math.round(diffHours * 100) / 100;
}

/**
 * Evaluate if an employee arrived late against the configured office start time and grace window.
 *
 * @param inTime - Employee's check-in time string (e.g. "10:45 AM")
 * @param officeStartHour - 24-hour start hour (default: 10 for 10:00 AM)
 * @param officeStartMinute - Start minute (default: 0)
 * @param graceWindowMinutes - Allowed grace minutes from System Control (default: 40)
 */
export function evaluateLateArrival(
  inTime: string | null,
  officeStartHour = 10,
  officeStartMinute = 0,
  graceWindowMinutes = 40
): boolean {
  const inMins = parseTimeToMinutes(inTime);
  if (inMins === null) return false;

  const thresholdMins = officeStartHour * 60 + officeStartMinute + graceWindowMinutes;
  return inMins > thresholdMins;
}

/**
 * Calculate top-level attendance KPI metrics from a list of records.
 */
export function calculateAttendanceKPIs(
  records: AttendanceRecord[],
  totalActiveEmployees: number
): AttendanceKPIs {
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let onLeaveCount = 0;
  let totalOtHours = 0;

  for (const r of records) {
    if (r.status === "Present" || r.status === "Half Day") presentCount++;
    else if (r.status === "Absent" || r.status === "LWOP") absentCount++;
    else if (r.status === "On Leave") onLeaveCount++;

    if (r.isLate) lateCount++;
    totalOtHours += r.otHoursOfficeDay + r.otHoursOffDay;
  }

  // Any employee without a record for the selected date is counted as unposted/absent
  const unrecordedCount = Math.max(0, totalActiveEmployees - records.length);
  absentCount += unrecordedCount;

  return {
    totalEmployees: totalActiveEmployees,
    presentCount,
    absentCount,
    lateCount,
    onLeaveCount,
    totalOtHours: Math.round(totalOtHours * 100) / 100,
  };
}

/**
 * Apply search and dropdown filters to an array of attendance records.
 */
export function filterAttendanceRecords(
  records: AttendanceRecord[],
  filter: AttendanceFilter
): AttendanceRecord[] {
  const q = filter.search.trim().toLowerCase();

  return records.filter((r) => {
    if (q) {
      const matchName = r.employeeName.toLowerCase().includes(q);
      const matchCode = r.employeeCode.toLowerCase().includes(q);
      const matchAttCode = r.attendanceCode.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchAttCode) return false;
    }

    if (filter.departmentId !== "all" && r.departmentId !== filter.departmentId) {
      return false;
    }

    if (filter.branchId !== "all" && r.branchId !== filter.branchId) {
      return false;
    }

    if (filter.status !== "all" && r.status !== filter.status) {
      return false;
    }

    if (filter.isLateOnly && !r.isLate) {
      return false;
    }

    return true;
  });
}
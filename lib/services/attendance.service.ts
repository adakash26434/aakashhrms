
import Decimal from "decimal.js";
import * as repository from "@/lib/repositories/attendance.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import * as salaryRepository from "@/lib/repositories/salary-mapping.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import {
  validateAttendanceRecord,
  calculateWorkHours,
  evaluateLateArrival,
  calculateAttendanceKPIs,
  filterAttendanceRecords,
} from "@/lib/engines/attendance.engine";
import type {
  AttendanceData,
  AttendanceFormData,
  AttendanceFilter,
  AttendanceBulkItem,
  AttendanceRecord,
} from "@/lib/types/attendance";

/**
 * Load initial page data for the selected date.
 */
export async function getAttendanceData(filter: AttendanceFilter): Promise<AttendanceData> {
  const targetDate = filter.date || new Date().toISOString().split("T")[0];

  const [records, employees, departments, branches, fiscalYears] = await Promise.all([
    repository.findAttendanceByDate(targetDate),
    employeeRepository.findAll({ search: "", departmentId: "all", branchId: "all", category: "all", status: "Active" }),
    departmentRepository.findAllDepartments(),
    branchRepository.findAllBranches(),
    fiscalYearRepository.findAllFiscalYears(),
  ]);

  const activeEmployees = employees.filter((e) => e.status === "Active");
  const activeFy = fiscalYears.find((f) => f.status === "Active");
  if (!activeFy) {
    throw new Error("Active fiscal year not found. Please activate a fiscal year in settings.");
  }

  // Filter records if needed
  const filteredRecords = filterAttendanceRecords(records, filter);
  const kpis = calculateAttendanceKPIs(filteredRecords, activeEmployees.length);

  return {
    records: filteredRecords,
    employees: activeEmployees.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      attendanceCode: e.attendanceCode || e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      departmentId: e.departmentId,
      departmentName: departments.find((d) => d.id === e.departmentId)?.name ?? "—",
      branchId: e.branchId,
      branchName: branches.find((b) => b.id === e.branchId)?.name ?? "—",
    })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    activeFiscalYear: { id: activeFy.id, label: "label" in activeFy ? activeFy.label : "FY 2081/82" },
    kpis,
    selectedDate: targetDate,
  };
}

/**
 * Save or update a single daily attendance punch.
 * Evaluates grace windows and elapsed work hours automatically.
 */
export async function saveAttendancePunch(
  id: string | null,
  formData: AttendanceFormData
): Promise<AttendanceRecord> {
  const employees = await employeeRepository.findAll({ search: "", departmentId: "all", branchId: "all", category: "all", status: "Active" });
  const errors = validateAttendanceRecord(formData, employees.map((e) => e.id));

  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors)[0] || "Validation failed.");
  }

  // Calculate work hours if times provided
  const computedHours = formData.inTime && formData.outTime
    ? calculateWorkHours(formData.inTime, formData.outTime)
    : formData.workHours || 8;

  // Evaluate late arrival against 9:00 AM start with 40-min grace window
  const isLate = formData.inTime ? evaluateLateArrival(formData.inTime, 9, 0, 40) : formData.isLate;

  return await repository.saveRecord(id, {
    employeeId: formData.employeeId,
    fiscalYearId: formData.fiscalYearId,
    attendanceDate: formData.attendanceDate,
    status: formData.status,
    inTime: formData.inTime || null,
    outTime: formData.outTime || null,
    workHours: computedHours,
    otHoursOfficeDay: formData.otHoursOfficeDay || 0,
    otHoursOffDay: formData.otHoursOffDay || 0,
    isLate,
    remarks: formData.remarks || null,
  });
}

/**
 * Bulk post daily attendance for multiple employees.
 */
export async function bulkPostAttendance(
  attendanceDate: string,
  items: AttendanceBulkItem[],
  fiscalYearId?: string
) {
  return await repository.bulkSaveRecords(attendanceDate, items, fiscalYearId);
}

/**
 * Delete an attendance punch record.
 */
export async function deleteAttendanceRecord(id: string): Promise<void> {
  await repository.remove(id);
}

/**
 * PRE-PAYROLL CALCULATION ENGINE:
 * Aggregates monthly working days, computes statutory LWOP deductions & earned OT,
 * and locks the record for Phase 6 payroll payslip generation.
 */
export async function runAndLockMonthlyCalculation(
  employeeId: string,
  bsMonth: number,
  datePrefix: string
) {
  // 1. Fetch all attendance punches for the month
  const records = await repository.findByEmployeeAndMonthPrefix(employeeId, datePrefix);

  let presentDays = 0;
  let absentDays = 0;
  let payLeaveDays = 0;
  let nonPayLeaveDays = 0;
  let totalOtHoursOffice = 0;
  let totalOtHoursOff = 0;

  const weeklyHoursMap = new Map<string, number>();
  const dailyViolations: string[] = [];

  for (const r of records) {
    if (r.status === "Present") presentDays += 1;
    else if (r.status === "Half Day") presentDays += 0.5;
    else if (r.status === "Absent") absentDays += 1;
    else if (r.status === "On Leave") payLeaveDays += 1;
    else if (r.status === "LWOP") nonPayLeaveDays += 1;

    const dailyOt = Number(r.otHoursOfficeDay) + Number(r.otHoursOffDay);
    totalOtHoursOffice += Number(r.otHoursOfficeDay);
    totalOtHoursOff += Number(r.otHoursOffDay);

    // 1. Daily OT limit violation check (> 4 hours)
    if (dailyOt > 4) {
      dailyViolations.push(`${r.attendanceDate} (${dailyOt} hrs)`);
    }

    // 2. Weekly OT limit violation check (> 24 hours)
    // Find standard calendar week start (Sunday)
    try {
      const d = new Date(r.attendanceDate);
      const day = d.getDay();
      const diff = d.getDate() - day;
      const sunday = new Date(d.setDate(diff));
      const weekKey = sunday.toISOString().split("T")[0];
      const currentSum = weeklyHoursMap.get(weekKey) || 0;
      weeklyHoursMap.set(weekKey, currentSum + dailyOt);
    } catch (e) {
      console.error("Failed to parse date for weekly OT grouping:", r.attendanceDate, e);
    }
  }

  const weeklyViolations: string[] = [];
  for (const [weekKey, sum] of weeklyHoursMap.entries()) {
    if (sum > 24) {
      weeklyViolations.push(`Week starting ${weekKey} (${sum} hrs)`);
    }
  }

  const otWarningsList: string[] = [];
  if (dailyViolations.length > 0) {
    otWarningsList.push(`Daily limit (4 hrs) exceeded on: ${dailyViolations.join(", ")}`);
  }
  if (weeklyViolations.length > 0) {
    otWarningsList.push(`Weekly limit (24 hrs) exceeded in: ${weeklyViolations.join(", ")}`);
  }
  const otWarnings = otWarningsList.length > 0 ? otWarningsList.join("; ") : null;

  const totalWorkingDays = presentDays + absentDays + payLeaveDays + nonPayLeaveDays || 30;

  // 2. Retrieve foundational pay (Basic + Grade) from Phase 3 Salary Mapping
  const salaryMap = await salaryRepository.findByEmployeeId(employeeId);
  const basicDec = new Decimal(salaryMap ? salaryMap.basicSalary : 0);
  const gradeDec = new Decimal(salaryMap ? salaryMap.gradeAmount : 0);
  const basePayDec = basicDec.plus(gradeDec);

  // 3. Statutory LWOP deduction: (Base Pay / Working Days) * Unpaid Days
  const workDaysDec = new Decimal(totalWorkingDays);
  const nonPayDaysDec = new Decimal(nonPayLeaveDays);
  const leaveDeductionAmount = nonPayDaysDec.gt(0)
    ? basePayDec.dividedBy(workDaysDec).times(nonPayDaysDec).toDecimalPlaces(2).toNumber()
    : 0;

  // 4. Compute OT Earned Amount using configured multipliers (defaulting to 1.5 for office day and 2.0 for off day)
  const systemSettings = await systemControlRepository.findSettings();
  const multOfficeDec = new Decimal(systemSettings?.officeTime?.otMultiplierOfficeDay || 1.5);
  const multOffDec = new Decimal(systemSettings?.officeTime?.otMultiplierOffDay || 2.0);

  const hourlyRateDec = basicDec.dividedBy(new Decimal(30).times(8)); // 30 days divisor * 8 hours
  const otRateOfficeDec = hourlyRateDec.times(multOfficeDec);
  const otRateOffDec = hourlyRateDec.times(multOffDec);
  const otEarnedAmount = new Decimal(totalOtHoursOffice)
    .times(otRateOfficeDec)
    .plus(new Decimal(totalOtHoursOff).times(otRateOffDec))
    .toDecimalPlaces(2)
    .toNumber();

  // 5. Save and lock
  return await repository.saveCalculationLock({
    employeeId,
    bsMonth,
    totalWorkingDays,
    presentDays,
    absentDays,
    payLeaveDays,
    nonPayLeaveDays,
    totalOtHoursOffice,
    totalOtHoursOff,
    otEarnedAmount,
    leaveDeductionAmount,
    otWarnings,
    isLocked: true,
  });
}
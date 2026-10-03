import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import * as attendanceRepository from "@/lib/repositories/attendance.repository";
import * as payrollRepository from "@/lib/repositories/payroll.repository";
import * as loanRepository from "@/lib/repositories/loan.repository";
import * as auditRepository from "@/lib/repositories/audit.repository";
import * as userService from "@/lib/services/user.service";
import { getEmployeeInScope } from "@/lib/services/employee.service";
import { attendanceMonth, historySummary, missingRecords, resolveRecordTab } from "@/lib/engines/employee.engine";
import { bsMonthDaysToDate, periodLabel } from "@/lib/engines/dashboard.engine";
import { maskAccountNumber } from "@/lib/utils/mask";
import { nepalToday, toLocalDate } from "@/lib/utils/nepal-time";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type { Employee, EmployeeProfile, EmployeeRecordData, EmployeeRecordTab, EmployeeRecordTabData } from "@/lib/types/employee";

/** Which related tabs this user may open (each needs its own module's VIEW). */
export interface RecordTabAccess {
  leave: boolean;
  attendance: boolean;
  payslips: boolean;
  loans: boolean;
  history: boolean;
}

async function buildProfile(employee: Employee): Promise<EmployeeProfile> {
  const [branches, departments, designations, supervisor, access] = await Promise.all([
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    employee.supervisorId ? employeeRepository.findById(employee.supervisorId) : Promise.resolve(undefined),
    userService.getEmployeeAccess(employee.id),
  ]);
  const { bankAccountNumber, ...rest } = employee;
  return {
    ...rest,
    bankAccountMasked: maskAccountNumber(bankAccountNumber),
    departmentName: departments.find((d) => d.id === employee.departmentId)?.name ?? "",
    designationName: designations.find((d) => d.id === employee.designationId)?.name ?? "",
    branchName: branches.find((b) => b.id === employee.branchId)?.name ?? "",
    supervisor: supervisor ? { id: supervisor.id, name: supervisor.fullName } : null,
    gaps: missingRecords(employee),
    access: access
      ? {
          email: access.email,
          roleName: access.roleName ?? null,
          state: !access.isActive ? "disabled" : access.mustChangePassword ? "pending" : "active",
          lastLoginAt: access.lastLoginAt ?? null,
        }
      : null,
  };
}

async function loadTab(tab: EmployeeRecordTab, employeeId: string): Promise<EmployeeRecordTabData> {
  switch (tab) {
    case "leave": {
      const fiscalYears = await fiscalYearRepository.findAllFiscalYears();
      const active = fiscalYears.find((fy) => fy.status === "Active");
      const [balances, requests] = await Promise.all([
        active ? leaveRepository.findLeaveBalancesWithTypes(employeeId, active.id) : Promise.resolve([]),
        leaveRepository.findRecentLeaveByEmployee(employeeId, 10),
      ]);
      return { tab, data: { fiscalYearLabel: active?.label ?? null, balances, requests } };
    }
    case "attendance": {
      const today = nepalToday();
      const month = bsMonthDaysToDate(today);
      const days = month.days.map((date, i) => ({ date, bsDay: i + 1, weekday: toLocalDate(date)?.getDay() ?? 0 }));
      const records = days.length ? await attendanceRepository.findAttendanceForEmployee(employeeId, days[0].date, days[days.length - 1].date) : [];
      return { tab, data: attendanceMonth(month.label, days, records) };
    }
    case "payslips": {
      const slips = await payrollRepository.findSlipsByEmployee(employeeId, 12);
      return { tab, data: slips.map((s) => ({ ...s, periodLabel: periodLabel(s.year, s.month) })) };
    }
    case "loans":
      return { tab, data: await loanRepository.findLoansByEmployee(employeeId) };
    case "history": {
      const rows = await auditRepository.findAuditTrailForRecord("EMPLOYEES", employeeId, 50);
      return {
        tab,
        data: rows.map((r) => ({
          id: r.id,
          at: r.at,
          userName: r.userName ?? null,
          action: String(r.action),
          result: r.result,
          summary: historySummary({ action: String(r.action), result: r.result, newValues: r.newValues }),
        })),
      };
    }
    default:
      return { tab: "profile" };
  }
}

/**
 * The record page (4.2): the employee (scoped, S18) and the requested tab's
 * data. Only the active tab is loaded; a tab the user may not see falls back
 * to Profile. Returns null for a missing or out-of-scope employee.
 */
export async function getEmployeeRecord(
  id: string,
  requestedTab: unknown,
  scope: ScopeFilter,
  access: RecordTabAccess,
  permissions: EmployeeRecordData["permissions"]
): Promise<EmployeeRecordData | null> {
  const employee = await getEmployeeInScope(id, scope);
  if (!employee) return null;

  const tabs: EmployeeRecordTab[] = ["profile"];
  if (access.leave) tabs.push("leave");
  if (access.attendance) tabs.push("attendance");
  if (access.payslips) tabs.push("payslips");
  if (access.loans) tabs.push("loans");
  if (access.history) tabs.push("history");
  const tab = resolveRecordTab(requestedTab, tabs);

  const profile = await buildProfile(employee);
  try {
    const active = await loadTab(tab, employee.id);
    return { profile, tabs, active, failed: false, permissions };
  } catch (error) {
    console.error(`[employee-record] tab "${tab}" failed`, error instanceof Error ? error.message : error);
    return { profile, tabs, active: { tab: "profile" }, failed: true, permissions };
  }
}

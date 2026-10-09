/**
 * Dashboard service (roadmap 4.1): builds the /dashboard snapshot.
 *
 * Security (S3, S15, S17):
 * - each section is loaded only when the user holds the matching permission;
 * - everything employee-based (payroll sums, attendance, leave, headcount,
 *   readiness, approvals) is restricted to the user's branch / department /
 *   self scope, and to the branch filter, which only company-wide users get;
 * - nothing comes from placeholder data: a failed section is reported as
 *   failed, never shown as zero.
 */

import { and, eq, type SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ensureTenantContext } from "@/lib/db";
import { employees as employeesTable, payrollSlips, leaveApplications } from "@/lib/db/schema";
import { hasPermission, requireAuthenticatedUser } from "@/lib/auth/check-permission";
import { buildEmployeeIdScopeCondition, buildEmployeeScopeCondition, resolveUserScope, type ScopeFilter } from "@/lib/auth/scope-filter";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { getWorkspaceContext } from "@/lib/services/workspace-context.service";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import * as payrollRepository from "@/lib/repositories/payroll.repository";
import * as attendanceService from "@/lib/services/attendance.service";
import * as auditRepository from "@/lib/repositories/audit.repository";
import * as holidayRepository from "@/lib/repositories/holiday.repository";
import * as engine from "@/lib/engines/dashboard.engine";
import { adToBS } from "@/lib/utils/bs-calendar";
import { nepalDateIso, nepalToday, toIsoDate, toLocalDate } from "@/lib/utils/nepal-time";
import type { Employee } from "@/lib/types/employee";
import type { DashboardAccess, DashboardActivity, DashboardData } from "@/lib/types/dashboard";
import { boardFor } from "@/lib/services/notice.service";

/** Latest entries that fit a dashboard card; the full history is one click away. */
const ACTIVITY_LIMIT = 6;
const GLOBAL_SCOPE = (userId: string): ScopeFilter => ({ scopeType: "GLOBAL", branchIds: [], departmentIds: [], employeeId: null, userId });

export interface DashboardParams {
  period?: string | string[];
  branch?: string | string[];
}

async function section<T>(name: string, failed: string[], load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.error(`[dashboard] section "${name}" failed`, error);
    failed.push(name);
    return null;
  }
}

function moduleLabel(module: string): string {
  const text = module.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function getDashboardSnapshot(params: DashboardParams = {}): Promise<DashboardData> {
  await ensureTenantContext();
  const { userId, isImpersonation } = await requireAuthenticatedUser();
  const supportView = isImpersonation || !!(await getImpersonationSession());

  const [employees, employeesAdd, attendance, leaveApprovals, payrollGenerate, payrollReview, audit] = await Promise.all([
    hasPermission("VIEW", "EMPLOYEES"),
    hasPermission("ADD", "EMPLOYEES"),
    hasPermission("VIEW", "ATTENDANCE"),
    hasPermission("VIEW", "LEAVE_APPROVALS"),
    hasPermission("VIEW", "PAYROLL_GENERATE"),
    hasPermission("VIEW", "PAYROLL_REVIEW"),
    hasPermission("VIEW", "AUDIT_LOG"),
  ]);
  const payroll = payrollGenerate || payrollReview;

  const session = await auth();
  const scope = supportView ? GLOBAL_SCOPE(userId) : await resolveUserScope(userId, session?.user?.tenantSlug);
  const context = await getWorkspaceContext().catch(() => null);
  const displayName = supportView ? "Support" : context?.user.name || session?.user?.name || "there";

  const failed: string[] = [];
  const today = nepalToday();
  const todayIso = nepalDateIso();
  const bsToday = adToBS(today);
  const thisMonth = { year: bsToday.year, month: bsToday.month };

  // Branch filter: company-wide users only, and only a branch that exists.
  const allBranches = await section("branches", failed, () => branchRepository.findAllBranches());
  const branchOptions = scope.scopeType === "GLOBAL" ? (allBranches ?? []).map((b) => ({ id: b.id, name: b.name })) : [];
  const requestedBranch = first(params.branch);
  const branchId = requestedBranch && branchOptions.some((b) => b.id === requestedBranch) ? requestedBranch : null;
  const branchScope: ScopeFilter | null = branchId ? { scopeType: "BRANCH", branchIds: [branchId], departmentIds: [], employeeId: null, userId } : null;

  // Conditions combining the user's scope with the branch filter.
  const employeeCondition = and(buildEmployeeScopeCondition(scope), branchId ? eq(employeesTable.branchId, branchId) : undefined);
  const byEmployeeId = (column: Parameters<typeof buildEmployeeIdScopeCondition>[1]): SQL | undefined =>
    and(buildEmployeeIdScopeCondition(scope, column), branchScope ? buildEmployeeIdScopeCondition(branchScope, column) : undefined);

  const branchName = (id: string) => (allBranches ?? []).find((b) => b.id === id)?.name;
  const scopeLabel =
    scope.scopeType === "BRANCH"
      ? `${scope.branchIds.map(branchName).filter(Boolean).join(", ") || "Assigned"} branch`
      : scope.scopeType === "DEPARTMENT"
        ? "Your departments"
        : scope.scopeType === "SELF"
          ? "Your own records"
          : null;

  const access: DashboardAccess = {
    employees,
    employeesAdd: employeesAdd && !supportView,
    attendance,
    leaveApprovals,
    payroll,
    payrollGenerate,
    payrollReview,
    audit,
    supportView,
    scopeLabel,
  };

  const needsEmployees = employees || attendance || leaveApprovals || payroll;
  const wantsLeave = leaveApprovals || attendance || employees;
  const monthDays = engine.bsMonthDaysToDate(today);
  const monthStart = monthDays.days[0] ?? todayIso;

  const [scopedEmployees, departments, runs, pending, approved, leaveTypes, joinersLeavers, marks, leaveByType, activityLogs, holidays] = await Promise.all([
    needsEmployees
      ? section("employees", failed, () =>
          employeeRepository.findAll({ search: "", departmentId: "all", branchId: branchId ?? "all", category: "all", status: "Active" }, buildEmployeeScopeCondition(scope))
        )
      : null,
    needsEmployees ? section("departments", failed, () => departmentRepository.findAllDepartments()) : null,
    payroll ? section("payroll", failed, () => payrollRepository.findAllPayrollRuns()) : null,
    leaveApprovals ? section("approvals", failed, () => leaveRepository.findAllLeaveApplications({ status: "Pending" })) : null,
    wantsLeave ? section("leave", failed, () => leaveRepository.findAllLeaveApplications({ status: "Approved" })) : null,
    wantsLeave ? section("leave types", failed, () => leaveRepository.findAllLeaveTypes()) : null,
    employees ? section("headcount", failed, () => employeeRepository.countJoinersLeavers(monthStart, todayIso, employeeCondition)) : null,
    // Days by the attendance rules (4.5), within the user's scope.
    attendance ? section("attendance", failed, () => attendanceService.attendanceMarks(scope, monthStart, todayIso, branchId ?? undefined)) : null,
    leaveApprovals || attendance ? section("leave by type", failed, () => leaveRepository.sumApprovedLeaveDaysByType(byEmployeeId(leaveApplications.employeeId))) : null,
    audit ? section("activity", failed, () => auditRepository.findAuditLogs({ limit: ACTIVITY_LIMIT })) : null,
    employees || attendance ? section("upcoming", failed, () => holidayRepository.findAllHolidays()) : null,
  ]);

  const employeeMap = new Map((scopedEmployees ?? []).map((e: Employee) => [e.id, e]));
  const departmentNames = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const leaveTypeNames = new Map((leaveTypes ?? []).map((t) => [t.id, t.name]));
  const inScope = (employeeId: string) => employeeMap.has(employeeId);

  // ---- Payroll: run status, the selected period, costs ----------------------
  const scopedRuns = (runs ?? []).filter((r) => !branchId || r.branchIds.length === 0 || r.branchIds.includes(branchId));
  const latestRun = engine.latestRunPeriod(scopedRuns);
  const period = engine.resolvePeriod(
    engine.parsePeriodOption(first(params.period)),
    latestRun ? { year: latestRun.year, month: latestRun.month } : null,
    thisMonth
  );
  const deadlines = payroll ? engine.upcomingDeadlines(today) : null;

  let kpis: DashboardData["kpis"] = null;
  let costTrend: DashboardData["costTrend"] = null;
  let costBreakdown: DashboardData["costBreakdown"] = null;
  let departmentCost: DashboardData["departmentCost"] = null;
  let deadlineRows: DashboardData["deadlines"] = deadlines ? deadlines.map((d) => ({ ...d, amount: null })) : null;
  let statutory: DashboardData["statutory"] = null;
  // Pay-run figures come from the payslips (like the salary sheet): the stored
  // run totals can lag behind slip edits.
  let payRunLatest = latestRun;

  if (payroll && runs) {
    const trendStart = engine.shiftPeriod(period.current.to, -11);
    const fromRef =
      engine.periodKey(period.previous.from.year, period.previous.from.month) < engine.periodKey(trendStart.year, trendStart.month) ? period.previous.from : trendStart;
    const toKey = engine.periodKey(period.current.to.year, period.current.to.month);
    const loaded = await section("payroll", failed, async () => {
      const slipCondition = byEmployeeId(payrollSlips.employeeId);
      const [rows, departmentsCost] = await Promise.all([
        payrollRepository.sumSlipsByPeriod({ fromKey: engine.periodKey(fromRef.year, fromRef.month), toKey, employeeCondition: slipCondition }),
        payrollRepository.sumSlipsByDepartment({ fromKey: engine.periodKey(period.current.from.year, period.current.from.month), toKey, employeeCondition: slipCondition }),
      ]);
      return { rows, departmentsCost };
    });
    if (loaded) {
      const current = loaded.rows.filter((r) => engine.inWindow(r, period.current));
      kpis = engine.buildKpis({
        rows: loaded.rows,
        period,
        activeHeadcount: employees && scopedEmployees ? scopedEmployees.length : null,
        joiners: joinersLeavers?.joiners ?? null,
        leavers: joinersLeavers?.leavers ?? null,
        nextDeadline: deadlines?.[0] ?? null,
      });
      costTrend = engine.costTrend(loaded.rows, period.current.to, 12);
      const currentTotals = engine.sumCostRows(current);
      costBreakdown = current.length ? engine.costBreakdown(currentTotals) : { total: 0, segments: [] };
      statutory = engine.statutorySummary(currentTotals);
      departmentCost = engine.topDepartments(loaded.departmentsCost);
      const latestRow = latestRun ? loaded.rows.find((r) => r.year === latestRun.year && r.month === latestRun.month) : undefined;
      if (latestRun && latestRow) payRunLatest = { ...latestRun, gross: latestRow.gross, net: latestRow.net, employees: latestRow.employees };
      deadlineRows = (deadlines ?? []).map((d) => {
        const row = loaded.rows.find((r) => r.year === d.forYear && r.month === d.forMonth);
        const t = row ? engine.sumCostRows([row]) : null;
        return { ...d, amount: t ? (d.ruleId === "tds" ? t.tds : t.ssfEmployee + t.ssfEmployer) : null };
      });
    }
  }

  // ---- Attendance this month -------------------------------------------------
  const approvedSpans = (approved ?? [])
    .filter((a) => inScope(a.employeeId))
    .flatMap((a) => {
      const from = toLocalDate(a.effectiveFrom);
      const to = toLocalDate(a.effectiveTo);
      return from && to ? [{ employeeId: a.employeeId, from: toIsoDate(from), to: toIsoDate(to), leaveTypeId: a.leaveTypeId }] : [];
    });
  const attendanceDays = attendance && marks && scopedEmployees ? engine.attendanceByDay(monthDays.days, [...employeeMap.keys()], marks, approvedSpans) : null;
  const attendanceSection =
    attendanceDays && scopedEmployees
      ? { monthLabel: monthDays.label, total: scopedEmployees.length, days: attendanceDays, ratePct: engine.attendanceRate(attendanceDays) }
      : null;

  // ---- Upcoming: holidays for the user's branches, birthdays and anniversaries in scope ----
  const visibleBranches = branchId ? [branchId] : scope.scopeType === "GLOBAL" ? null : [...new Set((scopedEmployees ?? []).map((e) => e.branchId))];
  const upcoming =
    holidays && scopedEmployees
      ? engine.upcomingEvents({
          today,
          holidays: holidays.filter((h) => !visibleBranches || h.branchIds.length === 0 || h.branchIds.some((b) => visibleBranches.includes(b))),
          // Personal dates only for users who may see employee records.
          employees: employees ? scopedEmployees : [],
          limit: 6,
        })
      : null;

  // ---- Leave ------------------------------------------------------------------
  const onLeaveToday =
    wantsLeave && approved && scopedEmployees
      ? approvedSpans
          .filter((a) => a.from <= todayIso && todayIso <= a.to)
          .map((a) => ({ name: employeeMap.get(a.employeeId)?.fullName ?? "Employee", leaveType: leaveTypeNames.get(a.leaveTypeId) ?? "Leave", until: a.to }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : null;

  const approvals =
    leaveApprovals && pending && scopedEmployees
      ? engine.approvalsPreview(
          pending.filter((p) => inScope(p.employeeId)),
          { employeeNames: new Map([...employeeMap].map(([id, e]) => [id, e.fullName])), leaveTypeNames, today }
        )
      : null;

  // ---- Workforce ----------------------------------------------------------------
  const headcount =
    employees && scopedEmployees
      ? [
          ...scopedEmployees.reduce((m, e) => {
            const name = departmentNames.get(e.departmentId) ?? "Unassigned";
            return m.set(name, (m.get(name) ?? 0) + 1);
          }, new Map<string, number>()),
        ]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      : null;

  const activity: DashboardActivity[] | null = activityLogs
    ? activityLogs.logs.slice(0, ACTIVITY_LIMIT).map((log) => ({
        id: log.id,
        actor: log.userName || log.userEmail || "System",
        action: String(log.action),
        module: moduleLabel(String(log.module)),
        result: String(log.result ?? "SUCCESS"),
        at: new Date(log.createdAt).toISOString(),
      }))
    : null;

  // The notice board is for everyone signed in (support view reads nothing personal: notices are company content).
  const notices = await section("notices", failed, () => boardFor(scope));

  return {
    generatedAt: new Date().toISOString(),
    todayIso,
    displayName,
    access,
    filters: { period, branchId, branches: branchOptions },
    kpis,
    costTrend,
    costBreakdown,
    departmentCost,
    attendance: attendanceSection,
    statutory,
    upcoming,
    fiscalProgress: engine.fiscalProgress(thisMonth),
    payRun: payroll && runs ? { latest: payRunLatest, next: engine.nextPeriodToRun(latestRun, thisMonth) } : null,
    deadlines: deadlineRows,
    approvals,
    readiness: employees && payroll && scopedEmployees ? { checked: scopedEmployees.length, issues: engine.payrollReadiness(scopedEmployees) } : null,
    leaveByType: leaveByType ?? null,
    onLeaveToday,
    headcount,
    activity,
    notices: notices ?? null,
    failed: [...new Set(failed)],
  };
}

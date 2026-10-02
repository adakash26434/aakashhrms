/**
 * Home (Phase 4.1, template F): the work-queue snapshot for the signed-in user.
 *
 * Security (S3, S15, S17):
 * - each section is loaded only when the user holds the matching permission;
 * - employee-based sections (approvals, today, readiness, headcount, loans)
 *   are restricted to the user's branch / department / self scope;
 * - nothing is computed from placeholder data: a failed section is reported
 *   as failed, never shown as zero.
 */

import Decimal from "decimal.js";
import { auth } from "@/lib/auth";
import { ensureTenantContext } from "@/lib/db";
import { hasPermission, requireAuthenticatedUser } from "@/lib/auth/check-permission";
import { buildEmployeeScopeCondition, resolveUserScope, type ScopeFilter } from "@/lib/auth/scope-filter";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { getWorkspaceContext } from "@/lib/services/workspace-context.service";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import * as payrollRepository from "@/lib/repositories/payroll.repository";
import * as attendanceRepository from "@/lib/repositories/attendance.repository";
import * as loanRepository from "@/lib/repositories/loan.repository";
import * as auditRepository from "@/lib/repositories/audit.repository";
import { adToBS } from "@/lib/utils/bs-calendar";
import type { Employee } from "@/lib/types/employee";
import { employeeInScope } from "@/lib/leave/decision";
import { nepalDateIso, nepalToday, toIsoDate, toLocalDate } from "@/lib/home/nepal-time";
import { upcomingDeadlines } from "@/lib/home/deadlines";
import { groupByPeriod, latestPeriod, nextPeriodToRun, payrollTrend, summarizePeriod } from "@/lib/home/payroll-period";
import { payrollReadiness } from "@/lib/home/readiness";
import { buildLeaveQueue } from "@/lib/home/leave-queue";
import type { HomeAccess, HomeActivity, HomeData } from "@/lib/home/types";

/** Keep the snapshot small: the queue shows this many, the link shows the rest. */
const QUEUE_LIMIT = 50;
const ACTIVITY_LIMIT = 8;

const GLOBAL_SCOPE = (userId: string): ScopeFilter => ({ scopeType: "GLOBAL", branchIds: [], departmentIds: [], employeeId: null, userId });

async function section<T>(name: string, failed: string[], load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.error(`[home] section "${name}" failed`, error);
    failed.push(name);
    return null;
  }
}

function moduleLabel(module: string): string {
  const text = module.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function getHomeSnapshot(): Promise<HomeData> {
  await ensureTenantContext();
  const { userId, isImpersonation } = await requireAuthenticatedUser();
  const supportView = isImpersonation || !!(await getImpersonationSession());

  const [employees, employeesAdd, attendance, leaveApprovals, leaveApprove, payrollGenerate, payrollReview, loans, audit] = await Promise.all([
    hasPermission("VIEW", "EMPLOYEES"),
    hasPermission("ADD", "EMPLOYEES"),
    hasPermission("VIEW", "ATTENDANCE"),
    hasPermission("VIEW", "LEAVE_APPROVALS"),
    hasPermission("APPROVE", "LEAVE_APPROVALS"),
    hasPermission("VIEW", "PAYROLL_GENERATE"),
    hasPermission("VIEW", "PAYROLL_REVIEW"),
    hasPermission("VIEW", "LOANS"),
    hasPermission("VIEW", "AUDIT_LOG"),
  ]);

  const session = await auth();
  const scope = supportView ? GLOBAL_SCOPE(userId) : await resolveUserScope(userId, session?.user?.tenantSlug);
  const context = await getWorkspaceContext().catch(() => null);
  const displayName = supportView ? "Support" : context?.user.name || session?.user?.name || "there";

  const failed: string[] = [];
  const today = nepalToday();
  const todayIso = nepalDateIso();
  const bsToday = adToBS(today);
  const needsEmployees = employees || attendance || leaveApprovals || loans;

  const [scopedEmployees, departments, branches] = await Promise.all([
    needsEmployees
      ? section("employees", failed, () =>
          employeeRepository.findAll(
            { search: "", departmentId: "all", branchId: "all", category: "all", status: "Active" },
            buildEmployeeScopeCondition(scope)
          )
        )
      : Promise.resolve(null),
    needsEmployees ? section("departments", failed, () => departmentRepository.findAllDepartments()) : Promise.resolve(null),
    scope.scopeType === "BRANCH" ? section("branches", failed, () => branchRepository.findAllBranches()) : Promise.resolve(null),
  ]);

  const departmentNames = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const employeeMap = new Map((scopedEmployees ?? []).map((e: Employee) => [e.id, e]));
  const inScope = (employeeId: string) => {
    const e = employeeMap.get(employeeId);
    return !!e && employeeInScope(scope, e);
  };

  const scopeLabel =
    scope.scopeType === "BRANCH"
      ? `${scope.branchIds.map((id) => (branches ?? []).find((b) => b.id === id)?.name).filter(Boolean).join(", ") || "Assigned"} branch`
      : scope.scopeType === "DEPARTMENT"
        ? `${scope.departmentIds.map((id) => departmentNames.get(id)).filter(Boolean).join(", ") || "Assigned"} department`
        : scope.scopeType === "SELF"
          ? "Your own records"
          : null;

  const access: HomeAccess = {
    employees,
    employeesAdd: employeesAdd && !supportView,
    attendance,
    leaveApprovals,
    leaveDecide: leaveApprovals && leaveApprove && !supportView,
    payroll: payrollGenerate || payrollReview,
    payrollGenerate,
    payrollReview,
    loans,
    audit,
    supportView,
    scopeLabel,
  };

  // Leave data feeds both the approvals queue and "on leave today".
  const wantsLeave = leaveApprovals || attendance || employees;
  const [pending, approved, leaveTypes] = wantsLeave
    ? await Promise.all([
        leaveApprovals ? section("approvals", failed, () => leaveRepository.findAllLeaveApplications({ status: "Pending" })) : Promise.resolve([]),
        section("leave", failed, () => leaveRepository.findAllLeaveApplications({ status: "Approved" })),
        section("leave types", failed, () => leaveRepository.findAllLeaveTypes()),
      ])
    : [null, null, null];
  const leaveTypeMap = new Map((leaveTypes ?? []).map((t) => [t.id, t]));

  const [approvals, payroll, workforce, loanSummary, activity] = await Promise.all([
    // 1. Leave approvals queue (scoped, oldest first)
    leaveApprovals && pending && scopedEmployees
      ? section("approvals", failed, async () => {
          const scopedPending = pending.filter((a) => inScope(a.employeeId)).slice(0, QUEUE_LIMIT);
          const balances = new Map<string, number>();
          const employeeIds = [...new Set(scopedPending.map((a) => a.employeeId))];
          const balanceRows = await Promise.all(employeeIds.map((id) => leaveRepository.findLeaveBalancesByEmployee(id).catch(() => [])));
          balanceRows.flat().forEach((b) => balances.set(`${b.employeeId}:${b.leaveTypeId}`, Number(b.balance)));
          return buildLeaveQueue(scopedPending, {
            employees: employeeMap,
            departments: departmentNames,
            leaveTypes: leaveTypeMap,
            balances,
            others: [...(approved ?? []), ...pending].filter((a) => inScope(a.employeeId)),
            today,
          });
        })
      : Promise.resolve(null),

    // 2. Payroll period, trend and next period (company-wide; payroll permission)
    access.payroll
      ? section("payroll", failed, async () => {
          const runs = await payrollRepository.findAllPayrollRuns();
          const latest = latestPeriod(runs);
          return {
            runs,
            latest,
            next: nextPeriodToRun(latest, { year: bsToday.year, month: bsToday.month }),
            trend: payrollTrend(runs, 6),
          };
        })
      : Promise.resolve(null),

    // 3. Today: attendance recorded + who is on leave (scoped)
    (attendance || employees) && scopedEmployees
      ? section("today", failed, async () => {
          const records = attendance ? (await attendanceRepository.findAttendanceByDate(todayIso)).filter((r) => inScope(r.employeeId)) : [];
          const onLeave = (approved ?? [])
            .filter((a) => inScope(a.employeeId))
            .filter((a) => {
              const from = toLocalDate(a.effectiveFrom);
              const to = toLocalDate(a.effectiveTo);
              return !!from && !!to && from <= today && today <= to;
            })
            .map((a) => {
              const to = toLocalDate(a.effectiveTo);
              return {
                name: employeeMap.get(a.employeeId)?.fullName ?? "Employee",
                leaveType: leaveTypeMap.get(a.leaveTypeId)?.name ?? "Leave",
                until: to ? toIsoDate(to) : "",
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
          return {
            total: scopedEmployees.length,
            recorded: records.length,
            present: records.filter((r) => r.status === "Present" || r.status === "Half Day").length,
            absent: records.filter((r) => r.status === "Absent").length,
            late: records.filter((r) => !!r.isLate).length,
            onLeave,
          };
        })
      : Promise.resolve(null),

    // 4. Loans (scoped)
    loans
      ? section("loans", failed, async () => {
          const all = await loanRepository.findAllLoans();
          const active = all.filter((l) => l.status === "ACTIVE" && (scope.scopeType === "GLOBAL" || inScope(l.employeeId)));
          const outstanding = active.reduce((acc, l) => acc.plus(new Decimal(Number(l.remainingAmount) || 0)), new Decimal(0));
          return { active: active.length, outstanding: outstanding.toNumber() };
        })
      : Promise.resolve(null),

    // 5. Recent activity (audit log permission; company-wide by design)
    audit
      ? section("activity", failed, async () => {
          const { logs } = await auditRepository.findAuditLogs({ limit: ACTIVITY_LIMIT });
          return logs.slice(0, ACTIVITY_LIMIT).map(
            (log): HomeActivity => ({
              id: log.id,
              actor: log.userName || log.userEmail || "System",
              action: String(log.action),
              module: moduleLabel(String(log.module)),
              result: String(log.result ?? "SUCCESS"),
              at: new Date(log.createdAt).toISOString(),
            })
          );
        })
      : Promise.resolve(null),
  ]);

  // Deadlines carry the withheld amount from that period's payroll when it exists.
  const deadlines = access.payroll
    ? upcomingDeadlines(today).map((d) => {
        const periodRuns = payroll ? groupByPeriod(payroll.runs).find((g) => g[0].payPeriodYear === d.forYear && g[0].payPeriodMonth === d.forMonth) : undefined;
        const summary = periodRuns ? summarizePeriod(periodRuns) : null;
        const amount = summary ? (d.ruleId === "tds" ? summary.tds : summary.ssf) : null;
        return { ...d, amount };
      })
    : null;

  const headcount =
    employees && scopedEmployees
      ? [...scopedEmployees.reduce((m, e) => m.set(departmentNames.get(e.departmentId) ?? "Unassigned", (m.get(departmentNames.get(e.departmentId) ?? "Unassigned") ?? 0) + 1), new Map<string, number>())]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      : null;

  return {
    generatedAt: new Date().toISOString(),
    todayIso,
    displayName,
    access,
    approvals,
    payroll: payroll ? { latest: payroll.latest, next: payroll.next, trend: payroll.trend } : null,
    deadlines,
    readiness:
      employees && access.payroll && scopedEmployees
        ? { checked: scopedEmployees.length, issues: payrollReadiness(scopedEmployees) }
        : null,
    workforce,
    headcount,
    loans: loanSummary,
    activity,
    failed: [...new Set(failed)],
  };
}

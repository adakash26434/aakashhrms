import * as repository from "@/lib/repositories/audit.repository";
import { AuditLogEntry, PermissionChangeLogEntry, AuditLogFilter, AuditLogKPIs } from "../types/audit";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

export async function getAuditLogData(filter?: AuditLogFilter): Promise<{
  logs: AuditLogEntry[];
  totalCount: number;
  kpis: AuditLogKPIs;
}> {
  const [{ logs, totalCount }, kpis] = await Promise.all([
    repository.findAuditLogs(filter),
    repository.countAuditLogKPIs(),
  ]);

  return { logs, totalCount, kpis };
}

export async function getPermissionChangeLogs(filter?: AuditLogFilter): Promise<PermissionChangeLogEntry[]> {
  return repository.findPermissionChangeLogs(filter);
}

/**
 * Enterprise Audit Logger: Records mutation events across all modules with explicit UTC timestamps.
 */
export async function recordAuditLog(params: {
  userId?: string | null;
  roleIdAtTime?: string | null;
  action: "VIEW" | "ADD" | "EDIT" | "DELETE" | "APPROVE" | "EXPORT" | "LOCK";
  module:
    | "SYSTEM_CONTROL"
    | "FISCAL_YEAR"
    | "TAX_RATES"
    | "PAY_HEADS"
    | "HOLIDAYS"
    | "EMPLOYEES"
    | "SALARY_MAPPING"
    | "ATTENDANCE"
    | "LEAVE_APPLICATIONS"
    | "LEAVE_APPROVALS"
    | "OT_RULES"
    | "LEAVE_RULES"
    | "LEAVE_TYPES"
    | "PAYROLL_GENERATE"
    | "PAYROLL_REVIEW"
    | "LEAVE_SALARY"
    | "LOANS"
    | "REPORTS_SALARY_SHEET"
    | "REPORTS_PAYSLIP"
    | "REPORTS_ATTENDANCE"
    | "REPORTS_TAX_IRD"
    | "REPORTS_LEAVE"
    | "REPORTS_LOAN"
    | "USERS_ROLES"
    | "AUDIT_LOG";
  recordId?: string | null;
  result?: "SUCCESS" | "DENIED_PERMISSION" | "DENIED_SCOPE" | string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) {
  try {
    let finalUserId = params.userId || null;
    let finalRoleId = params.roleIdAtTime || null;

    if (!finalUserId) {
      const session = await auth();
      if (session?.user?.id) {
        finalUserId = session.user.id;
        finalRoleId = session.user.roleId || null;
      }
    }

    await getDb().insert(auditLogs).values({
      userId: finalUserId,
      roleIdAtTime: finalRoleId,
      action: params.action,
      module: params.module,
      recordId: params.recordId || null,
      result: params.result || "SUCCESS",
      oldValues: params.oldValues || null,
      newValues: params.newValues || null,
      ipAddress: params.ipAddress || "127.0.0.1",
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[AUDIT_LOG_ERROR] Failed to record audit log:", err);
  }
}

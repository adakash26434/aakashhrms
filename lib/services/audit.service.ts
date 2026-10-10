import * as repository from "@/lib/repositories/audit.repository";
import { getDb } from "@/lib/db";
import { auditLogs, userRoles } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/auth/client-ip";
import { asc, eq } from "drizzle-orm";
import {
  AUDIT_PERIODS,
  addressText,
  auditActionLabel,
  auditModuleLabel,
  auditResultLabel,
  diffRows,
  isRefusal,
  normalizeAuditFilter,
  periodStart,
} from "@/lib/engines/audit.engine";
import { MODULE_LABEL } from "@/lib/engines/role.engine";
import type { AuditEntryDetail, AuditPage, AuditRow } from "@/lib/types/audit";
import type { AuditEntryRecord } from "@/lib/repositories/audit.repository";

// The audit trail (4.13, S59). Every entry says who, as which role at the time, from which
// address — the request's client address (the same trusted-proxy rule as sign-in rate limiting),
// or nothing when there is no request (scheduled jobs, scripts): never a made-up one.

/** The newest entries the screen holds for one query (it says when there are more). */
export const AUDIT_PAGE_LIMIT = 1000;

/** The request's client address, or null outside a request or when the proxy gave none. */
async function requestAddress(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    return addressText(getClientIp(await headers()))?.slice(0, 45) ?? null;
  } catch {
    return null;
  }
}

/**
 * Records one audit entry: what was done (or refused) on which module and record, with the values
 * before and after. Never throws: a failed audit write is logged and the work goes on.
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
    | "AUDIT_LOG"
    | "ORG_STRUCTURE"
    | "SELF_SERVICE"
    | "HR_LETTERS"
    | "PERFORMANCE"
    | "RECRUITMENT"
    | "DISCIPLINE"
    | "TRAINING"
    | "ASSETS"
    | "NOTICE_BOARD"
    | "TRAVEL"
    | "TARGETS"
    | "REIMBURSEMENTS"
    | "WELFARE_FUNDS";
  recordId?: string | null;
  result?: "SUCCESS" | "DENIED_PERMISSION" | "DENIED_SCOPE" | string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  /** Only for callers that know better than the request (none today); otherwise read from it. */
  ipAddress?: string | null;
}) {
  try {
    let userId = params.userId || null;
    let roleId = params.roleIdAtTime || null;
    if (!userId) {
      const session = await auth();
      if (session?.user?.id) {
        userId = session.user.id;
        roleId = roleId ?? session.user.roleId ?? null;
      }
    }
    const db = await getDb();
    // The role the user held when they acted (forensics: roles change later).
    if (userId && !roleId) {
      const [row] = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId)).orderBy(asc(userRoles.roleId)).limit(1);
      roleId = row?.roleId ?? null;
    }
    const ipAddress = params.ipAddress !== undefined ? addressText(params.ipAddress) : await requestAddress();

    await db.insert(auditLogs).values({
      userId,
      roleIdAtTime: roleId,
      action: params.action,
      module: params.module,
      recordId: params.recordId || null,
      result: params.result || "SUCCESS",
      oldValues: params.oldValues || null,
      newValues: params.newValues || null,
      ipAddress,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[AUDIT_LOG_ERROR] Failed to record audit log:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Admin → Audit log
// ---------------------------------------------------------------------------

const MODULE_CHOICES = Object.keys(MODULE_LABEL);

function row(r: AuditEntryRecord): AuditRow {
  return {
    id: r.id,
    at: r.createdAt.toISOString(),
    userId: r.userId,
    who: r.userName?.trim() || r.userEmail || (r.userId ? "Deleted login" : "System"),
    email: r.userEmail,
    role: r.roleNameAtTime,
    action: r.action,
    actionLabel: auditActionLabel(r.action),
    module: r.module,
    moduleLabel: auditModuleLabel(r.module),
    record: r.recordTitle,
    result: r.result,
    resultLabel: auditResultLabel(r.result),
    refused: isRefusal(r.result),
    address: addressText(r.ipAddress),
  };
}

/** The entries for a filter (newest first, at most AUDIT_PAGE_LIMIT) and how many match in all. */
export async function auditPage(rawFilter: unknown, can: AuditPage["can"]): Promise<AuditPage> {
  const users = await repository.findAuditUsers();
  const filter = normalizeAuditFilter(rawFilter, { modules: MODULE_CHOICES, userIds: users.map((u) => u.id) });
  const query = { since: periodStart(filter.period), module: filter.module, action: filter.action, outcome: filter.outcome, userId: filter.userId, search: filter.search };
  const [entries, counts] = await Promise.all([repository.findAuditEntries({ ...query, limit: AUDIT_PAGE_LIMIT }), repository.countAuditEntries(query)]);
  return {
    filter,
    rows: entries.map(row),
    total: counts.total,
    refused: counts.refused,
    periods: AUDIT_PERIODS.map((p) => ({ value: p.value, label: p.label })),
    modules: MODULE_CHOICES.map((m) => ({ value: m, label: auditModuleLabel(m) })).sort((a, b) => a.label.localeCompare(b.label)),
    users,
    can,
  };
}

/** One entry with what changed (the detail pane). */
export async function auditEntry(id: string): Promise<AuditEntryDetail | null> {
  const r = await repository.findAuditEntry(id);
  if (!r) return null;
  return { ...row(r), recordId: r.recordId, changes: diffRows(r.oldValues, r.newValues) };
}

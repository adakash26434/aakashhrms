import { getDb } from "@/lib/db";
import { auditLogs, rolePermissionChangeLog, users, roles, permissions } from "@/lib/db/schema";
import { eq, and, or, ilike, sql, gte } from "drizzle-orm";
import { AuditLogEntry, PermissionChangeLogEntry, AuditLogFilter, AuditLogKPIs, ActionType } from "../types/audit";
import { formatRecordTitle } from "@/lib/engines/audit.engine";

/**
 * Retrieves audit logs joined with User and Role snapshot information.
 */
export async function findAuditLogs(filter?: AuditLogFilter): Promise<{
  logs: AuditLogEntry[];
  totalCount: number;
}> {
  const page = filter?.page || 1;
  const limit = filter?.limit || 50;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (filter?.search && filter.search.trim()) {
    const searchPattern = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(users.email, searchPattern),
        ilike(users.name, searchPattern),
        ilike(auditLogs.module, searchPattern),
        ilike(auditLogs.recordId, searchPattern)
      )
    );
  }

  if (filter?.module && filter.module !== "all") {
    conditions.push(eq(auditLogs.module, filter.module as any));
  }

  if (filter?.action && filter.action !== "all") {
    conditions.push(eq(auditLogs.action, filter.action as any));
  }

  if (filter?.result && filter.result !== "all") {
    conditions.push(eq(auditLogs.result, filter.result));
  }

  if (filter?.userId && filter.userId !== "all") {
    conditions.push(eq(auditLogs.userId, filter.userId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRes] = await Promise.all([
    getDb()
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.name,
        userEmail: users.email,
        roleIdAtTime: auditLogs.roleIdAtTime,
        roleNameAtTime: roles.name,
        action: auditLogs.action,
        module: auditLogs.module,
        recordId: auditLogs.recordId,
        result: auditLogs.result,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        ipAddress: auditLogs.ipAddress,
        createdAtFormatted: sql<string>`to_char(${auditLogs.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(roles, eq(auditLogs.roleIdAtTime, roles.id))
      .where(whereClause)
      .orderBy(sql`${auditLogs.createdAt} DESC`)
      .limit(limit)
      .offset(offset),

    getDb()
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause),
  ]);

  const totalCount = Number(countRes[0]?.count || 0);

  const logs: AuditLogEntry[] = rows.map((r) => {
    const oldVals = (r.oldValues as Record<string, unknown>) ?? null;
    const newVals = (r.newValues as Record<string, unknown>) ?? null;

    return {
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      roleIdAtTime: r.roleIdAtTime,
      roleNameAtTime: r.roleNameAtTime,
      action: r.action as ActionType,
      module: r.module,
      recordId: r.recordId,
      recordTitle: formatRecordTitle(r.recordId, r.module, newVals, oldVals),
      result: r.result,
      oldValues: oldVals,
      newValues: newVals,
      ipAddress: r.ipAddress,
      createdAt: r.createdAtFormatted ? new Date(r.createdAtFormatted) : new Date(),
    };
  });

  return { logs, totalCount };
}

/**
 * Retrieves permission change history records.
 */
export async function findPermissionChangeLogs(filter?: AuditLogFilter): Promise<PermissionChangeLogEntry[]> {
  const limit = filter?.limit || 50;

  const rows = await getDb()
    .select({
      id: rolePermissionChangeLog.id,
      changedByUserId: rolePermissionChangeLog.changedByUserId,
      changedByUserName: users.name,
      changedByUserEmail: users.email,
      roleId: rolePermissionChangeLog.roleId,
      affectedRoleName: rolePermissionChangeLog.affectedRoleName,
      permissionId: rolePermissionChangeLog.permissionId,
      action: permissions.action,
      module: permissions.module,
      changeType: rolePermissionChangeLog.changeType,
      createdAtFormatted: sql<string>`to_char(${rolePermissionChangeLog.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
    })
    .from(rolePermissionChangeLog)
    .leftJoin(users, eq(rolePermissionChangeLog.changedByUserId, users.id))
    .leftJoin(permissions, eq(rolePermissionChangeLog.permissionId, permissions.id))
    .orderBy(sql`${rolePermissionChangeLog.createdAt} DESC`)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    changedByUserId: r.changedByUserId,
    changedByUserName: r.changedByUserName,
    changedByUserEmail: r.changedByUserEmail,
    roleId: r.roleId,
    affectedRoleName: r.affectedRoleName,
    permissionId: r.permissionId,
    action: (r.action as ActionType) || null,
    module: r.module || null,
    changeType: r.changeType as "GRANTED" | "REVOKED",
    createdAt: r.createdAtFormatted ? new Date(r.createdAtFormatted) : new Date(),
  }));
}

/**
 * Computes Audit Log summary KPI metrics.
 */
export async function countAuditLogKPIs(): Promise<AuditLogKPIs> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalRes, todayRes, deniedRes, permChangesRes] = await Promise.all([
    getDb().select({ count: sql<number>`count(*)` }).from(auditLogs),
    getDb().select({ count: sql<number>`count(*)` }).from(auditLogs).where(gte(auditLogs.createdAt, startOfToday)),
    getDb().select({ count: sql<number>`count(*)` }).from(auditLogs).where(ilike(auditLogs.result, "%DENIED%")),
    getDb().select({ count: sql<number>`count(*)` }).from(rolePermissionChangeLog),
  ]);

  return {
    totalEvents: Number(totalRes[0]?.count || 0),
    todayEvents: Number(todayRes[0]?.count || 0),
    deniedEvents: Number(deniedRes[0]?.count || 0),
    permissionChangesCount: Number(permChangesRes[0]?.count || 0),
  };
}

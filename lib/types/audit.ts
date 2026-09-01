export type AuditResult = "SUCCESS" | "DENIED_PERMISSION" | "DENIED_SCOPE";
export type ActionType = "VIEW" | "ADD" | "EDIT" | "DELETE" | "APPROVE" | "EXPORT" | "LOCK";

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  roleIdAtTime: string | null;
  roleNameAtTime: string | null;
  action: ActionType;
  module: string;
  recordId: string | null;
  recordTitle?: string | null;
  result: AuditResult | string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface PermissionChangeLogEntry {
  id: string;
  changedByUserId: string;
  changedByUserName: string | null;
  changedByUserEmail: string | null;
  roleId: string;
  affectedRoleName: string;
  permissionId: string;
  action: ActionType | null;
  module: string | null;
  changeType: "GRANTED" | "REVOKED";
  createdAt: Date;
}

export interface AuditLogFilter {
  search?: string;
  module?: string | "all";
  action?: ActionType | "all";
  result?: string | "all";
  userId?: string | "all";
  page?: number;
  limit?: number;
}

export interface AuditLogKPIs {
  totalEvents: number;
  todayEvents: number;
  deniedEvents: number;
  permissionChangesCount: number;
}

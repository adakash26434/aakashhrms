'use server';

import { ensureTenantContext } from '@/lib/db';
import * as auditService from '@/lib/services/audit.service';
import { AuditLogFilter, AuditLogEntry, PermissionChangeLogEntry, AuditLogKPIs } from '@/lib/types/audit';
import { checkPermission } from '@/lib/auth/check-permission';

export type ActionResponse<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getAuditLogsAction(filter?: AuditLogFilter): Promise<ActionResponse<{
  logs: AuditLogEntry[];
  totalCount: number;
  kpis: AuditLogKPIs;
}>> {
  try {
    await ensureTenantContext();
    await checkPermission('VIEW', 'AUDIT_LOG');
    const data = await auditService.getAuditLogData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    console.error('Failed to fetch audit logs:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch audit logs';
    return { success: false, error: msg };
  }
}

export async function getPermissionChangeLogsAction(filter?: AuditLogFilter): Promise<ActionResponse<PermissionChangeLogEntry[]>> {
  try {
    await ensureTenantContext();
    await checkPermission('VIEW', 'AUDIT_LOG');
    const data = await auditService.getPermissionChangeLogs(filter);
    return { success: true, data };
  } catch (error: unknown) {
    console.error('Failed to fetch permission change logs:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch permission change logs';
    return { success: false, error: msg };
  }
}

'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';

const EXPORTABLE_MODULES = [
  'EMPLOYEES',
  'SALARY_MAPPING',
  'HR_LETTERS',
  'PERFORMANCE',
  'RECRUITMENT',
  'DISCIPLINE',
  'WELFARE_FUNDS',
  'ATTENDANCE',
  'LEAVE_APPLICATIONS',
  'LEAVE_APPROVALS',
  'PAYROLL_GENERATE',
  'PAYROLL_REVIEW',
  'LEAVE_SALARY',
  'LOANS',
  'REPORTS_SALARY_SHEET',
  'REPORTS_PAYSLIP',
  'REPORTS_ATTENDANCE',
  'REPORTS_TAX_IRD',
  'REPORTS_LEAVE',
  'REPORTS_LOAN',
  'USERS_ROLES',
  'AUDIT_LOG',
] as const;

export type ExportModule = (typeof EXPORTABLE_MODULES)[number];

/**
 * Gate + audit for exports built in the browser from data already on screen
 * (roadmap 3.7). Requires EXPORT on the module and writes an audit entry.
 * The caller downloads only when this returns allowed. Exports of data the
 * page does not hold must be generated on the server instead.
 */
export async function authorizeExportAction(input: {
  module: ExportModule;
  label: string;
  rowCount: number;
}): Promise<{ allowed: boolean; error?: string }> {
  if (!EXPORTABLE_MODULES.includes(input?.module)) return { allowed: false, error: 'Unknown export.' };
  await ensureTenantContext();
  try {
    await checkPermission('EXPORT', input.module);
  } catch {
    await recordAuditLog({ action: 'EXPORT', module: input.module, result: 'DENIED_PERMISSION', recordId: String(input.label).slice(0, 120) });
    return { allowed: false, error: 'You do not have permission to export this data.' };
  }
  await recordAuditLog({
    action: 'EXPORT',
    module: input.module,
    recordId: String(input.label).slice(0, 120),
    newValues: { rows: Math.max(0, Math.trunc(Number(input.rowCount) || 0)) },
  });
  return { allowed: true };
}

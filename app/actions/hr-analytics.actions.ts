'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import { hrAnalytics } from '@/lib/services/hr-analytics.service';

// HR analytics (G13): EMPLOYEES VIEW within scope; case counts need DISCIPLINE
// VIEW; the CSV export goes through authorizeExportAction (EMPLOYEES EXPORT).

export async function getHrAnalyticsAction(fiscalYearId: string | null) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    const [canSeeCases, canExport] = await Promise.all([hasPermission('VIEW', 'DISCIPLINE'), hasPermission('EXPORT', 'EMPLOYEES')]);
    const data = await hrAnalytics(typeof fiscalYearId === 'string' ? fiscalYearId : null, { scope, canSeeCases, canExport });
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'hr-analytics');
  }
}

'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkCompanyView, hasPermission } from '@/lib/auth/check-permission';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import { isUuid } from '@/lib/utils/uuid';
import { periodStart, normalizeAuditFilter } from '@/lib/engines/audit.engine';
import * as service from '@/lib/services/audit.service';
import { permissionHistory } from '@/lib/services/role.service';

// Admin → Audit log (4.13, S59): the whole company's trail, so Audit log → View with a
// company-wide role (platform support may look). Exports go through `authorizeExportAction`
// (Audit log → Export, audited) from the rows on the screen.

export async function auditPageAction(filter: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyView('AUDIT_LOG');
    const canExport = !scope.isImpersonation && (await hasPermission('EXPORT', 'AUDIT_LOG'));
    return { success: true as const, data: await service.auditPage(filter, { export: canExport }) };
  } catch (error: unknown) {
    return toActionError(error, 'audit.page');
  }
}

export async function auditEntryAction(id: string) {
  await ensureTenantContext();
  try {
    if (!isUuid(id)) throw new UserFacingError('Not found: this entry does not exist.');
    await checkCompanyView('AUDIT_LOG');
    const entry = await service.auditEntry(id);
    if (!entry) throw new UserFacingError('Not found: this entry does not exist.');
    return { success: true as const, data: entry };
  } catch (error: unknown) {
    return toActionError(error, 'audit.entry');
  }
}

/** Every role's grants and revokes in the filter's period, newest first. */
export async function permissionChangesAction(filter: unknown) {
  await ensureTenantContext();
  try {
    await checkCompanyView('AUDIT_LOG');
    const { period } = normalizeAuditFilter(filter, { modules: [] });
    return { success: true as const, data: await permissionHistory({ since: periodStart(period), limit: 1000 }) };
  } catch (error: unknown) {
    return toActionError(error, 'audit.permissions');
  }
}

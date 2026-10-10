'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as statutoryService from '@/lib/services/statutory.service';

// Statutory returns (4.8 / F9) sit under REPORTS_TAX_IRD: VIEW shows the monthly schedules and
// the annual certificates within the viewer's employee scope; EXPORT builds an upload file on the
// server from the same figures (audited with the file and its row count). Only payslips of
// approved / locked runs are read.

async function ctxFor(action: 'VIEW' | 'EXPORT'): Promise<statutoryService.StatutoryCtx> {
  const scope = await checkPermissionWithScope(action, 'REPORTS_TAX_IRD');
  return { userId: scope.userId, scope };
}

export async function getStatutoryMonthAction(period: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('VIEW');
    const data = await statutoryService.statutoryMonth(ctx, period, { export: await hasPermission('EXPORT', 'REPORTS_TAX_IRD') });
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'statutory.month');
  }
}

export async function exportStatutoryFileAction(file: string, period: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('EXPORT');
    const out = await statutoryService.statutoryFile(ctx, file, period);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'EXPORT',
      module: 'REPORTS_TAX_IRD',
      recordId: out.label,
      result: 'SUCCESS',
      newValues: { rows: out.rows, partialScope: ctx.scope.scopeType !== 'GLOBAL' },
    });
    return { success: true as const, data: { filename: out.filename, content: out.content } };
  } catch (error: unknown) {
    return toActionError(error, 'statutory.export');
  }
}

export async function getCertificateListAction(fiscalYearId: string) {
  await ensureTenantContext();
  try {
    const ctx = await ctxFor('VIEW');
    const data = await statutoryService.certificateList(ctx, fiscalYearId);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'statutory.certificates');
  }
}

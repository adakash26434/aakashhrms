'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as assetService from '@/lib/services/asset.service';

// Assets (G14): every action checks ASSETS inside the tenant context — VIEW
// lists / reads, ADD registers and issues, EDIT changes, returns and retires.
// Handovers go to employees in the caller's scope only.

async function assetCtx(action: 'VIEW' | 'ADD' | 'EDIT'): Promise<assetService.AssetCtx> {
  const scope = await checkPermissionWithScope(action, 'ASSETS');
  return { userId: scope.userId, scope };
}

const revalidate = () => {
  revalidatePath('/workforce/assets');
  revalidatePath('/workforce/exit');
};

const validationFailure = (error: unknown) =>
  error instanceof assetService.AssetValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getAssetsPageAction() {
  await ensureTenantContext();
  try {
    const ctx = await assetCtx('VIEW');
    const [add, manage] = await Promise.all([hasPermission('ADD', 'ASSETS'), hasPermission('EDIT', 'ASSETS')]);
    return { success: true as const, data: await assetService.assetsPage(ctx, { add, manage }) };
  } catch (error: unknown) {
    return toActionError(error, 'assets.list');
  }
}

export async function getAssetAction(id: string) {
  await ensureTenantContext();
  try {
    await assetCtx('VIEW');
    const data = await assetService.getAsset(typeof id === 'string' ? id : '');
    if (!data) return { success: false as const, error: 'Not found: this asset no longer exists.' };
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'assets.get');
  }
}

export async function saveAssetAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await assetCtx(id ? 'EDIT' : 'ADD');
    const row = await assetService.saveAsset(typeof id === 'string' ? id : null, form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: id ? 'EDIT' : 'ADD', module: 'ASSETS', recordId: row.id, result: 'SUCCESS', newValues: { tag: row.tag, category: row.category } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'assets.save');
  }
}

export async function issueAssetAction(id: string, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await assetCtx('ADD');
    const detail = await assetService.issueAsset(typeof id === 'string' ? id : '', form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'ASSETS', recordId: detail.id, result: 'SUCCESS', newValues: { issuedTo: detail.holderId, issuedAd: detail.issuedAd } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'assets.issue');
  }
}

export async function returnAssetAction(id: string, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await assetCtx('EDIT');
    const detail = await assetService.returnAsset(typeof id === 'string' ? id : '', form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'ASSETS', recordId: detail.id, result: 'SUCCESS', newValues: { returned: true, status: detail.status } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'assets.return');
  }
}

export async function retireAssetAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await assetCtx('EDIT');
    const detail = await assetService.retireAsset(typeof id === 'string' ? id : '', ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'ASSETS', recordId: detail.id, result: 'SUCCESS', newValues: { status: 'retired' } });
    revalidate();
    return { success: true as const, data: detail };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'assets.retire');
  }
}

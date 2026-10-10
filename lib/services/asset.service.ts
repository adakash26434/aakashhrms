import * as repo from '@/lib/repositories/asset.repository';
import { findEmployeeOptions } from '@/lib/repositories/letter.repository';
import {
  ASSET_CATEGORIES,
  canIssue,
  canRetire,
  normalizeAssetForm,
  normalizeIssueForm,
  normalizeReturnForm,
  statusAfterReturn,
  validateAssetForm,
  validateIssueForm,
  validateReturnForm,
} from '@/lib/engines/asset.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { UserFacingError } from '@/lib/errors/action-error';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import type { AssetDetail, AssetRow, AssetsPageData, HandoverRow } from '@/lib/types/asset';

// Assets (G14): orchestration. The register is company-wide; issuing goes to
// an active employee in the caller's scope; issue / return are claim-first so
// an asset never has two open handovers; a lost return retires the asset.

export class AssetValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'AssetValidationError';
  }
}

export interface AssetCtx {
  userId: string;
  scope: ScopeFilter;
}

const asStatus = (s: string): AssetRow['status'] => (s === 'issued' || s === 'retired' ? s : 'available');

const toRow = (a: repo.AssetWithHolder): AssetRow => ({
  id: a.id,
  tag: a.tag,
  name: a.name,
  category: a.category,
  categoryName: ASSET_CATEGORIES.find((c) => c.code === a.category)?.name ?? a.category,
  branchId: a.branchId,
  branch: a.branch,
  note: a.note,
  status: asStatus(a.status),
  holderId: a.holderId,
  holderName: a.holderName,
  holderCode: a.holderCode,
  issuedAd: a.issuedAd,
});

export async function assetsPage(ctx: AssetCtx, permissions: AssetsPageData['permissions']): Promise<AssetsPageData> {
  const [list, branches, employees] = await Promise.all([repo.listAssets(), repo.branchOptions(), findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))]);
  return { assets: list.map(toRow), branches, employees, permissions };
}

export async function getAsset(id: string): Promise<AssetDetail | null> {
  const asset = await repo.findAsset(id);
  if (!asset) return null;
  const handovers = (await repo.handoversFor(id)).map(
    (h): HandoverRow => ({ id: h.id, employeeId: h.employeeId, employeeName: h.employeeName, employeeCode: h.employeeCode, issuedAd: h.issuedAd, returnedAd: h.returnedAd, condition: h.condition, note: h.note }),
  );
  return { ...toRow(asset), handovers };
}

export async function saveAsset(id: string | null, raw: unknown, ctx: AssetCtx): Promise<AssetRow> {
  const form = normalizeAssetForm(raw);
  const errors = validateAssetForm(form);
  if (Object.keys(errors).length) throw new AssetValidationError(errors);
  const write: repo.AssetWrite = { tag: form.tag, name: form.name, category: form.category, branchId: form.branchId || null, note: form.note || null };
  try {
    const row = id ? await repo.updateAsset(id, write, ctx.userId) : await repo.insertAsset(write, ctx.userId);
    if (!row) throw new UserFacingError('Not found: this asset no longer exists.');
    return toRow((await repo.findAsset(row.id))!);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      throw new AssetValidationError({ tag: 'An asset with this tag already exists.' });
    }
    throw error;
  }
}

export async function issueAsset(id: string, raw: unknown, ctx: AssetCtx): Promise<AssetDetail> {
  const asset = await repo.findAsset(id);
  if (!asset) throw new UserFacingError('Not found: this asset no longer exists.');
  if (!canIssue(asset.status)) throw new UserFacingError(`This asset is ${asset.status}; it can be issued only while available.`);
  const form = normalizeIssueForm(raw);
  const errors = validateIssueForm(form, toIsoDate(nepalToday()));
  if (Object.keys(errors).length) throw new AssetValidationError(errors);
  if (!(await repo.employeeInScope(form.employeeId, buildEmployeeScopeCondition(ctx.scope), true))) {
    throw new AssetValidationError({ employeeId: 'This employee is not active in your scope.' });
  }
  if (!(await repo.issueTx(id, form.employeeId, form.issuedAd, form.note || null, ctx.userId))) throw new UserFacingError('Someone already issued this asset — refresh.');
  return (await getAsset(id))!;
}

export async function returnAsset(id: string, raw: unknown, ctx: AssetCtx): Promise<AssetDetail> {
  const open = await repo.openHandoverFor(id);
  if (!open) throw new UserFacingError('This asset is not out on handover.');
  // The holder may already be inactive (an exit recorded before this module); scope still applies.
  if (!(await repo.employeeInScope(open.employeeId, buildEmployeeScopeCondition(ctx.scope), false))) throw new UserFacingError('The holder is not in your scope.');
  const form = normalizeReturnForm(raw);
  const errors = validateReturnForm(form, open.issuedAd, toIsoDate(nepalToday()));
  if (Object.keys(errors).length) throw new AssetValidationError(errors);
  if (!(await repo.returnTx(id, form.returnedAd, form.condition, form.note || null, statusAfterReturn(form.condition), ctx.userId))) {
    throw new UserFacingError('Someone already recorded this return — refresh.');
  }
  return (await getAsset(id))!;
}

export async function retireAsset(id: string, ctx: AssetCtx): Promise<AssetDetail> {
  const asset = await repo.findAsset(id);
  if (!asset) throw new UserFacingError('Not found: this asset no longer exists.');
  if (!canRetire(asset.status)) throw new UserFacingError('Only an available asset can be retired (return it first).');
  if (!(await repo.retire(id, ctx.userId))) throw new UserFacingError('Someone already changed this asset — refresh.');
  return (await getAsset(id))!;
}

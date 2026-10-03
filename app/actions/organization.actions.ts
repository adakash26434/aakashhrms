'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import * as orgService from '@/lib/services/organization.service';
import { canChangeMasters } from '@/lib/engines/organization.engine';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import type { OrgErrors, OrgKind, OrgStatus } from '@/lib/types/organization';

// Security plan S19: organization masters are company-wide. Every change needs
// the Organization permission AND a company-wide (GLOBAL) role; refusals are
// audited. Updates are audited by field name only; renames that move
// employees are audited with the count. Errors never carry raw messages (S9).

const KINDS: readonly OrgKind[] = ['branch', 'department', 'designation', 'level', 'type'];
const COMPANY_WIDE_ONLY = 'Only a company-wide administrator can change the organization structure.';

type Result<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string; ref?: string; validationErrors?: OrgErrors };

function assertKind(kind: unknown): asserts kind is OrgKind {
  if (!KINDS.includes(kind as OrgKind)) throw new UserFacingError('Unknown record type.');
}

/** Permission + company-wide scope; a scoped role's attempt is audited and refused. */
async function authorize(action: 'ADD' | 'EDIT' | 'DELETE', kind: OrgKind, recordId: string | null) {
  const scope = await checkPermissionWithScope(action, 'ORG_STRUCTURE');
  if (!canChangeMasters(scope)) {
    await recordAuditLog({ userId: scope.userId, action, module: 'ORG_STRUCTURE', recordId, result: 'DENIED_SCOPE', newValues: { kind } });
    throw new UserFacingError(COMPANY_WIDE_ONLY);
  }
  return scope;
}

function refresh() {
  revalidatePath('/workforce/organization');
  revalidatePath('/workforce/employees');
  revalidatePath('/dashboard');
}

export async function saveOrgRecordAction(kind: OrgKind, id: string | null, input: unknown): Promise<Result<orgService.OrgSaveResult>> {
  await ensureTenantContext();
  try {
    assertKind(kind);
    const action = id ? 'EDIT' : 'ADD';
    const scope = await authorize(action, kind, id);
    const result = await orgService.saveMaster(kind, id, input);
    await recordAuditLog({
      userId: scope.userId,
      action,
      module: 'ORG_STRUCTURE',
      recordId: result.id,
      result: 'SUCCESS',
      newValues: id ? { kind, changedFields: result.changed, employeesMoved: result.moved || undefined } : { kind, name: result.name },
    });
    refresh();
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof orgService.OrgValidationError) {
      return { success: false, error: 'Some fields need attention.', validationErrors: error.errors };
    }
    return toActionError(error, 'organization.save');
  }
}

export async function setOrgStatusAction(kind: OrgKind, id: string, status: OrgStatus): Promise<Result> {
  await ensureTenantContext();
  try {
    assertKind(kind);
    if (status !== 'active' && status !== 'inactive') throw new UserFacingError('That is not a valid status.');
    const scope = await authorize('EDIT', kind, id);
    const { previous } = await orgService.setMasterStatus(kind, id, status);
    await recordAuditLog({
      userId: scope.userId,
      action: 'EDIT',
      module: 'ORG_STRUCTURE',
      recordId: id,
      result: 'SUCCESS',
      oldValues: { kind, status: previous },
      newValues: { kind, status },
    });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return toActionError(error, 'organization.status');
  }
}

export async function deleteOrgRecordAction(kind: OrgKind, id: string): Promise<Result> {
  await ensureTenantContext();
  try {
    assertKind(kind);
    const scope = await authorize('DELETE', kind, id);
    const { name } = await orgService.deleteMaster(kind, id);
    await recordAuditLog({ userId: scope.userId, action: 'DELETE', module: 'ORG_STRUCTURE', recordId: id, result: 'SUCCESS', oldValues: { kind, name } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return toActionError(error, 'organization.delete');
  }
}

/** Loads an industry scale of grade levels (existing codes are updated, none removed). */
export async function loadLevelPresetAction(key: string): Promise<Result<{ label: string; count: number }>> {
  await ensureTenantContext();
  try {
    const scope = await authorize('EDIT', 'level', null);
    const result = await orgService.loadLevelPreset(String(key));
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'ORG_STRUCTURE', recordId: 'level-preset', result: 'SUCCESS', newValues: { kind: 'level', preset: key, levels: result.count } });
    refresh();
    return { success: true, data: result };
  } catch (error: unknown) {
    return toActionError(error, 'organization.preset');
  }
}

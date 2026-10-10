'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as letterService from '@/lib/services/letter.service';
import type { LetterFilter } from '@/lib/repositories/letter.repository';

// HR letters (G2): Add issues a letter, Edit manages templates, Delete voids
// an issued letter. Nobody issues or voids a letter about their own record
// (S26, audited DENIED_SELF in the service). Letters respect the employee
// scope: a branch-scoped user only sees and issues letters for their branches.

async function letterCtx(action: 'VIEW' | 'ADD' | 'EDIT' | 'DELETE'): Promise<letterService.LetterCtx> {
  const scope = await checkPermissionWithScope(action, 'HR_LETTERS');
  return { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
}

function revalidate() {
  revalidatePath('/workforce/letters');
}

const validationFailure = (error: unknown) =>
  error instanceof letterService.LetterValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getLettersPageAction(filter: LetterFilter = {}) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('VIEW');
    const [issue, templates, canVoid] = await Promise.all([
      hasPermission('ADD', 'HR_LETTERS'),
      hasPermission('EDIT', 'HR_LETTERS'),
      hasPermission('DELETE', 'HR_LETTERS'),
    ]);
    const data = await letterService.lettersPage(ctx.scope, { issue, templates, void: canVoid }, filter);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'letter.list');
  }
}

export async function previewLetterAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('ADD');
    const data = await letterService.previewLetter(form, ctx);
    return { success: true as const, data };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'letter.preview');
  }
}

export async function issueLetterAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('ADD');
    const letter = await letterService.issueLetter(form, ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'ADD',
      module: 'HR_LETTERS',
      recordId: letter.id,
      result: 'SUCCESS',
      newValues: { letterNumber: letter.letterNumber, kind: letter.kind, employee: letter.employeeCode, language: letter.language },
    });
    revalidate();
    return { success: true as const, data: letter };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'letter.issue');
  }
}

export async function voidLetterAction(id: string, reason: string) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('DELETE');
    const letter = await letterService.voidIssuedLetter(id, typeof reason === 'string' ? reason : '', ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: 'DELETE',
      module: 'HR_LETTERS',
      recordId: id,
      result: 'SUCCESS',
      newValues: { letterNumber: letter.letterNumber, voidReason: letter.voidReason },
    });
    revalidate();
    return { success: true as const, data: letter };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'letter.void');
  }
}

export async function saveLetterTemplateAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('EDIT');
    const template = await letterService.saveTemplate(id, form, ctx);
    await recordAuditLog({
      userId: ctx.userId,
      action: id ? 'EDIT' : 'ADD',
      module: 'HR_LETTERS',
      recordId: template.id,
      result: 'SUCCESS',
      newValues: { code: template.code, name: template.name, active: template.isActive, template: true },
    });
    revalidate();
    return { success: true as const, data: template };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'letter.template-save');
  }
}

export async function deleteLetterTemplateAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('EDIT');
    await letterService.removeTemplate(id);
    await recordAuditLog({ userId: ctx.userId, action: 'DELETE', module: 'HR_LETTERS', recordId: id, result: 'SUCCESS', newValues: { template: true } });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'letter.template-delete');
  }
}

export async function saveLetterDesignAction(design: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('EDIT');
    const saved = await letterService.saveDesign(design);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'HR_LETTERS', recordId: 'letter-design', result: 'SUCCESS', newValues: { design: 'updated', logo: !!saved.logoDataUrl } });
    revalidate();
    return { success: true as const, data: saved };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'letter.design');
  }
}

export async function planJoiningPackAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('ADD');
    return { success: true as const, data: await letterService.planPack(form, ctx) };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'letter.pack.plan');
  }
}

export async function issueJoiningPackAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await letterCtx('ADD');
    const result = await letterService.issuePack(form, ctx);
    for (const letter of result.issued) {
      await recordAuditLog({
        userId: ctx.userId,
        action: 'ADD',
        module: 'HR_LETTERS',
        recordId: letter.id,
        result: 'SUCCESS',
        newValues: { letterNumber: letter.letterNumber, kind: letter.kind, employee: letter.employeeCode, language: letter.language, joiningPack: true },
      });
    }
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'letter.pack.issue');
  }
}

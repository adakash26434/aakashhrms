'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as recruitmentService from '@/lib/services/recruitment.service';

// Recruitment & darbandi (G4): VIEW lists, ADD opens positions / vacancies /
// applicants, EDIT moves stages and marks. Applicant details are personal
// data and never leave this module.

async function recruitmentCtx(action: 'VIEW' | 'ADD' | 'EDIT'): Promise<recruitmentService.RecruitmentCtx> {
  const scope = await checkPermissionWithScope(action, 'RECRUITMENT');
  return { userId: scope.userId, scope };
}

function revalidate() {
  revalidatePath('/workforce/recruitment');
}

const validationFailure = (error: unknown) =>
  error instanceof recruitmentService.RecruitmentValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getRecruitmentPageAction() {
  await ensureTenantContext();
  try {
    const ctx = await recruitmentCtx('VIEW');
    const manage = await hasPermission('EDIT', 'RECRUITMENT');
    const data = await recruitmentService.recruitmentPage(ctx, { manage });
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'recruitment.list');
  }
}

export async function saveApprovedPositionAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await recruitmentCtx('EDIT');
    const row = await recruitmentService.savePosition(form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'RECRUITMENT', recordId: row.id, result: 'SUCCESS', newValues: { darbandi: true, positions: row.positions, decisionRef: row.decisionRef } });
    revalidate();
    return { success: true as const, data: { id: row.id } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'recruitment.position-save');
  }
}

export async function openVacancyAction(form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await recruitmentCtx('ADD');
    const row = await recruitmentService.openVacancy(form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'RECRUITMENT', recordId: row.id, result: 'SUCCESS', newValues: { vacancy: true, openings: row.openings } });
    revalidate();
    return { success: true as const, data: { id: row.id } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'recruitment.vacancy-open');
  }
}

export async function closeVacancyAction(id: string, cancelled: boolean) {
  await ensureTenantContext();
  try {
    const ctx = await recruitmentCtx('EDIT');
    const row = await recruitmentService.closeVacancy(typeof id === 'string' ? id : '', cancelled === true ? 'cancelled' : 'closed', ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'RECRUITMENT', recordId: row.id, result: 'SUCCESS', newValues: { vacancyStatus: row.status } });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'recruitment.vacancy-close');
  }
}

export async function getVacancyApplicantsAction(vacancyId: string) {
  await ensureTenantContext();
  try {
    const ctx = await recruitmentCtx('VIEW');
    const data = await recruitmentService.vacancyApplicants(typeof vacancyId === 'string' ? vacancyId : '', ctx);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'recruitment.applicants');
  }
}

export async function addApplicantAction(vacancyId: string, form: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await recruitmentCtx('ADD');
    const row = await recruitmentService.addApplicant(typeof vacancyId === 'string' ? vacancyId : '', form, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'RECRUITMENT', recordId: row.id, result: 'SUCCESS', newValues: { applicant: true } });
    revalidate();
    return { success: true as const, data: { id: row.id } };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'recruitment.applicant-add');
  }
}

export async function updateApplicantAction(id: string, update: recruitmentService.ApplicantUpdate) {
  await ensureTenantContext();
  try {
    const ctx = await recruitmentCtx('EDIT');
    const row = await recruitmentService.updateApplicant(id, update ?? {}, ctx);
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'RECRUITMENT', recordId: row.id, result: 'SUCCESS', newValues: { stage: row.stage, marked: update?.examMarks !== undefined || update?.interviewMarks !== undefined } });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'recruitment.applicant-update');
  }
}

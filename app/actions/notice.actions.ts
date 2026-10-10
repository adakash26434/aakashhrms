'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as noticeService from '@/lib/services/notice.service';

// Notice board (G14): NOTICE_BOARD VIEW lists, ADD posts, EDIT changes, DELETE
// withdraws (nothing is ever deleted). Home reads the board through the
// dashboard snapshot, not through these actions.

const revalidate = () => {
  revalidatePath('/workforce/notices');
  revalidatePath('/dashboard');
};

const validationFailure = (error: unknown) =>
  error instanceof noticeService.NoticeValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : null;

export async function getNoticesPageAction() {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'NOTICE_BOARD');
    const [add, manage, withdraw] = await Promise.all([hasPermission('ADD', 'NOTICE_BOARD'), hasPermission('EDIT', 'NOTICE_BOARD'), hasPermission('DELETE', 'NOTICE_BOARD')]);
    return { success: true as const, data: await noticeService.noticesPage({ userId: scope.userId, scope }, { add, manage, withdraw }) };
  } catch (error: unknown) {
    return toActionError(error, 'notices.list');
  }
}

export async function saveNoticeAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope(id ? 'EDIT' : 'ADD', 'NOTICE_BOARD');
    const { userId } = scope;
    const row = await noticeService.saveNotice(typeof id === 'string' ? id : null, form, { userId, scope });
    await recordAuditLog({ userId, action: id ? 'EDIT' : 'ADD', module: 'NOTICE_BOARD', recordId: row.id, result: 'SUCCESS', newValues: { title: row.title, audience: row.audience, branchId: row.branchId, departmentId: row.departmentId, recipients: row.recipients.length, pinned: row.pinned } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return validationFailure(error) ?? toActionError(error, 'notices.save');
  }
}

export async function withdrawNoticeAction(id: string) {
  await ensureTenantContext();
  try {
    const { userId } = await checkPermissionWithScope('DELETE', 'NOTICE_BOARD');
    const row = await noticeService.withdrawNotice(typeof id === 'string' ? id : '', userId);
    await recordAuditLog({ userId, action: 'DELETE', module: 'NOTICE_BOARD', recordId: row.id, result: 'SUCCESS', newValues: { withdrawn: true } });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return toActionError(error, 'notices.withdraw');
  }
}

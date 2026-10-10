'use server';

import { ensureTenantContext } from '@/lib/db';
import { requireAuthenticatedUser } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as notifications from '@/lib/services/notification.service';

// F17 notification centre: the bell reads its list again when opened. The person is always the
// signed-in user (never a parameter); every count inside runs only with the permission that
// decides it, within the user's scope, and never counts the user's own records.

export async function getNotificationsAction() {
  await ensureTenantContext();
  try {
    const { userId, isImpersonation } = await requireAuthenticatedUser();
    const data = isImpersonation ? await notifications.supportNotifications() : await notifications.notificationsFor(userId);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'notifications');
  }
}

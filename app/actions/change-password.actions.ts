'use server';

import { ensureTenantContext, getDbAsync } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { auth, unstable_update } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/services/audit.service';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ActionResponse<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResponse<{ scopeType: string }>> {
  await ensureTenantContext();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized: You must be logged in to change your password.' };
    }

    const userId = session.user.id;

    // Validate inputs
    if (!input.currentPassword) {
      return { success: false, error: 'Current password is required.' };
    }
    if (!input.newPassword || input.newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }
    if (input.newPassword !== input.confirmPassword) {
      return { success: false, error: 'New password and confirmation do not match.' };
    }
    if (input.currentPassword === input.newPassword) {
      return { success: false, error: 'New password must be different from current password.' };
    }

    const db = await getDbAsync();

    // Get current user password hash
    const [userRecord] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return { success: false, error: 'User record not found.' };
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(input.currentPassword, userRecord.passwordHash);
    if (!isCurrentValid) {
      return { success: false, error: 'Incorrect current password. Please try again.' };
    }

    // Hash new password with cost factor 12
    const newHash = await bcrypt.hash(input.newPassword, 12);

    // Update password and clear mustChangePassword flag in database
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Update active JWT session cookie so mustChangePassword is false
    try {
      if (typeof unstable_update === 'function') {
        await unstable_update({
          user: {
            mustChangePassword: false,
          },
        });
      }
    } catch (sessionErr) {
      console.warn('[CHANGE_PASSWORD_ACTION] Session cookie update warning:', sessionErr);
    }

    // Record audit log
    await recordAuditLog({
      action: 'EDIT',
      module: 'USERS_ROLES',
      recordId: userRecord.name ? `${userRecord.name} (${userRecord.email})` : userRecord.email,
      newValues: { passwordChanged: true, mustChangePassword: false },
    });

    revalidatePath('/', 'layout');
    return { 
      success: true, 
      data: { scopeType: session.user.scopeType || 'SELF' } 
    };
  } catch (error: unknown) {
    console.error('[CHANGE_PASSWORD_ACTION] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to change password.';
    return { success: false, error: msg };
  }
}

'use server';

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { auth, signOut, unstable_update } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sessionUnlockLimiter } from '@/lib/auth/rate-limiter';
import { signSessionGrant } from '@/lib/auth/session-updates';
import { safeReturnTo } from '@/lib/frame/return-to';
import { logger } from '@/lib/logger';

type UpdatePayload = Parameters<typeof unstable_update>[0];

/** Idle lock (2.8). Locking needs no proof: it only ever restricts the session. */
export async function lockSessionAction(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };
  if (!session.user.locked) {
    await unstable_update({ lock: true } as UpdatePayload);
  }
  return { success: true };
}

export async function unlockSessionAction(
  password: string,
  returnTo?: string
): Promise<{ success: boolean; error?: string; redirectTo?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Your session has ended. Please sign in again.', redirectTo: '/login' };
  }
  const fallback = session.user.scopeType === 'SELF' ? '/self-service' : '/dashboard';
  const destination = safeReturnTo(returnTo, fallback);
  if (!session.user.locked) {
    return { success: true, redirectTo: destination };
  }

  const userId = session.user.id;
  const limit = sessionUnlockLimiter.check(userId);
  if (!limit.allowed) {
    await signOut({ redirect: false });
    return { success: false, error: 'Too many attempts. Please sign in again.', redirectTo: '/login' };
  }

  if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
    return { success: false, error: 'Enter your password to unlock.' };
  }

  const db = await getDbAsync(session.user.tenantSlug);
  const [account] = await db
    .select({ passwordHash: users.passwordHash, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const valid = Boolean(account?.isActive) && (await bcrypt.compare(password, account!.passwordHash));
  if (!valid) {
    const after = sessionUnlockLimiter.recordFailure(userId);
    logger.warn('[SESSION_LOCK] Failed unlock attempt', { userId, remaining: after.remainingAttempts });
    if (!after.allowed) {
      await signOut({ redirect: false });
      return { success: false, error: 'Too many attempts. Please sign in again.', redirectTo: '/login' };
    }
    return {
      success: false,
      error: `Incorrect password. ${after.remainingAttempts} attempt${after.remainingAttempts === 1 ? '' : 's'} left.`,
    };
  }

  sessionUnlockLimiter.reset(userId);
  const grant = await signSessionGrant(userId, 'unlock', String(session.user.lockedAt ?? ''));
  await unstable_update({ grant } as UpdatePayload);
  return { success: true, redirectTo: destination };
}

export async function signOutFromLockAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}

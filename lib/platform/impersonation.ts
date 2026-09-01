import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const IMPERSONATION_COOKIE = 'platform_impersonation';

export interface ImpersonationSession {
  actorId: string;
  actorEmail: string;
  actorName: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  logId: string;
}

/**
 * Derives the signing key for impersonation tokens.
 * Must match the key used in the impersonation API route.
 */
function getImpersonationKey(): Uint8Array {
  const secret =
    process.env.PLATFORM_SESSION_SECRET ||
    process.env.PLATFORM_SECRETS_KEY ||
    process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('Platform signing key is not configured.');
  }

  return new TextEncoder().encode(`impersonate:${secret}`);
}

/**
 * Reads and verifies the impersonation cookie from the current request.
 * Returns the impersonation session details if valid, or null if not impersonating.
 *
 * Use this in server components and layouts to detect when a Super Admin
 * is viewing a company's data via the "View As Company" flow.
 */
export async function getImpersonationSession(): Promise<ImpersonationSession | null> {
  try {
    const cookieStore = await cookies();
    const tokenValue = cookieStore.get(IMPERSONATION_COOKIE)?.value;

    if (!tokenValue) return null;

    const key = getImpersonationKey();
    const { payload } = await jwtVerify(tokenValue, key);

    if (
      !payload.actorId ||
      !payload.companyId ||
      !payload.companySlug ||
      typeof payload.actorId !== 'string' ||
      typeof payload.companyId !== 'string' ||
      typeof payload.companySlug !== 'string'
    ) {
      return null;
    }

    return {
      actorId: payload.actorId as string,
      actorEmail: (payload.actorEmail as string) || '',
      actorName: (payload.actorName as string) || 'Super Admin',
      companyId: payload.companyId as string,
      companySlug: payload.companySlug as string,
      companyName: (payload.companyName as string) || 'Unknown Company',
      logId: (payload.logId as string) || '',
    };
  } catch {
    return null;
  }
}

export { IMPERSONATION_COOKIE };

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { platformDb, ensurePlatformTablesExist } from './db';
import { platformUsers } from './schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Platform Super Admin JWT Session Management
// ---------------------------------------------------------------------------

const PLATFORM_COOKIE_NAME = 'platform_session';
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

interface PlatformSessionPayload extends JWTPayload {
  /** Platform user UUID */
  uid: string;
  /** Platform user email */
  email: string;
  /** Issued-at timestamp (standard JWT claim) */
  iat?: number;
}

export interface VerifiedPlatformUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}

/**
 * Derives the JWT signing key from the environment.
 * Reuses PLATFORM_SECRETS_KEY if set, otherwise falls back to AUTH_SECRET.
 * Throws if neither is available — never silently falls back to a hardcoded value.
 */
function getSigningKey(): Uint8Array {
  const secret =
    process.env.PLATFORM_SESSION_SECRET ||
    process.env.PLATFORM_SECRETS_KEY ||
    process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      'Platform session signing key is not configured. ' +
        'Set PLATFORM_SESSION_SECRET, PLATFORM_SECRETS_KEY, or AUTH_SECRET in your environment.'
    );
  }

  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Token creation
// ---------------------------------------------------------------------------

/**
 * Creates a signed JWT for a verified platform Super Admin user.
 * Called during login to generate the session cookie value.
 */
export async function createPlatformSessionToken(user: {
  id: string;
  email: string;
}): Promise<string> {
  const key = getSigningKey();

  const token = await new SignJWT({ uid: user.id, email: user.email } satisfies PlatformSessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_MAX_AGE_SECONDS}s`)
    .sign(key);

  return token;
}

/**
 * Returns the cookie options object for setting the platform session cookie.
 */
export function getPlatformCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TOKEN_MAX_AGE_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

/**
 * Verifies a platform session JWT token string.
 * Returns the decoded payload or null if invalid/expired.
 */
async function verifyToken(token: string): Promise<PlatformSessionPayload | null> {
  try {
    const key = getSigningKey();
    const { payload } = await jwtVerify(token, key);
    if (!payload.uid || typeof payload.uid !== 'string') return null;
    return payload as PlatformSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Verifies the platform session cookie and validates the user against the DB.
 *
 * Returns the verified platform user if the session is valid, or null if:
 * - No cookie present
 * - JWT is invalid or expired
 * - User ID in the JWT doesn't match an active platformUsers record
 */
export async function verifyPlatformSession(): Promise<VerifiedPlatformUser | null> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(PLATFORM_COOKIE_NAME)?.value;

    if (!tokenCookie) return null;

    const payload = await verifyToken(tokenCookie);
    if (!payload?.uid) return null;

    await ensurePlatformTablesExist();

    const [user] = await platformDb
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.id, payload.uid))
      .limit(1);

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies a platform session from a raw Request object (for API routes).
 * Reads the cookie from the request headers rather than using next/headers.
 */
export async function verifyPlatformSessionFromRequest(
  request: Request
): Promise<VerifiedPlatformUser | null> {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(
      new RegExp(`(?:^|;\\s*)${PLATFORM_COOKIE_NAME}=([^;]+)`)
    );
    const tokenValue = match?.[1];

    if (!tokenValue) return null;

    const payload = await verifyToken(tokenValue);
    if (!payload?.uid) return null;

    await ensurePlatformTablesExist();

    const [user] = await platformDb
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.id, payload.uid))
      .limit(1);

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API route guard
// ---------------------------------------------------------------------------

/**
 * Guard for platform API routes. Returns the verified user or a 401 response.
 *
 * Usage in API route handlers:
 * ```ts
 * const authResult = await requirePlatformAuth(request);
 * if (authResult instanceof NextResponse) return authResult;
 * const user = authResult; // VerifiedPlatformUser
 * ```
 */
export async function requirePlatformAuth(
  request: Request
): Promise<VerifiedPlatformUser | NextResponse> {
  const user = await verifyPlatformSessionFromRequest(request);

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized. Valid Super Admin session is required.',
      },
      { status: 401 }
    );
  }

  return user;
}

export { PLATFORM_COOKIE_NAME, TOKEN_MAX_AGE_SECONDS };

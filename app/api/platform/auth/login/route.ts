import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { platformUsers } from '@/lib/platform/schema';
import { createPlatformSessionToken, getPlatformCookieOptions, PLATFORM_COOKIE_NAME } from '@/lib/platform/auth';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { platformLoginLimiter, ipRateLimiter } from '@/lib/auth/rate-limiter';
import { getClientIp } from '@/lib/auth/client-ip';
import { logger } from '@/lib/logger';

// Equalises timing for unknown emails (no account enumeration).
let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = () => (dummyHashPromise ??= bcrypt.hash(randomUUID(), 12));

function tooManyAttempts(lockedUntil: number | null) {
  const minutes = Math.max(1, Math.ceil(((lockedUntil ?? Date.now()) - Date.now()) / 60000));
  return NextResponse.json(
    { success: false, error: `Too many failed login attempts. Try again in ${minutes} minute(s).` },
    { status: 429 }
  );
}

export async function POST(request: Request) {
  try {
    await ensurePlatformTablesExist();

    const { email, password } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // S5: throttle by client IP + email and by client IP alone
    const normalizedEmail = email.toLowerCase().trim();
    const ip = getClientIp(request.headers);
    const accountKey = `platform:${ip}:${normalizedEmail}`;
    const ipKey = `platform-ip:${ip}`;
    const accountCheck = platformLoginLimiter.check(accountKey);
    const ipCheck = ipRateLimiter.check(ipKey);
    if (!accountCheck.allowed || !ipCheck.allowed) {
      return tooManyAttempts(Math.max(accountCheck.lockedUntil ?? 0, ipCheck.lockedUntil ?? 0));
    }
    const recordFailure = () => {
      platformLoginLimiter.recordFailure(accountKey);
      ipRateLimiter.recordFailure(ipKey);
      logger.warn('Platform login failed', { email: normalizedEmail, ip });
    };

    const [user] = await platformDb
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.email, normalizedEmail))
      .limit(1);

    if (!user || !user.isActive) {
      await bcrypt.compare(password, await getDummyHash());
      recordFailure();
      return NextResponse.json(
        { success: false, error: 'Invalid Super Admin credentials.' },
        { status: 401 }
      );
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      recordFailure();
      return NextResponse.json(
        { success: false, error: 'Invalid Super Admin credentials.' },
        { status: 401 }
      );
    }

    platformLoginLimiter.reset(accountKey);

    // Update last login timestamp
    await platformDb
      .update(platformUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(platformUsers.id, user.id));

    // Generate signed JWT session token
    const sessionToken = await createPlatformSessionToken({
      id: user.id,
      email: user.email,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    // Set JWT-based platform session cookie
    response.cookies.set(PLATFORM_COOKIE_NAME, sessionToken, getPlatformCookieOptions());

    return response;
  } catch (error) {
    console.error('Super Admin login error:', error);
    return NextResponse.json(
      { success: false, error: 'Super Admin authentication failed.' },
      { status: 500 }
    );
  }
}

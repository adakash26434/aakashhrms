import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companies, platformImpersonationLog, platformAuditLogs } from '@/lib/platform/schema';
import { requirePlatformAuth, createPlatformSessionToken } from '@/lib/platform/auth';
import { SignJWT, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';

const IMPERSONATION_COOKIE = 'platform_impersonation';
const IMPERSONATION_MAX_AGE = 60 * 60 * 4; // 4 hours

/**
 * Derives the signing key for impersonation tokens.
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
 * POST — Start impersonation session.
 * Creates an impersonation JWT token and logs the session start.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    await ensurePlatformTablesExist();
    const { id: companyId } = await params;

    // Verify company exists and is ACTIVE
    const [company] = await platformDb
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found.' },
        { status: 404 }
      );
    }

    if (company.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Cannot impersonate a non-active company.' },
        { status: 400 }
      );
    }

    // Extract IP and User-Agent for audit
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    // Log the impersonation session start
    const [logEntry] = await platformDb
      .insert(platformImpersonationLog)
      .values({
        actorPlatformUserId: actor.id,
        companyId: companyId,
        ipAddress: ip,
        userAgent: userAgent,
      })
      .returning();

    // Also write to the audit log
    await platformDb.insert(platformAuditLogs).values({
      actorPlatformUserId: actor.id,
      action: 'IMPERSONATION_START',
      companyId: companyId,
      meta: {
        impersonationLogId: logEntry.id,
        companyName: company.displayName,
        companySlug: company.slug,
      },
      ipAddress: ip,
    });

    // Create a scoped, time-limited impersonation JWT
    const key = getImpersonationKey();
    const impersonationToken = await new SignJWT({
      actorId: actor.id,
      actorEmail: actor.email,
      actorName: actor.name,
      companyId: company.id,
      companySlug: company.slug,
      companyName: company.displayName,
      logId: logEntry.id,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${IMPERSONATION_MAX_AGE}s`)
      .sign(key);

    const response = NextResponse.json({
      success: true,
      company: {
        id: company.id,
        displayName: company.displayName,
        slug: company.slug,
      },
      redirectUrl: '/dashboard',
    });

    const isPlainHttp = process.env.AUTH_URL?.startsWith('http://') || process.env.NEXTAUTH_URL?.startsWith('http://');
    const isSecure = !isPlainHttp && process.env.NODE_ENV === 'production';

    // Set the impersonation cookie
    response.cookies.set(IMPERSONATION_COOKIE, impersonationToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: IMPERSONATION_MAX_AGE,
    });

    return response;
  } catch (error: any) {
    console.error('Impersonation start error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to start impersonation session.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE — End impersonation session.
 * Clears the impersonation cookie and logs the session end.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePlatformAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const actor = authResult;

  try {
    // Read the impersonation cookie to find the log entry ID
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(
      new RegExp(`(?:^|;\\s*)${IMPERSONATION_COOKIE}=([^;]+)`)
    );
    const tokenValue = match?.[1];

    if (tokenValue) {
      try {
        const key = getImpersonationKey();
        const { payload } = await jwtVerify(tokenValue, key);

        // Update the ended_at timestamp in the impersonation log
        if (payload.logId && typeof payload.logId === 'string') {
          await platformDb
            .update(platformImpersonationLog)
            .set({ endedAt: new Date() })
            .where(eq(platformImpersonationLog.id, payload.logId));
        }

        // Audit log
        const { id: companyId } = await params;
        await platformDb.insert(platformAuditLogs).values({
          actorPlatformUserId: actor.id,
          action: 'IMPERSONATION_END',
          companyId: companyId,
          meta: { impersonationLogId: payload.logId },
        });
      } catch {
        // Token might be expired or invalid — just clear the cookie
      }
    }

    const response = NextResponse.json({
      success: true,
      redirectUrl: '/platform',
    });

    // Clear the impersonation cookie
    response.cookies.delete(IMPERSONATION_COOKIE);

    return response;
  } catch (error: any) {
    console.error('Impersonation end error:', error);
    // Always clear the cookie even on error
    const response = NextResponse.json(
      { success: false, error: error?.message || 'Failed to end impersonation session.' },
      { status: 500 }
    );
    response.cookies.delete(IMPERSONATION_COOKIE);
    return response;
  }
}

import { NextResponse } from 'next/server';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { platformUsers } from '@/lib/platform/schema';
import { createPlatformSessionToken, getPlatformCookieOptions, PLATFORM_COOKIE_NAME } from '@/lib/platform/auth';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    await ensurePlatformTablesExist();

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const [user] = await platformDb
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Invalid Super Admin credentials.' },
        { status: 401 }
      );
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Invalid Super Admin credentials.' },
        { status: 401 }
      );
    }

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

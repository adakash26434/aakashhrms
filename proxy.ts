import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './lib/auth/auth.config';

const nextAuthHandler = NextAuth(authConfig).auth;

export default async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostHeader = request.headers.get('host') || '';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', url.pathname);
  requestHeaders.set('x-hostname', hostHeader);

  // SECURITY: Always strip any client-supplied x-tenant-slug header to prevent
  // tenant spoofing. Multi-tenancy is now resolved securely via Company Code
  // at login and carried in the cryptographically signed session JWT.
  requestHeaders.delete('x-tenant-slug');

  // 1. Super Admin Platform Route Protection
  if (url.pathname.startsWith('/platform')) {
    const isPlatformLogin = url.pathname === '/platform/login';
    const platformCookie = request.cookies.get('platform_session')?.value;

    // Never block or redirect on the platform login page itself
    if (isPlatformLogin) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // If visiting protected /platform routes without a session cookie, redirect to /platform/login
    if (!platformCookie) {
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }

    // Cookie exists — full JWT + DB validation happens in PlatformLayout and API routes
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 2. Tenant Application Routes — Delegate to NextAuth for JWT session verification
  return (nextAuthHandler as any)(request, {
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt
     * - static files with extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

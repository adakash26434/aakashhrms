import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './lib/auth/auth.config';

import { verifyImpersonationToken, IMPERSONATION_COOKIE } from './lib/platform/impersonation';

// NextAuth's auth() doubles as middleware; type the call signature we use here.
type ProxyAuthHandler = (
  request: NextRequest,
  init: { request: { headers: Headers } }
) => Promise<Response>;
const nextAuthHandler = NextAuth(authConfig).auth as unknown as ProxyAuthHandler;

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

  // 2. Super Admin "View Company Workspace" (Impersonation Session)
  // Super Admin can directly view and navigate the company workspace
  // without needing tenant user credentials or being redirected to /login.
  const impersonationCookie = request.cookies.get(IMPERSONATION_COOKIE)?.value;
  let hasInvalidImpersonationCookie = false;
  if (impersonationCookie) {
    const session = await verifyImpersonationToken(impersonationCookie);
    if (session) {
      // If navigating to /login or /change-password while in impersonation mode, redirect straight to /dashboard
      if (url.pathname === '/login' || url.pathname === '/change-password') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    // SECURITY (S1): a forged or expired token never grants access. It is
    // ignored here (NextAuth decides) and cleared on the way out.
    hasInvalidImpersonationCookie = true;
  }

  // 3. Tenant Application Routes — Delegate to NextAuth for JWT session verification
  const response: Response = await nextAuthHandler(request, {
    request: {
      headers: requestHeaders,
    },
  });

  if (hasInvalidImpersonationCookie && response) {
    // Copy first: redirect responses have immutable headers.
    const headers = new Headers(response.headers);
    headers.append(
      'Set-Cookie',
      `${IMPERSONATION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
    );
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
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

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './lib/auth/auth.config';

import { verifyImpersonationToken, IMPERSONATION_COOKIE } from './lib/platform/impersonation';
import { buildContentSecurityPolicy, generateCspNonce } from './lib/security/csp';

// NextAuth's auth() doubles as middleware; type the call signature we use here.
type ProxyAuthHandler = (
  request: NextRequest,
  init: { request: { headers: Headers } }
) => Promise<Response>;
const nextAuthHandler = NextAuth(authConfig).auth as unknown as ProxyAuthHandler;

/**
 * Continue to the route with our request headers. NextAuth's handler returns
 * its own bare NextResponse.next(), which drops request-header overrides, so
 * every pass-through goes via this helper (S13). Set-Cookie headers from
 * NextAuth (session refresh) are carried over.
 */
function continueWith(requestHeaders: Headers, from?: Response): NextResponse {
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (from) {
    for (const cookie of from.headers.getSetCookie()) {
      response.headers.append('set-cookie', cookie);
    }
  }
  return response;
}

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

  // SECURITY (S6): per-request CSP nonce. Next.js reads the nonce from the
  // request's CSP header and adds it to the scripts it renders.
  const nonce = generateCspNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    upgradeInsecureRequests: process.env.FORCE_SSL === 'true',
  });
  requestHeaders.set('content-security-policy', contentSecurityPolicy);
  requestHeaders.set('x-nonce', nonce);

  const response = await route(request, url, requestHeaders);
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

async function route(
  request: NextRequest,
  url: URL,
  requestHeaders: Headers
): Promise<NextResponse> {
  // 1. Super Admin Platform Route Protection
  if (url.pathname.startsWith('/platform')) {
    const isPlatformLogin = url.pathname === '/platform/login';
    const platformCookie = request.cookies.get('platform_session')?.value;

    // Never block or redirect on the platform login page itself
    if (isPlatformLogin) {
      return continueWith(requestHeaders);
    }

    // If visiting protected /platform routes without a session cookie, redirect to /platform/login
    if (!platformCookie) {
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }

    // Cookie exists — full JWT + DB validation happens in PlatformLayout and API routes
    return continueWith(requestHeaders);
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
      return continueWith(requestHeaders);
    }
    // SECURITY (S1): a forged or expired token never grants access. It is
    // ignored here (NextAuth decides) and cleared on the way out.
    hasInvalidImpersonationCookie = true;
  }

  // 3. Tenant Application Routes — Delegate to NextAuth for JWT session verification
  const authResponse: Response = await nextAuthHandler(request, {
    request: {
      headers: requestHeaders,
    },
  });

  // Authorised pass-through → rebuild it so our request headers reach the route.
  // Anything else (redirect to /login etc.) is copied so its headers are mutable.
  const response =
    authResponse.headers.get('x-middleware-next') === '1'
      ? continueWith(requestHeaders, authResponse)
      : new NextResponse(authResponse.body, {
          status: authResponse.status,
          statusText: authResponse.statusText,
          headers: new Headers(authResponse.headers),
        });

  if (hasInvalidImpersonationCookie) {
    response.headers.append(
      'Set-Cookie',
      `${IMPERSONATION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
    );
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

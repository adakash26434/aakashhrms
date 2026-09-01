import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login', // The login page we will build
  },
  callbacks: {
    // Add the user's role, tenant slug, scope, employee link, and mustChangePassword to JWT
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.roleId = user.roleId;
        // Carry tenant slug in the JWT so session-based tenant resolution works
        // after the company-code login flow
        if (user.tenantSlug) {
          token.tenantSlug = user.tenantSlug;
        }
        // Carry scopeType for post-login routing (self-service vs admin dashboard)
        if (user.scopeType) {
          token.scopeType = user.scopeType;
        }
        // Carry employeeId for self-service data scoping
        if (user.employeeId) {
          token.employeeId = user.employeeId;
        }
        // Carry mustChangePassword for forced first-login password change flow
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
      // Handle session updates (e.g. after password change)
      if (trigger === "update" && session?.user) {
        if (session.user.mustChangePassword !== undefined) {
          token.mustChangePassword = session.user.mustChangePassword;
        }
      }
      return token;
    },
    // Expose the role, tenant slug, scope, and employee link from the token to the active session
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.roleId = token.roleId;
        session.user.tenantSlug = token.tenantSlug || null;
        session.user.scopeType = token.scopeType || null;
        session.user.employeeId = token.employeeId || null;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    },
    // Route protection: Require login for all protected routes, enforce password change and role confinement
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthRoute = nextUrl.pathname.startsWith('/login');
      const isChangePasswordRoute = nextUrl.pathname.startsWith('/change-password');
      const isHomePage = nextUrl.pathname === '/';
      const isPlatformRoute = nextUrl.pathname.startsWith('/platform');
      const isSelfServiceRoute = nextUrl.pathname.startsWith('/self-service');
      const isApiRoute = nextUrl.pathname.startsWith('/api');

      // Allow platform routes to be handled independently by Super Admin control plane
      if (isPlatformRoute) {
        return true;
      }

      // Allow Next.js API routes (NextAuth, etc.) to process normally
      if (isApiRoute) {
        return true;
      }

      if (isLoggedIn) {
        const mustChangePassword = Boolean(auth?.user?.mustChangePassword);
        const scopeType = auth?.user?.scopeType;

        // 1. FORCED PASSWORD CHANGE ENFORCEMENT
        // If user must change password, lock them into /change-password until completed
        if (mustChangePassword) {
          if (!isChangePasswordRoute) {
            return Response.redirect(new URL('/change-password', nextUrl));
          }
          return true;
        }

        // If password is already changed, prevent staying on /change-password
        if (!mustChangePassword && isChangePasswordRoute) {
          if (scopeType === 'SELF') {
            return Response.redirect(new URL('/self-service', nextUrl));
          }
          return Response.redirect(new URL('/dashboard', nextUrl));
        }

        // 2. SELF-SCOPE CONFINEMENT ENFORCEMENT
        // Employees with SELF scope may access /self-service routes and the public homepage
        if (scopeType === 'SELF') {
          if (isHomePage) {
            return true;
          }
          if (isAuthRoute) {
            return Response.redirect(new URL('/self-service', nextUrl));
          }
          if (!isSelfServiceRoute) {
            return Response.redirect(new URL('/self-service', nextUrl));
          }
          return true;
        }

        // 3. ADMIN / MANAGER POST-LOGIN ROUTING FROM /login
        if (isAuthRoute) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }

        // Allow authenticated users to view the public homepage or navigate their workspace
        return true;
      }

      // Not logged in: allow public homepage / and /login, block protected routes
      if (isHomePage || isAuthRoute) {
        return true;
      }

      return false;
    },
  },
  providers: [], 
} satisfies NextAuthConfig;
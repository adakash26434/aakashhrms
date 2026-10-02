import NextAuth from 'next-auth';
import { logger } from '../logger';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { getDbAsync } from '../db';
import { users, userRoles, roles } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  ipRateLimiter,
  computeAccountLockoutMs,
} from './rate-limiter';
import { getClientIp } from './client-ip';

// Used to equalise response time when the email does not exist, so login
// timing does not reveal which accounts are registered (S5). A real cost-12
// hash of a random secret, generated once on first use.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash(randomUUID(), 12);
  return dummyHashPromise;
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        companyCode: { label: "Company Code", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);
        const companyCode = credentials.companyCode ? String(credentials.companyCode).trim().toUpperCase() : null;
        const isSingleTenant = process.env.SINGLE_TENANT_MODE === 'true';

        // Rate limiting (S5). The client IP comes from the proxy-appended end
        // of X-Forwarded-For; the client-supplied left end is never trusted.
        const ip = getClientIp(request?.headers);
        const rateLimitKey = companyCode
          ? `${ip}:${companyCode}:${email}`
          : `${ip}:${email}`;
        const ipKey = `ip:${ip}`;

        const ipCheck = ipRateLimiter.check(ipKey);
        const limitCheck = checkRateLimit(rateLimitKey);
        if (!ipCheck.allowed || !limitCheck.allowed) {
          const lockedUntil = Math.max(ipCheck.lockedUntil ?? 0, limitCheck.lockedUntil ?? 0);
          const minutesLeft = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
          throw new Error(`TOO_MANY_ATTEMPTS:Too many failed login attempts. Try again in ${minutesLeft} minute(s).`);
        }

        const recordFailure = () => {
          recordFailedAttempt(rateLimitKey);
          ipRateLimiter.recordFailure(ipKey);
        };

        // Resolve tenant slug via Company Code lookup
        let tenantSlug: string | null = null;

        if (companyCode) {
          try {
            const { platformDb, ensurePlatformTablesExist } = await import('../platform/db');
            const { companies } = await import('../platform/schema');
            await ensurePlatformTablesExist();

            const [company] = await platformDb
              .select({ slug: companies.slug, status: companies.status })
              .from(companies)
              .where(eq(companies.companyCode, companyCode))
              .limit(1);

            if (!company || company.status !== 'ACTIVE') {
              recordFailure();
              logger.warn('Login failed: invalid or inactive company code', { companyCode, email, ip });
              throw new Error('INVALID_COMPANY:Invalid or inactive company code.');
            }

            tenantSlug = company.slug;
          } catch (err) {
            if (err instanceof Error && err.message.startsWith('INVALID_COMPANY:')) {
              throw err;
            }
            logger.error('Error resolving company code during login', { companyCode, error: err });
            throw new Error('INVALID_COMPANY:Unable to verify company code. Please try again.');
          }
        } else if (!isSingleTenant) {
          // In multi-tenant mode, company code is required
          throw new Error('INVALID_COMPANY:Please enter your company code to sign in.');
        }

        const db = await getDbAsync(tenantSlug || undefined);

        // 1. Find user in the tenant database
        const rows = await db.select().from(users).where(eq(users.email, email));
        if (!rows.length) {
          // Spend the same bcrypt time as a real check (no user enumeration)
          await bcrypt.compare(password, await getDummyHash());
          recordFailure();
          logger.warn('Login failed: user not found in tenant database', { email, tenantSlug, ip });
          return null;
        }

        const user = rows[0];

        // 2. Check if active
        if (!user.isActive) {
          recordFailure();
          logger.warn('Login failed: inactive user', { userId: user.id, email, ip });
          return null;
        }

        // 3. Check if account is currently locked out in-DB
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
          logger.warn('Login attempt blocked for locked account', { userId: user.id, email, lockedUntil: user.lockedUntil });
          return null;
        }

        // 4. Verify password
        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordsMatch) {
          recordFailure();
          
          const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
          let lockTime: Date | null = null;

          // Account-wide escalating lock (S5): none below the threshold, then
          // 1, 2, 4, 8 … minutes, capped at 15. Replaces the old hard 15-minute
          // lock after 4 failures, which anyone could trigger with an email.
          const lockMs = computeAccountLockoutMs(newFailedAttempts);
          if (lockMs > 0) {
            lockTime = new Date(Date.now() + lockMs);
            logger.warn('Account temporarily locked after repeated failed logins', {
              email,
              userId: user.id,
              failedAttempts: newFailedAttempts,
              lockMinutes: Math.round(lockMs / 60000),
              ip,
            });
          }

          await db.update(users)
            .set({ 
              failedLoginAttempts: newFailedAttempts,
              lockedUntil: lockTime,
              updatedAt: new Date()
            })
            .where(eq(users.id, user.id));

          logger.warn('Login failed: wrong password', { userId: user.id, email, ip });
          return null;
        }

        // 5. Success — reset rate limit and in-database failed attempts
        resetRateLimit(rateLimitKey);

        await db.update(users)
          .set({ 
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date()
          })
          .where(eq(users.id, user.id));

        logger.info('User logged in successfully', { userId: user.id, email: user.email, tenantSlug, ip });

        // 6. Look up their primary role and its scopeType
        const roleRows = await db
          .select({ roleId: userRoles.roleId, scopeType: roles.scopeType })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, user.id));
        const primaryRoleId = roleRows.length > 0 ? roleRows[0].roleId : null;
        const scopeType = roleRows.length > 0 ? roleRows[0].scopeType : null;

        return {
          id: user.id,
          email: user.email,
          roleId: primaryRoleId,
          // Carry tenantSlug in the user session so authConfig.jwt() can persist it
          tenantSlug: tenantSlug || undefined,
          // Carry scopeType for post-login routing (self-service vs admin dashboard)
          scopeType: scopeType || undefined,
          // Carry employeeId for self-service data scoping
          employeeId: user.employeeId || undefined,
          // Carry mustChangePassword for forced first-login password change flow
          mustChangePassword: Boolean(user.mustChangePassword),
        };
      }
    })
  ],
});
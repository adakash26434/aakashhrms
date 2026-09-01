import NextAuth from 'next-auth';
import { logger } from '../logger';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { getDbAsync } from '../db';
import { users, userRoles, roles } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from './rate-limiter';

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

        // Rate limiting: block brute-force attacks by IP+companyCode+email
        const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request?.headers?.get('x-real-ip')
          || 'unknown';
        const rateLimitKey = companyCode
          ? `${ip}:${companyCode}:${email}`
          : `${ip}:${email}`;

        const limitCheck = checkRateLimit(rateLimitKey);
        if (!limitCheck.allowed) {
          const minutesLeft = Math.ceil((limitCheck.lockedUntil! - Date.now()) / 60000);
          throw new Error(`TOO_MANY_ATTEMPTS:Too many failed login attempts. Try again in ${minutesLeft} minute(s).`);
        }

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
              recordFailedAttempt(rateLimitKey);
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
          recordFailedAttempt(rateLimitKey);
          logger.warn('Login failed: user not found in tenant database', { email, tenantSlug, ip });
          return null;
        }

        const user = rows[0];

        // 2. Check if active
        if (!user.isActive) {
          recordFailedAttempt(rateLimitKey);
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
          recordFailedAttempt(rateLimitKey);
          
          const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
          let lockTime: Date | null = null;
          
          // Lock account if failed attempts reach 4
          if (newFailedAttempts >= 4) {
            lockTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lock
            logger.warn(`Account locked for 15 minutes after ${newFailedAttempts} failed attempts`, { email, userId: user.id });
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
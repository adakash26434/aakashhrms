/**
 * Secret handling and startup validation (security plan, standing rule 8).
 *
 * Three independent secrets, each with one purpose:
 *   AUTH_SECRET              — NextAuth tenant sessions
 *   PLATFORM_SESSION_SECRET  — super-admin session + impersonation token signing
 *   PLATFORM_SECRETS_KEY     — encryption of tenant database credentials
 *
 * Reusing one secret for several purposes means a leak of one is a leak of
 * all. Production therefore refuses to sign platform tokens unless
 * PLATFORM_SESSION_SECRET is set and distinct; development falls back with a
 * warning so local setups keep working.
 */

export const MIN_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

const isProduction = (env: Env) => (env.NODE_ENV ?? '').trim() === 'production';

let warnedAboutFallback = false;

/** Secret used to sign platform session and impersonation JWTs. */
export function getPlatformSigningSecret(env: Env = process.env): string {
  const dedicated = env.PLATFORM_SESSION_SECRET;

  if (dedicated) {
    if (isProduction(env) && (dedicated === env.AUTH_SECRET || dedicated === env.PLATFORM_SECRETS_KEY)) {
      throw new Error(
        'PLATFORM_SESSION_SECRET must be different from AUTH_SECRET and PLATFORM_SECRETS_KEY.'
      );
    }
    return dedicated;
  }

  if (isProduction(env)) {
    throw new Error(
      'PLATFORM_SESSION_SECRET is not configured. Set a dedicated random value of at least ' +
        `${MIN_SECRET_LENGTH} characters (e.g. \`openssl rand -base64 48\`).`
    );
  }

  const fallback = env.PLATFORM_SECRETS_KEY || env.AUTH_SECRET;
  if (!fallback) {
    throw new Error('Platform signing key is not configured. Set PLATFORM_SESSION_SECRET.');
  }
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      '[security] PLATFORM_SESSION_SECRET is not set; using a fallback secret (development only).'
    );
  }
  return fallback;
}

export interface SecurityConfigIssue {
  level: 'error' | 'warning';
  message: string;
}

/** Pure check of the security-relevant environment. Used at server start. */
export function validateSecurityConfig(env: Env = process.env): SecurityConfigIssue[] {
  const issues: SecurityConfigIssue[] = [];
  const prod = isProduction(env);
  const multiTenant = env.SINGLE_TENANT_MODE !== 'true';
  const level = prod ? 'error' : 'warning';

  const authSecret = env.AUTH_SECRET || env.NEXTAUTH_SECRET;
  if (!authSecret) {
    issues.push({ level: 'error', message: 'AUTH_SECRET is not set.' });
  } else if (authSecret.length < MIN_SECRET_LENGTH) {
    issues.push({ level, message: `AUTH_SECRET is shorter than ${MIN_SECRET_LENGTH} characters.` });
  }

  if (multiTenant) {
    if (!env.PLATFORM_SECRETS_KEY) {
      issues.push({ level: 'error', message: 'PLATFORM_SECRETS_KEY is not set (needed to decrypt tenant DB credentials).' });
    }
    if (!env.PLATFORM_SESSION_SECRET) {
      issues.push({ level, message: 'PLATFORM_SESSION_SECRET is not set; platform login is disabled in production until it is.' });
    } else if (env.PLATFORM_SESSION_SECRET.length < MIN_SECRET_LENGTH) {
      issues.push({ level, message: `PLATFORM_SESSION_SECRET is shorter than ${MIN_SECRET_LENGTH} characters.` });
    }
  }

  const values = [
    ['AUTH_SECRET', authSecret],
    ['PLATFORM_SESSION_SECRET', env.PLATFORM_SESSION_SECRET],
    ['PLATFORM_SECRETS_KEY', env.PLATFORM_SECRETS_KEY],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i][1] === values[j][1]) {
        issues.push({ level, message: `${values[i][0]} and ${values[j][0]} must not share the same value.` });
      }
    }
  }

  if (prod && env.FORCE_SSL !== 'true') {
    issues.push({ level: 'warning', message: 'FORCE_SSL is not "true"; HSTS is disabled.' });
  }

  return issues;
}

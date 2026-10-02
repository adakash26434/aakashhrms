/**
 * In-memory rate limiters for brute-force protection on auth endpoints.
 *
 * Rationale: cPanel/Passenger shared hosting typically runs a single Node
 * process, so an in-memory Map is sufficient. It won't survive process
 * restarts, but that's acceptable — an attacker would need to restart the
 * process (which they can't) to reset the counter.
 *
 * For multi-process / multi-server deployments, swap this for a Redis-backed
 * limiter.
 *
 * Layers used by the login flow (S5):
 *   1. Per client IP + account   — checkRateLimit / recordFailedAttempt (5 / 15 min)
 *   2. Per client IP, any account — ipRateLimiter (30 / 15 min) stops password spraying
 *   3. Per account, any IP        — computeAccountLockoutMs() escalating DB lock
 */

type AttemptRecord = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil: number | null;
};

export interface RateLimiterOptions {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

const PURGE_INTERVAL_MS = 5 * 60 * 1000;

export function createRateLimiter({ maxAttempts, windowMs, lockoutMs }: RateLimiterOptions) {
  const store = new Map<string, AttemptRecord>();
  let lastPurge = Date.now();

  // Periodically purge expired entries to prevent memory leaks
  function purgeExpired(now: number) {
    if (now - lastPurge < PURGE_INTERVAL_MS) return;
    lastPurge = now;
    for (const [key, record] of store) {
      if (now > record.lockedUntil && now - record.firstAttemptAt > windowMs) {
        store.delete(key);
      }
    }
  }

  function freshRecord(identifier: string, now: number): AttemptRecord {
    let record = store.get(identifier);
    if (!record || (now - record.firstAttemptAt > windowMs && record.lockedUntil <= now)) {
      record = { count: 0, firstAttemptAt: now, lockedUntil: 0 };
      store.set(identifier, record);
    }
    return record;
  }

  function result(record: AttemptRecord, now: number): RateLimitResult {
    if (record.lockedUntil > now) {
      return { allowed: false, remainingAttempts: 0, lockedUntil: record.lockedUntil };
    }
    return {
      allowed: true,
      remainingAttempts: Math.max(0, maxAttempts - record.count),
      lockedUntil: null,
    };
  }

  return {
    check(identifier: string, now = Date.now()): RateLimitResult {
      purgeExpired(now);
      return result(freshRecord(identifier, now), now);
    },
    recordFailure(identifier: string, now = Date.now()): RateLimitResult {
      purgeExpired(now);
      const record = freshRecord(identifier, now);
      record.count++;
      if (record.count >= maxAttempts) {
        record.lockedUntil = now + lockoutMs;
      }
      return result(record, now);
    },
    reset(identifier: string) {
      store.delete(identifier);
    },
  };
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout after 5 failures

/** Layer 1: client IP + account. */
const accountIpLimiter = createRateLimiter({
  maxAttempts: MAX_ATTEMPTS,
  windowMs: WINDOW_MS,
  lockoutMs: LOCKOUT_MS,
});

export function checkRateLimit(identifier: string, now = Date.now()): RateLimitResult {
  return accountIpLimiter.check(identifier, now);
}

export function recordFailedAttempt(identifier: string, now = Date.now()): RateLimitResult {
  return accountIpLimiter.recordFailure(identifier, now);
}

export function resetRateLimit(identifier: string) {
  accountIpLimiter.reset(identifier);
}

export const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS,
  WINDOW_MS,
  LOCKOUT_MS,
} as const;

/** Layer 2: client IP across all accounts (password spraying). */
export const IP_RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 30,
  WINDOW_MS,
  LOCKOUT_MS,
} as const;

export const ipRateLimiter = createRateLimiter({
  maxAttempts: IP_RATE_LIMIT_CONFIG.MAX_ATTEMPTS,
  windowMs: IP_RATE_LIMIT_CONFIG.WINDOW_MS,
  lockoutMs: IP_RATE_LIMIT_CONFIG.LOCKOUT_MS,
});

/**
 * Layer 3: account-wide lockout stored in the database. Previously a hard
 * 15-minute lock after 4 failures, which let anyone who knew an email lock the
 * user out. Now: no lock below the threshold, then short escalating locks.
 */
export const ACCOUNT_LOCKOUT_CONFIG = {
  THRESHOLD: 10,
  BASE_MS: 60 * 1000, // 1 minute
  MAX_MS: 15 * 60 * 1000, // capped at 15 minutes
} as const;

export function computeAccountLockoutMs(failedAttempts: number): number {
  const { THRESHOLD, BASE_MS, MAX_MS } = ACCOUNT_LOCKOUT_CONFIG;
  if (failedAttempts < THRESHOLD) return 0;
  const exponent = Math.min(failedAttempts - THRESHOLD, 10);
  return Math.min(BASE_MS * 2 ** exponent, MAX_MS);
}

/** Super-admin platform login: IP + email, and IP across all emails. */
export const platformLoginLimiter = createRateLimiter({
  maxAttempts: MAX_ATTEMPTS,
  windowMs: WINDOW_MS,
  lockoutMs: LOCKOUT_MS,
});

/**
 * Public company-code lookup: failed lookups per IP. Codes are short
 * (CMP- + 4–8 chars), so unthrottled lookups would allow enumeration.
 */
export const COMPANY_LOOKUP_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 10,
  WINDOW_MS,
  LOCKOUT_MS,
} as const;

export const companyLookupLimiter = createRateLimiter({
  maxAttempts: COMPANY_LOOKUP_LIMIT_CONFIG.MAX_ATTEMPTS,
  windowMs: COMPANY_LOOKUP_LIMIT_CONFIG.WINDOW_MS,
  lockoutMs: COMPANY_LOOKUP_LIMIT_CONFIG.LOCKOUT_MS,
});

/** Idle-lock unlock attempts (2.8): 5 wrong passwords per user, then sign-out. */
export const sessionUnlockLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
});

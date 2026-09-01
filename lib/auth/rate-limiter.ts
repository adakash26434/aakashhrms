/**
 * In-memory rate limiter for brute-force protection on auth endpoints.
 *
 * Rationale: cPanel/Passenger shared hosting typically runs a single Node
 * process, so an in-memory Map is sufficient. It won't survive process
 * restarts, but that's acceptable — an attacker would need to restart the
 * process (which they can't) to reset the counter.
 *
 * For multi-process / multi-server deployments, swap this for a Redis-backed
 * limiter.
 */

type AttemptRecord = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout after 5 failures

const store = new Map<string, AttemptRecord>();

// Periodically purge expired entries to prevent memory leaks
const PURGE_INTERVAL_MS = 5 * 60 * 1000;
let lastPurge = Date.now();

function purgeExpired(now: number) {
  if (now - lastPurge < PURGE_INTERVAL_MS) return;
  lastPurge = now;
  for (const [key, record] of store) {
    if (now > record.lockedUntil && now - record.firstAttemptAt > WINDOW_MS) {
      store.delete(key);
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil: number | null;
};

export function checkRateLimit(identifier: string, now = Date.now()): RateLimitResult {
  purgeExpired(now);

  let record = store.get(identifier);

  // Initialize new record
  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    record = { count: 0, firstAttemptAt: now, lockedUntil: 0 };
    store.set(identifier, record);
  }

  // Check if currently locked out
  if (record.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.count),
    lockedUntil: null,
  };
}

export function recordFailedAttempt(identifier: string, now = Date.now()): RateLimitResult {
  purgeExpired(now);

  let record = store.get(identifier);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    record = { count: 0, firstAttemptAt: now, lockedUntil: 0 };
    store.set(identifier, record);
  }

  record.count++;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }

  store.set(identifier, record);

  if (record.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.count),
    lockedUntil: null,
  };
}

export function resetRateLimit(identifier: string) {
  store.delete(identifier);
}

export const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS,
  WINDOW_MS,
  LOCKOUT_MS,
} as const;

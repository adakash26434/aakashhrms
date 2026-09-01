import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  RATE_LIMIT_CONFIG,
} from '../lib/auth/rate-limiter';

// Control time to avoid flaky tests
let mockTime = 1000000000000;
const originalDateNow = Date.now;
Date.now = () => mockTime;

describe('Rate Limiter', () => {
  const identifier = '192.168.1.1:admin@example.com';

  beforeEach(() => {
    mockTime = 1000000000000;
    resetRateLimit(identifier);
  });

  describe('checkRateLimit', () => {
    it('allows first attempt with full remaining', () => {
      const result = checkRateLimit(identifier);
      assert.equal(result.allowed, true);
      assert.equal(result.remainingAttempts, 5);
      assert.equal(result.lockedUntil, null);
    });

    it('shows remaining attempts after failures', () => {
      recordFailedAttempt(identifier);
      recordFailedAttempt(identifier);

      const result = checkRateLimit(identifier);
      assert.equal(result.allowed, true);
      assert.equal(result.remainingAttempts, 3);
    });
  });

  describe('recordFailedAttempt', () => {
    it('locks after MAX_ATTEMPTS (5) failures', () => {
      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_ATTEMPTS; i++) {
        recordFailedAttempt(identifier);
      }

      const result = checkRateLimit(identifier);
      assert.equal(result.allowed, false);
      assert.equal(result.remainingAttempts, 0);
      assert.notEqual(result.lockedUntil, null);
      assert.ok((result.lockedUntil as number) > mockTime);
    });

    it('lockout lasts 15 minutes', () => {
      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_ATTEMPTS; i++) {
        recordFailedAttempt(identifier);
      }

      const lockedResult = checkRateLimit(identifier);
      assert.equal(lockedResult.allowed, false);
      assert.equal(lockedResult.lockedUntil, mockTime + RATE_LIMIT_CONFIG.LOCKOUT_MS);
    });

    it('allows access after lockout expires', () => {
      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_ATTEMPTS; i++) {
        recordFailedAttempt(identifier);
      }

      assert.equal(checkRateLimit(identifier).allowed, false);

      // Advance time past lockout
      mockTime += RATE_LIMIT_CONFIG.LOCKOUT_MS + 1;

      const result = checkRateLimit(identifier);
      assert.equal(result.allowed, true);
      assert.equal(result.remainingAttempts, 5);
    });
  });

  describe('resetRateLimit', () => {
    it('clears failed attempts on success', () => {
      recordFailedAttempt(identifier);
      recordFailedAttempt(identifier);
      recordFailedAttempt(identifier);

      resetRateLimit(identifier);

      const result = checkRateLimit(identifier);
      assert.equal(result.allowed, true);
      assert.equal(result.remainingAttempts, 5);
    });

    it('prevents lockout when called between failures', () => {
      for (let i = 0; i < 4; i++) {
        recordFailedAttempt(identifier);
      }
      resetRateLimit(identifier);

      recordFailedAttempt(identifier);
      assert.equal(checkRateLimit(identifier).allowed, true);
      assert.equal(checkRateLimit(identifier).remainingAttempts, 4);
    });
  });

  describe('independence between identifiers', () => {
    it('does not affect other IPs', () => {
      const attacker = '10.0.0.1:admin@example.com';
      const legit = '10.0.0.2:admin@example.com';

      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_ATTEMPTS; i++) {
        recordFailedAttempt(attacker);
      }

      assert.equal(checkRateLimit(attacker).allowed, false);
      assert.equal(checkRateLimit(legit).allowed, true);
    });

    it('different email from same IP is independent', () => {
      const ip = '10.0.0.1';
      const user1 = `${ip}:admin@example.com`;
      const user2 = `${ip}:hr@example.com`;

      for (let i = 0; i < RATE_LIMIT_CONFIG.MAX_ATTEMPTS; i++) {
        recordFailedAttempt(user1);
      }

      assert.equal(checkRateLimit(user1).allowed, false);
      assert.equal(checkRateLimit(user2).allowed, true);
    });
  });

  describe('window reset', () => {
    it('resets counter after 15-minute window expires', () => {
      recordFailedAttempt(identifier);
      recordFailedAttempt(identifier);

      mockTime += RATE_LIMIT_CONFIG.WINDOW_MS + 1;

      const result = checkRateLimit(identifier);
      assert.equal(result.allowed, true);
      assert.equal(result.remainingAttempts, 5);
    });
  });
});

// Restore Date.now after all tests
process.on('exit', () => {
  Date.now = originalDateNow;
});

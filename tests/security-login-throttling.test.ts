import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp } from '../lib/auth/client-ip';
import {
  createRateLimiter,
  computeAccountLockoutMs,
  ACCOUNT_LOCKOUT_CONFIG,
} from '../lib/auth/rate-limiter';
import { escapeHtml } from '../lib/utils/escape-html';

const h = (values: Record<string, string>) => ({ get: (k: string) => values[k.toLowerCase()] ?? null });

describe('Trusted client IP (S5)', () => {
  it('ignores client-forged left-most X-Forwarded-For entries', () => {
    // Client sent "1.1.1.1"; our proxy appended the real peer "203.0.113.9"
    assert.equal(getClientIp(h({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }), 1), '203.0.113.9');
  });

  it('a rotating forged prefix does not change the resolved IP', () => {
    const a = getClientIp(h({ 'x-forwarded-for': '9.9.9.1, 203.0.113.9' }), 1);
    const b = getClientIp(h({ 'x-forwarded-for': '9.9.9.2, 203.0.113.9' }), 1);
    assert.equal(a, b);
  });

  it('supports two trusted hops (e.g. Cloudflare + Apache)', () => {
    assert.equal(getClientIp(h({ 'x-forwarded-for': 'forged, 198.51.100.7, 172.16.0.1' }), 2), '198.51.100.7');
  });

  it('falls back to X-Real-IP, then unknown', () => {
    assert.equal(getClientIp(h({ 'x-real-ip': '198.51.100.8' }), 1), '198.51.100.8');
    assert.equal(getClientIp(h({}), 1), 'unknown');
    assert.equal(getClientIp(null, 1), 'unknown');
  });

  it('ignores forwarding headers entirely with zero trusted hops', () => {
    assert.equal(getClientIp(h({ 'x-forwarded-for': '1.1.1.1' }), 0), 'unknown');
  });
});

describe('Account lockout schedule (S5)', () => {
  it('does not lock below the threshold (old code locked after 4)', () => {
    for (let n = 1; n < ACCOUNT_LOCKOUT_CONFIG.THRESHOLD; n++) {
      assert.equal(computeAccountLockoutMs(n), 0, `attempt ${n}`);
    }
  });

  it('escalates 1, 2, 4, 8 minutes then caps at 15', () => {
    const t = ACCOUNT_LOCKOUT_CONFIG.THRESHOLD;
    assert.equal(computeAccountLockoutMs(t), 60_000);
    assert.equal(computeAccountLockoutMs(t + 1), 120_000);
    assert.equal(computeAccountLockoutMs(t + 2), 240_000);
    assert.equal(computeAccountLockoutMs(t + 3), 480_000);
    assert.equal(computeAccountLockoutMs(t + 4), 900_000);
    assert.equal(computeAccountLockoutMs(t + 50), 900_000);
  });
});

describe('Rate limiter factory', () => {
  it('blocks after maxAttempts and keeps the lock for its full duration', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 1000, lockoutMs: 10_000 });
    let now = 0;
    limiter.recordFailure('k', now);
    limiter.recordFailure('k', now);
    assert.equal(limiter.recordFailure('k', now).allowed, false);
    now = 1500; // window elapsed, but the lock has not
    assert.equal(limiter.check('k', now).allowed, false);
    now = 10_001;
    assert.equal(limiter.check('k', now).allowed, true);
  });

  it('keeps separate keys independent', () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 1000, lockoutMs: 1000 });
    limiter.recordFailure('a', 0);
    assert.equal(limiter.check('a', 0).allowed, false);
    assert.equal(limiter.check('b', 0).allowed, true);
  });
});

describe('HTML escaping for emails (S10)', () => {
  it('neutralises tags, attributes and quotes', () => {
    assert.equal(
      escapeHtml(`<a href="https://evil.example">Pay now</a> & 'x'`),
      '&lt;a href=&quot;https://evil.example&quot;&gt;Pay now&lt;/a&gt; &amp; &#39;x&#39;'
    );
  });

  it('handles null and numbers', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(42), '42');
  });
});

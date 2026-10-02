import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPlatformSigningSecret, validateSecurityConfig } from '../lib/security/secrets';

const strong = (c: string) => c.repeat(40);

describe('Platform signing secret (rule 8)', () => {
  it('uses the dedicated PLATFORM_SESSION_SECRET', () => {
    assert.equal(
      getPlatformSigningSecret({ NODE_ENV: 'production', PLATFORM_SESSION_SECRET: strong('p'), AUTH_SECRET: strong('a') }),
      strong('p')
    );
  });

  it('refuses to fall back to other secrets in production', () => {
    assert.throws(
      () => getPlatformSigningSecret({ NODE_ENV: 'production', AUTH_SECRET: strong('a'), PLATFORM_SECRETS_KEY: strong('k') }),
      /PLATFORM_SESSION_SECRET is not configured/
    );
  });

  it('refuses a platform secret shared with AUTH_SECRET in production', () => {
    assert.throws(
      () => getPlatformSigningSecret({ NODE_ENV: 'production', AUTH_SECRET: strong('a'), PLATFORM_SESSION_SECRET: strong('a') }),
      /must be different/
    );
  });

  it('falls back in development so local setups keep working', () => {
    assert.equal(getPlatformSigningSecret({ NODE_ENV: 'development', AUTH_SECRET: strong('a') }), strong('a'));
  });
});

describe('Security config validation', () => {
  it('passes a well-formed production config', () => {
    const issues = validateSecurityConfig({
      NODE_ENV: 'production',
      AUTH_SECRET: strong('a'),
      PLATFORM_SESSION_SECRET: strong('p'),
      PLATFORM_SECRETS_KEY: strong('k'),
      FORCE_SSL: 'true',
    });
    assert.deepEqual(issues, []);
  });

  it('flags missing, short and shared secrets as errors in production', () => {
    const issues = validateSecurityConfig({
      NODE_ENV: 'production',
      AUTH_SECRET: 'short',
      PLATFORM_SECRETS_KEY: 'short',
      FORCE_SSL: 'true',
    });
    const messages = issues.filter((i) => i.level === 'error').map((i) => i.message).join(' | ');
    assert.match(messages, /AUTH_SECRET is shorter/);
    assert.match(messages, /PLATFORM_SESSION_SECRET is not set/);
    assert.match(messages, /must not share the same value/);
  });

  it('only warns in development', () => {
    const issues = validateSecurityConfig({ NODE_ENV: 'development', AUTH_SECRET: strong('a'), SINGLE_TENANT_MODE: 'true' });
    assert.ok(issues.every((i) => i.level === 'warning'));
  });
});

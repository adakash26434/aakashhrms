import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authConfig } from '../lib/auth/auth.config';

type AuthorizedArgs = Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0];

function callAuthorized(path: string, opts: { user?: Record<string, unknown> | null; cookies?: Record<string, string> } = {}) {
  const cookies = opts.cookies ?? {};
  const request = {
    nextUrl: new URL(`http://localhost${path}`),
    cookies: { get: (name: string) => (name in cookies ? { name, value: cookies[name] } : undefined) },
  };
  const auth = opts.user ? { user: opts.user, expires: '2099-01-01' } : null;
  return authConfig.callbacks.authorized({ auth, request } as unknown as AuthorizedArgs);
}

describe('Route guard (S1)', () => {
  it('blocks anonymous access to the dashboard', async () => {
    assert.equal(await callAuthorized('/dashboard'), false);
  });

  it('does not treat a forged impersonation cookie as authentication', async () => {
    const result = await callAuthorized('/dashboard', {
      cookies: { platform_impersonation: 'forged.token.value' },
    });
    assert.equal(result, false);
  });

  it('does not let a forged impersonation cookie reach payroll pages', async () => {
    const result = await callAuthorized('/payroll/generate', {
      cookies: { platform_impersonation: 'anything' },
    });
    assert.equal(result, false);
  });

  it('allows an authenticated admin user', async () => {
    const result = await callAuthorized('/dashboard', {
      user: { id: 'u1', scopeType: 'GLOBAL', mustChangePassword: false },
    });
    assert.equal(result, true);
  });

  it('confines SELF-scoped users to self-service', async () => {
    const result = await callAuthorized('/payroll/generate', {
      user: { id: 'u2', scopeType: 'SELF', mustChangePassword: false },
    });
    assert.ok(result instanceof Response);
    assert.equal(new URL((result as Response).headers.get('location')!).pathname, '/self-service');
  });

  it('forces a password change before anything else', async () => {
    const result = await callAuthorized('/dashboard', {
      user: { id: 'u3', scopeType: 'GLOBAL', mustChangePassword: true },
    });
    assert.ok(result instanceof Response);
    assert.equal(new URL((result as Response).headers.get('location')!).pathname, '/change-password');
  });

  it('keeps the public homepage and login reachable when anonymous', async () => {
    assert.equal(await callAuthorized('/'), true);
    assert.equal(await callAuthorized('/login'), true);
  });
});

describe('Session lifetime (S4)', () => {
  it('expires sessions within 8 hours instead of the 30-day default', () => {
    assert.ok(authConfig.session?.maxAge !== undefined);
    assert.ok(authConfig.session.maxAge <= 8 * 60 * 60);
  });

  it('refreshes the JWT at least every 15 minutes while in use', () => {
    assert.ok(authConfig.session?.updateAge !== undefined);
    assert.ok(authConfig.session.updateAge <= 15 * 60);
  });
});

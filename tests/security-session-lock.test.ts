import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applySessionUpdate,
  assertSessionUsable,
  signSessionGrant,
  verifySessionGrant,
  type LockableToken,
} from '../lib/auth/session-updates';
import { safeReturnTo } from '../lib/frame/return-to';
import { authConfig } from '../lib/auth/auth.config';

const SECRET = 'test-secret-for-session-grants-0123456789abcdef';
const root = join(__dirname, '..');
const source = (f: string) => readFileSync(join(root, f), 'utf8');

before(() => {
  process.env.AUTH_SECRET = SECRET;
});

describe('Signed session grants (S14)', () => {
  const opts = { secret: SECRET };

  it('verifies a grant for the same user, purpose and context', async () => {
    const grant = await signSessionGrant('u1', 'unlock', '123', opts);
    assert.equal(await verifySessionGrant(grant, { userId: 'u1', purpose: 'unlock', context: '123' }, opts), true);
  });

  it('rejects another user, purpose or context', async () => {
    const grant = await signSessionGrant('u1', 'unlock', '123', opts);
    assert.equal(await verifySessionGrant(grant, { userId: 'u2', purpose: 'unlock', context: '123' }, opts), false);
    assert.equal(await verifySessionGrant(grant, { userId: 'u1', purpose: 'password-changed', context: '123' }, opts), false);
    assert.equal(await verifySessionGrant(grant, { userId: 'u1', purpose: 'unlock', context: '999' }, opts), false);
  });

  it('rejects tampered, expired, far-future and foreign-key grants', async () => {
    const now = 1_000_000;
    const grant = await signSessionGrant('u1', 'password-changed', '', { ...opts, now });
    const expect = { userId: 'u1', purpose: 'password-changed' as const };
    assert.equal(await verifySessionGrant({ ...grant, sig: grant.sig.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }, expect, { ...opts, now }), false);
    assert.equal(await verifySessionGrant(grant, expect, { ...opts, now: now + 61_000 }), false);
    assert.equal(await verifySessionGrant({ ...grant, exp: now + 10 * 60_000 }, expect, { ...opts, now }), false);
    assert.equal(await verifySessionGrant(grant, expect, { secret: 'another-secret-another-secret-123', now }), false);
    assert.equal(await verifySessionGrant('nonsense', expect, opts), false);
  });
});

describe('Session updates from the browser (S14)', () => {
  const opts = { secret: SECRET };

  it('ignores a browser attempt to clear the forced password change', async () => {
    const token: LockableToken = { id: 'u1', mustChangePassword: true };
    await applySessionUpdate(token, { user: { mustChangePassword: false } }, opts);
    assert.equal(token.mustChangePassword, true);
  });

  it('ignores a forged grant', async () => {
    const token: LockableToken = { id: 'u1', mustChangePassword: true };
    await applySessionUpdate(token, { grant: { userId: 'u1', purpose: 'password-changed', context: '', exp: Date.now() + 1000, sig: 'ab' } }, opts);
    assert.equal(token.mustChangePassword, true);
  });

  it('clears the flag with a server-signed password-changed grant', async () => {
    const token: LockableToken = { id: 'u1', mustChangePassword: true };
    await applySessionUpdate(token, { grant: await signSessionGrant('u1', 'password-changed', '', opts) }, opts);
    assert.equal(token.mustChangePassword, false);
  });

  it('lets anyone lock, but only a grant for this lock can unlock', async () => {
    const token: LockableToken = { id: 'u1' };
    await applySessionUpdate(token, { lock: true }, { ...opts, now: 5000 });
    assert.equal(token.locked, true);
    assert.equal(token.lockedAt, 5000);

    await applySessionUpdate(token, { locked: false, lock: false }, opts);
    assert.equal(token.locked, true, 'plain payloads cannot unlock');

    const stale = await signSessionGrant('u1', 'unlock', '4000', opts);
    await applySessionUpdate(token, { grant: stale }, opts);
    assert.equal(token.locked, true, 'a grant for an earlier lock cannot unlock');

    await applySessionUpdate(token, { grant: await signSessionGrant('u1', 'unlock', '5000', opts) }, opts);
    assert.equal(token.locked, false);
    assert.equal(token.lockedAt, undefined);
  });

  it('is wired into the NextAuth jwt() callback', async () => {
    const jwt = authConfig.callbacks.jwt as unknown as (args: Record<string, unknown>) => Promise<LockableToken>;
    const forged = await jwt({ token: { id: 'u1', mustChangePassword: true }, trigger: 'update', session: { user: { mustChangePassword: false } } });
    assert.equal(forged.mustChangePassword, true);
    const locked = await jwt({ token: { id: 'u1' }, trigger: 'update', session: { lock: true } });
    assert.equal(locked.locked, true);
  });
});

describe('Idle lock enforcement (2.8)', () => {
  type AuthorizedArgs = Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0];
  const call = (path: string, user: Record<string, unknown>) =>
    authConfig.callbacks.authorized({
      auth: { user, expires: '2099-01-01' },
      request: { nextUrl: new URL(`http://localhost${path}`), cookies: { get: () => undefined } },
    } as unknown as AuthorizedArgs);

  it('sends a locked session to /locked with a return path', async () => {
    const result = await call('/payroll/review', { id: 'u1', scopeType: 'GLOBAL', locked: true });
    assert.ok(result instanceof Response);
    const location = new URL((result as Response).headers.get('location')!);
    assert.equal(location.pathname, '/locked');
    assert.equal(location.searchParams.get('returnTo'), '/payroll/review');
  });

  it('allows /locked while locked and leaves it once unlocked', async () => {
    assert.equal(await call('/locked', { id: 'u1', scopeType: 'GLOBAL', locked: true }), true);
    const result = await call('/locked', { id: 'u1', scopeType: 'GLOBAL', locked: false });
    assert.equal(new URL((result as Response).headers.get('location')!).pathname, '/dashboard');
  });

  it('refuses server actions from a locked or password-pending session', () => {
    assert.throws(() => assertSessionUsable({ locked: true }), /locked/);
    assert.throws(() => assertSessionUsable({ mustChangePassword: true }), /Password change/);
    assert.doesNotThrow(() => assertSessionUsable({ locked: false, mustChangePassword: false }));
  });

  it('applies that guard in every permission helper and self-service', () => {
    const perms = source('lib/auth/check-permission.ts');
    assert.equal(perms.match(/assertSessionUsable\(session\.user\)/g)?.length, 2);
    assert.match(source('lib/services/self-service.service.ts'), /assertSessionUsable\(session\.user\)/);
  });

  it('clears the forced password change only through a signed grant', () => {
    const action = source('app/actions/change-password.actions.ts');
    assert.match(action, /signSessionGrant\(userId, 'password-changed'\)/);
    assert.ok(!/unstable_update\(\{\s*user:/.test(action));
  });

  it('throttles unlock attempts and signs out after too many', () => {
    const action = source('app/actions/session-lock.actions.ts');
    assert.match(action, /sessionUnlockLimiter\.check\(userId\)/);
    assert.match(action, /sessionUnlockLimiter\.recordFailure\(userId\)/);
    assert.match(action, /signOut\(/);
    assert.match(action, /bcrypt\.compare/);
  });
});

describe('Idle lock policy', () => {
  it('locks after 30 minutes, within the NIST AAL2 one-hour ceiling, with a 2-minute warning', async () => {
    const policy = await import('../lib/frame/session-policy');
    assert.equal(policy.IDLE_LOCK_MINUTES, 30);
    assert.ok(policy.IDLE_LOCK_MS <= 60 * 60 * 1000);
    assert.ok(policy.IDLE_WARNING_MS < policy.IDLE_LOCK_MS);
    assert.match(source('components/frame/use-idle-lock.ts'), /from "@\/lib\/frame\/session-policy"/);
  });
});

describe('Return path validation (open redirect)', () => {
  it('accepts same-origin paths only', () => {
    assert.equal(safeReturnTo('/payroll/review'), '/payroll/review');
    assert.equal(safeReturnTo('/workforce/employees?q=EMP-001'), '/workforce/employees?q=EMP-001');
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/locked', '/login', '/a\nb', '', 42]) {
      assert.equal(safeReturnTo(bad), '/dashboard', String(bad));
    }
  });
});

describe('Frame data exposure (S15, palette)', () => {
  it('counts pending approvals only for approvers, within their scope', () => {
    const svc = source('lib/services/workspace-context.service.ts');
    assert.match(svc, /allowedModules\.includes\('LEAVE_APPROVALS'\)/);
    assert.match(svc, /buildEmployeeIdScopeCondition\(scope, leaveApplications\.employeeId\)/);
  });

  it('palette employee search checks permission, scope and returns display fields only', () => {
    const action = source('app/actions/command-palette.actions.ts');
    assert.match(action, /checkPermissionWithScope\('VIEW', 'EMPLOYEES'\)/);
    assert.match(action, /buildEmployeeScopeCondition\(scope\)/);
    const repo = source('lib/repositories/employee.repository.ts');
    const quick = repo.slice(repo.indexOf('export async function quickSearch'), repo.indexOf('export async function findAll'));
    assert.ok(quick.length > 0);
    assert.ok(!/employeePersonal|employeeBank|pan|account|salary|mobile|email/i.test(quick.replace(/\/\*\*[\s\S]*?\*\//g, '')));
  });
});

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { getScriptNonceFromHeader } from 'next/dist/server/app-render/get-script-nonce-from-header';
import {
  API_CONTENT_SECURITY_POLICY,
  buildContentSecurityPolicy,
  generateCspNonce,
} from '../lib/security/csp';

const root = join(__dirname, '..');
const source = (file: string) => readFileSync(join(root, file), 'utf8');

function directive(policy: string, name: string): string[] {
  const found = policy.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  assert.ok(found, `missing ${name}`);
  return found!.split(/\s+/).slice(1);
}

describe('Content-Security-Policy builder (S6)', () => {
  const nonce = generateCspNonce();
  const prod = buildContentSecurityPolicy({ nonce });

  it('generates unpredictable 128-bit nonces', () => {
    const nonces = new Set(Array.from({ length: 200 }, () => generateCspNonce()));
    assert.equal(nonces.size, 200);
    assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
  });

  it('locks scripts to the nonce with strict-dynamic and no inline/eval in production', () => {
    const script = directive(prod, 'script-src');
    assert.ok(script.includes(`'nonce-${nonce}'`));
    assert.ok(script.includes("'strict-dynamic'"));
    assert.ok(!script.includes("'unsafe-inline'"));
    assert.ok(!script.includes("'unsafe-eval'"));
  });

  it('allows eval only in development', () => {
    const dev = buildContentSecurityPolicy({ nonce, isDev: true });
    assert.ok(directive(dev, 'script-src').includes("'unsafe-eval'"));
  });

  it('never puts a nonce in style-src (it would disable unsafe-inline for style attributes)', () => {
    const style = directive(prod, 'style-src');
    assert.ok(style.every((s) => !s.startsWith("'nonce-")));
    assert.ok(style.includes("'unsafe-inline'"));
  });

  it('blocks plugins, framing, base hijacking and off-site form posts', () => {
    assert.deepEqual(directive(prod, 'object-src'), ["'none'"]);
    assert.deepEqual(directive(prod, 'frame-ancestors'), ["'none'"]);
    assert.deepEqual(directive(prod, 'base-uri'), ["'self'"]);
    assert.deepEqual(directive(prod, 'form-action'), ["'self'"]);
    assert.deepEqual(directive(prod, 'default-src'), ["'self'"]);
  });

  it('loads fonts and styles from this origin only (no Google Fonts at runtime)', () => {
    assert.ok(!prod.includes('googleapis'));
    assert.ok(!prod.includes('gstatic'));
    assert.deepEqual(directive(prod, 'font-src'), ["'self'", 'data:']);
  });

  it('adds upgrade-insecure-requests only when asked', () => {
    assert.ok(!prod.includes('upgrade-insecure-requests'));
    assert.ok(buildContentSecurityPolicy({ nonce, upgradeInsecureRequests: true }).endsWith('upgrade-insecure-requests'));
  });

  it('produces a header Next.js can read the nonce from', () => {
    assert.equal(getScriptNonceFromHeader(prod), nonce);
  });

  it('rejects malformed nonces instead of emitting a broken policy', () => {
    assert.throws(() => buildContentSecurityPolicy({ nonce: "abc'; script-src *" }));
  });

  it('gives API responses a deny-all policy', () => {
    assert.match(API_CONTENT_SECURITY_POLICY, /default-src 'none'/);
    assert.match(API_CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  });
});

describe('Security headers configuration (S6)', () => {
  const config = source('next.config.ts');
  const app = source('app/layout.tsx');
  const css = source('app/globals.css');

  it('drops the deprecated X-XSS-Protection header', () => {
    assert.ok(!config.includes('X-XSS-Protection'));
  });

  it('does not set a second page CSP in next.config (it would void the nonce)', () => {
    const catchAll = config.slice(config.indexOf('source: "/(.*)"'), config.indexOf('source: "/api/:path*"'));
    assert.ok(!catchAll.includes('Content-Security-Policy'));
  });

  it('hides the X-Powered-By header', () => {
    assert.match(config, /poweredByHeader:\s*false/);
  });

  it('loads no fonts or styles from Google at runtime', () => {
    assert.ok(!app.includes('fonts.googleapis.com'));
    assert.ok(!css.includes('fonts.googleapis.com'));
  });
});

describe('Proxy request headers (S6 + S13)', () => {
  let middleware: (request: NextRequest) => Promise<Response>;

  before(async () => {
    process.env.AUTH_SECRET ??= 'test-secret-for-proxy-header-tests-0123456789';
    middleware = (await import('../proxy')).default;
  });

  function request(path: string, headers: Record<string, string> = {}) {
    return new NextRequest(new URL(`http://localhost${path}`), { headers });
  }

  it('sends the CSP on the response and forwards the same nonce to the renderer', async () => {
    const response = await middleware(request('/login'));
    const policy = response.headers.get('content-security-policy');
    assert.ok(policy, 'response CSP missing');
    const forwarded = response.headers.get('x-middleware-request-content-security-policy');
    assert.equal(forwarded, policy);
    assert.equal(response.headers.get('x-middleware-request-x-nonce'), getScriptNonceFromHeader(policy!));
  });

  it('uses a fresh nonce for every request', async () => {
    const a = (await middleware(request('/login'))).headers.get('content-security-policy');
    const b = (await middleware(request('/login'))).headers.get('content-security-policy');
    assert.notEqual(getScriptNonceFromHeader(a!), getScriptNonceFromHeader(b!));
  });

  it('strips a client-supplied x-tenant-slug on routes that go through NextAuth', async () => {
    const response = await middleware(request('/login', { 'x-tenant-slug': 'other-company' }));
    assert.equal(response.headers.get('x-middleware-next'), '1');
    const overridden = (response.headers.get('x-middleware-override-headers') ?? '').split(',');
    assert.ok(overridden.includes('x-pathname'), 'request header overrides were dropped');
    assert.ok(!overridden.includes('x-tenant-slug'));
    assert.equal(response.headers.get('x-middleware-request-x-tenant-slug'), null);
  });

  it('keeps the CSP on redirects to the login page', async () => {
    const response = await middleware(request('/dashboard'));
    assert.ok([302, 303, 307].includes(response.status));
    assert.ok(response.headers.get('content-security-policy'));
  });
});

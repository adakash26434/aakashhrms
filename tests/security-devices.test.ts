import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S30 attendance devices (G3): the /iclock endpoints trust only a registered,
// enabled serial (bare 404 otherwise) and cap the body before reading it;
// punches are idempotent raw data (the 4.5 day engine and HR review decide
// attendance); the management screen sits under ATTENDANCE with the employee
// scope on PIN mapping; the serial → tenant cache is re-verified inside the
// tenant on every request.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const cdata = read('app/iclock/cdata/route.ts');
const getrequest = read('app/iclock/getrequest/route.ts');
const tenant = read('lib/services/device-tenant.ts');
const service = read('lib/services/device.service.ts');
const repo = read('lib/repositories/device.repository.ts');
const actions = read('app/actions/device.actions.ts');
const proxy = read('proxy.ts');
const page = read('app/(dashboard)/timeAndLeave/devices/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S30 iclock endpoints', () => {
  it('proxy.ts skips /iclock so the handlers own their checks (like /api)', () => {
    assert.match(proxy, /\(\?!api\|iclock\|/);
  });

  it('unknown, malformed or disabled serials get a bare 404', () => {
    assert.match(cdata, /result === null \? NOT_FOUND\(\)|if \(result === null\) return NOT_FOUND\(\);/);
    assert.match(getrequest, /status: 404/);
    assert.match(body(tenant, 'export async function resolveDeviceTenantAndRun'), /isValidSerial\(serialNo\)/);
    assert.match(body(service, 'export async function devicePush('), /!device \|\| !device\.enabled/);
  });

  it('caps the declared and actual body size before parsing', () => {
    const post = body(cdata, 'export async function POST(');
    const declared = post.indexOf('content-length');
    const text = post.indexOf('request.text()');
    assert.ok(declared >= 0 && declared < text, 'declared size checked before reading');
    assert.match(post, /body\.length > MAX_BODY/);
  });

  it('device routes never touch sessions or permissions — they are serial-gated only', () => {
    for (const src of [cdata, getrequest]) {
      assert.ok(!src.includes('checkPermission') && !src.includes('auth('), 'no session machinery');
      assert.match(src, /resolveDeviceTenantAndRun/);
    }
  });

  it('the serial → tenant cache is re-verified inside the tenant on every request', () => {
    // The handler re-reads the device row in that tenant; a stale entry re-resolves once.
    assert.match(tenant, /serialTenantCache\.delete\(serialNo\)/);
    assert.match(service, /repo\.findDeviceBySerial\(serialNo\)/);
  });
});

describe('S30 punches are idempotent raw data', () => {
  it('device punches land with source device and conflict-ignore on the unique key', () => {
    const insert = body(repo, 'export async function insertDevicePunches(');
    assert.match(insert, /source: 'device'/);
    assert.match(insert, /onConflictDoNothing/);
  });

  it('mapping a PIN claims waiting punches and clears the holding rows in one transaction', () => {
    const claim = body(repo, 'export async function mapPinAndClaimTx(');
    assert.match(claim, /db\.transaction/);
    const insert = claim.indexOf('insert(attendancePunches)');
    const cleanup = claim.indexOf('delete(deviceUnmatchedPunches)');
    assert.ok(insert >= 0 && insert < cleanup, 'claim before cleanup');
  });

  it('non-ATTLOG tables are acknowledged, never stored', () => {
    const push = body(service, 'export async function devicePush(');
    assert.match(push, /!== 'ATTLOG'/);
  });
});

describe('S30 management screen', () => {
  it('the page and every action check ATTENDANCE in tenant context', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "ATTENDANCE"\)/);
    for (const fn of actions.match(/export async function \w+/g) ?? []) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /deviceCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'ATTENDANCE'\)/);
  });

  it('mapping a PIN only accepts employees within the caller scope', () => {
    const map = body(service, 'export async function mapPin(');
    assert.match(map, /buildEmployeeScopeCondition\(ctx\.scope\)/);
  });

  it('no server action feeds punches without a device: imports reuse the serial-gated pipeline', () => {
    const importFn = body(service, 'export async function importPunchLines(');
    assert.match(importFn, /devicePush\(device\.serialNo, 'ATTLOG'/);
  });
});

describe('S30 devices: unknown serials cannot fan out across tenants', () => {
  it('misses are cached (bounded) before any company database is scanned', () => {
    const src = readFileSync(join(__dirname, '..', 'lib/services/device-tenant.ts'), 'utf8');
    assert.match(src, /MISS_MAX/);
    assert.ok(src.indexOf('recentlyMissed(serialNo)') < src.indexOf('platformDb.select'), 'miss check before the scan');
    assert.match(src, /rememberMiss\(serialNo\)/);
  });
});

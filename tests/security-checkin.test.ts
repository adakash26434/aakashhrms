import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Security plan S23 (4.5c web clock-in): the employee is the signed-in user
// only, the time is the server's, the IP is the trusted-proxy one, the
// distance is worked out on the server, clocking is rate limited, platform
// support never clocks in, remote clock-ins wait for someone else, closed
// months are refused, and settings are a company-wide, audited control.

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const actions = read('app/actions/checkin.actions.ts');
const service = read('lib/services/checkin.service.ts');
const attendance = read('lib/services/attendance.service.ts');

const fnBody = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, name);
  const next = src.indexOf('\nexport async function', start + 10);
  return next > 0 ? src.slice(start, next) : src.slice(start);
};

describe('S23: who clocks in', () => {
  it('the employee comes from the session only, never from the request; never platform support', () => {
    const me = actions.slice(actions.indexOf('async function me()'), actions.indexOf('export async function clockStatusAction'));
    assert.match(me, /getImpersonationSession\(\)/);
    assert.match(me, /getSessionEmployeeId\(\)/);
    for (const name of ['clockAction', 'clockStatusAction']) {
      const fn = fnBody(actions, name);
      assert.match(fn, /await me\(\)/, name);
      assert.doesNotMatch(fn, /input\)?\.employeeId|input as \{ employeeId/, name);
    }
    // The service takes the employee as a separate argument from the request body.
    assert.match(service, /export async function clock\(employeeId: string, raw: unknown,/);
    assert.doesNotMatch(fnBody(service, 'clock'), /r\.employeeId|raw\.employeeId/);
  });
  it('the session lookup re-checks the account (active, linked to an employee)', () => {
    const ss = read('lib/services/self-service.service.ts');
    assert.match(ss, /export async function getSessionEmployeeId/);
    assert.match(ss, /!account \|\| !account\.isActive/);
  });
});

describe('S23: when and where', () => {
  it('server time, trusted-proxy IP, rate limit', () => {
    const fn = fnBody(actions, 'clockAction');
    assert.match(fn, /getClientIp\(await headers\(\)\)/);
    assert.match(fn, /clockLimiter\.check\(key\)/);
    assert.match(fn, /clockLimiter\.recordFailure\(key\)/);
    const clock = fnBody(service, 'clock');
    assert.match(clock, /const now = new Date\(\)\.toISOString\(\)/);
    assert.doesNotMatch(clock, /r\.(time|at|punchedAt)/);
  });
  it('the server decides in / out, the place and the distance; a status from the browser is ignored', () => {
    const clock = fnBody(service, 'clock');
    assert.match(clock, /parseLocation\(r\.location\)/);
    assert.match(clock, /decideClock\(\{/);
    assert.match(clock, /const kind = status\.next/);
    assert.doesNotMatch(clock, /r\.(kind|distance|inside|outcome)/);
  });
  it('double taps, closed months and not-employed days are refused', () => {
    assert.match(fnBody(service, 'clock'), /MIN_GAP_SECONDS \* 1000/);
    const status = fnBody(service, 'clockStatus');
    assert.match(status, /findClosedPeriodsOverlapping\(date, date\)/);
    assert.match(status, /not_employed/);
    assert.match(status, /webCheckIn\.enabled/);
  });
});

describe('S23: outside the office', () => {
  it('nothing is saved until the employee confirms with a reason; then it waits for approval', () => {
    const clock = fnBody(service, 'clock');
    assert.match(clock, /if \(r\.remote !== true\) return \{ outcome: "remote_needed"/);
    assert.match(clock, /reason\.length < 3/);
    assert.match(clock, /kind: kind === "in" \? "remote_in" : "remote_out"/);
  });
  it('approval follows the adjustment rules (never your own) and adds the web punch with its place', () => {
    const decide = fnBody(attendance, 'decideAdjustment');
    assert.match(decide, /OwnAttendanceError/);
    assert.match(decide, /source: "web" as const, ip: a\.ip/);
  });
  it('the allowed-anywhere list cannot include yourself', () => {
    assert.match(fnBody(service, 'addException'), /ctx\.myEmployeeId === employeeId/);
  });
});

describe('S23: settings', () => {
  it('branch rules and the anywhere list are a company-wide control, audited', () => {
    const control = actions.slice(actions.indexOf('async function companyControl'), actions.indexOf('export async function saveBranchCheckinAction'));
    assert.match(control, /checkPermissionWithScope\('EDIT', 'ATTENDANCE'\)/);
    assert.match(control, /scope\.scopeType !== 'GLOBAL'/);
    assert.match(control, /scope\.isImpersonation/);
    for (const name of ['saveBranchCheckinAction', 'addCheckinExceptionAction', 'removeCheckinExceptionAction']) {
      const fn = fnBody(actions, name);
      assert.match(fn, /await companyControl\(\)/, name);
      assert.match(fn, /recordAuditLog\(/, name);
    }
    for (const line of actions.split(/\r?\n/).filter((l) => l.includes('error.message'))) assert.match(line, /UserFacingError/, line);
  });
  it('networks are validated before saving; web clock-in is off until switched on', () => {
    assert.match(fnBody(service, 'saveBranch'), /parseNetwork\(n\)/);
    assert.match(attendance, /webCheckIn: \{ enabled: stored\.webCheckIn\?\.enabled === true \}/);
    assert.match(read('lib/db/migrations/0041_web_checkin.sql'), /"checkin_rule" varchar\(24\) DEFAULT 'off'/);
  });
});

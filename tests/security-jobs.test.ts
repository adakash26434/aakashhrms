import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S29 scheduled jobs (G6): the tick endpoint is secret-gated (constant-time,
// 404 on failure, counts-only response); the once-per-day claim is atomic so
// overlapping ticks never double-run; every tenant runs in its own context
// and its own try/catch; the status screen sits under SYSTEM_CONTROL and no
// server action can run jobs from a browser session; reminder emails carry
// names and dates, never pay figures.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const route = read('app/api/jobs/tick/route.ts');
const actions = read('app/actions/jobs.actions.ts');
const service = read('lib/services/jobs.service.ts');
const repo = read('lib/repositories/jobs.repository.ts');
const page = read('app/(dashboard)/admin/jobs/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S29 jobs tick endpoint', () => {
  it('compares the bearer secret constant-time and requires 24+ characters', () => {
    const auth = body(route, 'function authorized(');
    assert.match(auth, /timingSafeEqual/);
    assert.match(auth, /secret\.length < 24/);
    assert.match(auth, /return false/);
  });

  it('refuses with a bare 404 before any platform or tenant work', () => {
    const tick = body(route, 'async function tick(');
    const guard = tick.indexOf('authorized(request)');
    const platform = tick.indexOf('platformDb');
    assert.ok(guard >= 0 && guard < platform, 'auth before tenant iteration');
    assert.match(tick, /status: 404/);
  });

  it('each tenant runs in its own context and its own try/catch; the response is counts only', () => {
    const tick = body(route, 'async function tick(');
    assert.match(tick, /runWithTenantContext\(\{ tenantSlug: company\.slug, db \}/);
    assert.match(tick, /catch \(error\)/);
    assert.match(tick, /NextResponse\.json\(totals/);
    assert.ok(!/NextResponse\.json\([^)]*slug/.test(tick), 'no tenant identifiers in the response');
  });
});

describe('S29 jobs idempotency', () => {
  it('the day claim is one atomic update on enabled + not-today', () => {
    const claim = body(repo, 'export async function claimJob(');
    assert.match(claim, /eq\(scheduledJobs\.enabled, true\)/);
    assert.match(claim, /ne\(scheduledJobs\.lastRunDay, today\)/);
    assert.match(claim, /returning/);
  });

  it('the service claims before working, and one failing job never stops the rest', () => {
    const run = body(service, 'export async function runDueJobsForTenant(');
    const claim = run.indexOf('claimJob(def.code, today)');
    const work = run.indexOf('runJob(def');
    assert.ok(claim >= 0 && claim < work, 'claim before work');
    assert.match(run, /catch \(error: unknown\)/);
    assert.match(run, /summary\.errors\.push/);
  });
});

describe('S29 jobs permissions and content', () => {
  it('the status screen and both actions check SYSTEM_CONTROL in tenant context', () => {
    assert.match(page, /checkPermission\("VIEW", "SYSTEM_CONTROL"\)/);
    for (const fn of actions.match(/export async function \w+/g) ?? []) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /checkPermission\('(VIEW|EDIT)', 'SYSTEM_CONTROL'\)/, `${fn} checks permission`);
    }
  });

  it('no server action can run jobs; only the secret-gated route does', () => {
    assert.ok(!actions.includes('runDueJobsForTenant'), 'actions never run jobs');
    assert.match(route, /runDueJobsForTenant/);
  });

  it('reminder emails carry no pay figures (the service never touches payroll or salary modules)', () => {
    assert.ok(!/payroll|salary-structure|payslip/i.test(service), 'no payroll imports or fields');
    const email = read('lib/services/email.service.ts');
    assert.match(email, /escapeHtml\(line\)/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S33 welfare funds (G9): every action checks WELFARE_FUNDS inside the tenant
// context; the ledger is append-only (the repository has no update or delete
// on fund_ledger); payouts are capped per share before any insert; nobody
// posts to their own fund (audited DENIED_SELF); monthly contributions are
// idempotent by ref and posted only by the BS-day-1 job, never by a browser
// action.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const actions = read('app/actions/fund.actions.ts');
const service = read('lib/services/fund.service.ts');
const repo = read('lib/repositories/fund.repository.ts');
const jobs = read('lib/services/jobs.service.ts');
const scheduler = read('lib/engines/scheduler.engine.ts');
const page = read('app/(dashboard)/payroll/funds/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S33 funds: permission and tenant context', () => {
  it('every action resolves the tenant and checks WELFARE_FUNDS', () => {
    const exported = actions.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 4, 'actions exist');
    for (const fn of exported) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /fundCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'WELFARE_FUNDS'\)/);
  });

  it('the page checks permission before loading data', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "WELFARE_FUNDS"\)/);
    assert.ok(page.indexOf('checkPermissionWithScope') < page.indexOf('fundsPage('), 'permission before data');
  });
});

describe('S33 funds: append-only ledger', () => {
  it('the repository never updates or deletes ledger lines', () => {
    assert.ok(!repo.includes('.update(fundLedger)'), 'no updates');
    assert.ok(!repo.includes('.delete(fundLedger)'), 'no deletes');
    assert.match(body(repo, 'export async function postLines('), /onConflictDoNothing/);
  });

  it('a fund type\'s code never changes once created (refs embed it)', () => {
    const update = body(repo, 'export async function updateFundType(');
    assert.ok(!/code\s*:/.test(update.slice(update.indexOf('.set('))), 'code not in the update set');
  });
});

describe('S33 funds: posting rules', () => {
  it('payouts are validated against the balance before any insert', () => {
    const post = body(service, 'export async function postFundEntry(');
    const balance = post.indexOf('memberBalance(');
    const validate = post.indexOf('validatePosting(');
    const insert = post.indexOf('repo.postLines');
    assert.ok(balance >= 0 && balance < validate && validate < insert, 'balance → validate → insert');
  });

  it('posting to your own fund is refused and audited DENIED_SELF', () => {
    const post = body(service, 'export async function postFundEntry(');
    const guard = post.indexOf('isOwnRecord(ctx.actorEmployeeId, form.employeeId)');
    const insert = post.indexOf('repo.postLines');
    assert.ok(guard >= 0 && guard < insert, 'guard before the write');
    assert.match(post, /result: DENIED_SELF/);
  });

  it('balances and lines are read within the employee scope', () => {
    assert.match(body(service, 'export async function fundsPage('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    assert.match(body(service, 'export async function memberBalance('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    assert.match(body(service, 'export async function memberLines('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
  });
});

describe('S33 funds: monthly contributions', () => {
  it('post through the BS-day-1 job, idempotent by ref; no action posts them', () => {
    assert.match(scheduler, /code: 'fund-contributions'/);
    assert.match(scheduler, /days: \[1\]/);
    assert.match(jobs, /postMonthlyContributions\(\)/);
    assert.ok(!actions.includes('postMonthlyContributions'), 'no browser-driven contribution run');
    assert.match(body(service, 'export async function postMonthlyContributions('), /contributionRef\(fund\.code, year, month\)/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S38 TA-DA (G11): every action checks TRAVEL at the right level inside the
// tenant context; claims are read and written within the employee scope;
// amounts are computed by the engine from the card and frozen — never taken
// from the browser; nobody approves, rejects, returns or settles their own
// claim (audited DENIED_SELF); status moves are claim-first; drafts only edit.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/travel.actions.ts');
const service = read('lib/services/travel.service.ts');
const repo = read('lib/repositories/travel.repository.ts');
const page = read('app/(dashboard)/payroll/travel/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S38 travel: permission and tenant context', () => {
  it('every action resolves the tenant and checks TRAVEL', () => {
    for (const fn of actions.match(/export async function \w+/g) ?? []) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, fn);
      assert.match(b, /travelCtx\(/, fn);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'TRAVEL'\)/);
    assert.match(actions, /approved: 'APPROVE', rejected: 'APPROVE', draft: 'APPROVE', settled: 'LOCK'/);
    assert.match(page, /checkPermissionWithScope\("VIEW", "TRAVEL"\)/);
  });
});

describe('S38 travel: scope, own record, amounts', () => {
  it('claims are listed, found and written within the employee scope', () => {
    assert.match(body(service, 'export async function travelPage('), /repo\.listClaims\(scopeCondition\)/);
    assert.match(body(service, 'export async function saveClaim('), /repo\.employeeDesignation\(form\.employeeId, scopeCondition\)/);
    assert.match(body(service, 'export async function moveClaim('), /repo\.findClaim\(id, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
  });

  it('amounts come from computeClaim on the server, never from the browser', () => {
    const save = body(service, 'export async function saveClaim(');
    assert.match(save, /computeClaim\(form, card\)/);
    assert.match(save, /payable: amounts\.payable/);
    assert.ok(!/form\.(gross|payable|dailyAllowance)/.test(save), 'no typed totals');
  });

  it('deciding or settling your own claim is refused and audited before the write', () => {
    const move = body(service, 'export async function moveClaim(');
    const guard = move.indexOf("to !== 'submitted' && isOwnRecord(ctx.actorEmployeeId, existing.employeeId)");
    assert.ok(guard >= 0 && guard < move.indexOf('repo.moveClaim('));
    assert.match(move, /result: DENIED_SELF/);
  });

  it('status moves are claim-first; only drafts are edited; nothing deletes claims', () => {
    assert.match(body(repo, 'export async function moveClaim('), /eq\(travelClaims\.status, from\)/);
    assert.match(body(repo, 'export async function updateDraft('), /eq\(travelClaims\.status, 'draft'\)/);
    assert.ok(!repo.includes('.delete(travelClaims)'));
  });
});

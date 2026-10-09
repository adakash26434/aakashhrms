import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S31 exit workflow (G5): every action checks EMPLOYEES inside the tenant
// context and respects the employee scope; nobody opens, clears, completes
// or cancels their own exit case (audited DENIED_SELF); Complete is the only
// step that touches the employee record — one claim-first transaction with
// the termination mirror — and only when every unit cleared and the last
// working day arrived; the experience letter needs HR_LETTERS ADD.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/exit.actions.ts');
const service = read('lib/services/exit.service.ts');
const repo = read('lib/repositories/exit.repository.ts');
const page = read('app/(dashboard)/workforce/exit/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S31 exit: permission and tenant context', () => {
  it('every action resolves the tenant and checks EMPLOYEES', () => {
    const exported = actions.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 6, 'actions exist');
    for (const fn of exported) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /exitCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'EMPLOYEES'\)/);
  });

  it('the page checks permission before loading; the letter ride-along needs HR_LETTERS ADD', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "EMPLOYEES"\)/);
    assert.ok(page.indexOf('checkPermissionWithScope') < page.indexOf('exitPage('), 'permission before data');
    const complete = body(actions, 'export async function completeExitCaseAction');
    assert.match(complete, /hasPermission\('ADD', 'HR_LETTERS'\)/);
    assert.match(complete, /canIssue && options\?\.issueLetter === true/);
  });
});

describe('S31 exit: employee scope', () => {
  it('every read and write resolves the case within scope', () => {
    for (const fn of ['export async function exitPage(', 'export async function getExitCase(', 'export async function decideClearance(', 'export async function completeExitCase(', 'export async function cancelExitCase(']) {
      assert.match(body(service, fn), /buildEmployeeScopeCondition\((ctx\.)?scope\)/, fn);
    }
    assert.match(body(service, 'export async function openExitCase('), /findEmployeeForLetter\(form\.employeeId, scopeCondition\)/);
  });

  it('case queries join employees so the scope condition applies', () => {
    for (const fn of ['export async function listCases(', 'export async function findCase(']) {
      assert.match(body(repo, fn), /innerJoin\(employees/);
    }
  });
});

describe('S31 exit: never your own record', () => {
  it('open, clearance, complete and cancel all refuse the actor\'s own case, audited DENIED_SELF', () => {
    for (const fn of ['export async function openExitCase(', 'export async function decideClearance(', 'export async function completeExitCase(', 'export async function cancelExitCase(']) {
      const b = body(service, fn);
      assert.match(b, /isOwnRecord\(ctx\.actorEmployeeId, (form|existing)\.employeeId\)/, fn);
      assert.match(b, /result: DENIED_SELF/, fn);
    }
  });
});

describe('S31 exit: completion integrity', () => {
  it('completion is refused while any unit has not cleared or the day has not arrived', () => {
    const complete = body(service, 'export async function completeExitCase(');
    const blockers = complete.indexOf('completionBlockers(');
    const write = complete.indexOf('completeCaseTx');
    assert.ok(blockers >= 0 && blockers < write, 'blockers checked before the write');
    assert.match(complete, /if \(blockers\.length\) throw new UserFacingError/);
  });

  it('Complete claims the open case, switches the employee off and writes the mirror in one transaction', () => {
    const tx = body(repo, 'export async function completeCaseTx(');
    assert.match(tx, /db\.transaction/);
    const claim = tx.indexOf("eq(exitCases.status, 'open')");
    const inactive = tx.indexOf("status: 'Inactive'");
    const mirror = tx.indexOf('insert(employeeTermination)');
    assert.ok(claim >= 0 && claim < inactive && inactive < mirror, 'claim → inactive → mirror');
    assert.match(tx, /return 'stale'/);
  });

  it('cancel touches open cases only, and nothing deletes cases or clearances', () => {
    assert.match(body(repo, 'export async function cancelCase('), /eq\(exitCases\.status, 'open'\)/);
    assert.ok(!repo.includes('.delete(exitCases)') && !repo.includes('.delete(exitClearances)'), 'cases are never deleted');
  });

  it('only one open case per employee', () => {
    assert.match(body(service, 'export async function openExitCase('), /hasOpenCase/);
  });
});

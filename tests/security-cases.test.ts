import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S34 disciplinary & grievance (G8): every action checks DISCIPLINE inside the
// tenant context with the right action level; nobody works a case about their
// own record (audited DENIED_SELF) and such a case is invisible to them; every
// status change is claim-first; the timeline is append-only; audit lines never
// carry case text; nothing here changes the employee record.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/case.actions.ts');
const service = read('lib/services/case.service.ts');
const repo = read('lib/repositories/case.repository.ts');
const page = read('app/(dashboard)/workforce/discipline/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S34 cases: permission and tenant context', () => {
  it('every action resolves the tenant and checks DISCIPLINE', () => {
    const exported = actions.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 7);
    for (const fn of exported) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /caseCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'DISCIPLINE'\)/);
  });

  it('levels: ADD opens, EDIT investigates / notes / closes, APPROVE decides', () => {
    assert.match(body(actions, 'export async function openCaseAction('), /caseCtx\('ADD'\)/);
    assert.match(body(actions, 'export async function investigateCaseAction('), /caseCtx\('EDIT'\)/);
    assert.match(body(actions, 'export async function closeCaseAction('), /caseCtx\('EDIT'\)/);
    assert.match(body(actions, 'export async function addCaseNoteAction('), /caseCtx\('EDIT'\)/);
    assert.match(body(actions, 'export async function decideCaseAction('), /caseCtx\('APPROVE'\)/);
  });

  it('the page checks permission before loading data', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "DISCIPLINE"\)/);
    assert.ok(page.indexOf('checkPermissionWithScope') < page.indexOf('casePage('), 'permission before data');
  });

  it('audit lines carry ids and codes, never case text', () => {
    assert.ok(!/newValues:[^}]*(description|title|note:\s*(?!true))/.test(actions.replace(/note: true/g, '')), 'no text in audit');
  });
});

describe('S34 cases: own record', () => {
  it('opening a case about yourself is refused and audited DENIED_SELF before any write', () => {
    const open = body(service, 'export async function openCase(');
    assert.ok(open.indexOf('isOwnRecord(ctx.actorEmployeeId, form.employeeId)') >= 0);
    assert.ok(open.indexOf('denySelf(') < open.indexOf('repo.openCaseTx'), 'guard before the write');
    assert.match(service, /result: DENIED_SELF/);
  });

  it('investigate / decide / close / note audit the refusal; reads hide your own cases', () => {
    for (const [fn, level] of [['investigate(', 'EDIT'], ['decide(', 'APPROVE'], ['closeCase(', 'EDIT'], ['addCaseNote(', 'EDIT']] as const) {
      assert.match(body(service, `export async function ${fn}`), new RegExp(`loadInScope\\(id, ctx, '${level}'\\)`), fn);
    }
    assert.match(body(service, 'async function loadInScope('), /denySelf\(ctx, id, audit\)/);
    assert.match(body(service, 'export async function casePage('), /hiddenFromActor\(ctx, r\.employeeId\)/);
    assert.match(body(service, 'export async function casePage('), /isOwnRecord\(ctx\.actorEmployeeId, e\.id\)/);
  });

  it('every read and write goes through the employee scope', () => {
    assert.match(body(service, 'export async function casePage('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    assert.match(body(service, 'async function loadInScope('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    assert.match(body(service, 'export async function openCase('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
  });
});

describe('S34 cases: integrity', () => {
  it('status changes are claim-first (the update matches only the expected status)', () => {
    assert.match(body(repo, 'export async function moveStatusTx('), /eq\(hrCases\.status, from\)/);
    assert.match(body(repo, 'export async function decideTx('), /eq\(hrCases\.status, from\)/);
    assert.match(body(repo, 'export async function closeTx('), /eq\(hrCases\.status, 'decided'\)/);
  });

  it('decide validates before the write and the timeline is append-only', () => {
    const decide = body(service, 'export async function decide(');
    assert.ok(decide.indexOf('validateDecision(') < decide.indexOf('repo.decideTx'));
    assert.ok(!repo.includes('.update(hrCaseEvents)') && !repo.includes('.delete(hrCaseEvents)') && !repo.includes('.delete(hrCases)'));
  });

  it('cases never touch the employee record (termination is recommended only)', () => {
    assert.ok(!/update\(employees\)|delete\(employees\)|employeeTermination/.test(repo + service), 'no employee writes');
  });
});

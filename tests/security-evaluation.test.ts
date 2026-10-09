import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S28 performance evaluation (G1): every action checks PERFORMANCE inside the
// tenant context; reads respect the employee scope; the subject's own user
// never rates, and nobody acts on their own evaluation in any role (audited
// DENIED_SELF); only the assigned rater (or APPROVE, audited) marks a stage;
// the form freezes per evaluation; stage advance is claim-first so marks are
// never double-applied; a closed cycle takes no more marks.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/evaluation.actions.ts');
const service = read('lib/services/evaluation.service.ts');
const repo = read('lib/repositories/evaluation.repository.ts');
const page = read('app/(dashboard)/workforce/evaluation/page.tsx');
const printPage = read('app/(dashboard)/workforce/evaluation/[evaluationId]/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S28 evaluation: permission and tenant context', () => {
  it('every action resolves the tenant and checks PERFORMANCE', () => {
    const exported = actions.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 7, 'actions exist');
    for (const fn of exported) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /evaluationCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'PERFORMANCE'\)/);
  });

  it('both pages check permission before loading data', () => {
    for (const [src, loader] of [[page, 'evaluationsPage('], [printPage, 'getEvaluation(']] as const) {
      assert.match(src, /checkPermissionWithScope\("VIEW", "PERFORMANCE"\)/);
      assert.ok(src.indexOf('checkPermissionWithScope') < src.indexOf(loader), 'permission before data');
    }
  });

  it('closing a cycle needs LOCK; acting for an absent rater needs APPROVE', () => {
    assert.match(body(actions, 'export async function closeEvaluationCycleAction'), /evaluationCtx\('LOCK'\)/);
    const rate = body(actions, 'export async function rateEvaluationStageAction');
    assert.match(rate, /hasPermission\('APPROVE', 'PERFORMANCE'\)/);
  });
});

describe('S28 evaluation: employee scope', () => {
  it('lists, detail, rating and starting all carry the employee scope condition', () => {
    assert.match(body(service, 'export async function evaluationsPage('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    assert.match(body(service, 'export async function getEvaluation('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    assert.match(body(service, 'export async function rateStage('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    assert.match(body(service, 'export async function startEvaluations('), /employeesNotInCycle\(input\.cycleId, scopeCondition\)/);
  });

  it('evaluation queries join employees so the scope condition applies', () => {
    for (const fn of ['export async function listEvaluations(', 'export async function findEvaluation(']) {
      assert.match(body(repo, fn), /innerJoin\(employees/);
    }
  });
});

describe('S28 evaluation: never your own record', () => {
  it('rating your own evaluation is refused in every role, audited DENIED_SELF', () => {
    const rate = body(service, 'export async function rateStage(');
    const guard = rate.indexOf('isOwnRecord(ctx.actorEmployeeId, row.employeeId)');
    const write = rate.indexOf('saveStageTx');
    assert.ok(guard >= 0 && guard < write, 'guard before the write');
    assert.match(rate, /result: DENIED_SELF/);
  });

  it('your own evaluation is skipped when starting, and the subject user is never a rater', () => {
    const start = body(service, 'export async function startEvaluations(');
    assert.match(start, /isOwnRecord\(ctx\.actorEmployeeId, employee\.id\)/);
    assert.match(start, /validateRaters\(form, raters, employee\.userId\)/);
  });
});

describe('S28 evaluation: stage integrity', () => {
  it('only the assigned rater (or APPROVE, audited as acting) marks the stage', () => {
    const rate = body(service, 'export async function rateStage(');
    assert.match(rate, /assigned !== ctx\.userId && !canActForRater/);
    assert.match(rate, /actedForRater: assigned !== ctx\.userId/);
  });

  it('a final evaluation and a closed cycle take no more marks', () => {
    const rate = body(service, 'export async function rateStage(');
    assert.match(rate, /row\.status !== 'in_progress'/);
    assert.match(rate, /row\.cycleStatus === 'closed'/);
  });

  it('stage advance is claim-first in one transaction with the marks', () => {
    const save = body(repo, 'export async function saveStageTx(');
    assert.match(save, /db\.transaction/);
    const claim = save.indexOf("eq(evaluations.stage, write.stage)");
    const marks = save.indexOf('insert(evaluationScores)');
    assert.ok(claim >= 0 && claim < marks, 'claim before marks');
    assert.match(save, /return 'stale'/);
  });

  it('each evaluation freezes its own copy of the form at start', () => {
    const start = body(service, 'export async function startEvaluations(');
    assert.match(start, /form: form as unknown as Record<string, unknown>/);
    assert.ok(!service.includes('updateTemplateForm'), 'the service never edits the template during scoring');
  });
});

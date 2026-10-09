import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S35 training (G7): every action checks TRAINING inside the tenant context;
// participants are read and marked within the employee scope; nobody nominates
// themselves or marks their own record (audited DENIED_SELF); status moves are
// claim-first; marking is validated against the programme's status first.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/training.actions.ts');
const service = read('lib/services/training.service.ts');
const repo = read('lib/repositories/training.repository.ts');
const page = read('app/(dashboard)/workforce/training/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S35 training: permission and tenant context', () => {
  it('every action resolves the tenant and checks TRAINING', () => {
    const exported = actions.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 7);
    for (const fn of exported) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /trainingCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'TRAINING'\)/);
    assert.match(body(actions, 'export async function createProgramAction('), /trainingCtx\('ADD'\)/);
    assert.match(body(actions, 'export async function nominateAction('), /trainingCtx\('ADD'\)/);
    assert.match(body(actions, 'export async function markParticipantAction('), /trainingCtx\('EDIT'\)/);
    assert.match(body(actions, 'export async function moveProgramAction('), /trainingCtx\('EDIT'\)/);
  });

  it('the page checks permission before loading data', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "TRAINING"\)/);
    assert.ok(page.indexOf('checkPermissionWithScope') < page.indexOf('trainingPage('));
  });
});

describe('S35 training: scope and own record', () => {
  it('participants are read and found within the employee scope', () => {
    assert.match(body(service, 'export async function getProgram('), /repo\.participants\(id, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(body(service, 'export async function markParticipant('), /repo\.findParticipant\(participantId, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(body(service, 'export async function nominate('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
  });

  it('self-nomination and self-marking are refused and audited before any write', () => {
    const nominate = body(service, 'export async function nominate(');
    assert.ok(nominate.indexOf('isOwnRecord(ctx.actorEmployeeId, id)') < nominate.indexOf('repo.nominate('));
    const mark = body(service, 'export async function markParticipant(');
    assert.ok(mark.indexOf('isOwnRecord(ctx.actorEmployeeId, person.employeeId)') < mark.indexOf('repo.markParticipant('));
    assert.equal((service.match(/result: DENIED_SELF/g) ?? []).length, 2);
  });
});

describe('S35 training: integrity', () => {
  it('status moves are claim-first and edits only touch planned / running programmes', () => {
    assert.match(body(repo, 'export async function moveProgram('), /eq\(trainingPrograms\.status, from\)/);
    assert.match(body(repo, 'export async function updateProgram('), /IN \('planned','running'\)/);
  });

  it('marking is validated against the programme status before the write', () => {
    const mark = body(service, 'export async function markParticipant(');
    assert.ok(mark.indexOf('validateMark(program.status, form)') < mark.indexOf('repo.markParticipant('));
  });

  it('nominations are idempotent and nothing deletes programmes or participants', () => {
    assert.match(body(repo, 'export async function nominate('), /onConflictDoNothing/);
    assert.ok(!repo.includes('.delete(trainingPrograms)') && !repo.includes('.delete(trainingParticipants)'));
  });
});

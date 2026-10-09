import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S32 recruitment (G4): every action checks RECRUITMENT inside the tenant
// context; branch-scoped users see their branches only; applicant stage
// moves obey the pipeline; applicant personal data stays inside the module.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/recruitment.actions.ts');
const service = read('lib/services/recruitment.service.ts');
const schema = read('lib/db/schema.ts');
const sync = read('lib/db/tenant-schema-sync.ts');
const page = read('app/(dashboard)/workforce/recruitment/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S32 recruitment: permission and tenant context', () => {
  it('every action resolves the tenant and checks RECRUITMENT', () => {
    const exported = actions.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 7, 'actions exist');
    for (const fn of exported) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /recruitmentCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'RECRUITMENT'\)/);
  });

  it('the page checks permission before loading data', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "RECRUITMENT"\)/);
    assert.ok(page.indexOf('checkPermissionWithScope') < page.indexOf('recruitmentPage('), 'permission before data');
  });

  it('the RECRUITMENT module is seeded idempotently in the tenant sync', () => {
    assert.match(sync, /'RECRUITMENT',/);
    assert.match(sync, /md5\('perm:' \|\| a \|\| ':RECRUITMENT'\)::uuid/);
  });
});

describe('S32 recruitment: branch scope', () => {
  it('branch-scoped users see and act on their branches only', () => {
    assert.match(service, /scope\.scopeType === 'BRANCH' \? scope\.branchIds : undefined/);
    for (const fn of ['export async function closeVacancy(', 'export async function vacancyApplicants(', 'export async function addApplicant(']) {
      assert.match(body(service, fn), /scopeBranchIds\(ctx\.scope\)/, fn);
    }
    const update = body(service, 'export async function updateApplicant(');
    assert.match(update, /findVacancy\(applicant\.vacancyId, scopeBranchIds\(ctx\.scope\)\)/);
  });
});

describe('S32 recruitment: pipeline integrity', () => {
  it('stage moves are validated against the pipeline server-side', () => {
    const update = body(service, 'export async function updateApplicant(');
    assert.match(update, /canMoveStage\(applicant\.stage, raw\.stage\)/);
  });

  it('applicants only join open vacancies; the merit order is computed, never stored', () => {
    assert.match(body(service, 'export async function addApplicant('), /vacancy\.status !== 'open'/);
    assert.ok(!schema.includes("merit_rank"), 'no stored rank column');
    assert.match(service, /meritOrder\(/);
  });

  it('applicant personal data never leaves the module (no letter, email or event imports)', () => {
    assert.ok(!/letter\.service|email\.service|employee-event/.test(service), 'no cross-module copies of applicant data');
  });
});

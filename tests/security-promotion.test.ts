import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S39 promotion ranking: PERFORMANCE VIEW within the employee scope; the
// composite is computed, never stored; weights change only under PERFORMANCE
// LOCK (audited); disciplinary facts are counts; nothing writes an employee —
// the बढुवा itself goes through the lifecycle event (S27 + darbandi).

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const page = read('app/(dashboard)/workforce/promotion/page.tsx');
const action = read('app/actions/promotion.actions.ts');
const service = read('lib/services/promotion.service.ts');
const repo = read('lib/repositories/promotion.repository.ts');
const lifecyclePage = read('app/(dashboard)/workforce/lifecycle/page.tsx');

describe('S39 promotion ranking', () => {
  it('page checks PERFORMANCE VIEW with scope before computing', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "PERFORMANCE"\)/);
    assert.ok(page.indexOf('checkPermissionWithScope') < page.indexOf('promotionPage('));
    assert.match(service, /repo\.activeEmployees\(buildEmployeeScopeCondition\(scope\)\)/);
  });

  it('weights change only under PERFORMANCE LOCK and are audited', () => {
    assert.match(action, /ensureTenantContext\(\)/);
    assert.match(action, /checkPermission\('LOCK', 'PERFORMANCE'\)/);
    assert.ok(action.indexOf("checkPermission('LOCK'") < action.indexOf('saveWeights('));
    assert.match(action, /recordAuditLog\(/);
  });

  it('the composite is never stored and no employee row is written', () => {
    assert.ok(!/insert\(|update\(/.test(service), 'service writes nothing but via repo.writeWeights');
    assert.ok(!/update\(employees\)|insert\(employees\)|employeeEvents\)\.values|insert\(employeeEvents/.test(repo), 'repository never writes employees or events');
    assert.ok(!repo.includes('.insert(') || /insert\(systemConfig\)/.test(repo), 'only the weights are written');
  });

  it('disciplinary facts are counts only', () => {
    const start = repo.indexOf('export async function disciplinaryOutcomes(');
    const body = repo.slice(start, repo.indexOf('\n}\n', start));
    assert.match(body, /count\(\*\)::int/);
    assert.ok(!/hrCases\.(title|description|outcomeNote)/.test(body));
  });

  it('the deep link only pre-fills the event window for someone with EMPLOYEES EDIT, and validates the id', () => {
    assert.match(lifecyclePage, /add && params\.new === 'promotion'/);
    assert.match(lifecyclePage, /\/\^\[0-9a-f-\]\{36\}\$\/i\.test\(params\.employee\)/);
  });
});

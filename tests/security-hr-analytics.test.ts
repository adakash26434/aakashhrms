import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S36 HR analytics (G13): EMPLOYEES VIEW within the employee scope on every
// query; case figures are counts only and only with DISCIPLINE VIEW; no pay
// columns are read; the export goes through authorizeExportAction.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const action = read('app/actions/hr-analytics.actions.ts');
const service = read('lib/services/hr-analytics.service.ts');
const repo = read('lib/repositories/hr-analytics.repository.ts');
const page = read('app/(dashboard)/reports/hr-analytics/page.tsx');
const client = read('components/hr-analytics/hr-analytics-client.tsx');

describe('S36 analytics: permission and scope', () => {
  it('action and page check EMPLOYEES VIEW with scope before reading', () => {
    assert.match(action, /ensureTenantContext\(\)/);
    assert.match(action, /checkPermissionWithScope\('VIEW', 'EMPLOYEES'\)/);
    assert.match(page, /checkPermissionWithScope\("VIEW", "EMPLOYEES"\)/);
    assert.ok(page.indexOf('checkPermissionWithScope') < page.indexOf('hrAnalytics('));
  });

  it('every repository query over employees carries the scope condition', () => {
    const fns = ['staffFacts(', 'movement(', 'trainingFacts(', 'leaveFacts(', 'caseFacts('];
    for (const fn of fns) {
      const start = repo.indexOf(`export async function ${fn}`);
      assert.ok(start >= 0, fn);
      const end = repo.indexOf('\n}\n', start);
      assert.match(repo.slice(start, end), /scopeCondition/, `${fn} is scoped`);
    }
    assert.match(service, /buildEmployeeScopeCondition\(ctx\.scope\)/);
  });

  it('case figures need DISCIPLINE VIEW and are counts only', () => {
    assert.match(action, /hasPermission\('VIEW', 'DISCIPLINE'\)/);
    assert.match(service, /ctx\.canSeeCases \? repo\.caseFacts/);
    const start = repo.indexOf('export async function caseFacts(');
    const body = repo.slice(start, repo.indexOf('\n}\n', start));
    assert.ok(!/hrCases\.(title|description|outcomeNote)/.test(body), 'no case text');
  });

  it('no pay columns are read', () => {
    assert.ok(!/basicSalary|grossSalary|netPay|payrollSlips|employeeSalaryMap/.test(repo));
  });

  it('the export is gated by authorizeExportAction', () => {
    assert.match(client, /authorizeExportAction\(\{ module: "EMPLOYEES"/);
    assert.ok(client.indexOf('authorizeExportAction') < client.indexOf('downloadTextFile('));
  });
});

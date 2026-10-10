import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Statutory returns (4.8 / F9): only payslips of approved / locked runs reach a deposit
// file or a certificate; every read applies the viewer's employee scope; files are built
// on the server (EXPORT permission, audited) with machine-safe CSV fields; the portal
// certificate takes the employee from the session and only released payslips.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const body = (src: string, marker: string) => {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, marker);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

const actions = read('app/actions/statutory.actions.ts');
const service = read('lib/services/statutory.service.ts');
const repo = read('lib/repositories/statutory.repository.ts');
const engine = read('lib/engines/statutory-returns.engine.ts');
const page = read('app/(dashboard)/payroll/statutory/page.tsx');
const certPage = read('app/(dashboard)/payroll/statutory/certificate/[employeeId]/page.tsx');
const portal = read('lib/services/self-service.service.ts');
const essPage = read('app/(self-service)/self-service/my-tax/page.tsx');

describe('statutory returns guards', () => {
  it('every action resolves the tenant and checks REPORTS_TAX_IRD with scope', () => {
    const names = (actions.match(/export async function \w+/g) ?? []).map((m) => m.replace('export async function ', ''));
    assert.ok(names.length >= 3);
    for (const n of names) {
      const fn = body(actions, `export async function ${n}(`);
      assert.match(fn, /ensureTenantContext\(\)/, n);
      assert.match(fn, /ctxFor\('(VIEW|EXPORT)'\)/, n);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'REPORTS_TAX_IRD'\)/);
  });

  it('a file needs EXPORT and is audited with its row count', () => {
    const fn = body(actions, 'export async function exportStatutoryFileAction(');
    assert.match(fn, /ctxFor\('EXPORT'\)/);
    assert.match(fn, /action: 'EXPORT'/);
    assert.match(fn, /rows: out\.rows/);
  });

  it('only approved or locked runs are read', () => {
    assert.match(repo, /FINAL_RUN_STATUSES = \['APPROVED', 'LOCKED'\] as const/);
    assert.match(body(repo, 'export async function slipFacts('), /inArray\(payrollRuns\.status, \[\.\.\.FINAL_RUN_STATUSES\]\)/);
    assert.match(body(repo, 'export async function paidSettlements('), /eq\(exitSettlements\.status, 'paid'\)/);
  });

  it('every office read applies the viewer\'s employee scope', () => {
    for (const fn of ['export async function statutoryMonth(', 'export async function certificateList(', 'export async function certificate(']) {
      assert.match(body(service, fn), /buildEmployeeScopeCondition\(ctx\.scope\)/, fn);
    }
    assert.match(body(repo, 'export async function slipFacts('), /f\.scope,/);
    assert.match(body(repo, 'export async function paidSettlements('), /f\.scope,/);
  });

  it('upload files use machine-safe CSV fields (no formulas, commas quoted)', () => {
    assert.match(engine, /plainCsvField/);
    assert.doesNotMatch(engine, /csv \+=/);
  });

  it('pages check permission before loading data', () => {
    assert.ok(page.indexOf('checkPermissionWithScope("VIEW", "REPORTS_TAX_IRD")') < page.indexOf('statutoryMonth('));
    assert.ok(certPage.indexOf('checkPermissionWithScope("VIEW", "REPORTS_TAX_IRD")') < certPage.indexOf('certificate('));
    assert.match(certPage, /notFound\(\)/);
  });

  it('the portal certificate is the session employee\'s, from released payslips only', () => {
    const fn = body(portal, 'export async function getMyTaxCertificate');
    assert.match(fn, /await getSessionEmployeeId\(\)/);
    assert.match(fn, /ownCertificate\(employeeId, fiscalYearId, visibleToEmployee\(\)\)/);
    assert.doesNotMatch(essPage, /employeeId/);
    // ownCertificate never applies an office scope: the caller fixes the employee.
    assert.match(body(service, 'export async function ownCertificate('), /yearBook\(fy, \{ employeeId, extra: visibleSlip \}\)/);
  });
});

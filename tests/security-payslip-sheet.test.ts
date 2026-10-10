import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Bilingual payslip (4.8 / F11): office printing is limited to the viewer's employee scope and to
// locked runs; the portal shows the session employee's released payslips only; the account
// number is masked on every printed sheet.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const body = (src: string, marker: string) => {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, marker);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

const actions = read('app/actions/report.actions.ts');
const report = read('lib/services/report.service.ts');
const sheets = read('lib/services/payslip-sheet.service.ts');
const repo = read('lib/repositories/payslip-sheet.repository.ts');
const portal = read('lib/services/self-service.service.ts');
const essPage = read('app/(self-service)/self-service/my-payslips/[id]/page.tsx');

describe('payslip sheet guards', () => {
  it('office payslips: scoped permission, scope passed down, locked runs only', () => {
    const fn = body(actions, 'export async function getPayslipReportAction(');
    assert.match(fn, /checkPermissionWithScope\("VIEW", "REPORTS_PAYSLIP"\)/);
    assert.match(fn, /buildEmployeeScopeCondition\(scope\)/);
    assert.match(body(report, 'export async function getPayslipPrintData('), /runRecord\.status !== "LOCKED"/);
    assert.match(body(sheets, 'export async function sheetsForRun('), /status !== 'LOCKED'\) return \{ status, items: \[\] \}/);
    assert.match(body(repo, 'export async function sheetSlips('), /where\.scope,/);
  });

  it('the portal sheet is the session employee\'s released payslip', () => {
    const fn = body(portal, 'export async function getMyPayslipSheet(');
    assert.match(fn, /await getSessionEmployeeId\(\)/);
    assert.match(fn, /ownSheet\(employeeId, payslipId, visibleToEmployee\(\)\)/);
    assert.match(body(sheets, 'export async function ownSheet('), /sheetSlips\(\{ slipId, employeeId, extra: visibleSlip \}\)/);
    assert.match(essPage, /notFound\(\)/);
    assert.doesNotMatch(essPage, /employeeId/);
  });

  it('the printed account number is masked', () => {
    assert.match(sheets, /account: maskAccountNumber\(slip\.bankAccountNumber\)/);
  });
});

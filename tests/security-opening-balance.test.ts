import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// F15 opening balances change what payroll deducts as tax, so they are guarded like pay: Payroll
// run permissions within the user's scope, never one's own pay record (S21), one system per
// month (no opening over a month paid here, no run over a month an opening covers), and the
// figures never travel in audit lines.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const importActions = read('app/actions/import.actions.ts');
const openingActions = read('app/actions/opening-balance.actions.ts');
const service = read('lib/services/opening-balance.service.ts');
const plan = service.slice(service.indexOf('async function plan('), service.indexOf('export async function previewOpeningImport'));
const page = read('app/(dashboard)/payroll/opening/page.tsx');

describe('F15 opening balances', () => {
  it('viewing, importing and removing need Payroll run permissions within the scope', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "PAYROLL_GENERATE"\)/);
    const openingImport = importActions.slice(importActions.indexOf('export async function previewOpeningImportAction'));
    assert.equal(openingImport.split("checkPermissionWithScope('ADD', 'PAYROLL_GENERATE')").length, 3);
    assert.match(openingActions, /checkPermissionWithScope\('DELETE', 'PAYROLL_GENERATE'\)/);
    // Audit lines carry the months, never the amounts.
    assert.match(openingImport, /newValues: \{ openingBalance: true, months: o\.months \}/);
    assert.doesNotMatch(openingImport, /grossEarnings|taxableIncome|incomeTax/);
  });

  it('never one\'s own pay record; employees only within the scope', () => {
    assert.match(plan, /employeeRepository\.findAll\([^)]*\}, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(plan, /"Outside the branches \/ departments you manage"/);
    assert.match(plan, /isOwnRecord\(ctx\.scope\.employeeId, employee\.id\)\) err\("Employee code", "Your own pay record is entered by someone else"\)/);
    const remove = service.slice(service.indexOf('export async function removeOpening'));
    assert.match(remove, /findOpenings\(row\.fiscalYearId, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(remove, /isOwnRecord\(ctx\.scope\.employeeId, row\.employeeId\)\) throw new OpeningRefused\([^)]*"self"\)/);
    assert.match(openingActions, /error\.reason === 'self' \? DENIED_SELF : 'DENIED_SCOPE'/);
  });

  it('a month is paid by one system only', () => {
    // No opening over a month that has a payslip here (any state)…
    assert.match(plan, /\(slipMonths\.get\(employee\.id\) \?\? \[\]\)\.filter\(\(m\) => m\.index <= opening\.months\)/);
    // …and no run over a month an opening covers (regular and off-cycle), shown in pre-flight too.
    // (The fiscal month is counted in the run's pay calendar, 4.8b.)
    assert.match(read('lib/services/payroll.service.ts'), /openingRepository\.openingsCovering\(scopedEmployees\.map\(\(e\) => e\.id\), runYear\.id, fiscalMonthIndex\);\s*if \(coveredByOpening\.length\) throw new UserFacingError/);
    assert.match(read('lib/services/off-cycle.service.ts'), /openingRepository\.openingsCovering\(payees\.map\(\(e\) => e\.id\), fiscalYear\.id, ctx\.fiscalMonthIndex\);\s*if \(coveredByOpening\.length\) throw new UserFacingError/);
    // Pre-flight (the pay run workspace's) marks each person an opening covers.
    assert.match(read('lib/services/payroll-run.service.ts'), /openingRepository\.openingsCovering\(ids, runYear\.id, fiscalMonthIndexFor\(period\.calendar, period\.month\)\)/);
    assert.match(read('lib/services/payroll-run.service.ts'), /coveredByOpening: coveredCodes\.has\(e\.employeeCode\),/);
    // The tax history counts an opening only before the month being paid.
    assert.match(read('lib/repositories/payroll.repository.ts'), /lt\(payrollOpeningBalances\.months, fiscalMonthIndex\)/);
  });

  it('saving re-checks the file and refuses while any row has an error', () => {
    const commit = service.slice(service.indexOf('export async function commitOpeningImport'), service.indexOf('export async function removeOpening'));
    assert.ok(commit.indexOf('await plan(csv, ctx)') < commit.indexOf('upsertOpenings('));
    assert.match(commit, /if \(!report\.ready\) throw new UserFacingError/);
  });
});

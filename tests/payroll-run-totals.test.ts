import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 4.8 payroll accuracy fixes: run totals are recomputed from the committed
// payslips after every slip-changing transaction (never summed through a
// second connection inside it), and a run uses only its own fiscal year's
// tax slabs.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const service = read('lib/services/payroll.service.ts');
const repo = read('lib/repositories/payroll.repository.ts');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('payroll run totals', () => {
  it('are refreshed from the payslips in one SQL statement', () => {
    const refresh = body(repo, 'export async function refreshRunTotals(');
    assert.match(refresh, /UPDATE \$\{payrollRuns\} r SET/);
    assert.match(refresh, /sum\(net_payable\)/);
    assert.match(refresh, /employee_count = s\.n/);
  });

  it('every slip-changing path refreshes after its transaction, not inside it', () => {
    for (const fn of ['export async function overridePayslipAllowanceDeduction(', 'export async function deleteEmployeePayslip(', 'export async function recalculateEmployeePayslip(']) {
      const b = body(service, fn);
      assert.match(b, /repository\.refreshRunTotals\(run\.id\)/, fn);
      const tx = b.lastIndexOf('.transaction(async (tx)');
      const closes = tx >= 0 ? b.indexOf('\n  });', tx) : -1;
      assert.ok(b.indexOf('refreshRunTotals') > closes, `${fn} refreshes after the transaction commits`);
    }
    assert.ok(!service.includes('updatePayrollRunTotals('), 'no hand-summed totals remain');
  });
});

describe('payroll tax slabs', () => {
  it('are loaded for the run\'s fiscal year only', () => {
    assert.ok(!service.includes('findAllSlabs()'), 'no all-years slab load in payroll');
    assert.match(service, /findSlabsByFiscalYear\(runYear\.id\)/);
    assert.match(service, /findSlabsByFiscalYear\(run\.fiscalYearId\)/);
    assert.match(body(read('lib/repositories/tax-rate.repository.ts'), 'export async function findSlabsByFiscalYear('), /eq\(taxRateSlabs\.fiscalYearId, fiscalYearId\)/);
  });
});

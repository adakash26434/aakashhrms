import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZERO_COMPONENTS, arrearsSlipFigures, componentsOf, describeLine, diffComponents, sumComponents } from '../lib/engines/arrears.engine';
import type { ArrearsComponents, ArrearsMonthLine } from '../lib/types/payroll-run';

// 4.8b arrears: a locked month compared with what is due now, component by component.

const slip = (o: Partial<Parameters<typeof componentsOf>[0]> = {}) => ({
  basicSalary: '30000',
  gradeAmount: '0',
  grossEarnings: '36000',
  otAmount: '0',
  absentDeduction: '0',
  pfEmployee: '0',
  pfEmployer: '0',
  ssfEmployee: '3300',
  ssfEmployer: '6000',
  citDeduction: '0',
  ...o,
});
const flags = { isStatutory: (id: string) => id === 'ssf' || id === 'ssf-er' || id === 'tds', isOtOrAbsent: (id: string) => id === 'ot' };
const heads = [
  { payHeadId: 'da', headType: 'allowance' as const, calculatedAmount: '4000' },
  { payHeadId: 'tran', headType: 'allowance' as const, calculatedAmount: '2000' },
  { payHeadId: 'ssf', headType: 'deduction' as const, calculatedAmount: '3300' },
  { payHeadId: 'tds', headType: 'deduction' as const, calculatedAmount: '400' },
  { payHeadId: 'union', headType: 'deduction' as const, calculatedAmount: '100' },
];
const parts = (o: Partial<ArrearsComponents> = {}): ArrearsComponents => ({ ...ZERO_COMPONENTS, ...o });
const line = (o: Partial<ArrearsMonthLine> & { diff: ArrearsComponents }): ArrearsMonthLine => ({ kind: 'salary', calendar: 'BS', year: 2083, month: 5, label: 'Bhadra 2083', sourceRef: 'batch:b1', sourceSlipId: 's1', paid: ZERO_COMPONENTS, due: ZERO_COMPONENTS, ...o });

describe('Arrears: components of a month (4.8b)', () => {
  it('splits a payslip into the parts compared; statutory, overtime and absent heads have their own parts', () => {
    const c = componentsOf(slip(), heads, flags);
    assert.equal(c.basic, '30000');
    assert.equal(c.allowances, '6000'); // DA + transport; SSF, TDS and union are not allowances
    assert.equal(c.otherDeductions, '100'); // the union fee; SSF and TDS are statutory
    assert.equal(c.ssfEmployee, '3300');
    assert.equal(c.grossEarnings, '36000');
  });

  it('due − paid, with a materiality of one paisa; locked arrears count as paid', () => {
    const paid = sumComponents([componentsOf(slip(), heads, flags), parts({ basic: '2000', grossEarnings: '2000' })]);
    assert.equal(paid.basic, '32000');
    const same = diffComponents(componentsOf(slip({ basicSalary: '32000', grossEarnings: '38000' }), heads, flags), paid);
    assert.equal(same.material, false);
    const more = diffComponents(componentsOf(slip({ basicSalary: '35000', grossEarnings: '41000' }), heads, flags), paid);
    assert.equal(more.material, true);
    assert.equal(more.diff.basic, '3000');
    assert.equal(diffComponents(parts({ basic: '100.004' }), parts({ basic: '100' })).material, false);
  });

  it('an arrears payslip: one earning per month, a negative month as a recovery, the employee contributions as deductions', () => {
    const f = arrearsSlipFigures([
      line({ diff: parts({ basic: '3000', allowances: '500', ssfEmployee: '330', ssfEmployer: '600', grossEarnings: '3500' }) }),
      line({ month: 6, label: 'Aswin 2083', kind: 'attendance', diff: parts({ absentDeduction: '1200', grossEarnings: '-1200' }) }),
    ]);
    assert.deepEqual(f.earnings, [{ label: 'Arrears · Bhadra 2083', amount: '3500' }]);
    assert.deepEqual(f.deductions, [
      { label: 'Contributions · Bhadra 2083', amount: '330' },
      { label: 'Recovery · Aswin 2083', amount: '1200' },
    ]);
    assert.equal(f.grossEarnings, '3500');
    assert.equal(f.totalDeductions, '1530');
    assert.equal(f.taxableGross, '3500'); // the recovery is not taxable income
    assert.equal(f.retirement, '930'); // 330 + 600
    assert.equal(f.ssfEmployee, '330');
  });

  it('the line is the gross difference, whatever the parts say (slips made before 4.8 split heads differently)', () => {
    const f = arrearsSlipFigures([line({ diff: parts({ grade: '3500', allowances: '-8500', grossEarnings: '1200' }) })]);
    assert.deepEqual(f.earnings, [{ label: 'Arrears · Bhadra 2083', amount: '1200' }]);
    assert.equal(f.totalDeductions, '0');
  });

  it('contributions overpaid earlier come back as an earning', () => {
    const f = arrearsSlipFigures([line({ diff: parts({ basic: '-1000', ssfEmployee: '-110', grossEarnings: '-1000' }) })]);
    assert.deepEqual(f.earnings, [{ label: 'Contributions refunded · Bhadra 2083', amount: '110' }]);
    assert.deepEqual(f.deductions, [{ label: 'Recovery · Bhadra 2083', amount: '1000' }]);
    assert.equal(f.retirement, '0');
    assert.equal(describeLine({ label: 'Bhadra 2083', kind: 'attendance' }), 'Bhadra 2083: attendance corrected');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateFiscalYear, canEdit, formatFiscalYearLabel } from '../lib/engines/fiscal-year.engine';
import type { FiscalYear, FiscalYearFormData } from '../lib/types/fiscal-year';

describe('Fiscal Year Status & Unlock Management', () => {
  const sampleFYActive: FiscalYear = {
    id: 'fy-2081-82',
    label: 'FY 2081/82',
    slug: 'fy-2081-82',
    fromMonth: 4,
    toMonth: 3,
    startDateAD: new Date('2024-07-16T00:00:00.000Z'),
    endDateAD: new Date('2025-07-15T00:00:00.000Z'),
    startDateBS: '2081-04-01',
    endDateBS: '2082-03-31',
    status: 'Active',
    payslipsGenerated: false,
  };

  const sampleFYLocked: FiscalYear = {
    id: 'fy-2080-81',
    label: 'FY 2080/81',
    slug: 'fy-2080-81',
    fromMonth: 4,
    toMonth: 3,
    startDateAD: new Date('2023-07-17T00:00:00.000Z'),
    endDateAD: new Date('2024-07-15T00:00:00.000Z'),
    startDateBS: '2080-04-01',
    endDateBS: '2081-03-31',
    status: 'Locked',
    payslipsGenerated: true,
  };

  it('should allow editing when a fiscal year is active and unlocked', () => {
    assert.strictEqual(canEdit(sampleFYActive), true);
  });

  it('should disallow editing when a fiscal year is locked', () => {
    assert.strictEqual(canEdit(sampleFYLocked), false);
  });

  it('should restore editing capability once a locked fiscal year is unlocked', () => {
    // Simulating unlock operation
    const unlockedFY: FiscalYear = {
      ...sampleFYLocked,
      status: 'Active',
      payslipsGenerated: false,
    };
    assert.strictEqual(canEdit(unlockedFY), true);
    assert.strictEqual(unlockedFY.status, 'Active');
    assert.strictEqual(unlockedFY.payslipsGenerated, false);
  });

  it('should allow setting fiscal year to Inactive upon unlock', () => {
    const unlockedInactiveFY: FiscalYear = {
      ...sampleFYLocked,
      status: 'Inactive',
      payslipsGenerated: false,
    };
    assert.strictEqual(canEdit(unlockedInactiveFY), true);
    assert.strictEqual(unlockedInactiveFY.status, 'Inactive');
    assert.strictEqual(unlockedInactiveFY.payslipsGenerated, false);
  });

  it('should validate form data correctly including status', () => {
    const formData: FiscalYearFormData = {
      label: 'FY 2082/83',
      slug: 'fy-2082-83',
      fromMonth: 4,
      toMonth: 3,
      startDateAD: new Date('2025-07-16'),
      endDateAD: new Date('2026-07-15'),
      status: 'Active',
    };
    const errors = validateFiscalYear(formData);
    assert.deepStrictEqual(errors, {});
  });

  it('should reject form data with end date before start date', () => {
    const invalidFormData: FiscalYearFormData = {
      label: 'FY 2082/83',
      slug: 'fy-2082-83',
      fromMonth: 4,
      toMonth: 3,
      startDateAD: new Date('2026-07-16'),
      endDateAD: new Date('2025-07-15'),
      status: 'Active',
    };
    const errors = validateFiscalYear(invalidFormData);
    assert.ok(errors.crossField);
  });

  it('should format fiscal year labels consistently', () => {
    assert.strictEqual(formatFiscalYearLabel(2081), 'FY 2081/82');
    assert.strictEqual(formatFiscalYearLabel(2082), 'FY 2082/83');
  });

  it('should simulate single-active cycle enforcement across multiple fiscal years', () => {
    const list: FiscalYear[] = [
      { ...sampleFYActive, id: '1', status: 'Active' },
      { ...sampleFYActive, id: '2', status: 'Inactive' },
      { ...sampleFYActive, id: '3', status: 'Inactive' },
    ];

    // Activate item 2
    const targetId = '2';
    const updatedList = list.map((item) => {
      if (item.id === targetId) {
        return { ...item, status: 'Active' as const, payslipsGenerated: false };
      }
      return { ...item, status: 'Inactive' as const };
    });

    const activeList = updatedList.filter((item) => item.status === 'Active');
    assert.strictEqual(activeList.length, 1);
    assert.strictEqual(activeList[0].id, '2');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PayHeadInUseError,
  PayHeadLinkedToPayslipError,
  StatutoryHeadDeletionError,
} from '../lib/services/pay-head.service';

describe('Pay Head Deletion Validation & Messaging', () => {
  it('should format PayHeadInUseError with single employee details', () => {
    const error = new PayHeadInUseError(
      'Communication Allowance',
      ' (assigned to 1 employee: Ram Bahadur (EMP-001))'
    );

    assert.equal(error.name, 'PayHeadInUseError');
    assert.equal(
      error.message,
      'Cannot delete pay head "Communication Allowance" because it is currently assigned in employee salary mapping (assigned to 1 employee: Ram Bahadur (EMP-001)). Please remove this pay head from employee salary mappings before deleting.'
    );
  });

  it('should format PayHeadInUseError with multiple employees and overflow', () => {
    const error = new PayHeadInUseError(
      'Fuel Allowance',
      ' (assigned to 4 employees: Ram (EMP-001), Sita (EMP-002), Hari (EMP-003) and 1 more)'
    );

    assert.equal(
      error.message,
      'Cannot delete pay head "Fuel Allowance" because it is currently assigned in employee salary mapping (assigned to 4 employees: Ram (EMP-001), Sita (EMP-002), Hari (EMP-003) and 1 more). Please remove this pay head from employee salary mappings before deleting.'
    );
  });

  it('should format PayHeadLinkedToPayslipError with correct pluralization and compliance notice', () => {
    const errorSingle = new PayHeadLinkedToPayslipError('Overtime Pay', 1);
    assert.equal(errorSingle.name, 'PayHeadLinkedToPayslipError');
    assert.match(errorSingle.message, /linked to generated employee payslips \(1 slip\)/);
    assert.match(errorSingle.message, /To maintain payroll audit history/);

    const errorMultiple = new PayHeadLinkedToPayslipError('Festival Bonus', 15);
    assert.match(errorMultiple.message, /linked to generated employee payslips \(15 slips\)/);
  });

  it('should format StatutoryHeadDeletionError clearly explaining statutory requirement', () => {
    const error = new StatutoryHeadDeletionError('Provident Fund');
    assert.equal(error.name, 'StatutoryHeadDeletionError');
    assert.equal(
      error.message,
      'Cannot delete statutory system head "Provident Fund". Statutory pay heads are required for tax, PF, SSF, and CIT calculations.'
    );
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEmployeeLookups,
  resolveDepartmentName,
  resolveDesignationName,
  resolveBranchName,
  resolveEmployeeName,
  resolveShreniName,
  type RawLookupData,
} from '../lib/constants/employee-lookups';
import type { Employee } from '../lib/types/employee';

describe('Organizational Structure & Lookups Module', () => {
  describe('Employee Lookups Resolver', () => {
    it('should build lookups from lookup data and resolve human-readable names', () => {
      const rawLookups: RawLookupData = {
        branches: [
          { id: 'b-1', name: 'Kathmandu HQ' },
          { id: 'b-2', name: 'Pokhara Branch' },
        ],
        departments: [
          { id: 'd-1', name: 'Human Resources' },
          { id: 'd-2', name: 'Finance & Accounts' },
        ],
        designations: [
          { id: 'des-1', name: 'HR Manager', departmentId: 'd-1' },
          { id: 'des-2', name: 'Senior Accountant', departmentId: 'd-2' },
        ],
        employees: [
          { id: 'emp-1', name: 'Aarav Sharma' },
        ],
        shreniLevels: [
          { code: 'S2', name: 'Level 2 (Junior Assistant)', labelNepali: 'तह २ (कनिष्ठ सहायक)' },
          { code: 'S7', name: 'Level 7 (Senior Officer)', labelNepali: 'तह ७ (वरिष्ठ अधिकृत)' },
        ],
      };

      const employees: Employee[] = [];
      const lookups = buildEmployeeLookups(employees, rawLookups);

      assert.equal(resolveBranchName('b-1', lookups.branchNameById), 'Kathmandu HQ');
      assert.equal(resolveBranchName('unknown-id', lookups.branchNameById), 'unknown-id');

      assert.equal(resolveDepartmentName('d-1', lookups.departmentNameById), 'Human Resources');
      assert.equal(resolveDepartmentName('unknown-id', lookups.departmentNameById), 'unknown-id');

      assert.equal(resolveDesignationName('des-2', lookups.designationNameById), 'Senior Accountant');
      assert.equal(resolveDesignationName('unknown-id', lookups.designationNameById), 'unknown-id');

      assert.equal(resolveEmployeeName('emp-1', lookups.employeeNameById), 'Aarav Sharma');
      assert.equal(resolveEmployeeName(null, lookups.employeeNameById), '—');

      assert.equal(resolveShreniName('S2', lookups.shreniNameByCode), 'S2 — Level 2 (Junior Assistant)');
      assert.equal(resolveShreniName('S7', lookups.shreniNameByCode), 'S7 — Level 7 (Senior Officer)');
      assert.equal(resolveShreniName('unknown', lookups.shreniNameByCode), 'unknown');
      assert.equal(resolveShreniName(null, lookups.shreniNameByCode), '—');
    });
  });
});

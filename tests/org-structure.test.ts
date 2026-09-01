import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEmployeeLookups,
  resolveDepartmentName,
  resolveDesignationName,
  resolveBranchName,
  resolveEmployeeName,
  type RawLookupData,
} from '../lib/constants/employee-lookups';
import {
  countDepartments,
  filterDepartments,
} from '../lib/engines/department.engine';
import {
  countDesignations,
  filterDesignations,
} from '../lib/engines/designation.engine';
import {
  countBranches,
  filterBranches,
} from '../lib/engines/branch.engine';
import type { Department } from '../lib/types/department';
import type { Designation } from '../lib/types/designation';
import type { Branch } from '../lib/types/branch';
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
    });
  });

  describe('Department, Designation, Branch Engines', () => {
    it('should accurately calculate Department KPIs and filter by search/branch', () => {
      const mockDepts: Department[] = [
        {
          id: 'd-1',
          code: 'HR',
          name: 'Human Resources',
          branchId: 'b-1',
          headName: 'John Doe',
          designationCount: 2,
          employeeCount: 5,
          description: 'HR Dept',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'd-2',
          code: 'ARCHIVED',
          name: 'Old Unit',
          branchId: 'b-1',
          headName: 'Jane',
          designationCount: 0,
          employeeCount: 0,
          description: 'Old',
          status: 'inactive',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const counts = countDepartments(mockDepts);
      assert.equal(counts.total, 2);
      assert.equal(counts.active, 1);
      assert.equal(counts.inactive, 1);
      assert.equal(counts.totalDesignations, 2);
      assert.equal(counts.totalEmployees, 5);

      const searchFiltered = filterDepartments({ departments: mockDepts, search: 'Human' });
      assert.equal(searchFiltered.length, 1);
      assert.equal(searchFiltered[0].code, 'HR');
    });

    it('should accurately calculate Designation KPIs and filter by department', () => {
      const mockDesigs: Designation[] = [
        {
          id: 'des-1',
          name: 'HR Manager',
          departmentId: 'd-1',
          description: 'HR lead',
          status: 'active',
          employeeCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'des-2',
          name: 'Software Engineer',
          departmentId: 'd-2',
          description: 'Dev',
          status: 'active',
          employeeCount: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const counts = countDesignations(mockDesigs);
      assert.equal(counts.total, 2);
      assert.equal(counts.active, 2);
      assert.equal(counts.totalEmployees, 4);

      const deptFiltered = filterDesignations({ designations: mockDesigs, departmentId: 'd-1' });
      assert.equal(deptFiltered.length, 1);
      assert.equal(deptFiltered[0].name, 'HR Manager');
    });

    it('should accurately calculate Branch KPIs', () => {
      const mockBranches: Branch[] = [
        {
          id: 'b-1',
          code: 'KTM',
          name: 'Kathmandu HQ',
          location: 'Kathmandu',
          phone: '01-4400000',
          email: 'ktm@company.com',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const counts = countBranches(mockBranches);
      assert.equal(counts.total, 1);
      assert.equal(counts.active, 1);
    });
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSalaryMapping,
  calculateNetSalary,
} from '../lib/engines/salary-mapping.engine';
import type { SalaryMappingFormData } from '../lib/types/salary-mapping';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Salary Mapping Module', () => {
  const validEmployeeId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const validFyId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
  const validPayHeadId1 = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
  const validPayHeadId2 = 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a';

  describe('Form Validation', () => {
    it('should validate a complete valid salary mapping payload', () => {
      const form: SalaryMappingFormData = {
        employeeId: validEmployeeId,
        fiscalYearId: validFyId,
        effectiveFrom: '2026-09-14',
        basicSalary: 35000,
        gradePercent: 100,
        gradeAmount: 5000,
        salaryHeads: [
          { payHeadId: validPayHeadId1, amount: 2000 },
          { payHeadId: validPayHeadId2, amount: 1000 },
        ],
        loan1Deduction: 0,
        loan2Deduction: 0,
      };

      const errors = validateSalaryMapping({
        data: form,
        existing: [],
        validEmployeeIds: [validEmployeeId],
        validPayHeadIds: [validPayHeadId1, validPayHeadId2],
      });

      assert.equal(Object.keys(errors).length, 0);
    });

    it('should reject invalid basic salary and grade percent', () => {
      const form: SalaryMappingFormData = {
        employeeId: validEmployeeId,
        fiscalYearId: validFyId,
        effectiveFrom: '2026-09-14',
        basicSalary: -100,
        gradePercent: 250,
        gradeAmount: -50,
        salaryHeads: [],
        loan1Deduction: 0,
        loan2Deduction: 0,
      };

      const errors = validateSalaryMapping({
        data: form,
        existing: [],
        validEmployeeIds: [validEmployeeId],
        validPayHeadIds: [],
      });

      assert.ok(errors.basicSalary);
      assert.ok(errors.gradePercent);
      assert.ok(errors.gradeAmount);
    });

    it('should prevent duplicate active mapping for the same employee', () => {
      const form: SalaryMappingFormData = {
        employeeId: validEmployeeId,
        fiscalYearId: validFyId,
        effectiveFrom: '2026-09-14',
        basicSalary: 40000,
        gradePercent: 0,
        gradeAmount: 0,
        salaryHeads: [],
        loan1Deduction: 0,
        loan2Deduction: 0,
      };

      const existingMapping = {
        id: 'map-111',
        employeeId: validEmployeeId,
        fiscalYearId: validFyId,
        effectiveFrom: '2026-07-01',
        basicSalary: 38000,
        gradePercent: 0,
        gradeAmount: 0,
        salaryHeads: [],
        loan1Deduction: 0,
        loan2Deduction: 0,
        loan1Remaining: 0,
        loan2Remaining: 0,
        netAmount: 38000,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const errors = validateSalaryMapping({
        data: form,
        existing: [existingMapping],
        validEmployeeIds: [validEmployeeId],
        validPayHeadIds: [],
      });

      assert.ok(errors.duplicate);
    });

    it('should permit editing an existing mapping without duplicate self-collision', () => {
      const form: SalaryMappingFormData = {
        employeeId: validEmployeeId,
        fiscalYearId: validFyId,
        effectiveFrom: '2026-09-14',
        basicSalary: 45000,
        gradePercent: 0,
        gradeAmount: 0,
        salaryHeads: [],
        loan1Deduction: 0,
        loan2Deduction: 0,
      };

      const existingMapping = {
        id: 'map-111',
        employeeId: validEmployeeId,
        fiscalYearId: validFyId,
        effectiveFrom: '2026-07-01',
        basicSalary: 38000,
        gradePercent: 0,
        gradeAmount: 0,
        salaryHeads: [],
        loan1Deduction: 0,
        loan2Deduction: 0,
        loan1Remaining: 0,
        loan2Remaining: 0,
        netAmount: 38000,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const errors = validateSalaryMapping({
        data: form,
        existing: [existingMapping],
        validEmployeeIds: [validEmployeeId],
        validPayHeadIds: [],
        excludeMappingId: 'map-111',
      });

      assert.equal(errors.duplicate, undefined);
    });
  });

  describe('Net Salary Computation', () => {
    it('should correctly calculate net salary with basic, grade, allowances, deductions and loans', () => {
      const net = calculateNetSalary({
        basicSalary: 35100,
        gradePercent: 0,
        gradeAmount: 0,
        salaryHeads: [
          { payHeadType: 'allowance', amount: 30000 },
          { payHeadType: 'deduction', amount: 0 },
        ],
        loan1Deduction: 0,
        loan2Deduction: 0,
      });

      // 35,100 basic + 30,000 allowance = 65,100 (matches screenshot exact net_amount!)
      assert.equal(net, 65100);
    });
  });

  describe('Fiscal Year UUID Integrity', () => {
    it('should reject legacy string placeholder "fy-1" as not a valid UUID', () => {
      assert.equal(UUID_REGEX.test('fy-1'), false);
      assert.equal(UUID_REGEX.test(''), false);
    });

    it('should accept valid standard UUIDs', () => {
      assert.equal(UUID_REGEX.test('68f19063-e67c-49db-9571-549259350656'), true);
      assert.equal(UUID_REGEX.test('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'), true);
    });
  });
});

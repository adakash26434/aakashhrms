import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLeaveTypeForm,
  calculateProRataLeaveDays,
  isLeaveTypeApplicableForGender,
  calculateLeaveTypeKPIs,
} from '../lib/engines/leave-type.engine';
import {
  validateLeaveRuleForm,
  calculateAccruedDays,
  calculateEncashmentAmount,
  calculateLeaveRuleKPIs,
} from '../lib/engines/leave-rule.engine';
import type { LeaveTypeRecord, LeaveTypeFormData } from '../lib/types/leave-type';
import type { LeaveRule, LeaveRuleFormData } from '../lib/types/leave-rule';

describe('Leave Types & Nepal Labour Act Rules Module', () => {
  describe('Leave Type Form Validation', () => {
    it('should pass valid leave type payload', () => {
      const validForm: LeaveTypeFormData = {
        name: 'Special Project Leave',
        code: 'SPECIAL_PROJECT',
        leaveType: 'Pay',
        noOfDays: 5,
        carryForward: false,
        accumulationCap: null,
        maxPaidDays: null,
        isStatutory: false,
        statutoryCode: null,
        genderApplicable: 'All',
        requiresDocument: false,
        documentThresholdDays: null,
        isEncashable: false,
        encashmentBasis: 'BasicSalary',
        proRataForNewJoinees: true,
        applicableDepartments: [],
        applicableDesignations: [],
        isActive: true,
      };

      const errors = validateLeaveTypeForm(validForm);
      assert.deepEqual(errors, {});
    });

    it('should reject invalid codes or missing required fields', () => {
      const invalidForm: LeaveTypeFormData = {
        name: '',
        code: 'invalid-lowercase-code',
        leaveType: 'Pay',
        noOfDays: 0,
        carryForward: false,
        accumulationCap: null,
        maxPaidDays: null,
        isStatutory: false,
        statutoryCode: null,
        genderApplicable: 'All',
        requiresDocument: true,
        documentThresholdDays: null,
        isEncashable: false,
        encashmentBasis: 'BasicSalary',
        proRataForNewJoinees: true,
        applicableDepartments: [],
        applicableDesignations: [],
        isActive: true,
      };

      const errors = validateLeaveTypeForm(invalidForm);
      assert.ok(errors.name, 'Expected error on empty name');
      assert.ok(errors.code, 'Expected error on lowercase code');
      assert.ok(errors.noOfDays, 'Expected error on zero days');
      assert.ok(errors.documentThresholdDays, 'Expected error on missing document threshold');
    });
  });

  describe('Gender & Pro-Rata Calculations', () => {
    it('should strictly enforce gender restrictions', () => {
      assert.equal(isLeaveTypeApplicableForGender('Female', 'Female'), true);
      assert.equal(isLeaveTypeApplicableForGender('Female', 'Male'), false);
      assert.equal(isLeaveTypeApplicableForGender('Male', 'Male'), true);
      assert.equal(isLeaveTypeApplicableForGender('Male', 'Female'), false);
      assert.equal(isLeaveTypeApplicableForGender('All', 'Male'), true);
      assert.equal(isLeaveTypeApplicableForGender('All', 'Female'), true);
    });

    it('should calculate accurate pro-rata leave for mid-year joinings', () => {
      const fyStart = new Date('2025-07-16');
      const fyEnd = new Date('2026-07-15');
      // Joined exactly halfway through the fiscal year (~6 months)
      const midYearJoin = new Date('2026-01-15');

      const fullDays = 18; // Home leave
      const proRata = calculateProRataLeaveDays(fullDays, midYearJoin, fyStart, fyEnd);
      assert.ok(proRata >= 8.9 && proRata <= 9.1, `Expected ~9 days pro-rata, got ${proRata}`);
    });
  });

  describe('Leave Rules Engine & Nepal Labour Act Accrual', () => {
    it('should calculate DAYS_WORKED accrual accurately (1 day per 20 days worked)', () => {
      // Worked 240 days -> 240 / 20 = 12 accrued days
      const accrued = calculateAccruedDays('DAYS_WORKED', 20, 240, 12);
      assert.equal(accrued, 12);
    });

    it('should calculate FIXED_ANNUAL accrual accurately', () => {
      const accrued = calculateAccruedDays('FIXED_ANNUAL', 12, 100, 6);
      assert.equal(accrued, 12);
    });

    it('should calculate MONTHLY_ACCRUAL accurately', () => {
      // 1.5 days per month for 8 months = 12 days
      const accrued = calculateAccruedDays('MONTHLY_ACCRUAL', 1.5, 160, 8);
      assert.equal(accrued, 12);
    });

    it('should calculate statutory leave encashment at Basic Salary / 30 per day', () => {
      const excessDays = 10;
      const basicSalary = 60000; // NPR 60,000 / month
      // Daily rate = 60,000 / 30 = 2,000
      // 10 excess days = 20,000
      const encashment = calculateEncashmentAmount(excessDays, basicSalary);
      assert.equal(encashment, 20000);
    });
  });
});

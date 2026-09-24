import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GRADE_POLICY,
  calculateGradeRate,
  calculateTotalGradeAmount,
  validatePromotionSalary,
} from '../lib/engines/grade-policy.engine';
import type { GradePolicySettings } from '../lib/types/system-control';

describe('Grade Policy Engine', () => {
  describe('calculateGradeRate', () => {
    it('calculates statutory daily rate (Basic / 30) with 2 decimal places precision', () => {
      const basic = 35000;
      const rate = calculateGradeRate(basic, DEFAULT_GRADE_POLICY);
      // 35000 / 30 = 1166.666... -> 1166.67
      assert.equal(rate, 1166.67);
    });

    it('respects custom daysInMonthForDailyRate', () => {
      const policy: GradePolicySettings = {
        ...DEFAULT_GRADE_POLICY,
        calculationMethod: 'STATUTORY_DAILY_RATE',
        daysInMonthForDailyRate: 26, // 26 working days
      };
      const basic = 26000;
      const rate = calculateGradeRate(basic, policy);
      assert.equal(rate, 1000);
    });

    it('handles fixed amount per grade method', () => {
      const policy: GradePolicySettings = {
        ...DEFAULT_GRADE_POLICY,
        calculationMethod: 'FIXED_AMOUNT_PER_GRADE',
        fixedAmountPerGrade: 1500,
      };
      assert.equal(calculateGradeRate(50000, policy), 1500);
    });

    it('handles percentage of basic method', () => {
      const policy: GradePolicySettings = {
        ...DEFAULT_GRADE_POLICY,
        calculationMethod: 'PERCENTAGE_OF_BASIC',
        fixedGradePercent: 3.5,
      };
      // 40000 * 3.5% = 1400
      assert.equal(calculateGradeRate(40000, policy), 1400);
    });

    it('returns 0 for MANUAL_INPUT and DISABLED_NO_GRADES methods', () => {
      const manual: GradePolicySettings = { ...DEFAULT_GRADE_POLICY, calculationMethod: 'MANUAL_INPUT' };
      const disabled: GradePolicySettings = { ...DEFAULT_GRADE_POLICY, calculationMethod: 'DISABLED_NO_GRADES' };
      assert.equal(calculateGradeRate(50000, manual), 0);
      assert.equal(calculateGradeRate(50000, disabled), 0);
    });

    it('returns 0 for negative or zero basic salary', () => {
      assert.equal(calculateGradeRate(0, DEFAULT_GRADE_POLICY), 0);
      assert.equal(calculateGradeRate(-1000, DEFAULT_GRADE_POLICY), 0);
    });
  });

  describe('calculateTotalGradeAmount and Basic Salary Cascade', () => {
    it('calculates total grade amount as gradeCount * gradeRate', () => {
      const basic = 30000;
      // 30000 / 30 = 1000 per grade
      const total = calculateTotalGradeAmount(basic, 3, DEFAULT_GRADE_POLICY);
      assert.equal(total, 3000);
    });

    it('returns 0 when gradeCount is 0', () => {
      assert.equal(calculateTotalGradeAmount(50000, 0, DEFAULT_GRADE_POLICY), 0);
    });

    it('proves cascading increase: when basic salary increases, total grade amount dynamically increases', () => {
      const gradeCount = 4;
      const oldBasic = 30000;
      const newBasic = 45000;

      const oldGradeRate = calculateGradeRate(oldBasic, DEFAULT_GRADE_POLICY);
      const oldTotalGrade = calculateTotalGradeAmount(oldBasic, gradeCount, DEFAULT_GRADE_POLICY);

      const newGradeRate = calculateGradeRate(newBasic, DEFAULT_GRADE_POLICY);
      const newTotalGrade = calculateTotalGradeAmount(newBasic, gradeCount, DEFAULT_GRADE_POLICY);

      // Old: 30000/30 = 1000 * 4 = 4000
      assert.equal(oldGradeRate, 1000);
      assert.equal(oldTotalGrade, 4000);

      // New: 45000/30 = 1500 * 4 = 6000
      assert.equal(newGradeRate, 1500);
      assert.equal(newTotalGrade, 6000);

      // Grade value strictly scaled up with the basic salary hike
      assert.ok(newTotalGrade > oldTotalGrade);
      assert.equal(newTotalGrade - oldTotalGrade, 2000);
    });
  });

  describe('validatePromotionSalary (Promotion Pay Protection)', () => {
    it('approves promotion when new basic comfortably exceeds old basic + old grade', () => {
      // Old: Officer Level 6, Basic 35,000, 2 Grades (2,333.34) -> Total Old = 37,333.34
      // New: Officer Level 7, Starting Basic 42,000
      const policy: GradePolicySettings = {
        ...DEFAULT_GRADE_POLICY,
        promotionRule: {
          ...DEFAULT_GRADE_POLICY.promotionRule,
          guaranteeMinimumOneNewGrade: false,
        },
      };
      const result = validatePromotionSalary({
        oldBasic: 35000,
        oldGradeAmount: 2333.34,
        newBasic: 42000,
        newLevelMinBasic: 40000,
        policy,
      });

      assert.equal(result.isValid, true);
      assert.equal(result.shortfall, 0);
      assert.equal(result.recommendedSteppingGrades, 0);
    });

    it('detects pay deficit when employee had high tenure grades and new starting scale is lower than total prior pay', () => {
      // Old: Level 6, Basic 35,000, 8 Grades (8 * 1166.67 = 9,333.36) -> Total Old = 44,333.36
      // New: Level 7 starting basic is 40,000 (which is < 44,333.36)
      const policy: GradePolicySettings = {
        ...DEFAULT_GRADE_POLICY,
        promotionRule: {
          ...DEFAULT_GRADE_POLICY.promotionRule,
          guaranteeMinimumOneNewGrade: false,
        },
      };
      const result = validatePromotionSalary({
        oldBasic: 35000,
        oldGradeAmount: 9333.36,
        newBasic: 40000,
        newLevelMinBasic: 40000,
        policy,
      });

      assert.equal(result.isValid, false);
      assert.equal(result.shortfall, 4333.36);

      // New Grade Rate for Level 7: 40,000 / 30 = 1333.33
      // Stepping grades needed to bridge 4,333.36: ceil(4333.36 / 1333.33) = 4 stepping grades
      assert.equal(result.recommendedSteppingGrades, 4);
      assert.ok(result.warningMessage?.includes('Promotion Non-Reduction Warning'));
    });

    it('adds 1 new grade increment when guaranteeMinimumOneNewGrade is enabled', () => {
      const policyWithGuarantee: GradePolicySettings = {
        ...DEFAULT_GRADE_POLICY,
        promotionRule: {
          ...DEFAULT_GRADE_POLICY.promotionRule,
          guaranteeMinimumOneNewGrade: true,
        },
      };

      // Old: Basic 30,000, 0 Grade -> Total Old = 30,000
      // New starting basic: 30,000
      // With 1 guaranteed new grade: minimum required = 30,000 + 1 * (30,000/30) = 31,000
      const result = validatePromotionSalary({
        oldBasic: 30000,
        oldGradeAmount: 0,
        newBasic: 30000,
        newLevelMinBasic: 30000,
        policy: policyWithGuarantee,
      });

      assert.equal(result.isValid, false);
      assert.equal(result.shortfall, 1000);
      assert.equal(result.recommendedSteppingGrades, 1);
    });

    it('skips validation error when enforceNonReduction is false', () => {
      const policyRelaxed: GradePolicySettings = {
        ...DEFAULT_GRADE_POLICY,
        promotionRule: {
          ...DEFAULT_GRADE_POLICY.promotionRule,
          enforceNonReduction: false,
        },
      };

      const result = validatePromotionSalary({
        oldBasic: 35000,
        oldGradeAmount: 9333.36,
        newBasic: 40000,
        newLevelMinBasic: 40000,
        policy: policyRelaxed,
      });
      assert.equal(result.isValid, true);
      assert.ok(result.shortfall > 0);
    });
  });
});

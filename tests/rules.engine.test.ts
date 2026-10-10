import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADE_METHODS,
  applyRulesForm,
  formatRule,
  gradePolicyChanged,
  gradePolicyOf,
  normalizeRulesForm,
  rulesAreValid,
  rulesChanges,
  rulesFormOf,
  validateRulesForm,
} from '../lib/engines/rules.engine';
import { DEFAULT_GRADE_POLICY } from '../lib/engines/grade-policy.engine';
import type { RulesForm, SystemControlData } from '../lib/types/system-control';

// Rules & controls (4.12b): the flat form over the stored settings, its checks, the change list
// shown before Save, and when a change touches salaries (the grade policy).

const SETTINGS: SystemControlData = {
  officeTime: { inTime: { hour: 10, minute: 0, meridiem: 'AM' }, outTime: { hour: 5, minute: 0, meridiem: 'PM' }, calculateOtAndAbsent: true, applyGraceWindow: true, graceWindowMinutes: 15, otMultiplierOfficeDay: 1.5, otMultiplierOffDay: 2 },
  manualAttendance: { defaultWhenNotPosted: 'Absent' },
  leavePermissions: { enabledCategories: { Permanent: true, Temporary: true, OutSource: false, Consultant: false, Trainee: false, Volunteer: false, Contract: true } },
  statutoryDeductionLimits: { pfMaximumLimitPercent: 30, citLimitNpr: 300000, retirementFundLimitNpr: 500000, handicappedDeductionPercent: 0, companyHasSsf: true, ssfContributionBase: 'BasicPlusGrade' },
  insuranceDiscounts: { medicalInsuranceNpr: 20000, houseInsuranceNpr: 5000, lifeInsuranceNpr: 40000, womenDiscountPercent: 10, handicappedDiscountPercent: 0, remoteAllowanceNpr: 50000 },
  gradePolicy: { ...DEFAULT_GRADE_POLICY, promotionRule: { enforceNonReduction: false, guaranteeMinimumOneNewGrade: true, handlingMethod: 'DIRECT_BASIC_ADJUSTMENT' } },
};

const FORM = rulesFormOf(SETTINGS);
const withForm = (over: Partial<RulesForm>): RulesForm => ({ ...FORM, ...over });

describe('rules form over the stored settings (4.12b)', () => {
  it('reads the rules payroll uses', () => {
    assert.deepEqual(FORM, {
      pfMaxPercent: 30,
      citLimit: 300000,
      retirementLimit: 500000,
      lifeInsuranceLimit: 40000,
      healthInsuranceLimit: 20000,
      houseInsuranceLimit: 5000,
      remoteAreaLimit: 50000,
      womenRebatePercent: 10,
      companyHasSsf: true,
      ssfBase: 'BasicPlusGrade',
      otWorkDay: 1.5,
      otOffDay: 2,
      gradeMethod: 'STATUTORY_DAILY_RATE',
      gradeDaysInMonth: 30,
      gradePercent: 3.33,
      gradeAmount: 0,
      gradeMax: 10,
    });
  });

  it('writes them back and leaves every other setting as it was', () => {
    const next = withForm({ citLimit: 350000, otOffDay: 2.5, ssfBase: 'BasicSalary', gradeMethod: 'FIXED_AMOUNT_PER_GRADE', gradeAmount: 1200 });
    const saved = applyRulesForm(SETTINGS, next);
    assert.deepEqual(rulesFormOf(saved), next);
    assert.deepEqual(saved.officeTime.inTime, SETTINGS.officeTime.inTime);
    assert.equal(saved.officeTime.graceWindowMinutes, 15);
    assert.deepEqual(saved.leavePermissions, SETTINGS.leavePermissions);
    assert.deepEqual(saved.manualAttendance, SETTINGS.manualAttendance);
    assert.deepEqual(saved.gradePolicy?.promotionRule, SETTINGS.gradePolicy?.promotionRule, 'the promotion rule is kept');
    assert.equal(saved.insuranceDiscounts.handicappedDiscountPercent, 0);
  });

  it('takes numbers, yes / no and known choices from the browser only', () => {
    const f = normalizeRulesForm({ ...FORM, citLimit: '3,50,000', companyHasSsf: 'true', ssfBase: 'Other', gradeMethod: 'SOMETHING' });
    assert.equal(f.citLimit, 350000);
    assert.equal(f.companyHasSsf, false, 'only a real true');
    assert.equal(f.ssfBase, 'BasicPlusGrade');
    assert.equal(validateRulesForm(f).gradeMethod, 'Choose how grades are worked out.');
    assert.ok(Number.isNaN(normalizeRulesForm({}).citLimit));
  });
});

describe('rules checks (4.12b)', () => {
  it('a stored set of rules passes', () => assert.ok(rulesAreValid(validateRulesForm(FORM))));

  it('percentages, rupees and the overtime floor', () => {
    const e = validateRulesForm(withForm({ pfMaxPercent: 101, womenRebatePercent: 10.555, citLimit: -1, lifeInsuranceLimit: 100.5, otWorkDay: 1.25, otOffDay: 6 }));
    assert.equal(e.pfMaxPercent, '0 to 100.');
    assert.equal(e.womenRebatePercent, 'At most two decimals.');
    assert.equal(e.citLimit, 'Whole rupees, 0 or more.');
    assert.equal(e.lifeInsuranceLimit, 'Whole rupees, 0 or more.');
    assert.equal(e.otWorkDay, 'At least 1.5 (Labour Act 2074).');
    assert.equal(e.otOffDay, 'At most 5.');
    assert.ok(rulesAreValid(validateRulesForm(withForm({ otWorkDay: 2, otOffDay: 1.5, citLimit: 0 }))), 'more than the law, and 0 relief, are fine');
  });

  it('the grade policy needs its own figure', () => {
    assert.equal(validateRulesForm(withForm({ gradeMethod: 'PERCENTAGE_OF_BASIC', gradePercent: 0 })).gradePercent, 'Give the share of basic one grade is.');
    assert.equal(validateRulesForm(withForm({ gradeMethod: 'FIXED_AMOUNT_PER_GRADE', gradeAmount: 0 })).gradeAmount, 'Give the amount one grade is.');
    assert.equal(validateRulesForm(withForm({ gradeDaysInMonth: 0 })).gradeDaysInMonth, '1 to 32 days.');
    assert.equal(validateRulesForm(withForm({ gradeMax: 101 })).gradeMax, '0 (no limit) to 100 grades.');
    assert.ok(rulesAreValid(validateRulesForm(withForm({ gradeMethod: 'MANUAL_INPUT', gradeAmount: 0 }))));
    assert.equal(GRADE_METHODS.length, 5);
  });
});

describe('the change list and the grade policy (4.12b)', () => {
  it('lists each changed rule in words', () => {
    assert.deepEqual(rulesChanges(FORM, { ...FORM }), []);
    assert.deepEqual(rulesChanges(FORM, withForm({ citLimit: 350000, companyHasSsf: false, otOffDay: 2.5, gradeMax: 0 })), [
      { key: 'citLimit', label: 'CIT counted a year', from: 'NPR 3,00,000', to: 'NPR 3,50,000' },
      { key: 'companyHasSsf', label: 'The company is in SSF', from: 'Yes', to: 'No' },
      { key: 'otOffDay', label: 'Overtime on an off day', from: '2×', to: '2.5×' },
      { key: 'gradeMax', label: 'Most grades counted', from: '10 grades', to: 'No limit' },
    ]);
    assert.equal(formatRule('gradeMethod', 'PERCENTAGE_OF_BASIC'), 'A share of basic per grade');
    assert.equal(formatRule('ssfBase', 'BasicSalary'), 'Basic salary only');
  });

  it('only a change that can move a grade amount counts as a grade-policy change', () => {
    assert.equal(gradePolicyChanged(FORM, withForm({ citLimit: 1 })), false);
    assert.equal(gradePolicyChanged(FORM, withForm({ gradePercent: 5 })), false, 'the percent is not used by the daily rate');
    assert.equal(gradePolicyChanged(FORM, withForm({ gradeDaysInMonth: 31 })), true);
    assert.equal(gradePolicyChanged(FORM, withForm({ gradeMax: 12 })), true);
    assert.equal(gradePolicyChanged(FORM, withForm({ gradeMethod: 'MANUAL_INPUT' })), true);
    const manual = withForm({ gradeMethod: 'MANUAL_INPUT' });
    assert.equal(gradePolicyChanged(manual, { ...manual, gradeMax: 3 }), false, 'nothing is worked out');
    assert.deepEqual(gradePolicyOf(withForm({ gradeMethod: 'FIXED_AMOUNT_PER_GRADE', gradeAmount: 900 }), SETTINGS.gradePolicy), {
      calculationMethod: 'FIXED_AMOUNT_PER_GRADE',
      daysInMonthForDailyRate: 30,
      fixedGradePercent: 3.33,
      fixedAmountPerGrade: 900,
      maxGradesAllowedPerLevel: 10,
      promotionRule: SETTINGS.gradePolicy!.promotionRule,
    });
  });
});

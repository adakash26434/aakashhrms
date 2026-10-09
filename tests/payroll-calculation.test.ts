import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { calculatePayslip, isSsfEmployerHead, isSsfDeductionHead, ssfContribution, type PayHeadInput, type TaxSlabInput, type EmployeeInput, EMPTY_YTD, projectTds, ytdFromSlips, calculateBonusSlip } from '../lib/engines/payroll.engine';
import type { SystemControlData } from '../lib/types/system-control';

/** 4.8b: a first month of the year with nothing paid yet (equals the old "this month × 12" projection). */
const NO_YTD = { ytd: EMPTY_YTD, monthsRemaining: 12 };

const MOCK_SYSTEM_CONTROL: SystemControlData = {
  officeTime: {
    inTime: { hour: 9, minute: 0, meridiem: "AM" },
    outTime: { hour: 5, minute: 0, meridiem: "PM" },
    calculateOtAndAbsent: false,
    applyGraceWindow: false,
    graceWindowMinutes: 40,
    otMultiplierOfficeDay: 1.5,
    otMultiplierOffDay: 2.0,
  },
  manualAttendance: {
    defaultWhenNotPosted: "Absent",
  },
  leavePermissions: {
    enabledCategories: {
      Permanent: true,
      Temporary: true,
      OutSource: false,
      Consultant: false,
      Trainee: false,
      Volunteer: false,
      Contract: true,
    },
  },
  statutoryDeductionLimits: {
    pfMaximumLimitPercent: 30,
    citLimitNpr: 300000,
    retirementFundLimitNpr: 500000,
    companyHasSsf: false,
  },
  insuranceDiscounts: {
    medicalInsuranceNpr: 20000,
    houseInsuranceNpr: 5000,
    lifeInsuranceNpr: 40000,
    womenDiscountPercent: 10,
    handicappedDiscountPercent: 0,
    remoteAllowanceNpr: 50000,
  },
};

const MOCK_TAX_SLABS: TaxSlabInput[] = [
  { id: 'slab-1', category: 'Normal Single', amountFrom: '0', amountTo: '500000', ratePercent: '1', fixedDeduction: '0' },
  { id: 'slab-2', category: 'Normal Single', amountFrom: '500000', amountTo: '700000', ratePercent: '10', fixedDeduction: '0' },
  { id: 'slab-3', category: 'Normal Single', amountFrom: '700000', amountTo: '1000000', ratePercent: '20', fixedDeduction: '0' },
  { id: 'slab-4', category: 'Normal Single', amountFrom: '1000000', amountTo: '2000000', ratePercent: '30', fixedDeduction: '0' },
  { id: 'slab-5', category: 'Normal Single', amountFrom: '2000000', amountTo: null, ratePercent: '36', fixedDeduction: '0' },

  { id: 'slab-h1', category: 'Handicapped', amountFrom: '0', amountTo: '500000', ratePercent: '1', fixedDeduction: '0' },
  { id: 'slab-h2', category: 'Handicapped', amountFrom: '500000', amountTo: '700000', ratePercent: '5', fixedDeduction: '2500' },
  { id: 'slab-h3', category: 'Handicapped', amountFrom: '700000', amountTo: '2000000', ratePercent: '10', fixedDeduction: '12500' },
  { id: 'slab-h4', category: 'Handicapped', amountFrom: '2000000', amountTo: null, ratePercent: '15', fixedDeduction: '142500' },
];

const BASE_EMPLOYEE: EmployeeInput = {
  id: 'emp-101',
  category: 'Permanent',
  gender: 'Male',
  isDisabled: false,
  taxStatus: 'Normal Single',
  joiningDate: '2024-01-01',
};

describe('Payroll Calculation & Syncing Engine', () => {
  it('should preserve fixed allowances assigned to employee even if calcPercent is 0 or calcBasis is BasicSalary', () => {
    // Dearness Allowance (DA) and House Rent Allowance (HRA) seeded with calcBasis: BasicSalary, calcPercent: 0
    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-da',
        code: 'DA',
        name: 'Dearness Allowance (महङ्गी भत्ता)',
        type: 'allowance',
        effectOnTax: true,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '5000', // Mapped 5,000 NPR in Salary Mapping
      },
      {
        id: 'head-hra',
        code: 'HRA',
        name: 'House Rent Allowance (घरभाडा भत्ता)',
        type: 'allowance',
        effectOnTax: true,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '0', // Even when calcParameter is BasicSalary, 0% should NOT zero out the mapped amount!
        amount: '8000', // Mapped 8,000 NPR
      },
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'Tax Deducted at Source (TDS)',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
      {
        id: 'head-pf',
        code: 'EPF',
        name: 'Provident Fund (EPF 10%)',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: true,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '0', // Seeded with 0, but statutory PF is 10%
        amount: '0',
      },
    ];

    const result = calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: {
        basicSalary: '40000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    // Basic: 40,000 + DA: 5,000 + HRA: 8,000 = Gross: 53,000
    assert.equal(result.grossEarnings, '53000');

    // Mapped DA and HRA must be in calculated heads with their assigned amounts
    const daHead = result.heads.find((h) => h.payHeadId === 'head-da');
    assert.ok(daHead, 'DA head should be present in calculated breakdown');
    assert.equal(daHead.calculatedAmount, '5000');

    const hraHead = result.heads.find((h) => h.payHeadId === 'head-hra');
    assert.ok(hraHead, 'HRA head should be present in calculated breakdown');
    assert.equal(hraHead.calculatedAmount, '8000');

    // PF should default to statutory 10% of 40,000 = 4,000
    assert.equal(result.pfEmployee, '4000');
    assert.equal(result.pfEmployer, '4000');

    // Gross - Deductions = Net Payable
    const gross = new Decimal(result.grossEarnings);
    const deductions = new Decimal(result.totalDeductions);
    const net = new Decimal(result.netPayable);
    assert.ok(gross.minus(deductions).equals(net), 'Net payable must exactly equal Gross - Total Deductions');
  });

  it('should calculate percentage-based allowances dynamically when calcPercent > 0', () => {
    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-pct-allowance',
        code: 'ALLOW_15',
        name: 'Technical Allowance 15%',
        type: 'allowance',
        effectOnTax: true,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '15',
        amount: '0',
      },
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'TDS',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
      {
        id: 'head-pf',
        code: 'EPF',
        name: 'Provident Fund',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: true,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '10',
        amount: '0',
      },
    ];

    const result = calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: {
        basicSalary: '50000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    // 15% of 50,000 = 7,500
    const techHead = result.heads.find((h) => h.payHeadId === 'head-pct-allowance');
    assert.ok(techHead);
    assert.equal(techHead.calculatedAmount, '7500');

    // Gross = 50,000 + 7,500 = 57,500
    assert.equal(result.grossEarnings, '57500');
  });

  it('should accurately sync non-statutory deductions into total deductions and slip heads', () => {
    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-welfare',
        code: 'WELFARE',
        name: 'Staff Welfare Fund',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary', // Even if seeded with BasicSalary, amount must be preserved
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '500', // Mapped 500 NPR
      },
      {
        id: 'head-union',
        code: 'UNION',
        name: 'Union Fee',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '200', // Mapped 200 NPR
      },
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'TDS',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
      {
        id: 'head-pf',
        code: 'EPF',
        name: 'Provident Fund',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: true,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '10',
        amount: '0',
      },
    ];

    const result = calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: {
        basicSalary: '30000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '1000', // Active loan deduction
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    // Check non-statutory deductions in slip heads
    const welfare = result.heads.find((h) => h.payHeadId === 'head-welfare');
    assert.ok(welfare);
    assert.equal(welfare.calculatedAmount, '500');

    const union = result.heads.find((h) => h.payHeadId === 'head-union');
    assert.ok(union);
    assert.equal(union.calculatedAmount, '200');

    // Total deductions = non-statutory (500 + 200) + PF (3,000) + Loan (1,000) + TDS
    const totalDeductionsDecimal = new Decimal(result.totalDeductions);
    const expectedMinDeductions = new Decimal(500 + 200 + 3000 + 1000);
    assert.ok(
      totalDeductionsDecimal.gte(expectedMinDeductions),
      `Total deductions (${result.totalDeductions}) must include welfare (500) + union (200) + PF (3000) + loan (1000)`
    );
  });

  it('should correctly handle CIT mapped deduction and exclude non-taxable allowances from tax', () => {
    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-taxable-allowance',
        code: 'SPECIAL',
        name: 'Special Allowance',
        type: 'allowance',
        effectOnTax: true,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '10000',
      },
      {
        id: 'head-nontaxable-allowance',
        code: 'PER_DIEM',
        name: 'Per Diem Travel Reimbursement',
        type: 'allowance',
        effectOnTax: false, // NON-TAXABLE
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '5000',
      },
      {
        id: 'head-cit',
        code: 'CIT',
        name: 'Citizen Investment Trust',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: true,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '4000', // Mapped 4,000 CIT
      },
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'TDS',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
      {
        id: 'head-pf',
        code: 'EPF',
        name: 'Provident Fund',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: true,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '10',
        amount: '0',
      },
    ];

    const result = calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: {
        basicSalary: '50000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    // Gross includes both taxable and non-taxable: 50,000 + 10,000 + 5,000 = 65,000
    assert.equal(result.grossEarnings, '65000');

    // CIT deduction must equal mapped 4,000
    assert.equal(result.citDeduction, '4000');
    const citHead = result.heads.find((h) => h.payHeadId === 'head-cit');
    assert.ok(citHead);
    assert.equal(citHead.calculatedAmount, '4000');

    // PF deduction = 10% of 50,000 = 5,000
    assert.equal(result.pfEmployee, '5000');

    // Taxable monthly gross = Basic (50,000) + Taxable Allowance (10,000) = 60,000 (Non-taxable 5,000 is excluded!)
    // Annual taxable gross = 60,000 * 12 = 720,000
    // Retirement deduction = (PF 5,000 + CIT 4,000) * 12 = 108,000
    // Projected taxable income = 720,000 - 108,000 = 612,000
    // Monthly taxable income reported on payslip = 60,000 - 5,000 (PF) - 4,000 (CIT) = 51,000
    assert.equal(result.taxableIncome, '51000');
  });

  it('should compute SSF (11% employee / 20% employer addition / 31% total deduction) when SSF head is assigned', () => {
    const ssfSystemControl: SystemControlData = {
      ...MOCK_SYSTEM_CONTROL,
      statutoryDeductionLimits: {
        ...MOCK_SYSTEM_CONTROL.statutoryDeductionLimits,
        companyHasSsf: true,
        ssfContributionBase: 'BasicSalary',
      },
    };

    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-ssf-er',
        code: 'SSF-ER',
        name: 'SSF - Employer Contribution (20%)',
        type: 'allowance',
        effectOnTax: true,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isSsfEmployerHead: true,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '20',
        amount: '0',
      },
      {
        id: 'head-ssf',
        code: 'SSF',
        name: 'Social Security Fund (SSF 31%)',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: true,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '31',
        amount: '0',
      },
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'TDS',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
    ];

    const result = calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: {
        basicSalary: '40000',
        gradePercent: '0',
        gradeAmount: '5000',
      },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: ssfSystemControl,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    // Basic = 40,000 (when basis is BasicSalary)
    // SSF employee: 11% of 40,000 = 4,400
    // SSF employer: 20% of 40,000 = 8,000
    // Total SSF deduction: 31% of 40,000 = 12,400
    assert.equal(result.ssfEmployee, '4400');
    assert.equal(result.ssfEmployer, '8000');

    // PF must be 0 when SSF is active
    assert.equal(result.pfEmployee, '0');

    // Gross earnings includes +8,000 employer SSF addition (40,000 basic + 5,000 grade + 8,000 SSF ER = 53,000)
    assert.equal(result.grossEarnings, '53000');

    // Deduction head has full 31% = 12,400
    const ssfDedHead = result.heads.find((h) => h.payHeadId === 'head-ssf');
    assert.ok(ssfDedHead);
    assert.equal(ssfDedHead.calculatedAmount, '12400');

    // Employer addition head has 20% = 8,000
    const ssfErHead = result.heads.find((h) => h.payHeadId === 'head-ssf-er');
    assert.ok(ssfErHead);
    assert.equal(ssfErHead.calculatedAmount, '8000');

    // Net pay difference between gross additions and total SSF deduction is exactly -4,400 (-11% employee contribution)
    const netBeforeTax = Number(result.grossEarnings) - 12400;
    // 53,000 - 12,400 = 40,600 (which is 45,000 basic+grade - 4,400 employee contribution)
    assert.equal(netBeforeTax, 40600);
  });

  it('should not compute SSF for non-enrolled employees even if companyHasSsf is true', () => {
    const ssfSystemControl: SystemControlData = {
      ...MOCK_SYSTEM_CONTROL,
      statutoryDeductionLimits: {
        ...MOCK_SYSTEM_CONTROL.statutoryDeductionLimits,
        companyHasSsf: true,
      },
    };

    // Employee with only standard allowance and TDS, no SSF heads assigned
    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-ta',
        code: 'TA',
        name: 'Travel Allowance',
        type: 'allowance',
        effectOnTax: true,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '2000',
      },
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'TDS',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
    ];

    const result = calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: {
        basicSalary: '40000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: ssfSystemControl,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    // Non-enrolled employee has 0 SSF
    assert.equal(result.ssfEmployee, '0');
    assert.equal(result.ssfEmployer, '0');
    assert.equal(result.grossEarnings, '42000'); // 40,000 basic + 2,000 allowance
    assert.ok(!result.heads.some((h) => h.payHeadName.includes('SSF')));
  });

  it('should calculate tax liability based on Handicapped tax slabs when employee is marked isDisabled', () => {
    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-pf',
        code: 'EPF',
        name: 'Provident Fund',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: true,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '10',
        amount: '0',
      },
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'TDS',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
    ];

    const resStandard = calculatePayslip({
      employee: { ...BASE_EMPLOYEE, isDisabled: false },
      salaryMap: { basicSalary: '60000', gradePercent: '0', gradeAmount: '0' },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    const resDisabled = calculatePayslip({
      employee: { ...BASE_EMPLOYEE, isDisabled: true },
      salaryMap: { basicSalary: '60000', gradePercent: '0', gradeAmount: '0' },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    const resWidow = calculatePayslip({
      employee: { ...BASE_EMPLOYEE, isDisabled: false, taxStatus: 'Widow' },
      salaryMap: { basicSalary: '60000', gradePercent: '0', gradeAmount: '0' },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    const standardTds = new Decimal(resStandard.tdsThisMonth);
    const disabledTds = new Decimal(resDisabled.tdsThisMonth);
    const widowTds = new Decimal(resWidow.tdsThisMonth);

    assert.equal(standardTds.toString(), '1650', 'Standard TDS should be 1650');
    assert.equal(disabledTds.toString(), '825', 'Disabled employee TDS should be 825 calculated from Handicapped slabs');
    assert.equal(widowTds.toString(), standardTds.toString(), 'Widow tax status should calculate identically to Normal Single');
  });

  it('should support Super Admin handicapped override discount if configured in systemControl', () => {
    const customSystemControl: SystemControlData = {
      ...MOCK_SYSTEM_CONTROL,
      insuranceDiscounts: {
        ...MOCK_SYSTEM_CONTROL.insuranceDiscounts,
        handicappedDiscountPercent: 60, // Super Admin 60% override
      },
    };

    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-pf',
        code: 'EPF',
        name: 'Provident Fund',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: true,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '10',
        amount: '0',
      },
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'TDS',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
    ];

    const resDisabled = calculatePayslip({
      employee: { ...BASE_EMPLOYEE, isDisabled: true },
      salaryMap: { basicSalary: '60000', gradePercent: '0', gradeAmount: '0' },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: customSystemControl,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    const disabledTds = new Decimal(resDisabled.tdsThisMonth);

    // Handicapped slab tax = 825/month. 60% superadmin discount leaves 40% (825 * 0.40 = 330)
    assert.equal(
      disabledTds.toString(),
      '330',
      'Custom 60% override discount should leave 40% of Handicapped slab TDS (825 * 0.4 = 330)'
    );
  });

  it('should correctly detect SSF employer and deduction heads from name and code variations', () => {
    assert.equal(isSsfEmployerHead({ name: 'Social Security Fund Employer(SSF 20%)', type: 'allowance' }), true);
    assert.equal(isSsfEmployerHead({ name: 'SSF - Employer Contribution (20%)', type: 'allowance' }), true);
    assert.equal(isSsfEmployerHead({ code: 'SSF-ER', type: 'allowance' }), true);
    assert.equal(isSsfEmployerHead({ isSsfEmployerHead: true }), true);
    assert.equal(isSsfEmployerHead({ name: 'Fuel Allowance', type: 'allowance' }), false);

    assert.equal(isSsfDeductionHead({ name: 'Social Security Fund (SSF)', type: 'deduction' }), true);
    assert.equal(isSsfDeductionHead({ name: 'SSF Deduction', type: 'deduction' }), true);
    assert.equal(isSsfDeductionHead({ code: 'SSF', type: 'deduction' }), true);
    assert.equal(isSsfDeductionHead({ isSsfHead: true, type: 'deduction' }), true);
    assert.equal(isSsfDeductionHead({ name: 'Staff Welfare Fund', type: 'deduction' }), false);
  });

  it('should recognize realistic Nepali SSF Employer head, preserve its UUID, and avoid duplicate allowances', () => {
    const ssfSystemControl: SystemControlData = {
      ...MOCK_SYSTEM_CONTROL,
      statutoryDeductionLimits: {
        ...MOCK_SYSTEM_CONTROL.statutoryDeductionLimits,
        companyHasSsf: true,
        ssfContributionBase: 'BasicSalary',
      },
    };

    const EMPLOYER_SSF_UUID = '52d85e22-6bed-4903-b691-c577afe85d3f';
    const DEDUCTION_SSF_UUID = '7e1aacb6-2641-4121-8366-04612eab3650';

    const assignedHeads: PayHeadInput[] = [
      {
        id: EMPLOYER_SSF_UUID,
        code: 'PAY-003', // Custom user code (not SSF-ER)
        name: 'Social Security Fund Employer(SSF 20%)',
        type: 'allowance',
        effectOnTax: true,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: false,
        isSsfEmployerHead: false, // In database, column was default false
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '7000',
      },
      {
        id: DEDUCTION_SSF_UUID,
        code: 'PAY-004',
        name: 'Social Security Fund (SSF)',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: false,
        isPfHead: false,
        isSsfHead: true,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
      {
        id: '11111111-1111-4111-a111-111111111111',
        code: 'TDS',
        name: 'TDS',
        type: 'deduction',
        effectOnTax: false,
        isFestivalAllowance: false,
        isAbsentDeduct: false,
        isOtHead: false,
        isLeaveHead: false,
        isTdsHead: true,
        isPfHead: false,
        isSsfHead: false,
        isRemoteAllowance: false,
        isCitHead: false,
        calcBasis: 'None',
        calcParameter: 'FixedAmount',
        calcPercent: '0',
        amount: '0',
      },
    ];

    const result = calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: {
        basicSalary: '35000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: ssfSystemControl,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

    // Basic: 35,000. SSF Employer 20% = 7,000.
    // Gross should be exactly 35,000 + 7,000 = 42,000 (NOT duplicated to 49,000!)
    assert.equal(result.grossEarnings, '42000');

    // The calculated head for employer SSF must have the real UUID, NOT 'head-ssf-er'
    const employerHead = result.heads.find((h) => h.payHeadId === EMPLOYER_SSF_UUID);
    assert.ok(employerHead, 'Employer SSF head must use its real database UUID');
    assert.equal(employerHead.calculatedAmount, '7000');

    // Ensure NO dummy 'head-ssf-er' was generated
    const dummyHead = result.heads.find((h) => h.payHeadId === 'head-ssf-er');
    assert.equal(dummyHead, undefined, 'Must not generate dummy head-ssf-er');

    // SSF deduction must use the real deduction UUID
    const deductionHead = result.heads.find((h) => h.payHeadId === DEDUCTION_SSF_UUID);
    assert.ok(deductionHead, 'Deduction SSF head must use its real database UUID');
    // 31% of 35,000 = 10,850
    assert.equal(deductionHead.calculatedAmount, '10850');
  });
});

describe('SSF contribution base (company setting, default basic + grade)', () => {
  const head = (over: Partial<PayHeadInput>): PayHeadInput => ({
    id: 'h', code: 'H', name: 'H', type: 'deduction', effectOnTax: false, isFestivalAllowance: false, isAbsentDeduct: false, isOtHead: false,
    isLeaveHead: false, isTdsHead: false, isPfHead: false, isSsfHead: false, isSsfEmployerHead: false, isRemoteAllowance: false, isCitHead: false,
    calcBasis: 'BasicSalary', calcParameter: 'BasicSalary', calcPercent: '0', amount: '0', ...over,
  });
  const heads = [
    head({ id: 'head-ssf-er', code: 'SSF-ER', type: 'allowance', isSsfEmployerHead: true, effectOnTax: true, calcPercent: '20' }),
    head({ id: 'head-ssf', code: 'SSF', isSsfHead: true, calcPercent: '31' }),
  ];
  const run = (base?: 'BasicSalary' | 'BasicPlusGrade') =>
    calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: { basicSalary: '40000', gradePercent: '0', gradeAmount: '5000' },
      assignedHeads: heads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: {
        ...MOCK_SYSTEM_CONTROL,
        statutoryDeductionLimits: { ...MOCK_SYSTEM_CONTROL.statutoryDeductionLimits, companyHasSsf: true, ssfContributionBase: base },
      },
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });

  it('defaults to basic + grade: 11% and 20% of 45,000', () => {
    const r = run(undefined);
    assert.equal(r.ssfEmployee, '4950');
    assert.equal(r.ssfEmployer, '9000');
    assert.equal(r.heads.find((h) => h.payHeadId === 'head-ssf')?.calculatedAmount, '13950');
    assert.equal(r.grossEarnings, '54000');
    assert.deepEqual([run('BasicPlusGrade').ssfEmployee, run('BasicPlusGrade').ssfEmployer], ['4950', '9000']);
  });

  it('"Basic only" stays available for companies registered that way', () => {
    const r = run('BasicSalary');
    assert.equal(r.ssfEmployee, '4400');
    assert.equal(r.ssfEmployer, '8000');
  });

  it('the SSF pay head\'s own base no longer decides it (one company rule)', () => {
    const r = calculatePayslip({
      employee: BASE_EMPLOYEE,
      salaryMap: { basicSalary: '40000', gradePercent: '0', gradeAmount: '5000' },
      assignedHeads: heads.map((h) => ({ ...h, calcBasis: 'BasicPlusGrade' })),
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: { ...MOCK_SYSTEM_CONTROL, statutoryDeductionLimits: { ...MOCK_SYSTEM_CONTROL.statutoryDeductionLimits, companyHasSsf: true, ssfContributionBase: 'BasicSalary' } },
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      tax: NO_YTD,
    });
    assert.equal(r.ssfEmployee, '4400');
  });

  it('ssfContribution() helper', () => {
    const s = ssfContribution(30000, 3000, undefined);
    assert.equal(s.employee.toString(), '3630');
    assert.equal(s.employer.toString(), '6600');
    assert.equal(s.total.toString(), '10230');
    assert.equal(ssfContribution(30000, 3000, 'BasicSalary').employee.toString(), '3300');
  });
});

// ---------------------------------------------------------------------------
// 4.8b: income tax from the year to date, spread over the remaining months
// ---------------------------------------------------------------------------
describe('Income tax: year-to-date projection (4.8b)', () => {
  const base = (over: Partial<Parameters<typeof projectTds>[0]> = {}) =>
    projectTds({
      employee: BASE_EMPLOYEE,
      taxSlabs: MOCK_TAX_SLABS,
      systemControl: MOCK_SYSTEM_CONTROL,
      monthlyGross: new Decimal(50000),
      taxableMonthlyGross: new Decimal(50000),
      oneOffTaxable: new Decimal(0),
      retirementThisMonth: new Decimal(0),
      citThisMonth: new Decimal(0),
      insuranceAnnual: new Decimal(0),
      ssfEnrolled: false,
      ytd: EMPTY_YTD,
      monthsRemaining: 12,
      ...over,
    });

  it('the first month of the year equals the old "this month × 12" projection', () => {
    // 600,000 a year: 1% of 500,000 + 10% of 100,000 = 15,000 → 1,250 a month.
    const r = base();
    assert.equal(r.detail.projected.gross, '600000');
    assert.equal(r.detail.annualTax, '15000');
    assert.equal(r.tdsThisMonth.toString(), '1250');
    assert.equal(r.detail.method, 'ytd');
  });

  it('a mid-year increment is projected from what was paid plus the new pay for the months left', () => {
    // 5 months at 50,000 paid (TDS 1,250 each), month 6 at 60,000: 250,000 + 60,000 + 6 × 60,000 = 670,000 → tax 22,000; less 6,250 paid → 15,750 over 7 months = 2,250.
    const r = base({ taxableMonthlyGross: new Decimal(60000), monthlyGross: new Decimal(60000), ytd: { taxableGross: '250000', retirement: '0', cit: '0', tds: '6250', months: 5 }, monthsRemaining: 7 });
    assert.equal(r.detail.projected.gross, '670000');
    assert.equal(r.detail.annualTax, '22000');
    assert.equal(r.tdsThisMonth.toString(), '2250');
  });

  it('a one-off (festival bonus) is taxed once, not projected over the remaining months', () => {
    // Month 1 of 12: 50,000 regular + 50,000 bonus: 100,000 + 11 × 50,000 = 650,000 → 20,000 a year → 1,667 this month.
    const r = base({ taxableMonthlyGross: new Decimal(100000), monthlyGross: new Decimal(100000), oneOffTaxable: new Decimal(50000) });
    assert.equal(r.detail.projected.gross, '650000');
    assert.equal(r.tdsThisMonth.toString(), '1667');
    // Projected ×12 it would have been 1,200,000 and far more tax.
    assert.ok(Number(base({ taxableMonthlyGross: new Decimal(100000), monthlyGross: new Decimal(100000) }).tdsThisMonth) > 1667);
  });

  it('the year-end month reconciles exactly: annual tax less what was deducted', () => {
    const r = base({ ytd: { taxableGross: '550000', retirement: '0', cit: '0', tds: '13000', months: 11 }, monthsRemaining: 1 });
    assert.equal(r.detail.projected.gross, '600000');
    assert.equal(r.tdsThisMonth.toString(), '2000'); // 15,000 − 13,000
    // Over-deducted earlier: nothing more this month (no refund through payroll).
    assert.equal(base({ ytd: { taxableGross: '550000', retirement: '0', cit: '0', tds: '16000', months: 11 }, monthsRemaining: 1 }).tdsThisMonth.toString(), '0');
  });

  it('retirement contributions and CIT are projected within the limits; contract staff pay a flat 15%', () => {
    const r = base({ retirementThisMonth: new Decimal(10000), citThisMonth: new Decimal(30000) });
    // 120,000 + 360,000 = 480,000, capped at a third of 600,000 = 200,000.
    assert.equal(r.detail.projected.retirement, '200000');
    assert.equal(r.detail.projected.taxable, '400000');
    const c = base({ employee: { ...BASE_EMPLOYEE, category: 'Contract' } });
    assert.equal(c.detail.method, 'flat15');
    assert.equal(c.tdsThisMonth.toString(), '7500');
    assert.equal(base({ employee: { ...BASE_EMPLOYEE, category: 'Trainee' } }).tdsThisMonth.toString(), '0');
  });

  it('the year to date is read from locked payslips; older slips count their gross as taxable', () => {
    const ytd = ytdFromSlips([
      { grossEarnings: '50000', pfEmployee: '0', ssfEmployee: '5500', ssfEmployer: '10000', citDeduction: '1000', tdsThisMonth: '1250', taxDetail: { method: 'ytd', monthsRemaining: 12, ytd: EMPTY_YTD, month: { taxableGross: '48000', oneOffTaxable: '0', retirement: '15500', cit: '1000', insuranceAnnual: '0' }, projected: { gross: '0', retirement: '0', cit: '0', taxable: '0' }, annualTax: '0', tdsThisMonth: '1250' } },
      { grossEarnings: '50000', pfEmployee: '0', ssfEmployee: '5500', ssfEmployer: '10000', citDeduction: '1000', tdsThisMonth: '1250', taxDetail: null },
    ]);
    assert.deepEqual(ytd, { taxableGross: '98000', retirement: '31000', cit: '2000', tds: '2500', months: 2 });
  });

  it('a festival bonus payslip pays only the festival heads, with no PF or SSF, taxed once', () => {
    const festival: PayHeadInput = { id: 'h-fest', code: 'FEST', name: 'Dashain allowance', type: 'allowance', effectOnTax: true, isFestivalAllowance: true, isAbsentDeduct: false, isOtHead: false, isLeaveHead: false, isTdsHead: false, isPfHead: false, isSsfHead: false, isSsfEmployerHead: false, isRemoteAllowance: false, isCitHead: false, calcBasis: 'BasicSalary', calcParameter: 'Calculated', calcPercent: '0', amount: '0', isManualOverride: false };
    const tds: PayHeadInput = { ...festival, id: 'h-tds', code: 'TDS', name: 'TDS', type: 'deduction', isFestivalAllowance: false, isTdsHead: true, calcBasis: 'None', calcParameter: 'FixedAmount' };
    const r = calculateBonusSlip({
      employee: BASE_EMPLOYEE,
      salaryMap: { basicSalary: '50000', gradePercent: '0', gradeAmount: '0' },
      festivalHeads: [festival],
      tdsHead: tds,
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      ssfEnrolled: false,
      tax: { ytd: { taxableGross: '150000', retirement: '0', cit: '0', tds: '3750', months: 3 }, monthsRemaining: 9 },
    });
    assert.equal(r.grossEarnings, '50000');
    assert.equal(r.pfEmployee, '0');
    assert.equal(r.ssfEmployee, '0');
    // 150,000 + 50,000 + 8 × 0 regular = 200,000 taxable → 2,000 − 3,750 paid → nothing more, so no TDS line.
    assert.equal(r.heads.length, 1);
    assert.equal(r.heads[0].calculatedAmount, '50000');
    assert.equal(r.tdsThisMonth, '0');
    assert.equal(r.netPayable, '50000');
    assert.equal(r.taxDetail?.month.oneOffTaxable, '50000');
  });
});

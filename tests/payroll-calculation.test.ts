import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { calculatePayslip, type PayHeadInput, type TaxSlabInput, type EmployeeInput } from '../lib/engines/payroll.engine';
import type { SystemControlData } from '../lib/types/system-control';

const MOCK_SYSTEM_CONTROL: SystemControlData = {
  officeTime: {
    inTime: { hour: 10, minute: 0, meridiem: "AM" },
    outTime: { hour: 4, minute: 0, meridiem: "PM" },
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
    handicappedDeductionPercent: 50,
    companyHasSsf: false,
  },
  insuranceDiscounts: {
    medicalInsuranceNpr: 20000,
    houseInsuranceNpr: 5000,
    lifeInsuranceNpr: 25000,
    womenDiscountPercent: 10,
    remoteAllowanceNpr: 50000,
  },
};

const MOCK_TAX_SLABS: TaxSlabInput[] = [
  { id: 'slab-1', category: 'Normal Single', amountFrom: '0', amountTo: '500000', ratePercent: '1', fixedDeduction: '0' },
  { id: 'slab-2', category: 'Normal Single', amountFrom: '500000', amountTo: '700000', ratePercent: '10', fixedDeduction: '0' },
  { id: 'slab-3', category: 'Normal Single', amountFrom: '700000', amountTo: '1000000', ratePercent: '20', fixedDeduction: '0' },
  { id: 'slab-4', category: 'Normal Single', amountFrom: '1000000', amountTo: '2000000', ratePercent: '30', fixedDeduction: '0' },
  { id: 'slab-5', category: 'Normal Single', amountFrom: '2000000', amountTo: null, ratePercent: '36', fixedDeduction: '0' },
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
      isYearEnd: false,
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
      isYearEnd: false,
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
      isYearEnd: false,
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
      isYearEnd: false,
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

  it('should compute SSF (11% employee / 20% employer) when SSF head is assigned', () => {
    const ssfSystemControl: SystemControlData = {
      ...MOCK_SYSTEM_CONTROL,
      statutoryDeductionLimits: {
        ...MOCK_SYSTEM_CONTROL.statutoryDeductionLimits,
        companyHasSsf: true,
      },
    };

    const assignedHeads: PayHeadInput[] = [
      {
        id: 'head-ssf',
        code: 'SSF',
        name: 'Social Security Fund (SSF 11%)',
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
        calcPercent: '11',
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
      isYearEnd: false,
    });

    // Basic + Grade = 40,000 + 5,000 = 45,000
    // SSF employee: 11% of 45,000 = 4,950
    // SSF employer: 20% of 45,000 = 9,000
    assert.equal(result.ssfEmployee, '4950');
    assert.equal(result.ssfEmployer, '9000');

    // PF must be 0 when SSF is active
    assert.equal(result.pfEmployee, '0');

    const ssfHead = result.heads.find((h) => h.payHeadId === 'head-ssf');
    assert.ok(ssfHead);
    assert.equal(ssfHead.calculatedAmount, '4950');
  });
});

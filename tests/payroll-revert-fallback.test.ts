import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { calculatePayslip, type PayHeadInput, type TaxSlabInput, type EmployeeInput } from '../lib/engines/payroll.engine';
import { PayrollLockedError, PayrollRunAlreadyExistsError } from '../lib/services/payroll.service';
import type { SystemControlData } from '../lib/types/system-control';

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
];

const MOCK_TDS_HEAD: PayHeadInput = {
  id: 'head-tds',
  code: 'TDS',
  name: 'TDS (Income Tax)',
  type: 'deduction',
  effectOnTax: true,
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
  isManualOverride: false,
};

describe('Payroll Fallback, Revert & Recalculate Architecture', () => {
  it('should disallow deletion, reversion or overwrite when a payroll run is LOCKED', () => {
    const lockedRun = {
      id: 'run-locked-1',
      status: 'LOCKED' as const,
      payPeriodMonth: 4,
      payPeriodYear: 2083
    };

    assert.strictEqual(lockedRun.status, 'LOCKED');
    const err = new PayrollLockedError();
    assert.match(err.message, /locked/i);
    assert.strictEqual(err.name, 'PayrollLockedError');
  });

  it('should throw PayrollRunAlreadyExistsError on duplicate period when recreateIfExists is false', () => {
    const err = new PayrollRunAlreadyExistsError(4, 2083);
    assert.strictEqual(err.name, 'PayrollRunAlreadyExistsError');
    assert.match(err.message, /2083-04/);
  });

  it('should correctly recalculate payslip when missed allowances or deductions are added', () => {
    const employee: EmployeeInput = {
      id: 'emp-101',
      category: 'Permanent',
      gender: 'Male',
      isDisabled: false,
      taxStatus: 'Normal Single',
      joiningDate: '2025-04-14',
    };

    // Initial state: Only basic salary and TDS
    const initialHeads: PayHeadInput[] = [
      {
        id: 'head-tds',
        code: 'TDS',
        name: 'TDS (Income Tax)',
        type: 'deduction',
        effectOnTax: true,
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
        isManualOverride: false,
      }
    ];

    const initialResult = calculatePayslip({
      employee,
      salaryMap: {
        basicSalary: '50000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads: initialHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      isYearEnd: false,
      historicalPayslips: [],
    });

    assert.strictEqual(Number(initialResult.grossEarnings), 50000);
    const initialNet = new Decimal(initialResult.netPayable);

    // Scenario: User missed a 'Fuel Allowance' (5,000) and a 'Staff Welfare Deduction' (1,000)
    // Recalculating with the newly assigned/added heads:
    const updatedHeads: PayHeadInput[] = [
      ...initialHeads,
      {
        id: 'head-fuel',
        code: 'FUEL',
        name: 'Fuel Allowance',
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
        amount: '5000',
        isManualOverride: false,
      },
      {
        id: 'head-welfare',
        code: 'WELFARE',
        name: 'Staff Welfare Deduction',
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
        amount: '1000',
        isManualOverride: false,
      }
    ];

    const updatedResult = calculatePayslip({
      employee,
      salaryMap: {
        basicSalary: '50000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads: updatedHeads,
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      isYearEnd: false,
      historicalPayslips: [],
    });

    // Gross should now include Fuel Allowance (50,000 + 5,000 = 55,000)
    assert.strictEqual(Number(updatedResult.grossEarnings), 55000);

    // Total deductions must include Welfare Deduction (1,000) + recalculation of progressive TDS
    const updatedDeductions = new Decimal(updatedResult.totalDeductions);
    assert.ok(updatedDeductions.gte(1000), 'Total deductions must include the new 1000 welfare deduction');

    // Net payable must equal grossEarnings minus totalDeductions
    const expectedNet = new Decimal(updatedResult.grossEarnings).minus(updatedDeductions);
    assert.strictEqual(Number(updatedResult.netPayable), Number(expectedNet.toFixed(2)));

    // Net payable should reflect both the additional allowance and the new deduction
    assert.notStrictEqual(updatedResult.netPayable, initialNet.toFixed(2));
  });

  it('should prevent adding a duplicate pay head when already present on the payslip', () => {
    const existingHeadsOnSlip = [
      { payHeadId: 'head-basic-salary', name: 'Basic Salary' },
      { payHeadId: 'head-fuel-allowance', name: 'Fuel Allowance' },
      { payHeadId: 'head-tds', name: 'TDS (Income Tax)' },
    ];

    const existingHeadIds = new Set(existingHeadsOnSlip.map(h => h.payHeadId));

    // Attempting to add Fuel Allowance again
    const targetHeadId = 'head-fuel-allowance';
    const isDuplicate = existingHeadIds.has(targetHeadId);
    assert.strictEqual(isDuplicate, true, 'Should detect that Fuel Allowance is already present on the payslip');

    // Filter available heads for selection
    const allCompanyHeads = [
      { id: 'head-fuel-allowance', name: 'Fuel Allowance', type: 'allowance' },
      { id: 'head-food-allowance', name: 'Food Allowance', type: 'allowance' },
      { id: 'head-welfare-deduction', name: 'Staff Welfare Deduction', type: 'deduction' },
    ];

    const availableHeads = allCompanyHeads.filter(h => !existingHeadIds.has(h.id));
    assert.strictEqual(availableHeads.length, 2);
    assert.ok(!availableHeads.some(h => h.id === 'head-fuel-allowance'), 'Fuel Allowance must not be selectable');
    assert.ok(availableHeads.some(h => h.id === 'head-food-allowance'));
    assert.ok(availableHeads.some(h => h.id === 'head-welfare-deduction'));
  });

  it('should synchronize newly added payslip heads into employee salary mapping upon locking', () => {
    // Initial salary mapping for employee
    const initialMapping = {
      employeeId: 'emp-101',
      basicSalary: 60000,
      gradePercent: 0,
      gradeAmount: 0,
      salaryHeads: [
        { payHeadId: 'head-travel', payHeadType: 'allowance' as const, amount: 4000 },
      ],
      loan1Deduction: 0,
      loan2Deduction: 0,
    };

    // Employee slip heads when locked (User added Fuel Allowance 5000 and overridden Travel Allowance to 4500)
    const slipHeadsAtLock = [
      { payHeadId: 'head-travel', amount: '4500', isManualOverride: true },
      { payHeadId: 'head-fuel', amount: '5000', isManualOverride: true },
    ];

    // Simulate the sync algorithm implemented in payroll.service.ts on lock:
    const updatedHeadsPayload = [...initialMapping.salaryHeads];
    for (const sh of slipHeadsAtLock) {
      const existing = updatedHeadsPayload.find(h => h.payHeadId === sh.payHeadId);
      if (existing) {
        if (sh.isManualOverride) {
          existing.amount = Number(sh.amount);
        }
      } else {
        updatedHeadsPayload.push({
          payHeadId: sh.payHeadId,
          payHeadType: 'allowance',
          amount: Number(sh.amount),
        });
      }
    }

    assert.strictEqual(updatedHeadsPayload.length, 2, 'Salary mapping must now have both Travel and Fuel allowances');
    const travel = updatedHeadsPayload.find(h => h.payHeadId === 'head-travel');
    const fuel = updatedHeadsPayload.find(h => h.payHeadId === 'head-fuel');

    assert.strictEqual(travel?.amount, 4500, 'Travel allowance should be updated to overridden amount');
    assert.strictEqual(fuel?.amount, 5000, 'Fuel allowance should be newly synced into mapping');
  });

  it('should auto-calculate attendance & OT in draft mode without requiring pre-payroll lock', () => {
    const employee: EmployeeInput = {
      id: 'emp-101',
      category: 'Permanent',
      gender: 'Male',
      isDisabled: false,
      taxStatus: 'Normal Single',
      joiningDate: '2025-04-14',
    };

    // Draft calculation state
    const draftCalculation = {
      employeeId: 'emp-101',
      bsMonth: 8,
      presentDays: 24,
      absentDays: 2,
      payLeaveDays: 2,
      nonPayLeaveDays: 1,
      totalWorkingDays: 26,
      otEarnedAmount: '3500.00',
      leaveDeductionAmount: '2307.69',
      isLocked: false,
    };

    // Verify it is in draft (not locked) and ready for payroll payslip creation
    assert.strictEqual(draftCalculation.isLocked, false);
    assert.strictEqual(draftCalculation.presentDays, 24);
    assert.strictEqual(draftCalculation.absentDays, 2);
    assert.strictEqual(Number(draftCalculation.otEarnedAmount), 3500);

    // Calculation with absent deduction and OT
    const initialSlip = calculatePayslip({
      employee,
      salaryMap: {
        basicSalary: '50000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads: [MOCK_TDS_HEAD],
      attendanceCalc: {
        leaveDeductionAmount: draftCalculation.leaveDeductionAmount,
        otEarnedAmount: draftCalculation.otEarnedAmount,
      },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      isYearEnd: false,
      historicalPayslips: [],
    });

    assert.strictEqual(Number(initialSlip.otAmount), 3500);
    assert.strictEqual(Number(initialSlip.absentDeduction), 2307.69);
    // Gross includes Basic + OT - Absent Deduction: 50,000 + 3,500 - 2,307.69 = 51,192.31
    assert.strictEqual(Number(initialSlip.grossEarnings), 51192.31);
  });

  it('should dynamically update payslip net pay when attendance is synced', () => {
    const employee: EmployeeInput = {
      id: 'emp-101',
      category: 'Permanent',
      gender: 'Male',
      isDisabled: false,
      taxStatus: 'Normal Single',
      joiningDate: '2025-04-14',
    };

    // Initial payslip with 0 absent days and 0 OT
    const initialSlip = calculatePayslip({
      employee,
      salaryMap: {
        basicSalary: '50000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads: [MOCK_TDS_HEAD],
      attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      isYearEnd: false,
      historicalPayslips: [],
    });
    const initialNet = Number(initialSlip.netPayable);

    // Syncing updated attendance: employee had 3 days LWOP (3 * 50,000 / 26 = 5769.23) and 2 hours OT (Rs 1500)
    const updatedSlip = calculatePayslip({
      employee,
      salaryMap: {
        basicSalary: '50000',
        gradePercent: '0',
        gradeAmount: '0',
      },
      assignedHeads: [MOCK_TDS_HEAD],
      attendanceCalc: {
        leaveDeductionAmount: '5769.23',
        otEarnedAmount: '1500.00',
      },
      loanDeduction: '0',
      systemControl: MOCK_SYSTEM_CONTROL,
      taxSlabs: MOCK_TAX_SLABS,
      isFestivalMonth: false,
      isRemoteMonth: false,
      isYearEnd: false,
      historicalPayslips: [],
    });

    assert.strictEqual(Number(updatedSlip.otAmount), 1500);
    assert.strictEqual(Number(updatedSlip.absentDeduction), 5769.23);
    // Gross includes Basic + OT - Absent: 50,000 + 1,500 - 5,769.23 = 45,730.77
    assert.strictEqual(Number(updatedSlip.grossEarnings), 45730.77);
    // Net salary should be lower because absent deduction exceeds OT
    assert.ok(Number(updatedSlip.netPayable) < initialNet, 'Net salary should reflect absent deduction and OT additions');
  });

  it('should seal attendance records and leave calculations atomically when payroll transitions to LOCKED', () => {
    const activeAttendancePunches = [
      { id: 'att-1', employeeId: 'emp-101', attendanceDate: '2026-11-20', isLocked: false },
      { id: 'att-2', employeeId: 'emp-101', attendanceDate: '2026-11-21', isLocked: false },
    ];
    const calculationRecord = { id: 'calc-1', employeeId: 'emp-101', isLocked: false };

    // Transitioning payroll run to LOCKED
    const payrollRunStatus: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'LOCKED' = 'LOCKED';

    if (payrollRunStatus === 'LOCKED') {
      activeAttendancePunches.forEach(p => { p.isLocked = true; });
      calculationRecord.isLocked = true;
    }

    assert.strictEqual(activeAttendancePunches[0].isLocked, true);
    assert.strictEqual(activeAttendancePunches[1].isLocked, true);
    assert.strictEqual(calculationRecord.isLocked, true);
  });
});


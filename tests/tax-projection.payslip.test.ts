import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayslip, type PayHeadInput, type TaxSlabInput, type EmployeeInput } from '../lib/engines/payroll.engine';
import type { SystemControlData } from '../lib/types/system-control';

// F5: months 1–11 collect the tax still due on the projected year over the months that remain.

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

const TDS_HEAD: PayHeadInput = {
  id: 'head-tds', code: 'TDS', name: 'Tax Deducted at Source (TDS)', type: 'deduction', effectOnTax: false,
  isFestivalAllowance: false, isAbsentDeduct: false, isOtHead: false, isLeaveHead: false, isTdsHead: true, isPfHead: false,
  isSsfHead: false, isRemoteAllowance: false, isCitHead: false, calcBasis: 'None', calcParameter: 'FixedAmount', calcPercent: '0', amount: '0',
};

const run = (extra: { fiscalMonthIndex?: number; projectionHistory?: { taxableIncome: string; tds: string }[] }) =>
  calculatePayslip({
    employee: BASE_EMPLOYEE,
    salaryMap: { basicSalary: '80000', gradePercent: '0', gradeAmount: '0' },
    assignedHeads: [TDS_HEAD],
    attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
    loanDeduction: '0',
    systemControl: MOCK_SYSTEM_CONTROL,
    taxSlabs: MOCK_TAX_SLABS,
    isFestivalMonth: false,
    isRemoteMonth: false,
    isYearEnd: false,
    ...extra,
  });

describe('tax projection in the payslip engine', () => {
  it('without history or a month index it annualises the month (unchanged behaviour)', () => {
    const r = run({});
    assert.equal(r.taxSheet, undefined);
    assert.ok(Number(r.tdsThisMonth) > 0);
  });

  it('month 1 with an empty history gives the same TDS as the unprojected month', () => {
    const legacy = run({});
    const first = run({ fiscalMonthIndex: 1, projectionHistory: [] });
    assert.equal(first.tdsThisMonth, legacy.tdsThisMonth);
    assert.equal(first.taxSheet?.monthsRemaining, 12);
  });

  it('tax already deducted earlier lowers the rest; nothing is over-collected', () => {
    const steady = run({ fiscalMonthIndex: 1, projectionHistory: [] });
    const taxable = steady.taxableIncome;
    // Five months at the steady amount: the sixth month collects the same again.
    const past = Array.from({ length: 5 }, () => ({ taxableIncome: taxable, tds: steady.tdsThisMonth }));
    const sixth = run({ fiscalMonthIndex: 6, projectionHistory: past });
    assert.ok(Math.abs(Number(sixth.tdsThisMonth) - Number(steady.tdsThisMonth)) <= 1);
    // Overpaid earlier (double the tax): the remaining months collect less.
    const overpaid = run({ fiscalMonthIndex: 6, projectionHistory: past.map((p) => ({ ...p, tds: String(Number(p.tds) * 2) })) });
    assert.ok(Number(overpaid.tdsThisMonth) < Number(steady.tdsThisMonth));
  });
});

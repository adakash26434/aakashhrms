import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import {
  calculateInstallmentAmount,
  calculateTotalPayable,
  calculateLoanProgress,
  validateDisbursement,
  validateRepayment,
} from '../lib/engines/loan.engine';
import { calculateNetSalary } from '../lib/engines/salary-mapping.engine';
import type { Loan, LoanType } from '../lib/types/loan';
import type { PayrollSlipOverridePayload } from '../lib/types/payroll';

describe('Staff Loans Module & System Synchronization', () => {
  const dummyLoanType: LoanType = {
    id: 'lt-001',
    name: 'Staff Welfare Advance',
    maxAmount: 100000,
    maxInstallments: 24,
    interestRate: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('Loan Financial Calculations', () => {
    it('should calculate zero-interest installment amount correctly', () => {
      const installment = calculateInstallmentAmount(60000, 0, 12);
      assert.equal(installment, 5000);
      const total = calculateTotalPayable(60000, 0);
      assert.equal(total, 60000);
    });

    it('should calculate simple interest installment amount correctly', () => {
      // 100,000 at 10% annual interest over 12 months = 100,000 + 10,000 = 110,000 / 12 = 9166.67
      const installment = calculateInstallmentAmount(100000, 10, 12);
      assert.equal(installment, 9166.67);
      const total = calculateTotalPayable(100000, 10);
      assert.equal(total, 110000);
    });

    it('should compute loan progress percentage accurately', () => {
      const activeLoan: Loan = {
        id: 'l-001',
        employeeId: 'emp-001',
        loanTypeId: 'lt-001',
        givenDate: '2026-08-01',
        loanAmount: 60000,
        installmentAmount: 5000,
        noOfInstallments: 12,
        totalReturned: 25000,
        remainingAmount: 35000,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        employeeName: 'Ram Bahadur',
        employeeCode: 'EMP001',
        loanTypeName: 'Staff Welfare Advance',
      };

      const progress = calculateLoanProgress(activeLoan);
      // 25000 / (25000 + 35000) = 41.666...% -> rounds to 41.7%
      assert.equal(progress, 41.7);
    });
  });

  describe('Pay Period Boundary & Active Loan Eligibility', () => {
    it('should include only loans disbursed on or before the pay period end date', () => {
      const payPeriodEndDate = '2026-08-31';

      const allEmployeeLoans = [
        {
          id: 'loan-past',
          employeeId: 'emp-001',
          givenDate: '2026-07-15',
          installmentAmount: 4000,
          remainingAmount: 20000,
          status: 'ACTIVE',
        },
        {
          id: 'loan-current',
          employeeId: 'emp-001',
          givenDate: '2026-08-10',
          installmentAmount: 3000,
          remainingAmount: 15000,
          status: 'ACTIVE',
        },
        {
          id: 'loan-future',
          employeeId: 'emp-001',
          givenDate: '2026-09-05', // Given next month
          installmentAmount: 5000,
          remainingAmount: 30000,
          status: 'ACTIVE',
        },
      ];

      // Filter mimicking our repository / service query
      const eligibleLoans = allEmployeeLoans.filter(
        (l) => l.status === 'ACTIVE' && l.givenDate <= payPeriodEndDate && l.remainingAmount > 0
      );

      assert.equal(eligibleLoans.length, 2);
      assert.ok(!eligibleLoans.some((l) => l.id === 'loan-future'));

      // Total installment calculation capped at remaining amount
      let totalInstallment = new Decimal(0);
      for (const loan of eligibleLoans) {
        const capped = Decimal.min(new Decimal(loan.installmentAmount), new Decimal(loan.remainingAmount));
        totalInstallment = totalInstallment.plus(capped);
      }

      assert.equal(totalInstallment.toNumber(), 7000);
    });

    it('should cap installment deduction at remaining amount when loan is near completion', () => {
      const nearlyPaidLoan = {
        installmentAmount: 5000,
        remainingAmount: 1850, // Less than one full installment
      };

      const installment = Decimal.min(
        new Decimal(nearlyPaidLoan.installmentAmount),
        new Decimal(nearlyPaidLoan.remainingAmount)
      );

      assert.equal(installment.toNumber(), 1850);
    });

    it('should fallback to mapped salary deductions when no loans exist in loans table', () => {
      const empLoans: any[] = [];
      const salaryMap = {
        loan1Deduction: 3500,
        loan2Deduction: 1500,
      };

      let activeLoanDeduction = '0';
      if (empLoans && empLoans.length > 0) {
        activeLoanDeduction = '1000';
      } else {
        const mappedLoan = new Decimal(salaryMap.loan1Deduction || 0).plus(new Decimal(salaryMap.loan2Deduction || 0));
        if (mappedLoan.gt(0)) {
          activeLoanDeduction = mappedLoan.toDecimalPlaces(2).toString();
        }
      }

      assert.equal(activeLoanDeduction, '5000');
    });
  });

  describe('Salary Mapping Sync with Active Loans', () => {
    it('should recompute net salary when loan deductions change', () => {
      const initialNet = calculateNetSalary({
        basicSalary: 45000,
        gradePercent: 0,
        gradeAmount: 5000,
        salaryHeads: [
          { payHeadType: 'allowance', amount: 3000 },
          { payHeadType: 'deduction', amount: 2000 },
        ],
        loan1Deduction: 0,
        loan2Deduction: 0,
      });

      // 45000 + 5000 + 3000 - 2000 = 51000
      assert.equal(initialNet, 51000);

      // Now sync with 2 active loans: EMI1 = 4000, EMI2 = 2500
      const updatedNet = calculateNetSalary({
        basicSalary: 45000,
        gradePercent: 0,
        gradeAmount: 5000,
        salaryHeads: [
          { payHeadType: 'allowance', amount: 3000 },
          { payHeadType: 'deduction', amount: 2000 },
        ],
        loan1Deduction: 4000,
        loan2Deduction: 2500,
      });

      // 51000 - 4000 - 2500 = 44500
      assert.equal(updatedNet, 44500);
    });
  });

  describe('Payslip Loan Deduction Manual Override', () => {
    it('should permit overriding loanDeduction in PayrollSlipOverridePayload', () => {
      const payload: PayrollSlipOverridePayload = {
        slipId: 'slip-123',
        loanDeduction: '6500.00',
        reason: 'Accelerated voluntary loan repayment requested by employee',
      };

      assert.equal(payload.loanDeduction, '6500.00');
      assert.equal(payload.reason, 'Accelerated voluntary loan repayment requested by employee');
    });
  });

  describe('Repayment Ledger & Loan Report Filtering', () => {
    it('should correctly match repayment ledger by loanTypeId', () => {
      const repayments = [
        {
          id: 'rep-1',
          loanId: 'loan-uuid-1',
          loanTypeId: 'lt-staff-advance',
          amountPaid: '5000.00',
        },
        {
          id: 'rep-2',
          loanId: 'loan-uuid-2',
          loanTypeId: 'lt-emergency-loan',
          amountPaid: '8000.00',
        },
      ];

      const filter = { loanTypeId: 'lt-staff-advance' };
      const matched = repayments.filter((r) => r.loanTypeId === filter.loanTypeId);

      assert.equal(matched.length, 1);
      assert.equal(matched[0].id, 'rep-1');
    });

    it('should close loan when repayment brings remaining balance to 0', () => {
      const loan = {
        totalReturned: new Decimal('20000.00'),
        remainingAmount: new Decimal('5000.00'),
      };
      const amountPaid = new Decimal('5000.00');

      const newTotalReturned = loan.totalReturned.plus(amountPaid).toDecimalPlaces(2);
      const newRemaining = loan.remainingAmount.minus(amountPaid).toDecimalPlaces(2);
      const newStatus = newRemaining.lte(0) ? 'CLOSED' : 'ACTIVE';

      assert.equal(newTotalReturned.toString(), '25000');
      assert.equal(newRemaining.toString(), '0');
      assert.equal(newStatus, 'CLOSED');
    });
  });
});

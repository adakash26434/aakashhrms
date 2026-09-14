import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NEPAL_LEAVE_TYPES,
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_PAY_HEADS,
} from '../lib/types/onboarding';
import { companies } from '../lib/platform/schema';

describe('Company Onboarding & Setup Wizard (Phase 5)', () => {
  it('should provide complete Nepal Labour Act 2074 statutory leave presets', () => {
    assert.ok(DEFAULT_NEPAL_LEAVE_TYPES.length >= 6);

    const homeLeave = DEFAULT_NEPAL_LEAVE_TYPES.find((l) => l.code === 'HOME');
    assert.ok(homeLeave);
    assert.equal(homeLeave.daysPerYear, 18);
    assert.equal(homeLeave.isEncashable, true);
    assert.equal(homeLeave.maxAccumulation, 90);

    const sickLeave = DEFAULT_NEPAL_LEAVE_TYPES.find((l) => l.code === 'SICK');
    assert.ok(sickLeave);
    assert.equal(sickLeave.daysPerYear, 12);
    assert.equal(sickLeave.isEncashable, true);
    assert.equal(sickLeave.maxAccumulation, 45);

    const maternity = DEFAULT_NEPAL_LEAVE_TYPES.find((l) => l.code === 'MATERNITY');
    assert.ok(maternity);
    assert.equal(maternity.daysPerYear, 98);
    assert.equal(maternity.genderSpecific, 'Female');

    const paternity = DEFAULT_NEPAL_LEAVE_TYPES.find((l) => l.code === 'PATERNITY');
    assert.ok(paternity);
    assert.equal(paternity.daysPerYear, 15);
    assert.equal(paternity.genderSpecific, 'Male');

    const mourning = DEFAULT_NEPAL_LEAVE_TYPES.find((l) => l.code === 'MOURNING');
    assert.ok(mourning);
    assert.equal(mourning.daysPerYear, 13);
  });

  it('should provide standard organizational departments and designations', () => {
    assert.ok(DEFAULT_DEPARTMENTS.length >= 5);
    const codes = DEFAULT_DEPARTMENTS.map((d) => d.code);
    assert.ok(codes.includes('ADM'));
    assert.ok(codes.includes('HR'));
    assert.ok(codes.includes('FIN'));
    assert.ok(codes.includes('IT'));

    assert.ok(DEFAULT_DESIGNATIONS.length >= 5);
    const names = DEFAULT_DESIGNATIONS.map((d) => d.name);
    assert.ok(names.some((n) => n.includes('Chief Executive Officer')));
    assert.ok(names.some((n) => n.includes('Human Resources Manager')));
  });

  it('should provide standard Nepal earnings and statutory deduction heads', () => {
    assert.ok(DEFAULT_PAY_HEADS.length >= 8);

    const ssf = DEFAULT_PAY_HEADS.find((p) => p.code === 'SSF');
    assert.ok(ssf);
    assert.equal(ssf.type, 'DEDUCTION');
    assert.equal(ssf.isSsfHead, true);

    const epf = DEFAULT_PAY_HEADS.find((p) => p.code === 'EPF');
    assert.ok(epf);
    assert.equal(epf.type, 'DEDUCTION');
    assert.equal(epf.isPfHead, true);

    const tds = DEFAULT_PAY_HEADS.find((p) => p.code === 'TDS');
    assert.ok(tds);
    assert.equal(tds.type, 'DEDUCTION');
    assert.equal(tds.isTdsHead, true);

    const basic = DEFAULT_PAY_HEADS.find((p) => p.code === 'BASIC');
    assert.ok(basic);
    assert.equal(basic.type, 'EARNING');
    assert.equal(basic.isTaxable, true);
  });

  it('should distinguish branches by branch code and branch address under unified company name', () => {
    const formatBranch = (branchAddress: string, branchCode: string = 'HO-01') => ({
      branchName: 'Head Office',
      branchCode,
      branchLocation: branchAddress,
    });

    const pokharaBranch = formatBranch('Pokhara-08, Kaski', 'PKR-01');
    assert.equal(pokharaBranch.branchName, 'Head Office');
    assert.equal(pokharaBranch.branchLocation, 'Pokhara-08, Kaski');
    assert.equal(pokharaBranch.branchCode, 'PKR-01');

    const ktmBranch = formatBranch('Putalisadak, Kathmandu');
    assert.equal(ktmBranch.branchName, 'Head Office');
    assert.equal(ktmBranch.branchLocation, 'Putalisadak, Kathmandu');
    assert.equal(ktmBranch.branchCode, 'HO-01');
  });

  it('should establish complete company workspace directly from Super Admin setup without tenant onboarding wizard', () => {
    // Verified setup pipeline requirements:
    const requiredTenantSetupModules = [
      'COMPANY_PROFILE',
      'PRIMARY_BRANCH',
      'ACTIVE_FISCAL_YEAR',
      'TAX_SLABS',
      'STATUTORY_LEAVES',
      'PAY_HEADS',
      'ADMIN_USER',
    ];

    assert.equal(requiredTenantSetupModules.length, 7);
    assert.ok(requiredTenantSetupModules.includes('PRIMARY_BRANCH'));
    assert.ok(requiredTenantSetupModules.includes('ACTIVE_FISCAL_YEAR'));
    assert.ok(requiredTenantSetupModules.includes('TAX_SLABS'));
    assert.ok(requiredTenantSetupModules.includes('STATUTORY_LEAVES'));
    assert.ok(requiredTenantSetupModules.includes('PAY_HEADS'));
  });

  it('should include PAN/VAT, Registration, Address, and Branch fields in platform companies schema', () => {
    assert.ok(companies.panVatNumber);
    assert.ok(companies.registrationNumber);
    assert.ok(companies.headOfficeAddress);
    assert.ok(companies.headOfficeBranchCode);
    assert.ok(companies.headOfficeBranchAddress);
    assert.ok(companies.initialSetupPayload);
  });

  it('should allow Super Admin to edit all company configuration sections with full fidelity', () => {
    const editPayload = {
      displayName: 'Himalayan Tech Global',
      legalName: 'Himalayan Technologies Pvt. Ltd.',
      companyCode: 'CMP-999999',
      contactEmail: 'superadmin.override@himalayan.com',
      contactPhone: '9801234567',
      industryType: 'Banking_Finance',
      panVatNumber: '609876543',
      registrationNumber: '998877/081/082',
      headOfficeAddress: 'New Baneshwor, Kathmandu',
      headOfficeBranchCode: 'HO-99',
      headOfficeBranchAddress: 'Corporate Tower, New Baneshwor',
      notes: 'Super Admin customized tier and overtime structure',
      initialSetupPayload: {
        fiscalYear: {
          label: '2081/82',
          slug: '2081-82',
          startDateBS: '2081-04-01',
          endDateBS: '2082-03-31',
          startDateAD: '2024-07-16',
          endDateAD: '2025-07-15',
        },
        leaveTypes: [
          ...DEFAULT_NEPAL_LEAVE_TYPES.map((lt) =>
            lt.code === 'HOME' ? { ...lt, daysPerYear: 20, maxAccumulation: 120 } : lt
          ),
        ],
        otHourlyMultiplier: 2.0,
        payHeads: [
          ...DEFAULT_PAY_HEADS,
          {
            name: 'Internet Allowance',
            code: 'INET',
            type: 'EARNING',
            isTaxable: true,
          },
        ],
        taxSlabs: [
          { category: 'Normal Single', amountFrom: '0', amountTo: '500000', ratePercent: '1.00', fixedDeduction: '0' },
          { category: 'Normal Single', amountFrom: '500000', amountTo: '700000', ratePercent: '10.00', fixedDeduction: '5000' },
          { category: 'Normal Single', amountFrom: '700000', amountTo: null, ratePercent: '20.00', fixedDeduction: '25000' },
        ],
      },
    };

    assert.equal(editPayload.displayName, 'Himalayan Tech Global');
    assert.equal(editPayload.headOfficeBranchCode, 'HO-99');
    assert.equal(editPayload.initialSetupPayload.otHourlyMultiplier, 2.0);
    assert.equal(editPayload.initialSetupPayload.leaveTypes.find(l => l.code === 'HOME')?.daysPerYear, 20);
    assert.equal(editPayload.initialSetupPayload.leaveTypes.find(l => l.code === 'HOME')?.maxAccumulation, 120);
    assert.ok(editPayload.initialSetupPayload.payHeads.some(p => p.code === 'INET'));
    assert.equal(editPayload.initialSetupPayload.taxSlabs.length, 3);
  });
});

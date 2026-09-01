import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NEPAL_LEAVE_TYPES,
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_PAY_HEADS,
} from '../lib/types/onboarding';

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

  it('should support location-flexible branch configurations', () => {
    const formatBranch = (companyName: string, city: string, customCode?: string) => ({
      branchName: `${companyName} Head Office`,
      branchCode: customCode || 'HO-01',
      branchLocation: `${city} Central Office`,
    });

    const pokharaBranch = formatBranch('Himalayan Tech', 'Pokhara', 'PKR-01');
    assert.equal(pokharaBranch.branchName, 'Himalayan Tech Head Office');
    assert.equal(pokharaBranch.branchLocation, 'Pokhara Central Office');
    assert.equal(pokharaBranch.branchCode, 'PKR-01');

    const ktmBranch = formatBranch('Everest Health', 'Kathmandu');
    assert.equal(ktmBranch.branchName, 'Everest Health Head Office');
    assert.equal(ktmBranch.branchLocation, 'Kathmandu Central Office');
    assert.equal(ktmBranch.branchCode, 'HO-01');
  });
});

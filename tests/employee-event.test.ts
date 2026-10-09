import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_KINDS,
  buildEventChanges,
  describeChange,
  initialStatus,
  letterInputsForEvent,
  normalizeEventForm,
  validateCancelReason,
  validateEventForm,
  type EmployeeSnapshot,
} from '../lib/engines/employee-event.engine';

// Lifecycle events (G2): promotion / transfer / confirmation as dated records
// with before/after snapshots; due events apply, future ones schedule.

const employee: EmployeeSnapshot = {
  id: 'e1',
  fullName: 'Sita Sharma',
  employeeCode: 'EMP-7',
  designationId: 'd1',
  designation: 'Assistant',
  departmentId: 'dep1',
  department: 'Credit',
  branchId: 'b1',
  branch: 'Head office',
  category: 'Contract',
  confirmationDate: null,
  status: 'Active',
};

const names = {
  designation: (id: string) => ({ d2: 'Senior Assistant' })[id] ?? '?',
  branch: (id: string) => ({ b2: 'Lekhnath branch' })[id] ?? '?',
  department: (id: string) => ({ dep2: 'Savings' })[id] ?? '?',
};

const TODAY = '2026-10-09';

describe('employee-event normalize + validate', () => {
  it('normalizes: unknown kind and malformed date are rejected, strings trimmed', () => {
    const form = normalizeEventForm({ kind: 'demotion', effectiveDateAd: '9/10/2026', employeeId: ' e1 ', reason: '  up  ' });
    assert.equal(form.kind, '');
    assert.equal(form.effectiveDateAd, '');
    assert.equal(form.employeeId, 'e1');
    assert.equal(form.reason, 'up');
  });

  it('requires employee, kind and effective date', () => {
    const errors = validateEventForm(normalizeEventForm({}), null, TODAY);
    assert.ok(errors.employeeId && errors.kind && errors.effectiveDateAd);
  });

  it('promotion needs a different new designation', () => {
    const base = { employeeId: 'e1', effectiveDateAd: TODAY, kind: 'promotion' };
    assert.ok(validateEventForm(normalizeEventForm(base), employee, TODAY).toDesignationId);
    assert.ok(validateEventForm(normalizeEventForm({ ...base, toDesignationId: 'd1' }), employee, TODAY).toDesignationId);
    assert.deepEqual(validateEventForm(normalizeEventForm({ ...base, toDesignationId: 'd2' }), employee, TODAY), {});
  });

  it('transfer must change the branch, the department, or both', () => {
    const base = { employeeId: 'e1', effectiveDateAd: TODAY, kind: 'transfer' };
    assert.ok(validateEventForm(normalizeEventForm(base), employee, TODAY).toBranchId);
    assert.ok(validateEventForm(normalizeEventForm({ ...base, toBranchId: 'b1' }), employee, TODAY).toBranchId, 'same branch is no transfer');
    assert.deepEqual(validateEventForm(normalizeEventForm({ ...base, toBranchId: 'b2' }), employee, TODAY), {});
    assert.deepEqual(validateEventForm(normalizeEventForm({ ...base, toDepartmentId: 'dep2' }), employee, TODAY), {});
  });

  it('confirmation is refused for already-permanent and inactive employees', () => {
    const base = normalizeEventForm({ employeeId: 'e1', effectiveDateAd: TODAY, kind: 'confirmation' });
    assert.deepEqual(validateEventForm(base, employee, TODAY), {});
    assert.ok(validateEventForm(base, { ...employee, category: 'Permanent' }, TODAY).kind);
    assert.ok(validateEventForm(base, { ...employee, status: 'Inactive' }, TODAY).employeeId);
  });

  it('allows back-dating, refuses more than a year ahead', () => {
    const base = { employeeId: 'e1', kind: 'confirmation' };
    assert.deepEqual(validateEventForm(normalizeEventForm({ ...base, effectiveDateAd: '2026-01-01' }), employee, TODAY), {});
    assert.ok(validateEventForm(normalizeEventForm({ ...base, effectiveDateAd: '2027-10-10' }), employee, TODAY).effectiveDateAd);
  });
});

describe('employee-event changes and apply', () => {
  it('promotion snapshots the designation and patches only it', () => {
    const form = normalizeEventForm({ employeeId: 'e1', kind: 'promotion', effectiveDateAd: TODAY, toDesignationId: 'd2' });
    const c = buildEventChanges(form, employee, names);
    assert.deepEqual(c.from, { designationId: 'd1', designation: 'Assistant' });
    assert.deepEqual(c.to, { designationId: 'd2', designation: 'Senior Assistant' });
    assert.deepEqual(c.patch, { designationId: 'd2' });
  });

  it('transfer records only what changes', () => {
    const form = normalizeEventForm({ employeeId: 'e1', kind: 'transfer', effectiveDateAd: TODAY, toBranchId: 'b2', toDepartmentId: 'dep1' });
    const c = buildEventChanges(form, employee, names);
    assert.deepEqual(c.patch, { branchId: 'b2' });
    assert.equal(c.to.branch, 'Lekhnath branch');
    assert.equal(c.to.department, undefined);
  });

  it('confirmation sets Permanent and the confirmation date', () => {
    const form = normalizeEventForm({ employeeId: 'e1', kind: 'confirmation', effectiveDateAd: '2026-09-01' });
    const c = buildEventChanges(form, employee, names);
    assert.deepEqual(c.patch, { category: 'Permanent', confirmationDate: '2026-09-01' });
  });

  it('due today applies, tomorrow schedules', () => {
    assert.equal(initialStatus(TODAY, TODAY), 'applied');
    assert.equal(initialStatus('2026-01-01', TODAY), 'applied');
    assert.equal(initialStatus('2026-10-10', TODAY), 'scheduled');
  });
});

describe('employee-event letter inputs and register text', () => {
  it('maps the event onto the letter template fields', () => {
    const inputs = letterInputsForEvent('promotion', { from: { designation: 'Assistant' }, to: { designation: 'Senior Assistant' } }, '2083-06-23', 'Annual promotion');
    assert.deepEqual(inputs, {
      effective_date: '2083-06-23',
      previous_designation: 'Assistant',
      new_designation: 'Senior Assistant',
      remarks: 'Annual promotion',
    });
  });

  it('a department-only transfer still fills the letter branch fields', () => {
    const inputs = letterInputsForEvent('transfer', { from: { department: 'Credit' }, to: { department: 'Savings' } }, '2083-06-23', '');
    assert.equal(inputs.previous_branch, 'Credit');
    assert.equal(inputs.new_branch, 'Savings');
    assert.equal(inputs.remarks, undefined);
  });

  it('describes changes for the register', () => {
    assert.equal(describeChange('promotion', { designation: 'A' }, { designation: 'B' }), 'A → B');
    assert.equal(describeChange('transfer', { branch: 'HO', department: 'Credit' }, { branch: 'Lekhnath', department: 'Savings' }), 'HO → Lekhnath · Credit → Savings');
    assert.equal(describeChange('confirmation', { category: 'Contract' }, {}), 'Contract → Permanent');
  });

  it('every kind names its letter template', () => {
    assert.deepEqual(EVENT_KINDS.map((k) => k.letterTemplate), ['promotion', 'transfer', 'confirmation']);
  });

  it('cancel needs a real reason', () => {
    assert.ok(validateCancelReason(' no '));
    assert.equal(validateCancelReason('Scheduled by mistake.'), null);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEW_PAY_HEAD,
  PAY_HEAD_ROLES,
  appliesToLabel,
  appliesToNames,
  calcLabel,
  calcNeedsPercent,
  calcOf,
  cannotDeletePayHead,
  describeCalc,
  flagsOfRole,
  formOf,
  nextPayHeadCode,
  normalizePayHeadForm,
  payHeadFormIsValid,
  payHeadWrite,
  roleOf,
  sameChoices,
  systemReason,
  validatePayHeadFields,
  validatePayHeadForm,
} from '../lib/engines/pay-head.engine';
import { STATUTORY_FLAGS, type PayHead, type PayHeadForm } from '../lib/types/pay-head';

// Pay heads (4.12b): what a head is sets its type and the flag payroll reads; system heads keep
// their role and sums; who a head is for (an empty list is everyone); codes; what can be deleted.

const head = (over: Partial<PayHead> = {}): PayHead => ({
  id: 'h1',
  code: 'PH-001',
  name: 'Communication allowance',
  nameNp: null,
  type: 'allowance',
  effectOnTax: true,
  calcBasis: 'None',
  calcParameter: 'FixedAmount',
  calcPercent: 0,
  applicableDepartmentIds: [],
  applicableDesignationIds: [],
  flags: {},
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});
const form = (over: Partial<PayHeadForm> = {}): PayHeadForm => ({ ...NEW_PAY_HEAD, name: 'Fuel allowance', ...over });
const ctx = (over: Partial<Parameters<typeof validatePayHeadForm>[1]> = {}) => ({ otherNames: [], current: null, departmentIds: ['d1', 'd2'], designationIds: ['g1'], ...over });

describe('what a pay head is (4.12b)', () => {
  it('each role sets the type and at most one flag payroll reads', () => {
    for (const r of PAY_HEAD_ROLES) {
      const flags = flagsOfRole(r.value);
      assert.deepEqual(Object.keys(flags).sort(), [...STATUTORY_FLAGS].sort(), r.value);
      assert.deepEqual(STATUTORY_FLAGS.filter((f) => flags[f]), r.flag ? [r.flag] : [], r.value);
    }
    assert.equal(PAY_HEAD_ROLES.find((r) => r.value === 'absence')?.type, 'deduction');
    assert.equal(PAY_HEAD_ROLES.find((r) => r.value === 'ssfEmployer')?.type, 'allowance');
  });

  it('statutory heads are not offered for a new head', () => {
    assert.deepEqual(PAY_HEAD_ROLES.filter((r) => !r.creatable).map((r) => r.value), ['tds', 'pf', 'ssf', 'ssfEmployer', 'cit']);
  });

  it('a stored head is read from its flags, else its type', () => {
    assert.equal(roleOf(head()), 'allowance');
    assert.equal(roleOf(head({ type: 'deduction' })), 'deduction');
    assert.equal(roleOf(head({ type: 'deduction', flags: { isTdsHead: true } })), 'tds');
    assert.equal(roleOf(head({ flags: { isFestivalAllowance: true, isOtHead: true } })), 'festival', 'the first flag wins on old data');
  });

  it('how the amount is worked out', () => {
    assert.equal(calcOf(head()), 'typed');
    assert.equal(calcOf(head({ calcBasis: 'BasicSalary', calcParameter: 'BasicSalary', calcPercent: 10 })), 'basic');
    assert.equal(calcOf(head({ calcBasis: 'BasicPlusGrade', calcParameter: 'BasicPlusGrade', calcPercent: 5 })), 'basicPlusGrade');
    assert.equal(calcOf(head({ calcBasis: 'BasicSalary', calcParameter: 'BasicSalary', calcPercent: 0 })), 'typed', 'a share of 0% is a typed amount');
    assert.equal(calcOf(head({ calcBasis: 'BasicSalary', calcParameter: 'FixedAmount', calcPercent: 10 })), 'typed');
    // The festival allowance pays a month's basic or basic + grade, no percentage.
    assert.equal(calcOf(head({ flags: { isFestivalAllowance: true }, calcBasis: 'BasicSalary', calcParameter: 'BasicSalary', calcPercent: 0 })), 'basic');
    assert.equal(calcOf(head({ flags: { isFestivalAllowance: true }, calcBasis: 'BasicPlusGrade', calcPercent: 0 })), 'basicPlusGrade');
    assert.equal(calcLabel('festival', 'basic'), "One month's basic salary");
    assert.equal(calcLabel('allowance', 'basicPlusGrade'), 'A share of basic + grade');
    assert.equal(calcNeedsPercent('festival', 'basic'), false);
    assert.equal(calcNeedsPercent('allowance', 'basic'), true);
    assert.equal(calcNeedsPercent('allowance', 'typed'), false);
  });

  it('the register says how much in a few words', () => {
    assert.equal(describeCalc(head()), 'Typed for each employee');
    assert.equal(describeCalc(head({ calcBasis: 'BasicSalary', calcParameter: 'BasicSalary', calcPercent: 12.5 })), '12.5% of basic');
    assert.equal(describeCalc(head({ flags: { isFestivalAllowance: true }, calcBasis: 'BasicPlusGrade' })), "One month's basic + grade");
    assert.equal(describeCalc(head({ code: 'TADA' })), 'From other records');
    assert.equal(describeCalc(head({ type: 'deduction', flags: { isTdsHead: true } })), 'Worked out by payroll from the tax slabs');
    assert.equal(describeCalc(head({ type: 'deduction', flags: { isAbsentDeduct: true } })), 'Worked out from attendance');
    assert.equal(describeCalc(head({ type: 'deduction', flags: { isCitHead: true } })), 'Typed for each employee');
  });

  it('system heads: statutory flags and the lines other modules feed', () => {
    assert.equal(systemReason(head()), null);
    assert.equal(systemReason(head({ flags: { isFestivalAllowance: true } })), null);
    assert.match(systemReason(head({ flags: { isPfHead: true } })) ?? '', /statutory head/);
    assert.match(systemReason(head({ flags: { isSsfEmployerHead: true } })) ?? '', /statutory head/);
    for (const code of ['TADA', 'WELFARE_FUND', 'ARREARS', 'REIMBURSE', 'REIMBURSE_TAX', 'LEAVE_ENCASH']) assert.match(systemReason(head({ code })) ?? '', /^Paid from /, code);
  });
});

describe('who a pay head is for (4.12b, S51)', () => {
  it('an empty list is everyone; lists are counted', () => {
    assert.equal(appliesToLabel(head()), 'Everyone');
    assert.equal(appliesToLabel(head({ applicableDepartmentIds: ['d1'] })), '1 department');
    assert.equal(appliesToLabel(head({ applicableDepartmentIds: ['d1', 'd2'], applicableDesignationIds: ['g1'] })), '2 departments · 1 designation');
  });

  it('deleted departments are not counted; a list left with none reaches no one', () => {
    const live = { departmentIds: new Set(['d1']), designationIds: new Set(['g1']) };
    assert.equal(appliesToLabel(head({ applicableDepartmentIds: ['d1', 'gone'] }), live), '1 department');
    assert.equal(appliesToLabel(head({ applicableDepartmentIds: ['gone'] }), live), 'No one: its departments were deleted');
    assert.equal(appliesToLabel(head({ applicableDesignationIds: ['gone'] }), live), 'No one: its designations were deleted');
    assert.equal(appliesToLabel(head(), live), 'Everyone');
  });

  it('the audit line names them; a swap counts as a change even with the same count', () => {
    const names = { departments: new Map([['d1', 'Credit'], ['d2', 'Administration']]), designations: new Map([['g1', 'Assistant']]) };
    assert.equal(appliesToNames(head(), names), 'Everyone');
    assert.equal(appliesToNames(head({ applicableDepartmentIds: ['d1', 'd2', 'gone'], applicableDesignationIds: ['g1'] }), names), 'Departments: a deleted department, Administration, Credit · Designations: Assistant');
    assert.equal(sameChoices(head({ applicableDepartmentIds: ['d1', 'd2'] }), head({ applicableDepartmentIds: ['d2', 'd1'] })), true);
    assert.equal(sameChoices(head({ applicableDepartmentIds: ['d1'] }), head({ applicableDepartmentIds: ['d2'] })), false);
    assert.equal(sameChoices(head({ applicableDesignationIds: ['g1'] }), head()), false);
  });

  it('a new choice must exist; a deleted one already on the head may stay until unticked', () => {
    assert.equal(validatePayHeadForm(form({ departmentIds: ['d3'] }), ctx()).departmentIds, 'A chosen department no longer exists.');
    assert.equal(validatePayHeadForm(form({ designationIds: ['g9'] }), ctx()).designationIds, 'A chosen designation no longer exists.');
    const current = head({ applicableDepartmentIds: ['d1', 'gone'] });
    assert.deepEqual(validatePayHeadForm(form({ departmentIds: ['d1', 'gone'] }), ctx({ current })), {});
    assert.equal(validatePayHeadForm(form({ departmentIds: ['d1', 'other'] }), ctx({ current })).departmentIds, 'A chosen department no longer exists.');
  });
});

describe('checking a pay head (4.12b)', () => {
  it('the browser form is cleaned: known roles, numbers, unique ids', () => {
    const f = normalizePayHeadForm({ name: '  Fuel   allowance ', nameNp: ' इन्धन ', role: 'boss', calc: 'odd', percent: '7.5', taxable: 'yes', departmentIds: ['d1', 'd1', '', 4, 'd2'], designationIds: 'g1' });
    assert.deepEqual(f, { name: 'Fuel allowance', nameNp: 'इन्धन', role: '', calc: '', percent: 7.5, taxable: false, departmentIds: ['d1', 'd2'], designationIds: [] });
    assert.deepEqual(normalizePayHeadForm(null), { name: '', nameNp: '', role: '', calc: '', percent: 0, taxable: false, departmentIds: [], designationIds: [] });
  });

  it('names: required, at most 60 characters, unique ignoring case', () => {
    assert.equal(validatePayHeadFields(form({ name: '' }), []).name, 'Give the pay head a name.');
    assert.equal(validatePayHeadFields(form({ name: 'x'.repeat(61) }), []).name, 'At most 60 characters.');
    assert.equal(validatePayHeadFields(form({ name: 'Fuel allowance' }), ['FUEL ALLOWANCE ']).name, 'Another pay head has this name.');
    assert.equal(validatePayHeadFields(form({ nameNp: 'न'.repeat(61) }), []).nameNp, 'At most 60 characters.');
  });

  it('the amount choice must suit the role; a share needs 0 < % <= 100 with two decimals', () => {
    assert.equal(validatePayHeadFields(form({ role: '' as PayHeadForm['role'] }), []).role, 'Choose what the pay head is.');
    assert.equal(validatePayHeadFields(form({ calc: '' as PayHeadForm['calc'] }), []).calc, 'Choose how the amount is worked out.');
    assert.equal(validatePayHeadFields(form({ calc: 'basic', percent: 0 }), []).percent, 'A percentage above 0, at most 100.');
    assert.equal(validatePayHeadFields(form({ calc: 'basic', percent: 100.5 }), []).percent, 'A percentage above 0, at most 100.');
    assert.equal(validatePayHeadFields(form({ calc: 'basic', percent: 7.125 }), []).percent, 'At most two decimals.');
    assert.deepEqual(validatePayHeadFields(form({ calc: 'basic', percent: 7.25 }), []), {});
    assert.deepEqual(validatePayHeadFields(form({ role: 'festival', calc: 'basic', percent: 0 }), []), {}, 'a month of basic needs no percentage');
    assert.deepEqual(validatePayHeadFields(form({ role: 'overtime', calc: 'typed' }), []), {}, 'worked out by payroll: no amount choice');
    assert.equal(payHeadFormIsValid({}), true);
    assert.equal(payHeadFormIsValid({ name: 'x' }), false);
  });

  it('a new head takes a role a company may add, never a statutory one', () => {
    assert.match(validatePayHeadForm(form({ role: 'tds' }), ctx()).role ?? '', /statutory head/);
    assert.match(validatePayHeadForm(form({ role: 'pf' }), ctx()).role ?? '', /statutory head/);
    assert.deepEqual(validatePayHeadForm(form({ role: 'festival', calc: 'basic' }), ctx()), {});
    // An ordinary head can't be turned into a statutory one either.
    assert.match(validatePayHeadForm(form({ role: 'cit', calc: 'typed' }), ctx({ current: head() })).role ?? '', /statutory head/);
  });

  it('a system head changes its names only', () => {
    const tds = head({ code: 'TDS', name: 'Income tax', type: 'deduction', effectOnTax: false, flags: { isTdsHead: true } });
    const was = formOf(tds);
    assert.deepEqual(validatePayHeadForm({ ...was, name: 'Income tax (TDS)', nameNp: 'आयकर' }, ctx({ current: tds })), {});
    assert.match(validatePayHeadForm({ ...was, role: 'deduction' }, ctx({ current: tds })).role ?? '', /Only its names can change\.$/);
    assert.match(validatePayHeadForm({ ...was, departmentIds: ['d1'] }, ctx({ current: tds })).role ?? '', /Only its names can change\.$/);
    const tada = head({ code: 'TADA', name: 'Travel' });
    assert.match(validatePayHeadForm({ ...formOf(tada), taxable: false }, ctx({ current: tada })).role ?? '', /^Paid from approved travel claims/);
  });
});

describe('what is stored (4.12b)', () => {
  it('a typed allowance: no basis, no percentage, no flags; taxable as chosen', () => {
    const w = payHeadWrite(form({ taxable: false, nameNp: '' }), null);
    assert.deepEqual(w, {
      name: 'Fuel allowance',
      nameNp: null,
      type: 'allowance',
      effectOnTax: false,
      calcBasis: 'None',
      calcParameter: 'FixedAmount',
      calcPercent: 0,
      applicableDepartmentIds: [],
      applicableDesignationIds: [],
      flags: flagsOfRole('allowance'),
    });
  });

  it('a share keeps its basis and a rounded percentage; lists are sorted', () => {
    const w = payHeadWrite(form({ calc: 'basicPlusGrade', percent: 7.25, departmentIds: ['d2', 'd1'] }), null);
    assert.equal(w.calcBasis, 'BasicPlusGrade');
    assert.equal(w.calcParameter, 'BasicPlusGrade');
    assert.equal(w.calcPercent, 7.25);
    assert.deepEqual(w.applicableDepartmentIds, ['d1', 'd2']);
  });

  it('the festival allowance pays a month of basic: flag on, no percentage', () => {
    const w = payHeadWrite(form({ role: 'festival', calc: 'basic', percent: 50 }), null);
    assert.equal(w.calcBasis, 'BasicSalary');
    assert.equal(w.calcPercent, 0);
    assert.equal(w.flags.isFestivalAllowance, true);
    assert.equal(STATUTORY_FLAGS.filter((f) => w.flags[f]).length, 1);
  });

  it('roles worked out by payroll store no amount rule; a deduction keeps its tax flag', () => {
    const w = payHeadWrite(form({ role: 'absence', calc: 'basic', percent: 10, taxable: true }), null);
    assert.equal(w.type, 'deduction');
    assert.equal(w.calcBasis, 'None');
    assert.equal(w.calcPercent, 0);
    assert.equal(w.effectOnTax, false);
    assert.equal(payHeadWrite(form({ role: 'deduction' }), head({ type: 'deduction', effectOnTax: true })).effectOnTax, true);
  });

  it('a system head writes back what it had, with the new names', () => {
    const pf = head({ code: 'PF', name: 'PF', type: 'deduction', effectOnTax: false, calcBasis: 'BasicSalary', calcParameter: 'BasicSalary', calcPercent: 10, applicableDesignationIds: ['g1'], flags: { isPfHead: true } });
    const w = payHeadWrite({ ...formOf(pf), name: 'Provident fund', nameNp: 'सञ्चय कोष', role: 'allowance', taxable: true }, pf);
    assert.deepEqual(w, {
      name: 'Provident fund',
      nameNp: 'सञ्चय कोष',
      type: 'deduction',
      effectOnTax: false,
      calcBasis: 'BasicSalary',
      calcParameter: 'BasicSalary',
      calcPercent: 10,
      applicableDepartmentIds: [],
      applicableDesignationIds: ['g1'],
      flags: { ...flagsOfRole('deduction'), isPfHead: true },
    });
  });

  it('the form for a stored head round-trips', () => {
    const h = head({ calcBasis: 'BasicSalary', calcParameter: 'BasicSalary', calcPercent: 10, effectOnTax: false, applicableDepartmentIds: ['d1'] });
    const f = formOf(h);
    assert.deepEqual(f, { name: h.name, nameNp: '', role: 'allowance', calc: 'basic', percent: 10, taxable: false, departmentIds: ['d1'], designationIds: [] });
    const w = payHeadWrite(f, h);
    assert.deepEqual([w.calcBasis, w.calcParameter, w.calcPercent, w.effectOnTax], [h.calcBasis, h.calcParameter, h.calcPercent, h.effectOnTax]);
  });
});

describe('codes and deleting (4.12b, S51)', () => {
  it('codes are PH-001 onwards, after the highest in use; other codes are ignored', () => {
    assert.equal(nextPayHeadCode([]), 'PH-001');
    assert.equal(nextPayHeadCode(['TDS', 'PF', 'TADA']), 'PH-001');
    assert.equal(nextPayHeadCode(['PH-001', 'ph-009', 'PH-4F2A', 'PH-003']), 'PH-010');
    assert.equal(nextPayHeadCode(['PH-999']), 'PH-1000');
  });

  it('a head stays while anything uses it, and system heads always stay', () => {
    const none = { structures: 0, payslips: 0, templates: 0 };
    assert.equal(cannotDeletePayHead(head(), none), null);
    assert.match(cannotDeletePayHead(head({ flags: { isCitHead: true } }), none) ?? '', /statutory head.*It stays\.$/);
    assert.match(cannotDeletePayHead(head({ code: 'ARREARS' }), none) ?? '', /^Paid from .*It stays\.$/);
    assert.equal(cannotDeletePayHead(head(), { ...none, payslips: 1, structures: 2 }), 'It is on 1 payslip line: it stays for the payroll history.');
    assert.equal(cannotDeletePayHead(head(), { ...none, structures: 2 }), '2 salary structures use it (current or past). Take it off those first.');
    assert.equal(cannotDeletePayHead(head(), { ...none, templates: 1 }), '1 salary template uses it. Take it off those first.');
  });
});

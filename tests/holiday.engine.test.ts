import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLIES_TO_LABEL,
  MAX_DAYS,
  NEW_HOLIDAY,
  auditedHoliday,
  bsIsoOf,
  closedProblem,
  daysInclusive,
  describeBranches,
  describeDates,
  fiscalYearOf,
  holidayApplies,
  holidayFormIsValid,
  holidayWrite,
  isAdDate,
  normalizeHolidayForm,
  sameBranches,
  scopeProblem,
  validateHolidayFields,
  validateHolidayForm,
} from '../lib/engines/holiday.engine';
import type { HolidayForm } from '../lib/types/holiday';

// Holiday calendar (4.12c): who a holiday reaches (branches, women only), who may change it (scope),
// closed attendance months, the window's checks and what is stored (BS days).

const form = (over: Partial<HolidayForm> = {}): HolidayForm => ({ ...NEW_HOLIDAY, name: 'Dashain', category: 'major-festival', from: '2026-10-19', to: '2026-10-23', ...over });
const ctx = (over: Partial<Parameters<typeof validateHolidayForm>[1]> = {}) => ({ others: [], branchIds: ['ho', 'lkn'], current: null, ...over });

describe('who a holiday reaches (4.12c)', () => {
  const dashain = { start: '2026-10-19', end: '2026-10-23', branchIds: [] as string[], appliesTo: 'everyone' as const };
  it('its days, for every branch when none are chosen', () => {
    assert.equal(holidayApplies(dashain, { branchId: 'lkn', gender: 'Male' }, '2026-10-19'), true);
    assert.equal(holidayApplies(dashain, { branchId: 'lkn', gender: 'Male' }, '2026-10-23'), true);
    assert.equal(holidayApplies(dashain, { branchId: 'lkn', gender: 'Male' }, '2026-10-24'), false);
  });

  it('chosen branches only', () => {
    const chhath = { ...dashain, branchIds: ['lkn'] };
    assert.equal(holidayApplies(chhath, { branchId: 'lkn', gender: 'Male' }, '2026-10-20'), true);
    assert.equal(holidayApplies(chhath, { branchId: 'ho', gender: 'Male' }, '2026-10-20'), false);
    assert.equal(holidayApplies(chhath, { branchId: null, gender: 'Male' }, '2026-10-20'), false);
  });

  it('women only, by the field — never by the name', () => {
    const womensDay = { start: '2027-03-08', end: '2027-03-08', branchIds: [], appliesTo: 'women' as const };
    assert.equal(holidayApplies(womensDay, { branchId: 'ho', gender: 'Female' }, '2027-03-08'), true);
    assert.equal(holidayApplies(womensDay, { branchId: 'ho', gender: 'Male' }, '2027-03-08'), false);
    assert.equal(holidayApplies({ ...womensDay, appliesTo: 'everyone' }, { branchId: 'ho', gender: 'Male' }, '2027-03-08'), true);
  });
});

describe('who may change a holiday, and when (4.12c, S52)', () => {
  const global = { scopeType: 'GLOBAL', branchIds: [] };
  const branch = { scopeType: 'BRANCH', branchIds: ['lkn'] };
  it('a company-wide role: any branches; platform support: never', () => {
    assert.equal(scopeProblem(global, []), null);
    assert.equal(scopeProblem(global, ['ho']), null);
    assert.match(scopeProblem({ ...global, isImpersonation: true }, ['ho']) ?? '', /Platform support/);
  });

  it('a branch role: its own branches, never every branch', () => {
    assert.equal(scopeProblem(branch, ['lkn']), null);
    assert.match(scopeProblem(branch, []) ?? '', /every branch needs a company-wide role/);
    assert.match(scopeProblem(branch, ['lkn', 'ho']) ?? '', /your own branches only/);
    assert.match(scopeProblem({ scopeType: 'DEPARTMENT', branchIds: [] }, ['lkn']) ?? '', /only a company-wide or branch role/);
    assert.match(scopeProblem({ scopeType: 'SELF', branchIds: [] }, ['lkn']) ?? '', /only a company-wide or branch role/);
  });

  it('nothing changes inside a closed month of a branch it covers', () => {
    const closed = [{ branchId: 'lkn', startDate: '2026-09-17', endDate: '2026-10-17', label: 'Aswin 2083' }];
    const name = (id: string) => (id === 'lkn' ? 'Lekhnath Branch' : 'Head Office');
    assert.equal(closedProblem({ from: '2026-10-10', to: '2026-10-12', branchIds: ['lkn'] }, closed, name), "Lekhnath Branch's attendance for Aswin 2083 is closed: reopen that month first.");
    assert.match(closedProblem({ from: '2026-10-10', to: '2026-10-12', branchIds: [] }, closed, name) ?? '', /^Lekhnath Branch's/, 'every branch includes it');
    assert.equal(closedProblem({ from: '2026-10-10', to: '2026-10-12', branchIds: ['ho'] }, closed, name), null);
    assert.equal(closedProblem({ from: '2026-10-18', to: '2026-10-20', branchIds: ['lkn'] }, closed, name), null);
    assert.match(closedProblem({ from: '2026-10-15', to: '2026-10-20', branchIds: ['lkn'] }, closed, name) ?? '', /closed/, 'a span reaching into it');
  });
});

describe('the holiday window (4.12c)', () => {
  it('the browser form is cleaned; the last day defaults to the first', () => {
    assert.deepEqual(normalizeHolidayForm({ name: '  Ghatasthapana ', category: 'odd', from: '2026-10-10', to: '', appliesTo: 'men', branchIds: ['lkn', 'lkn', '', 3] }), {
      name: 'Ghatasthapana',
      category: '',
      from: '2026-10-10',
      to: '2026-10-10',
      appliesTo: '',
      branchIds: ['lkn'],
    });
  });

  it('checks: name, category, days in order and at most 30, who gets it', () => {
    assert.deepEqual(validateHolidayFields(form()), {});
    assert.equal(validateHolidayFields(form({ name: '' })).name, 'Give the holiday a name.');
    assert.equal(validateHolidayFields(form({ name: 'x'.repeat(61) })).name, 'At most 60 characters.');
    assert.equal(validateHolidayFields(form({ category: '' as HolidayForm['category'] })).category, 'Choose a category.');
    assert.equal(validateHolidayFields(form({ from: '2026-02-30' })).from, 'Choose the first day.');
    assert.equal(validateHolidayFields(form({ to: '2026-10-18' })).to, 'The last day is before the first.');
    assert.equal(validateHolidayFields(form({ to: '2026-11-18' })).to, `At most ${MAX_DAYS} days.`);
    assert.equal(validateHolidayFields(form({ to: '2026-11-17' })).to, undefined, '30 days fit');
    assert.equal(validateHolidayFields(form({ appliesTo: '' as HolidayForm['appliesTo'] })).appliesTo, 'Choose who gets the day off.');
    assert.equal(holidayFormIsValid({}), true);
  });

  it('a name once in a fiscal year: the same holiday comes back every year', () => {
    const lastYear = { name: 'dashain', from: '2025-09-29' };
    assert.deepEqual(validateHolidayForm(form(), ctx({ others: [lastYear] })), {});
    assert.equal(validateHolidayForm(form(), ctx({ others: [{ name: 'DASHAIN ', from: '2026-07-20' }] })).name, 'FY 2083/84 already has a holiday with this name.');
    // Asar 32, 2083 BS is still FY 2082/83.
    assert.deepEqual(validateHolidayForm(form({ from: '2026-07-17', to: '2026-07-17' }), ctx({ others: [{ name: 'Dashain', from: '2026-07-16' }] })), {});
  });

  it('branches must exist; one already on the holiday may stay', () => {
    assert.equal(validateHolidayForm(form({ branchIds: ['gone'] }), ctx()).branchIds, 'A chosen branch no longer exists.');
    assert.deepEqual(validateHolidayForm(form({ branchIds: ['gone', 'lkn'] }), ctx({ current: { branchIds: ['gone'] } })), {});
  });
});

describe('days and what is stored (4.12c)', () => {
  it('AD days, BS days and fiscal years', () => {
    assert.equal(isAdDate('2026-10-10'), true);
    assert.equal(isAdDate('2026-13-01'), false);
    assert.equal(daysInclusive('2026-10-10', '2026-10-14'), 5);
    assert.equal(daysInclusive('2026-02-27', '2026-03-02'), 4);
    assert.equal(bsIsoOf('2026-10-10'), '2083-06-24');
    assert.equal(fiscalYearOf('2026-10-10'), 2083);
    assert.equal(bsIsoOf('2026-07-16'), '2083-03-32');
    assert.equal(fiscalYearOf('2026-07-16'), 2082, 'Asar closes the year');
    assert.equal(fiscalYearOf('2026-07-17'), 2083, 'Shrawan 1 opens it');
  });

  it('a checked form is stored in BS with branches in order', () => {
    assert.deepEqual(holidayWrite(form({ from: '2027-03-08', to: '2027-03-08', name: "Women's Day", category: 'international-holiday', appliesTo: 'women', branchIds: ['lkn', 'ho'] })), {
      name: "Women's Day",
      category: 'international-holiday',
      startDate: '2083-11-24',
      endDate: '2083-11-24',
      appliesTo: 'women',
      branchIds: ['ho', 'lkn'],
    });
  });

  it('the audit line and the register in words', () => {
    const names = new Map([['ho', 'Head Office'], ['lkn', 'Lekhnath Branch']]);
    assert.equal(describeBranches([], names), 'All branches');
    assert.equal(describeBranches(['lkn', 'ho', 'x'], names), 'a deleted branch, Head Office, Lekhnath Branch');
    assert.equal(describeDates('2083-06-24', '2083-06-24'), '2083-06-24 BS');
    assert.equal(describeDates('2083-07-02', '2083-07-06'), '2083-07-02 – 2083-07-06 BS');
    assert.deepEqual(auditedHoliday({ name: 'Chhath', category: 'regional-festival', startDate: '2083-07-12', endDate: '2083-07-12', appliesTo: 'everyone', branchIds: ['lkn'] }, names), {
      name: 'Chhath',
      dates: '2083-07-12 BS',
      category: 'Regional festival',
      for: APPLIES_TO_LABEL.everyone,
      branches: 'Lekhnath Branch',
    });
    assert.equal(sameBranches(['a', 'b'], ['b', 'a']), true);
    assert.equal(sameBranches(['a'], ['b']), false);
  });
});

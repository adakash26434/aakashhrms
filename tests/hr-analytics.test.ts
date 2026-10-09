import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ageBand, fullYearsBetween, headcountByAgeBand, headcountByBranch, staffReturn, summarize, type StaffFact } from '../lib/engines/hr-analytics.engine';

// HR analytics (G13): headcount groupings, turnover, tenure and the DoC staff return.

const TODAY = '2026-10-09';
const s = (over: Partial<StaffFact>): StaffFact => ({
  id: 'x',
  gender: 'Male',
  category: 'Permanent',
  branch: 'Head office',
  department: 'Credit',
  designation: 'Officer',
  joiningDate: '2020-01-01',
  dateOfBirth: '1990-06-15',
  status: 'Active',
  isDisabled: false,
  ...over,
});

const staff: StaffFact[] = [
  s({ id: '1' }),
  s({ id: '2', gender: 'Female', branch: 'Lekhnath', joiningDate: '2024-12-01', dateOfBirth: '2003-01-01' }),
  s({ id: '3', gender: 'Female', category: 'Contract', dateOfBirth: '1968-02-02', isDisabled: true }),
  s({ id: '4', status: 'Inactive' }),
];

describe('dates', () => {
  it('full years respect the anniversary', () => {
    assert.equal(fullYearsBetween('1990-06-15', TODAY), 36);
    assert.equal(fullYearsBetween('1990-10-10', TODAY), 35);
    assert.equal(fullYearsBetween('2026-10-09', TODAY), 0);
    assert.equal(ageBand(24), 'under 25');
    assert.equal(ageBand(55), '55 and over');
  });
});

describe('headcount', () => {
  it('counts active staff only, split by gender, largest first', () => {
    const rows = headcountByBranch(staff);
    assert.deepEqual(rows.map((r) => [r.label, r.count, r.female]), [['Head office', 2, 1], ['Lekhnath', 1, 1]]);
  });

  it('age bands always list every band', () => {
    const rows = headcountByAgeBand(staff, TODAY);
    assert.equal(rows.length, 5);
    assert.equal(rows.find((r) => r.label === '55 and over')!.count, 1);
    assert.equal(rows.find((r) => r.label === '45–54')!.count, 0);
  });
});

describe('summary', () => {
  it('female share, permanent, tenure, turnover on average headcount', () => {
    const sum = summarize(staff, { joined: 1, left: 1, openingHeadcount: 3 }, TODAY);
    assert.equal(sum.active, 3);
    assert.equal(sum.femaleShare, 66.7);
    assert.equal(sum.permanent, 2);
    assert.equal(sum.disabled, 1);
    assert.equal(sum.averageTenureYears, 4.3); // (6 + 1 + 6) / 3
    assert.equal(sum.turnoverRate, 33.3); // 1 / ((3 + 3) / 2)
  });

  it('nobody → zeros, not NaN', () => {
    const sum = summarize([], { joined: 0, left: 0, openingHeadcount: 0 }, TODAY);
    assert.equal(sum.femaleShare, 0);
    assert.equal(sum.turnoverRate, 0);
    assert.equal(sum.averageAge, 0);
  });
});

describe('staff return', () => {
  it('total, each category, disabilities, movement and training; no pay figures', () => {
    const rows = staffReturn(staff, { joined: 2, left: 1, openingHeadcount: 2 }, { trainedEmployees: 2, trainingHours: 24.5, programmes: 1 });
    assert.deepEqual(rows[0], { item: 'Total staff', itemNp: 'जम्मा कर्मचारी', male: 1, female: 2, other: 0, total: 3 });
    assert.equal(rows.find((r) => r.item.trim() === 'Contract')!.total, 1);
    assert.equal(rows.find((r) => r.item === 'Staff with disabilities')!.female, 1);
    assert.equal(rows.find((r) => r.item === 'Training hours')!.total, 24.5);
    assert.ok(!rows.some((r) => /salary|pay|gross/i.test(r.item)));
  });
});

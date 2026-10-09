import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_DEFINITIONS,
  birthdaysToday,
  complianceReminders,
  isDue,
  jobDefinition,
  probationDue,
} from '../lib/engines/scheduler.engine';

// Scheduled jobs (G6): once per Nepal day on the cadence's days; reminders
// are plain text built from BS dates.

const ctx = (over: Partial<Parameters<typeof isDue>[1]> = {}) => ({
  today: '2026-10-09',
  weekday: 5,
  bsDay: 23,
  lastRunDay: null,
  enabled: true,
  ...over,
});

describe('scheduler due rules', () => {
  it('daily runs once per day; a second tick the same day is not due', () => {
    assert.equal(isDue({ kind: 'daily' }, ctx()), true);
    assert.equal(isDue({ kind: 'daily' }, ctx({ lastRunDay: '2026-10-09' })), false);
    assert.equal(isDue({ kind: 'daily' }, ctx({ lastRunDay: '2026-10-08' })), true);
  });

  it('disabled jobs never run', () => {
    assert.equal(isDue({ kind: 'daily' }, ctx({ enabled: false })), false);
  });

  it('bs-days runs only on those BS days', () => {
    assert.equal(isDue({ kind: 'bs-days', days: [10, 20] }, ctx({ bsDay: 10 })), true);
    assert.equal(isDue({ kind: 'bs-days', days: [10, 20] }, ctx({ bsDay: 23 })), false);
  });

  it('weekday runs on that weekday only', () => {
    assert.equal(isDue({ kind: 'weekday', day: 0 }, ctx({ weekday: 0 })), true);
    assert.equal(isDue({ kind: 'weekday', day: 0 }, ctx({ weekday: 5 })), false);
  });

  it('the four jobs exist with unique codes', () => {
    const codes = JOB_DEFINITIONS.map((j) => j.code);
    assert.equal(new Set(codes).size, codes.length);
    assert.ok(jobDefinition('apply-scheduled-events'));
    assert.ok(jobDefinition('compliance-reminders'));
    assert.equal(jobDefinition('nope'), null);
  });
});

describe('scheduler reminders', () => {
  it('SSF on the 10th, TDS on the 20th, nothing on other days', () => {
    const ssf = complianceReminders(10, 'Kartik', 'Ashwin');
    assert.equal(ssf.length, 1);
    assert.match(ssf[0].subject, /SSF.*Ashwin.*Kartik 15/);
    const tds = complianceReminders(20, 'Kartik', 'Ashwin');
    assert.equal(tds.length, 1);
    assert.match(tds[0].subject, /eTDS.*Ashwin.*Kartik 25/);
    assert.deepEqual(complianceReminders(23, 'Kartik', 'Ashwin'), []);
  });

  it('probation: active, not Permanent, unconfirmed, served the probation days', () => {
    const base = { employeeCode: 'E', category: 'Probation', confirmationDate: null, status: 'Active' };
    const due = probationDue(
      [
        { ...base, fullName: 'Due', joiningDate: '2026-03-01' },
        { ...base, fullName: 'Fresh', joiningDate: '2026-09-01' },
        { ...base, fullName: 'Permanent', category: 'Permanent', joiningDate: '2025-01-01' },
        { ...base, fullName: 'Confirmed', confirmationDate: '2026-05-01', joiningDate: '2025-01-01' },
        { ...base, fullName: 'Left', status: 'Inactive', joiningDate: '2025-01-01' },
        { ...base, fullName: 'Longest', joiningDate: '2025-10-01' },
      ],
      '2026-10-09',
    );
    assert.deepEqual(due.map((e) => e.fullName), ['Longest', 'Due']);
    assert.ok(due[0].daysServed > due[1].daysServed);
  });

  it('birthdays match today, and Feb 29 greets on Feb 28 in non-leap years', () => {
    const people = [
      { fullName: 'Today', employeeCode: 'A', dateOfBirth: '1995-10-09', status: 'Active' },
      { fullName: 'Other day', employeeCode: 'B', dateOfBirth: '1995-10-10', status: 'Active' },
      { fullName: 'Inactive', employeeCode: 'C', dateOfBirth: '1995-10-09', status: 'Inactive' },
      { fullName: 'Leapling', employeeCode: 'D', dateOfBirth: '1996-02-29', status: 'Active' },
    ];
    assert.deepEqual(birthdaysToday(people, '2026-10-09').map((e) => e.fullName), ['Today']);
    assert.deepEqual(birthdaysToday(people, '2026-02-28').map((e) => e.fullName), ['Leapling']);
    assert.deepEqual(birthdaysToday(people, '2028-02-28').map((e) => e.fullName), []);
    assert.deepEqual(birthdaysToday(people, '2028-02-29').map((e) => e.fullName), ['Leapling']);
  });
});

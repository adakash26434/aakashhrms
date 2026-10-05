import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRequest,
  countDays,
  defaultsFor,
  ledgerBalance,
  ledgerSummary,
  signed,
  splitPaid,
  statutoryFloorProblems,
  type CalendarDay,
  type RequestCheck,
} from '../lib/engines/leave.engine';
import type { LeaveRuleType } from '../lib/types/leave';

// 4.6: the leave rules (Labour Act 2074, chapter 9).

const type = (over: Partial<LeaveRuleType> = {}): LeaveRuleType => ({
  id: 't',
  name: 'Sick leave',
  code: 'SICK',
  statutoryCode: 'SICK',
  isStatutory: true,
  kind: 'balance',
  dayBasis: 'working',
  pay: 'full',
  days: 12,
  paidDaysPerEvent: null,
  maxDaysPerRequest: null,
  allowHalfDay: true,
  isRight: true,
  genderApplicable: 'All',
  applicableDepartments: [],
  applicableDesignations: [],
  requiresDocument: true,
  documentThresholdDays: 3,
  accumulationCap: 45,
  isActive: true,
  ...over,
});

const maternity = type({ name: 'Maternity leave', code: 'MATERNITY', statutoryCode: 'MATERNITY', kind: 'event', dayBasis: 'calendar', days: 98, paidDaysPerEvent: 60, genderApplicable: 'Female', allowHalfDay: false, requiresDocument: false });

const check = (over: Partial<RequestCheck> = {}): RequestCheck => ({
  type: type(),
  person: { gender: 'Male', departmentId: 'd1', designationId: 'g1', joiningDate: '2024-01-01', terminationDate: null },
  from: '2026-10-06',
  to: '2026-10-07',
  half: null,
  days: 2,
  leaveYear: { start: '2026-07-17', end: '2027-07-16' },
  overlaps: 0,
  hrDays: 0,
  closed: false,
  available: 10,
  certificateNote: '',
  ...over,
});

// Mon 5 – Sun 11 Oct 2026: Saturday weekly off, Thursday a holiday.
const week: CalendarDay[] = [
  { date: '2026-10-05', off: false },
  { date: '2026-10-06', off: false },
  { date: '2026-10-07', off: false },
  { date: '2026-10-08', off: true, why: 'Holiday: Ghatasthapana' },
  { date: '2026-10-09', off: false },
  { date: '2026-10-10', off: true, why: 'Weekly off' },
  { date: '2026-10-11', off: false },
];

describe('counting days', () => {
  it('working basis skips weekly offs and holidays and says why', () => {
    const r = countDays(week, 'working', null);
    assert.equal(r.days, 5);
    assert.deepEqual(r.skipped, [
      { date: '2026-10-08', why: 'Holiday: Ghatasthapana' },
      { date: '2026-10-10', why: 'Weekly off' },
    ]);
  });

  it('calendar basis counts every day (maternity, maternity care, mourning)', () => {
    const r = countDays(week, 'calendar', null);
    assert.equal(r.days, 7);
    assert.equal(r.skipped.length, 0);
  });

  it('a half day counts 0.5; a half day on a day off counts nothing', () => {
    assert.equal(countDays([week[0]], 'working', 'first').days, 0.5);
    assert.equal(countDays([week[3]], 'working', 'second').days, 0);
  });
});

describe('pay', () => {
  it('maternity: the first 60 days paid, the other 38 unpaid', () => {
    const days = Array.from({ length: 98 }, (_, i) => ({ date: `d${i}`, part: 1 }));
    const r = splitPaid(days, maternity);
    assert.equal(r.paidDays, 60);
    assert.equal(r.unpaidDays, 38);
    assert.equal(r.detail[59].pay, 'full');
    assert.equal(r.detail[60].pay, 'none');
  });

  it("maternity with the doctor's extra month: 60 paid, 68 unpaid", () => {
    const days = Array.from({ length: 128 }, (_, i) => ({ date: `d${i}`, part: 1 }));
    const r = splitPaid(days, maternity);
    assert.deepEqual([r.paidDays, r.unpaidDays], [60, 68]);
  });

  it('paid, unpaid and part-paid types', () => {
    const two = [
      { date: 'a', part: 1 },
      { date: 'b', part: 0.5 },
    ];
    assert.deepEqual([splitPaid(two, { pay: 'full', paidDaysPerEvent: null }).paidDays, splitPaid(two, { pay: 'full', paidDaysPerEvent: null }).unpaidDays], [1.5, 0]);
    assert.deepEqual([splitPaid(two, { pay: 'none', paidDaysPerEvent: null }).paidDays, splitPaid(two, { pay: 'none', paidDaysPerEvent: null }).unpaidDays], [0, 1.5]);
    assert.deepEqual([splitPaid(two, { pay: 'half', paidDaysPerEvent: null }).paidDays, splitPaid(two, { pay: 'half', paidDaysPerEvent: null }).unpaidDays], [0.75, 0.75]);
  });
});

describe('may it be requested?', () => {
  it('a normal request passes, with the §51 note for a right', () => {
    const r = checkRequest(check());
    assert.deepEqual(r.problems, []);
    assert.ok(r.notes.some((n) => n.includes('§51')));
  });

  it('refuses overlaps, HR-set days, closed months and short balances', () => {
    assert.match(checkRequest(check({ overlaps: 1 })).problems.join(), /overlap/);
    assert.match(checkRequest(check({ hrDays: 1 })).problems.join(), /HR has already set/);
    assert.match(checkRequest(check({ closed: true })).problems.join(), /closed attendance month/);
    assert.match(checkRequest(check({ available: 1.5 })).problems.join(), /Not enough sick leave: 1\.5 days available/);
  });

  it('refuses dates outside employment or across the leave year', () => {
    assert.match(checkRequest(check({ from: '2023-12-31' })).problems.join(), /before the joining date/);
    assert.match(checkRequest(check({ person: { ...check().person, terminationDate: '2026-10-06' } })).problems.join(), /after the last working day/);
    assert.match(checkRequest(check({ to: '2027-07-20' })).problems.join(), /another leave year/);
  });

  it('refuses a request that is all days off', () => {
    assert.match(checkRequest(check({ days: 0 })).problems.join(), /nothing to take/);
  });

  it('half days: one date only, and only where allowed', () => {
    assert.match(checkRequest(check({ half: 'first' })).problems.join(), /one date only/);
    assert.match(checkRequest(check({ half: 'first', to: '2026-10-06', days: 0.5, type: type({ allowHalfDay: false }) })).problems.join(), /can't be taken as a half day/);
  });

  it('gender, inactive and company department limits', () => {
    assert.match(checkRequest(check({ type: maternity, days: 10, available: null })).problems.join(), /for female employees/);
    assert.match(checkRequest(check({ type: type({ isActive: false }) })).problems.join(), /not in use/);
    const study = type({ name: 'Study leave', isStatutory: false, statutoryCode: null, isRight: false, applicableDepartments: ['d9'] });
    assert.match(checkRequest(check({ type: study })).problems.join(), /not for this department/);
  });

  it('event leave: at most its days; maternity 98, or 128 with a doctor’s note', () => {
    const woman = { ...check().person, gender: 'Female' };
    assert.deepEqual(checkRequest(check({ type: maternity, person: woman, days: 98, available: null, to: '2027-01-11' })).problems, []);
    assert.match(checkRequest(check({ type: maternity, person: woman, days: 110, available: null, to: '2027-01-23' })).problems.join(), /Maternity leave is 98 days/);
    assert.deepEqual(checkRequest(check({ type: maternity, person: woman, days: 110, available: null, to: '2027-01-23', certificateNote: "Doctor's advice, Dr. K" })).problems, []);
    const mourning = type({ name: 'Mourning leave', statutoryCode: 'MOURNING', kind: 'event', dayBasis: 'calendar', days: 13 });
    assert.match(checkRequest(check({ type: mourning, days: 14, available: null })).problems.join(), /Mourning leave is 13 days/);
  });

  it('notes the certificate after 3 days in a row', () => {
    assert.ok(checkRequest(check({ days: 4 })).notes.some((n) => n.includes('certificate')));
    assert.ok(!checkRequest(check({ days: 3 })).notes.some((n) => n.includes('certificate')));
  });
});

describe('the statutory floor', () => {
  it('raising is allowed; lowering below the law is not', () => {
    assert.deepEqual(statutoryFloorProblems('SICK', { days: 15, cap: 60, certificateAfter: 5 }), []);
    assert.equal(statutoryFloorProblems('SICK', { days: 10 }).length, 1);
    assert.equal(statutoryFloorProblems('SICK', { cap: 30 }).length, 1);
    assert.equal(statutoryFloorProblems('SICK', { certificateAfter: 1 }).length, 1);
    assert.equal(statutoryFloorProblems('MATERNITY', { days: 98, paidDays: 45 }).length, 1);
    assert.equal(statutoryFloorProblems('HOME', { accrualEveryDays: 18 }).length, 0);
    assert.equal(statutoryFloorProblems('HOME', { accrualEveryDays: 25 }).length, 1);
    assert.equal(statutoryFloorProblems('MOURNING', { days: 7 }).length, 1);
    assert.deepEqual(statutoryFloorProblems(null, { days: 0 }), []);
  });

  it('statutory defaults: balance vs event, counting, rights', () => {
    assert.deepEqual(defaultsFor('MATERNITY', 'half'), { kind: 'event', dayBasis: 'calendar', paidDaysPerEvent: 60, isRight: true });
    assert.equal(defaultsFor('HOME', 'full').isRight, false);
    assert.equal(defaultsFor('SICK', 'full').isRight, true);
    assert.equal(defaultsFor(null, 'none').kind, 'none');
  });
});

describe('the ledger', () => {
  it('the balance is the sum of the signed lines', () => {
    const lines = [
      { kind: 'opening' as const, days: 12 },
      { kind: 'carried_forward' as const, days: 6 },
      { kind: 'taken' as const, days: -3 },
      { kind: 'returned' as const, days: 1 },
      { kind: 'adjusted' as const, days: -0.5 },
    ];
    assert.equal(ledgerBalance(lines), 15.5);
    assert.deepEqual(ledgerSummary(lines), { allotted: 11.5, taken: 2, carriedForward: 6, balance: 15.5 });
  });

  it('signs by kind; adjustments keep their own sign', () => {
    assert.equal(signed('taken', 3), -3);
    assert.equal(signed('paid_out', -2), -2);
    assert.equal(signed('accrual', 1.5), 1.5);
    assert.equal(signed('adjusted', -1), -1);
  });
});

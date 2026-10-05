import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  balanceOn,
  capOf,
  carryOver,
  creditedYearly,
  homeLeaveEarned,
  homeLeaveMonths,
  planOpening,
  proRata,
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
  carryForward: false,
  isEncashable: false,
  accrualEveryDays: null,
  expiryDays: null,
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

// ---------------------------------------------------------------------------
// 4.6b entitlements
// ---------------------------------------------------------------------------

const line = (kind: 'grant' | 'taken' | 'credit' | 'expired' | 'opening', days: number, entryDate: string, expiresOn: string | null = null, id?: string) => ({ id, kind, days, entryDate, expiresOn });

describe('balance on a date (substitute expiry, oldest first)', () => {
  it('without expiring lines it is the ledger sum', () => {
    const r = balanceOn([line('opening', 12, '2026-07-17'), line('taken', -2.5, '2026-08-01')], '2026-10-05');
    assert.equal(r.available, 9.5);
    assert.deepEqual(r.expired, []);
  });

  it('leave taken uses the grant that expires first', () => {
    const lines = [line('grant', 1, '2026-09-01', '2026-09-22', 'a'), line('grant', 1, '2026-09-10', '2026-10-01', 'b'), line('taken', -1, '2026-09-15')];
    const mid = balanceOn(lines, '2026-09-25');
    assert.equal(mid.available, 1);
    assert.deepEqual(mid.buckets.map((b) => b.id), ['b']);
    assert.deepEqual(mid.expired, []);
    const after = balanceOn(lines, '2026-10-02');
    assert.equal(after.available, 0);
    assert.deepEqual(after.expired, [{ id: 'b', expiresOn: '2026-10-01', days: 1 }]);
  });

  it('a grant counts up to and including its expiry day, then stops', () => {
    const lines = [line('grant', 0.5, '2026-09-01', '2026-09-22', 'a')];
    assert.equal(balanceOn(lines, '2026-09-22').available, 0.5);
    assert.equal(balanceOn(lines, '2026-09-23').available, 0);
  });

  it('a written-off expiry line is not counted twice', () => {
    const lines = [line('grant', 1, '2026-09-01', '2026-09-22', 'a'), line('expired', -1, '2026-09-22')];
    assert.equal(balanceOn(lines, '2026-10-05').available, 0);
  });

  it('leave beyond the grants comes off the free balance', () => {
    const lines = [line('grant', 1, '2026-09-01', '2026-09-22', 'a'), line('taken', -2, '2026-09-05')];
    const r = balanceOn(lines, '2026-09-10');
    assert.equal(r.available, -1);
    assert.equal(r.free, -1);
  });
});

describe('home leave, carry-over, pro-rata', () => {
  it('home leave: 1 day per 20 paid days (Labour Act §43)', () => {
    assert.equal(homeLeaveEarned(26, 20), 1.3);
    assert.equal(homeLeaveEarned(21, null), 1.05);
    assert.equal(homeLeaveEarned(30, 18), 1.67);
    assert.equal(homeLeaveEarned(0, 20), 0);
  });

  it('carry-over stops at the cap; a negative balance carries as it is', () => {
    assert.deepEqual(carryOver(100, 90), { carry: 90, over: 10 });
    assert.deepEqual(carryOver(30, 45), { carry: 30, over: 0 });
    assert.deepEqual(carryOver(-2, 90), { carry: -2, over: 0 });
    assert.deepEqual(carryOver(7, null), { carry: 7, over: 0 });
  });

  it('pro-rata from joining (Labour Act §44), 1 decimal', () => {
    const year = { start: '2026-07-17', end: '2027-07-16' };
    assert.equal(proRata(12, '2026-07-01', year), 12);
    assert.equal(proRata(12, '2026-07-17', year), 12);
    assert.equal(proRata(12, '2027-01-15', year), 6);
    assert.equal(proRata(12, '2027-08-01', year), 0);
  });

  it("caps: the type's own, else the law's (home 90, sick 45)", () => {
    assert.equal(capOf({ accumulationCap: null, statutoryCode: 'HOME' }), 90);
    assert.equal(capOf({ accumulationCap: null, statutoryCode: 'SICK' }), 45);
    assert.equal(capOf({ accumulationCap: 60, statutoryCode: 'SICK' }), 60);
    assert.equal(capOf({ accumulationCap: null, statutoryCode: null }), null);
  });

  it('credited yearly: sick and company types; not home (earned) or substitute (granted)', () => {
    assert.equal(creditedYearly(type()), true);
    assert.equal(creditedYearly(type({ statutoryCode: 'HOME', days: 18 })), false);
    assert.equal(creditedYearly(type({ statutoryCode: 'SUBSTITUTE', days: 0 })), false);
    assert.equal(creditedYearly(type({ statutoryCode: null, isStatutory: false, days: 5 })), true);
    assert.equal(creditedYearly(maternity), false);
  });
});

describe('opening a leave year (Labour Act §49, §50)', () => {
  const home = type({ id: 'home', name: 'Home Leave', code: 'HOME', statutoryCode: 'HOME', days: 18, accumulationCap: null, isRight: false });
  const sick = type({ id: 'sick', accumulationCap: null });
  const sub = type({ id: 'sub', name: 'Substitute Leave', code: 'SUBSTITUTE', statutoryCode: 'SUBSTITUTE', days: 0, accumulationCap: null, expiryDays: 21 });
  const study = type({ id: 'study', name: 'Study leave', code: 'STUDY', statutoryCode: null, isStatutory: false, days: 5, accumulationCap: null, isRight: false });
  const bonus = type({ id: 'bonus', name: 'Long service', code: 'LSL', statutoryCode: null, isStatutory: false, days: 0, accumulationCap: 10, carryForward: true, isEncashable: true, isRight: false });
  const oldYear = { id: 'y1', label: '2082/83', end: '2026-07-16' };
  const newYear = { id: 'y2', label: '2083/84', start: '2026-07-17', end: '2027-07-16' };
  const plan = planOpening({
    types: [home, sick, sub, study, bonus, { ...maternity, id: 'mat' }],
    people: [
      { id: 'p1', gender: 'Male', joiningDate: '2020-01-01', terminationDate: null },
      { id: 'p2', gender: 'Male', joiningDate: '2027-01-15', terminationDate: null },
      { id: 'p3', gender: 'Male', joiningDate: '2020-01-01', terminationDate: '2026-07-01' },
    ],
    oldYear,
    newYear,
    oldLines: new Map([
      ['p1|home', [line('opening', 100, '2025-07-17')]],
      ['p1|sick', [line('opening', 30, '2025-07-17')]],
      ['p1|study', [line('credit', 5, '2025-07-17'), line('taken', -2, '2026-01-10')]],
      ['p1|bonus', [line('opening', 14, '2025-07-17')]],
      ['p1|sub', [line('grant', 1, '2026-06-01', '2026-06-22', 'g1'), line('grant', 1, '2026-07-10', '2026-07-31', 'g2')]],
    ]),
    creditedInNewYear: new Set(['p2|sick']),
  });
  const row = (e: string, t: string) => plan.rows.find((r) => r.employeeId === e && r.leaveTypeId === t);
  const lines = (e: string, t: string) => plan.lines.filter((l) => l.employeeId === e && l.leaveTypeId === t);

  it('home leave carries up to 90; the excess is marked to be paid out in the old year', () => {
    assert.deepEqual(row('p1', 'home'), { employeeId: 'p1', leaveTypeId: 'home', closing: 100, carry: 90, over: 10, overKind: 'paid_out', credit: 0, opening: 90 });
    const out = lines('p1', 'home').find((l) => l.kind === 'paid_out')!;
    assert.equal(out.days, -10);
    assert.equal(out.fiscalYearId, 'y1');
    assert.equal(out.entryDate, '2026-07-16');
    assert.equal(lines('p1', 'home').find((l) => l.kind === 'carried_forward')!.fiscalYearId, 'y2');
  });

  it('sick leave carries (under 45) and gets the 12-day credit', () => {
    assert.deepEqual(row('p1', 'sick'), { employeeId: 'p1', leaveTypeId: 'sick', closing: 30, carry: 30, over: 0, overKind: null, credit: 12, opening: 42 });
  });

  it('a company type that does not carry over lapses and is credited afresh', () => {
    const r = row('p1', 'study')!;
    assert.equal(r.over, 3);
    assert.equal(r.overKind, 'lapsed');
    assert.equal(r.opening, 5);
  });

  it('an encashable company type carries to its cap and the rest is to be paid out', () => {
    const r = row('p1', 'bonus')!;
    assert.deepEqual([r.carry, r.over, r.overKind], [10, 4, 'paid_out']);
  });

  it('substitute leave moves only grants still valid, with their expiry', () => {
    const moved = lines('p1', 'sub');
    assert.equal(moved.length, 1);
    assert.equal(moved[0].expiresOn, '2026-07-31');
    assert.equal(moved[0].days, 1);
  });

  it('joiners: pro-rata credit, skipped if already credited at hire; leavers and event types are left out', () => {
    assert.equal(row('p2', 'study')!.credit, proRata(5, '2027-01-15', newYear));
    assert.equal(row('p2', 'sick')!.credit, 0);
    assert.equal(plan.rows.some((r) => r.employeeId === 'p3'), false);
    assert.equal(plan.rows.some((r) => r.leaveTypeId === 'mat'), false);
  });

  it('every line says it belongs to this opening', () => {
    assert.ok(plan.lines.length > 0);
    assert.ok(plan.lines.every((l) => l.ref === 'opening:y2'));
  });
});

describe('home leave month by month (Labour Act §43)', () => {
  // FY 2083/84 in BS months (start / end in AD); today is 19 Aswin (5 Oct 2026).
  const shrawan = { label: 'Shrawan 2083', start: '2026-07-17', end: '2026-08-16' };
  const bhadra = { label: 'Bhadra 2083', start: '2026-08-17', end: '2026-09-16' };
  const aswin = { label: 'Aswin 2083', start: '2026-09-17', end: '2026-10-17' };
  const kartik = { label: 'Kartik 2083', start: '2026-10-18', end: '2026-11-16' };
  const today = '2026-10-05';

  it('a closed month adds what was posted; an open one shows what it has earned so far', () => {
    const r = homeLeaveMonths({
      months: [
        { ...shrawan, closed: true, closedPaidDays: 31, posted: 1.55 },
        { ...bhadra, closed: false, closedPaidDays: null, posted: 0, livePaidDays: 20 },
        { ...aswin, closed: false, closedPaidDays: null, posted: 0, livePaidDays: 18 },
        { ...kartik, closed: false, closedPaidDays: null, posted: 0 },
      ],
      joiningDate: '2020-01-01',
      terminationDate: null,
      today,
      everyDays: 20,
    });
    assert.deepEqual(r.months.map((m) => m.status), ['closed', 'waiting', 'open', 'to_come']);
    assert.equal(r.earned, 1.55);
    assert.equal(r.months[0].earned, 1.55);
    assert.equal(r.months[1].earned, 1);
    assert.equal(r.months[2].earned, 0.9);
    // Up to: 1.55 + Bhadra 20/20 + Aswin (18 so far + 13 days from today) / 20 + Kartik 30/20.
    assert.equal(r.upTo, 1.55 + 1 + 1.55 + 1.5);
  });

  it('months before joining or after leaving are not counted', () => {
    const r = homeLeaveMonths({
      months: [
        { ...shrawan, closed: false, closedPaidDays: null, posted: 0 },
        { ...bhadra, closed: false, closedPaidDays: null, posted: 0, livePaidDays: null },
        { ...kartik, closed: false, closedPaidDays: null, posted: 0 },
      ],
      joiningDate: '2026-08-27',
      terminationDate: '2026-11-06',
      today,
      everyDays: 20,
    });
    assert.equal(r.months[0].status, 'outside');
    // Bhadra from 27 Aug (21 days), unknown so far: counted as if paid. Kartik to 6 Nov (20 days).
    assert.equal(r.upTo, 1.05 + 1);
    assert.equal(r.earned, 0);
  });

  it('a company rate more generous than the law is used (1 day per 18)', () => {
    const r = homeLeaveMonths({ months: [{ ...kartik, closed: false, closedPaidDays: null, posted: 0 }], joiningDate: '2020-01-01', terminationDate: null, today, everyDays: 18 });
    assert.equal(r.upTo, 1.67);
  });
});

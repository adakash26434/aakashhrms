import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, nepalDateIso, nepalToday, toIsoDate, toLocalDate } from '../lib/utils/nepal-time';
import { RECENTLY_PASSED_DAYS } from '../lib/constants/statutory-deadlines';
import {
  approvalsPreview,
  attendanceByDay,
  attendanceRate,
  fiscalProgress,
  nextBsAnniversary,
  statutorySummary,
  upcomingEvents,
  buildKpis,
  costBreakdown,
  costTrend,
  deadlineTone,
  deadlineWhen,
  isValidPan,
  latestRunPeriod,
  nextPeriodToRun,
  parsePeriodOption,
  payrollReadiness,
  percentChange,
  resolvePeriod,
  shiftPeriod,
  sumCostRows,
  topDepartments,
  upcomingDeadlines,
  type RunLike,
} from '../lib/engines/dashboard.engine';
import { bsToAD, getDaysInBSMonth } from '../lib/utils/bs-calendar';
import type { PeriodCostRow } from '../lib/types/dashboard';

function row(year: number, month: number, over: Partial<PeriodCostRow> = {}): PeriodCostRow {
  return {
    year, month, gross: 1000, net: 800, totalDeductions: 200, tds: 30, pfEmployee: 20, pfEmployer: 20,
    ssfEmployee: 40, ssfEmployer: 60, cit: 10, loan: 15, ot: 0, employees: 4, locked: true, ...over,
  };
}

function run(over: Partial<RunLike> & Pick<RunLike, 'payPeriodYear' | 'payPeriodMonth'>): RunLike {
  return { id: `${over.payPeriodYear}-${over.payPeriodMonth}-${Math.random()}`, status: 'LOCKED', totalGross: 100, totalNetPayable: 90, employeeCount: 2, ...over };
}

describe('Dashboard: Nepal time', () => {
  it('uses the Kathmandu date, not the server date', () => {
    assert.equal(nepalDateIso(new Date('2026-10-01T20:00:00Z')), '2026-10-02');
    assert.equal(nepalDateIso(new Date('2026-10-01T18:00:00Z')), '2026-10-01');
    const d = nepalToday(new Date('2026-10-01T20:00:00Z'));
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 9, 2]);
  });

  it('counts calendar days and parses ISO dates locally', () => {
    assert.equal(daysBetween(new Date(2026, 0, 30), new Date(2026, 1, 2)), 3);
    assert.equal(toIsoDate(addDays(new Date(2026, 0, 30), 3)), '2026-02-02');
    assert.equal(toIsoDate(toLocalDate('2026-03-04')!), '2026-03-04');
    assert.equal(toLocalDate('not a date'), null);
  });
});

describe('Dashboard: periods', () => {
  it('shifts BS months across the year boundary', () => {
    assert.deepEqual(shiftPeriod({ year: 2083, month: 1 }, -1), { year: 2082, month: 12 });
    assert.deepEqual(shiftPeriod({ year: 2083, month: 12 }, 1), { year: 2084, month: 1 });
    assert.deepEqual(shiftPeriod({ year: 2083, month: 6 }, -11), { year: 2082, month: 7 });
  });

  it('only accepts known period options from the URL', () => {
    assert.equal(parsePeriodOption('fy'), 'fy');
    assert.equal(parsePeriodOption('12m'), '12m');
    assert.equal(parsePeriodOption('<script>'), 'latest');
    assert.equal(parsePeriodOption(undefined), 'latest');
  });

  it('latest month compares with the month before', () => {
    const p = resolvePeriod('latest', { year: 2083, month: 5 }, { year: 2083, month: 6 });
    assert.equal(p.label, 'Bhadra 2083');
    assert.equal(p.compareLabel, 'vs Shrawan 2083');
    assert.deepEqual(p.previous.from, { year: 2083, month: 4 });
  });

  it('fiscal year to date starts in Shrawan and compares with the same months last year', () => {
    const p = resolvePeriod('fy', { year: 2083, month: 5 }, { year: 2083, month: 6 });
    assert.deepEqual(p.current, { from: { year: 2083, month: 4 }, to: { year: 2083, month: 5 } });
    assert.deepEqual(p.previous, { from: { year: 2082, month: 4 }, to: { year: 2082, month: 5 } });
    assert.equal(p.label, 'FY 2083/84 to date');
    // Before Shrawan the fiscal year began the previous BS year.
    assert.deepEqual(resolvePeriod('fy', { year: 2083, month: 2 }, { year: 2083, month: 3 }).current.from, { year: 2082, month: 4 });
  });

  it('last 12 months ends at the latest month', () => {
    const p = resolvePeriod('12m', { year: 2083, month: 5 }, { year: 2083, month: 6 });
    assert.deepEqual(p.current.from, { year: 2082, month: 6 });
    assert.deepEqual(p.previous.to, { year: 2082, month: 5 });
  });
});

describe('Dashboard: payroll cost', () => {
  it('employer cost is gross + employer PF (employer SSF is already in gross); statutory includes both SSF sides', () => {
    const t = sumCostRows([row(2083, 4), row(2083, 5, { gross: 2000.1, pfEmployer: 0.2 })]);
    assert.equal(t.gross, 3000.1);
    assert.equal(t.employerCost, 3020.3); // decimal-exact (3000.1 + 20 + 0.2 in floats is 3020.2999…)
    assert.equal(t.statutory, 30 + 40 + 60 + 20 + 20 + 10 + 30 + 40 + 60 + 20 + 0.2 + 10);
    assert.equal(t.employeeMonths, 8);
  });

  it('breakdown segments add up to the employer cost; "other" absorbs the rest and is never negative', () => {
    const t = sumCostRows([row(2083, 5)]);
    const b = costBreakdown(t);
    assert.equal(b.total, t.employerCost);
    assert.equal(b.segments.find((s) => s.id === 'other')!.amount, 200 - (30 + 100 + 20 + 10 + 15));
    const odd = costBreakdown(sumCostRows([row(2083, 5, { totalDeductions: 50 })]));
    assert.equal(odd.segments.find((s) => s.id === 'other'), undefined);
  });

  it('percent change is null without a base', () => {
    assert.equal(percentChange(110, 100), 10);
    assert.equal(percentChange(90, 100), -10);
    assert.equal(percentChange(5, 0), null);
    assert.equal(percentChange(null, 100), null);
  });

  it('trend fills months without payroll and flags change on the previous month with data', () => {
    const rows = [row(2083, 3, { gross: 1000, pfEmployer: 0 }), row(2083, 5, { gross: 1200, pfEmployer: 0, locked: false })];
    const trend = costTrend(rows, { year: 2083, month: 5 }, 3);
    assert.deepEqual(trend.map((p) => p.shortLabel), ['Asa', 'Shr', 'Bha']);
    assert.deepEqual(trend.map((p) => p.hasData), [true, false, true]);
    assert.deepEqual(trend.map((p) => p.changePct), [null, null, 20]);
    assert.equal(trend[2].locked, false);
  });

  it('KPIs compare the selected window with the comparison window and flag swings', () => {
    const rows = [row(2083, 4, { gross: 1000, pfEmployer: 0 }), row(2083, 5, { gross: 1150, pfEmployer: 0 })];
    const kpis = buildKpis({
      rows,
      period: resolvePeriod('latest', { year: 2083, month: 5 }, { year: 2083, month: 6 }),
      activeHeadcount: 10,
      joiners: 2,
      leavers: 1,
      nextDeadline: null,
    });
    const cost = kpis.find((k) => k.id === 'cost')!;
    assert.equal(cost.value, 1150);
    assert.equal(cost.changePct, 15);
    assert.equal(cost.tone, 'warning');
    const head = kpis.find((k) => k.id === 'headcount')!;
    assert.equal(head.changeNote, '+1 this month');
    assert.equal(head.changePct, null);
    assert.equal(head.hint, '2 joined · 1 left this month');
    assert.equal(kpis.find((k) => k.id === 'average')!.value, 287.5);
    assert.equal(cost.sparkline.length, 12);
  });

  it('KPIs show no value for a new company instead of zeros', () => {
    const kpis = buildKpis({ rows: [], period: resolvePeriod('latest', null, { year: 2083, month: 6 }), activeHeadcount: 3, joiners: null, leavers: null, nextDeadline: null });
    assert.equal(kpis.find((k) => k.id === 'cost')!.value, null);
    assert.equal(kpis.find((k) => k.id === 'cost')!.changePct, null);
  });

  it('keeps the largest departments and merges the rest', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ name: `D${i}`, cost: (i + 1) * 100, employees: 1 }));
    const top = topDepartments(rows, 4);
    assert.deepEqual(top.map((d) => d.name), ['D9', 'D8', 'D7', 'Other (7)']);
    assert.equal(top[3].cost, 100 + 200 + 300 + 400 + 500 + 600 + 700);
  });
});

describe('Dashboard: pay runs', () => {
  it('combines branch runs of the latest month; status is the slowest branch', () => {
    const latest = latestRunPeriod([
      run({ payPeriodYear: 2083, payPeriodMonth: 4 }),
      run({ payPeriodYear: 2083, payPeriodMonth: 5, status: 'APPROVED', totalGross: '1000.10' }),
      run({ payPeriodYear: 2083, payPeriodMonth: 5, status: 'UNDER_REVIEW', totalGross: '2000.20' }),
      run({ payPeriodYear: 2082, payPeriodMonth: 12 }),
    ])!;
    assert.equal(latest.label, 'Bhadra 2083');
    assert.equal(latest.status, 'UNDER_REVIEW');
    assert.equal(latest.runCount, 2);
    assert.equal(latest.gross, 3000.3);
  });

  it('suggests the next month only after the latest is locked and the month has begun', () => {
    const today = { year: 2083, month: 6 };
    assert.equal(nextPeriodToRun({ year: 2083, month: 4, status: 'LOCKED' }, today)?.label, 'Bhadra 2083');
    assert.equal(nextPeriodToRun({ year: 2083, month: 5, status: 'UNDER_REVIEW' }, today), null);
    assert.equal(nextPeriodToRun({ year: 2083, month: 6, status: 'LOCKED' }, today), null);
    assert.equal(nextPeriodToRun({ year: 2082, month: 12, status: 'LOCKED' }, { year: 2083, month: 1 })?.label, 'Baisakh 2083');
    assert.equal(nextPeriodToRun(null, today)?.label, 'Aswin 2083');
  });
});

describe('Dashboard: attendance', () => {
  it('counts each status, adds approved leave for unrecorded employees and never assumes present', () => {
    const days = attendanceByDay(
      ['2026-10-01', '2026-10-02'],
      ['a', 'b', 'c', 'd'],
      [
        { employeeId: 'a', date: '2026-10-01', status: 'Present' },
        { employeeId: 'b', date: '2026-10-01', status: 'Half Day' },
        { employeeId: 'c', date: '2026-10-01', status: 'Absent' },
        { employeeId: 'x', date: '2026-10-01', status: 'Present' }, // outside the roster (scope)
        { employeeId: 'a', date: '2026-10-02', status: 'Weekly Off' },
      ],
      [{ employeeId: 'd', from: '2026-10-01', to: '2026-10-01' }, { employeeId: 'a', from: '2026-10-02', to: '2026-10-02' }]
    );
    assert.deepEqual(
      days.map(({ present, leave, absent, off, notRecorded }) => [present, leave, absent, off, notRecorded]),
      [
        [2, 1, 1, 0, 0],
        [0, 0, 0, 1, 3], // a's record wins over the leave span; nobody else recorded
      ]
    );
    // Days are numbered by position in the BS month, not by the AD date.
    assert.deepEqual(days.map((d) => d.day), [1, 2]);
  });
});

describe('Dashboard: statutory deadlines', () => {
  it('puts TDS 25 days and SSF 15 days after the end of the BS month', () => {
    const today = bsToAD(2083, 6, 1);
    const list = upcomingDeadlines(today);
    const bhadraEnd = bsToAD(2083, 5, getDaysInBSMonth(2083, 5));
    assert.equal(list.find((d) => d.ruleId === 'tds')!.dueDate, toIsoDate(addDays(bhadraEnd, 25)));
    assert.equal(list.find((d) => d.ruleId === 'ssf')!.dueDate, toIsoDate(addDays(bhadraEnd, 15)));
  });

  it('keeps a recently passed deposit visible, then drops it after the grace window', () => {
    const bhadraEnd = bsToAD(2083, 5, getDaysInBSMonth(2083, 5));
    const ssf = upcomingDeadlines(addDays(bhadraEnd, 16)).filter((d) => d.ruleId === 'ssf');
    assert.deepEqual(ssf.map((d) => [d.forMonth, d.daysLeft]), [[5, -1], [6, ssf[1].daysLeft]]);
    const later = upcomingDeadlines(addDays(bhadraEnd, 15 + RECENTLY_PASSED_DAYS + 1)).filter((d) => d.ruleId === 'ssf');
    assert.ok(later.every((d) => d.daysLeft >= 0));
  });

  it('labels and tones', () => {
    assert.deepEqual([deadlineWhen(0), deadlineWhen(1), deadlineWhen(-1), deadlineWhen(-3), deadlineWhen(9)], ['Today', 'Tomorrow', 'Yesterday', '3 days ago', '9 days']);
    assert.deepEqual([deadlineTone(-2), deadlineTone(5), deadlineTone(20)], ['danger', 'warning', 'neutral']);
  });
});

describe('Dashboard: readiness and approvals', () => {
  it('validates PAN as 9 digits and lists failing checks, largest first', () => {
    assert.equal(isValidPan('601234567'), true);
    assert.equal(isValidPan('12345'), false);
    const issues = payrollReadiness([
      { id: '1', fullName: 'A', employeeCode: 'E1', panNumber: null, bankAccountNumber: '1', basicSalary: 10 },
      { id: '2', fullName: 'B', employeeCode: 'E2', panNumber: 'bad', bankAccountNumber: '', basicSalary: 10 },
      { id: '3', fullName: 'C', employeeCode: 'E3', panNumber: '601234567', bankAccountNumber: '2', basicSalary: 10 },
    ]);
    assert.deepEqual(issues.map((i) => [i.id, i.count]), [['pan', 2], ['bank', 1]]);
  });

  it('previews the oldest requests in scope with waiting days', () => {
    const pending = [
      { id: 'p1', employeeId: 'e1', leaveTypeId: 't', appliedDate: '2026-09-28', effectiveFrom: '2026-10-05', effectiveTo: '2026-10-06', noOfDays: 2 },
      { id: 'p2', employeeId: 'e2', leaveTypeId: 't', appliedDate: '2026-09-25', effectiveFrom: '2026-10-05', effectiveTo: '2026-10-05', noOfDays: 1 },
      { id: 'p3', employeeId: 'outsider', leaveTypeId: 't', appliedDate: '2026-09-20', effectiveFrom: '2026-10-05', effectiveTo: '2026-10-05', noOfDays: 1 },
    ];
    const out = approvalsPreview(pending, { employeeNames: new Map([['e1', 'Sita'], ['e2', 'Ram']]), leaveTypeNames: new Map([['t', 'Annual']]), today: new Date(2026, 9, 2) }, 5);
    assert.equal(out.total, 2);
    assert.deepEqual(out.items.map((i) => [i.employeeName, i.waitingDays]), [['Ram', 7], ['Sita', 4]]);
  });
});

describe('Dashboard: statutory, attendance rate, fiscal progress', () => {
  it('lists statutory heads with employee and employer sides apart, total = statutory', () => {
    const t = sumCostRows([row(2083, 5, { pfEmployee: 0, pfEmployer: 0 })]);
    const s = statutorySummary(t);
    assert.equal(s.total, t.statutory);
    assert.deepEqual(s.rows.map((r) => r.id), ['tds', 'ssfEmployee', 'ssfEmployer', 'cit']); // zero PF rows dropped
  });

  it('attendance rate is present over recorded working days, null when nothing recorded', () => {
    assert.equal(attendanceRate([{ date: 'x', day: 1, present: 8, leave: 1, absent: 1, off: 5, notRecorded: 3 }]), 80);
    assert.equal(attendanceRate([{ date: 'x', day: 1, present: 0, leave: 0, absent: 0, off: 2, notRecorded: 9 }]), null);
  });

  it('counts fiscal-year months from Shrawan', () => {
    assert.deepEqual(fiscalProgress({ year: 2083, month: 4 }), { label: 'FY 2083/84', month: 1 });
    assert.deepEqual(fiscalProgress({ year: 2083, month: 6 }), { label: 'FY 2083/84', month: 3 });
    assert.deepEqual(fiscalProgress({ year: 2084, month: 3 }), { label: 'FY 2083/84', month: 12 });
  });
});

describe('Dashboard: upcoming events', () => {
  const today = bsToAD(2083, 6, 16);

  it('finds the next BS recurrence of a date, clamping to short months', () => {
    const dob = bsToAD(2050, 6, 20);
    const next = nextBsAnniversary(dob, today)!;
    assert.equal(toIsoDate(next.date), toIsoDate(bsToAD(2083, 6, 20)));
    const passed = nextBsAnniversary(bsToAD(2050, 6, 10), today)!;
    assert.equal(passed.bsYear, 2084);
  });

  it('merges holidays, birthdays and anniversaries within the window, soonest first, never showing age', () => {
    const events = upcomingEvents({
      today,
      holidays: [
        { id: 'h1', name: 'Dashain', category: 'Public', startDateAD: addDays(today, 5), endDateAD: addDays(today, 9) },
        { id: 'h2', name: 'Over', category: 'Public', startDateAD: addDays(today, -5), endDateAD: addDays(today, -1) },
        { id: 'h3', name: 'Far', category: 'Public', startDateAD: addDays(today, 60), endDateAD: addDays(today, 60) },
      ],
      employees: [
        { id: 'e1', fullName: 'Sita', dateOfBirth: bsToAD(2050, 6, 18), joiningDate: bsToAD(2080, 6, 16) },
        { id: 'e2', fullName: 'Ram', dateOfBirth: bsToAD(2050, 1, 1), joiningDate: bsToAD(2083, 6, 20) }, // joined this year: no anniversary
      ],
    });
    assert.deepEqual(events.map((e) => [e.kind, e.title, e.daysAway]), [
      ['anniversary', 'Sita', 0],
      ['birthday', 'Sita', 2],
      ['holiday', 'Dashain', 5],
    ]);
    assert.equal(events[0].detail, '3 years with the company');
    assert.equal(events[1].detail, 'Birthday');
    assert.equal(events[2].detail, '5 days');
  });

  it('keeps an ongoing holiday and shows it from today', () => {
    const [e] = upcomingEvents({ today, holidays: [{ id: 'h', name: 'Tihar', category: 'Public', startDateAD: addDays(today, -1), endDateAD: addDays(today, 2) }], employees: [] });
    assert.equal(e.daysAway, 0);
    assert.equal(e.date, toIsoDate(today));
  });
});

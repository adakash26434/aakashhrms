import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, nepalDateIso, nepalToday, toIsoDate, toLocalDate } from '../lib/home/nepal-time';
import { deadlineTone, deadlineWhen, RECENTLY_PASSED_DAYS, upcomingDeadlines } from '../lib/home/deadlines';
import { latestPeriod, nextPeriodToRun, payrollTrend, summarizePeriod, type RunLike } from '../lib/home/payroll-period';
import { isValidPan, payrollReadiness } from '../lib/home/readiness';
import { buildLeaveQueue, rangesOverlap, type LeaveLike } from '../lib/home/leave-queue';
import { adToBS, bsToAD, getDaysInBSMonth } from '../lib/utils/bs-calendar';

function run(partial: Partial<RunLike> & Pick<RunLike, 'payPeriodYear' | 'payPeriodMonth'>): RunLike {
  return {
    id: `${partial.payPeriodYear}-${partial.payPeriodMonth}-${Math.random()}`,
    status: 'LOCKED',
    totalGross: 100,
    totalDeductions: 10,
    totalNetPayable: 90,
    totalTds: 3,
    totalSsf: 5,
    employeeCount: 2,
    ...partial,
  };
}

describe('Home: Nepal time', () => {
  it('uses the Kathmandu date, not the server date', () => {
    // 2026-10-01 20:00 UTC is already 2 Oct 01:45 in Kathmandu.
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

describe('Home: statutory deadlines', () => {
  it('puts TDS 25 days and SSF 15 days after the end of the BS month', () => {
    const today = bsToAD(2083, 6, 1); // Ashwin 1, 2083
    const list = upcomingDeadlines(today);
    const bhadraEnd = bsToAD(2083, 5, getDaysInBSMonth(2083, 5));
    const tds = list.find((d) => d.ruleId === 'tds')!;
    const ssf = list.find((d) => d.ruleId === 'ssf')!;
    assert.equal(tds.forPeriod, 'Bhadra 2083');
    assert.equal(tds.dueDate, toIsoDate(addDays(bhadraEnd, 25)));
    assert.equal(ssf.dueDate, toIsoDate(addDays(bhadraEnd, 15)));
    assert.ok(list[0].daysLeft <= list[list.length - 1].daysLeft, 'sorted by due date');
  });

  it('keeps a recently passed deposit visible and adds the next one', () => {
    const bhadraEnd = bsToAD(2083, 5, getDaysInBSMonth(2083, 5));
    const today = addDays(bhadraEnd, 16); // SSF for Bhadra was due yesterday
    const ssf = upcomingDeadlines(today).filter((d) => d.ruleId === 'ssf');
    assert.deepEqual(ssf.map((d) => [d.forMonth, d.daysLeft < 0]), [[5, true], [6, false]]);
    assert.equal(ssf[0].daysLeft, -1);
  });

  it('drops a passed deposit after the grace window', () => {
    const bhadraEnd = bsToAD(2083, 5, getDaysInBSMonth(2083, 5));
    const today = addDays(bhadraEnd, 15 + RECENTLY_PASSED_DAYS + 1);
    assert.ok(upcomingDeadlines(today).filter((d) => d.ruleId === 'ssf').every((d) => d.daysLeft >= 0));
  });

  it('labels and tones', () => {
    assert.equal(deadlineWhen(0), 'Today');
    assert.equal(deadlineWhen(1), 'Tomorrow');
    assert.equal(deadlineWhen(-1), 'Yesterday');
    assert.equal(deadlineWhen(-3), '3 days ago');
    assert.equal(deadlineTone(-2), 'danger');
    assert.equal(deadlineTone(5), 'warning');
    assert.equal(deadlineTone(20), 'neutral');
  });
});

describe('Home: payroll period', () => {
  it('combines branch runs of the latest period; status is the slowest branch', () => {
    const runs = [
      run({ payPeriodYear: 2083, payPeriodMonth: 4 }),
      run({ payPeriodYear: 2083, payPeriodMonth: 5, status: 'APPROVED', totalGross: '1000.10', totalNetPayable: '900.05' }),
      run({ payPeriodYear: 2083, payPeriodMonth: 5, status: 'UNDER_REVIEW', totalGross: '2000.20', totalNetPayable: '1800.10' }),
    ];
    const latest = latestPeriod(runs)!;
    assert.equal(latest.label, 'Bhadra 2083');
    assert.equal(latest.status, 'UNDER_REVIEW');
    assert.equal(latest.runCount, 2);
    assert.equal(latest.gross, 3000.3); // decimal-safe sum
    assert.equal(latest.net, 2700.15);
    assert.equal(latest.statusCounts.APPROVED, 1);
  });

  it('picks the latest period by BS month, not by creation order', () => {
    const runs = [run({ payPeriodYear: 2083, payPeriodMonth: 5 }), run({ payPeriodYear: 2082, payPeriodMonth: 12 })];
    assert.equal(latestPeriod(runs)!.label, 'Bhadra 2083');
    assert.equal(summarizePeriod([]), null);
  });

  it('suggests the next period only after the latest is locked and its month has started', () => {
    const today = { year: 2083, month: 6 };
    assert.deepEqual(nextPeriodToRun({ year: 2083, month: 4, status: 'LOCKED' }, today)?.label, 'Bhadra 2083');
    assert.equal(nextPeriodToRun({ year: 2083, month: 5, status: 'UNDER_REVIEW' }, today), null);
    assert.equal(nextPeriodToRun({ year: 2083, month: 6, status: 'LOCKED' }, today), null);
    assert.equal(nextPeriodToRun({ year: 2082, month: 12, status: 'LOCKED' }, { year: 2083, month: 1 })?.label, 'Baisakh 2083');
    assert.equal(nextPeriodToRun(null, today)?.label, 'Aswin 2083');
  });

  it('builds an oldest-first trend with period-on-period change', () => {
    const runs = [
      run({ payPeriodYear: 2083, payPeriodMonth: 3, totalNetPayable: 100 }),
      run({ payPeriodYear: 2083, payPeriodMonth: 4, totalNetPayable: 112 }),
      run({ payPeriodYear: 2083, payPeriodMonth: 5, totalNetPayable: 112, status: 'DRAFT' }),
    ];
    const trend = payrollTrend(runs, 6);
    assert.deepEqual(trend.map((t) => t.shortLabel), ['Asa', 'Shr', 'Bha']);
    assert.deepEqual(trend.map((t) => t.netChangePct), [null, 12, 0]);
    assert.deepEqual(trend.map((t) => t.locked), [true, true, false]);
  });
});

describe('Home: payroll readiness', () => {
  it('validates PAN as 9 digits', () => {
    assert.equal(isValidPan('601234567'), true);
    assert.equal(isValidPan(' 601234567 '), true);
    assert.equal(isValidPan('12345'), false);
    assert.equal(isValidPan(null), false);
  });

  it('lists only failing checks, largest first, with a sample', () => {
    const issues = payrollReadiness([
      { id: '1', fullName: 'A', employeeCode: 'E1', panNumber: null, bankAccountNumber: '1', basicSalary: 10 },
      { id: '2', fullName: 'B', employeeCode: 'E2', panNumber: 'bad', bankAccountNumber: '', basicSalary: 10 },
      { id: '3', fullName: 'C', employeeCode: 'E3', panNumber: '601234567', bankAccountNumber: '2', basicSalary: 10 },
    ]);
    assert.deepEqual(issues.map((i) => [i.id, i.count]), [['pan', 2], ['bank', 1]]);
    assert.deepEqual(issues[0].sample.map((s) => s.code), ['E1', 'E2']);
  });
});

describe('Home: leave queue', () => {
  const employees = new Map([
    ['e1', { fullName: 'Sita', employeeCode: 'E1', departmentId: 'fin' }],
    ['e2', { fullName: 'Ram', employeeCode: 'E2', departmentId: 'fin' }],
    ['e3', { fullName: 'Hari', employeeCode: 'E3', departmentId: 'ops' }],
  ]);
  const leave = (id: string, employeeId: string, from: string, to: string, status = 'Pending', applied = '2026-09-20'): LeaveLike => ({
    id, employeeId, leaveTypeId: 't1', appliedDate: applied, effectiveFrom: from, effectiveTo: to, noOfDays: 2, reason: 'r', status,
  });

  it('detects overlapping ranges inclusively', () => {
    assert.equal(rangesOverlap('2026-10-01', '2026-10-03', '2026-10-03', '2026-10-05'), true);
    assert.equal(rangesOverlap('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'), false);
  });

  it('adds balance, waiting days and same-department overlaps; oldest first', () => {
    const pending = [leave('p1', 'e1', '2026-10-05', '2026-10-06', 'Pending', '2026-09-28'), leave('p2', 'e3', '2026-10-05', '2026-10-06', 'Pending', '2026-09-25')];
    const queue = buildLeaveQueue(pending, {
      employees,
      departments: new Map([['fin', 'Finance'], ['ops', 'Operations']]),
      leaveTypes: new Map([['t1', { name: 'Annual', leaveType: 'Pay' }]]),
      balances: new Map([['e1:t1', 5]]),
      others: [...pending, leave('a1', 'e2', '2026-10-06', '2026-10-08', 'Approved'), leave('x', 'e2', '2026-10-05', '2026-10-05', 'Rejected')],
      today: new Date(2026, 9, 2),
    });
    assert.deepEqual(queue.map((q) => q.id), ['p2', 'p1']);
    const sita = queue.find((q) => q.id === 'p1')!;
    assert.equal(sita.balance, 5);
    assert.equal(sita.waitingDays, 4);
    assert.deepEqual(sita.overlaps, [{ name: 'Ram', status: 'Approved' }]); // rejected and other departments ignored
    assert.equal(queue.find((q) => q.id === 'p2')!.balance, null);
  });

  it('drops requests for employees outside the loaded (scoped) set', () => {
    const queue = buildLeaveQueue([leave('p9', 'outsider', '2026-10-05', '2026-10-06')], {
      employees, departments: new Map(), leaveTypes: new Map(), balances: new Map(), others: [],
    });
    assert.equal(queue.length, 0);
  });
});

describe('Home: BS calendar sanity for deadlines', () => {
  it('round-trips a BS month end', () => {
    const end = bsToAD(2083, 5, getDaysInBSMonth(2083, 5));
    const bs = adToBS(end);
    assert.deepEqual([bs.year, bs.month, bs.day], [2083, 5, getDaysInBSMonth(2083, 5)]);
  });
});

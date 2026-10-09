import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTLEMENT_SETTINGS, encashmentAmount, gratuityAmount, monthsServed, parseSettlementSettings, settlementFigures, settlementShortfall, validateSettlementSettings } from '../lib/engines/settlement.engine';

// 4.8b-3 Final settlement: the rules that need no database.

const settings = { ...DEFAULT_SETTLEMENT_SETTINGS };

describe('Final settlement: service and gratuity (4.8b)', () => {
  it('counts whole months served, the last working day included', () => {
    assert.equal(monthsServed('2024-01-01', '2024-12-31'), 12);
    assert.equal(monthsServed('2024-01-15', '2025-01-14'), 12);
    assert.equal(monthsServed('2024-01-15', '2025-01-13'), 11);
    assert.equal(monthsServed('2024-03-01', '2024-03-15'), 0);
    assert.equal(monthsServed('2025-01-01', '2024-01-01'), 0);
  });

  it('gratuity: 8.33% of basic per month from one year; none for an SSF member unless the company says so', () => {
    assert.deepEqual(gratuityAmount({ basic: '30000', months: 24, ssfMember: false, settings }), { amount: '59976', reason: null });
    assert.equal(gratuityAmount({ basic: '30000', months: 11, ssfMember: false, settings }).amount, '0');
    assert.match(gratuityAmount({ basic: '30000', months: 11, ssfMember: false, settings }).reason!, /Under 12 months/);
    assert.match(gratuityAmount({ basic: '30000', months: 24, ssfMember: true, settings }).reason!, /SSF member/);
    assert.equal(gratuityAmount({ basic: '30000', months: 24, ssfMember: true, settings: { ...settings, gratuityForSsfMembers: true } }).amount, '59976');
  });

  it('leave is encashed at basic per day (÷ 30) or at the type\'s fixed daily amount', () => {
    assert.deepEqual(encashmentAmount({ days: 30, basic: '30000', rate: 'BASIC_DAILY', fixed: null }), { perDay: '1000', amount: '30000' });
    assert.deepEqual(encashmentAmount({ days: 4.5, basic: '30000', rate: 'FIXED_AMOUNT', fixed: 800 }), { perDay: '800', amount: '3600' });
  });

  it('settings are parsed from JSON with defaults and validated', () => {
    assert.deepEqual(parseSettlementSettings('{"gratuityPctPerMonth":"10","gratuityForSsfMembers":"true"}'), { gratuityPctPerMonth: 10, gratuityMinMonths: 12, gratuityWithholdingPct: 5, gratuityForSsfMembers: true });
    assert.deepEqual(parseSettlementSettings('not json'), DEFAULT_SETTLEMENT_SETTINGS);
    assert.deepEqual(validateSettlementSettings({ ...settings, gratuityPctPerMonth: 120, gratuityMinMonths: 1.5 }), { gratuityPctPerMonth: 'Between 0 and 100 percent', gratuityMinMonths: 'Whole months, 0 to 120' });
  });
});

describe('Final settlement: the payslip lines (4.8b)', () => {
  const figures = settlementFigures({
    month: { label: 'Aswin 2083', grossEarnings: '20000', statutoryDeductions: [{ label: 'SSF', amount: '3300' }], taxableGross: '20000' },
    encashment: [{ label: 'Home leave encashment (10 days)', amount: '10000' }, { label: 'Sick leave encashment (0 days)', amount: '0' }],
    gratuity: { amount: '59976', withholdingPct: 5 },
    funds: [{ label: 'Welfare fund', employee: '6000', employer: '6000' }],
    loans: [{ label: 'Staff loan', remaining: '15000' }],
    noticeRecovery: '5000',
  });

  it('pays the month, the encashment, the gratuity and the fund; deducts the contributions, the gratuity tax, the loans and the notice', () => {
    assert.deepEqual(figures.earnings.map((l) => [l.code, l.amount]), [['MONTH', '20000'], ['ENCASHMENT', '10000'], ['GRATUITY', '59976'], ['FUND_PAYOUT', '12000']]);
    assert.deepEqual(figures.deductions.map((l) => [l.code, l.amount]), [['MONTH', '3300'], ['GRATUITY_TDS', '2998.8'], ['LOAN_CLOSEOUT', '15000'], ['NOTICE_RECOVERY', '5000']]);
    assert.equal(figures.grossEarnings, '101976');
    assert.equal(figures.totalDeductions, '26298.8');
  });

  it('taxes the month, the encashment and the employer\'s fund share once; not the gratuity, not the employee\'s own fund money', () => {
    assert.equal(figures.taxableGross, '36000'); // 20000 + 10000 + 6000
    assert.equal(figures.oneOffTaxable, '16000'); // 10000 + 6000
    assert.equal(figures.gratuityWithheld, '2998.8');
  });

  it('a settlement whose deductions exceed the pay is refused by name', () => {
    assert.equal(settlementShortfall(figures, '1000'), null);
    assert.match(settlementShortfall({ grossEarnings: '1000', totalDeductions: '5000' }, '0')!, /more than the pay/);
  });

  it('a month already paid in a locked run adds no month line', () => {
    const f = settlementFigures({ month: null, encashment: [], gratuity: { amount: '0', withholdingPct: 5 }, funds: [], loans: [], noticeRecovery: '0' });
    assert.deepEqual(f.earnings, []);
    assert.equal(f.grossEarnings, '0');
  });
});

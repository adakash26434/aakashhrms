import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EDITABLE,
  diffValues,
  floorOn,
  lawfulPreset,
  policyErrors,
  raiseToFloor,
  splitChange,
  topUpDays,
  valuesOf,
  dayAfter,
  endingSoon,
  exceptionErrors,
  exceptionSettings,
  exceptionState,
  overlapping,
  type ExceptionInput,
} from '../lib/engines/leave-policy.engine';
import type { PolicyException, PolicyValues } from '../lib/types/leave-policy';
import type { LeaveRuleType } from '../lib/types/leave';

// 4.6c: statutory leave changes only in the employees' favour (Labour Act 2074
// is the minimum; an exception in force lowers one setting of one type).

const sick: PolicyValues = { days: 12, paidDays: null, cap: 45, accrualEveryDays: null, certificateAfter: 3, expiryDays: null, allowHalfDay: true, dayBasis: 'working' };
const home: PolicyValues = { days: 18, paidDays: null, cap: 90, accrualEveryDays: 20, certificateAfter: null, expiryDays: null, allowHalfDay: true, dayBasis: 'working' };
const maternity: PolicyValues = { days: 98, paidDays: 60, cap: null, accrualEveryDays: null, certificateAfter: null, expiryDays: null, allowHalfDay: false, dayBasis: 'calendar' };
const law = (code: string) => floorOn(code, '2026-10-06', []);
const exception = (over: Partial<PolicyException> = {}): PolicyException => ({
  id: 'x1', statutoryCode: 'HOME', setting: 'cap', value: 0, legalBasis: 'NRB directive 3/2083', reference: 'Ref 12', validFrom: '2026-07-17', validUntil: '2027-07-16', revokedAt: null, ...over,
});

describe('The Labour Act minimum', () => {
  it('a raise is allowed, a cut is refused with the law named', () => {
    assert.deepEqual(policyErrors('SICK', sick, { days: 15, cap: 60 }, law('SICK')), {});
    const e = policyErrors('SICK', sick, { days: 10, cap: 30 }, law('SICK'));
    assert.match(e.days, /At least 12 days \(Labour Act §44\)/);
    assert.match(e.cap, /At least 45 days \(Labour Act §49\)/);
  });
  it('home leave: 1 day for every N paid days, so a larger N is less leave', () => {
    assert.deepEqual(policyErrors('HOME', home, { accrualEveryDays: 18 }, law('HOME')), {});
    assert.match(policyErrors('HOME', home, { accrualEveryDays: 25 }, law('HOME')).accrualEveryDays, /1 day for every 20 paid days/);
  });
  it('a certificate may be asked for later or never, not sooner', () => {
    assert.deepEqual(policyErrors('SICK', sick, { certificateAfter: 5 }, law('SICK')), {});
    assert.deepEqual(policyErrors('SICK', sick, { certificateAfter: null }, law('SICK')), {});
    assert.match(policyErrors('SICK', sick, { certificateAfter: 2 }, law('SICK')).certificateAfter, /Not before 3 days in a row/);
  });
  it('maternity: paid days at least 60 and never more than the days', () => {
    assert.deepEqual(policyErrors('MATERNITY', maternity, { days: 120, paidDays: 98 }, law('MATERNITY')), {});
    assert.ok(policyErrors('MATERNITY', maternity, { paidDays: 45 }, law('MATERNITY')).paidDays);
    assert.match(policyErrors('MATERNITY', maternity, { paidDays: 100 }, law('MATERNITY')).paidDays, /Not more than the 98 days/);
  });
  it('substitute leave within 21 days at least', () => {
    const sub: PolicyValues = { ...sick, days: 0, cap: null, certificateAfter: null, expiryDays: 21 };
    assert.deepEqual(policyErrors('SUBSTITUTE', sub, { expiryDays: 30 }, law('SUBSTITUTE')), {});
    assert.ok(policyErrors('SUBSTITUTE', sub, { expiryDays: 14 }, law('SUBSTITUTE')).expiryDays);
  });
  it('only the settings a type has can change; locked ones are refused', () => {
    assert.ok(policyErrors('HOME', home, { days: 30 }, law('HOME')).days);
    assert.ok(policyErrors('SICK', sick, { gender: 'Female' } as unknown as Partial<PolicyValues>, law('SICK')).gender);
    assert.ok(policyErrors('SICK', sick, {}, law('SICK')).form);
    assert.ok(policyErrors('SICK', sick, { days: 12.3 }, law('SICK')).days);
    assert.deepEqual(EDITABLE.SICK, ['days', 'cap', 'certificateAfter', 'allowHalfDay']);
  });
});

describe('Exceptions', () => {
  it('an exception in force lowers only its own setting of its own type', () => {
    const f = floorOn('HOME', '2026-10-06', [exception()]);
    assert.equal(f.floor.cap, 0);
    assert.equal(f.floor.accrualEveryDays, 20);
    assert.match(f.source.cap ?? '', /Exception: NRB directive 3\/2083/);
    assert.deepEqual(policyErrors('HOME', home, { cap: 0 }, f), {});
    assert.equal(floorOn('SICK', '2026-10-06', [exception()]).floor.cap, 45);
  });
  it('outside its dates or once withdrawn it does nothing', () => {
    assert.equal(floorOn('HOME', '2027-07-17', [exception()]).floor.cap, 90);
    assert.equal(floorOn('HOME', '2026-07-01', [exception()]).floor.cap, 90);
    assert.equal(floorOn('HOME', '2026-10-06', [exception({ revokedAt: '2026-10-01T00:00:00Z' })]).floor.cap, 90);
  });
  it('when it ends, settings below the law are raised back to it', () => {
    assert.deepEqual(raiseToFloor('HOME', { ...home, cap: 0 }, law('HOME').floor), { cap: 90 });
    assert.deepEqual(raiseToFloor('HOME', { ...home, accrualEveryDays: 30 }, law('HOME').floor), { accrualEveryDays: 20 });
    assert.deepEqual(raiseToFloor('SICK', { ...sick, certificateAfter: 1 }, law('SICK').floor), { certificateAfter: 3 });
    assert.deepEqual(raiseToFloor('SICK', sick, law('SICK').floor), {});
    assert.deepEqual(raiseToFloor('SICK', { ...sick, days: 15, certificateAfter: null }, law('SICK').floor), {});
  });
});

describe('When a change applies', () => {
  it('days a year of sick leave wait for the next leave year unless topped up now', () => {
    assert.deepEqual(splitChange({ days: 15, cap: 60 }, 'next_year', true), { now: { cap: 60 }, later: { days: 15 } });
    assert.deepEqual(splitChange({ days: 15 }, 'top_up', true), { now: { days: 15 }, later: {} });
    assert.deepEqual(splitChange({ days: 120 }, 'approval', false), { now: { days: 120 }, later: {} });
    assert.equal(dayAfter('2027-07-16'), '2027-07-17');
  });
  it('top-up: the difference, pro-rata from joining like the yearly credit; never for a cut', () => {
    const year = { start: '2026-07-17', end: '2027-07-16' };
    assert.equal(topUpDays(12, 15, '2020-01-01', year), 3);
    assert.equal(topUpDays(12, 15, '2027-01-16', year), 1.5);
    assert.equal(topUpDays(12, 12, '2020-01-01', year), 0);
    assert.equal(topUpDays(15, 12, '2020-01-01', year), 0);
  });
  it('only what differs from today is a change', () => {
    assert.deepEqual(diffValues(sick, { days: 12, cap: 60, allowHalfDay: true }), { cap: 60 });
  });
});

describe('Values and platform presets', () => {
  it('reads a type as people do (no document rule = no certificate; no cap = the law)', () => {
    const t = { days: 12, paidDaysPerEvent: null, accumulationCap: null, statutoryCode: 'SICK', accrualEveryDays: null, requiresDocument: true, documentThresholdDays: 3, expiryDays: null, allowHalfDay: true, dayBasis: 'working' } as unknown as LeaveRuleType;
    assert.equal(valuesOf(t).cap, 45);
    assert.equal(valuesOf(t).certificateAfter, 3);
    assert.equal(valuesOf({ ...t, requiresDocument: false }).certificateAfter, null);
  });
  it('the platform never creates a statutory type below the law, and a blank cap is the law cap, not 0', () => {
    assert.deepEqual(lawfulPreset('SICK', { days: 10, cap: 0 }), { days: 12, cap: 45, paidDays: null });
    assert.deepEqual(lawfulPreset('HOME', { days: 18, cap: null }), { days: 18, cap: 90, paidDays: null });
    assert.deepEqual(lawfulPreset('MATERNITY', { days: 98, cap: null, paidDays: 45 }), { days: 98, cap: null, paidDays: 60 });
    assert.deepEqual(lawfulPreset(null, { days: 5, cap: 0 }), { days: 5, cap: null, paidDays: null });
  });
});

describe('Exceptions: what can be asked for and granted (4.6d)', () => {
  const ask = (over: Partial<ExceptionInput> = {}): ExceptionInput => ({
    statutoryCode: 'HOME', setting: 'cap', value: 0, legalBasis: 'NRB directive 3/2083', reference: 'Ref 12', validFrom: '2026-10-06', validUntil: '2027-07-16', ...over,
  });
  it('only lowers a setting the Labour Act sets a minimum for, and only below it', () => {
    assert.deepEqual(exceptionErrors(ask(), '2026-10-06'), {});
    assert.deepEqual(exceptionSettings('HOME'), ['accrualEveryDays', 'cap']);
    assert.deepEqual(exceptionSettings('SICK'), ['days', 'cap', 'certificateAfter']);
    assert.ok(exceptionErrors(ask({ setting: 'allowHalfDay' }), '2026-10-06').setting);
    assert.match(exceptionErrors(ask({ value: 120 }), '2026-10-06').value, /no exception is needed/);
    assert.deepEqual(exceptionErrors(ask({ setting: 'accrualEveryDays', value: 30 }), '2026-10-06'), {});
    assert.ok(exceptionErrors(ask({ setting: 'accrualEveryDays', value: 18 }), '2026-10-06').value);
    assert.ok(exceptionErrors(ask({ statutoryCode: 'PUBLIC' }), '2026-10-06').statutoryCode);
  });
  it('names the directive and runs between two dates of at most five years that have not passed', () => {
    assert.ok(exceptionErrors(ask({ legalBasis: 'NRB' }), '2026-10-06').legalBasis);
    assert.ok(exceptionErrors(ask({ validUntil: '' }), '2026-10-06').validUntil);
    assert.ok(exceptionErrors(ask({ validUntil: '2026-01-01' }), '2026-10-06').validUntil);
    assert.ok(exceptionErrors(ask({ validFrom: '2026-01-01', validUntil: '2026-06-01' }), '2026-10-06').validUntil);
    assert.ok(exceptionErrors(ask({ validUntil: '2032-01-01' }), '2026-10-06').validUntil);
  });
  it('two exceptions for the same setting may not overlap; revoked ones never count', () => {
    const a = { statutoryCode: 'HOME', setting: 'cap', validFrom: '2026-07-17', validUntil: '2027-07-16', revokedAt: null };
    assert.equal(overlapping(a, { ...a, validFrom: '2027-07-16', validUntil: '2028-07-16' }), true);
    assert.equal(overlapping(a, { ...a, validFrom: '2027-07-17', validUntil: '2028-07-16' }), false);
    assert.equal(overlapping(a, { ...a, setting: 'accrualEveryDays' }), false);
    assert.equal(overlapping(a, { ...a, revokedAt: '2026-10-01T00:00:00Z' }), false);
  });
  it('warns 30 days before the end; states read as people do', () => {
    assert.equal(endingSoon([exception({ validUntil: '2026-11-01' })], '2026-10-06').length, 1);
    assert.equal(endingSoon([exception({ validUntil: '2026-12-01' })], '2026-10-06').length, 0);
    assert.equal(endingSoon([exception({ validUntil: '2026-11-01', revokedAt: '2026-10-01T00:00:00Z' })], '2026-10-06').length, 0);
    assert.equal(exceptionState(exception(), '2026-10-06'), 'active');
    assert.equal(exceptionState(exception({ validFrom: '2026-12-01' }), '2026-10-06'), 'scheduled');
    assert.equal(exceptionState(exception(), '2027-07-17'), 'ended');
    assert.equal(exceptionState(exception({ revokedAt: '2026-10-01T00:00:00Z' }), '2026-10-06'), 'revoked');
  });
});

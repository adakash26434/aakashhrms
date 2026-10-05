import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, periodFor, weekdayOf } from '../lib/engines/pay-period.engine';
import { dayPlan, parseShift, plannedWeekMinutes, rotate, seasonOn, shiftForDay, shiftSummary, shiftWarnings, type ShiftInput } from '../lib/engines/shift.engine';
import type { ShiftDefinition } from '../lib/types/attendance';

// Shifts (4.5b): each company defines its own. A week (off days, own hours
// per weekday), seasons by BS date every year, fixed or flexible hours,
// which shift applies on a day, rotations, and Labour Act reminders.

const week = (offs: number[], own: Record<number, [string, string]> = {}) =>
  Array.from({ length: 7 }, (_, i) => (offs.includes(i) ? { working: false, start: null, end: null } : { working: true, start: own[i]?.[0] ?? null, end: own[i]?.[1] ?? null }));

const shift = (over: Partial<ShiftDefinition> = {}): ShiftDefinition => ({
  id: 'gen',
  code: 'GEN',
  name: 'General',
  color: 'green',
  kind: 'fixed',
  start: '09:00',
  end: '17:00',
  breakMinutes: 30,
  graceMinutes: 15,
  fullDayMinutes: 420,
  halfDayMinutes: 210,
  otMinimumMinutes: 30,
  week: week([0, 6]),
  seasons: [],
  isDefault: true,
  active: true,
  ...over,
});

// A Monday, Friday and Saturday in Aswin 2083 (AD dates).
const MON = '2026-10-05';
const FRI = '2026-10-09';
const SAT = '2026-10-10';
const kartik = periodFor('BS', 2083, 7);
const magh = periodFor('BS', 2083, 10);
const WINTER = { name: 'Winter', fromMonth: 7, fromDay: 16, toMonth: 10, toDay: 15, start: '09:00', end: '16:00' };

describe('A day of a shift: week and seasons', () => {
  it('weekly offs come from the shift\'s week', () => {
    assert.equal(weekdayOf(MON), 1);
    assert.equal(dayPlan(shift(), MON).off, false);
    assert.equal(dayPlan(shift(), SAT).off, true);
    assert.equal(dayPlan(shift({ week: week([6]) }), '2026-10-04').off, false);
  });
  it('a short day (own hours) needs its own planned hours for a full day and half of them for a half day', () => {
    const s = shift({ week: week([0], { 5: ['10:00', '15:00'], 6: ['10:00', '13:00'] }) });
    const fri = dayPlan(s, FRI);
    assert.deepEqual([fri.start, fri.end, fri.fullDayMinutes, fri.halfDayMinutes], ['10:00', '15:00', 300, 150]); // 5 hours: no break (it comes off only after 5 hours)
    const sat = dayPlan(s, SAT);
    // Saturday morning: 3 hours, no break (5 hours or less).
    assert.deepEqual([sat.off, sat.fullDayMinutes, sat.halfDayMinutes], [false, 180, 90]);
    // A normal day keeps the shift's own full / half day.
    assert.deepEqual([dayPlan(s, MON).fullDayMinutes, dayPlan(s, MON).halfDayMinutes], [420, 210]);
  });
  it('winter (Kartik 16 – Magh 15) has its own hours every year, across the AD year end', () => {
    const s = shift({ seasons: [WINTER] });
    const k15 = addDays(kartik.start, 14);
    const k16 = addDays(kartik.start, 15);
    const m15 = addDays(magh.start, 14);
    const m16 = addDays(magh.start, 15);
    assert.equal(seasonOn(s.seasons, k15), null);
    assert.equal(seasonOn(s.seasons, k16)?.name, 'Winter');
    assert.equal(seasonOn(s.seasons, m15)?.name, 'Winter');
    assert.equal(seasonOn(s.seasons, m16), null);
    // Poush crosses 1 January.
    assert.equal(seasonOn(s.seasons, '2027-01-01')?.name, 'Winter');
    const d = dayPlan(s, k16);
    assert.deepEqual([d.start, d.end, d.season, d.fullDayMinutes], ['09:00', '16:00', 'Winter', 390]);
  });
  it('a season that wraps past Chaitra into Baisakh', () => {
    const s = [{ ...WINTER, name: 'Spring', fromMonth: 12, fromDay: 1, toMonth: 1, toDay: 10 }];
    assert.equal(seasonOn(s, periodFor('BS', 2083, 12).start)?.name, 'Spring');
    assert.equal(seasonOn(s, addDays(periodFor('BS', 2084, 1).start, 9))?.name, 'Spring');
    assert.equal(seasonOn(s, addDays(periodFor('BS', 2084, 1).start, 10)), null);
  });
  it('own weekday hours win over the season', () => {
    const s = shift({ seasons: [WINTER], week: week([0, 6], { 5: ['10:00', '15:00'] }) });
    const winterFriday = [...Array(40).keys()].map((i) => addDays(addDays(kartik.start, 15), i)).find((d) => weekdayOf(d) === 5)!;
    assert.deepEqual([dayPlan(s, winterFriday).start, dayPlan(s, winterFriday).season], ['10:00', null]);
  });
  it('flexible: the hours are a window; the full and half day stay as set', () => {
    const d = dayPlan(shift({ kind: 'flexible', start: '07:00', end: '21:00', fullDayMinutes: 480, halfDayMinutes: 240 }), MON);
    assert.deepEqual([d.flexible, d.fullDayMinutes, d.halfDayMinutes], [true, 480, 240]);
  });
});

describe('Which shift applies on a day', () => {
  const gen = shift();
  const mor = shift({ id: 'mor', code: 'MOR', isDefault: false, start: '06:00', end: '14:00' });
  const nig = shift({ id: 'nig', code: 'NIG', isDefault: false, start: '22:00', end: '06:00', week: week([0]) });
  const all = new Map([gen, mor, nig].map((s) => [s.id, s]));
  const base = { assignments: [] as { shiftId: string; from: string; to: string | null }[], branchDefaultId: null as string | null, companyDefaultId: 'gen' };
  it('roster day → assignment → branch default → company default', () => {
    assert.equal(shiftForDay(MON, base, all).source, 'company');
    assert.equal(shiftForDay(MON, { ...base, branchDefaultId: 'nig' }, all).plan.code, 'NIG');
    const assigned = { ...base, branchDefaultId: 'nig', assignments: [{ shiftId: 'mor', from: '2026-10-01', to: null }] };
    assert.deepEqual([shiftForDay(MON, assigned, all).plan.code, shiftForDay(MON, assigned, all).source], ['MOR', 'assignment']);
    assert.equal(shiftForDay('2026-09-30', assigned, all).plan.code, 'NIG');
    const rostered = { ...assigned, roster: { shiftId: 'gen', off: false } };
    assert.deepEqual([shiftForDay(MON, rostered, all).plan.code, shiftForDay(MON, rostered, all).source], ['GEN', 'roster']);
  });
  it('a rostered shift is worked even on its usual day off; a rostered OFF is a day off', () => {
    assert.equal(shiftForDay(SAT, { ...base, roster: { shiftId: 'gen', off: false } }, all).plan.off, false);
    const off = shiftForDay(MON, { ...base, roster: { shiftId: null, off: true } }, all);
    assert.deepEqual([off.plan.off, off.plan.code, off.source], [true, 'GEN', 'roster']);
  });
  it('an assignment that ended no longer applies; an unknown shift falls back', () => {
    assert.equal(shiftForDay(MON, { ...base, assignments: [{ shiftId: 'mor', from: '2026-09-01', to: '2026-10-04' }] }, all).plan.code, 'GEN');
    assert.equal(shiftForDay(MON, { ...base, assignments: [{ shiftId: 'gone', from: '2026-09-01', to: null }] }, all).plan.code, 'GEN');
  });
});

describe('Rotations', () => {
  it('each step for N days, in order, then round again; a different start step', () => {
    const days = rotate({ shiftIds: ['A', 'B', 'OFF'], everyDays: 2, from: '2026-10-01', to: '2026-10-07' });
    assert.deepEqual(days.map((d) => (d.off ? 'OFF' : d.shiftId)), ['A', 'A', 'B', 'B', 'OFF', 'OFF', 'A']);
    const team2 = rotate({ shiftIds: ['A', 'B'], everyDays: 7, from: '2026-10-01', to: '2026-10-15', startAt: 1 });
    assert.deepEqual([team2[0].shiftId, team2[6].shiftId, team2[7].shiftId, team2[14].shiftId], ['B', 'B', 'A', 'B']);
  });
  it('at most 92 days at a time; nothing for bad input', () => {
    assert.equal(rotate({ shiftIds: ['A', 'B'], everyDays: 1, from: '2026-01-01', to: '2026-12-31' }).length, 92);
    assert.equal(rotate({ shiftIds: ['A'], everyDays: 0, from: '2026-01-01', to: '2026-01-05' }).length, 0);
  });
});

describe('Checking a shift (form) and Labour Act reminders', () => {
  const form = (over: Partial<ShiftInput> = {}) => ({ ...shift(), ...over });
  it('valid input is read; codes are upper case', () => {
    const { value, errors } = parseShift({ ...form(), code: 'mor' });
    assert.deepEqual(errors, {});
    assert.equal(value?.code, 'MOR');
  });
  it('field errors: code, OFF, times, half over full, own hours half-given, no working day, overlapping seasons', () => {
    const e = parseShift({ ...form(), code: 'OFF', start: '25:00', halfDayMinutes: 500, week: week([], { 2: ['10:00', ''] }) }).errors;
    assert.ok(e.code && e.start && e.halfDayMinutes && e['week.2']);
    assert.ok(parseShift({ ...form(), week: week([0, 1, 2, 3, 4, 5, 6]) }).errors.week);
    const spring = { ...WINTER, name: 'Late winter', fromMonth: 10, fromDay: 1, toMonth: 11, toDay: 5 };
    assert.match(parseShift({ ...form(), seasons: [WINTER, spring] }).errors['seasons.1'], /Overlaps Winter/);
  });
  it('planned hours a week, and reminders: over 8 h a day, over 48 a week, no weekly off, no break, outside daylight', () => {
    assert.equal(plannedWeekMinutes(form()), 5 * 450);
    assert.deepEqual(shiftWarnings(form()), []);
    const long = shiftWarnings(form({ start: '08:00', end: '19:00', week: week([]), breakMinutes: 0 }));
    assert.ok(long.some((w) => w.includes('8 working hours')));
    assert.ok(long.some((w) => w.includes('a week')));
    assert.ok(long.some((w) => w.includes('No weekly off')));
    assert.ok(long.some((w) => w.includes('break')));
    assert.ok(shiftWarnings(form({ start: '22:00', end: '06:00' })).some((w) => w.includes('transport')));
  });
  it('a plain summary', () => {
    assert.equal(shiftSummary(form({ seasons: [WINTER], week: week([0, 6], { 5: ['10:00', '15:00'] }) })), '09:00–17:00 · Sun, Sat off · Fri 10:00–15:00 · Winter 09:00–16:00 (16 Kartik – 15 Magh)');
  });
});

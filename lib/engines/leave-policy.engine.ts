// Leave policies (4.6c). A company may change a statutory leave type only in
// the employees' favour: the Labour Act 2074 is the minimum, and an active
// platform exception (e.g. a regulator's directive) can lower one setting of
// one type within its dates. This engine says which settings a type has, the
// minimum on a date, what a proposal would change and when, what refuses it,
// and the top-up for "also this year". Pure: no database access.

import { STATUTORY_FLOOR, creditedYearly, fmt, proRata } from "@/lib/engines/leave.engine";
import type { LeaveRuleType } from "@/lib/types/leave";
import { POLICY_SETTINGS, type PolicyApplies, type PolicyException, type PolicyFloor, type PolicySetting, type PolicyValues } from "@/lib/types/leave-policy";

/** The settings a company may change per statutory type (everything else is locked by the platform). */
export const EDITABLE: Record<string, PolicySetting[]> = {
  SICK: ["days", "cap", "certificateAfter", "allowHalfDay"],
  HOME: ["accrualEveryDays", "cap", "allowHalfDay"],
  MATERNITY: ["days", "paidDays", "dayBasis"],
  PATERNITY: ["days", "dayBasis"],
  MOURNING: ["days", "dayBasis"],
  SUBSTITUTE: ["expiryDays", "allowHalfDay"],
};

/** The section of the Labour Act 2074 each type comes from. */
export const LAW: Record<string, string> = {
  HOME: "Labour Act §43",
  SICK: "Labour Act §44",
  MATERNITY: "Labour Act §45",
  PATERNITY: "Labour Act §45(7)",
  MOURNING: "Labour Act §48",
  SUBSTITUTE: "Labour Act §42",
};

const SECTION: Partial<Record<PolicySetting, string>> = { cap: "Labour Act §49", paidDays: "Labour Act §45" };

export const SETTING_LABEL: Record<PolicySetting, string> = {
  days: "Days",
  paidDays: "Paid days",
  cap: "Can be saved up to",
  accrualEveryDays: "Earned",
  certificateAfter: "Certificate",
  expiryDays: "Must be taken within",
  allowHalfDay: "Half days",
  dayBasis: "Days counted",
};

const FLOORED = ["days", "paidDays", "cap", "accrualEveryDays", "certificateAfter", "expiryDays"] as const;
type Floored = (typeof FLOORED)[number];
/** Home leave rate: 1 day per N paid days, so a larger N gives less leave. */
const higherIsWorse = (s: Floored) => s === "accrualEveryDays";

/** A type's current settings, as people read them. */
export function valuesOf(t: LeaveRuleType): PolicyValues {
  const cap = t.accumulationCap ?? (t.statutoryCode ? STATUTORY_FLOOR[t.statutoryCode]?.cap ?? null : null);
  return {
    days: t.days,
    paidDays: t.paidDaysPerEvent,
    cap,
    accrualEveryDays: t.accrualEveryDays,
    certificateAfter: t.requiresDocument && t.documentThresholdDays !== null ? t.documentThresholdDays : null,
    expiryDays: t.expiryDays,
    allowHalfDay: t.allowHalfDay,
    dayBasis: t.dayBasis,
  };
}

/** True when an exception is in force on a date (granted, not revoked, within its dates). */
export const exceptionActive = (e: PolicyException, date: string) => !e.revokedAt && e.validFrom <= date && (!e.validUntil || e.validUntil >= date);

/**
 * The minimum for a statutory type on a date: the Labour Act's, with any
 * exception in force for that type replacing its setting's minimum. `source`
 * says where each minimum comes from, for the screen and the refusal text.
 */
export function floorOn(statutoryCode: string, date: string, exceptions: readonly PolicyException[]): { floor: PolicyFloor; source: Partial<Record<Floored, string>> } {
  const law = STATUTORY_FLOOR[statutoryCode] ?? {};
  const floor: PolicyFloor = {};
  const source: Partial<Record<Floored, string>> = {};
  for (const s of FLOORED) {
    const v = law[s];
    if (v !== undefined) {
      floor[s] = v;
      source[s] = SECTION[s] ?? LAW[statutoryCode] ?? "Labour Act";
    }
  }
  for (const e of exceptions) {
    if (e.statutoryCode !== statutoryCode || !exceptionActive(e, date) || !(FLOORED as readonly string[]).includes(e.setting)) continue;
    const s = e.setting as Floored;
    // An exception may lower a minimum (or, for the home rate, allow a larger N); "never" for a certificate is null.
    if (e.value === null) delete floor[s];
    else floor[s] = e.value;
    source[s] = `Exception: ${e.legalBasis}${e.validUntil ? ` (until ${e.validUntil})` : ""}`;
  }
  return { floor, source };
}

/** Words for a setting's value ("15 days", "1 day for every 18 paid days", "never"). */
export function valueText(setting: PolicySetting, v: PolicyValues[PolicySetting] | undefined): string {
  if (v === undefined) return "—";
  switch (setting) {
    case "accrualEveryDays":
      return v === null ? "—" : `1 day for every ${fmt(Number(v))} paid days`;
    case "certificateAfter":
      return v === null ? "never asked for" : `after ${fmt(Number(v))} day${v === 1 ? "" : "s"} in a row`;
    case "expiryDays":
      return v === null ? "—" : `${fmt(Number(v))} days`;
    case "allowHalfDay":
      return v ? "allowed" : "not allowed";
    case "dayBasis":
      return v === "calendar" ? "every calendar day" : "working days only";
    default:
      return v === null ? "—" : `${fmt(Number(v))} day${v === 1 ? "" : "s"}`;
  }
}

/** The minimum in words ("at least 12 days", "1 day for every 20 paid days or more"). */
export function floorText(setting: PolicySetting, floor: PolicyFloor): string | null {
  if (!(FLOORED as readonly string[]).includes(setting)) return null;
  const f = floor[setting as Floored];
  if (f === undefined) return null;
  if (setting === "accrualEveryDays") return `at least 1 day for every ${fmt(f)} paid days`;
  if (setting === "certificateAfter") return `not before ${fmt(f)} days in a row`;
  return `at least ${fmt(f)} days`;
}

/** Only the settings that differ from the current values. */
export function diffValues(current: PolicyValues, proposed: Partial<PolicyValues>): Partial<PolicyValues> {
  const out: Partial<PolicyValues> = {};
  for (const s of POLICY_SETTINGS) {
    if (!(s in proposed)) continue;
    const v = proposed[s];
    if (v !== current[s]) (out as Record<string, unknown>)[s] = v;
  }
  return out;
}

const isWhole = (n: number) => Number.isInteger(n);
const isHalfStep = (n: number) => Number.isInteger(n * 2);

/**
 * What stops a proposal (setting → message; "form" for the whole). Checks
 * that only the type's editable settings change, each value is sensible, and
 * nothing goes below the minimum on the date it takes effect.
 */
export function policyErrors(
  statutoryCode: string,
  current: PolicyValues,
  change: Partial<PolicyValues>,
  floorInfo: { floor: PolicyFloor; source: Partial<Record<string, string>> }
): Record<string, string> {
  const errors: Record<string, string> = {};
  const editable = EDITABLE[statutoryCode] ?? [];
  const keys = Object.keys(change) as PolicySetting[];
  if (!keys.length) errors.form = "Nothing changes: change at least one setting.";
  for (const k of keys) {
    if (!(POLICY_SETTINGS as readonly string[]).includes(k) || !editable.includes(k)) {
      errors[k] = "This setting is set by the Labour Act and the platform; it can't be changed here.";
      continue;
    }
    const v = change[k];
    if (k === "allowHalfDay") {
      if (typeof v !== "boolean") errors[k] = "Choose Yes or No";
      continue;
    }
    if (k === "dayBasis") {
      if (v !== "working" && v !== "calendar") errors[k] = "Choose how days are counted";
      continue;
    }
    if (k === "certificateAfter" && v === null) continue; // never asked for: more generous than the law
    if (typeof v !== "number" || !Number.isFinite(v)) {
      errors[k] = "Enter a number";
      continue;
    }
    if (v < 0 || v > 365) errors[k] = "Between 0 and 365";
    else if ((k === "accrualEveryDays" || k === "certificateAfter" || k === "expiryDays") && (!isWhole(v) || v < 1)) errors[k] = "A whole number of days, at least 1";
    else if (!isHalfStep(v)) errors[k] = "Whole or half days";
    if (errors[k]) continue;
    const f = floorInfo.floor[k as Floored];
    if (f === undefined) continue;
    const worse = higherIsWorse(k as Floored) ? v > f : v < f;
    if (worse) errors[k] = `${floorText(k, floorInfo.floor)?.replace(/^./, (c) => c.toUpperCase())} (${floorInfo.source[k] ?? "Labour Act"})`;
  }
  const days = change.days ?? current.days;
  const paid = change.paidDays !== undefined ? change.paidDays : current.paidDays;
  if (!errors.paidDays && !errors.days && paid !== null && paid !== undefined && paid > days) errors.paidDays = `Not more than the ${fmt(days)} days`;
  return errors;
}

/**
 * When each part takes effect. Days a year of a type credited at the year
 * opening (sick) wait for the next leave year unless topped up now; every
 * other setting applies on approval (caps are read when a year is opened).
 */
export function splitChange(change: Partial<PolicyValues>, applies: PolicyApplies, yearlyCredit: boolean): { now: Partial<PolicyValues>; later: Partial<PolicyValues> } {
  const now: Partial<PolicyValues> = { ...change };
  const later: Partial<PolicyValues> = {};
  if (yearlyCredit && applies === "next_year" && change.days !== undefined) {
    later.days = change.days;
    delete now.days;
  }
  return { now, later };
}

/** Whether a proposal changes days a year of a type credited yearly (the window then asks when). */
export const asksWhen = (t: Pick<LeaveRuleType, "kind" | "statutoryCode" | "days">, change: Partial<PolicyValues>) => creditedYearly(t) && change.days !== undefined;

/** The first day of the next leave year: the day after the current one ends. */
export function dayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * "Also this year": the extra days for one person, pro-rata from joining like
 * their yearly credit. Only a raise tops up; nobody employed after the year
 * gets any.
 */
export function topUpDays(oldDays: number, newDays: number, joiningDate: string | null, year: { start: string; end: string }): number {
  if (newDays <= oldDays) return 0;
  return proRata(newDays - oldDays, joiningDate ?? year.start, year);
}

/**
 * Settings below the minimum (e.g. an exception ended, or a value written
 * before the minimum was checked): the change that raises them back to it.
 */
export function raiseToFloor(statutoryCode: string, current: PolicyValues, floor: PolicyFloor): Partial<PolicyValues> {
  const out: Partial<PolicyValues> = {};
  for (const s of EDITABLE[statutoryCode] ?? []) {
    if (!(FLOORED as readonly string[]).includes(s)) continue;
    const f = floor[s as Floored];
    if (f === undefined) continue;
    const v = current[s] as number | null;
    if (s === "certificateAfter") {
      if (v !== null && v < f) out.certificateAfter = f;
      continue;
    }
    if (v === null) {
      if (s === "cap" || s === "accrualEveryDays" || s === "expiryDays" || s === "paidDays") (out as Record<string, number>)[s] = f;
      continue;
    }
    if (higherIsWorse(s as Floored) ? v > f : v < f) (out as Record<string, number>)[s] = f;
  }
  return out;
}

/** One line per changed setting: "Days: 12 days → 15 days". */
export function changeLines(before: Partial<PolicyValues>, after: Partial<PolicyValues>): string[] {
  return (Object.keys(after) as PolicySetting[]).map((s) => `${SETTING_LABEL[s]}: ${valueText(s, before[s])} → ${valueText(s, after[s])}`);
}

/**
 * Numbers for a statutory type the platform creates (policy pack, a new
 * company, the console): never below the Labour Act, and a blank or 0 cap
 * means the law's cap (a cap of 0 would lapse every saved day).
 */
export function lawfulPreset(statutoryCode: string | null, preset: { days: number; cap: number | null; paidDays?: number | null }): { days: number; cap: number | null; paidDays: number | null } {
  const law = statutoryCode ? STATUTORY_FLOOR[statutoryCode] ?? {} : {};
  const days = law.days !== undefined ? Math.max(preset.days || 0, law.days) : preset.days || 0;
  const cap = law.cap !== undefined ? Math.max(preset.cap || 0, law.cap) : preset.cap && preset.cap > 0 ? preset.cap : null;
  const paidDays = law.paidDays !== undefined ? Math.max(preset.paidDays || 0, law.paidDays) : preset.paidDays ?? null;
  return { days, cap, paidDays };
}

import Decimal from 'decimal.js';

// Overtime pay (4.7): the one formula payroll uses. Hourly rate = basic ÷ 240;
// OT pay = hourly rate × hours × multiplier (one multiplier for a working day,
// one for an off day). The multipliers come from the company's active hourly
// OT rule when it has one (the OT rules screen), otherwise from System control
// (office-time settings); never below the Labour Act minimum of 1.5.

export const OT_HOURLY_DIVISOR = 240;
/** Labour Act 2074: overtime is paid at least one and a half times the hourly rate. */
export const OT_MIN_MULTIPLIER = 1.5;
export const DEFAULT_WORK_MULTIPLIER = 1.5;
export const DEFAULT_OFF_MULTIPLIER = 2;

export interface OtMultipliers {
  work: number;
  off: number;
}

export interface HourlyOtRuleLike {
  ruleType: string;
  isActive: boolean;
  /** Multiplier on a working day. */
  rateOfficeDay: number;
  /** Multiplier on an off day. */
  rateOffDay: number;
}

export type OtSource = 'rule' | 'settings' | 'default';

export interface ResolvedOt extends OtMultipliers {
  source: OtSource;
}

const clean = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : fallback);
const floorAtLaw = (n: number) => Math.max(OT_MIN_MULTIPLIER, n);

/**
 * Which multipliers apply. Active hourly rules win over System control; with
 * several, the most favourable to staff (highest) for each day type. Fixed-amount
 * rules are not used by payroll. The Labour Act floor always applies.
 */
export function resolveOtMultipliers(
  rules: readonly HourlyOtRuleLike[],
  settings: { work?: number | null; off?: number | null },
): ResolvedOt {
  const hourly = rules.filter((r) => r.isActive && r.ruleType === 'Hourly' && r.rateOfficeDay > 0 && r.rateOffDay > 0);
  if (hourly.length) {
    return {
      work: floorAtLaw(Math.max(...hourly.map((r) => r.rateOfficeDay))),
      off: floorAtLaw(Math.max(...hourly.map((r) => r.rateOffDay))),
      source: 'rule',
    };
  }
  const hasSettings = typeof settings.work === 'number' || typeof settings.off === 'number';
  return {
    work: floorAtLaw(clean(settings.work, DEFAULT_WORK_MULTIPLIER)),
    off: floorAtLaw(clean(settings.off, DEFAULT_OFF_MULTIPLIER)),
    source: hasSettings ? 'settings' : 'default',
  };
}

export interface OtPayInput {
  basic: number;
  workDayMinutes: number;
  offDayMinutes: number;
  multipliers: OtMultipliers;
}

/** OT pay for a month, two decimals. */
export function otPay(input: OtPayInput): number {
  if (!(input.basic > 0)) return 0;
  const hourly = new Decimal(input.basic).dividedBy(OT_HOURLY_DIVISOR);
  return hourly
    .times(Math.max(0, input.workDayMinutes) / 60)
    .times(floorAtLaw(input.multipliers.work))
    .plus(hourly.times(Math.max(0, input.offDayMinutes) / 60).times(floorAtLaw(input.multipliers.off)))
    .toDecimalPlaces(2)
    .toNumber();
}

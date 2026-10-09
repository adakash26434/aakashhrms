// Travel & daily allowance — TA-DA (G11, docs/redesign/06-hrms-gap-analysis.md):
// pure rules, no database access, unit-tested in tests/travel.engine.test.ts.
//
// A rate card gives the daily allowance, the lodging ceiling per night and
// the per-km rate (own vehicle). A claim covers one trip: days are inclusive
// of both ends; amounts are computed here in PAISA and never typed in by hand
// except actuals (fare, lodging) which are capped by the card. Status:
// draft → submitted → approved (or returned to draft / rejected); settled when
// paid. Nobody approves their own claim (S38).

export const TRAVEL_MODES = [
  { code: 'bus', name: 'Bus / public transport' },
  { code: 'own_vehicle', name: 'Own vehicle (per km)' },
  { code: 'office_vehicle', name: 'Office vehicle' },
  { code: 'air', name: 'Air' },
  { code: 'other', name: 'Other' },
] as const;

export const CLAIM_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'settled'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

const toPaisa = (npr: number | string): number => Math.round(Number(npr) * 100);
const toNpr = (paisa: number): string => (paisa / 100).toFixed(2);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (v === '' || v === undefined || v === null ? 0 : Number(v));

export function nextClaimStatuses(from: string): ClaimStatus[] {
  switch (from) {
    case 'draft':
      return ['submitted'];
    case 'submitted':
      return ['approved', 'rejected', 'draft'];
    case 'approved':
      return ['settled'];
    default:
      return [];
  }
}
export const canMoveClaim = (from: string, to: string): boolean => (nextClaimStatuses(from) as string[]).includes(to);
export const isEditable = (status: string): boolean => status === 'draft';

// ---------------------------------------------------------------------------
// Rate card
// ---------------------------------------------------------------------------

export interface RateForm {
  name: string;
  designationId: string; // '' = default card
  dailyAllowance: number;
  lodgingPerNight: number;
  kmRate: number;
  isActive: boolean;
}

export function normalizeRateForm(raw: unknown): RateForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    name: s(r.name, 100),
    designationId: s(r.designationId, 64),
    dailyAllowance: num(r.dailyAllowance),
    lodgingPerNight: num(r.lodgingPerNight),
    kmRate: num(r.kmRate),
    isActive: r.isActive !== false,
  };
}

export function validateRateForm(form: RateForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.name.length < 2) errors.name = 'Name the rate card.';
  for (const [key, value, max] of [
    ['dailyAllowance', form.dailyAllowance, 100000],
    ['lodgingPerNight', form.lodgingPerNight, 100000],
    ['kmRate', form.kmRate, 1000],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > max) errors[key] = `0–${max.toLocaleString('en-IN')}.`;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export interface ClaimForm {
  employeeId: string;
  purpose: string;
  fromPlace: string;
  toPlace: string;
  startAd: string;
  endAd: string;
  mode: string;
  km: number;
  fareActual: number; // bus / air / other, actual ticket cost
  lodgingActual: number; // total lodging actually paid
  nights: number;
  advance: number;
  note: string;
}

export function normalizeClaimForm(raw: unknown): ClaimForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    employeeId: s(r.employeeId, 64),
    purpose: s(r.purpose, 300),
    fromPlace: s(r.fromPlace, 120),
    toPlace: s(r.toPlace, 120),
    startAd: s(r.startAd, 10),
    endAd: s(r.endAd, 10),
    mode: TRAVEL_MODES.some((m) => m.code === r.mode) ? (r.mode as string) : '',
    km: num(r.km),
    fareActual: num(r.fareActual),
    lodgingActual: num(r.lodgingActual),
    nights: num(r.nights),
    advance: num(r.advance),
    note: s(r.note, 1000),
  };
}

/** ISO date `days` from `iso` (negative = earlier). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Inclusive calendar days between two ISO dates (same day = 1). */
export function tripDays(startAd: string, endAd: string): number {
  const a = Date.UTC(+startAd.slice(0, 4), +startAd.slice(5, 7) - 1, +startAd.slice(8, 10));
  const b = Date.UTC(+endAd.slice(0, 4), +endAd.slice(5, 7) - 1, +endAd.slice(8, 10));
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function validateClaimForm(form: ClaimForm, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.employeeId) errors.employeeId = 'Choose the employee.';
  if (form.purpose.length < 5) errors.purpose = 'Say the purpose of the trip (at least 5 characters).';
  if (!form.fromPlace) errors.fromPlace = 'From where?';
  if (!form.toPlace) errors.toPlace = 'To where?';
  if (!ISO.test(form.startAd)) errors.startAd = 'Choose the start date.';
  if (!ISO.test(form.endAd)) errors.endAd = 'Choose the end date.';
  if (ISO.test(form.startAd) && ISO.test(form.endAd)) {
    if (form.endAd < form.startAd) errors.endAd = 'The trip cannot end before it starts.';
    else if (tripDays(form.startAd, form.endAd) > 60) errors.endAd = 'A single claim covers at most 60 days.';
    if (form.endAd > today) errors.endAd = 'Claims are made after the trip.';
    if (form.startAd < addDaysIso(today, -365)) errors.startAd = 'A claim is made within a year of the trip.';
  }
  if (!form.mode) errors.mode = 'How did they travel?';
  if (form.mode === 'own_vehicle' && (!Number.isFinite(form.km) || form.km <= 0 || form.km > 5000)) errors.km = 'Distance in km (up to 5000).';
  if (form.mode !== 'own_vehicle' && form.km !== 0) errors.km = 'Kilometres apply to own vehicle only.';
  for (const [key, value] of [['fareActual', form.fareActual], ['lodgingActual', form.lodgingActual], ['advance', form.advance]] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 10_000_000) errors[key] = '0 or more.';
  }
  if (!Number.isInteger(form.nights) || form.nights < 0) errors.nights = 'Whole nights, 0 or more.';
  else if (ISO.test(form.startAd) && ISO.test(form.endAd) && form.endAd >= form.startAd && form.nights > tripDays(form.startAd, form.endAd) - 1) {
    errors.nights = 'More nights than the trip has.';
  }
  return errors;
}

export interface RateCard {
  dailyAllowance: number | string;
  lodgingPerNight: number | string;
  kmRate: number | string;
}

export interface ClaimAmounts {
  days: number;
  dailyAllowance: string; // days × DA
  lodging: string; // min(actual, nights × ceiling)
  lodgingCapped: boolean;
  travel: string; // own vehicle: km × rate; otherwise the actual fare
  gross: string;
  advance: string;
  payable: string; // gross − advance (may be negative: the employee returns money)
}

/** The claim's amounts from the card; all arithmetic in paisa. */
export function computeClaim(form: Pick<ClaimForm, 'startAd' | 'endAd' | 'mode' | 'km' | 'fareActual' | 'lodgingActual' | 'nights' | 'advance'>, card: RateCard): ClaimAmounts {
  const days = tripDays(form.startAd, form.endAd);
  const da = days * toPaisa(card.dailyAllowance);
  const lodgingCeiling = form.nights * toPaisa(card.lodgingPerNight);
  const lodgingActual = toPaisa(form.lodgingActual);
  const lodging = Math.min(lodgingActual, lodgingCeiling);
  const travel = form.mode === 'own_vehicle' ? Math.round(form.km * toPaisa(card.kmRate)) : toPaisa(form.fareActual);
  const gross = da + lodging + travel;
  const advance = toPaisa(form.advance);
  return {
    days,
    dailyAllowance: toNpr(da),
    lodging: toNpr(lodging),
    lodgingCapped: lodgingActual > lodgingCeiling,
    travel: toNpr(travel),
    gross: toNpr(gross),
    advance: toNpr(advance),
    payable: toNpr(gross - advance),
  };
}

export function validateDecisionNote(to: string, note: string): string | null {
  if ((to === 'rejected' || to === 'draft') && note.trim().length < 5) return 'Say why (at least 5 characters).';
  if (note.length > 1000) return 'Keep it under 1000 characters.';
  return null;
}

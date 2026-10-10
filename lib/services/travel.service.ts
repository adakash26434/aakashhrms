import * as repo from '@/lib/repositories/travel.repository';
import { findEmployeeOptions } from '@/lib/repositories/letter.repository';
import {
  TRAVEL_MODES,
  canMoveClaim,
  computeClaim,
  isEditable,
  normalizeClaimForm,
  normalizeRateForm,
  validateClaimForm,
  validateDecisionNote,
  validateRateForm,
} from '@/lib/engines/travel.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import type { ClaimRow, RateCardRow, TravelPageData } from '@/lib/types/travel';

// TA-DA (G11): orchestration. Amounts come from the engine and the card in
// force when the claim is saved, frozen on the row. S38 (the S21 pattern):
// nobody approves, rejects, returns or settles their own claim — recording
// one's own trip as a draft is fine (that is what ESS will do), deciding is not.

export class TravelValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'TravelValidationError';
  }
}

export interface TravelCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

const asStatus = (s: string): ClaimRow['status'] => (s === 'submitted' || s === 'approved' || s === 'rejected' || s === 'settled' ? s : 'draft');

const toRate = (r: repo.RateJoined): RateCardRow => ({
  id: r.id,
  name: r.name,
  designationId: r.designationId,
  designation: r.designation,
  dailyAllowance: Number(r.dailyAllowance),
  lodgingPerNight: Number(r.lodgingPerNight),
  kmRate: Number(r.kmRate),
  isActive: r.isActive,
});

const toClaim = (c: repo.ClaimJoined): ClaimRow => ({
  id: c.id,
  employeeId: c.employeeId,
  employeeName: c.employeeName,
  employeeCode: c.employeeCode,
  purpose: c.purpose,
  fromPlace: c.fromPlace,
  toPlace: c.toPlace,
  startAd: c.startAd,
  endAd: c.endAd,
  mode: c.mode,
  modeName: TRAVEL_MODES.find((m) => m.code === c.mode)?.name ?? c.mode,
  km: Number(c.km),
  nights: c.nights,
  fareActual: Number(c.fareActual),
  lodgingActual: Number(c.lodgingActual),
  advance: Number(c.advance),
  rateName: c.rateName,
  days: c.days,
  dailyAllowance: Number(c.dailyAllowance),
  lodging: Number(c.lodging),
  travel: Number(c.travel),
  gross: Number(c.gross),
  payable: Number(c.payable),
  note: c.note,
  status: asStatus(c.status),
  decisionNote: c.decisionNote,
  decidedByName: c.decidedByName,
  createdByName: c.createdByName ?? '—',
});

export async function travelPage(ctx: TravelCtx, permissions: TravelPageData['permissions']): Promise<TravelPageData> {
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const [claims, rates, designations, employees] = await Promise.all([repo.listClaims(scopeCondition), repo.listRates(), repo.designationOptions(), findEmployeeOptions(scopeCondition)]);
  return { claims: claims.map(toClaim), rates: rates.map(toRate), designations, employees, permissions };
}

/** Submitted claims this person can decide (the bell): within their scope, never their own (S38). Call it for Approve only. */
export async function countWaitingFor(scope: ScopeFilter): Promise<number> {
  return repo.countInStatus('submitted', buildEmployeeScopeCondition(scope), scope.employeeId);
}

export async function saveRate(id: string | null, raw: unknown, ctx: TravelCtx): Promise<RateCardRow> {
  const form = normalizeRateForm(raw);
  const errors = validateRateForm(form);
  if (Object.keys(errors).length) throw new TravelValidationError(errors);
  const write: repo.RateWrite = {
    name: form.name,
    designationId: form.designationId || null,
    dailyAllowance: form.dailyAllowance.toFixed(2),
    lodgingPerNight: form.lodgingPerNight.toFixed(2),
    kmRate: form.kmRate.toFixed(2),
    isActive: form.isActive,
  };
  try {
    const row = id ? await repo.updateRate(id, write, ctx.userId) : await repo.insertRate(write, ctx.userId);
    if (!row) throw new UserFacingError('Not found: this rate card no longer exists.');
    return toRate((await repo.listRates()).find((r) => r.id === row.id)!);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      throw new TravelValidationError({ designationId: form.designationId ? 'This designation already has a card.' : 'There is already a default card.' });
    }
    throw error;
  }
}

/** Saves a draft (new or existing): amounts recomputed from the card in force now. */
export async function saveClaim(id: string | null, raw: unknown, ctx: TravelCtx): Promise<ClaimRow> {
  const form = normalizeClaimForm(raw);
  const errors = validateClaimForm(form, toIsoDate(nepalToday()));
  if (Object.keys(errors).length) throw new TravelValidationError(errors);

  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  if (id) {
    const existing = await repo.findClaim(id, scopeCondition);
    if (!existing) throw new UserFacingError('Not found: this claim is not in your scope.');
    if (!isEditable(existing.status)) throw new UserFacingError('Only a draft can be edited (return it to draft first).');
    if (existing.employeeId !== form.employeeId) throw new TravelValidationError({ employeeId: 'A claim stays with the employee it was opened for.' });
  }
  const designationId = await repo.employeeDesignation(form.employeeId, scopeCondition);
  if (!designationId) throw new TravelValidationError({ employeeId: 'This employee is not active in your scope.' });
  const card = await repo.cardFor(designationId);
  if (!card) throw new UserFacingError('No TA-DA rate card applies: add a default card (or one for this designation) first.');

  const amounts = computeClaim(form, card);
  const write: repo.ClaimWrite = {
    employeeId: form.employeeId,
    purpose: form.purpose,
    fromPlace: form.fromPlace,
    toPlace: form.toPlace,
    startAd: form.startAd,
    endAd: form.endAd,
    mode: form.mode,
    km: form.km.toFixed(1),
    nights: form.nights,
    fareActual: form.fareActual.toFixed(2),
    lodgingActual: form.lodgingActual.toFixed(2),
    advance: form.advance.toFixed(2),
    rateName: card.name,
    days: amounts.days,
    dailyAllowance: amounts.dailyAllowance,
    lodging: amounts.lodging,
    travel: amounts.travel,
    gross: amounts.gross,
    payable: amounts.payable,
    note: form.note || null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  };
  const row = id ? await repo.updateDraft(id, { ...write, createdBy: undefined }) : await repo.insertClaim(write);
  if (!row) throw new UserFacingError('Someone already submitted this claim — refresh.');
  return toClaim((await repo.findClaim(row.id))!);
}

export async function moveClaim(id: string, to: string, note: string, ctx: TravelCtx): Promise<ClaimRow> {
  const existing = await repo.findClaim(id, buildEmployeeScopeCondition(ctx.scope));
  if (!existing) throw new UserFacingError('Not found: this claim is not in your scope.');
  if (!canMoveClaim(existing.status, to)) throw new UserFacingError(`A ${existing.status} claim cannot move to ${to}.`);

  // S38: deciding or settling your own claim is refused; submitting your own draft is fine.
  if (to !== 'submitted' && isOwnRecord(ctx.actorEmployeeId, existing.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: to === 'settled' ? 'LOCK' : 'APPROVE', module: 'TRAVEL', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('Your own claim must be decided by someone else.');
  }
  const problem = validateDecisionNote(to, note);
  if (problem) throw new TravelValidationError({ note: problem });

  if (!(await repo.moveClaim(id, existing.status, to, note.trim() || null, ctx.userId))) throw new UserFacingError('Someone already changed this claim — refresh.');
  return toClaim((await repo.findClaim(id))!);
}

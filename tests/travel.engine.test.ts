import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canMoveClaim, computeClaim, isEditable, nextClaimStatuses, normalizeClaimForm, normalizeRateForm, tripDays, validateClaimForm, validateDecisionNote, validateRateForm } from '../lib/engines/travel.engine';

// TA-DA (G11): trip days, amounts from the rate card, status flow.

const TODAY = '2026-10-09';
const card = { dailyAllowance: 1500, lodgingPerNight: 2000, kmRate: 12.5 };
const base = { employeeId: 'e1', purpose: 'Branch audit visit', fromPlace: 'Pokhara', toPlace: 'Baglung', startAd: '2026-10-01', endAd: '2026-10-03', mode: 'bus', km: 0, fareActual: 900, lodgingActual: 5000, nights: 2, advance: 3000 };

describe('status flow', () => {
  it('draft → submitted → approved / rejected / back to draft; approved → settled', () => {
    assert.deepEqual(nextClaimStatuses('draft'), ['submitted']);
    assert.deepEqual(nextClaimStatuses('submitted'), ['approved', 'rejected', 'draft']);
    assert.deepEqual(nextClaimStatuses('approved'), ['settled']);
    assert.ok(canMoveClaim('submitted', 'approved') && !canMoveClaim('draft', 'approved') && !canMoveClaim('settled', 'draft'));
    assert.ok(isEditable('draft') && !isEditable('submitted'));
  });
});

describe('rate card', () => {
  it('validates ranges', () => {
    assert.deepEqual(validateRateForm(normalizeRateForm({ name: 'Officer', dailyAllowance: 1500, lodgingPerNight: 2000, kmRate: 12.5 })), {});
    assert.ok(validateRateForm(normalizeRateForm({ name: 'x', kmRate: -1 })).kmRate);
  });
});

describe('claim form', () => {
  it('inclusive trip days', () => {
    assert.equal(tripDays('2026-10-01', '2026-10-01'), 1);
    assert.equal(tripDays('2026-10-01', '2026-10-03'), 3);
  });

  it('accepts a good claim; rejects future trips, bad nights, km on a bus', () => {
    assert.deepEqual(validateClaimForm(normalizeClaimForm(base), TODAY), {});
    assert.ok(validateClaimForm(normalizeClaimForm({ ...base, endAd: '2026-12-01' }), TODAY).endAd);
    assert.ok(validateClaimForm(normalizeClaimForm({ ...base, nights: 3 }), TODAY).nights);
    assert.ok(validateClaimForm(normalizeClaimForm({ ...base, km: 40 }), TODAY).km);
    assert.ok(validateClaimForm(normalizeClaimForm({ ...base, mode: 'own_vehicle', km: 0 }), TODAY).km);
  });
});

describe('amounts', () => {
  it('days × DA, lodging capped by nights × ceiling, actual fare, minus advance', () => {
    const a = computeClaim(normalizeClaimForm(base), card);
    assert.equal(a.days, 3);
    assert.equal(a.dailyAllowance, '4500.00');
    assert.equal(a.lodging, '4000.00');
    assert.ok(a.lodgingCapped);
    assert.equal(a.travel, '900.00');
    assert.equal(a.gross, '9400.00');
    assert.equal(a.payable, '6400.00');
  });

  it('own vehicle pays km × rate; a big advance gives a negative payable', () => {
    const a = computeClaim(normalizeClaimForm({ ...base, mode: 'own_vehicle', km: 72, fareActual: 0, lodgingActual: 0, nights: 0, advance: 10000 }), card);
    assert.equal(a.travel, '900.00');
    assert.equal(a.lodging, '0.00');
    assert.equal(a.payable, '-4600.00');
  });

  it('a rejection or return needs a reason', () => {
    assert.ok(validateDecisionNote('rejected', ''));
    assert.equal(validateDecisionNote('approved', ''), null);
  });
});

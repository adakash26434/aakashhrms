import * as repo from '@/lib/repositories/promotion.repository';
import { DEFAULT_WEIGHTS, normalizeWeights, rankCandidates, scoreCandidate, validateWeights, yearsBetween, type PromotionWeights } from '@/lib/engines/promotion.engine';
import { addMonthsIso } from '@/lib/engines/training.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import type { PromotionPageData, PromotionRow } from '@/lib/types/promotion';

// Promotion score: orchestration. Ranks active employees in the caller's
// scope per designation from the composite; nothing is written except the
// weights (PERFORMANCE LOCK). The list is advice — the बढुवा itself is a
// lifecycle event, recorded by someone with EMPLOYEES EDIT and checked against
// darbandi there.

export class PromotionValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'PromotionValidationError';
  }
}

const DISCIPLINE_WINDOW_MONTHS = 24;

export async function currentWeights(): Promise<PromotionWeights> {
  const stored = await repo.readWeights();
  const w = normalizeWeights(stored ?? DEFAULT_WEIGHTS);
  return Object.keys(validateWeights(w)).length ? DEFAULT_WEIGHTS : w;
}

export async function saveWeights(raw: unknown): Promise<PromotionWeights> {
  const w = normalizeWeights(raw);
  const errors = validateWeights(w);
  if (Object.keys(errors).length) throw new PromotionValidationError(errors);
  await repo.writeWeights(w);
  return w;
}

export async function promotionPage(scope: ScopeFilter, permissions: PromotionPageData['permissions']): Promise<PromotionPageData> {
  const today = toIsoDate(nepalToday());
  const disciplineSinceAd = addMonthsIso(today, -DISCIPLINE_WINDOW_MONTHS);
  const [weights, people] = await Promise.all([currentWeights(), repo.activeEmployees(buildEmployeeScopeCondition(scope))]);
  const ids = people.map((p) => p.id);
  const [totals, promotions, hours, outcomes] = await Promise.all([repo.finalTotals(ids), repo.lastPromotionDates(ids), repo.completedTrainingHours(ids), repo.disciplinaryOutcomes(ids, disciplineSinceAd)]);

  const byId = new Map(people.map((p) => [p.id, p]));
  const facts = people.map((p) => {
    const since = promotions.get(p.id) ?? p.joiningDate;
    return { since, score: scoreCandidate({ employeeId: p.id, evaluationTotals: totals.get(p.id) ?? [], yearsInPost: yearsBetween(since, today), trainingHours: hours.get(p.id) ?? 0, disciplinaryOutcomes: outcomes.get(p.id) ?? 0 }, weights) };
  });
  const sinceById = new Map(facts.map((f) => [f.score.employeeId, f.since]));

  // Rank within each designation (promotion competes among peers of the same post).
  const rows: PromotionRow[] = [];
  const byDesignation = new Map<string, typeof facts>();
  for (const f of facts) {
    const d = byId.get(f.score.employeeId)!.designationId;
    byDesignation.set(d, [...(byDesignation.get(d) ?? []), f]);
  }
  for (const group of byDesignation.values()) {
    for (const r of rankCandidates(group.map((g) => g.score))) {
      const p = byId.get(r.employeeId)!;
      const since = sinceById.get(r.employeeId)!;
      rows.push({
        rank: r.rank,
        employeeId: p.id,
        employeeName: p.fullName,
        employeeCode: p.employeeCode,
        designationId: p.designationId,
        designation: p.designation,
        branch: p.branch,
        yearsInPost: yearsBetween(since, today),
        inPostSince: since,
        evaluationAvg: r.evaluationAvg,
        evaluationPoints: r.evaluationPoints,
        seniorityPoints: r.seniorityPoints,
        trainingHours: hours.get(p.id) ?? 0,
        trainingPoints: r.trainingPoints,
        penalty: r.penalty,
        composite: r.composite,
        note: r.note,
      });
    }
  }
  rows.sort((a, b) => a.designation.localeCompare(b.designation) || (a.rank ?? 1e9) - (b.rank ?? 1e9) || b.composite - a.composite);
  const designations = [...new Map(people.map((p) => [p.designationId, { id: p.designationId, name: p.designation }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  return { rows, designations, weights, disciplineSinceAd, permissions };
}

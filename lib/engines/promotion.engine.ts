// Promotion score (G1 / G2 follow-up, docs/redesign/06-hrms-gap-analysis.md):
// pure rules, no database access, unit-tested in tests/promotion.test.ts.
//
// The बढुवा composite the way cooperative bylaws usually frame it: recent
// का.स.मू. results carry most of the weight, seniority in the current post
// earns points per year up to a cap, training adds a little, and a
// disciplinary outcome in the window deducts. Weights are per company
// (system_config `promotion.weights`), must sum to 100, and the composite is
// COMPUTED for the list — never stored, so a weight change re-ranks at once.

export interface PromotionWeights {
  evaluation: number; // % of the composite
  seniority: number;
  training: number;
  /** Years of service in the current post that earn the full seniority share. */
  seniorityFullYears: number;
  /** Completed training hours that earn the full training share. */
  trainingFullHours: number;
  /** How many latest final evaluations are averaged. */
  evaluationsCounted: number;
  /** Deduction (composite points) per disciplinary outcome in the window. */
  disciplinePenalty: number;
}

export const DEFAULT_WEIGHTS: PromotionWeights = {
  evaluation: 60,
  seniority: 30,
  training: 10,
  seniorityFullYears: 10,
  trainingFullHours: 40,
  evaluationsCounted: 2,
  disciplinePenalty: 5,
};

export const PROMOTION_CONFIG_KEY = 'promotion.weights';

const num = (v: unknown, fallback: number) => (v === '' || v === undefined || v === null || !Number.isFinite(Number(v)) ? fallback : Number(v));

export function normalizeWeights(raw: unknown): PromotionWeights {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    evaluation: num(r.evaluation, DEFAULT_WEIGHTS.evaluation),
    seniority: num(r.seniority, DEFAULT_WEIGHTS.seniority),
    training: num(r.training, DEFAULT_WEIGHTS.training),
    seniorityFullYears: num(r.seniorityFullYears, DEFAULT_WEIGHTS.seniorityFullYears),
    trainingFullHours: num(r.trainingFullHours, DEFAULT_WEIGHTS.trainingFullHours),
    evaluationsCounted: Math.trunc(num(r.evaluationsCounted, DEFAULT_WEIGHTS.evaluationsCounted)),
    disciplinePenalty: num(r.disciplinePenalty, DEFAULT_WEIGHTS.disciplinePenalty),
  };
}

export function validateWeights(w: PromotionWeights): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of ['evaluation', 'seniority', 'training'] as const) {
    if (w[key] < 0 || w[key] > 100) errors[key] = '0–100.';
  }
  if (Math.round((w.evaluation + w.seniority + w.training) * 100) / 100 !== 100) errors.evaluation = 'The three shares must add up to 100.';
  if (w.seniorityFullYears < 1 || w.seniorityFullYears > 40) errors.seniorityFullYears = '1–40 years.';
  if (w.trainingFullHours < 1 || w.trainingFullHours > 1000) errors.trainingFullHours = '1–1000 hours.';
  if (w.evaluationsCounted < 1 || w.evaluationsCounted > 5) errors.evaluationsCounted = '1–5 evaluations.';
  if (w.disciplinePenalty < 0 || w.disciplinePenalty > 50) errors.disciplinePenalty = '0–50 points.';
  return errors;
}

export interface CandidateFacts {
  employeeId: string;
  /** Final evaluation totals (0–100), newest first. */
  evaluationTotals: number[];
  /** Years in the current post (since the last promotion event, else since joining). */
  yearsInPost: number;
  trainingHours: number;
  /** Disciplinary outcomes other than "no action" in the window. */
  disciplinaryOutcomes: number;
}

export interface CandidateScore {
  employeeId: string;
  evaluationAvg: number | null; // null = no final evaluation yet
  evaluationPoints: number;
  seniorityPoints: number;
  trainingPoints: number;
  penalty: number;
  composite: number; // 0–100, one decimal, never below 0
  /** Why the person cannot be ranked (no evaluation on file). */
  note: string | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function scoreCandidate(facts: CandidateFacts, w: PromotionWeights): CandidateScore {
  const counted = facts.evaluationTotals.slice(0, Math.max(1, w.evaluationsCounted));
  const evaluationAvg = counted.length ? round1(counted.reduce((a, b) => a + b, 0) / counted.length) : null;
  const evaluationPoints = evaluationAvg === null ? 0 : (evaluationAvg / 100) * w.evaluation;
  const seniorityPoints = clamp01(facts.yearsInPost / w.seniorityFullYears) * w.seniority;
  const trainingPoints = clamp01(facts.trainingHours / w.trainingFullHours) * w.training;
  const penalty = facts.disciplinaryOutcomes * w.disciplinePenalty;
  const composite = Math.max(0, round1(evaluationPoints + seniorityPoints + trainingPoints - penalty));
  return {
    employeeId: facts.employeeId,
    evaluationAvg,
    evaluationPoints: round1(evaluationPoints),
    seniorityPoints: round1(seniorityPoints),
    trainingPoints: round1(trainingPoints),
    penalty: round1(penalty),
    composite,
    note: evaluationAvg === null ? 'No final evaluation on file.' : null,
  };
}

/** Ranked, highest composite first; ties broken by seniority then evaluation; unranked (no evaluation) last. */
export function rankCandidates(scores: CandidateScore[]): (CandidateScore & { rank: number | null })[] {
  const ranked = scores.filter((s) => s.evaluationAvg !== null).sort((a, b) => b.composite - a.composite || b.seniorityPoints - a.seniorityPoints || (b.evaluationAvg ?? 0) - (a.evaluationAvg ?? 0));
  const unranked = scores.filter((s) => s.evaluationAvg === null).sort((a, b) => b.seniorityPoints - a.seniorityPoints);
  return [...ranked.map((s, i) => ({ ...s, rank: i + 1 })), ...unranked.map((s) => ({ ...s, rank: null }))];
}

/** Years between two ISO dates with one decimal (for seniority points). */
export function yearsBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.max(0, round1((b - a) / (365.25 * 86_400_000)));
}

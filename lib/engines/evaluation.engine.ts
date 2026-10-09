// Performance evaluation (G1, docs/redesign/06-hrms-gap-analysis.md): pure
// rules — no database access, unit-tested in tests/evaluation.test.ts.
//
// का.स.मू.-style: the form is sections → criteria with max marks; the stages
// with weight > 0 run in order (supervisor → reviewer → committee), each
// rater marks every criterion, a stage's percentage is marks ÷ max × 100, and
// the final total is the weighted sum mapped to a grade band. The form is
// FROZEN on each evaluation when it starts, so template edits never touch
// in-flight evaluations.

export const EVALUATION_STAGES = [
  { code: 'supervisor', name: 'Supervisor', nameNp: 'सुपरिवेक्षक' },
  { code: 'reviewer', name: 'Reviewer', nameNp: 'पुनरावलोकनकर्ता' },
  { code: 'committee', name: 'Committee', nameNp: 'समिति' },
] as const;

export type EvaluationStage = (typeof EVALUATION_STAGES)[number]['code'];

export const stageDef = (code: string) => EVALUATION_STAGES.find((s) => s.code === code) ?? null;

export interface EvaluationCriterion {
  id: string;
  name: string;
  nameNp: string;
  max: number;
}

export interface EvaluationSection {
  id: string;
  name: string;
  nameNp: string;
  criteria: EvaluationCriterion[];
}

export interface GradeBand {
  /** Inclusive lower bound, percent. Bands are checked highest first. */
  min: number;
  label: string;
  labelNp: string;
}

export interface EvaluationForm {
  /** Stage → weight percent; stages with 0 are skipped. Weights sum to 100. */
  weights: Record<EvaluationStage, number>;
  bands: GradeBand[];
  sections: EvaluationSection[];
}

// ---------------------------------------------------------------------------
// Form validation and normalisation
// ---------------------------------------------------------------------------

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN);

/** Parses an untrusted form JSON into shape; content checks are validateForm's. */
export function normalizeForm(raw: unknown): EvaluationForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const weightsRaw = (r.weights && typeof r.weights === 'object' ? r.weights : {}) as Record<string, unknown>;
  const weights = Object.fromEntries(
    EVALUATION_STAGES.map((st) => [st.code, Math.max(0, Math.round(num(weightsRaw[st.code]) || 0))]),
  ) as Record<EvaluationStage, number>;
  const bands = (Array.isArray(r.bands) ? r.bands : [])
    .map((b) => {
      const o = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
      return { min: num(o.min), label: s(o.label, 50), labelNp: s(o.labelNp, 50) };
    })
    .filter((b) => Number.isFinite(b.min))
    .sort((a, b) => b.min - a.min);
  const sections = (Array.isArray(r.sections) ? r.sections : []).map((sec, i) => {
    const o = (sec && typeof sec === 'object' ? sec : {}) as Record<string, unknown>;
    return {
      id: s(o.id, 40) || `s${i + 1}`,
      name: s(o.name),
      nameNp: s(o.nameNp),
      criteria: (Array.isArray(o.criteria) ? o.criteria : []).map((c, j) => {
        const co = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
        return { id: s(co.id, 40) || `s${i + 1}c${j + 1}`, name: s(co.name), nameNp: s(co.nameNp), max: num(co.max) };
      }),
    };
  });
  return { weights, bands, sections };
}

export function validateForm(form: EvaluationForm): string[] {
  const errors: string[] = [];
  const weightSum = EVALUATION_STAGES.reduce((sum, st) => sum + (form.weights[st.code] ?? 0), 0);
  if (weightSum !== 100) errors.push(`Stage weights must sum to 100 (now ${weightSum}).`);
  if (!activeStages(form).length) errors.push('At least one stage needs a weight.');
  if (!form.sections.length) errors.push('Add at least one section.');
  const ids = new Set<string>();
  for (const section of form.sections) {
    if (!section.name) errors.push('Every section needs a name.');
    if (!section.criteria.length) errors.push(`Section "${section.name || section.id}" needs at least one criterion.`);
    for (const c of section.criteria) {
      if (!c.name) errors.push(`A criterion in "${section.name || section.id}" has no name.`);
      if (!Number.isFinite(c.max) || c.max <= 0 || c.max > 100) errors.push(`"${c.name || c.id}": max marks must be 1–100.`);
      if (ids.has(c.id)) errors.push(`Duplicate criterion id "${c.id}".`);
      ids.add(c.id);
    }
  }
  if (!form.bands.length) errors.push('Add at least one grade band.');
  if (form.bands.length && Math.min(...form.bands.map((b) => b.min)) > 0) errors.push('One band must start at 0 so every total has a grade.');
  for (const b of form.bands) if (!b.label) errors.push('Every grade band needs a label.');
  return errors;
}

/** The stages this form actually runs, in order. */
export function activeStages(form: EvaluationForm): EvaluationStage[] {
  return EVALUATION_STAGES.filter((s) => (form.weights[s.code] ?? 0) > 0).map((s) => s.code);
}

export const allCriteria = (form: EvaluationForm): EvaluationCriterion[] => form.sections.flatMap((s) => s.criteria);

export const maxTotal = (form: EvaluationForm): number => allCriteria(form).reduce((sum, c) => sum + c.max, 0);

// ---------------------------------------------------------------------------
// Raters
// ---------------------------------------------------------------------------

/**
 * Rater rules (S28, the S21 pattern): every active stage has a rater; the
 * subject's own user never rates any stage; the same person cannot hold two
 * stages of one evaluation.
 */
export function validateRaters(
  form: EvaluationForm,
  raters: Record<string, string>,
  subjectUserId: string | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Map<string, EvaluationStage>();
  for (const stage of activeStages(form)) {
    const rater = (raters[stage] ?? '').trim();
    if (!rater) {
      errors[stage] = 'Choose who rates this stage.';
      continue;
    }
    if (subjectUserId && rater === subjectUserId) errors[stage] = 'The employee cannot rate their own evaluation.';
    const other = seen.get(rater);
    if (other) errors[stage] = `Already rating the ${stageDef(other)?.name.toLowerCase()} stage.`;
    seen.set(rater, stage);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Scores and totals
// ---------------------------------------------------------------------------

export interface StageScore {
  stage: string;
  criterionId: string;
  marks: number;
}

/** Marks for one stage: every criterion present, each within 0..max. */
export function validateStageMarks(form: EvaluationForm, marks: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const c of allCriteria(form)) {
    const value = num(marks[c.id]);
    if (!Number.isFinite(value)) errors[c.id] = 'Required.';
    else if (value < 0 || value > c.max) errors[c.id] = `0–${c.max}.`;
    else if (Math.round(value * 2) !== value * 2) errors[c.id] = 'Whole or half marks only.';
  }
  return errors;
}

/** A stage's percentage: marks ÷ max total × 100 (2 dp). */
export function stagePercent(form: EvaluationForm, scores: StageScore[], stage: EvaluationStage): number | null {
  const byId = new Map(scores.filter((s) => s.stage === stage).map((s) => [s.criterionId, s.marks]));
  const criteria = allCriteria(form);
  if (criteria.some((c) => !byId.has(c.id))) return null; // incomplete
  const got = criteria.reduce((sum, c) => sum + (byId.get(c.id) ?? 0), 0);
  const max = maxTotal(form);
  return max > 0 ? Math.round((got / max) * 10000) / 100 : 0;
}

export interface EvaluationTotals {
  stages: Record<string, number>;
  total: number;
  band: string;
  bandNp: string;
}

/** The weighted final total and grade band; null while any stage is incomplete. */
export function computeTotals(form: EvaluationForm, scores: StageScore[]): EvaluationTotals | null {
  const stages: Record<string, number> = {};
  let total = 0;
  for (const stage of activeStages(form)) {
    const pct = stagePercent(form, scores, stage);
    if (pct === null) return null;
    stages[stage] = pct;
    total += (pct * (form.weights[stage] ?? 0)) / 100;
  }
  total = Math.round(total * 100) / 100;
  const band = gradeBand(form, total);
  return { stages, total, band: band?.label ?? '', bandNp: band?.labelNp ?? '' };
}

export function gradeBand(form: EvaluationForm, totalPct: number): GradeBand | null {
  // Bands are sorted highest min first by normalizeForm.
  return form.bands.find((b) => totalPct >= b.min) ?? null;
}

/** The stage after this one, or 'final'. */
export function nextStage(form: EvaluationForm, stage: EvaluationStage): EvaluationStage | 'final' {
  const order = activeStages(form);
  const at = order.indexOf(stage);
  return at >= 0 && at + 1 < order.length ? order[at + 1] : 'final';
}

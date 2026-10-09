import * as repo from '@/lib/repositories/evaluation.repository';
import * as letterRepo from '@/lib/repositories/letter.repository';
import { findAllFiscalYears } from '@/lib/repositories/fiscal-year.repository';
import { DEFAULT_EVALUATION_TEMPLATE } from '@/lib/constants/evaluation-template';
import {
  activeStages,
  computeTotals,
  nextStage,
  normalizeForm,
  stageDef,
  stagePercent,
  validateForm,
  validateRaters,
  validateStageMarks,
  type EvaluationStage,
  type StageScore,
} from '@/lib/engines/evaluation.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import type { EvaluationDetail, EvaluationListRow, EvaluationsPageData } from '@/lib/types/evaluation';

// Performance evaluation (G1): orchestration. The form freezes on each
// evaluation at start; marks go stage by stage (each stage's rater fixed at
// start); S28 (the S21 pattern): the subject's own user never rates, starts
// or finalizes their own evaluation.

export class EvaluationValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'EvaluationValidationError';
  }
}

export interface EvaluationCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

export async function ensureDefaultTemplate(): Promise<void> {
  if (await repo.findTemplate(DEFAULT_EVALUATION_TEMPLATE.code)) return;
  await repo.insertTemplate({ ...DEFAULT_EVALUATION_TEMPLATE, form: DEFAULT_EVALUATION_TEMPLATE.form as unknown as Record<string, unknown>, isSystem: true });
}

const toListRow = (r: repo.EvaluationJoinedRow, userId: string): EvaluationListRow => {
  const totals = (r.totals ?? {}) as { total?: number; band?: string; bandNp?: string };
  const stage = r.stage as EvaluationStage | 'final';
  return {
    id: r.id,
    cycleId: r.cycleId,
    cycleLabel: r.cycleLabel,
    cycleStatus: r.cycleStatus === 'closed' ? 'closed' : 'open',
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    designation: r.designation,
    branch: r.branch,
    stage,
    stageName: stage === 'final' ? 'Final' : stageDef(stage)?.name ?? stage,
    status: r.status === 'final' ? 'final' : 'in_progress',
    total: typeof totals.total === 'number' ? totals.total : null,
    band: totals.band ?? '',
    bandNp: totals.bandNp ?? '',
    waitingForMe: r.status === 'in_progress' && ((r.raters ?? {}) as Record<string, string>)[r.stage] === userId,
  };
};

export async function evaluationsPage(
  ctx: EvaluationCtx,
  permissions: EvaluationsPageData['permissions'],
  filter: repo.EvaluationFilter = {},
): Promise<EvaluationsPageData> {
  await ensureDefaultTemplate();
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const [rows, cycles, template, employees, raters, years, waitingForMe] = await Promise.all([
    repo.listEvaluations(filter, scopeCondition),
    repo.listCycles(),
    repo.findTemplate(DEFAULT_EVALUATION_TEMPLATE.code),
    letterRepo.findEmployeeOptions(scopeCondition),
    repo.raterOptions(),
    findAllFiscalYears(),
    repo.countWaitingFor(ctx.userId, scopeCondition),
  ]);
  const form = normalizeForm(template!.form);
  return {
    evaluations: rows.map((r) => toListRow(r, ctx.userId)),
    cycles: cycles.map((c) => ({
      id: c.id,
      label: c.label,
      period: c.period === 'half-yearly' ? 'half-yearly' : 'annual',
      fiscalYearId: c.fiscalYearId,
      fiscalYearLabel: c.fiscalYearLabel,
      status: c.status === 'closed' ? 'closed' : 'open',
      openedByName: c.openedByName ?? '—',
      openedAt: c.openedAt.toISOString(),
      evaluationCount: c.evaluationCount,
      finalCount: c.finalCount,
    })),
    template: { id: template!.id, name: template!.name, nameNp: template!.nameNp, form },
    formErrors: validateForm(form),
    employees,
    raterOptions: raters,
    fiscalYears: years.map((y) => ({ id: y.id, label: y.label })),
    waitingForMe,
    permissions,
  };
}

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

export async function openCycle(raw: { fiscalYearId?: unknown; label?: unknown; period?: unknown }, ctx: EvaluationCtx) {
  const fiscalYearId = typeof raw.fiscalYearId === 'string' ? raw.fiscalYearId : '';
  const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 100) : '';
  const period = raw.period === 'half-yearly' ? 'half-yearly' : 'annual';
  const errors: Record<string, string> = {};
  if (!fiscalYearId) errors.fiscalYearId = 'Choose the fiscal year.';
  if (!label) errors.label = 'Name the cycle, e.g. "Annual 2082/83".';
  if (Object.keys(errors).length) throw new EvaluationValidationError(errors);
  await ensureDefaultTemplate();
  const template = await repo.findTemplate(DEFAULT_EVALUATION_TEMPLATE.code);
  const formErrors = validateForm(normalizeForm(template!.form));
  if (formErrors.length) throw new UserFacingError(`Fix the evaluation form first: ${formErrors[0]}`);
  try {
    return await repo.insertCycle({ fiscalYearId, label, period, openedBy: ctx.userId });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      throw new EvaluationValidationError({ label: 'A cycle with this name already exists for that fiscal year.' });
    }
    throw error;
  }
}

export async function closeCycle(id: string, ctx: EvaluationCtx) {
  const cycle = await repo.closeCycle(id, ctx.userId);
  if (!cycle) throw new UserFacingError('This cycle is already closed.');
  return cycle;
}

// ---------------------------------------------------------------------------
// Starting evaluations
// ---------------------------------------------------------------------------

export interface StartInput {
  cycleId: string;
  /** Empty = every active employee in scope not yet in the cycle. */
  employeeIds: string[];
  /** Stage → user id; the supervisor stage falls back to each employee's own supervisor's account. */
  raters: Record<string, string>;
}

function normalizeStartInput(raw: unknown): StartInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ratersRaw = (r.raters && typeof r.raters === 'object' ? r.raters : {}) as Record<string, unknown>;
  return {
    cycleId: typeof r.cycleId === 'string' ? r.cycleId : '',
    employeeIds: Array.isArray(r.employeeIds) ? r.employeeIds.filter((x): x is string => typeof x === 'string').slice(0, 2000) : [],
    raters: Object.fromEntries(Object.entries(ratersRaw).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, (v as string).trim()])),
  };
}

export async function startEvaluations(raw: unknown, ctx: EvaluationCtx): Promise<{ started: number; skipped: string[] }> {
  const input = normalizeStartInput(raw);
  if (!input.cycleId) throw new EvaluationValidationError({ cycleId: 'Choose a cycle.' });
  const cycle = await repo.findCycle(input.cycleId);
  if (!cycle || cycle.status !== 'open') throw new UserFacingError('This cycle is closed.');

  await ensureDefaultTemplate();
  const template = await repo.findTemplate(DEFAULT_EVALUATION_TEMPLATE.code);
  const form = normalizeForm(template!.form);
  const formErrors = validateForm(form);
  if (formErrors.length) throw new UserFacingError(`Fix the evaluation form first: ${formErrors[0]}`);

  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const candidates = await repo.employeesNotInCycle(input.cycleId, scopeCondition);
  const chosen = input.employeeIds.length ? candidates.filter((c) => input.employeeIds.includes(c.id)) : candidates;
  if (!chosen.length) throw new UserFacingError('Everyone chosen is already in this cycle (or out of your scope).');

  const firstStage = activeStages(form)[0];
  // Supervisor stage falls back to each employee's own supervisor's account.
  const supervisorIds = [...new Set(chosen.map((c) => c.supervisorId).filter((x): x is string => !!x))];
  const supervisorUsers = await repo.userIdsForEmployees(supervisorIds);
  const writes: repo.StartWrite[] = [];
  const skipped: string[] = [];
  for (const employee of chosen) {
    // S28: starting your own evaluation is someone else's job.
    if (isOwnRecord(ctx.actorEmployeeId, employee.id)) {
      skipped.push('your own record');
      continue;
    }
    const raters: Record<string, string> = {};
    for (const stage of activeStages(form)) {
      const fallback = stage === 'supervisor' && employee.supervisorId ? supervisorUsers.get(employee.supervisorId) ?? '' : '';
      raters[stage] = input.raters[stage] || fallback;
    }
    const raterErrors = validateRaters(form, raters, employee.userId);
    if (Object.keys(raterErrors).length) {
      skipped.push(`${employee.id}: ${Object.values(raterErrors)[0]}`);
      continue;
    }
    writes.push({
      cycleId: input.cycleId,
      employeeId: employee.id,
      form: form as unknown as Record<string, unknown>,
      raters,
      stage: firstStage,
      startedBy: ctx.userId,
    });
  }
  if (!writes.length) {
    throw new EvaluationValidationError({
      raters: skipped[0]?.includes(':') ? `Could not assign raters — ${skipped[0].split(': ')[1]}` : 'Nobody could be started — choose the raters.',
    });
  }
  const started = await repo.startEvaluations(writes);
  await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'PERFORMANCE', recordId: input.cycleId, result: 'SUCCESS', newValues: { started, skipped: skipped.length } });
  return { started, skipped };
}

// ---------------------------------------------------------------------------
// Detail, scoring, finalizing
// ---------------------------------------------------------------------------

async function detailOf(row: repo.EvaluationJoinedRow, userId: string): Promise<EvaluationDetail> {
  const form = normalizeForm(row.form);
  const scores = await repo.findScores(row.id);
  const raters = (row.raters ?? {}) as Record<string, string>;
  const names = await repo.userNames(Object.values(raters));
  const byStage: EvaluationDetail['scores'] = {};
  const stageScores: StageScore[] = [];
  for (const s of scores) {
    (byStage[s.stage] ??= []).push({ criterionId: s.criterionId, marks: Number(s.marks), note: s.note });
    stageScores.push({ stage: s.stage, criterionId: s.criterionId, marks: Number(s.marks) });
  }
  const stagePercents: Record<string, number> = {};
  for (const stage of activeStages(form)) {
    const pct = stagePercent(form, stageScores, stage);
    if (pct !== null) stagePercents[stage] = pct;
  }
  return {
    ...toListRow(row, userId),
    form,
    raters,
    raterNames: Object.fromEntries(Object.entries(raters).map(([stage, id]) => [stage, names.get(id) ?? '—'])),
    scores: byStage,
    stagePercents,
  };
}

export async function getEvaluation(id: string, ctx: EvaluationCtx): Promise<EvaluationDetail | null> {
  const row = await repo.findEvaluation(id, buildEmployeeScopeCondition(ctx.scope));
  return row ? detailOf(row, ctx.userId) : null;
}

export interface RateInput {
  evaluationId: string;
  marks: Record<string, unknown>;
  notes: Record<string, unknown>;
}

/**
 * Saves the current stage's marks. Only the stage's assigned rater (or a user
 * with APPROVE, acting for an absent rater — audited) may rate; the last
 * stage finalizes the evaluation with its weighted totals.
 */
export async function rateStage(raw: unknown, ctx: EvaluationCtx, canActForRater: boolean): Promise<EvaluationDetail> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const id = typeof r.evaluationId === 'string' ? r.evaluationId : '';
  const row = id ? await repo.findEvaluation(id, buildEmployeeScopeCondition(ctx.scope)) : null;
  if (!row) throw new UserFacingError('Not found: this evaluation is not in your scope.');
  if (row.status !== 'in_progress') throw new UserFacingError('This evaluation is already final.');
  if (row.cycleStatus === 'closed') throw new UserFacingError('This cycle is closed.');

  // S28: never your own evaluation, in any role.
  if (isOwnRecord(ctx.actorEmployeeId, row.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'PERFORMANCE', recordId: row.id, result: DENIED_SELF });
    throw new UserFacingError('Your own evaluation is rated by others.');
  }

  const stage = row.stage as EvaluationStage;
  const raters = (row.raters ?? {}) as Record<string, string>;
  const assigned = raters[stage] ?? '';
  if (assigned !== ctx.userId && !canActForRater) {
    throw new UserFacingError(`This stage is rated by ${stageDef(stage)?.name.toLowerCase() ?? stage} — not you.`);
  }

  const form = normalizeForm(row.form);
  const marks = (r.marks && typeof r.marks === 'object' ? r.marks : {}) as Record<string, unknown>;
  const notes = (r.notes && typeof r.notes === 'object' ? r.notes : {}) as Record<string, unknown>;
  const markErrors = validateStageMarks(form, marks);
  if (Object.keys(markErrors).length) throw new EvaluationValidationError(markErrors);

  const following = nextStage(form, stage);
  let totals: Record<string, unknown> | null = null;
  if (following === 'final') {
    const existing = await repo.findScores(row.id);
    const all: StageScore[] = [
      ...existing.filter((s) => s.stage !== stage).map((s) => ({ stage: s.stage, criterionId: s.criterionId, marks: Number(s.marks) })),
      ...Object.entries(marks).map(([criterionId, v]) => ({ stage, criterionId, marks: Number(v) })),
    ];
    const computed = computeTotals(form, all);
    if (!computed) throw new UserFacingError('An earlier stage is incomplete — refresh and try again.');
    totals = computed as unknown as Record<string, unknown>;
  }

  const result = await repo.saveStageTx({
    evaluationId: row.id,
    stage,
    marks: Object.entries(marks).map(([criterionId, v]) => ({
      criterionId,
      marks: String(Number(v)),
      note: typeof notes[criterionId] === 'string' && (notes[criterionId] as string).trim() ? (notes[criterionId] as string).trim().slice(0, 500) : null,
    })),
    ratedBy: ctx.userId,
    nextStage: following,
    totals,
  });
  if (result === 'stale') throw new UserFacingError('Someone already moved this evaluation on — refresh.');

  await recordAuditLog({
    userId: ctx.userId,
    action: following === 'final' ? 'APPROVE' : 'EDIT',
    module: 'PERFORMANCE',
    recordId: row.id,
    result: 'SUCCESS',
    newValues: { stage, actedForRater: assigned !== ctx.userId, final: following === 'final', ...(totals ? { total: (totals as { total?: number }).total, band: (totals as { band?: string }).band } : {}) },
  });

  const saved = await repo.findEvaluation(row.id);
  return detailOf(saved!, ctx.userId);
}

import { createHash } from 'node:crypto';
import * as repo from '@/lib/repositories/target.repository';
import * as letterRepo from '@/lib/repositories/letter.repository';
import {
  achievementPct,
  canMove,
  employeeCanEdit,
  normalizeAchievementForm,
  normalizeTargetForm,
  periodLabel,
  scoringValue,
  validateAchievementForm,
  validateReturnReason,
  validateTargetForm,
  weightTotal,
  weightedScore,
  type PeriodKind,
  type TargetStatus,
} from '@/lib/engines/target.engine';
import { fileProblem, safeFileName, sniffFileType } from '@/lib/engines/employee-document.engine';
import { DOCUMENT_MAX_BYTES } from '@/lib/types/employee-document';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import { getFiscalYear } from '@/lib/utils/bs-calendar';
import { TARGET_ATTACHMENT_MAX } from '@/lib/types/target';
import type { MyTargetsData, PeriodScore, TargetAttachmentRef, TargetRow, TargetsPageData } from '@/lib/types/target';

// Targets & achievements (G15): orchestration. Three people touch a target:
// HR/the office sets it and closes it, the employee reports the achievement
// (portal), the supervisor verifies and forwards (portal). S42: nobody sets or
// decides on their own targets, a supervisor only acts on their own reports,
// and the employee never changes the target, the verified figure or a
// submitted report. Every status step is claim-first.

export class TargetValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'TargetValidationError';
  }
}

export interface TargetCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

/** The signed-in employee in the portal (taken from the session, never a parameter). */
export interface PortalCtx {
  userId: string;
  employeeId: string;
}

export const MAX_STAGED_PER_USER = 10;

const asStatus = (s: string): TargetStatus => (s === 'submitted' || s === 'returned' || s === 'forwarded' || s === 'closed' ? s : 'set');
const num = (v: string | null) => (v === null ? null : Number(v));

function toRow(t: repo.TargetWithPerson, files: Map<string, TargetAttachmentRef[]>): TargetRow {
  const kind: PeriodKind = t.periodKind === 'month' ? 'month' : 'year';
  const value = scoringValue(num(t.achievedValue), num(t.verifiedValue));
  return {
    id: t.id,
    employeeId: t.employeeId,
    employeeName: t.employeeName,
    employeeCode: t.employeeCode,
    branch: t.branch,
    periodKind: kind,
    fy: t.fy,
    monthNo: t.monthNo,
    periodLabel: periodLabel(kind, t.fy, t.monthNo),
    title: t.title,
    unit: t.unit,
    targetValue: Number(t.targetValue),
    weight: Number(t.weight),
    status: asStatus(t.status),
    achievedValue: num(t.achievedValue),
    achievedNote: t.achievedNote ?? '',
    verifiedValue: num(t.verifiedValue),
    reviewerNote: t.reviewerNote ?? '',
    returnReason: t.returnReason ?? '',
    pct: value === null ? null : achievementPct(Number(t.targetValue), value),
    attachments: files.get(t.id) ?? [],
  };
}

async function rowsFor(records: repo.TargetWithPerson[]): Promise<TargetRow[]> {
  const files = new Map<string, TargetAttachmentRef[]>();
  for (const a of await repo.attachmentsFor(records.map((r) => r.id))) {
    if (!a.targetId) continue;
    const list = files.get(a.targetId) ?? [];
    list.push({ id: a.id, name: a.fileName, mime: a.mime, size: a.size });
    files.set(a.targetId, list);
  }
  return records.map((r) => toRow(r, files));
}

/** One score per person and period, from the rows as they stand. */
export function scoresOf(rows: readonly TargetRow[]): PeriodScore[] {
  const groups = new Map<string, TargetRow[]>();
  for (const r of rows) {
    const key = `${r.employeeId}|${r.periodKind}|${r.fy}|${r.monthNo ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map((g) => ({
    employeeId: g[0].employeeId,
    periodKind: g[0].periodKind,
    fy: g[0].fy,
    monthNo: g[0].monthNo,
    periodLabel: g[0].periodLabel,
    score: weightedScore(g.map((r) => ({ weight: r.weight, target: r.targetValue, value: scoringValue(r.achievedValue, r.verifiedValue) }))),
    weightTotal: weightTotal(g),
  }));
}

/** Previous, current and next fiscal year plus any that have targets. */
export function fiscalYearOptions(existing: readonly string[]): { current: string; options: string[] } {
  const current = getFiscalYear().fyString;
  const start = Number(current.slice(0, 4));
  const label = (y: number) => `${y}/${String(y + 1).slice(-2)}`;
  return { current, options: [...new Set([label(start - 1), current, label(start + 1), ...existing])].sort().reverse() };
}

// ---- office (HR) -------------------------------------------------------------

export async function targetsPage(ctx: TargetCtx, permissions: TargetsPageData['permissions']): Promise<TargetsPageData> {
  const condition = buildEmployeeScopeCondition(ctx.scope);
  const [records, employees, existing] = await Promise.all([
    repo.listTargets({ scopeCondition: condition }),
    letterRepo.findEmployeeOptions(condition),
    repo.distinctFiscalYears(),
  ]);
  const rows = await rowsFor(records);
  const years = fiscalYearOptions(existing);
  return { rows, scores: scoresOf(rows), employees, fiscalYears: years.options, currentFy: years.current, permissions };
}

export interface CreateResult {
  created: number;
  skipped: number;
}

/** Sets the same target for one or more employees in the user's scope. */
export async function createTargets(raw: unknown, ctx: TargetCtx): Promise<CreateResult> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ids = [...new Set((Array.isArray(r.employeeIds) ? r.employeeIds : []).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64))];
  if (!ids.length) throw new TargetValidationError({ employeeIds: 'Choose at least one employee.' });
  if (ids.length > 200) throw new TargetValidationError({ employeeIds: 'Choose at most 200 employees at a time.' });
  const form = normalizeTargetForm({ ...r, employeeId: ids[0] });
  const errors = validateTargetForm(form);
  if (Object.keys(errors).length) throw new TargetValidationError(errors);

  // S42: nobody sets their own targets.
  if (ids.some((id) => isOwnRecord(ctx.actorEmployeeId, id))) {
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'TARGETS', recordId: ctx.actorEmployeeId, result: DENIED_SELF });
    throw new UserFacingError('You cannot set your own targets; ask someone else to.');
  }
  const inScope = new Set((await letterRepo.findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))).map((e) => e.id));
  if (ids.some((id) => !inScope.has(id))) throw new TargetValidationError({ employeeIds: 'Someone chosen is not in your scope.' });

  const have = await repo.existingTitles(ids, form.periodKind, form.fy, form.monthNo);
  const fresh = ids.filter((id) => !have.has(`${id}|${form.title.toLowerCase()}`));
  const created = await repo.insertTargets(
    fresh.map((employeeId) => ({
      employeeId,
      periodKind: form.periodKind,
      fy: form.fy,
      monthNo: form.monthNo,
      title: form.title,
      unit: form.unit,
      targetValue: form.targetValue.toFixed(2),
      weight: form.weight.toFixed(2),
    })),
    ctx.userId,
  );
  return { created, skipped: ids.length - fresh.length };
}

export async function updateTarget(id: string, raw: unknown, ctx: TargetCtx): Promise<TargetRow> {
  const target = await repo.findTarget(id, buildEmployeeScopeCondition(ctx.scope));
  if (!target) throw new UserFacingError('Not found: this target is not in your scope.');
  if (isOwnRecord(ctx.actorEmployeeId, target.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'TARGETS', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('Your own targets must be changed by someone else.');
  }
  const form = normalizeTargetForm({ ...(raw as object), employeeId: target.employeeId, periodKind: target.periodKind, fy: target.fy, monthNo: target.monthNo });
  const errors = validateTargetForm(form);
  if (Object.keys(errors).length) throw new TargetValidationError(errors);
  const row = await repo.updateOpenTarget(id, { title: form.title, unit: form.unit, targetValue: form.targetValue.toFixed(2), weight: form.weight.toFixed(2) }, ctx.userId);
  if (!row) throw new UserFacingError('This target has already been reported on, so it can no longer be changed.');
  return (await rowsFor([{ ...target, ...row }]))[0];
}

export async function deleteTarget(id: string, ctx: TargetCtx): Promise<void> {
  const target = await repo.findTarget(id, buildEmployeeScopeCondition(ctx.scope));
  if (!target) throw new UserFacingError('Not found: this target is not in your scope.');
  if (isOwnRecord(ctx.actorEmployeeId, target.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'DELETE', module: 'TARGETS', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('Your own targets must be removed by someone else.');
  }
  if (!(await repo.deleteOpenTarget(id))) throw new UserFacingError('This target has already been reported on, so it can no longer be removed.');
}

/** HR's last step on a forwarded target: close it, or send it back with a reason. */
export async function hrDecide(id: string, decision: 'close' | 'return', reason: unknown, ctx: TargetCtx): Promise<TargetRow> {
  const target = await repo.findTarget(id, buildEmployeeScopeCondition(ctx.scope));
  if (!target) throw new UserFacingError('Not found: this target is not in your scope.');
  if (isOwnRecord(ctx.actorEmployeeId, target.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'APPROVE', module: 'TARGETS', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('Your own achievements must be closed by someone else.');
  }
  const to: TargetStatus = decision === 'close' ? 'closed' : 'returned';
  if (!canMove(target.status, to, 'hr')) throw new UserFacingError(`A ${target.status} target cannot be ${decision === 'close' ? 'closed' : 'returned'} here.`);
  let set: Parameters<typeof repo.claim>[2];
  if (decision === 'close') {
    set = { status: 'closed', closedBy: ctx.userId, closedAt: new Date() };
  } else {
    const problem = validateReturnReason(reason);
    if (problem) throw new TargetValidationError({ reason: problem });
    set = { status: 'returned', returnReason: String(reason).trim().slice(0, 500) };
  }
  const row = await repo.claim(id, ['forwarded'], set, ctx.userId);
  if (!row) throw new UserFacingError('Someone already moved this target — refresh.');
  return (await rowsFor([{ ...target, ...row }]))[0];
}

// ---- portal: the employee ----------------------------------------------------

export async function myTargets(me: PortalCtx): Promise<MyTargetsData> {
  const [records, existing] = await Promise.all([repo.listTargets({ employeeId: me.employeeId }), repo.distinctFiscalYears()]);
  const rows = await rowsFor(records);
  const years = fiscalYearOptions(existing);
  return { rows, scores: scoresOf(rows), fiscalYears: years.options, currentFy: years.current };
}

async function ownTarget(id: string, me: PortalCtx): Promise<repo.TargetWithPerson> {
  const target = await repo.findTarget(id);
  // Someone else's target reads as not found.
  if (!target || target.employeeId !== me.employeeId) throw new UserFacingError('Not found: this target does not exist.');
  return target;
}

/** The employee writes (or rewrites) what they achieved while it is still theirs to edit. */
export async function saveMyAchievement(id: string, raw: unknown, attachmentIds: unknown, me: PortalCtx): Promise<TargetRow> {
  const target = await ownTarget(id, me);
  if (!employeeCanEdit(target.status)) throw new UserFacingError('This achievement has been submitted; it can be changed only if your supervisor returns it.');
  const form = normalizeAchievementForm(raw);
  const errors = validateAchievementForm(form);
  if (Object.keys(errors).length) throw new TargetValidationError(errors);
  const staged = [...new Set((Array.isArray(attachmentIds) ? attachmentIds : []).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64))];
  if ((await repo.countAttached(id)) + staged.length > TARGET_ATTACHMENT_MAX) {
    throw new TargetValidationError({ attachments: `At most ${TARGET_ATTACHMENT_MAX} files can be attached.` });
  }
  const row = await repo.claim(id, ['set', 'returned'], { achievedValue: form.achievedValue.toFixed(2), achievedNote: form.note || null }, me.userId, me.employeeId);
  if (!row) throw new UserFacingError('This achievement was just moved on — refresh.');
  await repo.linkStaged(staged, id, me.userId);
  return (await rowsFor([{ ...target, ...row }]))[0];
}

/** Sends the employee's reported achievements for the chosen targets to the supervisor. */
export async function submitMyTargets(ids: unknown, me: PortalCtx): Promise<{ submitted: number }> {
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64))];
  if (!list.length) throw new TargetValidationError({ ids: 'Choose at least one target.' });
  let submitted = 0;
  for (const id of list) {
    const target = await ownTarget(id, me);
    if (!canMove(target.status, 'submitted', 'employee')) continue;
    if (target.achievedValue === null) throw new UserFacingError(`Enter what you achieved for "${target.title}" first.`);
    const row = await repo.claim(id, ['set', 'returned'], { status: 'submitted', submittedAt: new Date(), returnReason: null, reviewerNote: null, verifiedValue: null }, me.userId, me.employeeId);
    if (row) submitted += 1;
  }
  return { submitted };
}

export async function removeMyAttachment(attachmentId: string, me: PortalCtx): Promise<void> {
  const file = await repo.findAttachment(attachmentId);
  if (!file) throw new UserFacingError('Not found: this file no longer exists.');
  if (file.targetId === null) {
    if (!(await repo.deleteStaged(attachmentId, me.userId))) throw new UserFacingError('Not found: this file no longer exists.');
    return;
  }
  const target = await ownTarget(file.targetId, me);
  if (!employeeCanEdit(target.status)) throw new UserFacingError('Files cannot be removed after the achievement is submitted.');
  await repo.deleteAttachment(attachmentId, target.id);
}

export interface UploadInput {
  bytes: Uint8Array;
  name: string;
}

/** Stages one evidence file for the signed-in employee; it is attached when the achievement is saved. */
export async function uploadEvidence(input: UploadInput, me: PortalCtx): Promise<TargetAttachmentRef> {
  const problem = fileProblem(input.bytes.length);
  if (problem) throw new UserFacingError(problem);
  if (input.bytes.length > DOCUMENT_MAX_BYTES) throw new UserFacingError('The file is larger than 3 MB.');
  const mime = sniffFileType(input.bytes);
  if (!mime) throw new UserFacingError('Only PDF, JPG or PNG files can be attached.');
  await repo.pruneStaged();
  if ((await repo.countStagedBy(me.userId)) >= MAX_STAGED_PER_USER) throw new UserFacingError('Too many files are waiting to be saved. Save the achievement first.');
  const content = Buffer.from(input.bytes);
  const name = safeFileName(input.name, mime);
  const ref = await repo.insertStaged({ fileName: name, mime, size: content.length, content, uploadedBy: me.userId });
  await recordAuditLog({
    userId: me.userId,
    action: 'ADD',
    module: 'TARGETS',
    recordId: me.employeeId,
    result: 'SUCCESS',
    newValues: { evidence: 'uploaded', fileId: ref.id, sizeBytes: ref.size, mimeType: ref.mime, sha256: createHash('sha256').update(content).digest('hex').slice(0, 12) },
  });
  return { id: ref.id, name: ref.fileName, mime: ref.mime, size: ref.size };
}

// ---- portal: the supervisor --------------------------------------------------

export async function hasTeam(me: PortalCtx): Promise<boolean> {
  return repo.hasReports(me.employeeId);
}

/** The targets of the people who report to the signed-in supervisor (never their own). */
export async function teamTargets(me: PortalCtx): Promise<MyTargetsData> {
  const [records, existing] = await Promise.all([repo.listTargets({ supervisorId: me.employeeId }), repo.distinctFiscalYears()]);
  const rows = await rowsFor(records.filter((r) => r.employeeId !== me.employeeId));
  const years = fiscalYearOptions(existing);
  return { rows, scores: scoresOf(rows), fiscalYears: years.options, currentFy: years.current };
}

export interface SupervisorDecision {
  decision: 'forward' | 'return';
  verifiedValue?: unknown;
  note?: unknown;
}

/** The assigned supervisor verifies the figure and forwards it to HR, or returns it with a reason. */
export async function supervisorDecide(id: string, input: SupervisorDecision, me: PortalCtx): Promise<TargetRow> {
  const target = await repo.findTarget(id);
  // Only the person's own supervisor; anyone else reads as not found.
  if (!target || target.supervisorId !== me.employeeId) throw new UserFacingError('Not found: this target is not on your team.');
  if (isOwnRecord(me.employeeId, target.employeeId)) {
    await recordAuditLog({ userId: me.userId, action: 'APPROVE', module: 'TARGETS', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('Your own achievements must be reviewed by someone else.');
  }
  const to: TargetStatus = input.decision === 'forward' ? 'forwarded' : 'returned';
  if (!canMove(target.status, to, 'supervisor')) throw new UserFacingError(`A ${target.status} target cannot be ${input.decision === 'forward' ? 'forwarded' : 'returned'}.`);
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : '';

  let set: Parameters<typeof repo.claim>[2];
  if (input.decision === 'forward') {
    const verified = input.verifiedValue === undefined || input.verifiedValue === null || input.verifiedValue === '' ? target.achievedValue : String(input.verifiedValue);
    const v = Number(verified);
    if (verified === null || !Number.isFinite(v) || v < 0) throw new TargetValidationError({ verifiedValue: 'Enter the verified figure (zero or more).' });
    set = { status: 'forwarded', verifiedValue: v.toFixed(2), reviewerNote: note || null, reviewedBy: me.userId, reviewedAt: new Date() };
  } else {
    const problem = validateReturnReason(note);
    if (problem) throw new TargetValidationError({ note: problem });
    set = { status: 'returned', returnReason: note, reviewedBy: me.userId, reviewedAt: new Date() };
  }
  const row = await repo.claim(id, ['submitted'], set, me.userId);
  if (!row) throw new UserFacingError('Someone already moved this target — refresh.');
  return (await rowsFor([{ ...target, ...row }]))[0];
}

// ---- evidence download -------------------------------------------------------

export interface Viewer {
  userId: string;
  employeeId: string | null;
  scope: ScopeFilter | null;
}

export interface OpenedEvidence {
  name: string;
  mime: string;
  content: Buffer;
}

/**
 * One evidence file, for the employee it belongs to, their supervisor, or an
 * office user with TARGETS view in scope. Everyone else (and an unsaved
 * upload, except for its uploader) reads as not found.
 */
export async function openEvidence(fileId: unknown, viewer: Viewer): Promise<OpenedEvidence | null> {
  if (typeof fileId !== 'string' || fileId.length === 0 || fileId.length > 64) return null;
  const file = await repo.findAttachment(fileId);
  if (!file) return null;
  let allowed = false;
  if (file.targetId === null) {
    allowed = file.uploadedBy === viewer.userId;
  } else {
    const target = await repo.findTarget(file.targetId);
    if (!target) return null;
    allowed =
      (!!viewer.employeeId && (target.employeeId === viewer.employeeId || target.supervisorId === viewer.employeeId)) ||
      (!!viewer.scope && (await repo.employeeInScope(target.employeeId, buildEmployeeScopeCondition(viewer.scope))));
  }
  if (!allowed) return null;
  const content = await repo.findAttachmentContent(fileId);
  return content ? { name: file.fileName, mime: file.mime, content } : null;
}

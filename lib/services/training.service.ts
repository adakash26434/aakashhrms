import * as repo from '@/lib/repositories/training.repository';
import * as letterRepo from '@/lib/repositories/letter.repository';
import {
  PROGRAM_KINDS,
  acceptsNominations,
  bondEnds,
  canMoveProgram,
  nextProgramStatuses,
  normalizeMarkForm,
  normalizeProgramForm,
  validateMark,
  validateProgramForm,
} from '@/lib/engines/training.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import type { ParticipantRow, ProgramDetail, ProgramRow, TrainingPageData } from '@/lib/types/training';

// Training (G7): orchestration. Status moves are claim-first. S35 (the S21
// pattern): nobody nominates themselves or marks their own attendance, score
// or completion — a person cannot certify their own training.

export class TrainingValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'TrainingValidationError';
  }
}

export interface TrainingCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

const asStatus = (s: string): ProgramRow['status'] => (s === 'running' || s === 'completed' || s === 'cancelled' ? s : 'planned');

function toRow(p: repo.ProgramWithCounts | repo.ProgramRecord, nominated = 0, completed = 0): ProgramRow {
  const counts = p as Partial<repo.ProgramWithCounts>;
  return {
    id: p.id,
    title: p.title,
    provider: p.provider,
    kind: p.kind,
    kindName: PROGRAM_KINDS.find((k) => k.code === p.kind)?.name ?? p.kind,
    startAd: p.startAd,
    endAd: p.endAd,
    hours: Number(p.hours),
    cost: Number(p.cost),
    bondMonths: p.bondMonths,
    note: p.note,
    status: asStatus(p.status),
    nominated: counts.nominated ?? nominated,
    completed: counts.completed ?? completed,
  };
}

export async function trainingPage(ctx: TrainingCtx, permissions: TrainingPageData['permissions']): Promise<TrainingPageData> {
  const [programs, employees] = await Promise.all([repo.listPrograms(), letterRepo.findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))]);
  return { programs: programs.map((p) => toRow(p)), employees, permissions };
}

export async function getProgram(id: string, ctx: TrainingCtx): Promise<ProgramDetail | null> {
  const program = await repo.findProgram(id);
  if (!program) return null;
  const people = await repo.participants(id, buildEmployeeScopeCondition(ctx.scope));
  const rows: ParticipantRow[] = people.map((p) => ({
    id: p.id,
    employeeId: p.employeeId,
    employeeName: p.employeeName,
    employeeCode: p.employeeCode,
    branch: p.branch,
    status: p.status === 'attended' || p.status === 'absent' || p.status === 'completed' ? p.status : 'nominated',
    score: p.score === null ? null : Number(p.score),
    certificateNo: p.certificateNo,
    bondEndsAd: p.status === 'completed' ? bondEnds(program.endAd, program.bondMonths) : null,
  }));
  return {
    ...toRow(program, rows.length, rows.filter((r) => r.status === 'completed').length),
    participants: rows,
    next: nextProgramStatuses(program.status),
  };
}

export async function saveProgram(id: string | null, raw: unknown, ctx: TrainingCtx): Promise<ProgramRow> {
  const form = normalizeProgramForm(raw);
  const errors = validateProgramForm(form);
  if (Object.keys(errors).length) throw new TrainingValidationError(errors);
  const write: repo.ProgramWrite = {
    title: form.title,
    provider: form.provider,
    kind: form.kind,
    startAd: form.startAd,
    endAd: form.endAd,
    hours: form.hours.toFixed(2),
    cost: form.cost.toFixed(2),
    bondMonths: form.bondMonths,
    note: form.note || null,
  };
  if (id) {
    const row = await repo.updateProgram(id, write, ctx.userId);
    if (!row) throw new UserFacingError('This programme can no longer be edited (it has completed or been cancelled).');
    return toRow(row);
  }
  return toRow(await repo.insertProgram(write, ctx.userId));
}

export async function moveProgram(id: string, to: string, ctx: TrainingCtx): Promise<ProgramDetail> {
  const program = await repo.findProgram(id);
  if (!program) throw new UserFacingError('Not found: this programme no longer exists.');
  if (!canMoveProgram(program.status, to)) throw new UserFacingError(`A ${program.status} programme cannot move to ${to}.`);
  if (!(await repo.moveProgram(id, program.status, to, ctx.userId))) throw new UserFacingError('Someone already moved this programme — refresh.');
  return (await getProgram(id, ctx))!;
}

export async function nominate(programId: string, employeeIds: unknown, ctx: TrainingCtx): Promise<{ detail: ProgramDetail; added: number }> {
  const program = await repo.findProgram(programId);
  if (!program) throw new UserFacingError('Not found: this programme no longer exists.');
  if (!acceptsNominations(program.status)) throw new UserFacingError('Nominations are closed for this programme.');
  const ids = [...new Set((Array.isArray(employeeIds) ? employeeIds : []).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64))];
  if (!ids.length) throw new TrainingValidationError({ employeeIds: 'Choose at least one employee.' });

  // S35: nobody nominates themselves.
  if (ids.some((id) => isOwnRecord(ctx.actorEmployeeId, id))) {
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'TRAINING', recordId: programId, result: DENIED_SELF });
    throw new UserFacingError('You cannot nominate yourself; ask someone else to.');
  }
  const inScope = new Set((await letterRepo.findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))).map((e) => e.id));
  if (ids.some((id) => !inScope.has(id))) throw new TrainingValidationError({ employeeIds: 'Someone chosen is not in your scope.' });

  const added = await repo.nominate(programId, ids, ctx.userId);
  return { detail: (await getProgram(programId, ctx))!, added };
}

export async function markParticipant(participantId: string, raw: unknown, ctx: TrainingCtx): Promise<ProgramDetail> {
  const person = await repo.findParticipant(participantId, buildEmployeeScopeCondition(ctx.scope));
  if (!person) throw new UserFacingError('Not found: this participant is not in your scope.');

  // S35: nobody marks their own attendance, score or completion.
  if (isOwnRecord(ctx.actorEmployeeId, person.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'TRAINING', recordId: participantId, result: DENIED_SELF });
    throw new UserFacingError('Your own training record must be marked by someone else.');
  }
  const program = await repo.findProgram(person.programId);
  if (!program) throw new UserFacingError('Not found: this programme no longer exists.');
  const form = normalizeMarkForm(raw);
  const errors = validateMark(program.status, form);
  if (Object.keys(errors).length) throw new TrainingValidationError(errors);

  await repo.markParticipant(participantId, form.status, form.score === null ? null : form.score.toFixed(2), form.certificateNo || null, ctx.userId);
  return (await getProgram(program.id, ctx))!;
}

import * as repo from '@/lib/repositories/case.repository';
import * as letterRepo from '@/lib/repositories/letter.repository';
import {
  acceptsNotes,
  canMove,
  categoryOf,
  nextStatuses,
  normalizeDecisionForm,
  normalizeOpenForm,
  outcomeOf,
  validateDecision,
  validateNote,
  validateOpenForm,
} from '@/lib/engines/case.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import type { CaseDetail, CaseListRow, CasePageData } from '@/lib/types/case';

// Disciplinary & grievance (G8): orchestration. Confidential by design:
// S34 (the S21 pattern) — nobody opens, investigates, decides, notes or closes
// a case about themselves, and a case about you never appears in your own
// register. Every status change is claim-first, so two people cannot both move
// it; every step lands in the append-only timeline. Termination is only ever
// recommended — the exit itself is the exit workflow's (G5).

export class CaseValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'CaseValidationError';
  }
}

export interface CaseCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

const asStatus = (s: string): CaseListRow['status'] => (s === 'investigating' || s === 'decided' || s === 'closed' ? s : 'open');
const asSeverity = (s: string): CaseListRow['severity'] => (s === 'major' || s === 'serious' ? s : 'minor');

function toListRow(r: repo.CaseJoinedRow): CaseListRow {
  return {
    id: r.id,
    category: r.category === 'grievance' ? 'grievance' : 'disciplinary',
    categoryName: categoryOf(r.category)?.name ?? r.category,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    severity: asSeverity(r.severity),
    title: r.title,
    status: asStatus(r.status),
    outcome: r.outcome,
    outcomeName: r.outcome ? outcomeOf(r.category, r.outcome)?.name ?? r.outcome : null,
    openedAt: r.openedAt.toISOString(),
    openedByName: r.openedByName ?? '—',
  };
}

/** S34: a case about the acting user's own record is invisible to them. */
const hiddenFromActor = (ctx: CaseCtx, employeeId: string) => isOwnRecord(ctx.actorEmployeeId, employeeId);

async function denySelf(ctx: CaseCtx, recordId: string, action: 'ADD' | 'EDIT' | 'APPROVE'): Promise<never> {
  await recordAuditLog({ userId: ctx.userId, action, module: 'DISCIPLINE', recordId, result: DENIED_SELF });
  throw new UserFacingError('A case about your own record must be handled by someone else.');
}

export async function casePage(ctx: CaseCtx, permissions: CasePageData['permissions']): Promise<CasePageData> {
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const [rows, employees] = await Promise.all([repo.listCases(scopeCondition), letterRepo.findEmployeeOptions(scopeCondition)]);
  return {
    cases: rows.filter((r) => !hiddenFromActor(ctx, r.employeeId)).map(toListRow),
    employees: employees.filter((e) => !isOwnRecord(ctx.actorEmployeeId, e.id)),
    permissions,
  };
}

async function detailOf(row: repo.CaseJoinedRow): Promise<CaseDetail> {
  const events = await repo.eventsFor(row.id);
  const decider = row.decidedBy ? (await repo.userNames([row.decidedBy])).get(row.decidedBy) ?? '—' : null;
  return {
    ...toListRow(row),
    description: row.description,
    outcomeNote: row.outcomeNote,
    decidedByName: decider,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    events: events.map((e) => ({ id: e.id, kind: e.kind, text: e.text, actorName: e.actorName ?? '—', at: e.at.toISOString() })),
    next: nextStatuses(row.status),
  };
}

async function loadInScope(id: string, ctx: CaseCtx, audit?: 'EDIT' | 'APPROVE'): Promise<repo.CaseJoinedRow> {
  const row = await repo.findCase(id, buildEmployeeScopeCondition(ctx.scope));
  if (row && audit && hiddenFromActor(ctx, row.employeeId)) await denySelf(ctx, id, audit);
  // Same answer for "missing", "out of scope" and "about you": nothing to see.
  if (!row || hiddenFromActor(ctx, row.employeeId)) throw new UserFacingError('Not found: this case is not in your scope.');
  return row;
}

export async function getCase(id: string, ctx: CaseCtx): Promise<CaseDetail | null> {
  try {
    return await detailOf(await loadInScope(id, ctx));
  } catch (error: unknown) {
    if (error instanceof UserFacingError) return null;
    throw error;
  }
}

export async function openCase(raw: unknown, ctx: CaseCtx): Promise<CaseListRow> {
  const form = normalizeOpenForm(raw);
  if (form.employeeId && isOwnRecord(ctx.actorEmployeeId, form.employeeId)) await denySelf(ctx, form.employeeId, 'ADD');
  const errors = validateOpenForm(form);
  if (Object.keys(errors).length) throw new CaseValidationError(errors);

  const inScope = (await letterRepo.findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))).some((e) => e.id === form.employeeId);
  if (!inScope) throw new CaseValidationError({ employeeId: 'This employee is not in your scope.' });

  const row = await repo.openCaseTx({
    category: form.category,
    employeeId: form.employeeId,
    severity: form.severity,
    title: form.title,
    description: form.description,
    openedBy: ctx.userId,
  });
  const found = await repo.findCase(row.id);
  return toListRow(found!);
}

export async function investigate(id: string, ctx: CaseCtx): Promise<CaseDetail> {
  const row = await loadInScope(id, ctx, 'EDIT');
  if (!canMove(row.status, 'investigating')) throw new UserFacingError('This case is not open for investigation.');
  const moved = await repo.moveStatusTx(id, row.status, 'investigating', ctx.userId);
  if (!moved) throw new UserFacingError('Someone already moved this case — refresh.');
  return detailOf((await repo.findCase(id))!);
}

export async function decide(id: string, raw: unknown, ctx: CaseCtx): Promise<CaseDetail> {
  const row = await loadInScope(id, ctx, 'APPROVE');
  if (!canMove(row.status, 'decided')) throw new UserFacingError('This case cannot be decided in its current state.');
  const form = normalizeDecisionForm(raw);
  const errors = validateDecision(row.category, row.severity, form);
  if (Object.keys(errors).length) throw new CaseValidationError(errors);
  const label = outcomeOf(row.category, form.outcome)!.name;
  const done = await repo.decideTx(id, row.status, form.outcome, label, form.note, ctx.userId);
  if (!done) throw new UserFacingError('Someone already decided this case — refresh.');
  return detailOf((await repo.findCase(id))!);
}

export async function closeCase(id: string, ctx: CaseCtx): Promise<CaseDetail> {
  const row = await loadInScope(id, ctx, 'EDIT');
  if (!canMove(row.status, 'closed')) throw new UserFacingError('Only a decided case can be closed.');
  const done = await repo.closeTx(id, ctx.userId);
  if (!done) throw new UserFacingError('Someone already closed this case — refresh.');
  return detailOf((await repo.findCase(id))!);
}

export async function addCaseNote(id: string, text: string, ctx: CaseCtx): Promise<CaseDetail> {
  const row = await loadInScope(id, ctx, 'EDIT');
  if (!acceptsNotes(row.status)) throw new UserFacingError('A closed case takes no more notes.');
  const problem = validateNote(text);
  if (problem) throw new CaseValidationError({ note: problem });
  await repo.addNote(id, text.trim(), ctx.userId);
  return detailOf(row);
}

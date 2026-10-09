import * as repo from '@/lib/repositories/exit.repository';
import * as letterRepo from '@/lib/repositories/letter.repository';
import * as letterService from '@/lib/services/letter.service';
import {
  CLEARANCE_UNITS,
  clearanceProgress,
  clearanceUnit,
  completionBlockers,
  exitKind,
  normalizeExitForm,
  terminationMirror,
  validateCancelReason,
  validateClearanceDecision,
  validateExitForm,
  type ExitKind,
} from '@/lib/engines/exit.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import { adToBSString } from '@/lib/utils/bs-calendar';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import type { ExitDetail, ExitListRow, ExitPageData } from '@/lib/types/exit';

// Exit workflow (G5): orchestration. Opening seeds the clearance checklist;
// Complete is the only step that touches the employee record (Inactive + the
// employee_termination mirror, one transaction, claim-first). S31 (the S21
// pattern): nobody opens, clears, completes or cancels their own exit case.

export class ExitValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'ExitValidationError';
  }
}

export interface ExitCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

const toListRow = (r: repo.ExitJoinedRow, progress: { cleared: number; blocked: number; total: number }): ExitListRow => {
  const kind = exitKind(r.kind);
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    kind: r.kind,
    kindName: kind?.name ?? r.kind,
    kindNameNp: kind?.nameNp ?? '',
    noticeDate: r.noticeDate,
    lastWorkingDayAd: r.lastWorkingDayAd,
    lastWorkingDayBs: r.lastWorkingDayBs,
    reason: r.reason,
    status: r.status === 'closed' ? 'closed' : r.status === 'cancelled' ? 'cancelled' : 'open',
    cleared: progress.cleared,
    blocked: progress.blocked,
    totalUnits: progress.total,
    letterId: r.letterId,
    letterNumber: r.letterNumber,
    openedByName: r.openedByName ?? '—',
    cancelReason: r.cancelReason,
  };
};

export async function exitPage(ctx: ExitCtx, permissions: ExitPageData['permissions'], filter: repo.ExitFilter = {}): Promise<ExitPageData> {
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const [cases, employees] = await Promise.all([repo.listCases(filter, scopeCondition), letterRepo.findEmployeeOptions(scopeCondition)]);
  const rows: ExitListRow[] = [];
  for (const c of cases) {
    if (c.status !== 'open') {
      rows.push(toListRow(c, { cleared: CLEARANCE_UNITS.length, blocked: 0, total: CLEARANCE_UNITS.length }));
      continue;
    }
    const clearances = (await repo.findClearances(c.id)).map((x) => ({
      unit: x.unit,
      status: (x.status === 'cleared' ? 'cleared' : x.status === 'blocked' ? 'blocked' : 'pending') as 'pending' | 'cleared' | 'blocked',
    }));
    rows.push(toListRow(c, clearanceProgress(clearances)));
  }
  return { cases: rows, employees, permissions };
}

async function caseDetail(row: repo.ExitJoinedRow): Promise<ExitDetail> {
  const today = toIsoDate(nepalToday());
  const clearances = await repo.findClearances(row.id);
  const names = new Map<string, string>();
  const deciderIds = [...new Set(clearances.map((c) => c.decidedBy).filter((x): x is string => !!x))];
  if (deciderIds.length) {
    const { userNames } = await import('@/lib/repositories/evaluation.repository');
    for (const [id, name] of await userNames(deciderIds)) names.set(id, name);
  }
  const states = clearances.map((c) => ({ unit: c.unit, status: (c.status === 'cleared' ? 'cleared' : c.status === 'blocked' ? 'blocked' : 'pending') as 'pending' | 'cleared' | 'blocked' }));
  return {
    ...toListRow(row, clearanceProgress(states)),
    clearances: clearances
      .map((c) => {
        const unit = clearanceUnit(c.unit);
        return {
          unit: c.unit,
          unitName: unit?.name ?? c.unit,
          unitNameNp: unit?.nameNp ?? '',
          hint: unit?.hint ?? '',
          status: (c.status === 'cleared' ? 'cleared' : c.status === 'blocked' ? 'blocked' : 'pending') as 'pending' | 'cleared' | 'blocked',
          note: c.note,
          decidedByName: c.decidedBy ? names.get(c.decidedBy) ?? '—' : null,
        };
      })
      .sort((a, b) => CLEARANCE_UNITS.findIndex((u) => u.code === a.unit) - CLEARANCE_UNITS.findIndex((u) => u.code === b.unit)),
    blockers: row.status === 'open' ? completionBlockers(states, row.lastWorkingDayAd, today) : [],
    facts: await repo.exitFacts(row.employeeId, row.lastWorkingDayAd),
  };
}

export async function getExitCase(id: string, ctx: ExitCtx): Promise<ExitDetail | null> {
  const row = await repo.findCase(id, buildEmployeeScopeCondition(ctx.scope));
  return row ? caseDetail(row) : null;
}

export async function openExitCase(raw: unknown, ctx: ExitCtx): Promise<ExitListRow> {
  const form = normalizeExitForm(raw);

  // S31: your own exit is someone else's to process.
  if (isOwnRecord(ctx.actorEmployeeId, form.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: form.employeeId, result: DENIED_SELF });
    throw new UserFacingError('Your own exit case must be handled by someone else.');
  }

  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const employee = form.employeeId ? await letterRepo.findEmployeeForLetter(form.employeeId, scopeCondition) : null;
  const subject = employee ? { id: employee.id, status: employee.status, hasOpenCase: await repo.hasOpenCase(employee.id) } : null;
  const errors = validateExitForm(form, subject, toIsoDate(nepalToday()));
  if (Object.keys(errors).length) throw new ExitValidationError(errors);

  const row = await repo.openCaseTx({
    employeeId: form.employeeId,
    kind: form.kind,
    noticeDate: form.noticeDate || null,
    lastWorkingDayAd: form.lastWorkingDayAd,
    lastWorkingDayBs: adToBSString(new Date(`${form.lastWorkingDayAd}T00:00:00`)),
    reason: form.reason || null,
    openedBy: ctx.userId,
  });
  const saved = await repo.findCase(row.id);
  return toListRow(saved!, { cleared: 0, blocked: 0, total: CLEARANCE_UNITS.length });
}

export async function decideClearance(id: string, unit: string, status: string, note: string, ctx: ExitCtx): Promise<ExitDetail> {
  const errors = validateClearanceDecision(status, note ?? '');
  if (Object.keys(errors).length) throw new ExitValidationError(errors);

  const existing = await repo.findCase(id, buildEmployeeScopeCondition(ctx.scope));
  if (!existing) throw new UserFacingError('Not found: this exit case is not in your scope.');
  if (existing.status !== 'open') throw new UserFacingError('This case is no longer open.');
  if (!clearanceUnit(unit)) throw new UserFacingError('Unknown clearance unit.');

  // S31: clearances on your own exit are someone else's.
  if (isOwnRecord(ctx.actorEmployeeId, existing.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('Your own exit case must be handled by someone else.');
  }

  await repo.decideClearance(id, unit, status as 'pending' | 'cleared' | 'blocked', note?.trim() || null, ctx.userId);
  const saved = await repo.findCase(id);
  return caseDetail(saved!);
}

export interface CompleteOptions {
  issueLetter: boolean;
  letterLanguage: 'en' | 'np';
}

export async function completeExitCase(id: string, options: CompleteOptions, ctx: ExitCtx): Promise<{ detail: ExitDetail; letterWarning: string | null }> {
  const existing = await repo.findCase(id, buildEmployeeScopeCondition(ctx.scope));
  if (!existing) throw new UserFacingError('Not found: this exit case is not in your scope.');
  if (existing.status !== 'open') throw new UserFacingError('This case is no longer open.');

  // S31: completing your own exit is refused.
  if (isOwnRecord(ctx.actorEmployeeId, existing.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('Your own exit case must be handled by someone else.');
  }

  const today = toIsoDate(nepalToday());
  const clearances = (await repo.findClearances(id)).map((c) => ({ unit: c.unit, status: (c.status === 'cleared' ? 'cleared' : c.status === 'blocked' ? 'blocked' : 'pending') as 'pending' | 'cleared' | 'blocked' }));
  const { funds } = await repo.exitFacts(existing.employeeId, existing.lastWorkingDayAd);
  const blockers = completionBlockers(clearances, existing.lastWorkingDayAd, today, funds.map((f) => f.fund));
  if (blockers.length) throw new UserFacingError(`Not yet: ${blockers[0]}`);

  // The experience letter needs the employee row, so it is rendered BEFORE
  // the employee goes Inactive (letters list active employees only).
  let letterWarning: string | null = null;
  let letterId: string | null = null;
  if (options.issueLetter) {
    try {
      const templates = await letterRepo.findTemplates();
      const template = templates.find((t) => t.code === 'experience' && t.isActive);
      if (!template) throw new UserFacingError('No active experience-letter template.');
      const letter = await letterService.issueLetter(
        {
          employeeId: existing.employeeId,
          templateId: template.id,
          language: options.letterLanguage,
          inputs: { last_working_day: `${existing.lastWorkingDayBs} (${existing.lastWorkingDayAd})` },
        },
        ctx,
      );
      letterId = letter.id;
    } catch (error: unknown) {
      letterWarning =
        error instanceof UserFacingError
          ? `Exit completed, but the letter was not issued: ${error.message}`
          : error instanceof letterService.LetterValidationError
            ? `Exit completed, but the letter was not issued: ${Object.values(error.errors)[0] ?? 'check the template.'}`
            : 'Exit completed, but the letter was not issued — issue it from HR letters.';
    }
  }

  const mirror = terminationMirror(existing.kind as ExitKind, {
    noticeDate: existing.noticeDate ?? '',
    lastWorkingDayAd: existing.lastWorkingDayAd,
    reason: existing.reason ?? '',
  });
  const result = await repo.completeCaseTx(id, existing.employeeId, mirror, ctx.userId);
  if (result === 'stale') throw new UserFacingError('Someone already closed this case — refresh.');
  if (letterId) await repo.setCaseLetter(id, letterId);

  const saved = await repo.findCase(id);
  return { detail: await caseDetail(saved!), letterWarning };
}

export async function cancelExitCase(id: string, reason: string, ctx: ExitCtx): Promise<ExitDetail> {
  const reasonError = validateCancelReason(reason ?? '');
  if (reasonError) throw new ExitValidationError({ reason: reasonError });

  const existing = await repo.findCase(id, buildEmployeeScopeCondition(ctx.scope));
  if (!existing) throw new UserFacingError('Not found: this exit case is not in your scope.');
  if (existing.status !== 'open') throw new UserFacingError('Only an open case can be cancelled.');

  if (isOwnRecord(ctx.actorEmployeeId, existing.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('Your own exit case must be handled by someone else.');
  }

  const row = await repo.cancelCase(id, reason.trim(), ctx.userId);
  if (!row) throw new UserFacingError('This case is no longer open.');
  const saved = await repo.findCase(id);
  return caseDetail(saved!);
}

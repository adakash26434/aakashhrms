import * as repo from '@/lib/repositories/employee-event.repository';
import * as letterRepo from '@/lib/repositories/letter.repository';
import * as letterService from '@/lib/services/letter.service';
import { findAllDesignations } from '@/lib/repositories/designation.repository';
import { findAllBranches } from '@/lib/repositories/branch.repository';
import { findAllDepartments } from '@/lib/repositories/department.repository';
import {
  EVENT_KINDS,
  buildEventChanges,
  describeChange,
  eventKind,
  initialStatus,
  letterInputsForEvent,
  normalizeEventForm,
  validateCancelReason,
  validateEventForm,
  type EventKind,
} from '@/lib/engines/employee-event.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import { adToBSString } from '@/lib/utils/bs-calendar';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import type { CreateEventResult, EventListRow, EventsPageData } from '@/lib/types/employee-event';

// Lifecycle events (G2): promotion / transfer / confirmation recorded as
// dated events with before/after snapshots. S27 (the S21 pattern): nobody
// records an event about their own record. Due events are applied on read.

export class EventValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'EventValidationError';
  }
}

export interface EventCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

const toListRow = (r: repo.EventJoinedRow): EventListRow => {
  const kind = eventKind(r.kind);
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    kind: r.kind,
    kindName: kind?.name ?? r.kind,
    kindNameNp: kind?.nameNp ?? '',
    change: describeChange(r.kind, (r.fromValues ?? {}) as Record<string, string>, (r.toValues ?? {}) as Record<string, string>),
    effectiveDateAd: r.effectiveDateAd,
    effectiveDateBs: r.effectiveDateBs,
    reason: r.reason,
    status: r.status === 'scheduled' ? 'scheduled' : r.status === 'cancelled' ? 'cancelled' : 'applied',
    letterId: r.letterId,
    createdByName: r.createdByName ?? '—',
    cancelReason: r.cancelReason,
  };
};

/** The employee patch stored in toValues (ids only; display names are history). */
function patchFromEvent(event: repo.EmployeeEventRow): repo.EmployeePatch {
  const to = (event.toValues ?? {}) as Record<string, string>;
  const patch: repo.EmployeePatch = {};
  if (event.kind === 'promotion' && to.designationId) patch.designationId = to.designationId;
  if (event.kind === 'transfer') {
    if (to.branchId) patch.branchId = to.branchId;
    if (to.departmentId) patch.departmentId = to.departmentId;
  }
  if (event.kind === 'confirmation') {
    patch.category = 'Permanent';
    if (to.confirmationDate) patch.confirmationDate = to.confirmationDate;
  }
  return patch;
}

/** Applies every scheduled event now due (called on each register read). */
export async function applyDueEvents(): Promise<number> {
  return repo.applyDueEvents(toIsoDate(nepalToday()), patchFromEvent);
}

export async function eventsPage(
  scope: ScopeFilter,
  permissions: { add: boolean; cancel: boolean; issueLetter: boolean },
  filter: repo.EventFilter = {},
): Promise<EventsPageData> {
  await applyDueEvents();
  const scopeCondition = buildEmployeeScopeCondition(scope);
  const [events, employees, designations, branches, departments, counts] = await Promise.all([
    repo.listEvents(filter, scopeCondition),
    letterRepo.findEmployeeOptions(scopeCondition),
    findAllDesignations(),
    findAllBranches(),
    findAllDepartments(),
    repo.countEvents(scopeCondition),
  ]);
  return {
    events: events.map(toListRow),
    employees,
    designations: designations.map((d) => ({ id: d.id, name: d.name })),
    branches: branches.filter((b) => b.status === 'active').map((b) => ({ id: b.id, name: b.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    scheduled: counts.scheduled,
    permissions,
  };
}

export async function createEvent(raw: unknown, ctx: EventCtx): Promise<CreateEventResult> {
  const form = normalizeEventForm(raw);

  // S27: nobody records a promotion, transfer or confirmation about themselves.
  if (isOwnRecord(ctx.actorEmployeeId, form.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: form.employeeId, result: DENIED_SELF });
    throw new UserFacingError('An event about your own record must be recorded by someone else.');
  }

  const employee = form.employeeId ? await repo.findEmployeeSnapshot(form.employeeId, buildEmployeeScopeCondition(ctx.scope)) : null;
  const today = toIsoDate(nepalToday());
  const errors = validateEventForm(form, employee, today);
  if (Object.keys(errors).length) throw new EventValidationError(errors);
  const kind = form.kind as EventKind;

  const [designations, branches, departments] = await Promise.all([findAllDesignations(), findAllBranches(), findAllDepartments()]);
  const name = (rows: { id: string; name: string }[], id: string, field: string) => {
    const match = rows.find((r) => r.id === id);
    if (!match) throw new EventValidationError({ [field]: 'No longer exists — refresh and try again.' });
    return match.name;
  };
  const changes = buildEventChanges(form, employee!, {
    designation: (id) => name(designations, id, 'toDesignationId'),
    branch: (id) => name(branches, id, 'toBranchId'),
    department: (id) => name(departments, id, 'toDepartmentId'),
  });

  const effectiveDateBs = adToBSString(new Date(`${form.effectiveDateAd}T00:00:00`));
  const row = await repo.insertEventTx(
    {
      employeeId: form.employeeId,
      kind,
      effectiveDateAd: form.effectiveDateAd,
      effectiveDateBs,
      fromValues: changes.from,
      toValues: changes.to,
      reason: form.reason || null,
      status: initialStatus(form.effectiveDateAd, today),
      createdBy: ctx.userId,
    },
    changes.patch,
  );

  // The matching letter, in the chosen language, with the event's own values.
  let letterId: string | null = null;
  let letterWarning: string | null = null;
  if (form.issueLetter) {
    try {
      const templates = await letterRepo.findTemplates();
      const template = templates.find((t) => t.code === eventKind(kind)!.letterTemplate && t.isActive);
      if (!template) throw new UserFacingError('No active letter template for this event.');
      const letter = await letterService.issueLetter(
        {
          employeeId: form.employeeId,
          templateId: template.id,
          language: form.letterLanguage,
          inputs: letterInputsForEvent(kind, changes, effectiveDateBs, form.reason),
        },
        ctx,
      );
      letterId = letter.id;
      await repo.setEventLetter(row.id, letter.id);
    } catch (error: unknown) {
      // The event is saved; the letter can be issued by hand from HR letters.
      letterWarning =
        error instanceof UserFacingError
          ? `Event saved, but the letter was not issued: ${error.message}`
          : error instanceof letterService.LetterValidationError
            ? `Event saved, but the letter was not issued: ${Object.values(error.errors)[0] ?? 'check the template.'}`
            : 'Event saved, but the letter was not issued — issue it from HR letters.';
    }
  }

  const saved = await repo.findEventById(row.id);
  return { event: toListRow(saved!), letterId, letterWarning };
}

export async function cancelScheduledEvent(id: string, reason: string, ctx: EventCtx): Promise<EventListRow> {
  const reasonError = validateCancelReason(reason);
  if (reasonError) throw new EventValidationError({ reason: reasonError });

  const existing = await repo.findEventById(id, buildEmployeeScopeCondition(ctx.scope));
  if (!existing) throw new UserFacingError('Not found: this event is not in your scope.');
  if (existing.status !== 'scheduled') throw new UserFacingError('Only a scheduled event can be cancelled; an applied one is corrected by a new event.');

  // S27: your own event is someone else's to cancel too.
  if (isOwnRecord(ctx.actorEmployeeId, existing.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('An event about your own record must be cancelled by someone else.');
  }

  const row = await repo.cancelEvent(id, reason.trim(), ctx.userId);
  if (!row) throw new UserFacingError('This event was already applied or cancelled.');
  const saved = await repo.findEventById(id);
  return toListRow(saved!);
}

export { EVENT_KINDS };

// Employee lifecycle events (G2, docs/redesign/06-hrms-gap-analysis.md):
// pure rules — no database access, unit-tested in tests/employee-event.test.ts.
//
// Promotion, transfer and confirmation are dated records with before/after
// snapshots. An event due today or earlier is applied to the employee row;
// a future-dated one is 'scheduled' and applied once due. Scheduled events
// can be cancelled; applied ones are corrected by a new event, never edited.

export const EVENT_KINDS = [
  { code: 'promotion', name: 'Promotion', nameNp: 'बढुवा', letterTemplate: 'promotion' },
  { code: 'transfer', name: 'Transfer', nameNp: 'सरुवा', letterTemplate: 'transfer' },
  { code: 'confirmation', name: 'Confirmation', nameNp: 'स्थायी नियुक्ति', letterTemplate: 'confirmation' },
] as const;

export type EventKind = (typeof EVENT_KINDS)[number]['code'];

export const eventKind = (code: string) => EVENT_KINDS.find((k) => k.code === code) ?? null;

/** The employee facts an event reads and may change. */
export interface EmployeeSnapshot {
  id: string;
  fullName: string;
  employeeCode: string;
  designationId: string;
  designation: string;
  departmentId: string;
  department: string;
  branchId: string;
  branch: string;
  category: string;
  confirmationDate: string | null; // YYYY-MM-DD
  status: string;
}

export interface EventForm {
  employeeId: string;
  kind: EventKind | '';
  effectiveDateAd: string; // YYYY-MM-DD
  toDesignationId: string;
  toBranchId: string;
  toDepartmentId: string;
  reason: string;
  /** Issue the matching letter right after the event is saved. */
  issueLetter: boolean;
  letterLanguage: 'en' | 'np';
}

export function normalizeEventForm(raw: unknown): EventForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const kind = EVENT_KINDS.some((k) => k.code === r.kind) ? (r.kind as EventKind) : '';
  return {
    employeeId: s(r.employeeId, 64),
    kind,
    effectiveDateAd: /^\d{4}-\d{2}-\d{2}$/.test(String(r.effectiveDateAd ?? '')) ? String(r.effectiveDateAd) : '',
    toDesignationId: s(r.toDesignationId, 64),
    toBranchId: s(r.toBranchId, 64),
    toDepartmentId: s(r.toDepartmentId, 64),
    reason: s(r.reason, 500),
    issueLetter: r.issueLetter === true,
    letterLanguage: r.letterLanguage === 'np' ? 'np' : 'en',
  };
}

/**
 * Field checks for one event. `today` is the Nepal day (YYYY-MM-DD); an event
 * may be back-dated (the record of something already decided) or scheduled up
 * to one year ahead.
 */
export function validateEventForm(form: EventForm, employee: EmployeeSnapshot | null, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.employeeId || !employee) errors.employeeId = 'Choose an employee.';
  if (!form.kind) errors.kind = 'Choose what happened.';
  if (!form.effectiveDateAd) errors.effectiveDateAd = 'Give the effective date.';
  else {
    const limit = new Date(`${today}T00:00:00`);
    limit.setFullYear(limit.getFullYear() + 1);
    if (new Date(`${form.effectiveDateAd}T00:00:00`) > limit) errors.effectiveDateAd = 'At most one year ahead.';
  }
  if (!employee || !form.kind) return errors;

  if (employee.status !== 'Active') errors.employeeId = 'This employee is not active.';

  if (form.kind === 'promotion') {
    if (!form.toDesignationId) errors.toDesignationId = 'Choose the new designation.';
    else if (form.toDesignationId === employee.designationId) errors.toDesignationId = 'Already their designation.';
  }
  if (form.kind === 'transfer') {
    const branchChanges = form.toBranchId && form.toBranchId !== employee.branchId;
    const departmentChanges = form.toDepartmentId && form.toDepartmentId !== employee.departmentId;
    if (!branchChanges && !departmentChanges) errors.toBranchId = 'A transfer changes the branch, the department, or both.';
  }
  if (form.kind === 'confirmation') {
    if (employee.category === 'Permanent') errors.kind = 'Already permanent.';
  }
  return errors;
}

export interface NameLookup {
  designation: (id: string) => string;
  branch: (id: string) => string;
  department: (id: string) => string;
}

export interface EventChanges {
  /** Ids and display names before, for history. */
  from: Record<string, string>;
  /** Ids and display names after. */
  to: Record<string, string>;
  /** The employees-row update applied on the effective date. */
  patch: Record<string, string>;
}

/** The before/after snapshots and the employee patch for a valid form. */
export function buildEventChanges(form: EventForm, employee: EmployeeSnapshot, names: NameLookup): EventChanges {
  if (form.kind === 'promotion') {
    return {
      from: { designationId: employee.designationId, designation: employee.designation },
      to: { designationId: form.toDesignationId, designation: names.designation(form.toDesignationId) },
      patch: { designationId: form.toDesignationId },
    };
  }
  if (form.kind === 'transfer') {
    const toBranchId = form.toBranchId && form.toBranchId !== employee.branchId ? form.toBranchId : '';
    const toDepartmentId = form.toDepartmentId && form.toDepartmentId !== employee.departmentId ? form.toDepartmentId : '';
    const from: Record<string, string> = {};
    const to: Record<string, string> = {};
    const patch: Record<string, string> = {};
    if (toBranchId) {
      from.branchId = employee.branchId;
      from.branch = employee.branch;
      to.branchId = toBranchId;
      to.branch = names.branch(toBranchId);
      patch.branchId = toBranchId;
    }
    if (toDepartmentId) {
      from.departmentId = employee.departmentId;
      from.department = employee.department;
      to.departmentId = toDepartmentId;
      to.department = names.department(toDepartmentId);
      patch.departmentId = toDepartmentId;
    }
    return { from, to, patch };
  }
  // confirmation
  return {
    from: { category: employee.category, confirmationDate: employee.confirmationDate ?? '' },
    to: { category: 'Permanent', confirmationDate: form.effectiveDateAd },
    patch: { category: 'Permanent', confirmationDate: form.effectiveDateAd },
  };
}

/** 'applied' when due on or before today, else 'scheduled'. */
export function initialStatus(effectiveDateAd: string, today: string): 'applied' | 'scheduled' {
  return effectiveDateAd <= today ? 'applied' : 'scheduled';
}

/**
 * The Issue-window input values for the event's letter, so the letter carries
 * exactly what the event records ({{effective_date}} shown BS first).
 */
export function letterInputsForEvent(
  kind: EventKind,
  changes: Pick<EventChanges, 'from' | 'to'>,
  effectiveDateBs: string,
  reason: string,
): Record<string, string> {
  const inputs: Record<string, string> = { effective_date: effectiveDateBs };
  if (kind === 'promotion') {
    inputs.previous_designation = changes.from.designation ?? '';
    inputs.new_designation = changes.to.designation ?? '';
  }
  if (kind === 'transfer') {
    inputs.previous_branch = changes.from.branch ?? changes.from.department ?? '';
    inputs.new_branch = changes.to.branch ?? changes.to.department ?? '';
  }
  if (reason) inputs.remarks = reason;
  return inputs;
}

/** A one-line "from → to" for the register. */
export function describeChange(kind: string, from: Record<string, string>, to: Record<string, string>): string {
  if (kind === 'promotion') return `${from.designation ?? '—'} → ${to.designation ?? '—'}`;
  if (kind === 'transfer') {
    const parts: string[] = [];
    if (to.branch) parts.push(`${from.branch ?? '—'} → ${to.branch}`);
    if (to.department) parts.push(`${from.department ?? '—'} → ${to.department}`);
    return parts.join(' · ') || '—';
  }
  if (kind === 'confirmation') return `${from.category ?? '—'} → Permanent`;
  return '—';
}

export function validateCancelReason(reason: string): string | null {
  const r = reason.trim();
  if (r.length < 5) return 'Give the reason this event is being cancelled (at least 5 characters).';
  if (r.length > 500) return 'Keep the reason under 500 characters.';
  return null;
}

// Exit workflow (G5, docs/redesign/06-hrms-gap-analysis.md): pure rules —
// no database access, unit-tested in tests/exit.engine.test.ts.
//
// An exit is a case: notice and last working day, a clearance checklist per
// unit, then Complete — the only step that touches the employee record. A
// case completes only when every unit cleared and the last working day has
// arrived; a mistaken case is cancelled while open, never deleted.

export const EXIT_KINDS = [
  { code: 'resignation', name: 'Resignation', nameNp: 'राजीनामा' },
  { code: 'retirement', name: 'Retirement', nameNp: 'अवकाश' },
  { code: 'contract_end', name: 'Contract end', nameNp: 'करार समाप्त' },
  { code: 'termination', name: 'Termination', nameNp: 'सेवाबाट हटाइएको' },
  { code: 'death', name: 'Death', nameNp: 'मृत्यु' },
] as const;

export type ExitKind = (typeof EXIT_KINDS)[number]['code'];

export const exitKind = (code: string) => EXIT_KINDS.find((k) => k.code === code) ?? null;

export const CLEARANCE_UNITS = [
  { code: 'accounts', name: 'Accounts', nameNp: 'लेखा', hint: 'Loans, advances and dues settled; settlement prepared (payroll F8).' },
  { code: 'it_admin', name: 'IT / Admin', nameNp: 'प्रशासन', hint: 'Device PINs, system access and assets returned.' },
  { code: 'branch', name: 'Branch', nameNp: 'शाखा', hint: 'Handover of files, keys and members under their care.' },
  { code: 'hr', name: 'HR', nameNp: 'जनशक्ति', hint: 'Leave balance, documents and the experience letter.' },
] as const;

export type ClearanceUnit = (typeof CLEARANCE_UNITS)[number]['code'];

export const clearanceUnit = (code: string) => CLEARANCE_UNITS.find((u) => u.code === code) ?? null;

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export interface ExitForm {
  employeeId: string;
  kind: ExitKind | '';
  noticeDate: string; // YYYY-MM-DD or ''
  lastWorkingDayAd: string; // YYYY-MM-DD
  reason: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeExitForm(raw: unknown): ExitForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return {
    employeeId: s(r.employeeId, 64),
    kind: EXIT_KINDS.some((k) => k.code === r.kind) ? (r.kind as ExitKind) : '',
    noticeDate: DATE.test(String(r.noticeDate ?? '')) ? String(r.noticeDate) : '',
    lastWorkingDayAd: DATE.test(String(r.lastWorkingDayAd ?? '')) ? String(r.lastWorkingDayAd) : '',
    reason: s(r.reason, 500),
  };
}

export interface ExitSubject {
  id: string;
  status: string;
  hasOpenCase: boolean;
}

export function validateExitForm(form: ExitForm, subject: ExitSubject | null, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.employeeId || !subject) errors.employeeId = 'Choose an employee.';
  else if (subject.status !== 'Active') errors.employeeId = 'This employee is not active.';
  else if (subject.hasOpenCase) errors.employeeId = 'An exit case is already open for this employee.';
  if (!form.kind) errors.kind = 'Choose the kind of exit.';
  if (!form.lastWorkingDayAd) errors.lastWorkingDayAd = 'Give the last working day.';
  else {
    const limit = new Date(`${today}T00:00:00`);
    limit.setFullYear(limit.getFullYear() + 1);
    if (new Date(`${form.lastWorkingDayAd}T00:00:00`) > limit) errors.lastWorkingDayAd = 'At most one year ahead.';
  }
  if (form.noticeDate && form.lastWorkingDayAd && form.noticeDate > form.lastWorkingDayAd) {
    errors.noticeDate = 'The notice date cannot be after the last working day.';
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Clearance and completion
// ---------------------------------------------------------------------------

export interface ClearanceState {
  unit: string;
  status: 'pending' | 'cleared' | 'blocked';
}

export function clearanceProgress(clearances: ClearanceState[]): { cleared: number; total: number; blocked: number } {
  return {
    cleared: clearances.filter((c) => c.status === 'cleared').length,
    blocked: clearances.filter((c) => c.status === 'blocked').length,
    total: clearances.length,
  };
}

/**
 * Complete needs every unit cleared and the last working day arrived — an
 * employee is never switched off while still serving or still owing.
 */
export function completionBlockers(clearances: ClearanceState[], lastWorkingDayAd: string, today: string, fundsHeld: string[] = [], assetsHeld: string[] = []): string[] {
  const blockers: string[] = [];
  for (const c of clearances) {
    if (c.status !== 'cleared') {
      const unit = clearanceUnit(c.unit);
      blockers.push(`${unit?.name ?? c.unit} has not cleared${c.status === 'blocked' ? ' (blocked)' : ''}.`);
    }
  }
  if (lastWorkingDayAd > today) blockers.push(`The last working day (${lastWorkingDayAd}) has not arrived.`);
  if (assetsHeld.length) blockers.push(`Company assets are still out (${assetsHeld.join(', ')}) — record their return under Assets first.`);
  if (fundsHeld.length) blockers.push(`Welfare fund balance is still held (${fundsHeld.join(', ')}) — pay it out or adjust it under Payroll → Funds first.`);
  return blockers;
}

export function validateClearanceDecision(status: string, note: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (status !== 'cleared' && status !== 'blocked' && status !== 'pending') errors.status = 'Cleared, blocked or pending.';
  if (status === 'blocked' && note.trim().length < 5) errors.note = 'Say what blocks the clearance (at least 5 characters).';
  if (note.length > 500) errors.note = 'Keep the note under 500 characters.';
  return errors;
}

export function validateCancelReason(reason: string): string | null {
  const r = reason.trim();
  if (r.length < 5) return 'Give the reason this case is being cancelled (at least 5 characters).';
  if (r.length > 500) return 'Keep the reason under 500 characters.';
  return null;
}

/** The legacy employee_termination mirror row written on Complete. */
export function terminationMirror(kind: ExitKind, form: { noticeDate: string; lastWorkingDayAd: string; reason: string }) {
  const label: Record<ExitKind, string> = {
    resignation: 'Resignation',
    retirement: 'Retirement',
    contract_end: 'Contract End',
    termination: 'Termination',
    death: 'Death',
  };
  return {
    informedDate: form.noticeDate || null,
    terminationDate: form.lastWorkingDayAd,
    type: label[kind],
    reason: form.reason || null,
  };
}

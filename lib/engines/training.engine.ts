// Training (G7, docs/redesign/06-hrms-gap-analysis.md): pure rules, no database
// access, unit-tested in tests/training.engine.test.ts.
//
// A programme moves planned → running → completed (or cancelled while planned /
// running). Staff are nominated, then marked attended / absent while it runs and
// completed once it has completed. A programme may carry a service bond: after
// completing it the employee commits to stay N months (the end date is derived,
// never stored, so it cannot drift from the completion date).

export const PROGRAM_KINDS = [
  { code: 'internal', name: 'Internal' },
  { code: 'external', name: 'External' },
  { code: 'regulatory', name: 'Regulatory / mandatory' },
] as const;

export const PROGRAM_STATUSES = ['planned', 'running', 'completed', 'cancelled'] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const PARTICIPANT_STATUSES = ['nominated', 'attended', 'absent', 'completed'] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export function nextProgramStatuses(from: string): ProgramStatus[] {
  switch (from) {
    case 'planned':
      return ['running', 'cancelled'];
    case 'running':
      return ['completed', 'cancelled'];
    default:
      return [];
  }
}

export const canMoveProgram = (from: string, to: string): boolean => (nextProgramStatuses(from) as string[]).includes(to);

/** Nominations are taken until the programme completes or is cancelled. */
export const acceptsNominations = (status: string): boolean => status === 'planned' || status === 'running';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export interface ProgramForm {
  title: string;
  provider: string;
  kind: string;
  startAd: string;
  endAd: string;
  hours: number;
  cost: number;
  bondMonths: number;
  note: string;
}

export function normalizeProgramForm(raw: unknown): ProgramForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    title: s(r.title, 200),
    provider: s(r.provider, 200),
    kind: PROGRAM_KINDS.some((k) => k.code === r.kind) ? (r.kind as string) : '',
    startAd: s(r.startAd, 10),
    endAd: s(r.endAd, 10),
    hours: Number(r.hours),
    cost: r.cost === '' || r.cost === undefined || r.cost === null ? 0 : Number(r.cost),
    bondMonths: r.bondMonths === '' || r.bondMonths === undefined || r.bondMonths === null ? 0 : Number(r.bondMonths),
    note: s(r.note, 1000),
  };
}

export function validateProgramForm(form: ProgramForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.length < 3) errors.title = 'Give the programme a title (at least 3 characters).';
  if (!form.kind) errors.kind = 'Choose the kind.';
  if (!ISO.test(form.startAd)) errors.startAd = 'Choose the start date.';
  if (!ISO.test(form.endAd)) errors.endAd = 'Choose the end date.';
  if (ISO.test(form.startAd) && ISO.test(form.endAd) && form.endAd < form.startAd) errors.endAd = 'The end cannot be before the start.';
  if (!Number.isFinite(form.hours) || form.hours <= 0 || form.hours > 2000) errors.hours = 'Hours: more than 0, up to 2000.';
  if (!Number.isFinite(form.cost) || form.cost < 0 || form.cost > 100000000) errors.cost = 'Cost: 0 or more.';
  if (!Number.isInteger(form.bondMonths) || form.bondMonths < 0 || form.bondMonths > 120) errors.bondMonths = 'Bond: whole months, 0–120.';
  return errors;
}

export interface MarkForm {
  status: string;
  score: number | null;
  certificateNo: string;
}

export function normalizeMarkForm(raw: unknown): MarkForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const hasScore = r.score !== '' && r.score !== undefined && r.score !== null;
  return { status: s(r.status, 15), score: hasScore ? Number(r.score) : null, certificateNo: s(r.certificateNo, 60) };
}

/**
 * Marking rules: attended / absent only while the programme runs or after it;
 * completed only once the programme has completed; a score is 0–100 and only
 * for attended / completed; a certificate number only for completed.
 */
export function validateMark(programStatus: string, form: MarkForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(PARTICIPANT_STATUSES as readonly string[]).includes(form.status) || form.status === 'nominated') {
    errors.status = 'Attended, absent or completed.';
    return errors;
  }
  if ((form.status === 'attended' || form.status === 'absent') && programStatus !== 'running' && programStatus !== 'completed') {
    errors.status = 'Attendance is marked once the programme is running.';
  }
  if (form.status === 'completed' && programStatus !== 'completed') errors.status = 'Mark completion after the programme has completed.';
  if (form.score !== null) {
    if (!Number.isFinite(form.score) || form.score < 0 || form.score > 100) errors.score = 'Score: 0–100.';
    else if (form.status === 'absent') errors.score = 'An absent participant has no score.';
  }
  if (form.certificateNo && form.status !== 'completed') errors.certificateNo = 'A certificate number goes with completion.';
  return errors;
}

/** Adds whole months to an ISO date, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** The last day of the service bond, or null when the programme has none. */
export function bondEnds(programEndAd: string, bondMonths: number): string | null {
  return bondMonths > 0 ? addMonthsIso(programEndAd, bondMonths) : null;
}

export const bondActive = (bondEndAd: string | null, today: string): boolean => bondEndAd !== null && bondEndAd >= today;

/** Training hours an employee has earned: completed programmes only. */
export function earnedHours(rows: { status: string; hours: number }[]): number {
  return Math.round(rows.filter((r) => r.status === 'completed').reduce((sum, r) => sum + r.hours, 0) * 100) / 100;
}

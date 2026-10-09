// Recruitment & darbandi (G4, docs/redesign/06-hrms-gap-analysis.md): pure
// rules — no database access, unit-tested in tests/recruitment.engine.test.ts.

export const APPLICANT_STAGES = [
  { code: 'applied', name: 'Applied', nameNp: 'दरखास्त' },
  { code: 'shortlisted', name: 'Shortlisted', nameNp: 'छनोट' },
  { code: 'exam', name: 'Exam', nameNp: 'परीक्षा' },
  { code: 'interview', name: 'Interview', nameNp: 'अन्तर्वार्ता' },
  { code: 'selected', name: 'Selected', nameNp: 'सिफारिस' },
  { code: 'hired', name: 'Hired', nameNp: 'नियुक्त' },
  { code: 'rejected', name: 'Rejected', nameNp: 'अस्वीकृत' },
] as const;

export type ApplicantStage = (typeof APPLICANT_STAGES)[number]['code'];

export const applicantStage = (code: string) => APPLICANT_STAGES.find((s) => s.code === code) ?? null;

/** The pipeline order (rejected sits outside it). */
const PIPELINE: ApplicantStage[] = ['applied', 'shortlisted', 'exam', 'interview', 'selected', 'hired'];

/**
 * Stage moves: forward along the pipeline one or more steps, backward one
 * step (a correction), or to rejected from anywhere but hired. A hired
 * applicant never moves (the employee record is the truth from there).
 */
export function canMoveStage(from: string, to: string): boolean {
  if (from === to) return false;
  if (from === 'hired') return false;
  if (to === 'rejected') return true;
  if (from === 'rejected') return to === 'applied'; // re-considered: back to the start
  const a = PIPELINE.indexOf(from as ApplicantStage);
  const b = PIPELINE.indexOf(to as ApplicantStage);
  if (a < 0 || b < 0) return false;
  return b > a || b === a - 1;
}

// ---------------------------------------------------------------------------
// Darbandi occupancy
// ---------------------------------------------------------------------------

export interface PositionOccupancy {
  positions: number;
  filled: number;
  vacant: number;
  over: number;
}

/** Vacant never goes below zero; over shows posts filled beyond the approval. */
export function occupancy(positions: number, filled: number): PositionOccupancy {
  const vacant = Math.max(0, positions - filled);
  const over = Math.max(0, filled - positions);
  return { positions, filled, vacant, over };
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface PositionForm {
  designationId: string;
  branchId: string;
  positions: number;
  decisionRef: string;
  note: string;
  isActive: boolean;
}

export function normalizePositionForm(raw: unknown): PositionForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = Number(r.positions);
  return {
    designationId: s(r.designationId, 64),
    branchId: s(r.branchId, 64),
    positions: Number.isFinite(n) ? Math.round(n) : NaN,
    decisionRef: s(r.decisionRef, 100),
    note: s(r.note, 500),
    isActive: r.isActive !== false,
  };
}

export function validatePositionForm(form: PositionForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.designationId) errors.designationId = 'Choose the designation.';
  if (!form.branchId) errors.branchId = 'Choose the branch.';
  if (!Number.isFinite(form.positions) || form.positions < 0 || form.positions > 999) errors.positions = '0–999.';
  return errors;
}

export interface VacancyForm {
  designationId: string;
  branchId: string;
  openings: number;
  deadlineAd: string;
  note: string;
}

export function normalizeVacancyForm(raw: unknown): VacancyForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = Number(r.openings);
  return {
    designationId: s(r.designationId, 64),
    branchId: s(r.branchId, 64),
    openings: Number.isFinite(n) ? Math.round(n) : NaN,
    deadlineAd: DATE.test(String(r.deadlineAd ?? '')) ? String(r.deadlineAd) : '',
    note: s(r.note, 500),
  };
}

export function validateVacancyForm(form: VacancyForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.designationId) errors.designationId = 'Choose the designation.';
  if (!form.branchId) errors.branchId = 'Choose the branch.';
  if (!Number.isFinite(form.openings) || form.openings < 1 || form.openings > 99) errors.openings = '1–99.';
  return errors;
}

export interface ApplicantForm {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  educationNote: string;
}

export function normalizeApplicantForm(raw: unknown): ApplicantForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    fullName: s(r.fullName, 255),
    phone: s(r.phone, 50),
    email: s(r.email, 255),
    address: s(r.address, 255),
    educationNote: s(r.educationNote, 1000),
  };
}

export function validateApplicantForm(form: ApplicantForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.fullName.length < 2) errors.fullName = 'The applicant\'s name.';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Not an email address.';
  return errors;
}

/** Marks are 0–100, half marks allowed; empty clears. */
export function validateMarks(value: string): string | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return '0–100.';
  if (Math.round(n * 2) !== n * 2) return 'Whole or half marks only.';
  return null;
}

// ---------------------------------------------------------------------------
// Merit
// ---------------------------------------------------------------------------

export interface MeritInput {
  id: string;
  stage: string;
  examMarks: number | null;
  interviewMarks: number | null;
}

/**
 * Merit order for a vacancy: total marks (exam + interview) descending, exam
 * marks breaking ties; applicants without both marks or rejected ones sit
 * outside the ranking (rank null).
 */
export function meritOrder(applicants: MeritInput[]): Map<string, number> {
  const ranked = applicants
    .filter((a) => a.stage !== 'rejected' && a.examMarks !== null && a.interviewMarks !== null)
    .map((a) => ({ id: a.id, total: (a.examMarks ?? 0) + (a.interviewMarks ?? 0), exam: a.examMarks ?? 0 }))
    .sort((a, b) => b.total - a.total || b.exam - a.exam);
  const out = new Map<string, number>();
  ranked.forEach((a, i) => out.set(a.id, i + 1));
  return out;
}

import { darbandiMode as readDarbandiMode } from '@/lib/services/darbandi.service';
import * as repo from '@/lib/repositories/recruitment.repository';
import { findAllDesignations } from '@/lib/repositories/designation.repository';
import { findAllBranches } from '@/lib/repositories/branch.repository';
import {
  applicantStage,
  canMoveStage,
  meritOrder,
  normalizeApplicantForm,
  normalizePositionForm,
  normalizeVacancyForm,
  occupancy,
  validateApplicantForm,
  validateMarks,
  validatePositionForm,
  validateVacancyForm,
} from '@/lib/engines/recruitment.engine';
import type { ScopeFilter } from '@/lib/auth/scope-filter';
import { UserFacingError } from '@/lib/errors/action-error';
import type { ApplicantView, RecruitmentPageData } from '@/lib/types/recruitment';

// Recruitment & darbandi (G4): orchestration. Darbandi occupancy is live
// (active employees on the designation × branch pair); applicants carry
// their own marks and the merit order is computed, never stored. Applicant
// details are personal data: they stay inside this module and are never
// copied anywhere except the employee record a hire creates by hand.

export class RecruitmentValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'RecruitmentValidationError';
  }
}

export interface RecruitmentCtx {
  userId: string;
  scope: ScopeFilter;
}

/** Branch-scoped users see their branches' darbandi and vacancies. */
const scopeBranchIds = (scope: ScopeFilter): string[] | undefined => (scope.scopeType === 'BRANCH' ? scope.branchIds : undefined);

export async function recruitmentPage(ctx: RecruitmentCtx, permissions: { manage: boolean }): Promise<RecruitmentPageData> {
  const branchIds = scopeBranchIds(ctx.scope);
  const [positions, vacancyRows, designations, branches, darbandiMode] = await Promise.all([
    repo.listPositions(branchIds),
    repo.listVacancies(branchIds),
    findAllDesignations(),
    findAllBranches(),
    readDarbandiMode(),
  ]);
  return {
    positions: positions.map((p) => {
      const o = occupancy(p.positions, p.filled);
      return {
        id: p.id,
        designationId: p.designationId,
        designation: p.designation,
        branchId: p.branchId,
        branch: p.branch,
        positions: p.positions,
        filled: p.filled,
        vacant: o.vacant,
        over: o.over,
        decisionRef: p.decisionRef,
        note: p.note,
        isActive: p.isActive,
      };
    }),
    darbandiMode,
    vacancies: vacancyRows.map((v) => ({
      id: v.id,
      designationId: v.designationId,
      designation: v.designation,
      branchId: v.branchId,
      branch: v.branch,
      openings: v.openings,
      deadlineAd: v.deadlineAd,
      note: v.note,
      status: v.status === 'closed' ? 'closed' : v.status === 'cancelled' ? 'cancelled' : 'open',
      applicantCount: v.applicantCount,
      selectedCount: v.selectedCount,
    })),
    designations: designations.map((d) => ({ id: d.id, name: d.name })),
    branches: branches.filter((b) => b.status === 'active').map((b) => ({ id: b.id, name: b.name })),
    permissions,
  };
}

export async function savePosition(raw: unknown, ctx: RecruitmentCtx) {
  const form = normalizePositionForm(raw);
  const errors = validatePositionForm(form);
  if (Object.keys(errors).length) throw new RecruitmentValidationError(errors);
  return repo.upsertPosition({ ...form, note: form.note || null }, ctx.userId);
}

export async function openVacancy(raw: unknown, ctx: RecruitmentCtx) {
  const form = normalizeVacancyForm(raw);
  const errors = validateVacancyForm(form);
  if (Object.keys(errors).length) throw new RecruitmentValidationError(errors);
  return repo.insertVacancy({
    designationId: form.designationId,
    branchId: form.branchId,
    openings: form.openings,
    deadlineAd: form.deadlineAd || null,
    note: form.note || null,
    openedBy: ctx.userId,
  });
}

export async function closeVacancy(id: string, status: 'closed' | 'cancelled', ctx: RecruitmentCtx) {
  const vacancy = await repo.findVacancy(id, scopeBranchIds(ctx.scope));
  if (!vacancy) throw new UserFacingError('Not found: this vacancy is not in your scope.');
  const row = await repo.setVacancyStatus(id, status, ctx.userId);
  if (!row) throw new UserFacingError('This vacancy is no longer open.');
  return row;
}

// ---------------------------------------------------------------------------
// Applicants
// ---------------------------------------------------------------------------

const toView = (a: repo.ApplicantRow, ranks: Map<string, number>): ApplicantView => {
  const stage = applicantStage(a.stage);
  const exam = a.examMarks === null ? null : Number(a.examMarks);
  const interview = a.interviewMarks === null ? null : Number(a.interviewMarks);
  return {
    id: a.id,
    fullName: a.fullName,
    phone: a.phone,
    email: a.email,
    address: a.address,
    educationNote: a.educationNote,
    stage: a.stage,
    stageName: stage?.name ?? a.stage,
    stageNameNp: stage?.nameNp ?? '',
    examMarks: exam,
    interviewMarks: interview,
    total: exam !== null && interview !== null ? Math.round((exam + interview) * 100) / 100 : null,
    rank: ranks.get(a.id) ?? null,
    note: a.note,
    employeeId: a.employeeId,
  };
};

export async function vacancyApplicants(vacancyId: string, ctx: RecruitmentCtx): Promise<ApplicantView[]> {
  const vacancy = await repo.findVacancy(vacancyId, scopeBranchIds(ctx.scope));
  if (!vacancy) throw new UserFacingError('Not found: this vacancy is not in your scope.');
  const rows = await repo.listApplicants(vacancyId);
  const ranks = meritOrder(rows.map((a) => ({ id: a.id, stage: a.stage, examMarks: a.examMarks === null ? null : Number(a.examMarks), interviewMarks: a.interviewMarks === null ? null : Number(a.interviewMarks) })));
  return rows
    .map((a) => toView(a, ranks))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.fullName.localeCompare(b.fullName));
}

export async function addApplicant(vacancyId: string, raw: unknown, ctx: RecruitmentCtx) {
  const vacancy = await repo.findVacancy(vacancyId, scopeBranchIds(ctx.scope));
  if (!vacancy) throw new UserFacingError('Not found: this vacancy is not in your scope.');
  if (vacancy.status !== 'open') throw new UserFacingError('This vacancy is no longer open.');
  const form = normalizeApplicantForm(raw);
  const errors = validateApplicantForm(form);
  if (Object.keys(errors).length) throw new RecruitmentValidationError(errors);
  return repo.insertApplicant({ vacancyId, ...form, educationNote: form.educationNote || null }, ctx.userId);
}

export interface ApplicantUpdate {
  stage?: string;
  examMarks?: string;
  interviewMarks?: string;
  note?: string;
}

export async function updateApplicant(id: string, raw: ApplicantUpdate, ctx: RecruitmentCtx) {
  const applicant = await repo.findApplicant(typeof id === 'string' ? id : '');
  if (!applicant) throw new UserFacingError('Not found: this applicant no longer exists.');
  const vacancy = await repo.findVacancy(applicant.vacancyId, scopeBranchIds(ctx.scope));
  if (!vacancy) throw new UserFacingError('Not found: this vacancy is not in your scope.');

  const errors: Record<string, string> = {};
  const patch: Parameters<typeof repo.updateApplicant>[1] = {};

  if (raw.stage !== undefined && raw.stage !== applicant.stage) {
    if (!applicantStage(raw.stage) || !canMoveStage(applicant.stage, raw.stage)) {
      errors.stage = `Cannot move from ${applicantStage(applicant.stage)?.name ?? applicant.stage} to ${applicantStage(raw.stage)?.name ?? raw.stage}.`;
    } else {
      patch.stage = raw.stage;
    }
  }
  for (const [key, field] of [['examMarks', 'examMarks'], ['interviewMarks', 'interviewMarks']] as const) {
    const value = raw[key];
    if (value === undefined) continue;
    const error = validateMarks(String(value));
    if (error) errors[key] = error;
    else patch[field] = String(value).trim() === '' ? null : String(Number(value));
  }
  if (raw.note !== undefined) patch.note = String(raw.note).trim().slice(0, 500) || null;
  if (Object.keys(errors).length) throw new RecruitmentValidationError(errors);
  if (!Object.keys(patch).length) return applicant;

  const row = await repo.updateApplicant(id, patch, ctx.userId);
  if (!row) throw new UserFacingError('Not found: this applicant no longer exists.');
  return row;
}

import { getSessionEmployeeId } from '@/lib/services/self-service.service';
import { boardFor } from '@/lib/services/notice.service';
import { getMyLetter, listMyLetters, type LetterPrintData } from '@/lib/services/letter.service';
import { findDossier } from '@/lib/repositories/employee-dossier.repository';
import type { EmployeeDossierInput } from '@/lib/types/employee-dossier';
import type { LetterListRow } from '@/lib/types/letter';
import * as travelService from '@/lib/services/travel.service';
import * as travelRepo from '@/lib/repositories/travel.repository';
import { bondEnds } from '@/lib/engines/training.engine';
import { getDb } from '@/lib/db';
import { trainingParticipants, trainingPrograms } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { ScopeFilter } from '@/lib/auth/scope-filter';
import type { BoardNotice } from '@/lib/types/notice';
import type { ClaimRow } from '@/lib/types/travel';
import * as reimbursementService from '@/lib/services/reimbursement.service';
import type { ReimbursementClaimRow, ReimbursementTypeRow } from '@/lib/types/reimbursement';

// Self-service extras (G12): the signed-in employee's own notices, training
// and travel claims. Every read is pinned to the session's employee (S8: the
// account is re-checked on each call by getSessionEmployeeId); writes go
// through the travel service with a SELF scope, so the same rules apply as in
// the office (amounts from the card, submit-own allowed, decide-own refused).

const selfScope = (employeeId: string, userId: string): ScopeFilter => ({ scopeType: 'SELF', branchIds: [], departmentIds: [], employeeId, userId });

export async function myNotices(limit = 20): Promise<BoardNotice[]> {
  const { employeeId, userId } = await getSessionEmployeeId();
  return boardFor(selfScope(employeeId, userId), limit);
}

export async function myLetters(): Promise<LetterListRow[]> {
  const { employeeId, userId } = await getSessionEmployeeId();
  return listMyLetters(selfScope(employeeId, userId));
}

/** One of the signed-in employee's own issued letters; anything else reads as not found. */
export async function myLetter(id: string): Promise<LetterPrintData | null> {
  const { employeeId, userId } = await getSessionEmployeeId();
  return getMyLetter(id, selfScope(employeeId, userId));
}

/** The employee's own qualifications, past jobs and papers (names and dates; the scans stay with HR). */
export async function myDossier(): Promise<EmployeeDossierInput> {
  const { employeeId } = await getSessionEmployeeId();
  return findDossier(employeeId);
}

export interface MyTrainingRow {
  id: string;
  title: string;
  provider: string;
  kind: string;
  startAd: string;
  endAd: string;
  hours: number;
  programStatus: string;
  status: 'nominated' | 'attended' | 'absent' | 'completed';
  score: number | null;
  certificateNo: string | null;
  bondEndsAd: string | null;
}

export async function myTraining(): Promise<MyTrainingRow[]> {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDb();
  const rows = await db
    .select({ p: trainingPrograms, t: trainingParticipants })
    .from(trainingParticipants)
    .innerJoin(trainingPrograms, eq(trainingParticipants.programId, trainingPrograms.id))
    .where(eq(trainingParticipants.employeeId, employeeId))
    .orderBy(desc(trainingPrograms.startAd));
  return rows.map(({ p, t }) => {
    const status = t.status === 'attended' || t.status === 'absent' || t.status === 'completed' ? t.status : 'nominated';
    return {
      id: t.id,
      title: p.title,
      provider: p.provider,
      kind: p.kind,
      startAd: p.startAd,
      endAd: p.endAd,
      hours: Number(p.hours),
      programStatus: p.status,
      status,
      score: t.score === null ? null : Number(t.score),
      certificateNo: t.certificateNo,
      bondEndsAd: status === 'completed' ? bondEnds(p.endAd, p.bondMonths) : null,
    };
  });
}

export async function myClaims(): Promise<{ claims: ClaimRow[]; hasRateCard: boolean }> {
  const { employeeId, userId } = await getSessionEmployeeId();
  const page = await travelService.travelPage({ userId, actorEmployeeId: employeeId, scope: selfScope(employeeId, userId) }, { add: true, manage: false, approve: false, settle: false });
  const designationId = await travelRepo.employeeDesignation(employeeId);
  const hasRateCard = designationId ? !!(await travelRepo.cardFor(designationId)) : false;
  return { claims: page.claims.filter((c) => c.employeeId === employeeId), hasRateCard };
}

/** Saves the signed-in employee's own claim and submits it in one go. */
export async function submitMyClaim(raw: unknown): Promise<ClaimRow> {
  const { employeeId, userId } = await getSessionEmployeeId();
  const ctx = { userId, actorEmployeeId: employeeId, scope: selfScope(employeeId, userId) };
  const form = { ...(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}), employeeId };
  const draft = await travelService.saveClaim(null, form, ctx);
  return travelService.moveClaim(draft.id, 'submitted', '', ctx);
}

/** F16: the signed-in employee's own reimbursement claims and the types they can claim. */
export async function myReimbursements(): Promise<{ claims: ReimbursementClaimRow[]; types: ReimbursementTypeRow[] }> {
  const { employeeId, userId } = await getSessionEmployeeId();
  return reimbursementService.ownClaims({ userId, actorEmployeeId: employeeId, scope: selfScope(employeeId, userId) });
}

/** F16: the signed-in employee's own claim, submitted in one write (the employee is never a parameter). */
export async function submitMyReimbursement(raw: unknown): Promise<ReimbursementClaimRow> {
  const { employeeId, userId } = await getSessionEmployeeId();
  const form = { ...(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}), employeeId };
  return reimbursementService.saveClaim(null, form, { userId, actorEmployeeId: employeeId, scope: selfScope(employeeId, userId) }, { submit: true });
}

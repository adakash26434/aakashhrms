import { getDb } from '@/lib/db';
import { applicants, approvedPositions, branches, designations, employees, systemConfig, vacancies } from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

// Recruitment & darbandi (G4): Drizzle queries only. Rules live in
// lib/engines/recruitment.engine.ts; orchestration in
// lib/services/recruitment.service.ts.

export type PositionRow = typeof approvedPositions.$inferSelect;
export type VacancyRow = typeof vacancies.$inferSelect;
export type ApplicantRow = typeof applicants.$inferSelect;

export interface PositionJoinedRow extends PositionRow {
  designation: string;
  branch: string;
  filled: number;
}

export async function listPositions(branchIds?: string[]): Promise<PositionJoinedRow[]> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (branchIds && branchIds.length) conditions.push(inArray(approvedPositions.branchId, branchIds));
  const rows = await db
    .select({
      position: approvedPositions,
      designation: designations.name,
      branch: branches.name,
      filled: sql<number>`(SELECT count(*)::int FROM ${employees} e WHERE e."designation_id" = ${approvedPositions.designationId} AND e."branch_id" = ${approvedPositions.branchId} AND e."status" = 'Active')`,
    })
    .from(approvedPositions)
    .innerJoin(designations, eq(approvedPositions.designationId, designations.id))
    .innerJoin(branches, eq(approvedPositions.branchId, branches.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(branches.name), asc(designations.name));
  return rows.map((r) => ({ ...r.position, designation: r.designation, branch: r.branch, filled: r.filled }));
}

export interface PositionWrite {
  designationId: string;
  branchId: string;
  positions: number;
  decisionRef: string;
  note: string | null;
  isActive: boolean;
}

export async function upsertPosition(data: PositionWrite, userId: string): Promise<PositionRow> {
  const db = await getDb();
  const [row] = await db
    .insert(approvedPositions)
    .values({ ...data, createdBy: userId, updatedBy: userId })
    .onConflictDoUpdate({
      target: [approvedPositions.designationId, approvedPositions.branchId],
      set: { positions: data.positions, decisionRef: data.decisionRef, note: data.note, isActive: data.isActive, updatedBy: userId },
    })
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------

export interface VacancyJoinedRow extends VacancyRow {
  designation: string;
  branch: string;
  applicantCount: number;
  selectedCount: number;
}

export async function listVacancies(branchIds?: string[]): Promise<VacancyJoinedRow[]> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (branchIds && branchIds.length) conditions.push(inArray(vacancies.branchId, branchIds));
  const rows = await db
    .select({
      vacancy: vacancies,
      designation: designations.name,
      branch: branches.name,
      applicantCount: sql<number>`(SELECT count(*)::int FROM ${applicants} a WHERE a."vacancy_id" = ${vacancies.id})`,
      selectedCount: sql<number>`(SELECT count(*)::int FROM ${applicants} a WHERE a."vacancy_id" = ${vacancies.id} AND a."stage" IN ('selected', 'hired'))`,
    })
    .from(vacancies)
    .innerJoin(designations, eq(vacancies.designationId, designations.id))
    .innerJoin(branches, eq(vacancies.branchId, branches.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(vacancies.openedAt));
  return rows.map((r) => ({ ...r.vacancy, designation: r.designation, branch: r.branch, applicantCount: r.applicantCount, selectedCount: r.selectedCount }));
}

export async function findVacancy(id: string, branchIds?: string[]): Promise<VacancyJoinedRow | null> {
  const all = await listVacancies(branchIds);
  return all.find((v) => v.id === id) ?? null;
}

export interface VacancyWrite {
  designationId: string;
  branchId: string;
  openings: number;
  deadlineAd: string | null;
  note: string | null;
  openedBy: string;
}

export async function insertVacancy(data: VacancyWrite): Promise<VacancyRow> {
  const db = await getDb();
  const [row] = await db.insert(vacancies).values(data).returning();
  return row;
}

export async function setVacancyStatus(id: string, status: 'closed' | 'cancelled', userId: string): Promise<VacancyRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(vacancies)
    .set({ status, closedBy: userId, closedAt: new Date() })
    .where(and(eq(vacancies.id, id), eq(vacancies.status, 'open')))
    .returning();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Applicants
// ---------------------------------------------------------------------------

export async function listApplicants(vacancyId: string): Promise<ApplicantRow[]> {
  const db = await getDb();
  return db.select().from(applicants).where(eq(applicants.vacancyId, vacancyId)).orderBy(asc(applicants.createdAt));
}

export async function findApplicant(id: string): Promise<ApplicantRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(applicants).where(eq(applicants.id, id)).limit(1);
  return row ?? null;
}

export interface ApplicantWrite {
  vacancyId: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  educationNote: string | null;
}

export async function insertApplicant(data: ApplicantWrite, userId: string): Promise<ApplicantRow> {
  const db = await getDb();
  const [row] = await db.insert(applicants).values({ ...data, createdBy: userId, updatedBy: userId }).returning();
  return row;
}

export async function updateApplicant(
  id: string,
  data: Partial<{ stage: string; examMarks: string | null; interviewMarks: string | null; note: string | null; employeeId: string | null }>,
  userId: string,
): Promise<ApplicantRow | null> {
  const db = await getDb();
  const [row] = await db.update(applicants).set({ ...data, updatedBy: userId }).where(eq(applicants.id, id)).returning();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Darbandi enforcement
// ---------------------------------------------------------------------------

/** Approved count and active headcount for one designation × branch; null when the board never approved the pair. */
export async function occupancyFor(designationId: string, branchId: string): Promise<{ positions: number; filled: number } | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      positions: approvedPositions.positions,
      filled: sql<number>`(SELECT count(*)::int FROM ${employees} e WHERE e."designation_id" = ${approvedPositions.designationId} AND e."branch_id" = ${approvedPositions.branchId} AND e."status" = 'Active')`,
    })
    .from(approvedPositions)
    .where(and(eq(approvedPositions.designationId, designationId), eq(approvedPositions.branchId, branchId), eq(approvedPositions.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function positionLabel(designationId: string, branchId: string): Promise<string> {
  const db = await getDb();
  const [d] = await db.select({ name: designations.name }).from(designations).where(eq(designations.id, designationId)).limit(1);
  const [b] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1);
  return `${d?.name ?? 'This designation'} at ${b?.name ?? 'this branch'}`;
}

export async function readDarbandiMode(): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, 'darbandi.enforce')).limit(1);
  return row?.value ?? null;
}

export async function writeDarbandiMode(mode: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(systemConfig)
    .values({ key: 'darbandi.enforce', value: mode, dataType: 'string' })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: mode, updatedAt: new Date() } });
}

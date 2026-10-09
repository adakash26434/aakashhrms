import { getDb } from '@/lib/db';
import { branches, employees, trainingParticipants, trainingPrograms } from '@/lib/db/schema';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';

// Training (G7): Drizzle queries only. Rules live in lib/engines/training.engine.ts;
// orchestration in lib/services/training.service.ts. Participants are always
// read through the employee scope.

export type ProgramRecord = typeof trainingPrograms.$inferSelect;

export interface ProgramWithCounts extends ProgramRecord {
  nominated: number;
  completed: number;
}

export async function listPrograms(): Promise<ProgramWithCounts[]> {
  const db = await getDb();
  const rows = await db
    .select({
      p: trainingPrograms,
      nominated: sql<number>`count(${trainingParticipants.id})::int`,
      completed: sql<number>`count(*) FILTER (WHERE ${trainingParticipants.status} = 'completed')::int`,
    })
    .from(trainingPrograms)
    .leftJoin(trainingParticipants, eq(trainingParticipants.programId, trainingPrograms.id))
    .groupBy(trainingPrograms.id)
    .orderBy(desc(trainingPrograms.startAd))
    .limit(500);
  return rows.map((r) => ({ ...r.p, nominated: r.nominated, completed: r.completed }));
}

export async function findProgram(id: string): Promise<ProgramRecord | null> {
  const db = await getDb();
  const [row] = await db.select().from(trainingPrograms).where(eq(trainingPrograms.id, id)).limit(1);
  return row ?? null;
}

export interface ProgramWrite {
  title: string;
  provider: string;
  kind: string;
  startAd: string;
  endAd: string;
  hours: string;
  cost: string;
  bondMonths: number;
  note: string | null;
}

export async function insertProgram(data: ProgramWrite, userId: string): Promise<ProgramRecord> {
  const db = await getDb();
  const [row] = await db.insert(trainingPrograms).values({ ...data, createdBy: userId, updatedBy: userId }).returning();
  return row;
}

/** Edits a programme that has not completed or been cancelled; null when it no longer qualifies. */
export async function updateProgram(id: string, data: ProgramWrite, userId: string): Promise<ProgramRecord | null> {
  const db = await getDb();
  const [row] = await db
    .update(trainingPrograms)
    .set({ ...data, updatedBy: userId })
    .where(and(eq(trainingPrograms.id, id), sql`${trainingPrograms.status} IN ('planned','running')`))
    .returning();
  return row ?? null;
}

/** Claim-first status move: matches only while the programme is still in `from`. */
export async function moveProgram(id: string, from: string, to: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .update(trainingPrograms)
    .set({ status: to, updatedBy: userId })
    .where(and(eq(trainingPrograms.id, id), eq(trainingPrograms.status, from)))
    .returning({ id: trainingPrograms.id });
  return !!row;
}

export interface ParticipantRecord {
  id: string;
  programId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branch: string;
  status: string;
  score: string | null;
  certificateNo: string | null;
}

const participantSelect = {
  id: trainingParticipants.id,
  programId: trainingParticipants.programId,
  employeeId: trainingParticipants.employeeId,
  employeeName: employees.fullName,
  employeeCode: employees.employeeCode,
  branch: branches.name,
  status: trainingParticipants.status,
  score: trainingParticipants.score,
  certificateNo: trainingParticipants.certificateNo,
};

export async function participants(programId: string, scopeCondition?: SQL<unknown>): Promise<ParticipantRecord[]> {
  const db = await getDb();
  const base = eq(trainingParticipants.programId, programId);
  return db
    .select(participantSelect)
    .from(trainingParticipants)
    .innerJoin(employees, eq(trainingParticipants.employeeId, employees.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(scopeCondition ? and(base, scopeCondition) : base)
    .orderBy(asc(employees.fullName));
}

export async function findParticipant(id: string, scopeCondition?: SQL<unknown>): Promise<ParticipantRecord | null> {
  const db = await getDb();
  const base = eq(trainingParticipants.id, id);
  const [row] = await db
    .select(participantSelect)
    .from(trainingParticipants)
    .innerJoin(employees, eq(trainingParticipants.employeeId, employees.id))
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(scopeCondition ? and(base, scopeCondition) : base)
    .limit(1);
  return row ?? null;
}

/** Nominates employees; people already on the programme are skipped. Returns how many were added. */
export async function nominate(programId: string, employeeIds: string[], userId: string): Promise<number> {
  if (!employeeIds.length) return 0;
  const db = await getDb();
  const rows = await db
    .insert(trainingParticipants)
    .values(employeeIds.map((employeeId) => ({ programId, employeeId, nominatedBy: userId })))
    .onConflictDoNothing()
    .returning({ id: trainingParticipants.id });
  return rows.length;
}

export async function markParticipant(id: string, status: string, score: string | null, certificateNo: string | null, userId: string): Promise<void> {
  const db = await getDb();
  await db.update(trainingParticipants).set({ status, score, certificateNo, markedBy: userId, markedAt: new Date() }).where(eq(trainingParticipants.id, id));
}

export interface BondFact {
  title: string;
  programEndAd: string;
  bondMonths: number;
}

/** Completed programmes with a service bond for one employee (read-only context, e.g. exit). */
export async function bondsFor(employeeId: string): Promise<BondFact[]> {
  const db = await getDb();
  return db
    .select({ title: trainingPrograms.title, programEndAd: trainingPrograms.endAd, bondMonths: trainingPrograms.bondMonths })
    .from(trainingParticipants)
    .innerJoin(trainingPrograms, eq(trainingParticipants.programId, trainingPrograms.id))
    .where(and(eq(trainingParticipants.employeeId, employeeId), eq(trainingParticipants.status, 'completed'), sql`${trainingPrograms.bondMonths} > 0`));
}

import { getDb } from '@/lib/db';
import { attendanceDevices, deviceUsers, employeeTermination, employees, exitCases, exitClearances, fundLedger, fundTypes, hrLetters, loans, users } from '@/lib/db/schema';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { CLEARANCE_UNITS } from '@/lib/engines/exit.engine';
import { fundBalance } from '@/lib/engines/fund.engine';
import { bondActive, bondEnds } from '@/lib/engines/training.engine';
import { bondsFor } from '@/lib/repositories/training.repository';
import { heldBy } from '@/lib/repositories/asset.repository';

// Exit workflow (G5): Drizzle queries only. Rules live in
// lib/engines/exit.engine.ts; orchestration in lib/services/exit.service.ts.

export type ExitCaseRow = typeof exitCases.$inferSelect;
export type ClearanceRow = typeof exitClearances.$inferSelect;

export interface ExitJoinedRow extends ExitCaseRow {
  employeeName: string;
  employeeCode: string;
  designationId: string;
  branchId: string;
  openedByName: string | null;
  letterNumber: string | null;
}

const joined = {
  exit: exitCases,
  employeeName: employees.fullName,
  employeeCode: employees.employeeCode,
  designationId: employees.designationId,
  branchId: employees.branchId,
  openedByName: sql<string | null>`COALESCE(NULLIF(${users.name}, ''), ${users.email})`,
  letterNumber: hrLetters.letterNumber,
};

const flatten = (r: { exit: ExitCaseRow; employeeName: string; employeeCode: string; designationId: string; branchId: string; openedByName: string | null; letterNumber: string | null }): ExitJoinedRow => ({
  ...r.exit,
  employeeName: r.employeeName,
  employeeCode: r.employeeCode,
  designationId: r.designationId,
  branchId: r.branchId,
  openedByName: r.openedByName,
  letterNumber: r.letterNumber,
});

export interface ExitFilter {
  status?: string;
  kind?: string;
}

export async function listCases(filter: ExitFilter, scopeCondition?: SQL<unknown>): Promise<ExitJoinedRow[]> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (scopeCondition) conditions.push(scopeCondition);
  if (filter.status) conditions.push(eq(exitCases.status, filter.status));
  if (filter.kind) conditions.push(eq(exitCases.kind, filter.kind));
  const rows = await db
    .select(joined)
    .from(exitCases)
    .innerJoin(employees, eq(exitCases.employeeId, employees.id))
    .leftJoin(users, eq(exitCases.openedBy, users.id))
    .leftJoin(hrLetters, eq(exitCases.letterId, hrLetters.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(exitCases.openedAt))
    .limit(1000);
  return rows.map(flatten);
}

export async function findCase(id: string, scopeCondition?: SQL<unknown>): Promise<ExitJoinedRow | null> {
  const db = await getDb();
  const where = scopeCondition ? and(eq(exitCases.id, id), scopeCondition) : eq(exitCases.id, id);
  const rows = await db
    .select(joined)
    .from(exitCases)
    .innerJoin(employees, eq(exitCases.employeeId, employees.id))
    .leftJoin(users, eq(exitCases.openedBy, users.id))
    .leftJoin(hrLetters, eq(exitCases.letterId, hrLetters.id))
    .where(where)
    .limit(1);
  return rows[0] ? flatten(rows[0]) : null;
}

export async function hasOpenCase(employeeId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: exitCases.id })
    .from(exitCases)
    .where(and(eq(exitCases.employeeId, employeeId), eq(exitCases.status, 'open')))
    .limit(1);
  return !!row;
}

/** Of these employees, the ones with an open exit case (they are paid in the final settlement). */
export async function withOpenCase(employeeIds: string[]): Promise<Set<string>> {
  if (!employeeIds.length) return new Set();
  const rows = await (await getDb())
    .select({ employeeId: exitCases.employeeId })
    .from(exitCases)
    .where(and(inArray(exitCases.employeeId, employeeIds), eq(exitCases.status, 'open')));
  return new Set(rows.map((r) => r.employeeId));
}

export interface CaseWrite {
  employeeId: string;
  kind: string;
  noticeDate: string | null;
  lastWorkingDayAd: string;
  lastWorkingDayBs: string;
  reason: string | null;
  openedBy: string;
}

/** Opens a case and seeds the four clearance rows in one transaction. */
export async function openCaseTx(write: CaseWrite): Promise<ExitCaseRow> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(exitCases).values(write).returning();
    for (const unit of CLEARANCE_UNITS) {
      await tx.insert(exitClearances).values({ exitCaseId: row.id, unit: unit.code });
    }
    return row;
  });
}

export async function findClearances(exitCaseId: string): Promise<ClearanceRow[]> {
  const db = await getDb();
  return db.select().from(exitClearances).where(eq(exitClearances.exitCaseId, exitCaseId));
}

export async function decideClearance(exitCaseId: string, unit: string, status: 'pending' | 'cleared' | 'blocked', note: string | null, userId: string): Promise<ClearanceRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(exitClearances)
    .set({ status, note, decidedBy: userId, decidedAt: new Date() })
    .where(and(eq(exitClearances.exitCaseId, exitCaseId), eq(exitClearances.unit, unit)))
    .returning();
  return row ?? null;
}

export interface TerminationMirror {
  informedDate: string | null;
  terminationDate: string;
  type: string;
  reason: string | null;
}

/**
 * Completes a case in one transaction: the case is claimed while still open,
 * the employee goes Inactive, their login is deactivated, and the employee_termination mirror row is
 * written for older readers (reports, 4.8's settlement later).
 */
export async function completeCaseTx(id: string, employeeId: string, mirror: TerminationMirror, userId: string): Promise<'closed' | 'stale'> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(exitCases)
      .set({ status: 'closed', closedBy: userId, closedAt: new Date() })
      .where(and(eq(exitCases.id, id), eq(exitCases.status, 'open')))
      .returning({ id: exitCases.id });
    if (!claimed) return 'stale';
    await tx.update(employees).set({ status: 'Inactive' }).where(eq(employees.id, employeeId));
    // An exited employee must not keep a working login (isActive is checked at sign-in and on every permission check).
    await tx.update(users).set({ isActive: false }).where(eq(users.employeeId, employeeId));
    await tx.insert(employeeTermination).values({ employeeId, ...mirror, plan: null, remarks: 'Recorded by the exit workflow (G5).' });
    return 'closed';
  });
}

export async function cancelCase(id: string, reason: string, userId: string): Promise<ExitCaseRow | null> {
  const db = await getDb();
  const [row] = await db
    .update(exitCases)
    .set({ status: 'cancelled', cancelReason: reason, cancelledBy: userId, cancelledAt: new Date() })
    .where(and(eq(exitCases.id, id), eq(exitCases.status, 'open')))
    .returning();
  return row ?? null;
}

export async function setCaseLetter(id: string, letterId: string): Promise<void> {
  const db = await getDb();
  await db.update(exitCases).set({ letterId }).where(eq(exitCases.id, id));
}

// ---------------------------------------------------------------------------
// Clearance facts (read-only context for the units)
// ---------------------------------------------------------------------------

export interface ExitFacts {
  activeLoans: number;
  loanOutstanding: string; // summed numeric as text
  devicePins: { device: string; pin: string }[];
  funds: { fund: string; employee: string; employer: string; total: string }[];
  bonds: { title: string; bondEndsAd: string }[];
  assets: { tag: string; name: string; issuedAd: string }[];
}

export async function exitFacts(employeeId: string, lastWorkingDayAd: string): Promise<ExitFacts> {
  const db = await getDb();
  const [loanRow] = await db
    .select({ n: sql<number>`count(*)::int`, outstanding: sql<string>`COALESCE(sum(${loans.remainingAmount}), 0)::text` })
    .from(loans)
    .where(and(eq(loans.employeeId, employeeId), eq(loans.status, 'ACTIVE')));
  const pins = await db
    .select({ device: attendanceDevices.name, pin: deviceUsers.deviceUserId })
    .from(deviceUsers)
    .innerJoin(attendanceDevices, eq(deviceUsers.deviceId, attendanceDevices.id))
    .where(eq(deviceUsers.employeeId, employeeId));
  // Read-only: the payout itself is posted under Funds (WELFARE_FUNDS, S33), never from the exit screen.
  const fundRows = await db
    .select({
      fund: fundTypes.name,
      employee: sql<string>`COALESCE(sum(${fundLedger.employeeAmount}), 0)::text`,
      employer: sql<string>`COALESCE(sum(${fundLedger.employerAmount}), 0)::text`,
    })
    .from(fundLedger)
    .innerJoin(fundTypes, eq(fundLedger.fundTypeId, fundTypes.id))
    .where(eq(fundLedger.employeeId, employeeId))
    .groupBy(fundTypes.name);
  const funds = fundRows
    .map((r) => ({ fund: r.fund, ...fundBalance([{ employeeAmount: r.employee, employerAmount: r.employer }]) }))
    .filter((r) => r.total !== '0.00' || r.employee !== '0.00' || r.employer !== '0.00');
  const bonds = (await bondsFor(employeeId))
    .map((b) => ({ title: b.title, bondEndsAd: bondEnds(b.programEndAd, b.bondMonths) }))
    .filter((b): b is { title: string; bondEndsAd: string } => bondActive(b.bondEndsAd, lastWorkingDayAd));
  const held = await heldBy(employeeId);
  return { activeLoans: loanRow?.n ?? 0, loanOutstanding: loanRow?.outstanding ?? '0', devicePins: pins, funds, bonds, assets: held };
}



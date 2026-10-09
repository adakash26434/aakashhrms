import { getDb } from '@/lib/db';
import { branches, departments, designations, employees, employeeTermination, fiscalYears, hrCases, leaveApplications, trainingParticipants, trainingPrograms } from '@/lib/db/schema';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { StaffFact } from '@/lib/engines/hr-analytics.engine';

// HR analytics (G13): Drizzle queries only — plain facts for the engine.
// Every employee read carries the caller's scope condition; no pay columns.

export interface FiscalYearOption {
  id: string;
  label: string;
  startAd: string;
  endAd: string;
}

export async function fiscalYearOptions(): Promise<FiscalYearOption[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: fiscalYears.id, label: fiscalYears.label, start: fiscalYears.startDateAD, end: fiscalYears.endDateAD })
    .from(fiscalYears)
    .orderBy(desc(fiscalYears.label));
  return rows.map((r) => ({ id: r.id, label: r.label, startAd: r.start.toISOString().slice(0, 10), endAd: r.end.toISOString().slice(0, 10) }));
}

export async function staffFacts(scopeCondition?: SQL<unknown>): Promise<StaffFact[]> {
  const db = await getDb();
  return db
    .select({
      id: employees.id,
      gender: employees.gender,
      category: employees.category,
      branch: branches.name,
      department: departments.name,
      designation: designations.name,
      joiningDate: employees.joiningDate,
      dateOfBirth: employees.dateOfBirth,
      status: employees.status,
      isDisabled: employees.isDisabled,
    })
    .from(employees)
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(designations, eq(employees.designationId, designations.id))
    .where(scopeCondition);
}

/** Joined / left inside [startAd, endAd] and the headcount active on the day before it starts. */
export async function movement(startAd: string, endAd: string, scopeCondition?: SQL<unknown>): Promise<{ joined: number; left: number; openingHeadcount: number }> {
  const db = await getDb();
  const [joinedRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(employees)
    .where(and(gte(employees.joiningDate, startAd), lte(employees.joiningDate, endAd), scopeCondition));
  const [leftRow] = await db
    .select({ n: sql<number>`count(distinct ${employeeTermination.employeeId})::int` })
    .from(employeeTermination)
    .innerJoin(employees, eq(employeeTermination.employeeId, employees.id))
    .where(and(gte(employeeTermination.terminationDate, startAd), lte(employeeTermination.terminationDate, endAd), scopeCondition));
  // Opening headcount: joined before the period and not terminated before it.
  const [openingRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(employees)
    .where(
      and(
        sql`${employees.joiningDate} < ${startAd}`,
        sql`NOT EXISTS (SELECT 1 FROM ${employeeTermination} t WHERE t.employee_id = ${employees.id} AND t.termination_date < ${startAd})`,
        scopeCondition,
      ),
    );
  return { joined: joinedRow?.n ?? 0, left: leftRow?.n ?? 0, openingHeadcount: openingRow?.n ?? 0 };
}

export async function trainingFacts(startAd: string, endAd: string, scopeCondition?: SQL<unknown>): Promise<{ trainedEmployees: number; trainingHours: number; programmes: number }> {
  const db = await getDb();
  const completedInPeriod = and(eq(trainingPrograms.status, 'completed'), gte(trainingPrograms.endAd, startAd), lte(trainingPrograms.endAd, endAd));
  const [people] = await db
    .select({
      n: sql<number>`count(distinct ${trainingParticipants.employeeId})::int`,
      hours: sql<string>`COALESCE(sum(${trainingPrograms.hours}), 0)::text`,
    })
    .from(trainingParticipants)
    .innerJoin(trainingPrograms, eq(trainingParticipants.programId, trainingPrograms.id))
    .innerJoin(employees, eq(trainingParticipants.employeeId, employees.id))
    .where(and(eq(trainingParticipants.status, 'completed'), completedInPeriod, scopeCondition));
  const [programmes] = await db.select({ n: sql<number>`count(*)::int` }).from(trainingPrograms).where(completedInPeriod);
  return { trainedEmployees: people?.n ?? 0, trainingHours: Number(people?.hours ?? 0), programmes: programmes?.n ?? 0 };
}

export async function leaveFacts(startAd: string, endAd: string, scopeCondition?: SQL<unknown>): Promise<{ applications: number; approved: number; days: number }> {
  const db = await getDb();
  const [row] = await db
    .select({
      applications: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) FILTER (WHERE ${leaveApplications.status} = 'Approved')::int`,
      days: sql<string>`COALESCE(sum(${leaveApplications.noOfDays}) FILTER (WHERE ${leaveApplications.status} = 'Approved'), 0)::text`,
    })
    .from(leaveApplications)
    .innerJoin(employees, eq(leaveApplications.employeeId, employees.id))
    .where(and(gte(leaveApplications.effectiveFrom, startAd), lte(leaveApplications.effectiveFrom, endAd), scopeCondition));
  return { applications: row?.applications ?? 0, approved: row?.approved ?? 0, days: Number(row?.days ?? 0) };
}

/** Case counts only — never titles or text (the register is confidential). */
export async function caseFacts(startAd: string, endAd: string, scopeCondition?: SQL<unknown>): Promise<{ disciplinary: number; grievance: number; open: number }> {
  const db = await getDb();
  const [row] = await db
    .select({
      disciplinary: sql<number>`count(*) FILTER (WHERE ${hrCases.category} = 'disciplinary')::int`,
      grievance: sql<number>`count(*) FILTER (WHERE ${hrCases.category} = 'grievance')::int`,
      open: sql<number>`count(*) FILTER (WHERE ${hrCases.status} IN ('open','investigating'))::int`,
    })
    .from(hrCases)
    .innerJoin(employees, eq(hrCases.employeeId, employees.id))
    .where(and(sql`${hrCases.openedAt}::date >= ${startAd}`, sql`${hrCases.openedAt}::date <= ${endAd}`, scopeCondition));
  return { disciplinary: row?.disciplinary ?? 0, grievance: row?.grievance ?? 0, open: row?.open ?? 0 };
}

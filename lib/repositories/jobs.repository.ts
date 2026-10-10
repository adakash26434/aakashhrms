import { getDb } from '@/lib/db';
import { employees, jobRuns, roles, scheduledJobs, userRoles, users } from '@/lib/db/schema';
import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';

// Scheduled jobs (G6): Drizzle queries only. Due rules live in
// lib/engines/scheduler.engine.ts; orchestration in lib/services/jobs.service.ts.

export type JobStateRow = typeof scheduledJobs.$inferSelect;
export type JobRunRow = typeof jobRuns.$inferSelect;

/** One row per job; a new row starts on or off as its definition says (existing rows keep their switch). */
export async function ensureJobRows(jobs: readonly { code: string; enabled: boolean }[]): Promise<void> {
  const db = await getDb();
  for (const job of jobs) {
    await db.insert(scheduledJobs).values({ code: job.code, enabled: job.enabled }).onConflictDoNothing({ target: scheduledJobs.code });
  }
}

export async function jobStates(): Promise<JobStateRow[]> {
  const db = await getDb();
  return db.select().from(scheduledJobs);
}

/**
 * The once-per-day claim: flips last_run_day to today only when it is not
 * already today and the job is enabled, so two overlapping ticks never run
 * the same job twice.
 */
export async function claimJob(code: string, today: string): Promise<boolean> {
  const db = await getDb();
  const [claimed] = await db
    .update(scheduledJobs)
    .set({ lastRunDay: today, lastRunAt: new Date(), lastStatus: 'running' })
    .where(and(eq(scheduledJobs.code, code), eq(scheduledJobs.enabled, true), or(isNull(scheduledJobs.lastRunDay), ne(scheduledJobs.lastRunDay, today))))
    .returning({ id: scheduledJobs.id });
  return !!claimed;
}

export async function finishJob(code: string, status: 'ok' | 'error' | 'skipped', detail: string): Promise<void> {
  const db = await getDb();
  await db.update(scheduledJobs).set({ lastStatus: status, lastDetail: detail.slice(0, 2000) }).where(eq(scheduledJobs.code, code));
}

export async function setJobEnabled(code: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  await db.update(scheduledJobs).set({ enabled }).where(eq(scheduledJobs.code, code));
}

export async function startRun(jobCode: string): Promise<string> {
  const db = await getDb();
  const [row] = await db.insert(jobRuns).values({ jobCode }).returning({ id: jobRuns.id });
  return row.id;
}

export async function finishRun(id: string, status: 'ok' | 'error', detail: string, itemsProcessed: number): Promise<void> {
  const db = await getDb();
  await db.update(jobRuns).set({ finishedAt: new Date(), status, detail: detail.slice(0, 2000), itemsProcessed }).where(eq(jobRuns.id, id));
}

export async function recentRuns(limit = 40): Promise<JobRunRow[]> {
  const db = await getDb();
  return db.select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(limit);
}

// ---------------------------------------------------------------------------
// Reminder inputs
// ---------------------------------------------------------------------------

/** Active administrator-grade recipients for reminder emails. */
export async function adminRecipients(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(users.isActive, true), inArray(roles.slug, ['system_admin', 'office_admin', 'hr_manager', 'payroll_controller'])));
  return [...new Set(rows.map((r) => r.email).filter((e): e is string => !!e))];
}

/** F17 daily digest: active users with an email and an office role (self-service-only accounts never see the bell). */
export async function digestRecipients(): Promise<{ userId: string; email: string }[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ userId: users.id, email: users.email })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(users.isActive, true), ne(roles.scopeType, 'SELF')));
  return rows.filter((r): r is { userId: string; email: string } => !!r.email && r.email.includes('@'));
}

export async function probationEmployees() {
  const db = await getDb();
  return db
    .select({
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      category: employees.category,
      confirmationDate: employees.confirmationDate,
      joiningDate: employees.joiningDate,
      status: employees.status,
    })
    .from(employees)
    .where(and(eq(employees.status, 'Active'), ne(employees.category, 'Permanent'), isNull(employees.confirmationDate)));
}

export async function birthdayEmployees() {
  const db = await getDb();
  return db
    .select({ fullName: employees.fullName, employeeCode: employees.employeeCode, dateOfBirth: employees.dateOfBirth, status: employees.status })
    .from(employees)
    .where(and(eq(employees.status, 'Active'), sql`${employees.dateOfBirth} IS NOT NULL`));
}

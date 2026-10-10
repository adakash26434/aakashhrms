import { getDb } from "@/lib/db";
import { branches, shiftAssignments, shiftRoster, shifts } from "@/lib/db/schema";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { ShiftColor, ShiftDefinition, ShiftKind, ShiftSeason, ShiftWeekDay } from "@/lib/types/attendance";

// Shifts (4.5b): definitions, dated assignments, the roster and branch
// defaults. Queries only; the rules live in lib/engines/shift.engine.ts.

type ShiftRow = typeof shifts.$inferSelect;

const toDefinition = (r: ShiftRow): ShiftDefinition => ({
  id: r.id,
  code: r.code,
  name: r.name,
  color: r.color as ShiftColor,
  kind: r.kind as ShiftKind,
  start: r.startTime,
  end: r.endTime,
  breakMinutes: r.breakMinutes,
  graceMinutes: r.graceMinutes,
  fullDayMinutes: r.fullDayMinutes,
  halfDayMinutes: r.halfDayMinutes,
  otMinimumMinutes: r.otMinimumMinutes,
  week: (Array.isArray(r.week) ? r.week : []) as ShiftWeekDay[],
  seasons: (Array.isArray(r.seasons) ? r.seasons : []) as ShiftSeason[],
  allowancePerDay: Number(r.allowancePerDay) || 0,
  isDefault: r.isDefault,
  active: r.active,
});

export interface ShiftWrite {
  code: string;
  name: string;
  color: string;
  kind: string;
  start: string;
  end: string;
  breakMinutes: number;
  graceMinutes: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  otMinimumMinutes: number;
  week: ShiftWeekDay[];
  seasons: ShiftSeason[];
  allowancePerDay: number;
}

const columns = (s: ShiftWrite) => ({
  code: s.code,
  name: s.name,
  color: s.color,
  kind: s.kind,
  startTime: s.start,
  endTime: s.end,
  breakMinutes: s.breakMinutes,
  graceMinutes: s.graceMinutes,
  fullDayMinutes: s.fullDayMinutes,
  halfDayMinutes: s.halfDayMinutes,
  otMinimumMinutes: s.otMinimumMinutes,
  week: s.week,
  seasons: s.seasons,
  allowancePerDay: String(s.allowancePerDay),
});

/** Every shift (archived included), default first. */
export async function findShifts(): Promise<ShiftDefinition[]> {
  const rows = await (await getDb()).select().from(shifts).orderBy(sql`${shifts.isDefault} desc`, asc(shifts.code));
  return rows.map(toDefinition);
}

export async function findShiftById(id: string): Promise<ShiftDefinition | null> {
  const [r] = await (await getDb()).select().from(shifts).where(eq(shifts.id, id)).limit(1);
  return r ? toDefinition(r) : null;
}

export async function findShiftByCode(code: string): Promise<ShiftDefinition | null> {
  const [r] = await (await getDb()).select().from(shifts).where(eq(shifts.code, code)).limit(1);
  return r ? toDefinition(r) : null;
}

/** Creates the default shift once (concurrent first reads: the unique default index keeps one). */
export async function createDefaultShift(s: ShiftWrite): Promise<void> {
  await (await getDb())
    .insert(shifts)
    .values({ ...columns(s), isDefault: true })
    .onConflictDoNothing();
}

export async function countShifts(): Promise<number> {
  const [r] = await (await getDb()).select({ n: sql<number>`count(*)::int` }).from(shifts);
  return r?.n ?? 0;
}

export async function insertShift(s: ShiftWrite, userId: string): Promise<string> {
  const [r] = await (await getDb())
    .insert(shifts)
    .values({ ...columns(s), createdBy: userId, updatedBy: userId })
    .returning({ id: shifts.id });
  return r.id;
}

export async function updateShift(id: string, s: ShiftWrite, userId: string): Promise<boolean> {
  const rows = await (await getDb())
    .update(shifts)
    .set({ ...columns(s), updatedBy: userId, updatedAt: new Date() })
    .where(eq(shifts.id, id))
    .returning({ id: shifts.id });
  return rows.length > 0;
}

/** Makes a shift the company default (one transaction: the old default stops being one first). */
export async function setDefaultShift(id: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(shifts).set({ isDefault: false, updatedBy: userId, updatedAt: new Date() }).where(eq(shifts.isDefault, true));
    await tx.update(shifts).set({ isDefault: true, active: true, updatedBy: userId, updatedAt: new Date() }).where(eq(shifts.id, id));
  });
}

export async function setShiftActive(id: string, active: boolean, userId: string): Promise<boolean> {
  const rows = await (await getDb())
    .update(shifts)
    .set({ active, updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(shifts.id, id), eq(shifts.isDefault, false)))
    .returning({ id: shifts.id });
  return rows.length > 0;
}

/** Where a shift is still in use from a date on: ongoing or future assignments, roster days, branch defaults. */
export async function shiftUseFrom(id: string, fromDate: string): Promise<{ assignments: number; rosterDays: number; branches: number }> {
  const db = await getDb();
  const [[a], [r], [b]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(shiftAssignments)
      .where(and(eq(shiftAssignments.shiftId, id), or(isNull(shiftAssignments.toDate), gte(shiftAssignments.toDate, fromDate)))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(shiftRoster)
      .where(and(eq(shiftRoster.shiftId, id), gte(shiftRoster.rosterDate, fromDate))),
    db.select({ n: sql<number>`count(*)::int` }).from(branches).where(eq(branches.defaultShiftId, id)),
  ]);
  return { assignments: a?.n ?? 0, rosterDays: r?.n ?? 0, branches: b?.n ?? 0 };
}

// ---------------------------------------------------------------------------
// Branch defaults
// ---------------------------------------------------------------------------

export async function findBranchDefaults(): Promise<Map<string, string | null>> {
  const rows = await (await getDb()).select({ id: branches.id, shiftId: branches.defaultShiftId }).from(branches);
  return new Map(rows.map((r) => [r.id, r.shiftId]));
}

export async function setBranchDefault(branchId: string, shiftId: string | null): Promise<boolean> {
  const rows = await (await getDb()).update(branches).set({ defaultShiftId: shiftId }).where(eq(branches.id, branchId)).returning({ id: branches.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export interface AssignmentRow {
  id: string;
  employeeId: string;
  shiftId: string;
  from: string;
  to: string | null;
  note: string | null;
}

/** Assignments that touch a date range. */
export async function findAssignments(employeeIds: string[], from: string, to: string): Promise<AssignmentRow[]> {
  if (!employeeIds.length) return [];
  const rows = await (await getDb())
    .select()
    .from(shiftAssignments)
    .where(and(inArray(shiftAssignments.employeeId, employeeIds), lte(shiftAssignments.fromDate, to), or(isNull(shiftAssignments.toDate), gte(shiftAssignments.toDate, from))))
    .orderBy(asc(shiftAssignments.employeeId), asc(shiftAssignments.fromDate));
  return rows.map((r) => ({ id: r.id, employeeId: r.employeeId, shiftId: r.shiftId, from: String(r.fromDate).slice(0, 10), to: r.toDate ? String(r.toDate).slice(0, 10) : null, note: r.note }));
}

/** Everyone's assignment on one day (for the people count). */
export async function findAssignmentsOn(date: string): Promise<{ employeeId: string; shiftId: string }[]> {
  return (await getDb())
    .select({ employeeId: shiftAssignments.employeeId, shiftId: shiftAssignments.shiftId })
    .from(shiftAssignments)
    .where(and(lte(shiftAssignments.fromDate, date), or(isNull(shiftAssignments.toDate), gte(shiftAssignments.toDate, date))));
}

/**
 * Gives employees a shift from a date (to a date, or ongoing), in one
 * transaction: their assignments inside the new period are removed, one
 * that starts before it ends the day before, one that runs past its end
 * continues the day after.
 */
export async function assign(rows: { employeeId: string; shiftId: string; from: string; to: string | null; note: string | null }[], userId: string): Promise<void> {
  if (!rows.length) return;
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const existing = await tx
        .select()
        .from(shiftAssignments)
        .where(and(eq(shiftAssignments.employeeId, r.employeeId), or(isNull(shiftAssignments.toDate), gte(shiftAssignments.toDate, r.from)), r.to ? lte(shiftAssignments.fromDate, r.to) : undefined));
      for (const e of existing) {
        const eFrom = String(e.fromDate).slice(0, 10);
        const eTo = e.toDate ? String(e.toDate).slice(0, 10) : null;
        const startsBefore = eFrom < r.from;
        const runsPast = r.to !== null && (eTo === null || eTo > r.to);
        if (startsBefore) await tx.update(shiftAssignments).set({ toDate: dayBefore(r.from) }).where(eq(shiftAssignments.id, e.id));
        else if (!runsPast) await tx.delete(shiftAssignments).where(eq(shiftAssignments.id, e.id));
        if (runsPast) {
          if (startsBefore) await tx.insert(shiftAssignments).values({ employeeId: e.employeeId, shiftId: e.shiftId, fromDate: dayAfter(r.to!), toDate: eTo, note: e.note, createdBy: e.createdBy });
          else await tx.update(shiftAssignments).set({ fromDate: dayAfter(r.to!) }).where(eq(shiftAssignments.id, e.id));
        }
      }
      await tx.insert(shiftAssignments).values({ employeeId: r.employeeId, shiftId: r.shiftId, fromDate: r.from, toDate: r.to, note: r.note, createdBy: userId });
    }
  });
}

const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const dayAfter = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export interface RosterEntry {
  employeeId: string;
  date: string;
  shiftId: string | null;
  off: boolean;
  note: string | null;
}

export async function findRoster(employeeIds: string[], from: string, to: string): Promise<RosterEntry[]> {
  if (!employeeIds.length) return [];
  const rows = await (await getDb())
    .select()
    .from(shiftRoster)
    .where(and(inArray(shiftRoster.employeeId, employeeIds), gte(shiftRoster.rosterDate, from), lte(shiftRoster.rosterDate, to)));
  return rows.map((r) => ({ employeeId: r.employeeId, date: String(r.rosterDate).slice(0, 10), shiftId: r.shiftId, off: r.isOff, note: r.note }));
}

/** Sets roster days (a shift or OFF) or clears them (back to the usual shift), in one transaction. */
export async function setRoster(cells: { employeeId: string; date: string; shiftId: string | null; off: boolean; clear: boolean }[], note: string | null, userId: string): Promise<void> {
  if (!cells.length) return;
  const db = await getDb();
  const now = new Date();
  const clears = cells.filter((c) => c.clear);
  const sets = cells.filter((c) => !c.clear).map((c) => ({ employeeId: c.employeeId, rosterDate: c.date, shiftId: c.off ? null : c.shiftId, isOff: c.off, note, createdBy: userId, createdAt: now }));
  await db.transaction(async (tx) => {
    for (const c of clears) await tx.delete(shiftRoster).where(and(eq(shiftRoster.employeeId, c.employeeId), eq(shiftRoster.rosterDate, c.date)));
    for (let i = 0; i < sets.length; i += 500) {
      await tx
        .insert(shiftRoster)
        .values(sets.slice(i, i + 500))
        .onConflictDoUpdate({
          target: [shiftRoster.employeeId, shiftRoster.rosterDate],
          set: { shiftId: sql`excluded.shift_id`, isOff: sql`excluded.is_off`, note: sql`excluded.note`, createdBy: sql`excluded.created_by`, createdAt: sql`excluded.created_at` },
        });
    }
  });
}

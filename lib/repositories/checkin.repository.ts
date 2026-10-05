import { getDb } from "@/lib/db";
import { attendanceAdjustments, attendanceCheckinExceptions, attendancePunches, branches, employees } from "@/lib/db/schema";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { CheckinRule } from "@/lib/engines/checkin.engine";

// Web clock-in (4.5c): branch rules, the allowed-anywhere list, and one
// employee's punches and remote requests around a day. Queries only; the
// rules live in lib/engines/checkin.engine.ts.

export interface BranchCheckinRow {
  id: string;
  name: string;
  rule: CheckinRule;
  networks: string[];
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
}

const num = (v: string | null) => (v === null || v === undefined ? null : Number(v));

export async function findBranchCheckins(): Promise<BranchCheckinRow[]> {
  const rows = await (await getDb())
    .select({
      id: branches.id,
      name: branches.name,
      rule: branches.checkinRule,
      networks: branches.checkinNetworks,
      latitude: branches.latitude,
      longitude: branches.longitude,
      radiusM: branches.checkinRadiusM,
    })
    .from(branches)
    .orderBy(asc(branches.name));
  return rows.map((r) => ({ ...r, rule: r.rule as CheckinRule, networks: r.networks ?? [], latitude: num(r.latitude), longitude: num(r.longitude) }));
}

export async function findBranchCheckin(branchId: string): Promise<BranchCheckinRow | null> {
  return (await findBranchCheckins()).find((b) => b.id === branchId) ?? null;
}

export async function saveBranchCheckin(branchId: string, v: { rule: CheckinRule; networks: string[]; latitude: number | null; longitude: number | null; radiusM: number }): Promise<boolean> {
  const rows = await (await getDb())
    .update(branches)
    .set({
      checkinRule: v.rule,
      checkinNetworks: v.networks,
      latitude: v.latitude === null ? null : String(v.latitude),
      longitude: v.longitude === null ? null : String(v.longitude),
      checkinRadiusM: v.radiusM,
    })
    .where(eq(branches.id, branchId))
    .returning({ id: branches.id });
  return rows.length > 0;
}

/** Active employees per branch (the Check-in tab's people column). */
export async function countActiveByBranch(): Promise<Map<string, number>> {
  const rows = await (await getDb())
    .select({ branchId: employees.branchId, n: sql<number>`count(*)::int` })
    .from(employees)
    .where(eq(employees.status, "Active"))
    .groupBy(employees.branchId);
  return new Map(rows.map((r) => [r.branchId, r.n]));
}

// ---------------------------------------------------------------------------
// Allowed from anywhere
// ---------------------------------------------------------------------------

export async function findExceptions(): Promise<{ id: string; employeeId: string; employeeName: string; employeeCode: string; from: string; to: string | null; reason: string }[]> {
  const rows = await (await getDb())
    .select({
      id: attendanceCheckinExceptions.id,
      employeeId: attendanceCheckinExceptions.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      from: attendanceCheckinExceptions.fromDate,
      to: attendanceCheckinExceptions.toDate,
      reason: attendanceCheckinExceptions.reason,
    })
    .from(attendanceCheckinExceptions)
    .innerJoin(employees, eq(employees.id, attendanceCheckinExceptions.employeeId))
    .orderBy(asc(employees.fullName));
  return rows.map((r) => ({ ...r, from: String(r.from).slice(0, 10), to: r.to ? String(r.to).slice(0, 10) : null }));
}

/** Whether the employee may clock in from anywhere on a date. */
export async function hasException(employeeId: string, date: string): Promise<boolean> {
  const [r] = await (await getDb())
    .select({ id: attendanceCheckinExceptions.id })
    .from(attendanceCheckinExceptions)
    .where(
      and(
        eq(attendanceCheckinExceptions.employeeId, employeeId),
        lte(attendanceCheckinExceptions.fromDate, date),
        or(isNull(attendanceCheckinExceptions.toDate), gte(attendanceCheckinExceptions.toDate, date))
      )
    )
    .limit(1);
  return !!r;
}

export async function addException(row: { employeeId: string; from: string; to: string | null; reason: string; createdBy: string }): Promise<string> {
  const [r] = await (await getDb())
    .insert(attendanceCheckinExceptions)
    .values({ employeeId: row.employeeId, fromDate: row.from, toDate: row.to, reason: row.reason, createdBy: row.createdBy })
    .returning({ id: attendanceCheckinExceptions.id });
  return r.id;
}

export async function findExceptionById(id: string) {
  const [r] = await (await getDb()).select().from(attendanceCheckinExceptions).where(eq(attendanceCheckinExceptions.id, id)).limit(1);
  return r ?? null;
}

/** Removing an entry only stops future clock-ins from anywhere; punches already made stay. */
export async function removeException(id: string): Promise<boolean> {
  const rows = await (await getDb()).delete(attendanceCheckinExceptions).where(eq(attendanceCheckinExceptions.id, id)).returning({ id: attendanceCheckinExceptions.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// One employee's clocking
// ---------------------------------------------------------------------------

/** Punches (not voided) between two instants, oldest first. */
export async function findOwnPunches(employeeId: string, fromInstant: string, toInstant: string) {
  const rows = await (await getDb())
    .select({ at: attendancePunches.punchedAt, kind: attendancePunches.kind, source: attendancePunches.source, note: attendancePunches.note })
    .from(attendancePunches)
    .where(and(eq(attendancePunches.employeeId, employeeId), gte(attendancePunches.punchedAt, new Date(fromInstant)), lte(attendancePunches.punchedAt, new Date(toInstant)), isNull(attendancePunches.voidedAt)))
    .orderBy(asc(attendancePunches.punchedAt));
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
}

/** Remote clock-ins between two instants (waiting, approved or rejected), oldest first. */
export async function findOwnRemote(employeeId: string, fromInstant: string, toInstant: string) {
  const at = sql<Date>`coalesce(${attendanceAdjustments.requestedIn}, ${attendanceAdjustments.requestedOut})`;
  const rows = await (await getDb())
    .select({ id: attendanceAdjustments.id, kind: attendanceAdjustments.kind, status: attendanceAdjustments.status, reason: attendanceAdjustments.reason, requestedIn: attendanceAdjustments.requestedIn, requestedOut: attendanceAdjustments.requestedOut })
    .from(attendanceAdjustments)
    .where(
      and(
        eq(attendanceAdjustments.employeeId, employeeId),
        inArray(attendanceAdjustments.kind, ["remote_in", "remote_out"]),
        // A computed time: the bounds go as text with an explicit cast (a bare Date param can't be typed here).
        sql`${at} >= ${fromInstant}::timestamptz`,
        sql`${at} <= ${toInstant}::timestamptz`
      )
    )
    .orderBy(asc(at));
  return rows.map((r) => ({ id: r.id, kind: r.kind as "remote_in" | "remote_out", status: r.status, reason: r.reason, at: (r.requestedIn ?? r.requestedOut)!.toISOString() }));
}

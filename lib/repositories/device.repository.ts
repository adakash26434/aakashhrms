import { getDb } from '@/lib/db';
import { attendanceDevices, attendancePunches, branches, deviceUnmatchedPunches, deviceUsers, employees } from '@/lib/db/schema';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

// Attendance devices (G3): Drizzle queries only. ADMS parsing lives in
// lib/engines/device.engine.ts; orchestration in lib/services/device.service.ts.

export type DeviceRow = typeof attendanceDevices.$inferSelect;

export interface DeviceJoinedRow extends DeviceRow {
  branch: string;
  mappedUsers: number;
  unmatchedCount: number;
}

export async function findDeviceBySerial(serialNo: string): Promise<DeviceRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(attendanceDevices).where(eq(attendanceDevices.serialNo, serialNo)).limit(1);
  return row ?? null;
}

export async function findDeviceById(id: string): Promise<DeviceRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(attendanceDevices).where(eq(attendanceDevices.id, id)).limit(1);
  return row ?? null;
}

export async function listDevices(branchIds?: string[]): Promise<DeviceJoinedRow[]> {
  const db = await getDb();
  const where = branchIds && branchIds.length ? inArray(attendanceDevices.branchId, branchIds) : undefined;
  const rows = await db
    .select({
      device: attendanceDevices,
      branch: branches.name,
      mappedUsers: sql<number>`(SELECT count(*)::int FROM ${deviceUsers} du WHERE du."device_id" = ${attendanceDevices.id})`,
      unmatchedCount: sql<number>`(SELECT count(*)::int FROM ${deviceUnmatchedPunches} up WHERE up."device_id" = ${attendanceDevices.id})`,
    })
    .from(attendanceDevices)
    .innerJoin(branches, eq(attendanceDevices.branchId, branches.id))
    .where(where)
    .orderBy(asc(attendanceDevices.name));
  return rows.map((r) => ({ ...r.device, branch: r.branch, mappedUsers: r.mappedUsers, unmatchedCount: r.unmatchedCount }));
}

export interface DeviceWrite {
  name: string;
  branchId: string;
  serialNo: string;
  enabled: boolean;
  tzOffsetMinutes: number;
}

export async function insertDevice(data: DeviceWrite, userId: string): Promise<DeviceRow> {
  const db = await getDb();
  const [row] = await db.insert(attendanceDevices).values({ ...data, createdBy: userId, updatedBy: userId }).returning();
  return row;
}

export async function updateDevice(id: string, data: DeviceWrite, userId: string): Promise<DeviceRow | null> {
  const db = await getDb();
  const [row] = await db.update(attendanceDevices).set({ ...data, updatedBy: userId }).where(eq(attendanceDevices.id, id)).returning();
  return row ?? null;
}

/** Called on every handshake / poll / push, so the health card is honest. */
export async function touchDevice(id: string, lastPunchAt?: Date): Promise<void> {
  const db = await getDb();
  await db
    .update(attendanceDevices)
    .set({ lastSeenAt: new Date(), ...(lastPunchAt ? { lastPunchAt } : {}) })
    .where(eq(attendanceDevices.id, id));
}

// ---------------------------------------------------------------------------
// PIN mapping
// ---------------------------------------------------------------------------

export interface DeviceUserJoinedRow {
  id: string;
  deviceUserId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
}

export async function listDeviceUsers(deviceId: string): Promise<DeviceUserJoinedRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: deviceUsers.id, deviceUserId: deviceUsers.deviceUserId, employeeId: deviceUsers.employeeId, employeeName: employees.fullName, employeeCode: employees.employeeCode })
    .from(deviceUsers)
    .innerJoin(employees, eq(deviceUsers.employeeId, employees.id))
    .where(eq(deviceUsers.deviceId, deviceId))
    .orderBy(asc(sql`${deviceUsers.deviceUserId}::text`));
  return rows;
}

export async function pinMapFor(deviceId: string): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db.select({ pin: deviceUsers.deviceUserId, employeeId: deviceUsers.employeeId }).from(deviceUsers).where(eq(deviceUsers.deviceId, deviceId));
  return new Map(rows.map((r) => [r.pin, r.employeeId]));
}

export async function unmapDeviceUser(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(deviceUsers).where(eq(deviceUsers.id, id));
}

// ---------------------------------------------------------------------------
// Punches
// ---------------------------------------------------------------------------

export interface PunchInsert {
  employeeId: string;
  punchedAt: Date;
  deviceSerial: string;
}

/** Idempotent through the (employee, instant, source) unique key. */
export async function insertDevicePunches(punches: PunchInsert[]): Promise<number> {
  if (!punches.length) return 0;
  const db = await getDb();
  let inserted = 0;
  for (const p of punches) {
    const rows = await db
      .insert(attendancePunches)
      .values({ employeeId: p.employeeId, punchedAt: p.punchedAt, kind: 'auto', source: 'device', deviceId: p.deviceSerial })
      .onConflictDoNothing({ target: [attendancePunches.employeeId, attendancePunches.punchedAt, attendancePunches.source] })
      .returning({ id: attendancePunches.id });
    inserted += rows.length;
  }
  return inserted;
}

export interface UnmatchedInsert {
  deviceId: string;
  deviceUserId: string;
  punchedAt: Date;
  raw: string;
}

export async function insertUnmatched(rows: UnmatchedInsert[]): Promise<number> {
  if (!rows.length) return 0;
  const db = await getDb();
  let inserted = 0;
  for (const r of rows) {
    const out = await db
      .insert(deviceUnmatchedPunches)
      .values(r)
      .onConflictDoNothing({ target: [deviceUnmatchedPunches.deviceId, deviceUnmatchedPunches.deviceUserId, deviceUnmatchedPunches.punchedAt] })
      .returning({ id: deviceUnmatchedPunches.id });
    inserted += out.length;
  }
  return inserted;
}

export interface UnmatchedSummaryRow {
  deviceId: string;
  deviceName: string;
  deviceSerial: string;
  deviceUserId: string;
  punchCount: number;
  firstAt: Date;
  lastAt: Date;
}

/** Unknown PINs grouped per device, for the mapping screen. */
export async function unmatchedSummary(branchIds?: string[]): Promise<UnmatchedSummaryRow[]> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (branchIds && branchIds.length) conditions.push(inArray(attendanceDevices.branchId, branchIds));
  const rows = await db
    .select({
      deviceId: deviceUnmatchedPunches.deviceId,
      deviceName: attendanceDevices.name,
      deviceSerial: attendanceDevices.serialNo,
      deviceUserId: deviceUnmatchedPunches.deviceUserId,
      punchCount: sql<number>`count(*)::int`,
      firstAt: sql<Date>`min(${deviceUnmatchedPunches.punchedAt})`,
      lastAt: sql<Date>`max(${deviceUnmatchedPunches.punchedAt})`,
    })
    .from(deviceUnmatchedPunches)
    .innerJoin(attendanceDevices, eq(deviceUnmatchedPunches.deviceId, attendanceDevices.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(deviceUnmatchedPunches.deviceId, attendanceDevices.name, attendanceDevices.serialNo, deviceUnmatchedPunches.deviceUserId)
    .orderBy(desc(sql`max(${deviceUnmatchedPunches.punchedAt})`))
    .limit(500);
  return rows;
}

/**
 * Maps a PIN to an employee and claims its waiting punches, in one
 * transaction: upsert the mapping, move the punches, delete the holding rows.
 */
export async function mapPinAndClaimTx(deviceId: string, deviceUserId: string, employeeId: string, deviceSerial: string, userId: string): Promise<number> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx
      .insert(deviceUsers)
      .values({ deviceId, deviceUserId, employeeId, createdBy: userId })
      .onConflictDoUpdate({ target: [deviceUsers.deviceId, deviceUsers.deviceUserId], set: { employeeId, createdBy: userId } });
    const waiting = await tx
      .select()
      .from(deviceUnmatchedPunches)
      .where(and(eq(deviceUnmatchedPunches.deviceId, deviceId), eq(deviceUnmatchedPunches.deviceUserId, deviceUserId)));
    let claimed = 0;
    for (const p of waiting) {
      const rows = await tx
        .insert(attendancePunches)
        .values({ employeeId, punchedAt: p.punchedAt, kind: 'auto', source: 'device', deviceId: deviceSerial })
        .onConflictDoNothing({ target: [attendancePunches.employeeId, attendancePunches.punchedAt, attendancePunches.source] })
        .returning({ id: attendancePunches.id });
      claimed += rows.length;
    }
    await tx.delete(deviceUnmatchedPunches).where(and(eq(deviceUnmatchedPunches.deviceId, deviceId), eq(deviceUnmatchedPunches.deviceUserId, deviceUserId)));
    return claimed;
  });
}

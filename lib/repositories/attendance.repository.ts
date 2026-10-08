import { getDb } from "@/lib/db";
import {
  approvalActions,
  attendanceAdjustments,
  attendancePeriods,
  attendancePunches,
  attendanceRecords,
  employeeTermination,
  employees,
  employmentTypes,
  fiscalYears,
  holidays,
  leaveOtCalculations,
  payrollRuns,
  systemConfig,
} from "@/lib/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { ApprovalActionKind, ApprovalRoute } from "@/lib/types/approval";
import type { DayResult, MonthSummary, OverrideType, PunchSource } from "@/lib/types/attendance";
import { postLedgerLines, type NewLedgerLine } from "@/lib/repositories/leave.repository";

// Attendance (4.5): punches, HR overrides, daily results, adjustments
// (regularization), attendance months per branch and the month summaries
// payroll reads. Queries only; the rules live in lib/engines.

export const MODULE = "ATTENDANCE";
const RULES_KEY = "attendance.rules";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** The stored attendance-only rules (JSON), or null when never saved. */
export async function getRulesJson(): Promise<unknown> {
  const [row] = await (await getDb()).select({ value: systemConfig.value }).from(systemConfig).where(eq(systemConfig.key, RULES_KEY)).limit(1);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export async function setRulesJson(value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  await (await getDb())
    .insert(systemConfig)
    .values({ key: RULES_KEY, value: text, dataType: "json" })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: text, dataType: "json", updatedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// People and the calendar
// ---------------------------------------------------------------------------

export interface AttendanceEmployee {
  id: string;
  employeeCode: string;
  attendanceCode: string;
  fullName: string;
  gender: string;
  branchId: string;
  departmentId: string;
  designationId: string;
  category: string;
  joiningDate: string;
  status: string;
  supervisorId: string | null;
  terminationDate: string | null;
}

/** Employees (within a scope condition), with their last working date when they have left. */
export async function findEmployees(condition?: SQL): Promise<AttendanceEmployee[]> {
  const rows = await (await getDb())
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      attendanceCode: employees.attendanceCode,
      fullName: employees.fullName,
      gender: employees.gender,
      branchId: employees.branchId,
      departmentId: employees.departmentId,
      designationId: employees.designationId,
      category: employees.category,
      joiningDate: employees.joiningDate,
      status: employees.status,
      supervisorId: employees.supervisorId,
      terminationDate: sql<string | null>`(select max(${employeeTermination.terminationDate})::text from ${employeeTermination} where ${employeeTermination.employeeId} = ${employees.id})`,
    })
    .from(employees)
    .where(condition)
    .orderBy(asc(employees.fullName));
  return rows.map((r) => ({ ...r, joiningDate: String(r.joiningDate).slice(0, 10), supervisorId: r.supervisorId ?? null, terminationDate: r.terminationDate ? String(r.terminationDate).slice(0, 10) : null }));
}

/** Some employees by id (callers check access first). */
export async function findEmployeesByIds(ids: string[]): Promise<AttendanceEmployee[]> {
  if (!ids.length) return [];
  return findEmployees(inArray(employees.id, ids));
}

/** Employment type name → overtime allowed. */
export async function findOtEligibility(): Promise<Map<string, boolean>> {
  const rows = await (await getDb()).select({ name: employmentTypes.name, ot: employmentTypes.isOtEligible }).from(employmentTypes);
  return new Map(rows.map((r) => [r.name, r.ot]));
}

/** Holidays overlapping a range (AD dates), with the branches they apply to (none = all). */
export async function findHolidays(from: string, to: string) {
  const rows = await (await getDb())
    .select({ name: holidays.name, start: holidays.startDateAD, end: holidays.endDateAD, branchIds: holidays.branchIds })
    .from(holidays)
    .where(and(lte(holidays.startDateAD, new Date(`${to}T23:59:59Z`)), gte(holidays.endDateAD, new Date(`${from}T00:00:00Z`))));
  // Holiday dates are stored as local-midnight timestamps; read the calendar day back in Nepal time.
  const day = (d: Date) => new Date(d.getTime() + 345 * 60000).toISOString().slice(0, 10);
  return rows.map((r) => ({ name: r.name, start: day(r.start), end: day(r.end), branchIds: r.branchIds ?? [] }));
}

/** The fiscal year an AD date falls in (falls back to the active one). */
export async function fiscalYearFor(date: string): Promise<string> {
  const db = await getDb();
  const at = new Date(`${date}T06:00:00Z`);
  const [hit] = await db.select({ id: fiscalYears.id }).from(fiscalYears).where(and(lte(fiscalYears.startDateAD, at), gte(fiscalYears.endDateAD, at))).limit(1);
  if (hit) return hit.id;
  const [active] = await db.select({ id: fiscalYears.id }).from(fiscalYears).where(eq(fiscalYears.status, "Active")).limit(1);
  if (active) return active.id;
  throw new Error("No fiscal year exists yet. Create one in Company setup first.");
}

// ---------------------------------------------------------------------------
// Punches
// ---------------------------------------------------------------------------

export interface PunchRow {
  id: string;
  employeeId: string;
  punchedAt: string;
  kind: string;
  source: PunchSource;
  deviceId: string | null;
  ip: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

/** Punches between two instants (voided ones only when asked). */
export async function findPunches(employeeIds: string[], fromInstant: string, toInstant: string, opts: { includeVoided?: boolean } = {}): Promise<PunchRow[]> {
  if (!employeeIds.length) return [];
  const rows = await (await getDb())
    .select()
    .from(attendancePunches)
    .where(
      and(
        inArray(attendancePunches.employeeId, employeeIds),
        gte(attendancePunches.punchedAt, new Date(fromInstant)),
        lte(attendancePunches.punchedAt, new Date(toInstant)),
        opts.includeVoided ? undefined : isNull(attendancePunches.voidedAt)
      )
    )
    .orderBy(asc(attendancePunches.punchedAt));
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    punchedAt: r.punchedAt.toISOString(),
    kind: r.kind,
    source: r.source as PunchSource,
    deviceId: r.deviceId,
    ip: r.ip,
    latitude: r.latitude === null ? null : Number(r.latitude),
    longitude: r.longitude === null ? null : Number(r.longitude),
    accuracyM: r.accuracyM,
    note: r.note,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    voidedAt: r.voidedAt ? r.voidedAt.toISOString() : null,
    voidReason: r.voidReason,
  }));
}

export interface NewPunch {
  employeeId: string;
  punchedAt: string;
  kind: "in" | "out" | "auto";
  source: PunchSource;
  deviceId?: string | null;
  ip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  note?: string | null;
  createdBy: string | null;
}

/** Adds punches; an identical punch (employee, time, source) is ignored. Returns how many were added. */
export async function insertPunches(rows: NewPunch[]): Promise<number> {
  if (!rows.length) return 0;
  const added = await (await getDb())
    .insert(attendancePunches)
    .values(
      rows.map((r) => ({
        employeeId: r.employeeId,
        punchedAt: new Date(r.punchedAt),
        kind: r.kind,
        source: r.source,
        deviceId: r.deviceId ?? null,
        ip: r.ip ?? null,
        latitude: r.latitude === null || r.latitude === undefined ? null : String(r.latitude),
        longitude: r.longitude === null || r.longitude === undefined ? null : String(r.longitude),
        accuracyM: r.accuracyM ?? null,
        note: r.note ?? null,
        createdBy: r.createdBy,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: attendancePunches.id });
  return added.length;
}

export async function findPunchById(id: string) {
  const [row] = await (await getDb()).select().from(attendancePunches).where(eq(attendancePunches.id, id)).limit(1);
  return row ?? null;
}

/** Voids a punch (kept, with who and why). False when it was already voided. */
export async function voidPunch(id: string, userId: string, reason: string): Promise<boolean> {
  const rows = await (await getDb())
    .update(attendancePunches)
    .set({ voidedAt: new Date(), voidedBy: userId, voidReason: reason })
    .where(and(eq(attendancePunches.id, id), isNull(attendancePunches.voidedAt)))
    .returning({ id: attendancePunches.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Overrides and daily results
// ---------------------------------------------------------------------------

/** HR overrides in a range: employeeId|date → type and reason. */
export async function findOverrides(employeeIds: string[], from: string, to: string) {
  if (!employeeIds.length) return new Map<string, { type: OverrideType; reason: string }>();
  const rows = await (await getDb())
    .select({ employeeId: attendanceRecords.employeeId, date: attendanceRecords.attendanceDate, type: attendanceRecords.overrideType, reason: attendanceRecords.overrideReason })
    .from(attendanceRecords)
    .where(and(inArray(attendanceRecords.employeeId, employeeIds), gte(attendanceRecords.attendanceDate, from), lte(attendanceRecords.attendanceDate, to), isNotNull(attendanceRecords.overrideType)));
  return new Map(rows.map((r) => [`${r.employeeId}|${String(r.date).slice(0, 10)}`, { type: r.type as OverrideType, reason: r.reason ?? "" }]));
}

/** Legacy status words still read by older screens (dashboard, employee record) until they move to the engine. */
export const LEGACY_STATUS: Record<DayResult["dayType"], string> = {
  present: "Present",
  half_day: "Half Day",
  absent: "Absent",
  missing_punch: "Absent",
  on_duty: "Present",
  paid_leave: "On Leave",
  unpaid_leave: "LWOP",
  holiday: "Holiday",
  weekly_off: "Weekly Off",
  not_employed: "Absent",
  upcoming: "Absent",
};

/**
 * Sets (or clears, with type null) HR overrides for employee-days. A day
 * row is created when needed; clearing keeps the row but removes the override.
 */
export async function setOverrides(rows: { employeeId: string; date: string; type: OverrideType | null; reason: string; fiscalYearId: string }[], userId: string): Promise<void> {
  if (!rows.length) return;
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const now = new Date();
      await tx
        .insert(attendanceRecords)
        .values({
          employeeId: r.employeeId,
          fiscalYearId: r.fiscalYearId,
          attendanceDate: r.date,
          status: r.type ? LEGACY_STATUS[r.type] : "Absent",
          isManualEntry: true,
          overrideType: r.type,
          overrideReason: r.type ? r.reason : null,
          overrideBy: r.type ? userId : null,
          overrideAt: r.type ? now : null,
        })
        .onConflictDoUpdate({
          target: [attendanceRecords.employeeId, attendanceRecords.attendanceDate],
          set: {
            overrideType: r.type,
            overrideReason: r.type ? r.reason : null,
            overrideBy: r.type ? userId : null,
            overrideAt: r.type ? now : null,
            ...(r.type ? { status: LEGACY_STATUS[r.type] } : {}),
            isManualEntry: true,
            updatedAt: now,
          },
        });
    }
  });
}

/** Status words for days in a range (dashboard, employee record): stored results and overrides. */
export async function findAttendanceMarksInRange(fromDate: string, toDate: string, employeeCondition?: SQL): Promise<{ employeeId: string; date: string; status: string }[]> {
  const rows = await (await getDb())
    .select({ employeeId: attendanceRecords.employeeId, date: attendanceRecords.attendanceDate, status: attendanceRecords.status })
    .from(attendanceRecords)
    .where(and(gte(attendanceRecords.attendanceDate, fromDate), lte(attendanceRecords.attendanceDate, toDate), employeeCondition));
  return rows.map((r) => ({ employeeId: r.employeeId, date: String(r.date), status: r.status }));
}

/** One employee's stored day rows between two AD dates (record page, 4.2). */
export async function findAttendanceForEmployee(employeeId: string, fromDate: string, toDate: string) {
  const rows = await (await getDb())
    .select({
      date: attendanceRecords.attendanceDate,
      status: attendanceRecords.status,
      inTime: attendanceRecords.inTime,
      outTime: attendanceRecords.outTime,
      workHours: attendanceRecords.workHours,
      isLate: attendanceRecords.isLate,
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.employeeId, employeeId), gte(attendanceRecords.attendanceDate, fromDate), lte(attendanceRecords.attendanceDate, toDate)));
  return rows.map((r) => ({ ...r, date: String(r.date), workHours: Number(r.workHours) }));
}

// ---------------------------------------------------------------------------
// Adjustments (regularization)
// ---------------------------------------------------------------------------

export type AdjustmentRowDb = typeof attendanceAdjustments.$inferSelect;

export async function createAdjustment(row: {
  employeeId: string;
  date: string;
  kind: string;
  requestedIn: string | null;
  requestedOut: string | null;
  reason: string;
  source: "hr" | "self_service";
  preparedBy: string;
  /** Remote clock-in (4.5c): where it was made. */
  place?: { ip: string | null; latitude: number | null; longitude: number | null; accuracyM: number | null; distanceM: number | null } | null;
}): Promise<string> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(attendanceAdjustments)
      .values({
        employeeId: row.employeeId,
        attendanceDate: row.date,
        kind: row.kind,
        requestedIn: row.requestedIn ? new Date(row.requestedIn) : null,
        requestedOut: row.requestedOut ? new Date(row.requestedOut) : null,
        reason: row.reason,
        source: row.source,
        preparedBy: row.preparedBy,
        approvalType: "simple",
        ip: row.place?.ip ?? null,
        latitude: row.place?.latitude === null || row.place?.latitude === undefined ? null : String(row.place.latitude),
        longitude: row.place?.longitude === null || row.place?.longitude === undefined ? null : String(row.place.longitude),
        accuracyM: row.place?.accuracyM ?? null,
        distanceM: row.place?.distanceM ?? null,
      })
      .returning({ id: attendanceAdjustments.id });
    await tx.insert(approvalActions).values({ module: MODULE, requestId: created.id, level: 0, actorId: row.preparedBy, action: "submitted" });
    return created.id;
  });
}

export async function findAdjustments(opts: { from?: string; to?: string; status?: string; employeeIds?: string[] } = {}) {
  return (await getDb())
    .select()
    .from(attendanceAdjustments)
    .where(
      and(
        opts.from ? gte(attendanceAdjustments.attendanceDate, opts.from) : undefined,
        opts.to ? lte(attendanceAdjustments.attendanceDate, opts.to) : undefined,
        opts.status ? eq(attendanceAdjustments.status, opts.status) : undefined,
        opts.employeeIds ? (opts.employeeIds.length ? inArray(attendanceAdjustments.employeeId, opts.employeeIds) : sql`false`) : undefined
      )
    )
    .orderBy(desc(attendanceAdjustments.createdAt));
}

export async function findAdjustmentById(id: string): Promise<AdjustmentRowDb | null> {
  const [row] = await (await getDb()).select().from(attendanceAdjustments).where(eq(attendanceAdjustments.id, id)).limit(1);
  return row ?? null;
}

/** Pending adjustments for some employees in a range (they block closing the month). */
export async function countPendingAdjustments(employeeIds: string[], from: string, to: string): Promise<number> {
  if (!employeeIds.length) return 0;
  const [row] = await (await getDb())
    .select({ n: sql<number>`count(*)::int` })
    .from(attendanceAdjustments)
    .where(and(inArray(attendanceAdjustments.employeeId, employeeIds), eq(attendanceAdjustments.status, "pending"), gte(attendanceAdjustments.attendanceDate, from), lte(attendanceAdjustments.attendanceDate, to)));
  return row?.n ?? 0;
}

/**
 * Decides a pending adjustment (only while still pending). On approval its
 * punches are added in the same transaction. Null when someone else decided first.
 */
export async function decideAdjustment(params: {
  id: string;
  status: "approved" | "rejected" | "withdrawn";
  route: ApprovalRoute | null;
  actorId: string;
  onBehalfOf: string | null;
  action: ApprovalActionKind;
  note: string | null;
  punches: NewPunch[];
}): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(attendanceAdjustments)
      .set({ status: params.status, decidedBy: params.actorId, decidedAt: now, decisionNote: params.note, approvalRoute: params.status === "approved" ? params.route : null })
      .where(and(eq(attendanceAdjustments.id, params.id), eq(attendanceAdjustments.status, "pending")))
      .returning({ id: attendanceAdjustments.id });
    if (!updated.length) return false;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: params.id, level: 0, actorId: params.actorId, onBehalfOf: params.onBehalfOf, action: params.action, note: params.note, createdAt: now });
    if (params.status === "approved" && params.punches.length) {
      await tx
        .insert(attendancePunches)
        .values(params.punches.map((p) => ({ employeeId: p.employeeId, punchedAt: new Date(p.punchedAt), kind: p.kind, source: p.source, note: p.note ?? null, createdBy: p.createdBy })))
        .onConflictDoNothing();
    }
    return true;
  });
}

export async function findAdjustmentTimeline(ids: string[]) {
  if (!ids.length) return [];
  return (await getDb())
    .select()
    .from(approvalActions)
    .where(and(eq(approvalActions.module, MODULE), inArray(approvalActions.requestId, ids)))
    .orderBy(asc(approvalActions.createdAt));
}

// ---------------------------------------------------------------------------
// Attendance months (per branch) and summaries
// ---------------------------------------------------------------------------

export type PeriodRowDb = typeof attendancePeriods.$inferSelect;

export async function findPeriods(calendar: string, year: number, month: number): Promise<PeriodRowDb[]> {
  return (await getDb())
    .select()
    .from(attendancePeriods)
    .where(and(eq(attendancePeriods.calendar, calendar), eq(attendancePeriods.periodYear, year), eq(attendancePeriods.periodMonth, month)));
}

/** Closed months overlapping a date range (any branch). */
export async function findClosedPeriodsOverlapping(from: string, to: string): Promise<PeriodRowDb[]> {
  return (await getDb())
    .select()
    .from(attendancePeriods)
    .where(and(eq(attendancePeriods.status, "closed"), lte(attendancePeriods.startDate, to), gte(attendancePeriods.endDate, from)));
}

/** Payroll runs for a BS month that are approved or locked (they stop reopening attendance). */
export async function countFinalisedPayrollRuns(bsYear: number, bsMonth: number): Promise<number> {
  const [row] = await (await getDb())
    .select({ n: sql<number>`count(*)::int` })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.payPeriodYear, bsYear), eq(payrollRuns.payPeriodMonth, bsMonth), inArray(payrollRuns.status, ["APPROVED", "LOCKED"])));
  return row?.n ?? 0;
}

export interface SummaryWrite {
  employeeId: string;
  fiscalYearId: string;
  bsMonth: number;
  summary: MonthSummary;
  otEarnedAmount: number;
  /** Overtime minutes paid (4.7: each day rounded by the policy), stored as the month's OT hours. */
  otMinutes: { work: number; off: number };
  leaveDeductionAmount: number;
}

/**
 * Closes a month for a branch in one transaction: the period row, every
 * day's result (overrides kept), and each employee's summary, all locked.
 */
export async function closePeriod(params: {
  period: { calendar: string; year: number; month: number; start: string; end: string; days: number };
  branchId: string;
  userId: string;
  days: { employeeId: string; fiscalYearId: string; result: DayResult }[];
  summaries: SummaryWrite[];
  /** 4.6b: leave lines that go with the close (home leave earned, expired substitute days), in the same transaction. */
  ledger?: NewLedgerLine[];
}): Promise<void> {
  const db = await getDb();
  const { period } = params;
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .insert(attendancePeriods)
      .values({ calendar: period.calendar, periodYear: period.year, periodMonth: period.month, startDate: period.start, endDate: period.end, days: period.days, branchId: params.branchId, status: "closed", closedBy: params.userId, closedAt: now })
      .onConflictDoUpdate({
        target: [attendancePeriods.calendar, attendancePeriods.periodYear, attendancePeriods.periodMonth, attendancePeriods.branchId],
        set: { status: "closed", closedBy: params.userId, closedAt: now },
      });
    for (const d of params.days) {
      const r = d.result;
      if (r.dayType === "not_employed") continue;
      const values = {
        status: LEGACY_STATUS[r.dayType],
        dayType: r.dayType,
        payable: String(r.payable),
        unpaid: String(r.unpaid),
        firstIn: r.firstIn ? new Date(r.firstIn) : null,
        lastOut: r.lastOut ? new Date(r.lastOut) : null,
        workMinutes: r.workMinutes,
        workHours: String(Math.round((r.workMinutes / 60) * 100) / 100),
        lateMinutes: r.lateMinutes,
        isLate: r.lateMinutes > 0,
        earlyMinutes: r.earlyMinutes,
        otWorkMinutes: r.otWorkDayMinutes,
        otOffMinutes: r.otOffDayMinutes,
        otHoursOfficeDay: String(Math.round((r.otWorkDayMinutes / 60) * 100) / 100),
        otHoursOffDay: String(Math.round((r.otOffDayMinutes / 60) * 100) / 100),
        rule: r.rule,
        shiftId: r.shift?.id ?? null,
        isLocked: true,
        updatedAt: now,
      };
      await tx
        .insert(attendanceRecords)
        .values({ employeeId: d.employeeId, fiscalYearId: d.fiscalYearId, attendanceDate: r.date, ...values })
        .onConflictDoUpdate({ target: [attendanceRecords.employeeId, attendanceRecords.attendanceDate], set: values });
    }
    for (const s of params.summaries) {
      const m = s.summary;
      const values = {
        totalWorkingDays: String(m.calendarDays),
        presentDays: String(m.presentDays + m.halfDays * 0.5 + m.onDutyDays),
        absentDays: String(m.absentDays + m.missingPunchDays),
        payLeaveDays: String(m.paidLeaveDays),
        nonPayLeaveDays: String(m.unpaidLeaveDays),
        totalOtHoursOffice: String(Math.round((s.otMinutes.work / 60) * 100) / 100),
        totalOtHoursOff: String(Math.round((s.otMinutes.off / 60) * 100) / 100),
        otEarnedAmount: String(s.otEarnedAmount),
        leaveDeductionAmount: String(s.leaveDeductionAmount),
        otWarnings: m.otWarnings.length ? m.otWarnings.join("\n") : null,
        calendar: m.calendar,
        periodYear: m.periodYear,
        periodMonth: m.periodMonth,
        startDate: m.start,
        endDate: m.end,
        calendarDays: m.calendarDays,
        payableDays: String(m.payableDays),
        unpaidDays: String(m.unpaidDays),
        notEmployedDays: String(m.notEmployedDays),
        summary: m,
        isLocked: true,
        lockedById: params.userId,
        lockedAt: now,
        updatedAt: now,
      };
      await tx
        .insert(leaveOtCalculations)
        .values({ employeeId: s.employeeId, fiscalYearId: s.fiscalYearId, bsMonth: s.bsMonth, ...values })
        .onConflictDoUpdate({ target: [leaveOtCalculations.employeeId, leaveOtCalculations.fiscalYearId, leaveOtCalculations.bsMonth], set: values });
    }
    if (params.ledger?.length) await postLedgerLines(params.ledger, tx);
  });
}

/** Reopens a branch month: the period and its summaries and days unlock (results stay until it is closed again). */
export async function reopenPeriod(params: {
  periodId: string;
  employeeIds: string[];
  start: string;
  end: string;
  calendar: string;
  year: number;
  month: number;
  userId: string;
  reason: string;
  /** 4.6b: the month's home leave taken back, in the same transaction. */
  ledger?: NewLedgerLine[];
}): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const rows = await tx
      .update(attendancePeriods)
      .set({ status: "open", reopenedBy: params.userId, reopenedAt: now, reopenReason: params.reason })
      .where(and(eq(attendancePeriods.id, params.periodId), eq(attendancePeriods.status, "closed")))
      .returning({ id: attendancePeriods.id });
    if (!rows.length) return false;
    if (params.employeeIds.length) {
      await tx
        .update(leaveOtCalculations)
        .set({ isLocked: false, updatedAt: now })
        .where(and(inArray(leaveOtCalculations.employeeId, params.employeeIds), eq(leaveOtCalculations.calendar, params.calendar), eq(leaveOtCalculations.periodYear, params.year), eq(leaveOtCalculations.periodMonth, params.month)));
      await tx
        .update(attendanceRecords)
        .set({ isLocked: false, updatedAt: now })
        .where(and(inArray(attendanceRecords.employeeId, params.employeeIds), gte(attendanceRecords.attendanceDate, params.start), lte(attendanceRecords.attendanceDate, params.end)));
    }
    if (params.ledger?.length) await postLedgerLines(params.ledger, tx);
    return true;
  });
}

/** Closed (locked) summaries for a month. */
export async function findClosedSummaries(employeeIds: string[], calendar: string, year: number, month: number) {
  if (!employeeIds.length) return [];
  return (await getDb())
    .select()
    .from(leaveOtCalculations)
    .where(
      and(
        inArray(leaveOtCalculations.employeeId, employeeIds),
        eq(leaveOtCalculations.calendar, calendar),
        eq(leaveOtCalculations.periodYear, year),
        eq(leaveOtCalculations.periodMonth, month),
        eq(leaveOtCalculations.isLocked, true)
      )
    );
}

/** Locked day rows between dates for some employees (they cannot change). */
export async function findLockedDays(employeeIds: string[], from: string, to: string): Promise<Set<string>> {
  if (!employeeIds.length) return new Set();
  const rows = await (await getDb())
    .select({ employeeId: attendanceRecords.employeeId, date: attendanceRecords.attendanceDate })
    .from(attendanceRecords)
    .where(and(inArray(attendanceRecords.employeeId, employeeIds), gte(attendanceRecords.attendanceDate, from), lte(attendanceRecords.attendanceDate, to), eq(attendanceRecords.isLocked, true)));
  return new Set(rows.map((r) => `${r.employeeId}|${String(r.date).slice(0, 10)}`));
}


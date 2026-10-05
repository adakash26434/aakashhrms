import { getDb } from "@/lib/db";
import { approvalActions, leaveTypes, employeeLeaveBalances, leaveApplications, leaveLedger, leaveYearOpenings, fiscalYears, employees } from "@/lib/db/schema";
import { eq, and, desc, or, ilike, gte, lte, inArray, like, SQL, sql } from "drizzle-orm";
import type { DayBasis, EmployeeLeaveBalance, LeaveApplication, LeaveDuration, LeaveKind, LeaveRuleType, LeaveStatus, LeaveFilter, LedgerKind, LedgerLine } from "@/lib/types/leave";
import type { ApprovalActionKind } from "@/lib/types/approval";
import { defaultsFor, ledgerSummary, payOf } from "@/lib/engines/leave.engine";
import type { LeaveTypeRecord, LeavePayType, GenderApplicable, StatutoryCode } from "@/lib/types/leave-type";

function mapLeaveType(row: typeof leaveTypes.$inferSelect): LeaveTypeRecord {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    leaveType: row.leaveType as LeavePayType,
    noOfDays: Number(row.noOfDays) || 0,
    carryForward: row.carryForward,
    accumulationCap: row.accumulationCap ? Number(row.accumulationCap) : null,
    maxPaidDays: row.maxPaidDays ? Number(row.maxPaidDays) : null,
    isStatutory: row.isStatutory,
    statutoryCode: (row.statutoryCode as StatutoryCode) || null,
    genderApplicable: (row.genderApplicable as GenderApplicable) || "All",
    requiresDocument: row.requiresDocument,
    documentThresholdDays: row.documentThresholdDays,
    isEncashable: row.isEncashable,
    encashmentBasis: row.encashmentBasis,
    proRataForNewJoinees: row.proRataForNewJoinees,
    applicableDepartments: row.applicableDepartments || [],
    applicableDesignations: row.applicableDesignations || [],
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapBalance(row: typeof employeeLeaveBalances.$inferSelect): EmployeeLeaveBalance {
  return {
    id: row.id,
    employeeId: row.employeeId,
    leaveTypeId: row.leaveTypeId,
    fiscalYearId: row.fiscalYearId,
    allotted: Number(row.allotted) || 0,
    taken: Number(row.taken) || 0,
    carriedForward: Number(row.carriedForward) || 0,
    balance: Number(row.balance) || 0,
  };
}

function mapApp(row: typeof leaveApplications.$inferSelect): LeaveApplication {
  return {
    id: row.id,
    employeeId: row.employeeId,
    leaveTypeId: row.leaveTypeId,
    appliedDate: new Date(row.appliedDate),
    effectiveFrom: new Date(row.effectiveFrom),
    effectiveTo: new Date(row.effectiveTo),
    duration: row.duration as LeaveDuration,
    noOfDays: Number(row.noOfDays) || 0,
    reason: row.reason,
    remarks: row.remarks || null,
    status: row.status as LeaveStatus,
    reviewedById: row.reviewedById || null,
    reviewedAt: row.reviewedAt || null,
    reviewRemarks: row.reviewRemarks || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findAllLeaveTypes(): Promise<LeaveTypeRecord[]> {
  const rows = await (await getDb()).select().from(leaveTypes).orderBy(desc(leaveTypes.createdAt));
  return rows.map(mapLeaveType);
}

export async function findAllActiveLeaveTypes(): Promise<LeaveTypeRecord[]> {
  const rows = await (await getDb()).select().from(leaveTypes).where(eq(leaveTypes.isActive, true)).orderBy(desc(leaveTypes.createdAt));
  return rows.map(mapLeaveType);
}

export async function findEncashableLeaveTypes(): Promise<LeaveTypeRecord[]> {
  const rows = await (await getDb()).select().from(leaveTypes)
    .where(and(eq(leaveTypes.isEncashable, true), eq(leaveTypes.isActive, true)))
    .orderBy(desc(leaveTypes.createdAt));
  return rows.map(mapLeaveType);
}

export async function findLeaveTypeById(id: string): Promise<LeaveTypeRecord | null> {
  const rows = await (await getDb()).select().from(leaveTypes).where(eq(leaveTypes.id, id));
  if (!rows.length) return null;
  return mapLeaveType(rows[0]);
}

export async function findLeaveTypeByStatutoryCode(code: StatutoryCode): Promise<LeaveTypeRecord | undefined> {
  const rows = await (await getDb()).select().from(leaveTypes).where(eq(leaveTypes.statutoryCode, code));
  if (!rows.length) return undefined;
  return mapLeaveType(rows[0]);
}

export async function createLeaveType(data: {
  name: string;
  code: string;
  leaveType: string;
  noOfDays: number;
  carryForward?: boolean;
  accumulationCap?: number | null;
  maxPaidDays?: number | null;
  isStatutory?: boolean;
  statutoryCode?: string | null;
  genderApplicable?: string;
  requiresDocument?: boolean;
  documentThresholdDays?: number | null;
  isEncashable?: boolean;
  encashmentBasis?: string | null;
  proRataForNewJoinees?: boolean;
  applicableDepartments?: string[];
  applicableDesignations?: string[];
  isActive?: boolean;
}): Promise<LeaveTypeRecord> {
  const rows = await (await getDb()).insert(leaveTypes).values({
    name: data.name,
    code: data.code,
    leaveType: data.leaveType,
    noOfDays: data.noOfDays.toString(),
    carryForward: data.carryForward ?? false,
    accumulationCap: data.accumulationCap?.toString() ?? null,
    maxPaidDays: data.maxPaidDays?.toString() ?? null,
    isStatutory: data.isStatutory ?? false,
    statutoryCode: data.statutoryCode ?? null,
    genderApplicable: data.genderApplicable ?? "All",
    requiresDocument: data.requiresDocument ?? false,
    documentThresholdDays: data.documentThresholdDays ?? 3,
    isEncashable: data.isEncashable ?? false,
    encashmentBasis: data.encashmentBasis ?? "BasicSalary",
    proRataForNewJoinees: data.proRataForNewJoinees ?? false,
    applicableDepartments: data.applicableDepartments ?? [],
    applicableDesignations: data.applicableDesignations ?? [],
    isActive: data.isActive ?? true,
  }).returning();
  return mapLeaveType(rows[0]);
}

export async function updateLeaveType(id: string, data: Partial<Omit<LeaveTypeRecord, "id" | "createdAt" | "updatedAt">>): Promise<LeaveTypeRecord> {
  const existing = await (await getDb()).select().from(leaveTypes).where(eq(leaveTypes.id, id)).limit(1);
  if (!existing.length) {
    throw new Error("Leave type not found");
  }

  const updateVals: any = { ...data, updatedAt: new Date() };
  if (data.noOfDays !== undefined) updateVals.noOfDays = data.noOfDays.toString();
  if (data.accumulationCap !== undefined) updateVals.accumulationCap = data.accumulationCap?.toString() ?? null;
  if (data.maxPaidDays !== undefined) updateVals.maxPaidDays = data.maxPaidDays?.toString() ?? null;

  const rows = await (await getDb()).update(leaveTypes).set(updateVals).where(eq(leaveTypes.id, id)).returning();
  return mapLeaveType(rows[0]);
}

export async function deleteLeaveType(id: string): Promise<boolean> {
  const existing = await (await getDb()).select().from(leaveTypes).where(eq(leaveTypes.id, id)).limit(1);
  if (existing.length > 0 && (existing[0].isPlatformLocked || existing[0].isStatutory)) {
    throw new Error("Statutory Nepal Labour Act leave types are platform-locked and cannot be deleted by company administrators.");
  }

  const res = await (await getDb()).delete(leaveTypes).where(eq(leaveTypes.id, id)).returning({ id: leaveTypes.id });
  return res.length > 0;
}

export async function findLeaveBalances(employeeId: string, fiscalYearId?: string): Promise<EmployeeLeaveBalance[]> {
  const conditions = [eq(employeeLeaveBalances.employeeId, employeeId)];
  if (fiscalYearId) {
    conditions.push(eq(employeeLeaveBalances.fiscalYearId, fiscalYearId));
  } else {
    const activeFys = await (await getDb()).select().from(fiscalYears).where(eq(fiscalYears.status, "Active"));
    if (activeFys.length) {
      conditions.push(eq(employeeLeaveBalances.fiscalYearId, activeFys[0].id));
    }
  }

  const rows = await (await getDb()).select().from(employeeLeaveBalances).where(and(...conditions));
  return rows.map(mapBalance);
}

export async function createLeaveBalance(data: {
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId: string;
  allotted: number;
  taken: number;
  carriedForward: number;
  balance: number;
}): Promise<EmployeeLeaveBalance> {
  const rows = await (await getDb()).insert(employeeLeaveBalances).values({
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    fiscalYearId: data.fiscalYearId,
    allotted: data.allotted.toString(),
    taken: data.taken.toString(),
    carriedForward: data.carriedForward.toString(),
    balance: data.balance.toString(),
  }).returning();
  return mapBalance(rows[0]);
}

export async function findAllLeaveApplications(filter?: LeaveFilter): Promise<LeaveApplication[]> {
  const conditions: SQL<unknown>[] = [];

  if (filter) {
    if (filter.status && filter.status !== "all") {
      conditions.push(eq(leaveApplications.status, filter.status));
    }
    if (filter.leaveTypeId && filter.leaveTypeId !== "all") {
      conditions.push(eq(leaveApplications.leaveTypeId, filter.leaveTypeId));
    }
    if (filter.dateFrom) {
      conditions.push(gte(leaveApplications.effectiveFrom, filter.dateFrom));
    }
    if (filter.dateTo) {
      conditions.push(lte(leaveApplications.effectiveTo, filter.dateTo));
    }
    if (filter.search && filter.search.trim() !== "") {
      const term = `%${filter.search.trim()}%`;
      const searchCond = or(
        ilike(employees.fullName, term),
        ilike(employees.employeeCode, term),
        ilike(leaveApplications.reason, term)
      );
      if (searchCond) {
        conditions.push(searchCond);
      }
    }
  }

  const query = (await getDb())
    .select({ app: leaveApplications })
    .from(leaveApplications)
    .innerJoin(employees, eq(leaveApplications.employeeId, employees.id));

  const rows = await (conditions.length > 0
    ? query.where(and(...conditions))
    : query
  ).orderBy(desc(leaveApplications.appliedDate));

  return rows.map((r) => mapApp(r.app));
}

export async function findLeaveApplicationById(id: string): Promise<LeaveApplication | undefined> {
  const rows = await (await getDb()).select().from(leaveApplications).where(eq(leaveApplications.id, id));
  if (!rows.length) return undefined;
  return mapApp(rows[0]);
}

export const findAllLeaveTypesIncludingInactive = findAllLeaveTypes;
export const removeLeaveType = deleteLeaveType;
export const findLeaveBalancesByEmployee = findLeaveBalances;

// ---------------------------------------------------------------------------
// 4.6: leave types as the rules need them
// ---------------------------------------------------------------------------

/** Every leave type with how it counts and pays (nulls fall back to the defaults for its statutory code). */
export async function findRuleTypes(): Promise<LeaveRuleType[]> {
  const rows = await (await getDb()).select().from(leaveTypes).orderBy(leaveTypes.name);
  // Public holidays (§41) are days in the Holiday calendar, never a leave type with a balance.
  return rows.filter((r) => (r.statutoryCode ?? r.code) !== "PUBLIC").map((r) => {
    const pay = payOf(r.leaveType);
    const d = defaultsFor(r.statutoryCode, pay);
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      statutoryCode: r.statutoryCode,
      isStatutory: r.isStatutory,
      kind: (r.kind as LeaveKind | null) ?? d.kind,
      dayBasis: (r.dayBasis as DayBasis | null) ?? d.dayBasis,
      pay,
      days: Number(r.noOfDays) || 0,
      paidDaysPerEvent: r.paidDaysPerEvent !== null ? Number(r.paidDaysPerEvent) : d.paidDaysPerEvent,
      maxDaysPerRequest: r.maxDaysPerRequest !== null ? Number(r.maxDaysPerRequest) : null,
      allowHalfDay: r.allowHalfDay,
      isRight: r.isRight || d.isRight,
      genderApplicable: (r.genderApplicable as LeaveRuleType["genderApplicable"]) || "All",
      applicableDepartments: r.applicableDepartments ?? [],
      applicableDesignations: r.applicableDesignations ?? [],
      requiresDocument: r.requiresDocument,
      documentThresholdDays: r.documentThresholdDays,
      accumulationCap: r.accumulationCap !== null ? Number(r.accumulationCap) : null,
      carryForward: r.carryForward,
      isEncashable: r.isEncashable,
      accrualEveryDays: r.accrualEveryDays ?? (r.statutoryCode === "HOME" ? 20 : null),
      expiryDays: r.expiryDays ?? (r.statutoryCode === "SUBSTITUTE" ? 21 : null),
      isActive: r.isActive,
    };
  });
}

// ---------------------------------------------------------------------------
// 4.6: the ledger (never edited or deleted; the summary row follows it)
// ---------------------------------------------------------------------------

export interface NewLedgerLine {
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId: string;
  entryDate: string;
  kind: LedgerKind;
  /** Signed days (taken / paid out / expired / lapsed negative). */
  days: number;
  applicationId?: string | null;
  note?: string | null;
  expiresOn?: string | null;
  /** What the line is for (never posted twice): accrual:…, substitute:…, opening:…, expiry:…. */
  ref?: string | null;
  createdBy: string | null;
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

/** Adds ledger lines and brings each affected summary row (employee, type, year) up to date, in the given transaction. */
export async function postLedgerLines(lines: NewLedgerLine[], tx?: Tx): Promise<void> {
  if (!lines.length) return;
  const run = async (t: Tx) => {
    await t.insert(leaveLedger).values(
      lines.map((l) => ({
        employeeId: l.employeeId,
        leaveTypeId: l.leaveTypeId,
        fiscalYearId: l.fiscalYearId,
        entryDate: l.entryDate,
        kind: l.kind,
        days: String(l.days),
        applicationId: l.applicationId ?? null,
        note: l.note ?? null,
        expiresOn: l.expiresOn ?? null,
        ref: l.ref ?? null,
        createdBy: l.createdBy,
      }))
    );
    const keys = [...new Map(lines.map((l) => [`${l.employeeId}|${l.leaveTypeId}|${l.fiscalYearId}`, l])).values()];
    for (const k of keys) {
      const all = await t
        .select({ kind: leaveLedger.kind, days: leaveLedger.days })
        .from(leaveLedger)
        .where(and(eq(leaveLedger.employeeId, k.employeeId), eq(leaveLedger.leaveTypeId, k.leaveTypeId), eq(leaveLedger.fiscalYearId, k.fiscalYearId)));
      const sum = ledgerSummary(all.map((r) => ({ kind: r.kind as LedgerKind, days: Number(r.days) })));
      const values = { allotted: String(sum.allotted), taken: String(sum.taken), carriedForward: String(sum.carriedForward), balance: String(sum.balance), updatedAt: new Date() };
      await t
        .insert(employeeLeaveBalances)
        .values({ employeeId: k.employeeId, leaveTypeId: k.leaveTypeId, fiscalYearId: k.fiscalYearId, ...values })
        .onConflictDoUpdate({ target: [employeeLeaveBalances.employeeId, employeeLeaveBalances.leaveTypeId, employeeLeaveBalances.fiscalYearId], set: values });
    }
  };
  if (tx) await run(tx);
  else await (await getDb()).transaction(run);
}

/** Ledger lines of some employees in a leave year, oldest first. */
export async function findLedger(employeeIds: string[], fiscalYearId: string): Promise<(LedgerLine & { employeeId: string })[]> {
  if (!employeeIds.length) return [];
  const rows = await (await getDb())
    .select()
    .from(leaveLedger)
    .where(and(inArray(leaveLedger.employeeId, employeeIds), eq(leaveLedger.fiscalYearId, fiscalYearId)))
    .orderBy(leaveLedger.entryDate, leaveLedger.createdAt);
  return rows.map(mapLine);
}

function mapLine(r: typeof leaveLedger.$inferSelect): LedgerLine & { employeeId: string; fiscalYearId: string } {
  return {
    id: r.id,
    employeeId: r.employeeId,
    leaveTypeId: r.leaveTypeId,
    entryDate: String(r.entryDate).slice(0, 10),
    kind: r.kind as LedgerKind,
    days: Number(r.days),
    applicationId: r.applicationId,
    note: r.note,
    expiresOn: r.expiresOn ? String(r.expiresOn).slice(0, 10) : null,
    ref: r.ref,
    fiscalYearId: r.fiscalYearId,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Lines whose ref starts with a prefix (any leave year): what was already posted for a month, a worked day or a year. */
export async function findLinesByRef(employeeIds: string[], refPrefix: string) {
  if (!employeeIds.length) return [];
  const rows = await (await getDb())
    .select()
    .from(leaveLedger)
    .where(and(inArray(leaveLedger.employeeId, employeeIds), like(leaveLedger.ref, `${refPrefix.replace(/[%_]/g, "")}%`)))
    .orderBy(leaveLedger.entryDate, leaveLedger.createdAt);
  return rows.map(mapLine);
}

/** Every line of one leave type for some employees, in all leave years (substitute grants and their expiry). */
export async function findTypeLines(employeeIds: string[], leaveTypeId: string) {
  if (!employeeIds.length) return [];
  const rows = await (await getDb())
    .select()
    .from(leaveLedger)
    .where(and(inArray(leaveLedger.employeeId, employeeIds), eq(leaveLedger.leaveTypeId, leaveTypeId)))
    .orderBy(leaveLedger.entryDate, leaveLedger.createdAt);
  return rows.map(mapLine);
}

// ---------------------------------------------------------------------------
// 4.6b: leave years opened (once per fiscal year)
// ---------------------------------------------------------------------------

export async function findOpenings() {
  return (await getDb()).select().from(leaveYearOpenings).orderBy(leaveYearOpenings.openedAt);
}

/**
 * Opens a leave year: the opening row (one per fiscal year, so a second
 * opening fails) and its ledger lines, in one transaction.
 */
export async function openYear(p: { fiscalYearId: string; fromFiscalYearId: string | null; people: number; note: string | null; openedBy: string; lines: NewLedgerLine[] }): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(leaveYearOpenings)
      .values({ fiscalYearId: p.fiscalYearId, fromFiscalYearId: p.fromFiscalYearId, people: p.people, note: p.note, openedBy: p.openedBy })
      .onConflictDoNothing({ target: leaveYearOpenings.fiscalYearId })
      .returning({ id: leaveYearOpenings.id });
    if (!rows.length) return false;
    // Large companies: post in chunks inside the same transaction.
    for (let i = 0; i < p.lines.length; i += 500) await postLedgerLines(p.lines.slice(i, i + 500), tx);
    return true;
  });
}

export type { Tx as LeaveTx };

// ---------------------------------------------------------------------------
// 4.6: requests
// ---------------------------------------------------------------------------

export type RequestRowDb = typeof leaveApplications.$inferSelect;

export async function findRequests(opts: { employeeIds?: string[]; from?: string; to?: string; statuses?: LeaveStatus[] } = {}): Promise<RequestRowDb[]> {
  if (opts.employeeIds && !opts.employeeIds.length) return [];
  return (await getDb())
    .select()
    .from(leaveApplications)
    .where(
      and(
        opts.employeeIds ? inArray(leaveApplications.employeeId, opts.employeeIds) : undefined,
        opts.to ? lte(leaveApplications.effectiveFrom, opts.to) : undefined,
        opts.from ? gte(leaveApplications.effectiveTo, opts.from) : undefined,
        opts.statuses ? inArray(leaveApplications.status, opts.statuses) : undefined
      )
    )
    .orderBy(desc(leaveApplications.createdAt));
}

export async function findRequestById(id: string): Promise<RequestRowDb | null> {
  const [r] = await (await getDb()).select().from(leaveApplications).where(eq(leaveApplications.id, id)).limit(1);
  return r ?? null;
}

/** A new request, waiting, with "submitted" on its timeline. */
export async function insertRequest(row: {
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId: string;
  from: string;
  to: string;
  half: string | null;
  days: number;
  paidDays: number;
  unpaidDays: number;
  detail: { date: string; part: number; pay: "full" | "none" | "half" }[];
  reason: string;
  certificateNote: string | null;
  ssfClaim: boolean;
  source: "hr" | "self_service";
  preparedBy: string;
  appliedDate: string;
}): Promise<string> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(leaveApplications)
      .values({
        employeeId: row.employeeId,
        leaveTypeId: row.leaveTypeId,
        fiscalYearId: row.fiscalYearId,
        appliedDate: row.appliedDate,
        effectiveFrom: row.from,
        effectiveTo: row.to,
        duration: row.half ? "Half Day" : "Full Day",
        half: row.half,
        noOfDays: String(row.days),
        paidDays: String(row.paidDays),
        unpaidDays: String(row.unpaidDays),
        daysDetail: row.detail,
        reason: row.reason,
        certificateNote: row.certificateNote,
        ssfClaim: row.ssfClaim,
        source: row.source,
        preparedBy: row.preparedBy,
        approvalType: "simple",
        status: "Pending",
      })
      .returning({ id: leaveApplications.id });
    await tx.insert(approvalActions).values({ module: MODULE, requestId: created.id, level: 0, actorId: row.preparedBy, action: "submitted" });
    return created.id;
  });
}

/**
 * Decides a request in one transaction: the status changes only if it is
 * still `expectedStatus` (two approvers cannot both take the days), the
 * timeline gets the action, and the ledger lines (taken / returned) are
 * posted with the summary row.
 */
export async function decideRequest(p: {
  id: string;
  expectedStatus: LeaveStatus;
  status: LeaveStatus;
  route: string | null;
  actorId: string;
  action: ApprovalActionKind;
  note: string | null;
  cancelReason?: string | null;
  ledger: NewLedgerLine[];
}): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(leaveApplications)
      .set({
        status: p.status,
        reviewedById: p.actorId,
        reviewedAt: new Date(),
        reviewRemarks: p.note,
        approvalRoute: p.route,
        ...(p.cancelReason !== undefined ? { cancelReason: p.cancelReason } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(leaveApplications.id, p.id), eq(leaveApplications.status, p.expectedStatus)))
      .returning({ id: leaveApplications.id });
    if (!rows.length) return false;
    await tx.insert(approvalActions).values({ module: MODULE, requestId: p.id, level: 0, actorId: p.actorId, action: p.action, note: p.note });
    await postLedgerLines(p.ledger, tx);
    return true;
  });
}

export async function findTimeline(ids: string[]) {
  if (!ids.length) return [];
  return (await getDb())
    .select()
    .from(approvalActions)
    .where(and(eq(approvalActions.module, MODULE), inArray(approvalActions.requestId, ids)))
    .orderBy(approvalActions.createdAt);
}

export const MODULE = "LEAVE";

/**
 * Dashboard (4.1): approved leave days per leave type in the active fiscal
 * year, within `employeeCondition` (scope + branch filter).
 */
export async function sumApprovedLeaveDaysByType(employeeCondition?: SQL): Promise<{ fiscalYear: string; types: { name: string; days: number }[] } | null> {
  const db = await getDb();
  const [fy] = await db.select({ id: fiscalYears.id, label: fiscalYears.label }).from(fiscalYears).where(eq(fiscalYears.status, "Active")).limit(1);
  if (!fy) return null;
  const rows = await db
    .select({ name: leaveTypes.name, days: sql<string>`coalesce(sum(${leaveApplications.noOfDays}), 0)` })
    .from(leaveApplications)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveApplications.leaveTypeId))
    .where(and(eq(leaveApplications.fiscalYearId, fy.id), eq(leaveApplications.status, "Approved"), employeeCondition))
    .groupBy(leaveTypes.name);
  return {
    fiscalYear: fy.label,
    types: rows.map((r) => ({ name: r.name, days: Number(r.days) })).filter((r) => r.days > 0).sort((a, b) => b.days - a.days),
  };
}

// ---------------------------------------------------------------------------
// Employee record page (4.2): one employee's balances and recent requests.
// ---------------------------------------------------------------------------

export async function findLeaveBalancesWithTypes(employeeId: string, fiscalYearId: string) {
  const rows = await (await getDb())
    .select({
      leaveTypeName: leaveTypes.name,
      allotted: employeeLeaveBalances.allotted,
      carriedForward: employeeLeaveBalances.carriedForward,
      taken: employeeLeaveBalances.taken,
      balance: employeeLeaveBalances.balance,
    })
    .from(employeeLeaveBalances)
    .innerJoin(leaveTypes, eq(leaveTypes.id, employeeLeaveBalances.leaveTypeId))
    // 4.6: only types with a balance (event leave and public holidays have none).
    .where(and(eq(employeeLeaveBalances.employeeId, employeeId), eq(employeeLeaveBalances.fiscalYearId, fiscalYearId), eq(leaveTypes.kind, "balance"), eq(leaveTypes.isActive, true)))
    .orderBy(leaveTypes.name);
  return rows.map((r) => ({
    leaveTypeName: r.leaveTypeName,
    allotted: Number(r.allotted),
    carriedForward: Number(r.carriedForward),
    taken: Number(r.taken),
    balance: Number(r.balance),
  }));
}

export async function findRecentLeaveByEmployee(employeeId: string, limit = 10) {
  const rows = await (await getDb())
    .select({
      id: leaveApplications.id,
      leaveTypeName: leaveTypes.name,
      from: leaveApplications.effectiveFrom,
      to: leaveApplications.effectiveTo,
      days: leaveApplications.noOfDays,
      status: leaveApplications.status,
      appliedDate: leaveApplications.appliedDate,
    })
    .from(leaveApplications)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveApplications.leaveTypeId))
    .where(eq(leaveApplications.employeeId, employeeId))
    .orderBy(desc(leaveApplications.effectiveFrom))
    .limit(limit);
  return rows.map((r) => ({ ...r, from: String(r.from), to: String(r.to), appliedDate: String(r.appliedDate), days: Number(r.days) }));
}

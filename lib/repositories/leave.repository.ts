import { getDb } from "@/lib/db";
import { leaveTypes, employeeLeaveBalances, leaveApplications, fiscalYears, employees } from "@/lib/db/schema";
import { eq, and, desc, or, ilike, gte, lte, SQL } from "drizzle-orm";
import type { EmployeeLeaveBalance, LeaveApplication, LeaveDuration, LeaveStatus, LeaveFilter } from "@/lib/types/leave";
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
  const rows = await getDb().select().from(leaveTypes).orderBy(desc(leaveTypes.createdAt));
  return rows.map(mapLeaveType);
}

export async function findAllActiveLeaveTypes(): Promise<LeaveTypeRecord[]> {
  const rows = await getDb().select().from(leaveTypes).where(eq(leaveTypes.isActive, true)).orderBy(desc(leaveTypes.createdAt));
  return rows.map(mapLeaveType);
}

export async function findEncashableLeaveTypes(): Promise<LeaveTypeRecord[]> {
  const rows = await getDb().select().from(leaveTypes)
    .where(and(eq(leaveTypes.isEncashable, true), eq(leaveTypes.isActive, true)))
    .orderBy(desc(leaveTypes.createdAt));
  return rows.map(mapLeaveType);
}

export async function findLeaveTypeById(id: string): Promise<LeaveTypeRecord | null> {
  const rows = await getDb().select().from(leaveTypes).where(eq(leaveTypes.id, id));
  if (!rows.length) return null;
  return mapLeaveType(rows[0]);
}

export async function findLeaveTypeByStatutoryCode(code: StatutoryCode): Promise<LeaveTypeRecord | undefined> {
  const rows = await getDb().select().from(leaveTypes).where(eq(leaveTypes.statutoryCode, code));
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
  const rows = await getDb().insert(leaveTypes).values({
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
  const existing = await getDb().select().from(leaveTypes).where(eq(leaveTypes.id, id)).limit(1);
  if (!existing.length) {
    throw new Error("Leave type not found");
  }

  const updateVals: any = { ...data, updatedAt: new Date() };
  if (data.noOfDays !== undefined) updateVals.noOfDays = data.noOfDays.toString();
  if (data.accumulationCap !== undefined) updateVals.accumulationCap = data.accumulationCap?.toString() ?? null;
  if (data.maxPaidDays !== undefined) updateVals.maxPaidDays = data.maxPaidDays?.toString() ?? null;

  const rows = await getDb().update(leaveTypes).set(updateVals).where(eq(leaveTypes.id, id)).returning();
  return mapLeaveType(rows[0]);
}

export async function deleteLeaveType(id: string): Promise<boolean> {
  const existing = await getDb().select().from(leaveTypes).where(eq(leaveTypes.id, id)).limit(1);
  if (existing.length > 0 && (existing[0].isPlatformLocked || existing[0].isStatutory)) {
    throw new Error("Statutory Nepal Labour Act leave types are platform-locked and cannot be deleted by company administrators.");
  }

  const res = await getDb().delete(leaveTypes).where(eq(leaveTypes.id, id)).returning({ id: leaveTypes.id });
  return res.length > 0;
}

export async function findLeaveBalances(employeeId: string, fiscalYearId?: string): Promise<EmployeeLeaveBalance[]> {
  const conditions = [eq(employeeLeaveBalances.employeeId, employeeId)];
  if (fiscalYearId) {
    conditions.push(eq(employeeLeaveBalances.fiscalYearId, fiscalYearId));
  } else {
    const activeFys = await getDb().select().from(fiscalYears).where(eq(fiscalYears.status, "Active"));
    if (activeFys.length) {
      conditions.push(eq(employeeLeaveBalances.fiscalYearId, activeFys[0].id));
    }
  }

  const rows = await getDb().select().from(employeeLeaveBalances).where(and(...conditions));
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
  const rows = await getDb().insert(employeeLeaveBalances).values({
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
        ilike(employees.firstName, term),
        ilike(employees.lastName, term),
        ilike(employees.employeeCode, term),
        ilike(leaveApplications.reason, term)
      );
      if (searchCond) {
        conditions.push(searchCond);
      }
    }
  }

  const query = getDb()
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
  const rows = await getDb().select().from(leaveApplications).where(eq(leaveApplications.id, id));
  if (!rows.length) return undefined;
  return mapApp(rows[0]);
}

export async function createLeaveApplication(data: any): Promise<LeaveApplication> {
  let fyId = data.fiscalYearId;
  if (!fyId) {
    const activeFys = await getDb().select().from(fiscalYears).where(eq(fiscalYears.status, "Active"));
    fyId = activeFys.length ? activeFys[0].id : "fy-1";
  }

  const effectiveFromStr = data.startDate instanceof Date ? data.startDate.toISOString().split('T')[0] : String(data.startDate || data.effectiveFrom || '');
  const effectiveToStr = data.endDate instanceof Date ? data.endDate.toISOString().split('T')[0] : String(data.endDate || data.effectiveTo || '');

  const rows = await getDb().insert(leaveApplications).values({
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    fiscalYearId: fyId,
    appliedDate: new Date().toISOString().split('T')[0],
    effectiveFrom: effectiveFromStr,
    effectiveTo: effectiveToStr,
    duration: data.duration || "FULL_DAY",
    noOfDays: (data.totalDays ?? data.noOfDays ?? 1).toString(),
    reason: data.reason || "",
    remarks: data.attachmentUrl ?? data.remarks ?? null,
    status: "PENDING",
  }).returning();

  return mapApp(rows[0]);
}

export async function updateLeaveApplication(id: string, data: Partial<Omit<LeaveApplication, "id" | "createdAt" | "updatedAt">>): Promise<LeaveApplication | null> {
  const updateVals: any = { ...data, updatedAt: new Date() };
  if (data.noOfDays !== undefined) updateVals.noOfDays = data.noOfDays.toString();

  const rows = await getDb().update(leaveApplications).set(updateVals).where(eq(leaveApplications.id, id)).returning();
  return rows.length ? mapApp(rows[0]) : null;
}

export async function deleteLeaveApplication(id: string): Promise<boolean> {
  const res = await getDb().delete(leaveApplications).where(eq(leaveApplications.id, id)).returning({ id: leaveApplications.id });
  return res.length > 0;
}

export const findAllLeaveTypesIncludingInactive = findAllLeaveTypes;
export const removeLeaveType = deleteLeaveType;
export const findLeaveBalancesByEmployee = findLeaveBalances;
export const removeLeaveApplication = deleteLeaveApplication;

export async function updateLeaveBalance(
  id: string,
  taken: number,
  balance: number,
  tx?: any
): Promise<EmployeeLeaveBalance | null> {
  const client = tx || getDb();
  const rows = await client.update(employeeLeaveBalances)
    .set({ taken: taken.toString(), balance: balance.toString(), updatedAt: new Date() })
    .where(eq(employeeLeaveBalances.id, id))
    .returning();
  return rows.length ? mapBalance(rows[0]) : null;
}
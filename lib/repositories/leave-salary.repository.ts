import { getDb } from '@/lib/db';
import { leaveSalaryRuns, users, employees } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { LeaveSalaryRun, LeaveSalaryRunStatus, EncashmentType, PaymentMethod } from '@/lib/types/payroll';

// ---------------------------------------------------------------------------
// Mapper — replaces all `as unknown as` casts (ARCH-4 fix)
// ---------------------------------------------------------------------------
function mapLeaveSalaryRun(row: typeof leaveSalaryRuns.$inferSelect): LeaveSalaryRun {
  return {
    id: row.id,
    payrollRunId: row.payrollRunId,
    employeeId: row.employeeId,
    leaveTypeId: row.leaveTypeId,
    leaveDays: row.leaveDays,
    perDayRate: row.perDayRate,
    totalAmount: row.totalAmount,
    tdsAmount: row.tdsAmount,
    encashmentType: (row.encashmentType || 'VOLUNTARY') as EncashmentType,
    paymentPeriod: row.paymentPeriod,
    paymentMethod: (row.paymentMethod || 'BANK_TRANSFER') as PaymentMethod,
    status: row.status as LeaveSalaryRunStatus,
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function findAllLeaveSalaryRuns(filter?: {
  employeeId?: string;
  status?: LeaveSalaryRunStatus;
  period?: string;
}): Promise<LeaveSalaryRun[]> {
  const conditions = [];

  if (filter?.employeeId) {
    conditions.push(eq(leaveSalaryRuns.employeeId, filter.employeeId));
  }
  if (filter?.status) {
    conditions.push(eq(leaveSalaryRuns.status, filter.status));
  }
  if (filter?.period) {
    conditions.push(eq(leaveSalaryRuns.paymentPeriod, filter.period));
  }

  const approverUser = alias(users, 'approverUser');
  const approverEmp = alias(employees, 'approverEmp');

  const creatorUser = alias(users, 'creatorUser');
  const creatorEmp = alias(employees, 'creatorEmp');

  const rows = await getDb().select({
    run: leaveSalaryRuns,
    approverEmail: approverUser.email,
    approverFirstName: approverEmp.firstName,
    approverLastName: approverEmp.lastName,
    creatorEmail: creatorUser.email,
    creatorFirstName: creatorEmp.firstName,
    creatorLastName: creatorEmp.lastName,
  })
  .from(leaveSalaryRuns)
  .leftJoin(approverUser, eq(leaveSalaryRuns.approvedBy, approverUser.id))
  .leftJoin(approverEmp, eq(approverUser.employeeId, approverEmp.id))
  .leftJoin(creatorUser, eq(leaveSalaryRuns.createdBy, creatorUser.id))
  .leftJoin(creatorEmp, eq(creatorUser.employeeId, creatorEmp.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(leaveSalaryRuns.createdAt));

  return rows.map(({ run, approverEmail, approverFirstName, approverLastName, creatorEmail, creatorFirstName, creatorLastName }) => {
    let approvedByName: string | null = null;
    if (approverFirstName && approverLastName) {
      approvedByName = `${approverFirstName} ${approverLastName}`;
    } else if (approverEmail) {
      approvedByName = approverEmail.split('@')[0];
    }

    let createdByName: string | null = null;
    if (creatorFirstName && creatorLastName) {
      createdByName = `${creatorFirstName} ${creatorLastName}`;
    } else if (creatorEmail) {
      createdByName = creatorEmail.split('@')[0];
    }

    return {
      ...mapLeaveSalaryRun(run),
      approvedByName,
      createdByName,
    };
  });
}

export async function findLeaveSalaryRunById(id: string): Promise<LeaveSalaryRun | undefined> {
  const rows = await getDb().select().from(leaveSalaryRuns).where(eq(leaveSalaryRuns.id, id));
  if (!rows.length) return undefined;
  return mapLeaveSalaryRun(rows[0]);
}

export async function findDraftRunForEmployeeAndPeriod(
  employeeId: string,
  leaveTypeId: string,
  paymentPeriod: string
): Promise<LeaveSalaryRun | undefined> {
  const rows = await getDb().select()
    .from(leaveSalaryRuns)
    .where(
      and(
        eq(leaveSalaryRuns.employeeId, employeeId),
        eq(leaveSalaryRuns.leaveTypeId, leaveTypeId),
        eq(leaveSalaryRuns.paymentPeriod, paymentPeriod),
        eq(leaveSalaryRuns.status, 'DRAFT')
      )
    );

  if (!rows.length) return undefined;
  return mapLeaveSalaryRun(rows[0]);
}

export async function findRunsByStatus(status: LeaveSalaryRunStatus): Promise<LeaveSalaryRun[]> {
  const rows = await getDb().select()
    .from(leaveSalaryRuns)
    .where(eq(leaveSalaryRuns.status, status))
    .orderBy(desc(leaveSalaryRuns.createdAt));

  return rows.map(mapLeaveSalaryRun);
}

export async function findRunsByEmployeeId(employeeId: string): Promise<LeaveSalaryRun[]> {
  const rows = await getDb().select()
    .from(leaveSalaryRuns)
    .where(eq(leaveSalaryRuns.employeeId, employeeId))
    .orderBy(desc(leaveSalaryRuns.createdAt));

  return rows.map(mapLeaveSalaryRun);
}

export async function findLeaveSalaryRunsByPeriod(period: string): Promise<LeaveSalaryRun[]> {
  const rows = await getDb().select()
    .from(leaveSalaryRuns)
    .where(eq(leaveSalaryRuns.paymentPeriod, period));
  return rows.map(mapLeaveSalaryRun);
}

// Original 2-column check (kept for backward compatibility)
export async function findLeaveSalaryRunByEmployeeAndPeriod(args: {
  employeeId: string;
  paymentPeriod: string;
}): Promise<LeaveSalaryRun | undefined> {
  const rows = await getDb().select()
    .from(leaveSalaryRuns)
    .where(
      and(
        eq(leaveSalaryRuns.employeeId, args.employeeId),
        eq(leaveSalaryRuns.paymentPeriod, args.paymentPeriod)
      )
    );
  if (!rows.length) return undefined;
  return mapLeaveSalaryRun(rows[0]);
}

// 3-column check: employee + leaveType + period (BUG-5 fix)
export async function findLeaveSalaryRunByEmployeeLeaveTypeAndPeriod(args: {
  employeeId: string;
  leaveTypeId: string;
  paymentPeriod: string;
}): Promise<LeaveSalaryRun | undefined> {
  const rows = await getDb().select()
    .from(leaveSalaryRuns)
    .where(
      and(
        eq(leaveSalaryRuns.employeeId, args.employeeId),
        eq(leaveSalaryRuns.leaveTypeId, args.leaveTypeId),
        eq(leaveSalaryRuns.paymentPeriod, args.paymentPeriod)
      )
    );
  if (!rows.length) return undefined;
  return mapLeaveSalaryRun(rows[0]);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createLeaveSalaryRun(
  data: Omit<LeaveSalaryRun, 'id' | 'createdAt' | 'updatedAt' | 'approvedBy'> & { approvedBy?: string | null }
): Promise<LeaveSalaryRun> {
  const rows = await getDb().insert(leaveSalaryRuns).values({
    payrollRunId: data.payrollRunId ?? null,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    leaveDays: data.leaveDays,
    perDayRate: data.perDayRate,
    totalAmount: data.totalAmount,
    tdsAmount: data.tdsAmount,
    encashmentType: data.encashmentType,
    paymentPeriod: data.paymentPeriod,
    paymentMethod: data.paymentMethod,
    status: data.status,
    createdBy: data.createdBy,
    approvedBy: data.approvedBy ?? null,
  }).returning();

  return mapLeaveSalaryRun(rows[0]);
}

export async function updateLeaveSalaryRunStatus(
  id: string,
  status: LeaveSalaryRunStatus,
  approvedByUserId?: string,
  tx?: any
): Promise<LeaveSalaryRun> {
  const client = tx || getDb();
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (approvedByUserId) {
    updateData.approvedBy = approvedByUserId;
  }

  const rows = await client.update(leaveSalaryRuns)
    .set(updateData)
    .where(eq(leaveSalaryRuns.id, id))
    .returning();

  return mapLeaveSalaryRun(rows[0]);
}

export async function updateLeaveSalaryRunDraft(
  id: string,
  data: {
    leaveDays: string;
    perDayRate: string;
    totalAmount: string;
    paymentPeriod: string;
    paymentMethod: PaymentMethod;
    encashmentType: EncashmentType;
  }
): Promise<LeaveSalaryRun> {
  const rows = await getDb().update(leaveSalaryRuns)
    .set({
      leaveDays: data.leaveDays,
      perDayRate: data.perDayRate,
      totalAmount: data.totalAmount,
      paymentPeriod: data.paymentPeriod,
      paymentMethod: data.paymentMethod,
      encashmentType: data.encashmentType,
      updatedAt: new Date()
    })
    .where(eq(leaveSalaryRuns.id, id))
    .returning();

  return mapLeaveSalaryRun(rows[0]);
}

export async function deleteLeaveSalaryRun(id: string): Promise<void> {
  await getDb().delete(leaveSalaryRuns).where(eq(leaveSalaryRuns.id, id));
}

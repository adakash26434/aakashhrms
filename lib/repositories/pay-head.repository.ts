import { getDb } from '@/lib/db';
import { payHeads, employeeSalaryHeads, employeeSalaryMap, employees, payrollSlipHeads } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { PayHead, PayHeadType, CalcBasis, CalcParameter } from '@/lib/types/pay-head';

type PayHeadRow = typeof payHeads.$inferSelect;

function mapRowToPayHead(row: PayHeadRow): PayHead {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as PayHeadType,
    effectOnTax: row.effectOnTax,
    calcBasis: row.calcBasis as CalcBasis,
    calcParameter: row.calcParameter as CalcParameter,
    calcPercent: Number(row.calcPercent),
    applicableDepartmentIds: Array.isArray(row.applicableDepartmentIds) ? row.applicableDepartmentIds : [],
    applicableDesignationIds: Array.isArray(row.applicableDesignationIds) ? row.applicableDesignationIds : [],
    flags: {
      isFestivalAllowance: row.isFestivalAllowance,
      isAbsentDeduct: row.isAbsentDeduct,
      isOtHead: row.isOtHead,
      isLeaveHead: row.isLeaveHead,
      isTdsHead: row.isTdsHead,
      isPfHead: row.isPfHead,
      isSsfHead: row.isSsfHead,
      isSsfEmployerHead: row.isSsfEmployerHead,
      isRemoteAllowance: row.isRemoteAllowance,
      isCitHead: row.isCitHead,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllPayHeads(): Promise<PayHead[]> {
  const rows = await getDb().select().from(payHeads);
  return rows.map(mapRowToPayHead);
}

export async function findPayHeadById(id: string): Promise<PayHead | undefined> {
  const rows = await getDb().select().from(payHeads).where(eq(payHeads.id, id));
  if (!rows.length) return undefined;
  return mapRowToPayHead(rows[0]);
}

type CreatePayload = Omit<PayHead, "id" | "code" | "createdAt" | "updatedAt">;

export async function createPayHead(data: CreatePayload): Promise<PayHead> {
  const code = `PH-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const rows = await getDb().insert(payHeads).values({
    code,
    name: data.name,
    type: data.type,
    effectOnTax: data.effectOnTax,
    calcBasis: data.calcBasis,
    calcParameter: data.calcParameter,
    calcPercent: data.calcPercent.toString(),
    applicableDepartmentIds: data.applicableDepartmentIds || [],
    applicableDesignationIds: data.applicableDesignationIds || [],
    isFestivalAllowance: data.flags.isFestivalAllowance ?? false,
    isAbsentDeduct: data.flags.isAbsentDeduct ?? false,
    isOtHead: data.flags.isOtHead ?? false,
    isLeaveHead: data.flags.isLeaveHead ?? false,
    isTdsHead: data.flags.isTdsHead ?? false,
    isPfHead: data.flags.isPfHead ?? false,
    isSsfHead: data.flags.isSsfHead ?? false,
    isSsfEmployerHead: data.flags.isSsfEmployerHead ?? false,
    isRemoteAllowance: data.flags.isRemoteAllowance ?? false,
    isCitHead: data.flags.isCitHead ?? false,
  }).returning();

  return mapRowToPayHead(rows[0]);
}

export async function updatePayHead(id: string, data: CreatePayload): Promise<PayHead> {
  const rows = await getDb().update(payHeads).set({
    name: data.name,
    type: data.type,
    effectOnTax: data.effectOnTax,
    calcBasis: data.calcBasis,
    calcParameter: data.calcParameter,
    calcPercent: data.calcPercent.toString(),
    applicableDepartmentIds: data.applicableDepartmentIds || [],
    applicableDesignationIds: data.applicableDesignationIds || [],
    isFestivalAllowance: data.flags.isFestivalAllowance ?? false,
    isAbsentDeduct: data.flags.isAbsentDeduct ?? false,
    isOtHead: data.flags.isOtHead ?? false,
    isLeaveHead: data.flags.isLeaveHead ?? false,
    isTdsHead: data.flags.isTdsHead ?? false,
    isPfHead: data.flags.isPfHead ?? false,
    isSsfHead: data.flags.isSsfHead ?? false,
    isSsfEmployerHead: data.flags.isSsfEmployerHead ?? false,
    isRemoteAllowance: data.flags.isRemoteAllowance ?? false,
    isCitHead: data.flags.isCitHead ?? false,
    updatedAt: new Date(),
  }).where(eq(payHeads.id, id)).returning();

  return mapRowToPayHead(rows[0]);
}

export interface PayHeadSalaryMappingUsage {
  count: number;
  sampleEmployees: Array<{ fullName: string; employeeCode: string }>;
}

export async function getPayHeadSalaryMappingUsage(payHeadId: string): Promise<PayHeadSalaryMappingUsage> {
  const db = getDb();

  const countRows = await db
    .select({ total: sql<number>`count(distinct ${employeeSalaryMap.employeeId})::int` })
    .from(employeeSalaryHeads)
    .innerJoin(employeeSalaryMap, eq(employeeSalaryHeads.salaryMapId, employeeSalaryMap.id))
    .where(eq(employeeSalaryHeads.payHeadId, payHeadId));

  const total = countRows[0]?.total ?? 0;
  if (total === 0) {
    return { count: 0, sampleEmployees: [] };
  }

  const sampleRows = await db
    .selectDistinct({
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
    })
    .from(employeeSalaryHeads)
    .innerJoin(employeeSalaryMap, eq(employeeSalaryHeads.salaryMapId, employeeSalaryMap.id))
    .innerJoin(employees, eq(employeeSalaryMap.employeeId, employees.id))
    .where(eq(employeeSalaryHeads.payHeadId, payHeadId))
    .limit(5);

  return {
    count: total,
    sampleEmployees: sampleRows,
  };
}

export async function getPayHeadPayslipUsage(payHeadId: string): Promise<{ count: number }> {
  const countRows = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(payrollSlipHeads)
    .where(eq(payrollSlipHeads.payHeadId, payHeadId));

  return {
    count: countRows[0]?.total ?? 0,
  };
}

export async function deletePayHead(id: string): Promise<void> {
  await getDb().delete(payHeads).where(eq(payHeads.id, id));
}
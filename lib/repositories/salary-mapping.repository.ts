import { getDb } from "@/lib/db";
import { employeeSalaryMap, employeeSalaryHeads, payHeads } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { 
  SalaryMapping, 
  SalaryMappingFilter, 
  SalaryHeadAssignment 
} from "@/lib/types/salary-mapping";

type SalaryMapRow = typeof employeeSalaryMap.$inferSelect;
type SalaryHeadRowJoined = {
  id: string;
  salaryMapId: string;
  payHeadId: string;
  amount: string;
  isChangeable: boolean;
  payHeadName: string | null;
  payHeadType: string | null;
};

function mapRowsToSalaryMappings(mapRows: SalaryMapRow[], headRows: SalaryHeadRowJoined[]): SalaryMapping[] {
  const headsByMapId = new Map<string, SalaryHeadAssignment[]>();

  for (const row of headRows) {
    const list = headsByMapId.get(row.salaryMapId) || [];
    list.push({
      id: row.id,
      payHeadId: row.payHeadId,
      payHeadName: row.payHeadName ?? "Unknown Head",
      payHeadType: (row.payHeadType === "deduction" ? "deduction" : "allowance") as "allowance" | "deduction",
      amount: Number(row.amount) || 0,
      isChangeable: row.isChangeable,
    });
    headsByMapId.set(row.salaryMapId, list);
  }

  return mapRows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    fiscalYearId: row.fiscalYearId,
    effectiveFrom: row.effectiveFrom,
    basicSalary: Number(row.basicSalary) || 0,
    gradePercent: Number(row.gradePercent) || 0,
    gradeAmount: Number(row.gradeAmount) || 0,
    salaryHeads: headsByMapId.get(row.id) || [],
    loan1Deduction: Number(row.loan1Deduction) || 0,
    loan2Deduction: Number(row.loan2Deduction) || 0,
    loan1Remaining: 0,
    loan2Remaining: 0,
    netAmount: Number(row.netAmount) || 0,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function fetchHeadsForMaps(mapIds: string[]): Promise<SalaryHeadRowJoined[]> {
  if (mapIds.length === 0) return [];
  return await getDb()
    .select({
      id: employeeSalaryHeads.id,
      salaryMapId: employeeSalaryHeads.salaryMapId,
      payHeadId: employeeSalaryHeads.payHeadId,
      amount: employeeSalaryHeads.amount,
      isChangeable: employeeSalaryHeads.isChangeable,
      payHeadName: payHeads.name,
      payHeadType: payHeads.type,
    })
    .from(employeeSalaryHeads)
    .leftJoin(payHeads, eq(employeeSalaryHeads.payHeadId, payHeads.id))
    .where(inArray(employeeSalaryHeads.salaryMapId, mapIds));
}

export async function findAllSalaryMappings(filter?: any): Promise<SalaryMapping[]> {
  const conditions = [];
  if (filter?.employeeId) conditions.push(eq(employeeSalaryMap.employeeId, filter.employeeId));
  if (filter?.fiscalYearId) conditions.push(eq(employeeSalaryMap.fiscalYearId, filter.fiscalYearId));
  if (filter?.isActive !== undefined) conditions.push(eq(employeeSalaryMap.isActive, filter.isActive));

  const mapRows = await getDb().select().from(employeeSalaryMap).where(and(...conditions)).orderBy(desc(employeeSalaryMap.createdAt));
  if (mapRows.length === 0) return [];
  const headRows = await fetchHeadsForMaps(mapRows.map((r) => r.id));
  return mapRowsToSalaryMappings(mapRows, headRows);
}

export async function findSalaryMappingById(id: string): Promise<SalaryMapping | null> {
  const mapRows = await getDb().select().from(employeeSalaryMap).where(eq(employeeSalaryMap.id, id));
  if (!mapRows.length) return null;
  const heads = await fetchHeadsForMaps([id]);
  return mapRowsToSalaryMappings(mapRows, heads)[0];
}

export async function findActiveSalaryMappingByEmployeeId(employeeId: string): Promise<SalaryMapping | null> {
  const mapRows = await getDb().select().from(employeeSalaryMap).where(and(eq(employeeSalaryMap.employeeId, employeeId), eq(employeeSalaryMap.isActive, true)));
  if (!mapRows.length) return null;
  const heads = await fetchHeadsForMaps([mapRows[0].id]);
  return mapRowsToSalaryMappings(mapRows, heads)[0];
}

export async function findActiveSalaryMappingsByEmployeeIds(employeeIds: string[]): Promise<SalaryMapping[]> {
  if (employeeIds.length === 0) return [];
  const mapRows = await getDb().select().from(employeeSalaryMap).where(and(inArray(employeeSalaryMap.employeeId, employeeIds), eq(employeeSalaryMap.isActive, true)));
  if (mapRows.length === 0) return [];
  const mapIds = mapRows.map((r) => r.id);
  const heads = await fetchHeadsForMaps(mapIds);
  return mapRowsToSalaryMappings(mapRows, heads);
}

export async function findSalaryMappingByEmployeeId(employeeId: string): Promise<SalaryMapping | null> {
  const mapRows = await getDb().select().from(employeeSalaryMap).where(and(eq(employeeSalaryMap.employeeId, employeeId), eq(employeeSalaryMap.isActive, true)));
  if (!mapRows.length) return null;
  const heads = await fetchHeadsForMaps([mapRows[0].id]);
  return mapRowsToSalaryMappings(mapRows, heads)[0];
}

export async function findAllActiveSalaryMappings(): Promise<SalaryMapping[]> {
  const mapRows = await getDb().select().from(employeeSalaryMap).where(eq(employeeSalaryMap.isActive, true)).orderBy(desc(employeeSalaryMap.createdAt));
  if (mapRows.length === 0) return [];
  const headRows = await fetchHeadsForMaps(mapRows.map((r) => r.id));
  return mapRowsToSalaryMappings(mapRows, headRows);
}

export async function saveSalaryMapping(data: {
  id?: string;
  employeeId: string;
  fiscalYearId: string;
  effectiveFrom: string;
  basicSalary: number;
  gradePercent?: number;
  gradeAmount?: number;
  salaryHeads: Array<{ payHeadId: string; amount: number; isChangeable?: boolean }>;
  loan1Deduction?: number;
  loan2Deduction?: number;
  netAmount: number;
  isActive?: boolean;
}): Promise<SalaryMapping> {
  return await getDb().transaction(async (tx) => {
    let mapId = data.id;

    if (data.isActive !== false) {
      await tx.update(employeeSalaryMap)
        .set({ isActive: false })
        .where(eq(employeeSalaryMap.employeeId, data.employeeId));
    }

    if (mapId) {
      await tx.update(employeeSalaryMap).set({
        fiscalYearId: data.fiscalYearId,
        effectiveFrom: data.effectiveFrom,
        basicSalary: data.basicSalary.toString(),
        gradePercent: (data.gradePercent ?? 0).toString(),
        gradeAmount: (data.gradeAmount ?? 0).toString(),
        loan1Deduction: (data.loan1Deduction ?? 0).toString(),
        loan2Deduction: (data.loan2Deduction ?? 0).toString(),
        netAmount: data.netAmount.toString(),
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      }).where(eq(employeeSalaryMap.id, mapId));

      await tx.delete(employeeSalaryHeads).where(eq(employeeSalaryHeads.salaryMapId, mapId));
    } else {
      const inserted = await tx.insert(employeeSalaryMap).values({
        employeeId: data.employeeId,
        fiscalYearId: data.fiscalYearId,
        effectiveFrom: data.effectiveFrom,
        basicSalary: data.basicSalary.toString(),
        gradePercent: (data.gradePercent ?? 0).toString(),
        gradeAmount: (data.gradeAmount ?? 0).toString(),
        loan1Deduction: (data.loan1Deduction ?? 0).toString(),
        loan2Deduction: (data.loan2Deduction ?? 0).toString(),
        netAmount: data.netAmount.toString(),
        isActive: data.isActive ?? true,
      }).returning({ id: employeeSalaryMap.id });
      mapId = inserted[0].id;
    }

    if (data.salaryHeads.length > 0) {
      await tx.insert(employeeSalaryHeads).values(
        data.salaryHeads.map((h) => ({
          salaryMapId: mapId!,
          payHeadId: h.payHeadId,
          amount: h.amount.toString(),
          isChangeable: h.isChangeable ?? true,
        }))
      );
    }

    const mapRows = await tx.select().from(employeeSalaryMap).where(eq(employeeSalaryMap.id, mapId!));
    const heads = await fetchHeadsForMaps([mapId!]);
    return mapRowsToSalaryMappings(mapRows, heads)[0];
  });
}

export async function deleteSalaryMapping(id: string): Promise<boolean> {
  const res = await getDb().delete(employeeSalaryMap).where(eq(employeeSalaryMap.id, id)).returning({ id: employeeSalaryMap.id });
  return res.length > 0;
}

export async function deactivateSalaryMapping(id: string): Promise<boolean> {
  const res = await getDb().update(employeeSalaryMap).set({ isActive: false, updatedAt: new Date() }).where(eq(employeeSalaryMap.id, id)).returning({ id: employeeSalaryMap.id });
  return res.length > 0;
}

export const findActiveByEmployeeIds = async (employeeIds: string[]): Promise<Map<string, SalaryMapping>> => {
  const result = new Map<string, SalaryMapping>();
  const mappings = await findActiveSalaryMappingsByEmployeeIds(employeeIds);
  for (const m of mappings) {
    result.set(m.employeeId, m);
  }
  return result;
};

export const findActiveMappings = findAllActiveSalaryMappings;
export const findById = findSalaryMappingById;
export const findByEmployeeId = findSalaryMappingByEmployeeId;
export const create = async (data: Partial<SalaryMapping>): Promise<SalaryMapping> => {
  return await saveSalaryMapping({
    id: data.id,
    employeeId: data.employeeId!,
    fiscalYearId: data.fiscalYearId || 'fy-1',
    effectiveFrom: data.effectiveFrom || new Date().toISOString().split('T')[0],
    basicSalary: data.basicSalary ?? 0,
    gradePercent: data.gradePercent,
    gradeAmount: data.gradeAmount,
    salaryHeads: data.salaryHeads?.map((h) => ({ payHeadId: h.payHeadId, amount: h.amount, isChangeable: h.isChangeable })) || [],
    loan1Deduction: data.loan1Deduction,
    loan2Deduction: data.loan2Deduction,
    netAmount: data.netAmount ?? 0,
    isActive: data.isActive,
  });
};
export const update = async (idOrData: any, data?: any): Promise<SalaryMapping> => {
  const payload = typeof idOrData === 'string' ? { ...data, id: idOrData } : idOrData;
  return await create(payload);
};
export const remove = deleteSalaryMapping;

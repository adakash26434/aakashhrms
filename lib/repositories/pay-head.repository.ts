import { getDb } from '@/lib/db';
import { payHeads, employeeSalaryHeads, payrollSlipHeads, salaryTemplates } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { PayHead, PayHeadType, CalcBasis, CalcParameter } from '@/lib/types/pay-head';
import type { PayHeadWrite } from '@/lib/engines/pay-head.engine';

// Pay heads (4.12b). Reads never write; a head's code is given once and never changes.

type PayHeadRow = typeof payHeads.$inferSelect;

function mapRowToPayHead(row: PayHeadRow): PayHead {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameNp: row.nameNp ?? null,
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
  const rows = await (await getDb()).select().from(payHeads);
  return rows.map(mapRowToPayHead);
}

export async function findPayHeadById(id: string): Promise<PayHead | undefined> {
  const rows = await (await getDb()).select().from(payHeads).where(eq(payHeads.id, id));
  if (!rows.length) return undefined;
  return mapRowToPayHead(rows[0]);
}

const columns = (w: PayHeadWrite) => ({
  name: w.name,
  nameNp: w.nameNp,
  type: w.type,
  effectOnTax: w.effectOnTax,
  calcBasis: w.calcBasis,
  calcParameter: w.calcParameter,
  calcPercent: String(w.calcPercent),
  applicableDepartmentIds: w.applicableDepartmentIds,
  applicableDesignationIds: w.applicableDesignationIds,
  ...w.flags,
});

export async function insertPayHead(code: string, write: PayHeadWrite): Promise<PayHead> {
  const [row] = await (await getDb()).insert(payHeads).values({ code, ...columns(write) }).returning();
  return mapRowToPayHead(row);
}

export async function updatePayHead(id: string, write: PayHeadWrite): Promise<PayHead | null> {
  const [row] = await (await getDb()).update(payHeads).set({ ...columns(write), updatedAt: new Date() }).where(eq(payHeads.id, id)).returning();
  return row ? mapRowToPayHead(row) : null;
}

export interface PayHeadUsage {
  structures: number;
  payslips: number;
  templates: number;
}

/** Salary structures (any revision), payslip lines and salary templates that name each head. */
export async function usageByHead(): Promise<Map<string, PayHeadUsage>> {
  const db = await getDb();
  const templateHead = sql<string>`jsonb_array_elements(${salaryTemplates.heads})->>'payHeadId'`;
  const [structures, payslips, templates] = await Promise.all([
    db.select({ id: employeeSalaryHeads.payHeadId, n: sql<number>`count(distinct ${employeeSalaryHeads.salaryMapId})` }).from(employeeSalaryHeads).groupBy(employeeSalaryHeads.payHeadId),
    db.select({ id: payrollSlipHeads.payHeadId, n: sql<number>`count(*)` }).from(payrollSlipHeads).groupBy(payrollSlipHeads.payHeadId),
    db.select({ id: templateHead }).from(salaryTemplates),
  ]);
  const out = new Map<string, PayHeadUsage>();
  const at = (id: string) => out.get(id) ?? out.set(id, { structures: 0, payslips: 0, templates: 0 }).get(id)!;
  for (const r of structures) if (r.id) at(r.id).structures = Number(r.n);
  for (const r of payslips) if (r.id) at(r.id).payslips = Number(r.n);
  for (const r of templates) if (r.id) at(r.id).templates += 1;
  return out;
}

/** Deletes a head nothing names (false: gone already). The foreign keys refuse one in use. */
export async function deletePayHead(id: string): Promise<boolean> {
  const rows = await (await getDb()).delete(payHeads).where(eq(payHeads.id, id)).returning({ id: payHeads.id });
  return rows.length > 0;
}

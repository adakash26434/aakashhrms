import { getDb } from '@/lib/db';
import { employeePersonal, employees, payHeads, payrollRuns, payrollSlipHeads, payrollSlips } from '@/lib/db/schema';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';

// Bilingual payslip (4.8 / F11): Drizzle queries only. The statement is arranged by
// lib/engines/payslip-view.engine.ts; orchestration in lib/services/payslip-sheet.service.ts.

export type SlipRow = typeof payrollSlips.$inferSelect;
export type RunRow = typeof payrollRuns.$inferSelect;

export interface SheetSlipRow {
  slip: SlipRow;
  run: Pick<RunRow, 'id' | 'calendar' | 'payPeriodYear' | 'payPeriodMonth' | 'runType' | 'status'>;
  pan: string | null;
}

/** Payslips with their run and the employee's PAN; `where` narrows by run, slip, employee, scope or visibility. */
export async function sheetSlips(where: { runId?: string; slipId?: string; employeeId?: string; scope?: SQL; extra?: SQL[] }): Promise<SheetSlipRow[]> {
  return (await getDb())
    .select({
      slip: payrollSlips,
      run: { id: payrollRuns.id, calendar: payrollRuns.calendar, payPeriodYear: payrollRuns.payPeriodYear, payPeriodMonth: payrollRuns.payPeriodMonth, runType: payrollRuns.runType, status: payrollRuns.status },
      pan: employeePersonal.panNumber,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
    .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
    .where(
      and(
        where.runId ? eq(payrollSlips.payrollRunId, where.runId) : undefined,
        where.slipId ? eq(payrollSlips.id, where.slipId) : undefined,
        where.employeeId ? eq(payrollSlips.employeeId, where.employeeId) : undefined,
        where.scope,
        ...(where.extra ?? []),
      ),
    )
    .orderBy(asc(payrollSlips.employeeName));
}

export interface SheetHeadRow {
  head: typeof payrollSlipHeads.$inferSelect;
  /** The pay head master row (null when the head no longer exists). */
  master: Pick<typeof payHeads.$inferSelect, 'code' | 'name' | 'nameNp' | 'type' | 'isTdsHead' | 'isPfHead' | 'isSsfHead' | 'isSsfEmployerHead' | 'isCitHead'> | null;
}

/** The head lines of these payslips with each head's Nepali name and statutory flags. */
export async function sheetHeads(slipIds: string[]): Promise<SheetHeadRow[]> {
  if (!slipIds.length) return [];
  const rows = await (await getDb())
    .select({
      head: payrollSlipHeads,
      code: payHeads.code,
      name: payHeads.name,
      nameNp: payHeads.nameNp,
      type: payHeads.type,
      isTdsHead: payHeads.isTdsHead,
      isPfHead: payHeads.isPfHead,
      isSsfHead: payHeads.isSsfHead,
      isSsfEmployerHead: payHeads.isSsfEmployerHead,
      isCitHead: payHeads.isCitHead,
    })
    .from(payrollSlipHeads)
    .leftJoin(payHeads, eq(payHeads.id, payrollSlipHeads.payHeadId))
    .where(inArray(payrollSlipHeads.payrollSlipId, slipIds));
  return rows.map(({ head, ...m }) => ({
    head,
    master: m.code === null ? null : { code: m.code, name: m.name!, nameNp: m.nameNp, type: m.type!, isTdsHead: !!m.isTdsHead, isPfHead: !!m.isPfHead, isSsfHead: !!m.isSsfHead, isSsfEmployerHead: !!m.isSsfEmployerHead, isCitHead: !!m.isCitHead },
  }));
}

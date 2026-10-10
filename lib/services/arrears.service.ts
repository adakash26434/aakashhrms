import * as salaryMappingRepository from '@/lib/repositories/salary-mapping.repository';
import * as feedsRepository from '@/lib/repositories/payroll-feeds.repository';
import { arrearsForMonths, linesToSettle, type ArrearsLine } from '@/lib/engines/arrears.engine';

// Arrears (4.8 / F7): orchestration. For each employee the finalised months before
// the run's period are compared with the revision in force at each month's end;
// a net shortfall is paid through the new run (ARREARS head) and recorded so the
// same month is never paid twice.

export interface EmployeeArrears {
  /** Rupees paid through this run (0 when the net is not positive). */
  payable: number;
  /** Net of all months, can be negative (shown, never deducted automatically). */
  net: number;
  lines: (ArrearsLine & { employeeId: string })[];
}

export async function arrearsFor(employeeIds: string[], periodStart: string): Promise<Map<string, EmployeeArrears>> {
  const out = new Map<string, EmployeeArrears>();
  const months = await feedsRepository.paidMonths(employeeIds, periodStart);
  if (!months.length) return out;
  // One in-force lookup per distinct period end.
  const ends = [...new Set(months.map((m) => m.periodEnd))];
  const dueByEnd = new Map<string, Map<string, number>>();
  for (const end of ends) {
    const ids = [...new Set(months.filter((m) => m.periodEnd === end).map((m) => m.employeeId))];
    const inForce = await salaryMappingRepository.findInForceByEmployeeIds(ids, end);
    dueByEnd.set(end, new Map([...inForce].map(([id, map]) => [id, Number(map.basicSalary) + Number(map.gradeAmount)])));
  }
  const byEmployee = new Map<string, typeof months>();
  for (const m of months) byEmployee.set(m.employeeId, [...(byEmployee.get(m.employeeId) ?? []), m]);
  for (const [employeeId, list] of byEmployee) {
    const result = arrearsForMonths(
      list
        // A month with no revision in force has nothing to compare against.
        .filter((m) => dueByEnd.get(m.periodEnd)?.has(employeeId))
        .map((m) => ({ runId: m.runId, periodEnd: m.periodEnd, paid: m.paid, due: dueByEnd.get(m.periodEnd)!.get(employeeId)!, alreadyPaid: m.alreadyPaid })),
    );
    if (result.lines.length) out.set(employeeId, { payable: result.payable, net: result.net, lines: linesToSettle(result).map((l) => ({ ...l, employeeId })) });
  }
  return out;
}

export async function settle(runId: string, arrears: Map<string, EmployeeArrears>): Promise<number> {
  const rows = [...arrears.values()].flatMap((a) => a.lines.map((l) => ({ employeeId: l.employeeId, sourceRunId: l.runId, amount: l.amount })));
  return feedsRepository.settleArrears(runId, rows);
}

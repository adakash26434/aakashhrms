// Arrears (4.8 / F7): back pay when a salary revision takes effect for months
// whose payroll is already approved or locked. For each such month the pay
// that was due under the revision in force at that month's end is compared
// with what the payslip paid (plus any arrears already paid for it). Pure:
// all arithmetic in paisa, no database.

export interface FinalisedMonth {
  /** The payroll run that paid the month. */
  runId: string;
  /** AD period end of that run, YYYY-MM-DD. */
  periodEnd: string;
  /** basic + grade on the payslip, as paid. */
  paid: number;
  /** basic + grade of the revision in force at the period end. */
  due: number;
  /** Arrears already paid for this (employee, run) in earlier runs. */
  alreadyPaid: number;
}

export interface ArrearsLine {
  runId: string;
  periodEnd: string;
  /** Difference for the month, rupees (can be negative). */
  amount: number;
}

export interface ArrearsResult {
  lines: ArrearsLine[];
  /** Net of all lines, rupees. */
  net: number;
  /** What the next run pays: the net when positive, else 0 (a negative net is shown, never deducted automatically). */
  payable: number;
}

const paisa = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);

export function arrearsForMonths(months: readonly FinalisedMonth[]): ArrearsResult {
  const lines: ArrearsLine[] = [];
  let netP = 0;
  for (const m of [...months].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))) {
    const diff = paisa(m.due) - paisa(m.paid) - paisa(m.alreadyPaid);
    if (diff === 0) continue;
    lines.push({ runId: m.runId, periodEnd: m.periodEnd, amount: diff / 100 });
    netP += diff;
  }
  return { lines, net: netP / 100, payable: netP > 0 ? netP / 100 : 0 };
}

/**
 * The lines to settle with the run that pays them: only when the net is
 * payable. Each month is recorded at its own amount so a later correction
 * of the same month is compared against what was already paid.
 */
export function linesToSettle(result: ArrearsResult): ArrearsLine[] {
  return result.payable > 0 ? result.lines : [];
}

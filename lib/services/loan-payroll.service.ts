import Decimal from "decimal.js";
import * as repo from "@/lib/repositories/loan.repository";
import { capLines, linesTotal, monthLines, npr, spreadDeduction, type LoanLine } from "@/lib/engines/loan.engine";
import { NegativeNetPayableError } from "@/lib/engines/payroll.engine";
import { UserFacingError } from "@/lib/errors/action-error";
import { payMonthOf } from "@/lib/utils/pay-month";

// Loans in payroll (4.10): what each regular payslip deducts for each running loan. The lines are
// worked out with the payslip (generation, recalculation, a typed loan deduction), kept with it in
// payroll_slip_loans, and posted to the loans when the run locks — claim-first, inside the lock's
// transaction, so a loan repaid or closed meanwhile stops the lock instead of being deducted twice.
// Payroll deducts a loan only when one is recorded (the salary structure's old loan amounts are no
// longer read) and only from its first deduction month. Someone whose final settlement is
// approved has nothing deducted: the settlement recovers their loans when it is paid.

export interface EmployeeLoanLines {
  /** "5500.00" */
  total: string;
  lines: LoanLine[];
}

export interface RunMonth {
  /** BS year and month the run pays. */
  year: number;
  month: number;
  /** AD date the pay period ends. */
  periodEnd: string;
}

/** Per employee, the loan lines this month's payslip carries (`excludeSlipId`: the payslip being worked out again). */
export async function loanLinesFor(employeeIds: string[], run: RunMonth, opts: { excludeSlipId?: string | null } = {}): Promise<Map<string, EmployeeLoanLines>> {
  if (!employeeIds.length) return new Map();
  const [loans, held] = await Promise.all([repo.runningLoansFor(employeeIds), repo.heldBySettlement(employeeIds)]);
  const live = loans.filter((l) => !held.has(l.employeeId));
  const reserved = await repo.reservedByLoan(
    live.map((l) => l.id),
    opts.excludeSlipId ?? null
  );
  const month = { payMonth: payMonthOf(run.year, run.month), periodEnd: run.periodEnd };
  const byEmployee = new Map<string, repo.RunningLoanRow[]>();
  for (const l of live) byEmployee.set(l.employeeId, [...(byEmployee.get(l.employeeId) ?? []), l]);
  const out = new Map<string, EmployeeLoanLines>();
  for (const [employeeId, list] of byEmployee) {
    const lines = monthLines(
      list.map((l) => ({ id: l.id, installment: l.installment, remaining: l.remaining, reserved: reserved.get(l.id)?.amount ?? 0, firstDeductionMonth: l.firstDeductionMonth, givenDate: l.givenDate })),
      month
    );
    if (lines.length) out.set(employeeId, { total: linesTotal(lines), lines });
  }
  return out;
}

/**
 * Works a payslip out with its loan lines (`calc` runs the payroll engine with a loan deduction).
 * When the installments would take net pay below zero they are cut to what the pay can bear —
 * oldest loans first — and the rest stays on the loans; the payslip carries a warning.
 */
export function calculateWithLoans<T extends { netPayable: string }>(calc: (loanDeduction: string) => T, scheduled: EmployeeLoanLines | undefined): { result: T; lines: LoanLine[]; warning: string | null } {
  const lines = scheduled?.lines ?? [];
  const total = linesTotal(lines);
  try {
    return { result: calc(total), lines, warning: null };
  } catch (error: unknown) {
    if (!(error instanceof NegativeNetPayableError) || !(Number(total) > 0)) throw error;
    // Without the loans the pay is still short: not a loan problem, so the original error stands.
    const bare = calc("0");
    const capped = capLines(lines, bare.netPayable);
    const cut = new Decimal(total).minus(linesTotal(capped));
    return { result: calc(linesTotal(capped)), lines: capped, warning: `Loan installments cut by NPR ${npr(cut)}: the pay could not cover them, so it stays on the loan.` };
  }
}

/**
 * A loan deduction typed on a payslip instead of the installments: spread over the employee's
 * running loans oldest first, each up to what it owes beyond other unlocked payslips. Zero skips
 * the month (the loan runs a month longer).
 */
export async function spreadTypedDeduction(employeeId: string, slipId: string, amount: unknown): Promise<EmployeeLoanLines> {
  const [loans, held] = await Promise.all([repo.runningLoansFor([employeeId]), repo.heldBySettlement([employeeId])]);
  if (held.has(employeeId) && Number(amount) !== 0) throw new UserFacingError("This employee's final settlement is approved and recovers their loans: nothing is deducted here.");
  const reserved = await repo.reservedByLoan(
    loans.map((l) => l.id),
    slipId
  );
  const result = spreadDeduction(
    amount,
    loans.map((l) => ({ loanId: l.id, available: new Decimal(l.remaining).minus(reserved.get(l.id)?.amount ?? 0) }))
  );
  if ("error" in result) throw new UserFacingError(result.error);
  return { total: linesTotal(result.lines), lines: result.lines };
}

/** Keeps a payslip's loan lines (inside the transaction that writes the payslip). */
export const writeSlipLoanLines = (tx: repo.Tx, slipId: string, lines: readonly LoanLine[]) => repo.writeSlipLines(tx, slipId, lines);

/**
 * At lock, inside the lock's transaction: every payslip's loan lines are posted to their loans as
 * salary-deduction repayments. Claim-first — a loan that no longer owes the amount (repaid in cash,
 * written off, closed by a settlement after the payslip was worked out) stops the lock. A payslip
 * worked out before loan lines existed spreads its loan deduction over the running loans now.
 */
export async function postRunLoansTx(tx: repo.Tx, runId: string, p: { userId: string; date: string }): Promise<number> {
  const slips = await repo.runSlipLoans(tx, runId);
  let posted = 0;
  for (const slip of slips) {
    const who = `${slip.employeeName} (${slip.employeeCode})`;
    const total = new Decimal(slip.loanDeduction || 0);
    let lines = slip.lines;
    if (!lines.length) {
      if (total.lte(0)) continue;
      const running = await repo.runningLoansFor([slip.employeeId], tx);
      const spread = spreadDeduction(total.toFixed(2), running.map((l) => ({ loanId: l.id, available: l.remaining })));
      if ("error" in spread) throw new UserFacingError(`${who}: the payslip deducts NPR ${npr(total)} for loans, more than their loans owe. Send the run back to draft and recalculate the payslip.`);
      lines = spread.lines.map((l) => ({ ...l, typeName: running.find((r) => r.id === l.loanId)?.typeName ?? "loan" }));
    } else if (!new Decimal(linesTotal(lines)).eq(total)) {
      throw new UserFacingError(`${who}: the payslip's loan deduction no longer matches its loans. Send the run back to draft and recalculate the payslip.`);
    }
    for (const line of lines) {
      const ok = await repo.postPayment(tx, {
        loanId: line.loanId,
        employeeId: slip.employeeId,
        amount: new Decimal(line.amount).toFixed(2),
        date: p.date,
        method: "SALARY_DEDUCTION",
        payrollSlipId: slip.slipId,
        userId: p.userId,
        keepReserved: false,
        closedHow: "repaid",
      });
      if (!ok) throw new UserFacingError(`${who}: the ${line.typeName} no longer owes NPR ${npr(line.amount)} (repaid, written off or settled after the payslip was worked out). Send the run back to draft and recalculate the payslip.`);
      posted += 1;
    }
  }
  return posted;
}

/** What one payslip deducts for each loan (the payslip view). */
export async function slipLoanLines(slipId: string) {
  return (await repo.slipLines(slipId)).map((l) => ({ loanId: l.loanId, typeName: l.typeName, amount: Number(l.amount) }));
}

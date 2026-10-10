import { getDb } from "@/lib/db";
import * as feedsRepository from "@/lib/repositories/payroll-feeds.repository";
import * as payrollRepository from "@/lib/repositories/payroll.repository";
import * as arrearsService from "@/lib/services/arrears.service";
import { UserFacingError } from "@/lib/errors/action-error";

// Payroll feeds (4.8): what a run pays from other modules' records — TA-DA claims and arrears —
// is settled together with the payslips that pay it, and given back together with them. A claim
// is never "settled" without a payslip paying it, and a payslip never pays one that isn't.

export const CLAIM_CHANGED =
  "A travel claim changed while the run was being generated (returned, rejected or paid by another run). Generate the run again.";

/** Inside the transaction that creates a run's payslips: settle what they pay, or stop the run. */
export async function settleRunFeedsTx(
  tx: feedsRepository.Tx,
  runId: string,
  claimIds: readonly string[],
  arrears: Map<string, arrearsService.EmployeeArrears>
): Promise<void> {
  const settled = await feedsRepository.settleClaimsThroughRun([...claimIds], runId, tx);
  if (settled !== claimIds.length) throw new UserFacingError(CLAIM_CHANGED);
  await arrearsService.settle(runId, arrears, tx);
}

/** Deletes a draft run: its claims are given back, its arrears rows go with it (cascade). */
export async function discardDraftRun(runId: string): Promise<void> {
  await (await getDb()).transaction(async (tx) => {
    await feedsRepository.releaseClaimsOfRun(runId, { tx });
    await payrollRepository.deletePayrollRun(runId, tx);
  });
}

/** Deletes one payslip: the employee's claims and arrears it paid are given back with it. */
export async function deleteSlipWithFeeds(slip: { id: string; payrollRunId: string; employeeId: string }): Promise<void> {
  await (await getDb()).transaction(async (tx) => {
    await feedsRepository.releaseClaimsOfRun(slip.payrollRunId, { employeeId: slip.employeeId, tx });
    await feedsRepository.releaseArrearsOfRun(slip.payrollRunId, slip.employeeId, tx);
    await payrollRepository.deletePayrollSlip(slip.id, tx);
  });
}

import { getDb } from "@/lib/db";
import * as feedsRepository from "@/lib/repositories/payroll-feeds.repository";
import * as payrollRepository from "@/lib/repositories/payroll.repository";
import * as arrearsService from "@/lib/services/arrears.service";
import { UserFacingError } from "@/lib/errors/action-error";

// Payroll feeds (4.8): what a run pays from other modules' records — TA-DA claims, reimbursements (F16), leave salary (4.9) and arrears —
// is settled together with the payslips that pay it, and given back together with them. A claim
// is never "settled" without a payslip paying it, and a payslip never pays one that isn't.

export const CLAIM_CHANGED =
  "A travel or reimbursement claim or a leave salary changed while the run was being generated (returned, cancelled or paid by another run). Generate the run again.";

/** What a run's payslips pay from other modules' records. */
export interface RunFeeds {
  claimIds: readonly string[];
  reimbursementIds: readonly string[];
  /** 4.9: approved leave salary the payslips pay (LEAVE_ENCASH). */
  leaveSalaryIds: readonly string[];
  arrears: Map<string, arrearsService.EmployeeArrears>;
}

/** Inside the transaction that creates a run's payslips: settle what they pay, or stop the run. */
export async function settleRunFeedsTx(tx: feedsRepository.Tx, runId: string, feeds: RunFeeds): Promise<void> {
  const claims = await feedsRepository.settleClaimsThroughRun([...feeds.claimIds], runId, tx);
  const reimbursements = await feedsRepository.settleReimbursementsThroughRun([...feeds.reimbursementIds], runId, tx);
  const leaveSalary = await feedsRepository.settleLeaveSalaryThroughRun([...feeds.leaveSalaryIds], runId, tx);
  if (claims !== feeds.claimIds.length || reimbursements !== feeds.reimbursementIds.length || leaveSalary !== feeds.leaveSalaryIds.length) throw new UserFacingError(CLAIM_CHANGED);
  await arrearsService.settle(runId, feeds.arrears, tx);
}

/** Deletes a draft run: its claims are given back, its arrears rows go with it (cascade). */
export async function discardDraftRun(runId: string): Promise<void> {
  await (await getDb()).transaction(async (tx) => {
    await feedsRepository.releaseClaimsOfRun(runId, { tx });
    await feedsRepository.releaseReimbursementsOfRun(runId, { tx });
    await feedsRepository.releaseLeaveSalaryOfRun(runId, { tx });
    await payrollRepository.deletePayrollRun(runId, tx);
  });
}

/** Deletes one payslip: the employee's claims and arrears it paid are given back with it. */
export async function deleteSlipWithFeeds(slip: { id: string; payrollRunId: string; employeeId: string }): Promise<void> {
  await (await getDb()).transaction(async (tx) => {
    await feedsRepository.releaseClaimsOfRun(slip.payrollRunId, { employeeId: slip.employeeId, tx });
    await feedsRepository.releaseReimbursementsOfRun(slip.payrollRunId, { employeeId: slip.employeeId, tx });
    await feedsRepository.releaseLeaveSalaryOfRun(slip.payrollRunId, { employeeId: slip.employeeId, tx });
    await feedsRepository.releaseArrearsOfRun(slip.payrollRunId, slip.employeeId, tx);
    await payrollRepository.deletePayrollSlip(slip.id, tx);
  });
}

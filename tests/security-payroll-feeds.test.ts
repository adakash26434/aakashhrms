import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEED_HEAD_CODES, FEED_SOURCE, isFeedHeadCode } from '@/lib/constants/payroll-feeds';

// 4.8 payroll feeds hardening and S45. A pay run's one-off lines (TA-DA claims, arrears, the
// welfare-fund deduction) are paid on exactly one payslip and settled with it: regenerating a
// run, deleting a payslip or recalculating it no longer leaves claims "settled" but unpaid, a
// claim that changes while a run is generated stops the run, and the lines are never typed on a
// payslip. S45: locking a run used to write every payslip head (one-off lines and reviewers'
// overrides included) into the employee's salary structure — one-off lines were paid again every
// month and an override became permanent pay without a salary revision or its approval.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const service = read('lib/services/payroll.service.ts');
const offCycle = read('lib/services/off-cycle.service.ts');
const feedService = read('lib/services/payroll-feed.service.ts');
const feeds = read('lib/repositories/payroll-feeds.repository.ts');
const fn = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, name);
  return src.slice(start, src.indexOf('\n}\n', start));
};

describe('payroll feeds: one payslip, settled with it', () => {
  it('the feed codes and where their amounts come from', () => {
    assert.deepEqual([...FEED_HEAD_CODES], ['TADA', 'WELFARE_FUND', 'ARREARS', 'REIMBURSE', 'REIMBURSE_TAX', 'LEAVE_ENCASH']);
    for (const code of FEED_HEAD_CODES) assert.ok(FEED_SOURCE[code]);
    assert.equal(isFeedHeadCode('ARREARS'), true);
    assert.equal(isFeedHeadCode('BASIC'), false);
    assert.equal(isFeedHeadCode(null), false);
  });

  it('a run settles what it pays in its own transaction, or stops', () => {
    const settle = feedService.slice(feedService.indexOf('export async function settleRunFeedsTx'));
    assert.match(settle, /const claims = await feedsRepository\.settleClaimsThroughRun\(\[\.\.\.feeds\.claimIds\], runId, tx\);/);
    assert.match(settle, /if \(claims !== feeds\.claimIds\.length \|\| reimbursements !== feeds\.reimbursementIds\.length \|\| leaveSalary !== feeds\.leaveSalaryIds\.length\) throw new UserFacingError\(CLAIM_CHANGED\);/);
    assert.match(settle, /arrearsService\.settle\(runId, feeds\.arrears, tx\)/);
    // Nothing is settled after a run's transaction any more.
    assert.doesNotMatch(service, /feedsRepository\.settleClaimsThroughRun\(|arrearsService\.settle\(/);
    assert.doesNotMatch(offCycle, /arrearsService\.settle\(/);
    const offTx = offCycle.slice(offCycle.indexOf('await repository.createPayrollSlips(slips, tx);'), offCycle.indexOf('return created;'));
    assert.match(offTx, /payrollFeedService\.settleRunFeedsTx\(tx, created\.id, \{ claimIds: \[\], reimbursementIds: \[\], leaveSalaryIds: \[\], arrears:/);
  });

  it('regenerating, deleting a run or deleting one payslip gives back what it paid', () => {
    const generate = fn(service, 'generatePayrollRun');
    const recreate = generate.slice(generate.indexOf('if (payload.recreateIfExists)'), generate.indexOf('PayrollRunAlreadyExistsError'));
    assert.match(recreate, /await payrollFeedService\.discardDraftRun\(run\.id\);/);
    assert.doesNotMatch(recreate, /repository\.deletePayrollRun\(/);
    assert.match(offCycle, /await payrollFeedService\.discardDraftRun\(run\.id\);/);
    assert.doesNotMatch(offCycle, /repository\.deletePayrollRun\(/);
    assert.match(fn(service, 'deleteEmployeePayslip'), /payrollFeedService\.deleteSlipWithFeeds\(\{ id: slip\.id, payrollRunId: run\.id, employeeId: slip\.employeeId \}\)/);
    const one = feedService.slice(feedService.indexOf('export async function deleteSlipWithFeeds'));
    assert.match(
      one,
      /transaction\(async \(tx\) => \{\s*await feedsRepository\.releaseClaimsOfRun\(slip\.payrollRunId, \{ employeeId: slip\.employeeId, tx \}\);\s*await feedsRepository\.releaseReimbursementsOfRun\(slip\.payrollRunId, \{ employeeId: slip\.employeeId, tx \}\);\s*await feedsRepository\.releaseLeaveSalaryOfRun\(slip\.payrollRunId, \{ employeeId: slip\.employeeId, tx \}\);\s*await feedsRepository\.releaseArrearsOfRun\(slip\.payrollRunId, slip\.employeeId, tx\);\s*await payrollRepository\.deletePayrollSlip\(slip\.id, tx\);/
    );
    assert.match(feeds, /eq\(payrollArrears\.payrollRunId, runId\), eq\(payrollArrears\.employeeId, employeeId\)/);
  });

  it('recalculating keeps the feed lines and uses the salary revision in force for the run month', () => {
    const recalc = fn(service, 'recalculateEmployeePayslip');
    assert.match(recalc, /findInForceByEmployeeIds\(\[emp\.id\], run\.payPeriodEndDate\)/);
    assert.doesNotMatch(recalc, /findSalaryMappingByEmployeeId/);
    assert.match(recalc, /feedsRepository\.paidThroughRun\(run\.id, emp\.id\)/);
    assert.match(recalc, /feedsRepository\.fundContributionsByEmployee\(\[emp\.id\], run\.payPeriodYear, run\.payPeriodMonth\)/);
    // Feed lines never come from a salary structure (generation and recalculation).
    assert.match(recalc, /salaryMap\.salaryHeads\.filter\(\(ah: \{ payHeadId: string \}\) => !isFeedHeadCode\(/);
    assert.match(fn(service, 'generatePayrollRun'), /salaryMap\.salaryHeads\.filter\(\(h: \{ payHeadId: string \}\) => !isFeedHeadCode\(/);
  });

  it('feed lines are never typed or added on a payslip', () => {
    const override = fn(service, 'overridePayslipAllowanceDeduction');
    assert.ok(override.indexOf('if (headId) await assertNotFeedHead(headId);') < override.indexOf('if (isOffCycle(run.runType))'));
    assert.match(fn(service, 'addPayHeadToPayslip'), /if \(isFeedHeadCode\(targetHead\.code\)\) throw new UserFacingError/);
  });
});

describe('S45 locking never changes a salary structure', () => {
  it('the lock writes loan balances only; pay changes are dated, approved revisions', () => {
    const transition = fn(service, 'transitionPayrollRun');
    const lock = transition.slice(transition.indexOf("if (toStatus === 'LOCKED')"));
    assert.doesNotMatch(lock, /employeeSalaryMap|employeeSalaryHeads|calculateNetSalary/);
    assert.doesNotMatch(service, /employeeSalaryHeads|syncedFromLockedPayrollRunId/);
    // The only salary-structure write left on lock is the loan mirror (4.10 debt).
    assert.equal(lock.split('loanService.syncActiveLoansToSalaryMapping(').length, 2);
  });
});

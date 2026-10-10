import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 4.9 leave salary: money out of the leave balance gets pay's guards — LEAVE_SALARY with the user's
// scope, never deciding one's own record or approving what one prepared (S21 / maker-checker,
// audited DENIED_SELF), leaving employees paid in the final settlement only, claim-first moves with
// the ledger lines in the same transaction, and payment only through the pay run's feeds.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/leave-salary.actions.ts');
const service = read('lib/services/leave-salary.service.ts');
const repo = read('lib/repositories/leave-salary.repository.ts');
const feeds = read('lib/repositories/payroll-feeds.repository.ts');
const feedService = read('lib/services/payroll-feed.service.ts');
const fn = (src: string, name: string) => {
  const start = src.search(new RegExp(`(export )?(async )?function ${name}\\b`));
  assert.ok(start >= 0, name);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

describe('4.9 leave salary', () => {
  it('every action checks LEAVE_SALARY with the scope; platform support never changes it', () => {
    assert.match(actions, /^'use server';/);
    assert.match(actions, /const scope = await checkPermissionWithScope\(need, 'LEAVE_SALARY'\);\s*if \(scope\.isImpersonation\) throw new UserFacingError/);
    for (const [name, need] of [
      ['previewLeaveSalaryAction', 'ADD'],
      ['prepareLeaveSalaryAction', 'ADD'],
      ['prepareDueLeaveSalaryAction', 'ADD'],
      ['updateLeaveSalaryAction', 'EDIT'],
      ['deleteLeaveSalaryAction', 'DELETE'],
      ['approveLeaveSalaryAction', 'APPROVE'],
      ['cancelLeaveSalaryAction', 'APPROVE'],
    ] as const) {
      assert.match(fn(actions, name), new RegExp(`ctx\\('${need}'\\)`), name);
    }
    assert.match(read('app/(dashboard)/payroll/leave-salary/page.tsx'), /checkPermissionWithScope\("VIEW", "LEAVE_SALARY"\)/);
  });

  it('records and due days are read within the scope', () => {
    assert.match(fn(service, 'scopedRecord'), /repo\.findRecord\(id, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    const page = fn(service, 'leaveSalaryPage');
    assert.match(page, /const scopeCondition = buildEmployeeScopeCondition\(ctx\.scope\);/);
    assert.match(page, /repo\.listRecords\(scopeCondition\), repo\.dueLines\(scopeCondition\)/);
    assert.match(fn(service, 'prepareDue'), /repo\.dueLines\(buildEmployeeScopeCondition\(ctx\.scope\), ids\)/);
    assert.match(fn(service, 'employeeProblem'), /repo\.activeEmployeeInScope\(employeeId, buildEmployeeScopeCondition\(scope\)\)/);
  });

  it('never one\'s own record, never approving what one prepared (audited DENIED_SELF), before anything moves', () => {
    const refuse = fn(service, 'refuseOwn');
    assert.match(refuse, /const own = isOwnRecord\(ctx\.actorEmployeeId, record\.employeeId\);/);
    assert.match(refuse, /const mine = step === "approve" && record\.createdBy === ctx\.userId;/);
    assert.match(refuse, /result: DENIED_SELF/);
    const approve = fn(service, 'approveRecord');
    assert.ok(approve.indexOf('refuseOwn(ctx, record, "approve")') < approve.indexOf('repo.approve('));
    const cancel = fn(service, 'cancelRecord');
    assert.ok(cancel.indexOf('refuseOwn(ctx, record, "cancel")') < cancel.indexOf('repo.cancel('));
  });

  it('leaving employees are paid in the final settlement: refused when preparing and approving', () => {
    assert.match(fn(service, 'employeeProblem'), /if \(\(await withOpenCase\(\[employeeId\]\)\)\.has\(employeeId\)\) return LEAVING;/);
    assert.match(fn(service, 'prepareEncashment'), /const problem = await employeeProblem\(f\.employeeId, ctx\.scope\);/);
    assert.match(fn(service, 'approveRecord'), /const problem = await employeeProblem\(record\.employeeId, ctx\.scope\);/);
  });

  it('moves are claim-first; the ledger lines go in the same transaction, once per record', () => {
    assert.match(fn(repo, 'approve'), /\.where\(and\(eq\(leaveSalaryRuns\.id, id\), eq\(leaveSalaryRuns\.status, 'DRAFT'\)\)\)[\s\S]*await postLedgerLines\(ledger, tx\);/);
    assert.match(fn(repo, 'cancel'), /eq\(leaveSalaryRuns\.status, 'APPROVED'\), isNull\(leaveSalaryRuns\.payrollRunId\)\)\)[\s\S]*await postLedgerLines\(ledger, tx\);/);
    assert.match(fn(repo, 'updateDraft'), /eq\(leaveSalaryRuns\.status, 'DRAFT'\)/);
    assert.match(fn(repo, 'deleteDraft'), /eq\(leaveSalaryRuns\.status, 'DRAFT'\)/);
    const approve = fn(service, 'approveRecord');
    assert.match(approve, /const ref = `leave-salary:\$\{record\.id\}`;\s*if \(!\(await repo\.postedRefs\(record\.employeeId, \[ref\]\)\)\.has\(ref\)\)/);
    assert.match(approve, /if \(days > have\.days\) throw new UserFacingError/);
    // One record per opening line while not cancelled.
    assert.match(read('lib/db/migrations/0073_leave_salary.sql'), /CREATE UNIQUE INDEX IF NOT EXISTS "leave_salary_runs_source_line_key" ON "leave_salary_runs" \("source_line_id"\) WHERE "source_line_id" IS NOT NULL AND "cancelled_at" IS NULL;/);
    for (const src of [service, repo]) {
      assert.doesNotMatch(src, /\.update\(leaveLedger\)|\.delete\(leaveLedger\)/);
    }
  });

  it('paid only through the pay run: settled with the payslips, given back with them; nothing marks it paid by hand', () => {
    assert.match(fn(feeds, 'settleLeaveSalaryThroughRun'), /\.set\(\{ status: 'PAID', settledAt: new Date\(\), payrollRunId: runId, updatedAt: new Date\(\) \}\)\s*\.where\(and\(inArray\(leaveSalaryRuns\.id, ids\), eq\(leaveSalaryRuns\.status, 'APPROVED'\), isNull\(leaveSalaryRuns\.payrollRunId\)\)\)/);
    assert.match(feedService, /leaveSalary !== feeds\.leaveSalaryIds\.length\) throw new UserFacingError\(CLAIM_CHANGED\)/);
    const discard = feedService.slice(feedService.indexOf('export async function discardDraftRun'));
    assert.ok(discard.indexOf('releaseLeaveSalaryOfRun(runId, { tx })') < discard.indexOf('deletePayrollRun(runId, tx)'));
    assert.match(feedService, /releaseLeaveSalaryOfRun\(slip\.payrollRunId, \{ employeeId: slip\.employeeId, tx \}\)/);
    assert.doesNotMatch(repo + service + actions, /status: ["']PAID["']/);
    // The payslip pays it on LEAVE_ENCASH (taxable, once in the tax projection) and recalculation keeps it.
    const payroll = read('lib/services/payroll.service.ts');
    assert.match(payroll, /leaveSalaryIds: feedHeadRows\.leaveEncash \?/);
    assert.match(payroll, /if \(feedHeadRows\.leaveEncash && Number\(paidHere\.leaveEncash\) > 0\)/);
    assert.match(read('lib/constants/payroll-feeds.ts'), /ONE_OFF_TAXABLE_HEAD_CODES: readonly string\[\] = \[ARREARS_HEAD_CODE, REIMBURSE_TAXABLE_HEAD_CODE, LEAVE_ENCASH_HEAD_CODE\]/);
  });

  it('the bell counts drafts someone else prepared, never about the counting person\'s own record', () => {
    const count = fn(repo, 'countDraftsFor');
    assert.match(count, /ne\(leaveSalaryRuns\.createdBy, actor\.userId\)/);
    assert.match(count, /actor\.employeeId \? ne\(leaveSalaryRuns\.employeeId, actor\.employeeId\) : undefined/);
    assert.match(read('lib/services/notification.service.ts'), /leaveSalary: decides\('APPROVE', 'LEAVE_SALARY'\),/);
  });
});

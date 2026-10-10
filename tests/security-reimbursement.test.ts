import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// F16 reimbursements: claims are pay, so they get pay's guards — REIMBURSEMENTS permissions with
// the user's scope, never deciding or settling one's own claim (S21, audited DENIED_SELF), the
// employee in self-service always from the session, caps checked on the server, and payment only
// through the hardened payroll feeds (settled with the payslip, given back with it).

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/reimbursement.actions.ts');
const service = read('lib/services/reimbursement.service.ts');
const ess = read('lib/services/ess-extras.service.ts');
const essActions = read('app/actions/ess-extras.actions.ts');
const feedService = read('lib/services/payroll-feed.service.ts');
const payroll = read('lib/services/payroll.service.ts');
const fn = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, name);
  return src.slice(start, src.indexOf('\n}\n', start));
};

describe('F16 reimbursements', () => {
  it('every office action checks REIMBURSEMENTS with the scope; the step decides the permission', () => {
    assert.match(actions, /^'use server';/);
    assert.match(actions, /checkPermissionWithScope\(need, 'REIMBURSEMENTS'\)/);
    assert.match(actions, /const NEED: Record<string, Need> = \{ submitted: 'ADD', approved: 'APPROVE', rejected: 'APPROVE', draft: 'APPROVE', settled: 'LOCK' \};/);
    assert.match(fn(actions, 'saveReimbursementTypeAction'), /await ctx\('EDIT'\)/);
    assert.match(fn(actions, 'saveReimbursementClaimAction'), /await ctx\(id \? 'EDIT' : 'ADD'\)/);
    assert.match(read('app/(dashboard)/payroll/reimbursements/page.tsx'), /checkPermissionWithScope\("VIEW", "REIMBURSEMENTS"\)/);
  });

  it('claims are read and moved within the scope, never decided or settled by their owner', () => {
    const move = fn(service, 'moveClaim');
    assert.match(move, /repo\.findClaim\(id, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(move, /if \(to !== "submitted" && isOwnRecord\(ctx\.actorEmployeeId, existing\.employeeId\)\)/);
    assert.match(move, /result: DENIED_SELF/);
    assert.ok(move.indexOf('isOwnRecord(') < move.indexOf('repo.moveClaim('));
    // A claim is recorded only for an active employee within the scope.
    assert.match(fn(service, 'saveClaim'), /repo\.activeEmployeeInScope\(form\.employeeId, scope\)/);
    // Status moves are claim-first.
    assert.match(read('lib/repositories/reimbursement.repository.ts'), /\.where\(and\(eq\(reimbursementClaims\.id, id\), eq\(reimbursementClaims\.status, from\)\)\)/);
  });

  it('the yearly cap is checked on submit and again on approval; taxability is frozen from the type', () => {
    const save = fn(service, 'saveClaim');
    assert.match(save, /if \(opts\.submit\) \{\s*const problem = await yearlyCapProblem\(/);
    assert.match(save, /taxable: type!\.taxable,/);
    assert.match(fn(service, 'moveClaim'), /to === "submitted" \? IN_PLAY : COUNTED/);
  });

  it('self-service takes the employee from the session and submits in one write', () => {
    const submit = fn(ess, 'submitMyReimbursement');
    assert.match(submit, /const \{ employeeId, userId \} = await getSessionEmployeeId\(\);/);
    assert.match(submit, /\.\.\.\(raw && typeof raw === 'object' \? \(raw as Record<string, unknown>\) : \{\}\), employeeId \}/);
    assert.match(submit, /\{ submit: true \}/);
    assert.match(fn(essActions, 'submitMyReimbursementAction'), /ess\.submitMyReimbursement\(form\)/);
  });

  it('paid only through the payroll feeds: settled with the payslips, given back with them', () => {
    assert.match(feedService, /settleReimbursementsThroughRun\(\[\.\.\.feeds\.reimbursementIds\], runId, tx\)/);
    assert.match(feedService, /reimbursements !== feeds\.reimbursementIds\.length\) throw new UserFacingError\(CLAIM_CHANGED\)/);
    const discard = feedService.slice(feedService.indexOf('export async function discardDraftRun'));
    assert.ok(discard.indexOf('releaseReimbursementsOfRun(runId, { tx })') < discard.indexOf('deletePayrollRun(runId, tx)'));
    assert.match(feedService, /releaseReimbursementsOfRun\(slip\.payrollRunId, \{ employeeId: slip\.employeeId, tx \}\)/);
    // Only the claims a payslip line pays are settled; recalculation keeps the lines.
    assert.match(payroll, /feedHeadRows\.reimburse && Number\(r\.free\) > 0 \? r\.freeIds : \[\]/);
    assert.match(fn(payroll, 'recalculateEmployeePayslip'), /paidHere\.reimburseTaxable/);
  });

  it('the module is registered everywhere a permission module lives', () => {
    for (const [file, pattern] of [
      ['lib/db/schema.ts', /'REIMBURSEMENTS'/],
      ['lib/auth/check-permission.ts', /'REIMBURSEMENTS'/],
      ['lib/types/role.ts', /key: 'REIMBURSEMENTS'/],
      ['lib/services/audit.service.ts', /"REIMBURSEMENTS"/],
      ['lib/db/tenant-schema-sync.ts', /'REIMBURSEMENTS',\n  \];/],
      ['lib/db/migrations/0072_reimbursements.sql', /ALTER TYPE "public"\."module" ADD VALUE IF NOT EXISTS 'REIMBURSEMENTS'/],
    ] as const) {
      assert.match(read(file), pattern, file);
    }
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runWithinScope } from '../lib/engines/payroll-control.engine';

// S58 (found merging the 4.8 workspace with the branch's payroll work, 2026-10-10): eleven server
// actions of the payroll screens the workspace replaced stayed exported — public endpoints that
// moved a run's status without the approval flow, generated without pre-flight and changed any
// payslip with no scope check — and the workspace itself listed every run with every payslip to a
// branch- or department-scoped role and let it approve, lock, discard or regenerate runs that also
// paid other branches. A browser could also send a made-up overtime working with a payslip change.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const body = (src: string, start: string) => {
  const i = src.indexOf(start);
  assert.ok(i >= 0, start);
  const end = src.indexOf('\n}\n', i);
  return src.slice(i, end < 0 ? undefined : end);
};

describe('S58 payroll runs: only the workspace endpoints, and only runs the scope covers whole', () => {
  const actions = read('app/actions/payroll-run.actions.ts');
  const controlActions = read('app/actions/payroll-control.actions.ts');
  const service = read('lib/services/payroll-run.service.ts');
  const control = read('lib/services/payroll-control.service.ts');

  it('the pre-workspace payroll endpoints are gone', () => {
    assert.ok(!existsSync(join(root, 'app/actions/payroll.actions.ts')));
    for (const name of ['transitionPayrollRunAction', 'generatePayrollRunAction', 'updatePayrollSlipOverrideAction', 'deletePayrollRunAction', 'addPayHeadToPayslipAction', 'syncPayrollRunAttendanceAction']) {
      for (const file of ['app/actions/payroll-run.actions.ts', 'app/actions/payroll-control.actions.ts']) assert.doesNotMatch(read(file), new RegExp(`function ${name}\\b`), `${name} in ${file}`);
    }
  });

  it('every run action checks the run against the scope before acting (refusals audited DENIED_SCOPE)', () => {
    for (const name of ['checkRunAction', 'refreshVarianceAction', 'submitRunAction', 'decideRunAction', 'lockRunAction', 'discardRunAction', 'syncRunAttendanceAction', 'bankFileAction']) {
      const fn = body(actions, `export async function ${name}(`);
      const guard = fn.indexOf('await guarded(ctx, ');
      assert.ok(guard > 0, name);
      const act = Math.max(fn.indexOf('service.', guard), fn.indexOf('payroll.', guard));
      assert.ok(act > guard, `${name}: the guard comes first`);
    }
    // Payslip reads and changes go through the payslip's run.
    assert.match(body(actions, 'export async function slipDetailAction('), /await guardedSlip\(ctx, 'VIEW', String\(slipId\)\);/);
    for (const name of ['overrideSlipAction', 'addSlipHeadAction', 'recalculateSlipAction', 'removeSlipAction']) assert.match(body(actions, `export async function ${name}(`), /const slip = await service\.guardSlip\(/, name);
    assert.match(body(service, 'export async function guardSlip('), /const run = await guardRun\(slip\.payrollRunId, ctx\);/);
    assert.match(actions, /if \(error instanceof RunScopeError\) await recordAuditLog\(\{ userId: scope\.userId, action, module: MODULE, recordId, result: 'DENIED_SCOPE' \}\);/);
    // The service checks again (submit, decide, lock, discard).
    for (const name of ['submit', 'decide', 'lock', 'discard']) assert.match(body(service, `export async function ${name}(`), /const run = await guardRun\(runId, ctx\);/, name);
  });

  it('variance, publish, hold and release check the run too', () => {
    for (const name of ['getVarianceReviewAction', 'acknowledgeFlagsAction', 'publishRunAction', 'holdSlipAction', 'releaseSlipAction']) {
      const fn = body(controlActions, `export async function ${name}(`);
      const guard = fn.indexOf('await inScope(ctx, ');
      assert.ok(guard > 0, name);
      assert.ok(fn.indexOf('controls.', guard) > guard, `${name}: the guard comes first`);
    }
    assert.match(controlActions, /if \(error instanceof controls\.RunScopeError\) await recordAuditLog\(\{[^}]*result: 'DENIED_SCOPE' \}\);/);
    assert.match(body(control, 'export async function assertRunInScope('), /if \(!runWithinScope\(run, scope\)\) throw new RunScopeError\(\);/);
  });

  it('the page lists only runs the scope covers; a new run is for the scope only and never replaces another\'s draft', () => {
    assert.match(body(service, 'export async function pageData('), /const runs = allRuns\.filter\(\(r\) => runWithinScope\(r, ctx\.scope\)\);/);
    assert.match(body(service, 'function cleanInput('), /if \(!runWithinScope\(\{ branchIds, departmentIds \}, scope\)\)/);
    assert.match(body(service, 'export async function generate('), /if \(existing\.some\(\(r\) => !runWithinScope\(r, ctx\.scope\)\)\) throw new controlService\.RunScopeError\(\);/);
    // The bell offers the same runs (F17).
    assert.match(body(control, 'export async function runsWaitingFor('), /\.filter\(\(run\) => runWithinScope\(run, actor\.scope\)\)/);
  });

  it('the overtime working on a payslip comes from attendance, never from the browser', () => {
    assert.match(body(actions, 'export async function overrideSlipAction('), /overridePayslipAllowanceDeduction\(\{ \.\.\.payload, slipId: slip\.id, otDetail: undefined \}, ctx\.userId\)/);
  });

  it('the rule: the scope must cover everyone the run may pay', () => {
    const branch = { scopeType: 'BRANCH' as const, branchIds: ['b1', 'b2'], departmentIds: [] };
    assert.equal(runWithinScope({ branchIds: ['b1', 'b2'], departmentIds: [] }, branch), true);
    assert.equal(runWithinScope({ branchIds: ['b1', 'b3'], departmentIds: ['d1'] }, branch), false);
    assert.equal(runWithinScope({ branchIds: ['b1'], departmentIds: ['d1'] }, { scopeType: 'DEPARTMENT', branchIds: [], departmentIds: ['d1'] }), true);
  });
});

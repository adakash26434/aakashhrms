import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S21 for pay runs (4.8 / F1–F3): maker-checker is enforced inside the status
// move (not only in the UI), nobody edits or deletes their own payslip or
// acknowledges a flag about their own pay, status moves are claim-first, the
// portal shows only locked + published + not-held payslips, and every action
// resolves the tenant and checks a permission first.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const body = (src: string, marker: string) => {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, marker);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

const payroll = read('lib/services/payroll.service.ts');
const controls = read('lib/services/payroll-control.service.ts');
const actions = read('app/actions/payroll-control.actions.ts');
const portal = read('lib/services/self-service.service.ts');
const repo = read('lib/repositories/payroll.repository.ts');

describe('S21 payroll controls', () => {
  it('the status move runs the maker-checker check before the update, claim-first', () => {
    const fn = body(payroll, 'await assertCanMove(run, toStatus, actionByUserId)');
    assert.ok(payroll.indexOf('await assertCanMove(run, toStatus, actionByUserId)') < payroll.indexOf('repository.updatePayrollRunStatus(runId, toStatus, actionByUserId, notes, run.status)'));
    assert.ok(fn.length > 0);
    const upd = body(repo, 'export async function updatePayrollRunStatus');
    assert.match(upd, /eq\(payrollRuns\.status, fromStatus\)/);
    assert.match(upd, /throw/);
  });

  it('approve/lock refusals about the person are audited DENIED_SELF; approval also needs every flag acknowledged', () => {
    const fn = body(controls, 'export async function assertCanMove');
    assert.match(fn, /checkerRefusal\(/);
    assert.match(fn, /result: DENIED_SELF/);
    assert.match(fn, /review\.unresolved\.length/);
  });

  it('nobody edits or deletes their own payslip (all four slip-changing paths)', () => {
    const calls = payroll.match(/await assertNotOwnSlip\(/g) ?? [];
    assert.equal(calls.length, 4);
    const fn = body(controls, 'export async function assertNotOwnSlip');
    assert.match(fn, /DENIED_SELF/);
  });

  it('nobody acknowledges a flag about their own pay', () => {
    const fn = body(controls, 'export async function acknowledgeFlags');
    assert.match(fn, /actorEmployeeId && rows\.some\(\(r\) => r\.employeeId === ctx\.actorEmployeeId\)/);
    assert.match(fn, /DENIED_SELF/);
    assert.match(fn, /known\.has\(k\)/, 'only flags that exist on the run');
  });

  it('a locked run cannot change flags and publishing is claim-first', () => {
    assert.match(body(controls, 'export async function acknowledgeFlags'), /status === 'LOCKED'/);
    const pub = body(controls, 'export async function publishRun');
    assert.match(pub, /canPublishRun\(/);
    assert.match(pub, /already published/);
  });

  it('the portal shows only locked, published, not-held payslips (list and single)', () => {
    const vis = body(portal, 'function visibleToEmployee()');
    for (const part of ["'LOCKED'", 'isNotNull(payrollRuns.publishedAt)', 'isNull(payrollSlips.heldAt)']) assert.ok(vis.includes(part), part);
    // Every portal payslip read applies the rule: the list, the printable sheet (F11) and the tax certificate (F9).
    assert.match(body(portal, 'export async function getMyPayslips'), /\.\.\.visibleToEmployee\(\)/);
    assert.match(body(portal, 'export async function getMyPayslipSheet'), /ownSheet\(employeeId, payslipId, visibleToEmployee\(\)\)/);
    assert.match(body(portal, 'export async function getMyTaxCertificate'), /ownCertificate\(employeeId, fiscalYearId, visibleToEmployee\(\)\)/);
    assert.equal((portal.match(/visibleToEmployee\(\)/g) ?? []).length, 4, 'the definition and three reads — a new portal payslip read must use it too');
  });

  it('every action resolves the tenant and checks a permission', () => {
    const names = ['getVarianceReviewAction', 'acknowledgeFlagsAction', 'publishRunAction', 'holdSlipAction', 'releaseSlipAction', 'preflightAction', 'getPayrollControlSettingsAction', 'savePayrollControlSettingsAction'];
    for (const n of names) {
      const fn = body(actions, `export async function ${n}(`);
      assert.match(fn, /ensureTenantContext\(\)/, n);
      assert.match(fn, /checkPermission(WithScope)?\(|ctxFor\(/, n);
    }
    assert.match(body(actions, 'export async function savePayrollControlSettingsAction'), /'EDIT', 'SYSTEM_CONTROL'/);
    assert.match(body(actions, 'export async function publishRunAction'), /ctxFor\('LOCK'\)/);
    assert.match(body(actions, 'export async function acknowledgeFlagsAction'), /ctxFor\('APPROVE'\)/);
  });

  it('no use server in lib and no raw sql in the control service', () => {
    assert.ok(!/['"]use server['"]/.test(controls));
    assert.ok(!/sql\.raw/.test(controls + read('lib/repositories/payroll-control.repository.ts')));
  });
});

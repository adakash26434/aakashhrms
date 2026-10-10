import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { detailOutcome } from '../lib/engines/employee-detail.engine';

// S43 (4.8 / F13): an employee's bank account, PAN and tax status change only through a recorded
// change that a second person approves (unless the company turned approvals off, or a company
// administrator saved it in the default maker-checker mode); nobody approves a change to their
// own record; deciding is claim-first and re-checks the record; a payslip's bank account comes
// only from the record (never typed onto a payslip); audit lines carry field names, never values.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const empService = read('lib/services/employee.service.ts');
const service = read('lib/services/employee-detail.service.ts');
const repo = read('lib/repositories/employee-detail.repository.ts');
const empRepo = read('lib/repositories/employee.repository.ts');
const actions = read('app/actions/employee-detail.actions.ts');
const empActions = read('app/actions/employee.actions.ts');
const payroll = read('lib/services/payroll.service.ts');
const payrollTypes = read('lib/types/payroll.ts');
const controls = read('lib/services/payroll-control.service.ts');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = join(root, dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(relative(root, path)));
    else if (/\.(ts|tsx)$/.test(name)) out.push(relative(root, path));
  }
  return out;
}
const code = [...sources('lib'), ...sources('app'), ...sources('components')].filter((p) => !p.includes('/migrations/'));

describe('S43 sensitive employee details', () => {
  it('the employee save keeps bank, PAN and tax status unless the change plan says otherwise', () => {
    const save = empService.slice(empService.indexOf('export async function saveEmployee'), empService.indexOf('export interface EmployeeSeparationInput'));
    assert.match(save, /detailService\.planSave\(/);
    assert.match(save, /const keep = detailPlan\?\.values \?\? detailValues\(current\)/);
    for (const field of ['bankName', 'bankBranch', 'bankAccountNumber', 'panNumber', 'taxStatus', 'isDisabled']) {
      assert.match(save, new RegExp(`${field}: keep\\.${field}`), `${field} must come from the plan`);
    }
    // The change is recorded in the same transaction as the save.
    assert.match(save, /repository\.updateWithDetailChange\(/);
    assert.match(empRepo, /const detailChangeId = detail \? await insertChangeTx\(tx, detail\.change\) : null;/);
  });

  it('a change to your own record always waits for someone else, administrators and approvals-off included', () => {
    for (const approval of ['required', 'off'] as const) {
      for (const checker of ['admin_exempt', 'strict'] as const) {
        assert.equal(detailOutcome({ approval, checker, actorIsAdmin: true, ownRecord: true }).kind, 'pending');
      }
    }
    assert.match(service, /ownRecord: isOwnRecord\(ctx\.scope\.employeeId, employeeId\)/);
  });

  it('deciding goes through the approval engine with the strict maker-checker switch', () => {
    assert.match(service, /availableActions\(detailRequest\(row\), actor, detailDecisionCtx\(checker,/);
    assert.match(read('lib/engines/employee-detail.engine.ts'), /preparerMayFinalApprove: checker !== "strict"/);
    // Platform support never approves.
    assert.match(service, /const canApprove = ctx\.canApprove && !ctx\.scope\.isImpersonation;/);
    assert.match(service, /Support view can't decide/);
  });

  it('decisions are claim-first and re-check the record before writing it', () => {
    const claim = repo.slice(repo.indexOf('export async function claimTx'), repo.indexOf('export async function insertActionTx'));
    assert.match(claim, /eq\(employeeDetailChanges\.status, "pending"\)/);
    const decide = service.slice(service.indexOf('export async function decide'), service.indexOf('// ---- for the payroll variance review'));
    assert.ok(decide.indexOf('repo.claimTx') < decide.indexOf('staleFields('), 'claim before the stale check');
    assert.ok(decide.indexOf('staleFields(') < decide.indexOf('repo.writeValuesTx'), 'stale check before writing');
    assert.match(repo, /\.for\("update"\)/);
  });

  it('the decision action checks Employees → Approve / Edit with scope and audits refusals', () => {
    assert.match(actions, /checkPermissionWithScope\(action, 'EMPLOYEES'\)/);
    assert.match(actions, /const action = decision === 'withdraw' \? 'EDIT' : 'APPROVE';/);
    assert.match(actions, /DENIED_SELF/);
    assert.match(actions, /'DENIED_SCOPE'/);
    // Changes are read within the viewer's employee scope.
    assert.match(service, /repo\.findChanges\(\{ id, scope: buildEmployeeScopeCondition\(ctx\.scope\), limit: 1 \}\)/);
  });

  it('audit lines carry field names only, never the values', () => {
    for (const src of [actions, empActions]) {
      // changedEmployeeFields() turns the saved values into field names; anything else must not carry values.
      const audits = src
        .split('recordAuditLog(')
        .slice(1)
        .map((s) => s.slice(0, s.indexOf('});')).replace(/changedEmployeeFields\([\s\S]*?\}\)/g, 'changedEmployeeFields()'));
      assert.ok(audits.length >= 2);
      for (const a of audits) assert.doesNotMatch(a, /\.(before|after)\b|accountNumber|panNumber|taxStatus:/);
    }
  });

  it('only the employee save and an approved change write the bank account', () => {
    const writers = code.filter((p) => /\.(insert|update)\(employeeBank\)/.test(read(p)));
    assert.deepEqual(writers.sort(), ['lib/repositories/employee-detail.repository.ts', 'lib/repositories/employee.repository.ts']);
  });

  it('a payslip never takes a typed bank account; draft payslips follow the record', () => {
    assert.doesNotMatch(payrollTypes, /export interface PayrollSlipOverridePayload[^}]*bank/);
    const override = payroll.slice(payroll.indexOf('export async function overridePayslipAllowanceDeduction'));
    assert.match(override.slice(0, 1200), /'bankName' in payload \|\| 'bankAccountNumber' in payload/);
    const slipBankWriters = code.filter((p) => /update\(payrollSlips\)[\s\S]{0,200}bankAccountNumber/.test(read(p)));
    assert.deepEqual(slipBankWriters, ['lib/repositories/employee-detail.repository.ts']);
    assert.match(repo, /eq\(payrollRuns\.status, "DRAFT"\)/);
    // A run sent back to draft takes the accounts now on the records.
    assert.match(payroll, /if \(toStatus === 'DRAFT'\) \{\s*const refreshed = await refreshRunBankDetails\(runId\);/);
  });

  it('the variance review flags a changed account, comparing with the record only for runs not yet locked', () => {
    assert.match(controls, /const ids = run\.status === 'LOCKED' \? \[\] : slips\.map/);
    assert.match(controls, /recordBankAccount: accounts\.get\(s\.employeeId\)/);
  });
});

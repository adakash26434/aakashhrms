import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { availableActions } from '../lib/engines/approval.engine';

// S40 (4.8a): payroll runs — maker-checker, never your own payslip, scoped permissions, audit.
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

describe('S40 payroll run approval', () => {
  const service = read('lib/services/payroll-run.service.ts');
  const actions = read('app/actions/payroll-run.actions.ts');

  it('the preparer never approves a run, administrators included (strict mode of the approval engine)', () => {
    assert.match(service, /export async function decide[\s\S]*?availableActions\(request, actor, \{ approvers, today: nepalDateIso\(\), wording: WORDING, preparerMayFinalApprove: false \}\)/);
    // The engine refuses the preparer's Final approve in strict mode.
    const request = { status: 'pending' as const, preparedById: 'U1', subjectEmployeeIds: [], flow: { type: 'simple' as const, levels: [] }, currentLevel: 0 };
    const admin = { userId: 'U1', employeeId: 'E1', canApprove: true, isAdministrator: true };
    const strict = availableActions(request, admin, { approvers: [], today: '2026-10-20', preparerMayFinalApprove: false });
    assert.equal(strict.approve, null);
    assert.equal(strict.finalApprove, false);
    assert.equal(strict.reject, false);
    const other = availableActions(request, { ...admin, userId: 'U2' }, { approvers: [], today: '2026-10-20', preparerMayFinalApprove: false });
    assert.ok(other.approve);
  });

  it('"none" is never accepted as the pay-run approval policy', () => {
    assert.match(service, /export async function saveSettings[\s\S]*?requested === "none"[\s\S]*?Pay runs always need a second person/);
    assert.match(service, /export async function submit[\s\S]*?settings\.policy\.type === "none" \? \{ type: "simple", levels: \[\] \}/);
  });

  it('the preparer is the submitter (or the generator): the run is approved by someone else', () => {
    assert.match(service, /preparedById: run\.submittedBy \?\? run\.generatedBy/);
  });

  it('decisions are checked against the level they were made at (two approvers at once: the first wins)', () => {
    const repo = read('lib/repositories/payroll-run.repository.ts');
    assert.match(repo, /export async function decide[\s\S]*?eq\(payrollRuns\.status, "UNDER_REVIEW"\), eq\(payrollRuns\.currentLevel, params\.expectedLevel\)/);
    assert.match(repo, /export async function submit[\s\S]*?eq\(payrollRuns\.status, "DRAFT"\)/);
  });

  it('every run action checks a payroll permission on the server and audits the change', () => {
    for (const fn of ['generateRunAction', 'submitRunAction', 'decideRunAction', 'lockRunAction', 'acknowledgeVarianceAction', 'syncRunAttendanceAction', 'savePayrollRunSettingsAction']) {
      const body = actions.match(new RegExp(`export async function ${fn}[\\s\\S]*?\\n}\\n`))![0];
      assert.match(body, /checkPermissionWithScope\('(VIEW|ADD|EDIT|DELETE|LOCK|APPROVE)', '(PAYROLL_GENERATE|PAYROLL_REVIEW)'\)|ctxFor\('(VIEW|ADD|EDIT|DELETE|LOCK)'/, fn);
      assert.match(body, /recordAuditLog\(/, `${fn} audits`);
    }
    assert.match(actions, /export async function lockRunAction[\s\S]*?ctxFor\('LOCK', 'PAYROLL_REVIEW'\)/);
    assert.match(actions, /export async function decideRunAction[\s\S]*?ctxFor\('VIEW', 'PAYROLL_REVIEW'\)/);
  });

  it('settings are a company-wide administrator control, never platform support', () => {
    assert.match(actions, /export async function savePayrollRunSettingsAction[\s\S]*?scope\.scopeType !== 'GLOBAL'[\s\S]*?scope\.isImpersonation/);
  });

  it('errors go through toActionError; validation errors name their fields', () => {
    assert.match(actions, /return toActionError\(error, context\)/);
    assert.doesNotMatch(actions, /error\.message/);
  });
});

describe('S21 on payslips (4.8a): never your own', () => {
  const service = read('lib/services/payroll-run.service.ts');
  const actions = read('app/actions/payroll-run.actions.ts');

  it('editing, adding a head to, recalculating or removing a payslip goes through guardSlip, which refuses your own record', () => {
    assert.match(service, /export async function guardSlip[\s\S]*?isOwnRecord\(ctx\.scope\.employeeId, slip\.employeeId\)[\s\S]*?throw new OwnPayslipError/);
    for (const fn of ['overrideSlipAction', 'addSlipHeadAction', 'recalculateSlipAction', 'removeSlipAction']) {
      const body = actions.match(new RegExp(`export async function ${fn}[\\s\\S]*?\\n}\\n`))![0];
      assert.match(body, /service\.guardSlip\(/, fn);
      assert.match(body, /auditSelf\(error, scope/, `${fn} audits DENIED_SELF`);
    }
    assert.match(actions, /OwnPayslipError\) await recordAuditLog\(\{[^}]*result: DENIED_SELF/);
  });

  it('acknowledging the variance of your own payslip is refused', () => {
    assert.match(service, /export async function acknowledge[\s\S]*?isOwnRecord\(ctx\.scope\.employeeId, employeeId\)[\s\S]*?throw new OwnPayslipError/);
  });

  it('payslips change only while the run is a draft', () => {
    assert.match(service, /export async function guardSlip[\s\S]*?run\.status !== "DRAFT"[\s\S]*?throw new UserFacingError/);
  });

  it('the old role-slug exemption that let an administrator generate and lock alone is gone', () => {
    const payroll = read('lib/services/payroll.service.ts');
    assert.doesNotMatch(payroll, /isAdmin = actorRoles\.some/);
    assert.doesNotMatch(payroll, /throw new SeparationOfDutiesError\(\)/);
  });
});

describe('S41 pay calendar and year-to-date tax (4.8b)', () => {
  const service = read('lib/services/payroll.service.ts');
  const runService = read('lib/services/payroll-run.service.ts');
  const repo = read('lib/repositories/payroll.repository.ts');

  it('the year to date comes only from LOCKED payslips of the fiscal year', () => {
    assert.match(repo, /export async function findLockedSlipsForFiscalYear[\s\S]*?eq\(payrollRuns\.status, "LOCKED"\)/);
    assert.match(service, /async function taxInputsFor[\s\S]*?findLockedSlipsForFiscalYear\(employeeIds, fiscalYearId, excludeRunId\)/);
    assert.doesNotMatch(service, /historicalPayslips|isAshadh/);
  });

  it('the fiscal year of a run is the one containing the month, never "the first active one"', () => {
    assert.match(service, /export async function generatePayrollRun[\s\S]*?findFiscalYearForDate\(endStr\)/);
    assert.doesNotMatch(service, /eq\(fiscalYears\.status, 'Active'\)/);
  });

  it('the pay calendar changes only between months, through the company-wide settings action', () => {
    assert.match(runService, /export async function saveSettings[\s\S]*?canSwitchCalendar\(\{ openPeriods: await attendanceRepo\.countOpenPeriods\(current\.calendar\), unlockedRuns: await runRepo\.countUnlockedRuns\(\) \}\)/);
    const actions = read('app/actions/payroll-run.actions.ts');
    assert.match(actions, /export async function savePayrollRunSettingsAction[\s\S]*?scope\.scopeType !== 'GLOBAL'[\s\S]*?scope\.isImpersonation/);
  });

  it('a bonus run reads no attendance, posts no loans and writes nothing back to the salary map', () => {
    assert.match(service, /runType === "REGULAR" \? await attendanceForPayroll\(empIds, period\)/);
    assert.match(service, /const regular = run\.runType === "REGULAR";[\s\S]*?for \(const slip of regular \? slips : \[\]\)/);
    assert.match(service, /for \(const slip of regular \? slips : \[\]\) \{\s*const slipHeads = await tx\.select\(\)\.from\(payrollSlipHeads\)/);
  });

  it('employees see only locked payslips', () => {
    const self = read('lib/services/self-service.service.ts');
    assert.match(self, /export async function getMyPayslips[\s\S]*?eq\(payrollRuns\.status, 'LOCKED'\)/);
    assert.match(self, /export async function getMyPayslipDetail[\s\S]*?eq\(payrollRuns\.status, 'LOCKED'\)/);
  });
});

describe('S41 arrears (4.8b)', () => {
  const service = read('lib/services/arrears.service.ts');
  const runService = read('lib/services/payroll-run.service.ts');

  it('candidates come from the scope only, and the run recomputes them on the server (the screen figures are never trusted)', () => {
    assert.match(service, /export async function candidates\(scope: ScopeFilter[\s\S]*?buildEmployeeScopeCondition\(scope\)/);
    assert.match(service, /export async function generateArrearsRun[\s\S]*?const found = await candidates\(ctx\.scope/);
    assert.match(runService, /export async function checkNewRun\(raw: unknown, scope\?: ScopeFilter\)[\s\S]*?arrearsService\.candidates\(scope, input\)/);
    assert.match(read('app/actions/payroll-run.actions.ts'), /export async function checkNewRunAction[\s\S]*?service\.checkNewRun\(input, scope\)/);
  });

  it('a month already paid as arrears counts as paid (locked items only), and an employee-month waits in one run at a time', () => {
    const repo = read('lib/repositories/arrears.repository.ts');
    assert.match(repo, /export async function findLockedArrearsItems[\s\S]*?eq\(payrollRuns\.status, "LOCKED"\)/);
    assert.match(service, /findLockedArrearsItems\(\[slip\.employeeId\]\)[\s\S]*?sumComponents\(\[paidSlip, \.\.\.lockedItems\.map\(\(i\) => i\.diff\)\]\)/);
    assert.match(service, /const blocked = chosen\.find\(\(c\) => c\.blocked\);\s*if \(blocked\) throw new UserFacingError/);
  });

  it('a locked payslip is never changed: arrears are a new run of kind ARREARS', () => {
    assert.match(service, /runType: "ARREARS"/);
    assert.doesNotMatch(service, /update\(payrollSlips\)/);
  });

  it('back-dated revisions wait only for runs being prepared; locked months are paid as arrears', () => {
    const salary = read('lib/services/salary-structure.service.ts');
    assert.match(salary, /async function assertPayrollOpen[\s\S]*?repository\.findOpenRunUntil\(employeeIds\)/);
    assert.equal((salary.match(/await assertPayrollOpen\(/g) ?? []).length, 2);
    const repo = read('lib/repositories/salary-structure.repository.ts');
    assert.match(repo, /export async function findOpenRunUntil[\s\S]*?inArray\(payrollRuns\.status, \["DRAFT", "UNDER_REVIEW", "APPROVED"\]\), eq\(payrollRuns\.runType, "REGULAR"\)/);
  });

  it('reopening a month after payroll is locked keeps the reason and is audited as such', () => {
    const attendance = read('lib/services/attendance.service.ts');
    assert.match(attendance, /export async function reopenMonth[\s\S]*?const afterLock = \(await repo\.countFinalisedPayrollRuns\(period\.calendar, period\.year, period\.month\)\) > 0;/);
    assert.match(attendance, /export async function reopenMonth[\s\S]*?reason\.length < 3[\s\S]*?Give a reason for reopening/);
    assert.match(read('app/actions/attendance.actions.ts'), /event: result\.afterLock \? 'REOPEN_AFTER_LOCK' : 'REOPEN'/);
  });
});

describe('Merge with main (2026-10-10): the payroll feeds and the 4.8a fund deduction', () => {
  const service = read('lib/services/payroll.service.ts');

  it('one welfare-fund deduction per payslip: the WELFARE_FUND head only when the per-fund deduction is absent', () => {
    assert.match(service, /if \(fundFeed && feedHeadRows\.welfare && !\(fundsByEmployeeId\.get\(emp\.id\) \?\? \[\]\)\.length\)/);
  });

  it('TA-DA claims and fund feeds are read for regular runs only (a bonus run never settles claims it does not pay)', () => {
    assert.match(service, /const feedsApply = runType === "REGULAR";[\s\S]*?feedsApply \? feedsRepository\.approvedClaimsByEmployee\(empIds, endStr\)/);
  });
});

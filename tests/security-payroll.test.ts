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
    for (const fn of ['generateRunAction', 'submitRunAction', 'decideRunAction', 'lockRunAction', 'syncRunAttendanceAction', 'savePayrollRunSettingsAction']) {
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

  it('acknowledging a variance flag about your own pay is refused (the team\'s variance review)', () => {
    const control = read('lib/services/payroll-control.service.ts');
    assert.match(control, /export async function acknowledgeFlags[\s\S]*?rows\.some\(\(r\) => r\.employeeId === ctx\.actorEmployeeId\)[\s\S]*?DENIED_SELF/);
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

  it('income tax follows the team\'s projection (F5): earlier months counted in the run\'s calendar, the year-end on LOCKED payslips', () => {
    assert.match(service, /async function yearEndHistory[\s\S]*?eq\(payrollRuns\.status, 'LOCKED'\)/);
    assert.match(repo, /export async function findEarlierTaxMonths[\s\S]*?eq\(payrollRuns\.calendar, calendar\)/);
    assert.doesNotMatch(service, /taxInputsFor|ytdFromSlips/);
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

  it('only a regular run reads attendance, posts loans or writes back to the salary map; the workspace makes regular runs only', () => {
    assert.match(service, /runType === "REGULAR" \? await attendanceForPayroll\(empIds, period\)/);
    assert.match(service, /for \(const slip of regular \? slips : \[\]\) \{\s*const slipHeads = await tx\.select\(\)\.from\(payrollSlipHeads\)/);
    assert.match(runService, /function cleanInput[\s\S]*?const runType: RunType = "REGULAR";/);
  });

  it('employees see only payslips of locked, published runs that are not held (the team\'s F3)', () => {
    const self = read('lib/services/self-service.service.ts');
    assert.match(self, /function visibleToEmployee\(\) \{\s*return \[eq\(payrollRuns\.status, 'LOCKED'\), isNotNull\(payrollRuns\.publishedAt\), isNull\(payrollSlips\.heldAt\)\];/);
    assert.match(self, /export async function getMyPayslips[\s\S]*?\.\.\.visibleToEmployee\(\)/);
    assert.match(self, /export async function getMyPayslipDetail[\s\S]*?\.\.\.visibleToEmployee\(\)/);
  });
});

describe('Merge with the team\'s payroll controls (2026-10-10)', () => {
  const service = read('lib/services/payroll.service.ts');
  const runService = read('lib/services/payroll-run.service.ts');

  it('every status move passes the team\'s maker-checker, and the workspace submits only with every variance flag acknowledged', () => {
    assert.match(service, /await assertCanMove\(run, toStatus, actionByUserId\)/);
    assert.match(runService, /export async function submit[\s\S]*?const open = await varianceOpenCount\(runId\);\s*if \(open\) throw new UserFacingError/);
    assert.match(runService, /export async function varianceOpenCount[\s\S]*?controlService\.varianceReview\(runId\)\)\.unresolved\.length/);
  });

  it('one welfare-fund deduction per payslip (the team\'s WELFARE_FUND head); the engine has no second fund deduction', () => {
    assert.match(service, /if \(fundFeed && feedHeadRows\.welfare\) \{/);
    assert.doesNotMatch(read('lib/engines/payroll.engine.ts'), /fundDeduction/);
  });

  it('attendance after a lock stays closed: the team\'s arrears pay revisions only', () => {
    const attendance = read('lib/services/attendance.service.ts');
    assert.match(attendance, /export async function reopenMonth[\s\S]*?countFinalisedPayrollRuns\(period\.calendar, period\.year, period\.month\)\) > 0\) \{\s*throw new UserFacingError/);
  });

  it('overtime: the policy decides the minutes, the team\'s otPay and OT rules the rate', () => {
    const attendance = read('lib/services/attendance.service.ts');
    assert.match(attendance, /const ot = monthOvertime\(employeeId, days, entries, policy\);\s*const amount = salary \? otPay\(\{ basic: salary\.basic, workDayMinutes: ot\.paid\.work, offDayMinutes: ot\.paid\.off, multipliers \}\) : 0;/);
    assert.match(attendance, /otRuleRepository\.findActiveOtRules\(\)/);
  });
});

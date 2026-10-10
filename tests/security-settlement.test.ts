import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');

// 4.8b-3 Final settlement and the working period: the server decides everything.

describe('S42 final settlement (4.8b)', () => {
  const service = read('lib/services/settlement.service.ts');
  const payroll = read('lib/services/payroll.service.ts');
  const runService = read('lib/services/payroll-run.service.ts');

  it('settles only a closed exit case in the user\'s scope, never the user\'s own', () => {
    assert.match(service, /export async function preview[\s\S]*?exitRepo\.findCase\(exitCaseId, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(service, /if \(c\.status !== "closed"\) throw new UserFacingError/);
    assert.match(service, /if \(isOwnRecord\(ctx\.scope\.employeeId, c\.employeeId\)\) throw new OwnSettlementError\(\)/);
    assert.match(read('app/actions/payroll-run.actions.ts'), /error instanceof OwnSettlementError\) await recordAuditLog\([\s\S]*?result: DENIED_SELF/);
  });

  it('one settlement per case, worked out again on the server at generation (the preview is never trusted)', () => {
    assert.match(service, /const blocked = existing \? `Already settled/);
    assert.match(service, /export async function generateSettlementRun[\s\S]*?await preview\(input\.exitCaseId, input\.noticeRecovery, ctx\)[\s\S]*?if \(p\.blocked\) throw new UserFacingError\(p\.blocked\)/);
    assert.match(read('lib/repositories/settlement.repository.ts'), /export async function findRunByExitCase/);
    assert.match(runService, /if \(input\.runType === "FINAL_SETTLEMENT"\) \{\s*const run = await settlementService\.generateSettlementRun\(input, ctx\)/);
  });

  it('the payouts happen inside the lock transaction, and a locked month is not paid twice', () => {
    assert.match(payroll, /if \(toStatus === 'LOCKED'\) \{\s*await \(await getDb\(\)\)\.transaction\(async \(tx\) => \{[\s\S]*?if \(run\.runType === "FINAL_SETTLEMENT"\) \{[\s\S]*?await applyLock\(run, tx, actionByUserId\)/);
    assert.match(service, /export async function applyLock\(run: PayrollRun, tx: Tx, userId: string\)/);
    assert.match(service, /status: "CLOSED"/);
    assert.match(service, /kind: "payout"[\s\S]*?ref: `payout:settlement:\$\{slip\.id\}`/);
    assert.match(service, /kind: "paid_out", days: -e\.days/);
    assert.match(service, /encashmentType: "TERMINATION"[\s\S]*?status: "PAID"/);
    assert.match(service, /repo\.findLockedRegularSlip\(emp\.id, calendar, period\.year, period\.month\)/);
  });

  it('a bonus, arrears or settlement head never reaches the salary structure on lock', () => {
    assert.match(payroll, /for \(const slip of regular \? slips : \[\]\) \{\s*const slipHeads = await tx\.select\(\)\.from\(payrollSlipHeads\)/);
  });

  it('the settlement rules are company-wide settings saved through the same guarded action', () => {
    assert.match(runService, /export async function saveSettings[\s\S]*?validateSettlementSettings\(settlement\)[\s\S]*?settlementRepo\.setSettlementSettings\(settlement\)/);
  });
});

describe('E1 working period', () => {
  it('the cookie is validated against the company calendar on the server and never trusted raw', () => {
    const server = read('lib/utils/working-period.server.ts');
    assert.match(server, /parseWorkingPeriod\(raw, calendar\)/);
    assert.match(read('lib/services/payroll-run.service.ts'), /workingPeriod && workingPeriod\.calendar === calendar/);
    assert.match(read('app/(dashboard)/timeAndLeave/attendance/page.tsx'), /Number\(sp\.year\) \|\| working\?\.year/);
  });

  it('the pill sits in the title bar before the fiscal year, hidden for platform support', () => {
    const bar = read('components/frame/title-bar.tsx');
    const pill = bar.indexOf('<WorkingPeriodPill');
    const fy = bar.indexOf('href="/setup/company-setup?section=payroll_rules&tab=fiscal-year"');
    assert.ok(pill > 0 && pill < fy);
    assert.match(bar, /\{!context\?\.isImpersonating && <WorkingPeriodPill/);
  });
});

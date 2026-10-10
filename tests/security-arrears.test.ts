import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Arrears (F7): back pay is calculated by the server from finalised payslips and
// the revision in force, recorded once per (employee, source month, paying run),
// never trusted from the browser, and never deducted automatically.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const feeds = read('lib/repositories/payroll-feeds.repository.ts');
const service = read('lib/services/arrears.service.ts');
const payroll = read('lib/services/payroll.service.ts');
const structure = read('lib/services/salary-structure.service.ts');
const engine = read('lib/engines/arrears.engine.ts');

describe('arrears guards', () => {
  it('only approved / locked runs before the period are compared', () => {
    const fn = feeds.slice(feeds.indexOf('export async function paidMonths'));
    assert.match(fn, /inArray\(payrollRuns\.status, \['APPROVED', 'LOCKED'\]\)/);
    assert.match(fn, /payPeriodEndDate\} < \$\{beforeStart\}::date/);
  });

  it('a month is recorded once per paying run (idempotent insert)', () => {
    const fn = feeds.slice(feeds.indexOf('export async function settleArrears'));
    assert.match(fn, /onConflictDoNothing\(\)/);
  });

  it('only a positive net is paid or recorded; a reduction is never deducted', () => {
    assert.match(engine, /payable: netP > 0 \? netP \/ 100 : 0/);
    assert.match(engine, /return result\.payable > 0 \? result\.lines : \[\]/);
    assert.match(payroll, /arrearsFeed\.payable > 0/);
    assert.match(payroll, /a\.payable > 0/);
  });

  it('the amount comes from the server calculation, never from the request payload', () => {
    assert.match(payroll, /arrearsService\.arrearsFor\(empIds, startStr\)/);
    // No arrears amount field on the setup payload (F6's runType may name the ARREARS run type).
    const payloadType = (read('lib/types/payroll.ts').split('export interface PayrollRunSetupPayload')[1] ?? '').split('\n}')[0];
    assert.ok(!/^\s*\w*arrears\w*\??\s*:/im.test(payloadType), 'setup payload carries no arrears figure');
  });

  it('recorded after the run commits and tied to the run (a deleted draft gives it back)', () => {
    assert.ok(payroll.indexOf('const runRecord') < payroll.indexOf('arrearsService.settle('));
    assert.match(read('lib/db/migrations/0064_payroll_arrears.sql'), /"payroll_run_id" uuid NOT NULL REFERENCES "payroll_runs"\("id"\) ON DELETE CASCADE/);
  });

  it('the in-force lookup is per period end (approved revisions only)', () => {
    assert.match(service, /findInForceByEmployeeIds\(ids, end\)/);
  });

  it('back-dated revisions are no longer refused by the salary structure service', () => {
    assert.ok(!/assertPayrollOpen/.test(structure));
  });

  it('the schema mirror creates the table and the ARREARS head', () => {
    const sync = read('lib/db/tenant-schema-sync.ts');
    assert.match(sync, /CREATE TABLE IF NOT EXISTS "payroll_arrears"/);
    assert.match(sync, /payhead:ARREARS/);
  });
});

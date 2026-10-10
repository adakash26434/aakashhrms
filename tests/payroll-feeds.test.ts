import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 4.8 payroll feeds: approved TA-DA claims and welfare-fund contributions
// reach the payslip as one-off heads; claims are settled in the transaction
// that creates the payslips and released when a draft run is deleted; nothing
// here changes the engine's statutory maths.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const service = read('lib/services/payroll.service.ts');
const feeds = read('lib/repositories/payroll-feeds.repository.ts');
const feedService = read('lib/services/payroll-feed.service.ts');
const migration = read('lib/db/migrations/0059_payroll_feeds.sql');
const sync = read('lib/db/tenant-schema-sync.ts');

describe('payroll feeds', () => {
  it('system pay heads TADA (allowance, not taxable) and WELFARE_FUND (deduction) are seeded in both places', () => {
    for (const src of [migration, sync]) {
      assert.match(src, /'TADA', 'Travel \/ TA-DA reimbursement', 'allowance', false/);
      assert.match(src, /'WELFARE_FUND', 'Welfare fund contribution', 'deduction', false/);
    }
  });

  it('only approved, unpaid claims whose trip ended by the period end are picked up', () => {
    const start = feeds.indexOf('export async function approvedClaimsByEmployee(');
    const body = feeds.slice(start, feeds.indexOf('\n}\n', start));
    assert.match(body, /eq\(travelClaims\.status, 'approved'\)/);
    assert.match(body, /isNull\(travelClaims\.payrollRunId\)/);
    assert.match(body, /lte\(travelClaims\.endAd, periodEndAd\)/);
  });

  it('fund deductions use the exact monthly contribution ref per fund code', () => {
    assert.match(feeds, /'contrib:' \|\| \$\{fundTypes\.code\} \|\| \$\{suffix\}/);
    assert.match(feeds, /eq\(fundLedger\.kind, 'contribution'\)/);
  });

  it('feeds ride as manual-override heads; claims settle with the payslips; deleting a draft releases them', () => {
    assert.match(service, /toPayHeadObj\(feedHeadRows\.tada\), amount: claimFeed\.payable, isManualOverride: true/);
    assert.match(service, /toPayHeadObj\(feedHeadRows\.welfare\), amount: fundFeed, isManualOverride: true/);
    const slipsSaved = service.indexOf('await repository.createPayrollSlips(slipsWithHeads, tx);');
    const settle = service.indexOf('await payrollFeedService.settleRunFeedsTx(');
    const txEnd = service.indexOf('    return run;\n  });');
    assert.ok(slipsSaved > 0 && settle > slipsSaved && txEnd > settle, 'settled inside the transaction, after the payslips');
    const del = service.indexOf('export async function deletePayrollRun(');
    assert.match(service.slice(del, service.indexOf('\n}\n', del)), /await payrollFeedService\.discardDraftRun\(runId\);/);
    const discard = feedService.slice(feedService.indexOf('export async function discardDraftRun'));
    assert.ok(discard.indexOf('releaseClaimsOfRun(runId, { tx })') < discard.indexOf('deletePayrollRun(runId, tx)'));
    assert.match(feeds, /eq\(travelClaims\.status, 'approved'\), isNull\(travelClaims\.payrollRunId\)/);
  });
});

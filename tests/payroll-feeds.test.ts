import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 4.8 payroll feeds: approved TA-DA claims and welfare-fund contributions
// reach the payslip as one-off heads; claims are settled only after the run
// exists and released when a draft run is deleted; nothing here changes the
// engine's statutory maths.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const service = read('lib/services/payroll.service.ts');
const feeds = read('lib/repositories/payroll-feeds.repository.ts');
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

  it('feeds ride as manual-override heads; claims settle after the run commits; deleting a draft releases them', () => {
    assert.match(service, /toPayHeadObj\(feedHeadRows\.tada\), amount: claimFeed\.payable, isManualOverride: true/);
    assert.match(service, /toPayHeadObj\(feedHeadRows\.welfare\), amount: fundFeed, isManualOverride: true/);
    const txEnd = service.indexOf('    return run;\n  });');
    const settle = service.indexOf('feedsRepository.settleClaimsThroughRun(');
    assert.ok(txEnd > 0 && settle > txEnd, 'settle after the transaction');
    const del = service.indexOf('export async function deletePayrollRun(');
    const delBody = service.slice(del, service.indexOf('\n}\n', del));
    assert.ok(delBody.indexOf('releaseClaimsOfRun(runId)') < delBody.indexOf('repository.deletePayrollRun(runId)'));
    assert.match(feeds, /eq\(travelClaims\.status, 'approved'\), isNull\(travelClaims\.payrollRunId\)/);
  });
});

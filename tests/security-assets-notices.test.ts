import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S37 assets & notice board (G14): every action checks its module inside the
// tenant context; handovers go only to employees in the caller's scope; issue
// and return are claim-first so an asset never has two open handovers;
// notices are withdrawn, never deleted; Home reads only what the reader is
// addressed; the exit case cannot complete while assets are out.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const assetActions = read('app/actions/asset.actions.ts');
const assetService = read('lib/services/asset.service.ts');
const assetRepo = read('lib/repositories/asset.repository.ts');
const noticeActions = read('app/actions/notice.actions.ts');
const noticeService = read('lib/services/notice.service.ts');
const noticeRepo = read('lib/repositories/notice.repository.ts');
const exitService = read('lib/services/exit.service.ts');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S37 assets', () => {
  it('every action resolves the tenant and checks ASSETS', () => {
    for (const fn of assetActions.match(/export async function \w+/g) ?? []) {
      const b = body(assetActions, fn);
      assert.match(b, /ensureTenantContext\(\)/, fn);
      assert.match(b, /assetCtx\(/, fn);
    }
    assert.match(assetActions, /checkPermissionWithScope\(action, 'ASSETS'\)/);
    assert.match(body(assetActions, 'export async function issueAssetAction('), /assetCtx\('ADD'\)/);
    assert.match(body(assetActions, 'export async function returnAssetAction('), /assetCtx\('EDIT'\)/);
  });

  it('handovers go to an active employee in scope; returns respect scope', () => {
    const issue = body(assetService, 'export async function issueAsset(');
    assert.ok(issue.indexOf('employeeInScope(form.employeeId, buildEmployeeScopeCondition(ctx.scope), true)') < issue.indexOf('repo.issueTx('));
    assert.match(body(assetService, 'export async function returnAsset('), /employeeInScope\(open\.employeeId, buildEmployeeScopeCondition\(ctx\.scope\), false\)/);
  });

  it('issue and return are claim-first transactions; nothing deletes assets or handovers', () => {
    const issue = body(assetRepo, 'export async function issueTx(');
    assert.match(issue, /db\.transaction/);
    assert.match(issue, /eq\(assets\.status, 'available'\)/);
    assert.ok(issue.indexOf('returning') < issue.indexOf('insert(assetHandovers)'));
    const ret = body(assetRepo, 'export async function returnTx(');
    assert.match(ret, /isNull\(assetHandovers\.returnedAd\)/);
    assert.ok(!assetRepo.includes('.delete(assets)') && !assetRepo.includes('.delete(assetHandovers)'));
  });

  it('the exit case cannot complete while assets are out', () => {
    assert.match(body(exitService, 'export async function completeExitCase('), /assets\.map\(\(a\) => a\.tag\)/);
  });
});

describe('S37 notices', () => {
  it('every action resolves the tenant and checks NOTICE_BOARD at the right level', () => {
    for (const fn of noticeActions.match(/export async function \w+/g) ?? []) {
      const b = body(noticeActions, fn);
      assert.match(b, /ensureTenantContext\(\)/, fn);
      assert.match(b, /checkPermissionWithScope\([^)]*'NOTICE_BOARD'\)/, fn);
    }
    assert.match(body(noticeActions, 'export async function withdrawNoticeAction('), /'DELETE', 'NOTICE_BOARD'/);
  });

  it('notices are withdrawn, never deleted; withdrawn ones cannot be edited', () => {
    assert.ok(!noticeRepo.includes('.delete(notices)'));
    assert.match(body(noticeRepo, 'export async function updateNotice('), /eq\(notices\.status, 'published'\)/);
  });

  it('Home shows a reader only the audience they belong to', () => {
    assert.match(body(noticeService, 'export async function boardFor('), /audienceFor\(scope\)/);
    assert.match(body(noticeService, 'export async function boardFor('), /isVisible\(n, today, audience\)/);
    const audience = body(noticeService, 'async function audienceFor(');
    assert.match(audience, /scopeType === 'GLOBAL'\) return 'all'/);
    assert.match(audience, /branchOfEmployee\(scope\.employeeId\)/);
  });
});

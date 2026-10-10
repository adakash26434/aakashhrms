import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S42 targets & achievements (G15): source-level guards. The employee is always
// the session's; nobody sets, reviews or closes their own targets; every status
// step is claim-first; evidence is size-checked, content-sniffed and only
// opened by its owner, their supervisor or an in-scope office reader.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const service = read('lib/services/target.service.ts');
const repo = read('lib/repositories/target.repository.ts');
const office = read('app/actions/target.actions.ts');
const portal = read('app/actions/my-targets.actions.ts');
const upload = read('app/api/targets/evidence/route.ts');
const download = read('app/api/targets/evidence/[id]/route.ts');

const body = (src: string, fn: string) => {
  const start = src.indexOf(`export async function ${fn}(`);
  assert.ok(start >= 0, fn);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
};

describe('S42 office actions', () => {
  it('every action resolves the tenant and checks TARGETS with the right action', () => {
    const expect: Record<string, string> = {
      getTargetsPageAction: 'VIEW',
      createTargetsAction: 'ADD',
      updateTargetAction: 'EDIT',
      deleteTargetAction: 'EDIT',
      decideTargetAction: 'APPROVE',
    };
    for (const [fn, need] of Object.entries(expect)) {
      const b = body(office, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} tenant`);
      assert.match(b, new RegExp(`targetCtx\\('${need}'\\)`), `${fn} permission`);
    }
  });

  it('nobody sets, changes, removes or closes their own targets (audited DENIED_SELF)', () => {
    for (const fn of ['createTargets', 'updateTarget', 'deleteTarget', 'hrDecide']) {
      const b = body(service, fn);
      assert.match(b, /isOwnRecord\(ctx\.actorEmployeeId/, `${fn} own record`);
      assert.match(b, /DENIED_SELF/, `${fn} audit`);
    }
  });

  it('targets are scoped to the user, and setting them cannot reach outside it', () => {
    assert.match(body(service, 'createTargets'), /Someone chosen is not in your scope/);
    assert.match(body(service, 'updateTarget'), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    assert.match(body(service, 'hrDecide'), /buildEmployeeScopeCondition\(ctx\.scope\)/);
  });
});

describe('S42 portal actions', () => {
  it('the employee comes from the session, never a parameter', () => {
    assert.match(portal, /getSessionEmployeeId\(\)/);
    for (const fn of ['saveMyAchievementAction', 'submitMyTargetsAction', 'removeMyEvidenceAction', 'reviewTeamTargetAction']) {
      const b = body(portal, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} tenant`);
      assert.match(b, /await me\(\)/, `${fn} session employee`);
      assert.ok(!/employeeId: string|employeeId\b.*:\s*string/.test(b.split('{')[0]), `${fn} takes no employee id`);
    }
  });

  it("someone else's target reads as not found; the owner is re-checked in the update itself", () => {
    const own = service.slice(service.indexOf('async function ownTarget('), service.indexOf('/** The employee writes'));
    assert.match(own, /target\.employeeId !== me\.employeeId/);
    assert.match(body(service, 'saveMyAchievement'), /me\.employeeId\)/);
    assert.match(repo, /if \(owner\) conds\.push\(eq\(employeeTargets\.employeeId, owner\)\)/);
  });

  it('only the assigned supervisor reviews, never their own, and the figure is checked', () => {
    const b = body(service, 'supervisorDecide');
    assert.match(b, /target\.supervisorId !== me\.employeeId/);
    assert.match(b, /isOwnRecord\(me\.employeeId, target\.employeeId\)/);
    assert.match(b, /DENIED_SELF/);
    assert.match(b, /Number\.isFinite\(v\) \|\| v < 0/);
    assert.match(b, /repo\.claim\(id, \['submitted'\]/);
  });
});

describe('S42 status steps are claim-first', () => {
  it('each step names the statuses it may start from', () => {
    assert.match(body(service, 'hrDecide'), /repo\.claim\(id, \['forwarded'\]/);
    assert.match(body(service, 'saveMyAchievement'), /repo\.claim\(id, \['set', 'returned'\]/);
    assert.match(body(service, 'submitMyTargets'), /repo\.claim\(id, \['set', 'returned'\]/);
    assert.match(repo, /inArray\(employeeTargets\.status, from\)/);
  });

  it('a target is changed or removed only while nothing has been reported', () => {
    assert.match(repo, /eq\(employeeTargets\.status, 'set'\), isNull\(employeeTargets\.achievedValue\)/);
  });

  it('a resubmission clears the earlier verification', () => {
    assert.match(body(service, 'submitMyTargets'), /verifiedValue: null/);
  });
});

describe('S42 evidence files', () => {
  it('upload: same origin and declared size first, then the session employee, then the content', () => {
    const order = [upload.indexOf('isSameOriginRequest(request'), upload.indexOf("headers.get('content-length')"), upload.indexOf('await getSessionEmployeeId()'), upload.indexOf('await uploadEvidence(')];
    assert.ok(order.every((i) => i >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    const b = body(service, 'uploadEvidence');
    assert.match(b, /sniffFileType\(input\.bytes\)/);
    assert.match(b, /DOCUMENT_MAX_BYTES/);
    assert.match(b, /countStagedBy/);
  });

  it('download: sent as an attachment with nosniff, never cached, only to those who may open it', () => {
    assert.match(download, /attachment; filename=/);
    assert.match(download, /nosniff/);
    assert.match(download, /no-store/);
    const open = body(service, 'openEvidence');
    assert.match(open, /target\.employeeId === viewer\.employeeId \|\| target\.supervisorId === viewer\.employeeId/);
    assert.match(open, /employeeInScope\(target\.employeeId, buildEmployeeScopeCondition\(viewer\.scope\)\)/);
    assert.match(open, /file\.uploadedBy === viewer\.userId/);
  });

  it('the file content is selected only by findAttachmentContent', () => {
    const hits = repo.split('targetAttachments.content').length - 1;
    assert.equal(hits, 1, 'findAttachmentContent only');
    assert.ok(!/targetAttachments\.content/.test(service));
  });
});

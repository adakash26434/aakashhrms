import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DENIED_SELF, includesOwnRecord, isOwnRecord } from '../lib/auth/self-action';
import { isOwnRequest } from '../lib/engines/leave.engine';

// Security plan S21 (standing rule): nobody acts on their own pay-relevant
// record. Modules adopt the shared check as they are redesigned.

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('S21: own record', () => {
  it('matches only a linked employee; an unlinked account matches nobody', () => {
    assert.equal(isOwnRecord('e1', 'e1'), true);
    assert.equal(isOwnRecord('e1', 'e2'), false);
    assert.equal(isOwnRecord(null, 'e1'), false);
    assert.equal(isOwnRecord('', ''), false);
    assert.equal(includesOwnRecord('e1', ['e2', 'e1']), true);
    assert.equal(includesOwnRecord(null, ['e1']), false);
    assert.equal(DENIED_SELF, 'DENIED_SELF');
  });

  it('leave approvals use the shared check', () => {
    assert.equal(isOwnRequest('e1', 'e1'), true);
    assert.equal(isOwnRequest(null, 'e1'), false);
    assert.match(read('lib/engines/leave.engine.ts'), /return isOwnRecord\(/);
  });

  it('approvals use it on submit (flow, skipped levels) and on every decision', () => {
    const engine = read('lib/engines/approval.engine.ts');
    assert.match(engine, /includesOwnRecord\(ctx\.preparerEmployeeId, ctx\.subjectEmployeeIds\)/);
    assert.match(engine, /includesOwnRecord\(approver\?\.employeeId \?\? null, ctx\.subjectEmployeeIds\)/);
    assert.match(engine, /includesOwnRecord\(actor\.employeeId, request\.subjectEmployeeIds\)/);
  });

  it('a platform support login has no employee and is flagged, so it never counts as a company administrator', () => {
    assert.match(read('lib/auth/check-permission.ts'), /employeeId: null, userId: impersonation\.actorId, isImpersonation: true/);
  });
});

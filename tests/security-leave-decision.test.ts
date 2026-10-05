import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canTransitionLeave, cleanRemarks, employeeInScope, isLeaveStatus, isOwnRequest } from '../lib/engines/leave.engine';

// S17: leave decisions — scope, self-approval, transitions, race, audit.
const root = join(__dirname, '..');
const source = (file: string) => readFileSync(join(root, file), 'utf8');

const emp = { id: 'e1', branchId: 'b1', departmentId: 'd1' };

describe('S17 leave decisions', () => {
  it('scope check matches the SQL scope filter and fails closed', () => {
    assert.equal(employeeInScope({ scopeType: 'GLOBAL', branchIds: [], departmentIds: [], employeeId: null }, emp), true);
    assert.equal(employeeInScope({ scopeType: 'BRANCH', branchIds: ['b1'], departmentIds: [], employeeId: null }, emp), true);
    assert.equal(employeeInScope({ scopeType: 'BRANCH', branchIds: ['b2'], departmentIds: [], employeeId: null }, emp), false);
    assert.equal(employeeInScope({ scopeType: 'BRANCH', branchIds: [], departmentIds: [], employeeId: null }, emp), false);
    assert.equal(employeeInScope({ scopeType: 'DEPARTMENT', branchIds: [], departmentIds: ['d1'], employeeId: null }, emp), true);
    assert.equal(employeeInScope({ scopeType: 'DEPARTMENT', branchIds: [], departmentIds: ['d9'], employeeId: null }, emp), false);
    assert.equal(employeeInScope({ scopeType: 'SELF', branchIds: [], departmentIds: [], employeeId: 'e1' }, emp), true);
    assert.equal(employeeInScope({ scopeType: 'SELF', branchIds: [], departmentIds: [], employeeId: null }, emp), false);
    assert.equal(employeeInScope({ scopeType: 'WHATEVER' as never, branchIds: ['b1'], departmentIds: ['d1'], employeeId: 'e1' }, emp), false);
    assert.equal(employeeInScope({ scopeType: 'BRANCH', branchIds: ['b1'], departmentIds: [], employeeId: null }, { ...emp, branchId: null }), false);
  });

  it('blocks deciding your own request', () => {
    assert.equal(isOwnRequest('e1', 'e1'), true);
    assert.equal(isOwnRequest('e2', 'e1'), false);
    assert.equal(isOwnRequest(null, 'e1'), false);
  });

  it('allows only forward transitions; nothing returns to Pending or re-decides a rejection', () => {
    assert.equal(canTransitionLeave('Pending', 'Approved'), true);
    assert.equal(canTransitionLeave('Pending', 'Rejected'), true);
    assert.equal(canTransitionLeave('Approved', 'Cancelled'), true);
    assert.equal(canTransitionLeave('Approved', 'Approved'), false);
    assert.equal(canTransitionLeave('Rejected', 'Approved'), false);
    assert.equal(canTransitionLeave('Cancelled', 'Approved'), false);
    assert.equal(canTransitionLeave('Approved', 'Pending'), false);
    assert.equal(isLeaveStatus('Approved'), true);
    assert.equal(isLeaveStatus('APPROVED'), false);
  });

  it('cleans and caps remarks', () => {
    assert.equal(cleanRemarks('  ok  '), 'ok');
    assert.equal(cleanRemarks('   '), null);
    assert.equal(cleanRemarks(42), null);
    assert.equal(cleanRemarks('x'.repeat(900))!.length, 500);
  });

  // 4.6: decisions moved to the leave service and the approval engine; the
  // source checks live in tests/security-leave.test.ts (S24).
  it('the decision action checks scope, blocks support view and audits each request', () => {
    const action = source('app/actions/leave.actions.ts');
    const body = action.slice(action.indexOf('export async function decideLeaveRequestsAction'), action.indexOf('export async function adjustLeaveBalanceAction'));
    assert.match(body, /viewScope\(\)/);
    assert.match(body, /hasPermission\('APPROVE', 'LEAVE_APPROVALS'\)/);
    assert.match(body, /getImpersonationSession\(\)/);
    assert.match(body, /UUID\.test\(id\)/);
    assert.match(body, /result: 'SUCCESS'/);
    assert.match(body, /auditRefusal\(error, scope/);
    // The decider is the signed-in user, never a client-supplied argument.
    assert.match(body, /userId: scope\.userId/);
  });

  it('the status change is conditional on the previous status, in one transaction with the ledger', () => {
    const repo = source('lib/repositories/leave.repository.ts');
    const fn = repo.slice(repo.indexOf('export async function decideRequest'));
    assert.match(fn, /\.transaction\(/);
    assert.match(fn, /eq\(leaveApplications\.status, p\.expectedStatus\)/);
    assert.match(fn, /postLedgerLines\(p\.ledger, tx\)/);
  });

  it('leave lists are scoped on the page and in the service', () => {
    assert.match(source('app/(dashboard)/timeAndLeave/leaves/page.tsx'), /checkPermissionWithScope\("VIEW", "LEAVE_APPLICATIONS"\)/);
    assert.match(source('lib/services/leave.service.ts'), /attendanceRepo\.findEmployees\(buildEmployeeScopeCondition\(scope\)\)/);
  });

});

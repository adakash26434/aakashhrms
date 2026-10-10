import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canPlaceInScope, changedEmployeeFields, missingRecords } from '../lib/engines/employee.engine';
import { maskAccountNumber } from '../lib/utils/mask';
import { isUuid } from '../lib/utils/uuid';

// S18: employee records are scoped, audited by field name, and masked.
const root = join(__dirname, '..');
const source = (file: string) => readFileSync(join(root, file), 'utf8');

const scope = (scopeType: string, branchIds: string[] = [], departmentIds: string[] = []) =>
  ({ scopeType, branchIds, departmentIds }) as Parameters<typeof canPlaceInScope>[0];

describe('S18 employee records', () => {
  it('places employees only inside the user scope, failing closed', () => {
    const place = { branchId: 'b1', departmentId: 'd1' };
    assert.equal(canPlaceInScope(scope('GLOBAL'), place), true);
    assert.equal(canPlaceInScope(scope('BRANCH', ['b1']), place), true);
    assert.equal(canPlaceInScope(scope('BRANCH', ['b2']), place), false);
    assert.equal(canPlaceInScope(scope('BRANCH', []), place), false);
    assert.equal(canPlaceInScope(scope('BRANCH', ['b1']), { branchId: '', departmentId: 'd1' }), false);
    assert.equal(canPlaceInScope(scope('DEPARTMENT', [], ['d1']), place), true);
    assert.equal(canPlaceInScope(scope('DEPARTMENT', [], ['d9']), place), false);
    assert.equal(canPlaceInScope(scope('SELF'), place), false);
    assert.equal(canPlaceInScope(scope('WHATEVER', ['b1'], ['d1']), place), false);
  });

  it('audits changed field names only, never their values', () => {
    const before = {
      fullName: 'Ram Sharma',
      panNumber: '601234567',
      bankAccountNumber: '0123456789014821',
      basicSalary: 30000,
      joiningDate: new Date('2022-07-17T00:00:00.000Z'),
      isSupervisor: false,
    };
    const after = {
      fullName: 'Ram Sharma',
      panNumber: '609999999',
      bankAccountNumber: '0123456789014821',
      basicSalary: 32000,
      joiningDate: '2022-07-17',
      isSupervisor: false,
    };
    const changed = changedEmployeeFields(before, after);
    assert.deepEqual(changed.sort(), ['basicSalary', 'panNumber']);
    const payload = JSON.stringify({ changedFields: changed });
    assert.ok(!payload.includes('609999999') && !payload.includes('32000'));
  });

  it('masks bank accounts to the last four digits', () => {
    assert.equal(maskAccountNumber('0123456789014821'), '••••4821');
    assert.equal(maskAccountNumber(' 0123 4567 8901 4821 '), '••••4821');
    assert.equal(maskAccountNumber('123'), '••••');
    assert.equal(maskAccountNumber(''), '');
    assert.equal(maskAccountNumber(null), '');
  });

  it('rejects malformed record ids before any query', () => {
    assert.equal(isUuid('3f1c2b8e-1d2a-4c3b-9f8e-7a6b5c4d3e2f'), true);
    assert.equal(isUuid("1' OR '1'='1"), false);
    assert.equal(isUuid(42), false);
  });

  it('flags records that stop payroll (PAN, bank, basic salary)', () => {
    assert.deepEqual(missingRecords({ panNumber: '601234567', bankAccountNumber: '1', basicSalary: 1 }), []);
    assert.deepEqual(missingRecords({ panNumber: '12', bankAccountNumber: ' ', basicSalary: 0 }), ['pan', 'bank', 'basic']);
  });

  it('every employee action resolves scope and loads records through the scoped loader', () => {
    const actions = source('app/actions/employee.actions.ts');
    assert.ok(!/checkPermission\(/.test(actions), 'unscoped checkPermission() must not be used');
    assert.ok(!/getEmployeeById\(/.test(actions), 'unscoped getEmployeeById() must not be used');
    for (const fn of ['saveEmployeeAction', 'setEmployeeStatusAction', 'getEmployeeByIdAction', 'getEmployeeAccessAction', 'resendEmployeeCredentialsAction', 'resetEmployeePasswordAction']) {
      const start = actions.indexOf(`export async function ${fn}(`);
      assert.ok(start >= 0, fn);
      const body = actions.slice(start, actions.indexOf('\nexport ', start + 1) === -1 ? undefined : actions.indexOf('\nexport ', start + 1));
      assert.match(body, /checkPermissionWithScope\(/, `${fn} resolves scope`);
    }
    assert.match(actions, /canPlaceInScope\(scope/);
    assert.match(actions, /result: 'DENIED_SCOPE'/);
    assert.match(actions, /changedFields: changedEmployeeFields\(/);
    assert.match(actions, /toActionError\(error, 'employee\.save'\)/);
  });

  it('the scoped loader audits out-of-scope reads and the edit page uses it', () => {
    const service = source('lib/services/employee.service.ts');
    const loader = service.slice(service.indexOf('export async function getEmployeeInScope('));
    assert.match(loader, /isUuid\(id\)/);
    assert.match(loader, /employeeInScope\(scope, employee\)/);
    assert.match(loader, /result: "DENIED_SCOPE"/);
    assert.match(source('app/(dashboard)/workforce/employees/[id]/edit/page.tsx'), /getEmployeeInScope\(id, scope/);
  });

  it('list search escapes LIKE wildcards', () => {
    const repo = source('lib/repositories/employee.repository.ts');
    const findAll = repo.slice(repo.indexOf('export async function findAll('), repo.indexOf('export async function findById('));
    assert.match(findAll, /likeTerm\(filter\.search/);
  });

  it('employees can never be deleted; leaving is a status change that switches the login off', () => {
    const actions = source('app/actions/employee.actions.ts');
    const service = source('lib/services/employee.service.ts');
    const repo = source('lib/repositories/employee.repository.ts');
    assert.ok(!/deleteEmployee/.test(actions) && !/export async function deleteEmployee/.test(service), 'no delete action or service');
    assert.ok(!/tx\.delete\(employees\)/.test(repo), 'the repository never deletes employee rows');
    const setStatus = repo.slice(repo.indexOf('export async function setStatus('));
    // Leaving switches every linked login off; rejoining turns only a self-service login back on (S59).
    assert.match(setStatus, /if \(status === 'Inactive'\) \{\s*await tx\.update\(users\)\.set\(\{ isActive: false/);
    assert.match(setStatus, /r\.slug in \('employee', 'standard_staff'\)/);
    const status = actions.slice(actions.indexOf('export async function setEmployeeStatusAction('));
    assert.match(status, /checkPermissionWithScope\('EDIT', 'EMPLOYEES'\)/);
    assert.match(status, /getEmployeeInScope\(id, scope, 'EDIT'\)/);
    assert.match(status, /DENIED_SELF/);
    assert.match(status, /recordAuditLog\(/);
  });

  it('the edit form cannot change status (only the status action can)', () => {
    const service = source('lib/services/employee.service.ts');
    const save = service.slice(service.indexOf('export async function saveEmployee('));
    assert.match(save, /formData = \{ \.\.\.formData, status: current\.status \}/);
    assert.match(save, /formData = \{ \.\.\.formData, status: "Active" \}/);
  });
});


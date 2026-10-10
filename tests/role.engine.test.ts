import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRANTABLE,
  SELF_SERVICE_BASICS,
  grantDiff,
  grantLabel,
  grantSummary,
  isAdminRole,
  normalizeGrants,
  normalizeRoleForm,
  presetGrants,
  roleKind,
  roleSlugFor,
  sortGrants,
  validateRoleForm,
} from '../lib/engines/role.engine';
import { accessListsFor, generateTemporaryPassword, normalizeLoginForm, validateLoginForm, validatePasswordStrength, emailChangeProblem } from '../lib/engines/user.engine';
import { MODULE_CATEGORIES } from '../lib/types/role';
import { randomInt } from 'node:crypto';

// 4.13: roles, the permission matrix and the login window.

describe('the permission matrix', () => {
  it('offers exactly the actions each module lists', () => {
    const expected = MODULE_CATEGORIES.flatMap((c) => c.modules.flatMap((m) => m.allowedActions.map((a) => `${a}:${m.key}`)));
    assert.equal(GRANTABLE.size, expected.length);
    assert.ok(GRANTABLE.has('APPROVE:PAYROLL_REVIEW'));
    assert.ok(!GRANTABLE.has('LOCK:HOLIDAYS'));
    assert.ok(!GRANTABLE.has('VIEW:LEAVE_RULES'));
  });

  it('keeps only offered permissions, adds View with any other action, and sorts in matrix order', () => {
    assert.deepEqual(normalizeGrants(['APPROVE:LOANS', 'LOCK:HOLIDAYS', 'nonsense', 42, 'EDIT:EMPLOYEES', 'APPROVE:LOANS']), ['VIEW:EMPLOYEES', 'EDIT:EMPLOYEES', 'VIEW:LOANS', 'APPROVE:LOANS']);
    assert.deepEqual(normalizeGrants('VIEW:LOANS'), []);
    assert.deepEqual(sortGrants(['LOCK:FISCAL_YEAR', 'VIEW:SYSTEM_CONTROL', 'VIEW:FISCAL_YEAR']), ['VIEW:SYSTEM_CONTROL', 'VIEW:FISCAL_YEAR', 'LOCK:FISCAL_YEAR']);
  });

  it('says what a change adds and removes, and sums a role up', () => {
    assert.deepEqual(grantDiff(['VIEW:LOANS', 'ADD:LOANS'], ['VIEW:LOANS', 'APPROVE:LOANS']), { added: ['APPROVE:LOANS'], removed: ['ADD:LOANS'] });
    assert.equal(grantSummary([]), 'No permissions');
    assert.equal(grantSummary(['VIEW:LOANS']), '1 permission in 1 module');
    assert.equal(grantSummary(['VIEW:LOANS', 'ADD:LOANS', 'VIEW:EMPLOYEES']), '3 permissions in 2 modules');
    assert.equal(grantLabel('APPROVE:LOANS'), 'Loans & Advances → Approve');
    assert.equal(grantLabel('VIEW:LEAVE_RULES'), 'Leave rules (retired) → View');
  });

  it('presets start a new role; read-only views every module', () => {
    const readOnly = presetGrants('read_only') ?? [];
    assert.ok(readOnly.length > 30 && readOnly.every((k) => k.startsWith('VIEW:')));
    assert.ok((presetGrants('self_service') ?? []).every((k) => SELF_SERVICE_BASICS.has(k)));
    assert.equal(presetGrants('nope'), null);
  });

  it('knows the administrator roles and the kinds of role', () => {
    assert.equal(isAdminRole('office_admin'), true);
    assert.equal(isAdminRole('system_admin'), true);
    assert.equal(isAdminRole('hr_admin'), false);
    assert.equal(roleKind({ slug: 'office_admin', isSystemRole: true, isProtected: true }), 'administrator');
    assert.equal(roleKind({ slug: 'hr_manager', isSystemRole: true, isProtected: false }), 'built-in');
    assert.equal(roleKind({ slug: 'branch_hr', isSystemRole: false, isProtected: false }), 'custom');
  });
});

describe('the role window', () => {
  it('cleans and checks a role', () => {
    const form = normalizeRoleForm({ name: '  Branch   HR ', description: ' x ', scopeType: 'BRANCH', extra: 1 });
    assert.deepEqual(form, { name: 'Branch HR', description: 'x', scopeType: 'BRANCH' });
    assert.equal(validateRoleForm(form, ['HR Manager']), null);
    assert.equal(validateRoleForm(form, ['branch hr'])?.name, 'Another role already has this name.');
    const bad = normalizeRoleForm({ name: '', scopeType: 'EVERYWHERE' });
    assert.deepEqual(Object.keys(validateRoleForm(bad, []) ?? {}).sort(), ['name', 'scopeType']);
  });

  it('makes a unique slug', () => {
    assert.equal(roleSlugFor('Branch HR & Admin!', new Set()), 'branch_hr_admin');
    assert.equal(roleSlugFor('Branch HR', new Set(['branch_hr', 'branch_hr_2'])), 'branch_hr_3');
    assert.equal(roleSlugFor('!!!', new Set()), 'role');
  });
});

describe('the login window', () => {
  const ctx = { scopeType: 'BRANCH' as const, branchIds: new Set(['11111111-1111-4111-8111-111111111111']), departmentIds: new Set<string>(), employee: null };

  it('reads only the fields it knows, typed', () => {
    const f = normalizeLoginForm({ name: ' Gita  Rai ', email: ' Gita@Example.COM ', roleId: 'not-a-uuid', employeeId: '', branchIds: ['11111111-1111-4111-8111-111111111111', 'x', '11111111-1111-4111-8111-111111111111'], isAdmin: true });
    assert.deepEqual(f, { name: 'Gita Rai', email: 'gita@example.com', roleId: '', employeeId: null, branchIds: ['11111111-1111-4111-8111-111111111111'], departmentIds: [] });
  });

  it('needs a name, an email, a role and the branches or departments the role covers', () => {
    const empty = normalizeLoginForm({});
    assert.deepEqual(Object.keys(validateLoginForm(empty, { ...ctx, scopeType: null }) ?? {}).sort(), ['email', 'name', 'roleId']);
    const f = normalizeLoginForm({ name: 'Gita', email: 'g@x.co', roleId: '22222222-2222-4222-8222-222222222222' });
    assert.equal(validateLoginForm(f, ctx)?.branchIds, 'Choose the branches this login covers.');
    assert.equal(validateLoginForm({ ...f, branchIds: ['33333333-3333-4333-8333-333333333333'] }, ctx)?.branchIds, 'One of the branches no longer exists.');
    assert.equal(validateLoginForm({ ...f, branchIds: [...ctx.branchIds] }, ctx), null);
    assert.equal(validateLoginForm(f, { ...ctx, scopeType: 'DEPARTMENT' })?.departmentIds, 'Choose the departments this login covers.');
  });

  it('a self-service login needs its employee; a link problem is the server\'s word', () => {
    const f = normalizeLoginForm({ name: 'Gita', email: 'g@x.co', roleId: '22222222-2222-4222-8222-222222222222' });
    assert.match(validateLoginForm(f, { ...ctx, scopeType: 'SELF' })?.employeeId ?? '', /needs the employee/);
    assert.equal(validateLoginForm(f, { ...ctx, scopeType: 'GLOBAL', employee: 'Already linked to another login.' })?.employeeId, 'Already linked to another login.');
  });

  it('keeps only the list the role reads', () => {
    const lists = { branchIds: ['b'], departmentIds: ['d'] };
    assert.deepEqual(accessListsFor('GLOBAL', lists), { branchIds: [], departmentIds: [] });
    assert.deepEqual(accessListsFor('BRANCH', lists), { branchIds: ['b'], departmentIds: [] });
    assert.deepEqual(accessListsFor('DEPARTMENT', lists), { branchIds: [], departmentIds: ['d'] });
    assert.deepEqual(accessListsFor('SELF', lists), { branchIds: [], departmentIds: [] });
  });

  it('an administrator\'s email belongs to the platform', () => {
    assert.match(emailChangeProblem({ email: 'a@x.co', isAdministrator: true }, 'b@x.co') ?? '', /support/);
    assert.equal(emailChangeProblem({ email: 'a@x.co', isAdministrator: true }, 'A@X.co'), null);
    assert.equal(emailChangeProblem({ email: 'a@x.co', isAdministrator: false }, 'b@x.co'), null);
  });
});

describe('S59 temporary passwords', () => {
  it('meet the strength rules and come from the cryptographic generator', () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTemporaryPassword(randomInt);
      assert.equal(p.length, 14);
      assert.ok(validatePasswordStrength(p), p);
      assert.doesNotMatch(p, /[0O1lI]/);
    }
    const seen = new Set(Array.from({ length: 500 }, () => generateTemporaryPassword(randomInt)));
    assert.equal(seen.size, 500);
  });

  it('use the random source they are given (the server passes node:crypto, never Math.random)', () => {
    let calls = 0;
    const p = generateTemporaryPassword((max) => (calls++, max - 1));
    assert.ok(calls >= 14 + 13);
    assert.ok(validatePasswordStrength(p));
  });
});

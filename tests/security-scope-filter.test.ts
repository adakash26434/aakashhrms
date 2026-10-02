import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { buildEmployeeIdScopeCondition, type ScopeFilter } from '../lib/auth/scope-filter';
import { payrollSlips } from '../lib/db/schema';

const dialect = new PgDialect();
const MALICIOUS = "x') OR 1=1 --";

function render(scope: ScopeFilter) {
  const condition = buildEmployeeIdScopeCondition(scope, payrollSlips.employeeId);
  assert.ok(condition, 'expected a condition');
  return dialect.sqlToQuery(condition);
}

const base: ScopeFilter = { scopeType: 'GLOBAL', branchIds: [], departmentIds: [], employeeId: null, userId: 'u1' };

describe('Scope filter parameterisation (S7)', () => {
  it('binds branch ids as parameters, never as SQL text', () => {
    const q = render({ ...base, scopeType: 'BRANCH', branchIds: ['b-1', MALICIOUS] });
    assert.ok(!q.sql.includes(MALICIOUS), q.sql);
    assert.ok(!q.sql.includes('b-1'), q.sql);
    assert.deepEqual(q.params, ['b-1', MALICIOUS]);
  });

  it('binds department ids as parameters, never as SQL text', () => {
    const q = render({ ...base, scopeType: 'DEPARTMENT', departmentIds: [MALICIOUS] });
    assert.ok(!q.sql.includes(MALICIOUS), q.sql);
    assert.deepEqual(q.params, [MALICIOUS]);
  });

  it('denies everything for BRANCH scope with no branches', () => {
    const q = render({ ...base, scopeType: 'BRANCH', branchIds: [] });
    assert.match(q.sql, /false/);
  });

  it('applies no filter for GLOBAL scope', () => {
    assert.equal(buildEmployeeIdScopeCondition(base, payrollSlips.employeeId), undefined);
  });
});

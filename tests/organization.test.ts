import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  branchDepartmentMatrix,
  canChangeMasters,
  changedOrgFields,
  deleteBlockers,
  deleteRefusal,
  departmentOpenToBranch,
  levelRenames,
  nextOrgCode,
  pickable,
  placementErrors,
  reportingTree,
  resolveOrgTab,
  typeEligibility,
  typeRenames,
  validateBranchInput,
  validateDepartmentInput,
  validateDesignationInput,
  validateLevelInput,
  validateTypeInput,
} from '../lib/engines/organization.engine';
import { normalizeDepartment, normalizeType } from '../lib/services/organization.service';
import type { OrgPerson } from '../lib/types/organization';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const person = (id: string, supervisorId: string | null, over: Partial<OrgPerson> = {}): OrgPerson => ({
  id,
  fullName: id.toUpperCase(),
  employeeCode: `E-${id}`,
  status: 'Active',
  branchId: 'b1',
  departmentId: 'd1',
  designationId: 'g1',
  supervisorId,
  isSupervisor: false,
  ...over,
});

describe('Organization: deletes only for unused records (4.3)', () => {
  it('lists every kind of use that blocks a delete', () => {
    assert.deepEqual(deleteBlockers({ employees: 0 }), []);
    assert.deepEqual(deleteBlockers({ employees: 12, designations: 4, users: 1, holidays: 2, payrollRuns: 3, departments: 1 }), [
      '12 employees',
      '4 designations',
      '1 department limited to it',
      "1 user login's access",
      '2 holidays',
      '3 payroll runs',
    ]);
  });

  it('refuses with a message that offers "make inactive" instead', () => {
    assert.equal(deleteRefusal('designation', { employees: 0 }), null);
    assert.match(deleteRefusal('branch', { employees: 1 }) ?? '', /used by 1 employee.*Make it inactive instead/);
    // Inactive employees still count: their history must stay linked.
    assert.notEqual(deleteRefusal('department', { employees: 1, designations: 0 }), null);
  });
});

describe('Organization: company-wide departments (4.3)', () => {
  it('a department with no branch list is open to every branch', () => {
    assert.equal(departmentOpenToBranch({ branchIds: [] }, 'b2'), true);
    assert.equal(departmentOpenToBranch({ branchIds: ['b1'] }, 'b1'), true);
    assert.equal(departmentOpenToBranch({ branchIds: ['b1'] }, 'b2'), false);
  });

  it('pickers offer active records plus the current value', () => {
    const rows = [
      { id: 'a', status: 'active' },
      { id: 'b', status: 'inactive' },
      { id: 'c', status: 'inactive' },
    ];
    assert.deepEqual(pickable(rows, 'b').map((r) => r.id), ['a', 'b']);
    assert.deepEqual(pickable(rows).map((r) => r.id), ['a']);
  });

  it('an employee save refuses an inactive or closed placement, but never blocks an unchanged one', () => {
    const org = {
      branches: [{ id: 'b1', status: 'active' }, { id: 'b2', status: 'active' }, { id: 'b3', status: 'inactive' }],
      departments: [{ id: 'd1', status: 'active', branchIds: ['b1'] }, { id: 'd2', status: 'inactive', branchIds: [] }],
      designations: [{ id: 'g1', status: 'active', departmentId: 'd1' }, { id: 'g2', status: 'inactive', departmentId: 'd1' }],
    };
    const ok = { branchId: 'b1', departmentId: 'd1', designationId: 'g1' };
    assert.deepEqual(placementErrors(ok, null, org), {});
    assert.match(placementErrors({ ...ok, branchId: 'b2' }, null, org).departmentId, /not open to the chosen branch/);
    assert.match(placementErrors({ ...ok, branchId: 'b3' }, null, org).branchId, /inactive/);
    assert.match(placementErrors({ ...ok, departmentId: 'd2' }, null, org).departmentId, /inactive/);
    assert.match(placementErrors({ ...ok, designationId: 'g2' }, null, org).designationId, /inactive/);
    // Already stored that way: an unrelated edit is never blocked.
    const old = { branchId: 'b2', departmentId: 'd1', designationId: 'g2' };
    assert.deepEqual(placementErrors(old, old, org), {});
  });

  it('the employee save runs the placement check on the server', () => {
    assert.match(read('lib/services/employee.service.ts'), /placementErrors\(formData, stored \?\? null/);
  });
});

describe('Organization: structure and reporting (4.3)', () => {
  it('adds up the branch × department matrix', () => {
    const m = branchDepartmentMatrix([
      { branchId: 'b1', departmentId: 'd1', designationId: 'g1', count: 2 },
      { branchId: 'b1', departmentId: 'd1', designationId: 'g2', count: 1 },
      { branchId: 'b2', departmentId: 'd2', designationId: 'g3', count: 4 },
    ]);
    assert.equal(m.cells.b1.d1, 3);
    assert.equal(m.rowTotals.b2, 4);
    assert.equal(m.columnTotals.d1, 3);
    assert.equal(m.total, 7);
  });

  it('builds the reporting tree with team sizes', () => {
    const t = reportingTree([person('boss', null), person('a', 'boss'), person('b', 'boss'), person('c', 'a')]);
    assert.equal(t.roots.length, 1);
    assert.equal(t.roots[0].person.id, 'boss');
    assert.equal(t.roots[0].teamSize, 3);
    assert.deepEqual(t.roots[0].children.map((c) => c.person.id), ['a', 'b']);
  });

  it('draws a reporting loop once and flags it', () => {
    const t = reportingTree([person('x', 'y'), person('y', 'x'), person('z', null)]);
    assert.deepEqual([...t.inCycle].sort(), ['x', 'y']);
    const ids: string[] = [];
    const walk = (n: (typeof t.roots)[number]) => {
      ids.push(n.person.id);
      n.children.forEach(walk);
    };
    t.roots.forEach(walk);
    assert.deepEqual(ids.sort(), ['x', 'y', 'z']);
  });

  it('flags people whose supervisor has left, and people with no supervisor and no team', () => {
    const t = reportingTree([person('left', null, { status: 'Inactive' }), person('a', 'left'), person('lone', null), person('boss', null), person('b', 'boss')]);
    assert.deepEqual(t.inactiveSupervisor, ['a']);
    assert.ok(t.unassigned.includes('lone'));
    assert.ok(!t.unassigned.includes('boss'));
    assert.ok(t.roots.some((r) => r.person.id === 'a'), 'someone whose supervisor left becomes a root');
  });
});

describe('Organization: validation (same rules in the Window and on the server)', () => {
  it('branch: unique code and name, valid phone and email', () => {
    const existing = [{ id: 'b1', code: 'KTM', name: 'Kathmandu' }];
    const base = { code: 'PKR', name: 'Pokhara', location: 'Pokhara', phone: '', email: '', isHeadOffice: false, remoteCategory: 'NONE' };
    assert.deepEqual(validateBranchInput(base, existing), {});
    assert.match(validateBranchInput({ ...base, code: 'ktm' }, existing).code, /already uses code KTM/);
    assert.deepEqual(validateBranchInput({ ...base, code: 'KTM' }, existing, 'b1'), {});
    assert.ok(validateBranchInput({ ...base, code: 'P K R' }, existing).code);
    assert.ok(validateBranchInput({ ...base, phone: '12' }, existing).phone);
    assert.ok(validateBranchInput({ ...base, email: 'nope' }, existing).email);
    assert.ok(validateBranchInput({ ...base, location: ' ' }, existing).location);
  });

  it('department: unique, and only existing branches', () => {
    const base = { code: 'FIN', name: 'Finance', branchIds: ['b1'], headEmployeeId: null, description: '' };
    assert.deepEqual(validateDepartmentInput(base, [], ['b1']), {});
    assert.ok(validateDepartmentInput({ ...base, branchIds: ['gone'] }, [], ['b1']).branchIds);
    assert.ok(validateDepartmentInput(base, [{ id: 'd1', code: 'X', name: 'finance' }], ['b1']).name);
  });

  it('designation: unique within its department only', () => {
    const existing = [{ id: 'g1', name: 'Officer', departmentId: 'd1' }];
    assert.ok(validateDesignationInput({ name: 'officer', departmentId: 'd1', description: '' }, existing, ['d1', 'd2']).name);
    assert.deepEqual(validateDesignationInput({ name: 'Officer', departmentId: 'd2', description: '' }, existing, ['d1', 'd2']), {});
    assert.ok(validateDesignationInput({ name: 'Officer', departmentId: '', description: '' }, existing, ['d1']).departmentId);
  });

  it('level: number range and a maximum above the starting salary', () => {
    const base = { code: 'S6', name: 'Officer', levelNumber: 6, labelNepali: '', description: '', minSalary: 40000, maxSalary: 60000, rankOrder: 6 };
    assert.deepEqual(validateLevelInput(base, []), {});
    assert.ok(validateLevelInput({ ...base, maxSalary: 30000 }, []).maxSalary);
    assert.ok(validateLevelInput({ ...base, levelNumber: 0 }, []).levelNumber);
  });

  it('employment type: notice and probation ranges', () => {
    const base = normalizeType({ code: 'CONTRACT', name: 'Contract', noticePeriodDays: 30, probationMonths: 0, isSsfEligible: true });
    assert.deepEqual(validateTypeInput(base, []), {});
    assert.ok(validateTypeInput({ ...base, noticePeriodDays: 400 }, []).noticePeriodDays);
    assert.ok(validateTypeInput({ ...base, probationMonths: -1 }, []).probationMonths);
    assert.equal(typeEligibility(base), 'SSF');
  });

  it('the server reshapes whatever the browser sends', () => {
    const d = normalizeDepartment({ code: 7, name: null, branchIds: ['b1', 3, { x: 1 }], headEmployeeId: '', extra: 'ignored' });
    assert.deepEqual(d, { code: '7', name: '', branchIds: ['b1'], headEmployeeId: null, description: '' });
    assert.equal(normalizeType({ isPfEligible: 'yes' }).isPfEligible, false);
  });
});

describe('Organization: renames keep employees linked (4.3)', () => {
  it('a level code or name change moves employees to the new code', () => {
    assert.deepEqual(levelRenames({ code: 'S6', name: 'Officer' }, { code: 's7', name: 'Officer' }), [
      { from: 'S6', to: 'S7' },
      { from: 'Officer', to: 'S7' },
    ]);
    assert.deepEqual(levelRenames({ code: 'S6', name: 'Officer' }, { code: 'S6', name: 'Senior officer' }), [{ from: 'Officer', to: 'S6' }]);
    assert.deepEqual(levelRenames({ code: 'S6', name: 'Officer' }, { code: 'S6', name: 'Officer' }), []);
  });

  it('an employment type rename moves employees holding the old name', () => {
    assert.deepEqual(typeRenames({ name: 'Contract' }, { name: 'Fixed-term contract' }), [{ from: 'Contract', to: 'Fixed-term contract' }]);
    assert.deepEqual(typeRenames({ name: 'Contract' }, { name: 'Contract ' }), []);
  });

  it('renames run in the same transaction as the save', () => {
    const repo = read('lib/repositories/organization.repository.ts');
    assert.match(repo, /saveLevel[\s\S]*?db\.transaction[\s\S]*?employees\.shreni/);
    assert.match(repo, /saveType[\s\S]*?db\.transaction[\s\S]*?employees\.category/);
  });
});

describe('Organization security (S19)', () => {
  it('only a company-wide role may change the masters', () => {
    assert.equal(canChangeMasters({ scopeType: 'GLOBAL' }), true);
    for (const scopeType of ['BRANCH', 'DEPARTMENT', 'SELF'] as const) assert.equal(canChangeMasters({ scopeType }), false);
  });

  it('every write action checks permission and company-wide scope, audits, and hides raw errors', () => {
    const actions = read('app/actions/organization.actions.ts');
    for (const name of ['saveOrgRecordAction', 'setOrgStatusAction', 'deleteOrgRecordAction', 'loadLevelPresetAction']) {
      const body = actions.slice(actions.indexOf(`export async function ${name}`));
      const end = body.indexOf('\nexport async function', 10);
      const fn = end > 0 ? body.slice(0, end) : body;
      assert.match(fn, /await authorize\(/, `${name} authorizes`);
      assert.match(fn, /recordAuditLog\(/, `${name} audits`);
      assert.match(fn, /toActionError\(/, `${name} hides raw errors`);
    }
    assert.match(actions, /result: 'DENIED_SCOPE'/);
    assert.ok(!/error\.message/.test(actions), 'no raw error messages');
  });

  it('the audit records changed field names, never values', () => {
    assert.deepEqual(changedOrgFields({ name: 'A', phone: '1', code: 'X' }, { name: 'B', phone: '1', code: 'X' }), ['name']);
    assert.match(read('app/actions/organization.actions.ts'), /changedFields: result\.changed/);
  });

  it('reading the page never rewrites data (the old name-guessing sync is gone)', () => {
    assert.equal(existsSync(join(root, 'lib/services/department.service.ts')), false);
    for (const file of ['lib/services/organization.service.ts', 'lib/repositories/organization.repository.ts', 'lib/repositories/shreni.repository.ts']) {
      assert.ok(!/syncOrgStructure|Dynamic synchronization/.test(read(file)), file);
    }
  });

  it('only one head office: choosing one moves the flag in the same transaction', () => {
    assert.match(read('lib/repositories/organization.repository.ts'), /saveBranch[\s\S]*?transaction[\s\S]*?isHeadOffice: false/);
  });
});

describe('Organization page helpers', () => {
  it('opens a known tab, and maps the old Company setup names', () => {
    assert.equal(resolveOrgTab('departments'), 'departments');
    assert.equal(resolveOrgTab('shreni'), 'levels');
    assert.equal(resolveOrgTab('employment-types'), 'types');
    assert.equal(resolveOrgTab('nonsense'), 'structure');
    assert.equal(resolveOrgTab(undefined), 'structure');
  });

  it('suggests the next department code', () => {
    assert.equal(nextOrgCode(['DEPT-001', 'DEPT-007', 'FIN'], 'DEPT'), 'DEPT-008');
    assert.equal(nextOrgCode([], 'DEPT'), 'DEPT-001');
  });
});

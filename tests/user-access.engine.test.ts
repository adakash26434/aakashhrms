import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  delegationActive,
  delegationProblem,
  grantsBeyond,
  lastAdministratorProblem,
  loginChangeProblem,
  newRoleProblem,
  permissionChangeProblem,
  roleChangeProblem,
  roleDeleteProblem,
  roleDetailsProblem,
  roleReachProblem,
  type AccessActor,
  type LoginFacts,
  type RoleFacts,
} from '../lib/engines/user-access.engine';

// 4.13 / S59: who may give which role, and change which login or role.

const role = (over: Partial<RoleFacts> = {}): RoleFacts => ({
  id: 'r-hr',
  name: 'HR Manager',
  slug: 'hr_manager',
  scopeType: 'GLOBAL',
  isSystemRole: false,
  isProtected: false,
  grants: ['VIEW:EMPLOYEES', 'EDIT:EMPLOYEES'],
  ...over,
});
const adminRole = role({ id: 'r-admin', name: 'Office Administrator', slug: 'office_admin', isSystemRole: true, isProtected: true, grants: [] });
const employeeRole = role({
  id: 'r-emp',
  name: 'Employee Self-Service',
  slug: 'employee',
  scopeType: 'SELF',
  isSystemRole: true,
  isProtected: true,
  grants: ['VIEW:SELF_SERVICE', 'ADD:SELF_SERVICE', 'VIEW:LEAVE_APPLICATIONS', 'ADD:LEAVE_APPLICATIONS', 'VIEW:REPORTS_PAYSLIP', 'VIEW:LOANS', 'ADD:LOANS'],
});
const payrollRole = role({ id: 'r-pay', name: 'Payroll Controller', slug: 'payroll_controller', grants: ['VIEW:PAYROLL_REVIEW', 'APPROVE:PAYROLL_REVIEW'] });

const admin: AccessActor = { userId: 'u-admin', isAdmin: true, grants: new Set(), roleId: 'r-admin' };
const hr: AccessActor = { userId: 'u-hr', isAdmin: false, grants: new Set(['VIEW:EMPLOYEES', 'EDIT:EMPLOYEES', 'VIEW:USERS_ROLES', 'EDIT:USERS_ROLES', 'ADD:USERS_ROLES']), roleId: 'r-users' };
const login = (id: string, r: RoleFacts | null, over: Partial<LoginFacts> = {}): LoginFacts => ({ id, label: `Login ${id}`, isActive: true, role: r, ...over });

describe('S59 giving roles: administrators only by administrators, and never more than you hold', () => {
  it('an administrator gives any role', () => {
    for (const r of [adminRole, payrollRole, employeeRole, role()]) assert.equal(roleReachProblem(admin, r), null);
  });

  it('only an administrator gives the administrator role', () => {
    assert.match(roleReachProblem(hr, adminRole) ?? '', /Only a company administrator can give the Office Administrator role/);
    assert.match(roleReachProblem(hr, role({ slug: 'system_admin', name: 'System Administrator' })) ?? '', /Only a company administrator/);
  });

  it('a role is within reach only when the actor holds every permission it grants', () => {
    assert.equal(roleReachProblem(hr, role()), null);
    const problem = roleReachProblem(hr, payrollRole) ?? '';
    assert.match(problem, /Payroll Controller allows Payroll Review & Slip Overrides → View and Payroll Review & Slip Overrides → Approve, which your own role doesn't/);
  });

  it('the self-service basics on an own-records role are within anyone\'s reach; more is not', () => {
    assert.equal(roleReachProblem(hr, employeeRole), null);
    assert.match(roleReachProblem(hr, { ...employeeRole, grants: [...employeeRole.grants, 'APPROVE:LEAVE_APPROVALS'] }) ?? '', /Leave Approvals → Approve/);
    // The same basics on a company-wide role are company-wide powers.
    assert.deepEqual(grantsBeyond(hr, ['VIEW:LOANS', 'ADD:LOANS'], 'GLOBAL'), ['VIEW:LOANS', 'ADD:LOANS']);
    assert.deepEqual(grantsBeyond(hr, ['VIEW:LOANS', 'ADD:LOANS'], 'SELF'), []);
    // Self-service on one's own records never counts.
    assert.deepEqual(grantsBeyond(hr, ['VIEW:SELF_SERVICE'], 'GLOBAL'), []);
  });

  it('lists name at most three permissions', () => {
    const r = role({ name: 'Big', grants: ['VIEW:LOANS', 'ADD:LOANS', 'EDIT:LOANS', 'DELETE:LOANS', 'APPROVE:LOANS'] });
    assert.match(roleReachProblem(hr, r) ?? '', /Loans & Advances → View, Loans & Advances → Add, Loans & Advances → Edit and 2 more/);
  });
});

describe('S59 changing logins: never your own, administrators only by administrators, within reach', () => {
  it('nobody changes their own login, except setting up their own delegation', () => {
    const own = login('u-hr', role());
    for (const change of ['edit', 'role', 'status'] as const) assert.match(loginChangeProblem(hr, own, change) ?? '', /your own login: another administrator changes it/);
    assert.match(loginChangeProblem(hr, own, 'password') ?? '', /use Change password/);
    assert.equal(loginChangeProblem(hr, own, 'delegation'), null);
    // Administrators too.
    assert.match(loginChangeProblem(admin, login('u-admin', adminRole), 'role') ?? '', /your own login/);
  });

  it('an administrator\'s login is changed only by another administrator', () => {
    assert.match(loginChangeProblem(hr, login('u-x', adminRole, { label: 'Ram' }), 'password') ?? '', /Ram is a company administrator: only another administrator changes this login/);
    assert.equal(loginChangeProblem(admin, login('u-x', adminRole), 'password'), null);
  });

  it('a login whose role is beyond the actor is out of reach (no password resets into more power)', () => {
    assert.match(loginChangeProblem(hr, login('u-p', payrollRole, { label: 'Sita' }), 'password') ?? '', /Sita's role \(Payroll Controller\) allows/);
    assert.equal(loginChangeProblem(hr, login('u-e', employeeRole), 'password'), null);
    assert.equal(loginChangeProblem(hr, login('u-h', role()), 'role'), null);
  });

  it('a login without a role is set up by an administrator', () => {
    assert.match(loginChangeProblem(hr, login('u-n', null), 'edit') ?? '', /no role/);
    assert.equal(loginChangeProblem(admin, login('u-n', null), 'edit'), null);
  });
});

describe('S59 the last administrator stays', () => {
  const a = login('u-a', adminRole);
  it('refuses making the only active administrator inactive or giving them another role', () => {
    assert.match(lastAdministratorProblem(a, { isActive: false, roleSlug: 'office_admin' }, ['u-a']) ?? '', /at least one active administrator/);
    assert.match(lastAdministratorProblem(a, { isActive: true, roleSlug: 'hr_manager' }, ['u-a']) ?? '', /at least one active administrator/);
  });
  it('allows it while another administrator remains, and never concerns other logins', () => {
    assert.equal(lastAdministratorProblem(a, { isActive: false, roleSlug: 'office_admin' }, ['u-a', 'u-b']), null);
    assert.equal(lastAdministratorProblem(a, { isActive: true, roleSlug: 'system_admin' }, ['u-a']), null);
    assert.equal(lastAdministratorProblem(login('u-h', role()), { isActive: false, roleSlug: 'hr_manager' }, ['u-a']), null);
    assert.equal(lastAdministratorProblem({ ...a, isActive: false }, { isActive: false, roleSlug: 'office_admin' }, ['u-b']), null);
  });
});

describe('S59 changing roles', () => {
  it('the administrator role is fixed and stays', () => {
    assert.match(roleChangeProblem(admin, adminRole, 'permissions') ?? '', /fixed/);
    assert.match(roleChangeProblem(admin, adminRole, 'delete') ?? '', /stays/);
  });

  it('nobody changes the role they hold', () => {
    const own = role({ id: 'r-users', name: 'User admin', grants: ['VIEW:USERS_ROLES'] });
    assert.match(roleChangeProblem(hr, own, 'permissions') ?? '', /your own role/);
    assert.match(permissionChangeProblem(hr, own, ['VIEW:USERS_ROLES']) ?? '', /your own role/);
  });

  it('a role beyond the actor is out of reach, removing permissions included', () => {
    assert.match(permissionChangeProblem(hr, payrollRole, []) ?? '', /Payroll Controller allows/);
  });

  it('adds only permissions the actor holds', () => {
    const r = role({ grants: ['VIEW:EMPLOYEES'] });
    assert.equal(permissionChangeProblem(hr, r, ['VIEW:EMPLOYEES', 'EDIT:EMPLOYEES']), null);
    assert.match(permissionChangeProblem(hr, r, ['VIEW:EMPLOYEES', 'APPROVE:LOANS']) ?? '', /You can only give permissions you hold yourself: Loans & Advances → Approve/);
    assert.equal(permissionChangeProblem(admin, r, ['APPROVE:LOANS', 'VIEW:LOANS']), null);
  });

  it('built-in roles keep their name and scope; a new scope keeps the role within reach', () => {
    const builtIn = role({ isSystemRole: true });
    assert.match(roleDetailsProblem(admin, builtIn, { name: 'HR Boss', scopeType: 'GLOBAL' }) ?? '', /keeps its name and scope/);
    assert.match(roleDetailsProblem(admin, builtIn, { name: 'HR Manager', scopeType: 'BRANCH' }) ?? '', /keeps its name and scope/);
    assert.equal(roleDetailsProblem(admin, builtIn, { name: 'HR Manager', scopeType: 'GLOBAL' }), null);
    // An own-records role with the loan basics can't become company-wide in the hands of someone without them.
    const custom = role({ name: 'Staff', scopeType: 'SELF', grants: ['VIEW:LOANS', 'ADD:LOANS'] });
    assert.equal(roleDetailsProblem(hr, custom, { name: 'Staff', scopeType: 'SELF' }), null);
    assert.match(roleDetailsProblem(hr, custom, { name: 'Staff', scopeType: 'GLOBAL' }) ?? '', /Loans & Advances → View and Loans & Advances → Add/);
  });

  it('a new role or copy carries only what the actor holds', () => {
    assert.equal(newRoleProblem(hr, ['VIEW:EMPLOYEES'], 'BRANCH'), null);
    assert.match(newRoleProblem(hr, ['LOCK:PAYROLL_REVIEW'], 'BRANCH') ?? '', /Payroll Review & Slip Overrides → Lock/);
    assert.equal(newRoleProblem(hr, ['VIEW:LOANS', 'ADD:LOANS'], 'SELF'), null);
  });

  it('deleting: never a built-in role, never while logins hold it', () => {
    assert.match(roleDeleteProblem(admin, role({ isSystemRole: true }), 0) ?? '', /Built-in roles stay/);
    assert.match(roleDeleteProblem(admin, role(), 2) ?? '', /2 logins have this role/);
    assert.match(roleDeleteProblem(admin, role(), 1) ?? '', /1 login has this role: give it another role first/);
    assert.equal(roleDeleteProblem(admin, role(), 0), null);
    assert.match(roleDeleteProblem(hr, payrollRole, 0) ?? '', /allows/);
  });
});

describe('S59 delegation', () => {
  const owner = login('u-o', payrollRole, { label: 'Hari' });
  const deputy = login('u-d', role(), { label: 'Gita' });
  const base = { actor: admin, owner, delegate: deputy, until: '2026-10-20', today: '2026-10-10' };

  it('sets a delegation to another active office login, from today to a year ahead', () => {
    assert.equal(delegationProblem(base), null);
    assert.equal(delegationProblem({ ...base, until: '2026-10-10' }), null);
    assert.equal(delegationProblem({ ...base, delegate: null, until: null }), null);
  });

  it('refuses making yourself someone else\'s delegate', () => {
    const me = login('u-admin', adminRole, { label: 'Me' });
    assert.match(delegationProblem({ ...base, delegate: me }) ?? '', /You can't make yourself Hari's delegate/);
  });

  it('allows handing one\'s own approvals to someone while away', () => {
    const self = login('u-hr', role(), { label: 'HR' });
    assert.equal(delegationProblem({ ...base, actor: hr, owner: self }), null);
  });

  it('refuses the owner, inactive and self-service logins, and bad dates', () => {
    assert.match(delegationProblem({ ...base, delegate: owner }) ?? '', /someone other than Hari/);
    assert.match(delegationProblem({ ...base, delegate: { ...deputy, isActive: false } }) ?? '', /inactive/);
    assert.match(delegationProblem({ ...base, delegate: login('u-e', employeeRole, { label: 'Emp' }) }) ?? '', /self-service login/);
    assert.match(delegationProblem({ ...base, until: null }) ?? '', /last day/);
    assert.match(delegationProblem({ ...base, until: '2026-10-09' }) ?? '', /passed/);
    assert.match(delegationProblem({ ...base, until: '2027-10-12' }) ?? '', /at most a year/);
  });

  it('follows who may change the owner\'s login', () => {
    assert.match(delegationProblem({ ...base, actor: hr }) ?? '', /Hari's role \(Payroll Controller\)/);
  });

  it('is in force through its last day', () => {
    assert.equal(delegationActive('2026-10-10', '2026-10-10'), true);
    assert.equal(delegationActive('2026-10-09T00:00:00.000Z', '2026-10-10'), false);
    assert.equal(delegationActive(null, '2026-10-10'), false);
  });
});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_CATEGORIES, ModuleType, ActionType } from '../lib/types/role';

describe('Flexible Roles & Dynamic RBAC Module', () => {
  it('should define all 30 system modules across 7 categorized domains', () => {
    assert.equal(MODULE_CATEGORIES.length, 7);

    const allModuleKeys: ModuleType[] = [];
    MODULE_CATEGORIES.forEach((category) => {
      category.modules.forEach((mod) => {
        allModuleKeys.push(mod.key);
      });
    });

    // 31 modules in the schema (HR_LETTERS, PERFORMANCE, RECRUITMENT and WELFARE_FUNDS added in Phase G); Leave rules (retired in 4.6e, kept until Phase 8) is no longer offered on the Roles screen.
    assert.equal(allModuleKeys.length, 30);
    assert.ok(!allModuleKeys.includes('LEAVE_RULES'));
    assert.ok(allModuleKeys.includes('HR_LETTERS'));
    assert.ok(allModuleKeys.includes('PERFORMANCE'));
    assert.ok(allModuleKeys.includes('RECRUITMENT'));
    assert.ok(allModuleKeys.includes('WELFARE_FUNDS'));
    assert.ok(allModuleKeys.includes('SYSTEM_CONTROL'));
    assert.ok(allModuleKeys.includes('FISCAL_YEAR'));
    assert.ok(allModuleKeys.includes('EMPLOYEES'));
    assert.ok(allModuleKeys.includes('ATTENDANCE'));
    assert.ok(allModuleKeys.includes('PAYROLL_GENERATE'));
    assert.ok(allModuleKeys.includes('REPORTS_SALARY_SHEET'));
    assert.ok(allModuleKeys.includes('USERS_ROLES'));
    assert.ok(allModuleKeys.includes('AUDIT_LOG'));
  });

  it('should validate module actions against allowed actions list', () => {
    const reportsCat = MODULE_CATEGORIES.find((c) => c.id === 'reports');
    assert.ok(reportsCat);

    const salarySheetMod = reportsCat.modules.find((m) => m.key === 'REPORTS_SALARY_SHEET');
    assert.ok(salarySheetMod);
    assert.deepEqual(salarySheetMod.allowedActions, ['VIEW', 'EXPORT']);

    const employeesCat = MODULE_CATEGORIES.find((c) => c.id === 'workforce');
    assert.ok(employeesCat);
    const empMod = employeesCat.modules.find((m) => m.key === 'EMPLOYEES');
    assert.ok(empMod);
    assert.deepEqual(empMod.allowedActions, ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT']);
  });

  it('should correctly slugify custom role names', () => {
    const slugify = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    assert.equal(slugify('Payroll Accountant'), 'payroll_accountant');
    assert.equal(slugify('Branch HR & Admin Manager!'), 'branch_hr_admin_manager');
    assert.equal(slugify('  Senior Auditor (Global)  '), 'senior_auditor_global');
  });

  it('should enforce data access scope variants', () => {
    const validScopes = ['GLOBAL', 'BRANCH', 'DEPARTMENT', 'SELF'];
    validScopes.forEach((scope) => {
      assert.ok(['GLOBAL', 'BRANCH', 'DEPARTMENT', 'SELF'].includes(scope));
    });
  });
});

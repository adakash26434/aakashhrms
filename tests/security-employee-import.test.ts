import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// F15 employee import: a file is only text from the browser. The server checks Employees → Add
// within the user's scope for every row, checks the whole file again when importing, saves each
// row through saveEmployee (the form's own rules), and an import never creates a login or gives a
// role. The only rule it relaxes is the identity scan of a NEW employee (a record to fix after).

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/import.actions.ts');
const service = read('lib/services/employee-import.service.ts');
const employeeService = read('lib/services/employee.service.ts');
const plan = service.slice(service.indexOf('async function plan('), service.indexOf('export async function previewEmployeeImport'));
const commit = service.slice(service.indexOf('export async function commitEmployeeImport'));

describe('F15 employee import', () => {
  it('both steps need Employees → Add in scope; pay from the file needs Salary mapping → Edit', () => {
    assert.match(actions, /^'use server';/);
    assert.match(actions, /checkPermissionWithScope\('ADD', 'EMPLOYEES'\)/);
    assert.match(actions, /hasPermission\('EDIT', 'SALARY_MAPPING'\)/);
    // The browser sends the file's text only: no scope, user or permission travels with it.
    assert.match(actions, /export async function previewEmployeeImportAction\(csv: string\)/);
    assert.match(actions, /export async function commitEmployeeImportAction\(csv: string\)/);
    assert.equal(actions.split('await employeeCtx()').length, 3);
  });

  it('every row is placed within the user\'s branches / departments, and the form\'s rules apply', () => {
    assert.match(plan, /canPlaceInScope\(ctx\.scope, \{ branchId: form\.branchId, departmentId: form\.departmentId \}\)/);
    assert.match(plan, /validateEmployee\(form, \{ scanRequired: false \}\)/);
    assert.match(plan, /codeConflicts\(lk\.codes, form, null\)/);
    assert.match(plan, /placementErrors\(form, null, lk\.org\)/);
    assert.match(plan, /result\.ready \? rows : \[\]/);
  });

  it('importing checks the file again, refuses while any row has an error, and creates no login', () => {
    assert.ok(commit.indexOf('await plan(csv, ctx)') < commit.indexOf('saveEmployee('));
    assert.match(commit, /if \(!report\.ready\) throw new UserFacingError/);
    assert.match(commit, /saveEmployee\(null, r\.form, \{ userId: ctx\.userId, access: \{ createLogin: false \}, canEditPay: ctx\.canEditPay, canManageLogins: false, withoutScans: true \}\)/);
    // Each employee is audited like a form save.
    assert.match(actions, /for \(const c of result\.created\) \{\s*await recordAuditLog\(\{ userId: ctx\.userId, action: 'ADD', module: 'EMPLOYEES', recordId: c\.employeeId/);
  });

  it('the scan exception covers new employees only', () => {
    assert.match(employeeService, /engine\.validateEmployee\(formData, \{ scanRequired: !\(ctx\.withoutScans && !id\) \}\)/);
    // Only the import passes it.
    assert.equal(employeeService.split('withoutScans').length, 3); // the context field and its one use
    assert.doesNotMatch(read('app/actions/employee.actions.ts'), /withoutScans/);
  });
});

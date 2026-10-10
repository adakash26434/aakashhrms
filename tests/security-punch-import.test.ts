import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// F15 punch import: the same guards as an HR punch (S22 / S21) for every row of a file —
// Attendance → Add within the scope, never one's own attendance, employed that day, no future
// days, no closed months — and the file is checked again before anything is added.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/import.actions.ts');
const service = read('lib/services/punch-import.service.ts');
const plan = service.slice(service.indexOf('async function plan('), service.indexOf('export async function previewPunchImport'));
const commit = service.slice(service.indexOf('export async function commitPunchImport'));
const punchActions = actions.slice(actions.indexOf('export async function previewPunchImportAction'));

describe('F15 punch import', () => {
  it('both steps need Attendance → Add with the user\'s scope; only the file\'s text comes from the browser', () => {
    assert.equal(punchActions.split("checkPermissionWithScope('ADD', 'ATTENDANCE')").length, 3);
    assert.match(punchActions, /export async function previewPunchImportAction\(csv: string\)/);
    assert.match(punchActions, /export async function commitPunchImportAction\(csv: string\)/);
    assert.match(punchActions, /recordAuditLog\(\{ userId: scope\.userId, action: 'ADD', module: 'ATTENDANCE'/);
  });

  it('every row is checked like an HR punch', () => {
    assert.match(plan, /attendanceRepo\.findEmployees\(buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(plan, /if \(!employee\) err\(codeColumn, "Outside the branches \/ departments you manage"\)/);
    assert.match(plan, /isOwnRecord\(ctx\.scope\.employeeId, employee\.id\)/);
    assert.match(plan, /parsed\.date > today/);
    assert.match(plan, /parsed\.date < employee\.joiningDate/);
    assert.match(plan, /findClosedPeriodsOverlapping/);
    assert.match(plan, /p\.branchId === employee\.branchId/);
    // Punches are imported punches, by the user who imported them.
    assert.match(plan, /source: "import", note: parsed\.note \|\| DEFAULT_NOTE, createdBy: ctx\.userId/);
    assert.match(plan, /return \{ report: result, punches: \[\] \};/);
  });

  it('adding re-checks the file and refuses while any row has an error', () => {
    assert.ok(commit.indexOf('await plan(csv, ctx)') < commit.indexOf('insertPunches('));
    assert.match(commit, /if \(!report\.ready\) throw new UserFacingError/);
  });
});

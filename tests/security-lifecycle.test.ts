import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S27 lifecycle events (G2): recording a promotion / transfer / confirmation
// changes the employee record, so every action checks EMPLOYEES inside the
// tenant context and respects the employee scope; nobody records or cancels
// an event about their own record (audited DENIED_SELF); applied history is
// never rewritten (cancel touches scheduled events only); the record and the
// employee change happen in one transaction; the ride-along letter needs its
// own HR_LETTERS permission.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/employee-event.actions.ts');
const service = read('lib/services/employee-event.service.ts');
const repo = read('lib/repositories/employee-event.repository.ts');
const page = read('app/(dashboard)/workforce/lifecycle/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S27 lifecycle events: permission and tenant context', () => {
  it('every action resolves the tenant and checks EMPLOYEES', () => {
    const exported = actions.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 3, 'actions exist');
    for (const fn of exported) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /eventCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'EMPLOYEES'\)/);
  });

  it('the page checks permission before loading data', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "EMPLOYEES"\)/);
    assert.ok(page.indexOf('checkPermissionWithScope') < page.indexOf('eventsPage('), 'permission before data');
  });

  it('the ride-along letter is stripped without HR_LETTERS ADD', () => {
    const create = body(actions, 'export async function createEmployeeEventAction');
    assert.match(create, /hasPermission\('ADD', 'HR_LETTERS'\)/);
    assert.match(create, /issueLetter: false/);
  });
});

describe('S27 lifecycle events: employee scope', () => {
  it('the subject employee and every read are found within scope', () => {
    assert.match(body(service, 'export async function createEvent('), /findEmployeeSnapshot\(form\.employeeId, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(body(service, 'export async function eventsPage('), /buildEmployeeScopeCondition\(scope\)/);
    assert.match(body(service, 'export async function cancelScheduledEvent('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
  });

  it('event queries join employees so the scope condition applies', () => {
    for (const fn of ['export async function listEvents(', 'export async function findEventById(']) {
      assert.match(body(repo, fn), /innerJoin\(employees/);
    }
  });
});

describe('S27 lifecycle events: never your own record', () => {
  it('recording an event about yourself is refused before any read, audited DENIED_SELF', () => {
    const create = body(service, 'export async function createEvent(');
    const guard = create.indexOf('isOwnRecord(ctx.actorEmployeeId, form.employeeId)');
    const write = create.indexOf('insertEventTx');
    assert.ok(guard >= 0 && guard < write, 'guard before the write');
    assert.match(create, /result: DENIED_SELF/);
  });

  it('cancelling your own event is refused and audited DENIED_SELF', () => {
    const cancel = body(service, 'export async function cancelScheduledEvent(');
    const guard = cancel.indexOf('isOwnRecord(ctx.actorEmployeeId, existing.employeeId)');
    const write = cancel.indexOf('repo.cancelEvent');
    assert.ok(guard >= 0 && guard < write, 'guard before the write');
    assert.match(cancel, /result: DENIED_SELF/);
  });
});

describe('S27 lifecycle events: history and application', () => {
  it('the event and the employee change are one transaction', () => {
    const insert = body(repo, 'export async function insertEventTx(');
    assert.match(insert, /db\.transaction/);
    assert.match(insert, /tx\s*\n?\s*.insert\(employeeEvents\)|tx\.insert\(employeeEvents\)/);
    assert.match(insert, /tx\.update\(employees\)/);
  });

  it('cancel touches scheduled events only, and nothing deletes events', () => {
    const cancel = body(repo, 'export async function cancelEvent(');
    assert.match(cancel, /eq\(employeeEvents\.status, 'scheduled'\)/);
    assert.ok(!repo.includes('.delete(employeeEvents)'), 'events are never deleted');
  });

  it('due events are claimed before applying, so two readers never apply twice', () => {
    const apply = body(repo, 'export async function applyDueEvents(');
    const claim = apply.indexOf("eq(employeeEvents.status, 'scheduled')");
    const patch = apply.indexOf('tx.update(employees)');
    assert.ok(claim >= 0 && claim < patch, 'claim before patch');
    assert.match(apply, /if \(!claimed\) return;/);
  });
});

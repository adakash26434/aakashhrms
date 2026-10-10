import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S54 (4.7): the overtime policy and decisions.
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

describe('S54 overtime policy', () => {
  const src = read('app/actions/overtime.actions.ts');

  it('saving the policy needs Overtime → Edit, company-wide, and not platform support', () => {
    const fn = src.match(/export async function saveOvertimePolicyAction[\s\S]*?\n}\n/)![0];
    assert.match(fn, /checkPermissionWithScope\('EDIT', 'OT_RULES'\)/);
    assert.match(fn, /scope\.scopeType !== 'GLOBAL'/);
    assert.match(fn, /scope\.isImpersonation/);
  });

  it('every save is audited with the policy before and after', () => {
    assert.match(src, /recordAuditLog\(\{[^}]*module: 'OT_RULES', recordId: POLICY_KEY, result: 'SUCCESS', oldValues: \{ policy: before \}, newValues: \{ policy: after \}/);
  });

  it('errors go through toActionError (no raw messages)', () => {
    assert.match(src, /return toActionError\(error, context\)/);
    // Only messages written for users (UserFacingError) are passed on, per day in a bulk decision.
    const rest = src.replace(/if \(error instanceof UserFacingError\) failed\.push\(\{ key, error: error\.message \}\);/g, '');
    assert.doesNotMatch(rest, /error\.message/);
  });

  it('the legal minimum is checked on the server, whatever the screen sends', () => {
    const service = read('lib/services/overtime.service.ts');
    assert.match(service, /export async function savePolicy[\s\S]*?validatePolicy\(after\)[\s\S]*?throw new OvertimeValidationError/);
    // Reading a stored policy raises it to the law too.
    assert.match(service, /lawful\(normalizePolicy\(parsed\)\)/);
  });

  it('the Overtime tab offers editing only to company-wide administrators', () => {
    const page = read('app/(dashboard)/timeAndLeave/policies/page.tsx');
    assert.match(page, /overtimePolicyData\(canEdit && scope\.scopeType === "GLOBAL" && !impersonation\)/);
  });
});

describe('S54 overtime decisions (4.7b)', () => {
  const actions = read('app/actions/overtime.actions.ts');
  const service = read('lib/services/attendance.service.ts');
  const decide = service.match(/export async function decideOvertime[\s\S]*?\n}\n/)![0];
  const add = service.match(/export async function addOvertime[\s\S]*?\n}\n/)![0];

  it('deciding needs Attendance access in scope; approving is checked against Attendance → Approve on the server', () => {
    const fn = actions.match(/export async function decideOvertimeAction[\s\S]*?\n}\n/)![0];
    assert.match(fn, /checkPermissionWithScope\('VIEW', 'ATTENDANCE'\)/);
    assert.match(fn, /hasPermission\('APPROVE', 'ATTENDANCE'\)/);
    assert.match(fn, /slice\(0, MAX_BULK\)/);
    assert.match(decide, /canApprove: \(ctx\.canApprove && inScope\) \|\| supervisor/);
  });

  it('adding overtime needs Attendance → Add', () => {
    assert.match(actions, /export async function addOvertimeAction[\s\S]*?checkPermissionWithScope\('ADD', 'ATTENDANCE'\)/);
  });

  it('every decision and addition is audited; refusals for your own overtime or outside your scope too', () => {
    assert.match(actions, /attendance\.decideOvertime\([\s\S]*?recordAuditLog\(\{[^}]*result: 'SUCCESS'/);
    assert.match(actions, /attendance\.addOvertime\([\s\S]*?recordAuditLog\(\{[\s\S]*?result: 'SUCCESS'/);
    assert.match(actions, /OwnAttendanceError\) await recordAuditLog\(\{[^}]*result: DENIED_SELF/);
    assert.match(actions, /OutOfScopeError\) await recordAuditLog\(\{[^}]*result: 'DENIED_SCOPE'/);
  });

  it('nobody decides their own overtime, or overtime they added (S21)', () => {
    assert.match(decide, /availableActions\(request, actor/);
    assert.match(decide, /subjectEmployeeIds: \[e\.id\]/);
    assert.match(decide, /preparedById: source === "manual" \? line\.entry\?\.preparedBy/);
    assert.match(decide, /if \(own && decision !== "withdraw"\) throw new OwnAttendanceError/);
  });

  it('out of scope and closed months are refused; days over the limits need a reason; part approval stays within what was worked', () => {
    assert.match(decide, /if \(!inScope && !supervisor && !preparer\) throw new OutOfScopeError\(\)/);
    assert.match(decide, /findClosedPeriodsOverlapping\(date, date\)[\s\S]*?closed month/);
    assert.match(decide, /approving && line\.overLimit && \(!note \|\| note\.length < 3\)/);
    assert.match(decide, /m < 1 \|\| m > line\.minutes/);
    // The minutes come from the server's own reading of the day, never from the screen.
    assert.match(decide, /detectedMinutes: line\.minutes/);
  });

  it('overtime added by hand goes through the same guard as other attendance changes (scope, own, closed month, future)', () => {
    assert.match(add, /await guardDays\(ctx\.scope, \[\{ employeeId, date: date! \}\]\)/);
    assert.match(read('lib/services/attendance.service.ts'), /async function guardDays[\s\S]*?OutOfScopeError[\s\S]*?OwnAttendanceError[\s\S]*?closed month[\s\S]*?future date/);
  });

  it('two people deciding the same day at once: only the first decision is kept', () => {
    const repo = read('lib/repositories/overtime.repository.ts');
    assert.match(repo, /export async function decideDetected[\s\S]*?eq\(overtimeEntries\.status, p\.status\), eq\(overtimeEntries\.detectedMinutes, p\.detectedMinutes\)[\s\S]*?onConflictDoNothing\(\)/);
    assert.match(repo, /export async function decideManual[\s\S]*?eq\(overtimeEntries\.status, "pending"\)/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S26 (4.7): the overtime policy and decisions.
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

describe('S26 overtime policy', () => {
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
    assert.doesNotMatch(src, /error\.message/);
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

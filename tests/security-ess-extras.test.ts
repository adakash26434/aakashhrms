import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S40 self-service extras (G12): every read is pinned to the session's
// employee (getSessionEmployeeId re-checks the account), the employee id is
// never a parameter, own claims go through the travel service with a SELF
// scope (same rules as the office), and the language cookie is just a cookie.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const service = read('lib/services/ess-extras.service.ts');
const actions = read('app/actions/ess-extras.actions.ts');

describe('S40 ESS extras', () => {
  it('every service function takes the employee from the session', () => {
    for (const fn of ['myNotices(', 'myTraining(', 'myClaims(', 'submitMyClaim(']) {
      const start = service.indexOf(`export async function ${fn}`);
      assert.ok(start >= 0, fn);
      const body = service.slice(start, service.indexOf('\n}\n', start));
      assert.match(body, /await getSessionEmployeeId\(\)/, `${fn} session employee`);
      assert.ok(!/employeeId: string/.test(service.slice(start, service.indexOf(')', start))), `${fn} takes no employee id`);
    }
  });

  it('own claims use a SELF scope and the travel service (amounts from the card, submit-own only)', () => {
    assert.match(service, /scopeType: 'SELF'/);
    const start = service.indexOf('export async function submitMyClaim(');
    const body = service.slice(start, service.indexOf('\n}\n', start));
    assert.match(body, /employeeId \}/, 'form employee is overwritten with the session employee');
    assert.match(body, /travelService\.saveClaim\(null, form, ctx\)/);
    assert.match(body, /travelService\.moveClaim\(draft\.id, 'submitted', '', ctx\)/);
  });

  it('the claim action resolves the tenant and audits; the language action only sets a cookie', () => {
    const start = actions.indexOf('export async function submitMyClaimAction(');
    const body = actions.slice(start, actions.indexOf('\n}\n', start));
    assert.match(body, /ensureTenantContext\(\)/);
    assert.match(body, /recordAuditLog\(/);
    const lang = actions.slice(actions.indexOf('export async function setEssLanguageAction('), start);
    assert.ok(!/getDb|ensureTenantContext/.test(lang));
    assert.match(lang, /asEssLang\(lang\)/);
  });
});

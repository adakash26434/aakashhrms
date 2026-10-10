import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// S26 HR letters (G2): formal letters are records. The rules these tests keep:
// every action checks HR_LETTERS permission inside the tenant context; reads
// and writes respect the employee scope; nobody issues or voids a letter
// about their own record (audited DENIED_SELF); an issued letter's text is
// frozen (void changes only the void fields); and the chalani number comes
// from a single transactional bump so it is unique per fiscal year and never
// reused.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/letter.actions.ts');
const service = read('lib/services/letter.service.ts');
const repo = read('lib/repositories/letter.repository.ts');
const schema = read('lib/db/schema.ts');
const sync = read('lib/db/tenant-schema-sync.ts');
const page = read('app/(dashboard)/workforce/letters/page.tsx');
const letterPage = read('app/(dashboard)/workforce/letters/[letterId]/page.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, signature);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

describe('S26 HR letters: permission and tenant context', () => {
  it('every action resolves the tenant and checks HR_LETTERS', () => {
    const exported = actions.match(/export async function \w+/g) ?? [];
    assert.ok(exported.length >= 6, 'actions exist');
    for (const fn of exported) {
      const b = body(actions, fn);
      assert.match(b, /ensureTenantContext\(\)/, `${fn} resolves the tenant`);
      assert.match(b, /letterCtx\(/, `${fn} checks permission`);
    }
    assert.match(actions, /checkPermissionWithScope\(action, 'HR_LETTERS'\)/);
  });

  it('both pages check permission before loading data', () => {
    assert.match(page, /checkPermissionWithScope\("VIEW", "HR_LETTERS"\)/);
    assert.match(letterPage, /checkPermissionWithScope\("VIEW", "HR_LETTERS"\)/);
    assert.ok(letterPage.indexOf('checkPermissionWithScope') < letterPage.indexOf('getLetterForPrint'), 'permission before data');
  });
});

describe('S26 HR letters: employee scope', () => {
  it('lists, reads and the print view all carry the employee scope condition', () => {
    assert.match(body(service, 'export async function lettersPage('), /buildEmployeeScopeCondition\(scope\)/);
    assert.match(body(service, 'export async function getLetterForPrint('), /buildEmployeeScopeCondition\(scope\)/);
    assert.match(body(service, 'export async function voidIssuedLetter('), /buildEmployeeScopeCondition\(ctx\.scope\)/);
    // The employee a letter is issued about must be found within scope.
    assert.match(body(service, 'async function renderForIssue('), /findEmployeeForLetter\(form\.employeeId, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
  });

  it('letter queries join employees so the scope condition applies', () => {
    for (const fn of ['export async function listLetters(', 'export async function findLetterById(']) {
      assert.match(body(repo, fn), /innerJoin\(employees/);
    }
  });
});

describe('S26 HR letters: never your own record', () => {
  it('issuing a letter about yourself is refused and audited DENIED_SELF', () => {
    const issue = body(service, 'export async function issueLetter(');
    const guard = issue.indexOf('isOwnRecord(ctx.actorEmployeeId, form.employeeId)');
    const write = issue.indexOf('issueLetterTx');
    assert.ok(guard >= 0, 'own-record guard exists');
    assert.ok(guard < write, 'guard runs before the write');
    assert.match(issue, /result: DENIED_SELF/);
  });

  it('voiding your own letter is refused and audited DENIED_SELF', () => {
    const voidFn = body(service, 'export async function voidIssuedLetter(');
    const guard = voidFn.indexOf('isOwnRecord(ctx.actorEmployeeId, existing.employeeId)');
    const write = voidFn.indexOf('repo.voidLetter');
    assert.ok(guard >= 0 && guard < write, 'guard before the write');
    assert.match(voidFn, /result: DENIED_SELF/);
  });
});

describe('S26 HR letters: issued text is frozen', () => {
  it('void changes only the void fields, never the letter text', () => {
    const voidFn = body(repo, 'export async function voidLetter(');
    assert.match(voidFn, /status: 'voided'/);
    for (const frozen of ['body', 'subject', 'letterNumber', 'seq', 'mergeData', 'employeeId']) {
      assert.ok(!new RegExp(`${frozen}\\s*:`).test(voidFn.slice(voidFn.indexOf('.set('))), `${frozen} never changes on void`);
    }
    assert.match(voidFn, /eq\(hrLetters\.status, 'issued'\)/);
  });

  it('nothing updates hr_letters outside issue and void', () => {
    const updates = repo.match(/\.update\(hrLetters\)/g) ?? [];
    assert.equal(updates.length, 1, 'only voidLetter updates hr_letters');
    assert.ok(!repo.includes('.delete(hrLetters)'), 'letters are never deleted');
  });
});

describe('S26 HR letters: chalani numbers', () => {
  it('the sequence is bumped once, transactionally, with UPDATE … RETURNING', () => {
    const issue = body(repo, 'export async function issueLetterTx(');
    assert.match(issue, /db\.transaction/);
    assert.match(issue, /update\(letterSequences\)[\s\S]*lastSeq[\s\S]*\+ 1/);
    assert.match(issue, /returning\(\{ lastSeq/);
  });

  it('(fiscal year, seq) is unique in the schema and the tenant sync', () => {
    assert.match(schema, /hr_letters_fiscal_year_seq_key/);
    assert.match(sync, /hr_letters_fiscal_year_seq_key/);
  });

  it('the sync seeds HR_LETTERS permissions idempotently with deterministic ids', () => {
    assert.match(sync, /ALTER TYPE "public"\."module" ADD VALUE IF NOT EXISTS 'HR_LETTERS'|'HR_LETTERS',/);
    assert.match(sync, /md5\('perm:' \|\| a \|\| ':HR_LETTERS'\)::uuid/);
    assert.match(sync, /ON CONFLICT \("action", "module"\) DO NOTHING/);
  });
});

describe('S26 HR letters: rendered output stays plain text', () => {
  it('no letters component injects HTML', () => {
    const dir = join(root, 'components/letters');
    for (const f of readdirSync(dir)) {
      assert.ok(!read(join('components/letters', f)).includes('dangerouslySetInnerHTML'), `${f} renders text only`);
    }
  });

  it('auto-filled merge fields cannot be overridden from the form', () => {
    // normalizeIssueForm keeps only input-source fields; the engine test
    // covers behaviour — this keeps the data spread order safe in the service.
    const render = body(service, 'async function renderForIssue(');
    const employee = render.indexOf('...employeeMergeData(employee)');
    const inputs = render.indexOf('...form.inputs');
    assert.ok(employee >= 0 && inputs > employee, 'inputs spread after employee facts');
    assert.match(service, /normalizeIssueForm\(rawForm\)/);
  });
});

describe('S26 joining pack and letter design', () => {
  it('the pack and the design go through the same permission gate as single letters', () => {
    assert.match(body(actions, 'export async function planJoiningPackAction('), /letterCtx\('ADD'\)/);
    assert.match(body(actions, 'export async function issueJoiningPackAction('), /letterCtx\('ADD'\)/);
    assert.match(body(actions, 'export async function saveLetterDesignAction('), /letterCtx\('EDIT'\)/);
  });

  it('nobody issues a pack about their own record, and the check comes before anything is issued', () => {
    const b = body(service, 'export async function issuePack(');
    assert.match(b, /isOwnRecord\(ctx\.actorEmployeeId, form\.employeeId\)/);
    assert.match(b, /DENIED_SELF/);
    assert.ok(b.indexOf('isOwnRecord') < b.indexOf('issueLetter('), 'own-record refusal precedes the first issue');
  });

  it('every detail is checked before the first letter is issued', () => {
    const b = body(service, 'export async function issuePack(');
    assert.ok(b.indexOf('throw new LetterValidationError(errors)') < b.indexOf('issueLetter('), 'validation precedes issuing');
  });

  it('a pack uses the single-letter path, so scope, S26 and the chalani bump still apply to each letter', () => {
    assert.match(body(service, 'export async function issuePack('), /await issueLetter\(\{ employeeId: form\.employeeId/);
    assert.match(body(service, 'async function packBase('), /findEmployeeForLetter\(form\.employeeId, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
  });

  it('the design is a company setting that carries no script: logo is a checked data URL, text is plain', () => {
    const engine = read('lib/engines/letter-design.engine.ts');
    assert.match(engine, /data:image\\\/\(png\|jpeg\);base64/);
    const sheet = read('components/letters/letter-sheet.tsx');
    assert.ok(!sheet.includes('dangerouslySetInnerHTML'));
  });
});

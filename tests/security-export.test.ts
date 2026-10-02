import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { escapeCsvCell, plainCsvField, rowsToCsv, toCsv, toTsv, safeFilename } from '../lib/export/csv';
import { toActionError, UserFacingError } from '../lib/errors/action-error';

const root = join(__dirname, '..');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...files(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

describe('CSV formula injection (S16)', () => {
  it('neutralises every formula trigger', () => {
    for (const evil of ['=HYPERLINK("http://x","click")', '+cmd|calc', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) {
      assert.match(escapeCsvCell(evil), /^"'/, evil);
    }
  });

  it('leaves real numbers and numeric text alone', () => {
    assert.equal(escapeCsvCell(-1500), '"-1500"');
    assert.equal(escapeCsvCell('-4,52,300.75'), '"-4,52,300.75"');
    assert.equal(escapeCsvCell('+20'), '"+20"');
  });

  it('quotes fields and doubles embedded quotes', () => {
    assert.equal(escapeCsvCell('Sharma, "Ram"'), '"Sharma, ""Ram"""');
    assert.equal(escapeCsvCell(null), '""');
  });

  it('builds whole files safely', () => {
    const csv = toCsv([{ header: 'Name', value: (r: { n: string }) => r.n }], [{ n: '=1+1' }]);
    assert.equal(csv, '"Name"\r\n"\'=1+1"');
    assert.equal(rowsToCsv(['A'], [['@x']]), '"A"\r\n"\'@x"');
  });

  it('cleans fixed-format bank fields without apostrophes', () => {
    assert.equal(plainCsvField('Sharma, Ram'), '"Sharma, Ram"');
    assert.equal(plainCsvField('=EVIL()'), 'EVIL()');
    assert.equal(plainCsvField('Line\nbreak'), 'Line break');
    assert.equal(plainCsvField(-25), '-25');
  });

  it('makes clipboard copies safe for Excel paste', () => {
    assert.equal(toTsv([['=1', 'a\tb', 5]]), "'=1\ta b\t5");
  });

  it('produces safe filenames', () => {
    assert.equal(safeFilename('Shrawan 2083 / Head Office'), 'Shrawan-2083-Head-Office');
    assert.equal(safeFilename('../../etc'), 'etc');
  });

  it('has no hand-built CSV left in the app', () => {
    const offenders = [...files('app'), ...files('components'), ...files('lib')].filter((f) => {
      const src = readFileSync(join(root, f), 'utf8');
      return /csv\s*\+=|let csv\s*=|data:text\/csv|headers\.join\(","\)/.test(src);
    });
    assert.deepEqual(offenders, []);
  });

  it('gates browser exports on EXPORT permission and audits them', () => {
    const action = readFileSync(join(root, 'app/actions/export.actions.ts'), 'utf8');
    assert.match(action, /checkPermission\('EXPORT', input\.module\)/);
    assert.match(action, /recordAuditLog\(/);
    assert.match(action, /DENIED_PERMISSION/);
    const bank = readFileSync(join(root, 'app/actions/payroll.actions.ts'), 'utf8');
    assert.match(bank, /plainCsvField/);
    assert.match(bank, /Bank transfer file/);
  });
});

describe('Action error sanitising (S9)', () => {
  it('passes user-facing errors through', () => {
    assert.deepEqual(toActionError(new UserFacingError('Period is locked'), 'test', () => {}), { success: false, error: 'Period is locked' });
    assert.equal(toActionError(new Error('Unauthorized: no access'), 'test', () => {}).error, 'Unauthorized: no access');
  });

  it('hides internal errors behind a logged reference', () => {
    const logged: string[] = [];
    const result = toActionError(new Error('duplicate key value violates unique constraint "users_email_key"'), 'saveUser', (m) => logged.push(m));
    assert.ok(!result.error.includes('constraint'));
    assert.match(result.error, /ref [0-9A-F]{8}/);
    assert.equal(logged.length, 1);
    assert.ok(logged[0].includes(result.ref!));
  });
});

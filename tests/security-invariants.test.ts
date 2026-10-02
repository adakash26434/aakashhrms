import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Source-level guards for security fixes that are hard to exercise without a
 * database. They fail if a known-dangerous pattern is reintroduced.
 */

const ROOT = join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'lib'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'migrations') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d))).map((path) => ({
  path: path.slice(ROOT.length + 1).replace(/\\/g, '/'),
  src: readFileSync(path, 'utf8'),
}));

describe('Security invariants', () => {
  it('S0: tenant DB is never stored in a process-wide global', () => {
    const offenders = files
      .filter((f) => /_requestScopeTenantDb|setRequestScopeTenantDb|getRequestScopeTenantDb/.test(f.src))
      .map((f) => f.path);
    assert.deepEqual(offenders, []);
  });

  it('S0: multi-tenant getDb() has no primary-database fallback', () => {
    const dbIndex = files.find((f) => f.path === 'lib/db/index.ts')!;
    assert.match(dbIndex.src, /throw new TenantContextError\(\)/);
  });

  it('S2: plaintext temporary passwords are never selected from the users table', () => {
    const offenders = files
      .filter((f) => /tempPassword:\s*users\.tempPassword/.test(f.src))
      .map((f) => f.path);
    assert.deepEqual(offenders, []);
  });

  it('S2: temp_password is only ever written as null', () => {
    // Response payloads may carry a freshly issued tempPassword; only writes
    // into the users table (createUser, Drizzle .set/.values, property
    // assignment) are forbidden unless the value is null.
    const offenders = files
      .filter((f) => f.path !== 'lib/db/schema.ts')
      .filter((f) => {
        const src = f.src.replace(/\/\/.*$/gm, '');
        return (
          /createUser\(\s*\{[^}]*\btempPassword\b/.test(src) ||
          /\.tempPassword\s*=(?!\s*null\b)/.test(src) ||
          /\.(set|values)\(\s*\{[^}]*\btempPassword\s*(?:,|\}|:(?!\s*null\b))/.test(src)
        );
      })
      .map((f) => f.path);
    assert.deepEqual(offenders, []);
  });

  it('S1: route guard does not authorize on impersonation cookie presence', () => {
    const cfg = files.find((f) => f.path === 'lib/auth/auth.config.ts')!;
    assert.doesNotMatch(cfg.src, /cookies\??\.get\??\.\(['"]platform_impersonation['"]\)/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { authConfig } from '../lib/auth/auth.config';

// Redesign Phase 1 invariants (docs/redesign/02-design-system.md §3, §7).
// The entry pages (marketing homepage, login) keep their website styling until
// Phase 6, so they are exempt from the in-app rules.

const root = join(__dirname, '..');
const ENTRY_PAGES = new Set(['components/home/home-page-client.tsx', 'app/(auth)/login/page.tsx']);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...tsxFiles(rel));
    else if (name.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

const appFiles = [...tsxFiles('app'), ...tsxFiles('components')]
  .map((f) => relative(root, join(root, f)).split(sep).join('/'))
  .filter((f) => !ENTRY_PAGES.has(f));

function offenders(pattern: RegExp): string[] {
  return appFiles.filter((f) => pattern.test(readFileSync(join(root, f), 'utf8')));
}

describe('Design foundation (Phase 1)', () => {
  it('uses the type scale instead of arbitrary small font sizes (text-[9px]…text-[13px])', () => {
    assert.deepEqual(offenders(/(?<![\w-])text-\[(?:\d|1[0-3])(?:\.\d+)?px\]/), []);
  });

  it('uses tokens instead of raw hex colour classes in app screens', () => {
    assert.deepEqual(offenders(/(?:bg|text|border|ring|from|to|via|fill|stroke|outline)-\[#[0-9a-fA-F]{3,8}\]/), []);
  });

  it('keeps decorative ambient motion off app screens (entry pages only)', () => {
    assert.deepEqual(offenders(/animate-(?:aura|beam|corner)/), []);
  });

  it('remaps the legacy palettes onto the logo tokens', () => {
    const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
    for (const scale of ['zinc', 'gray', 'slate', 'neutral', 'stone']) {
      assert.match(css, new RegExp(`--color-${scale}-500: var\\(--neutral-500\\)`), `${scale} not remapped`);
    }
    for (const scale of ['emerald', 'green']) {
      assert.match(css, new RegExp(`--color-${scale}-600: var\\(--forest-600\\)`), `${scale} not remapped`);
    }
    for (const scale of ['rose', 'red']) {
      assert.match(css, new RegExp(`--color-${scale}-700: var\\(--crimson-700\\)`), `${scale} not remapped`);
    }
    assert.match(css, /--forest-600: #1E7F12;/);
    assert.match(css, /--color-payroll-primary: var\(--brand\);/);
  });

  it('keeps the chart hex mirror in sync with the CSS brand token', async () => {
    const { PAYROLL_COLORS, CHART_COLORS } = await import('../lib/constants/colors');
    assert.equal(PAYROLL_COLORS.primary, '#1E7F12');
    assert.equal(CHART_COLORS.primary, '#1E7F12');
  });

  it('never renders money in the monospace font', () => {
    const npr = readFileSync(join(root, 'components/ui/npr-text.tsx'), 'utf8');
    assert.ok(!/font-mono/.test(npr));
  });
});

describe('Development component gallery', () => {
  type AuthorizedArgs = Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0];
  const anonymous = (path: string) =>
    authConfig.callbacks.authorized({
      auth: null,
      request: { nextUrl: new URL(`http://localhost${path}`), cookies: { get: () => undefined } },
    } as unknown as AuthorizedArgs);

  function withNodeEnv<T>(value: string, fn: () => T): T {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = value;
    try {
      return fn();
    } finally {
      env.NODE_ENV = previous;
    }
  }

  it('is not reachable anonymously in production', async () => {
    assert.equal(await withNodeEnv('production', () => anonymous('/dev/kit')), false);
  });

  it('is reachable in development without signing in', async () => {
    assert.equal(await withNodeEnv('development', () => anonymous('/dev/kit')), true);
  });

  it('returns 404 from the page itself in production', () => {
    const page = readFileSync(join(root, 'app/dev/kit/page.tsx'), 'utf8');
    assert.match(page, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  });
});

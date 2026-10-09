import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_MODULES, canSeeSection, findActiveLocation, visibleModules } from '../lib/frame/navigation';
import { isTypingTarget, matchesCombo, resolveShortcut, GLOBAL_SHORTCUTS } from '../lib/frame/shortcuts';
import { rankCandidates, scoreCandidate } from '../lib/frame/palette-search';

const root = join(__dirname, '..');
const key = (k: string, mods: Partial<{ ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }> = {}, code?: string) => ({
  key: k,
  code,
  ctrlKey: Boolean(mods.ctrl),
  altKey: Boolean(mods.alt),
  shiftKey: Boolean(mods.shift),
  metaKey: Boolean(mods.meta),
});

describe('Navigation model (2.1)', () => {
  it('has seven modules with unique Alt+1…7 hotkeys', () => {
    assert.equal(NAV_MODULES.length, 7);
    assert.deepEqual(NAV_MODULES.map((m) => m.hotkey), ['1', '2', '3', '4', '5', '6', '7']);
  });

  it('points every section at a page that exists', () => {
    const hrefs = NAV_MODULES.flatMap((m) => m.sections.map((s) => s.href));
    assert.equal(new Set(hrefs).size, hrefs.length, 'duplicate section href');
    for (const href of hrefs) {
      const page = join(root, 'app', '(dashboard)', ...href.split('?')[0].split('/').filter(Boolean), 'page.tsx');
      assert.ok(existsSync(page), `missing page for ${href}`);
    }
  });

  it('hides sections without permission and drops empty modules', () => {
    const modules = visibleModules({ allowedModules: ['EMPLOYEES', 'REPORTS_PAYSLIP'], fullAccess: false });
    assert.deepEqual(modules.map((m) => m.id), ['home', 'workforce', 'reports']);
    // Lifecycle events (G2) and Exit (G5) also live under EMPLOYEES.
    assert.deepEqual(modules.find((m) => m.id === 'workforce')!.sections.map((s) => s.id), ['employees', 'lifecycle', 'exit']);
  });

  it('treats an empty permission list as no access (except the dashboard)', () => {
    const modules = visibleModules({ allowedModules: [], fullAccess: false });
    assert.deepEqual(modules.map((m) => m.id), ['home']);
  });

  it('shows everything to an impersonating super admin', () => {
    assert.equal(visibleModules({ allowedModules: [], fullAccess: true }).length, 7);
  });

  it('accepts any of several permission modules', () => {
    const leaves = NAV_MODULES.find((m) => m.id === 'time')!.sections.find((s) => s.id === 'leaves')!;
    assert.equal(canSeeSection(leaves, { allowedModules: ['LEAVE_APPROVALS'], fullAccess: false }), true);
    assert.equal(canSeeSection(leaves, { allowedModules: ['ATTENDANCE'], fullAccess: false }), false);
  });

  it('matches the active module and section by longest prefix and aliases', () => {
    assert.equal(findActiveLocation('/payroll/leave-salary')?.section?.id, 'leave-salary');
    assert.equal(findActiveLocation('/workforce/employees/123/edit')?.section?.id, 'employees');
    assert.equal(findActiveLocation('/workforce/departments')?.section?.id, 'organization');
    assert.equal(findActiveLocation('/setup/tax-rates')?.module.id, 'setup');
    assert.equal(findActiveLocation('/reports')?.module.id, 'reports');
    assert.equal(findActiveLocation('/reports')?.section, null);
    assert.equal(findActiveLocation('/unknown'), null);
  });
});

describe('Keyboard shortcuts (2.7)', () => {
  it('opens the palette with Ctrl K, Cmd K and Alt G', () => {
    assert.equal(resolveShortcut(key('k', { ctrl: true }))?.id, 'palette');
    assert.equal(resolveShortcut(key('k', { meta: true }))?.id, 'palette');
    assert.equal(resolveShortcut(key('©', { alt: true }, 'KeyG'))?.id, 'paletteAlt');
  });

  it('maps Alt+1…7 to modules using the physical key', () => {
    assert.deepEqual(resolveShortcut(key('¡', { alt: true }, 'Digit1')), { id: 'module', moduleIndex: 0 });
    assert.deepEqual(resolveShortcut(key('7', { alt: true }, 'Digit7')), { id: 'module', moduleIndex: 6 });
    assert.equal(resolveShortcut(key('8', { alt: true }, 'Digit8')), null);
  });

  it('toggles the navigator and locks the session', () => {
    assert.equal(resolveShortcut(key('b', { ctrl: true }))?.id, 'toggleNavigator');
    assert.equal(resolveShortcut(key('L', { ctrl: true, shift: true }))?.id, 'lockSession');
  });

  it('does not steal "?" while the user is typing', () => {
    assert.equal(resolveShortcut(key('?', { shift: true }), { tagName: 'INPUT' }), null);
    assert.equal(resolveShortcut(key('?', { shift: true }), { tagName: 'DIV' })?.id, 'help');
    assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  });

  it('matches page-level combos for the command toolbar', () => {
    assert.equal(matchesCombo(key('n', { ctrl: true }, 'KeyN'), 'Ctrl+N'), true);
    assert.equal(matchesCombo(key('E', { ctrl: true, shift: true }, 'KeyE'), 'Ctrl+Shift+E'), true);
    assert.equal(matchesCombo(key('e', { ctrl: true }, 'KeyE'), 'Ctrl+Shift+E'), false);
    assert.equal(matchesCombo(key('F2', {}, 'F2'), 'F2'), true);
  });

  it('documents every global shortcut it handles', () => {
    const ids = new Set(GLOBAL_SHORTCUTS.map((s) => s.id));
    for (const id of ['palette', 'paletteAlt', 'module', 'toggleNavigator', 'lockSession', 'help']) {
      assert.ok(ids.has(id as never), `${id} missing from the help overlay`);
    }
  });
});

describe('Command palette ranking (2.6)', () => {
  const items = [
    { id: 'a', label: 'Salary sheet', group: 'Pages', keywords: ['report'] },
    { id: 'b', label: 'Salary structure', group: 'Pages' },
    { id: 'c', label: 'Leave salary', group: 'Pages', keywords: ['encashment'] },
    { id: 'd', label: 'Tax / IRD', group: 'Pages', keywords: ['tds'] },
  ];

  it('prefers label prefixes, then word prefixes, then keywords', () => {
    assert.deepEqual(rankCandidates(items, 'sal').map((i) => i.id), ['a', 'b', 'c']);
    assert.deepEqual(rankCandidates(items, 'tds').map((i) => i.id), ['d']);
    assert.deepEqual(rankCandidates(items, 'encash').map((i) => i.id), ['c']);
  });

  it('allows skipped letters but not random input', () => {
    assert.ok(scoreCandidate(items[0], 'slsht') > 0);
    assert.equal(rankCandidates(items, 'zzzz').length, 0);
  });
});

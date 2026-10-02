import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cn } from '../lib/utils';

// Regressions found in the Phase 3 hands-on pass of /dev/kit (see CHANGELOG).
const root = join(__dirname, '..');
const source = (file: string) => readFileSync(join(root, file), 'utf8');

describe('Kit hands-on regressions', () => {
  it('cn keeps the last position utility, so sticky must come after a tone edge', () => {
    assert.match(cn('relative before:absolute', 'sticky z-[1]'), /\bsticky\b/);
    assert.doesNotMatch(cn('relative before:absolute', 'sticky z-[1]'), /(^|\s)relative(\s|$)/);
    // The original bug: tone classes last dropped the frozen column.
    assert.doesNotMatch(cn('sticky z-[1]', 'relative before:absolute'), /\bsticky\b/);
  });

  it('DataGrid applies the sticky class after the row-tone edge', () => {
    const grid = source('components/kit/data-grid.tsx');
    const tone = grid.indexOf('ci === 0 && tone && cn("relative');
    const sticky = grid.indexOf('c.id in stickyLeft && "sticky z-[1]"', tone);
    assert.ok(tone > 0 && sticky > tone, 'sticky must follow the tone classes in the body cell');
  });

  it('Worklist shortcuts are scoped to the worklist, never window-wide', () => {
    const worklist = source('components/kit/worklist.tsx');
    assert.doesNotMatch(worklist, /window\.addEventListener\(\s*["']keydown/);
    assert.doesNotMatch(worklist, /document\.addEventListener\(\s*["']keydown/);
    assert.match(worklist, /onKeyDown=\{onKeyDown\}/);
    assert.match(worklist, /tabIndex=\{-1\}/);
  });

  it('Window keeps Esc and Tab working when focus falls out of the panel', () => {
    const win = source('components/kit/window.tsx');
    assert.match(win, /document\.addEventListener\("keydown", onDocKey\)/);
    assert.match(win, /modals\[modals\.length - 1\] !== panel/, 'only the topmost window reacts');
  });

  it('Confirm shows a failed action inline instead of throwing', () => {
    const confirm = source('components/kit/confirm.tsx');
    assert.match(confirm, /catch \(e\)/);
    assert.match(confirm, /role="alert"/);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EditHistory, fillDownChanges, moveFrom, parseClipboard, pasteChanges, rangeOf, toClipboard } from '../lib/kit/edit-grid';
import { parseCsv } from '../lib/export/csv';
import { parseAmount } from '../lib/engines/salary-structure.engine';

const dims = { rows: 5, cols: 4 };
const all = () => true;

describe('EditGrid: moving like Excel', () => {
  it('arrows stop at the edges; Ctrl+arrows jump to them', () => {
    assert.deepEqual(moveFrom({ row: 0, col: 0 }, 'ArrowUp', dims), { row: 0, col: 0 });
    assert.deepEqual(moveFrom({ row: 2, col: 1 }, 'ArrowDown', dims), { row: 3, col: 1 });
    assert.deepEqual(moveFrom({ row: 2, col: 1 }, 'ArrowRight', dims, { ctrl: true }), { row: 2, col: 3 });
    assert.deepEqual(moveFrom({ row: 2, col: 1 }, 'ArrowDown', dims, { ctrl: true }), { row: 4, col: 1 });
  });

  it('Tab wraps to the next row; Shift+Tab back; Home / End and Ctrl+Home / Ctrl+End', () => {
    assert.deepEqual(moveFrom({ row: 1, col: 3 }, 'Tab', dims), { row: 2, col: 0 });
    assert.deepEqual(moveFrom({ row: 2, col: 0 }, 'Tab', dims, { shift: true }), { row: 1, col: 3 });
    assert.deepEqual(moveFrom({ row: 2, col: 2 }, 'Home', dims), { row: 2, col: 0 });
    assert.deepEqual(moveFrom({ row: 2, col: 2 }, 'End', dims, { ctrl: true }), { row: 4, col: 3 });
    assert.equal(moveFrom({ row: 0, col: 0 }, 'a', dims), null);
  });

  it('a range is the rectangle between anchor and active cell, either way round', () => {
    assert.deepEqual(rangeOf({ row: 3, col: 2 }, { row: 1, col: 0 }), { top: 1, left: 0, bottom: 3, right: 2 });
  });
});

describe('EditGrid: copy and paste with Excel', () => {
  it('reads tab-separated blocks with CRLF, quotes and a trailing newline', () => {
    assert.deepEqual(parseClipboard('1\t2\r\n3\t4\r\n'), [['1', '2'], ['3', '4']]);
    assert.deepEqual(parseClipboard('"a\tb"\t"say ""hi"""\n'), [['a\tb', 'say "hi"']]);
    assert.deepEqual(parseClipboard('single'), [['single']]);
  });

  it('writes Excel-ready text, quoting cells that need it', () => {
    assert.equal(toClipboard([['1', 'a\tb'], ['x', '"q"']]), '1\t"a\tb"\nx\t"""q"""');
  });

  it('a block pastes from the top-left of the selection, clipped to the grid', () => {
    const changes = pasteChanges([['1', '2'], ['3', '4'], ['5', '6']], { top: 3, left: 2, bottom: 3, right: 2 }, dims, all);
    assert.deepEqual(changes.map((c) => [c.row, c.col, c.value]), [[3, 2, '1'], [3, 3, '2'], [4, 2, '3'], [4, 3, '4']]);
  });

  it('one value pasted over a selection fills it; read-only cells are skipped', () => {
    const changes = pasteChanges([['9']], { top: 0, left: 0, bottom: 1, right: 1 }, dims, (c) => c.col !== 1);
    assert.deepEqual(changes.map((c) => [c.row, c.col]), [[0, 0], [1, 0]]);
  });
});

describe('EditGrid: fill down and undo', () => {
  it('Ctrl+D copies the top row of the selection down', () => {
    const read = (c: { row: number; col: number }) => `r${c.row}c${c.col}`;
    const changes = fillDownChanges({ top: 1, left: 0, bottom: 3, right: 1 }, read, all);
    assert.deepEqual(changes.map((c) => [c.row, c.col, c.value]), [[2, 0, 'r1c0'], [3, 0, 'r1c0'], [2, 1, 'r1c1'], [3, 1, 'r1c1']]);
  });

  it('undo reverses the last set, redo re-applies it, a new edit clears redo', () => {
    const h = new EditHistory();
    h.push([{ rowId: 'a', colId: 'basic', before: 10, after: 20 }]);
    h.push([{ rowId: 'a', colId: 'basic', before: 20, after: 30 }]);
    assert.deepEqual(h.undo(), [{ rowId: 'a', colId: 'basic', before: 30, after: 20 }]);
    assert.deepEqual(h.redo(), [{ rowId: 'a', colId: 'basic', before: 20, after: 30 }]);
    h.undo();
    h.push([{ rowId: 'b', colId: 'basic', before: 1, after: 2 }]);
    assert.equal(h.canRedo, false);
    h.push([{ rowId: 'b', colId: 'basic', before: 2, after: 2 }]); // nothing really changed: not recorded
    assert.deepEqual(h.undo(), [{ rowId: 'b', colId: 'basic', before: 2, after: 1 }]);
  });
});

describe('Numbers and CSV as people type them in Nepal', () => {
  it('reads lakh commas, NPR prefixes and blanks', () => {
    assert.equal(parseAmount('1,20,000'), 120000);
    assert.equal(parseAmount('NPR 25,000.50'), 25000.5);
    assert.equal(parseAmount(''), 0);
    assert.equal(parseAmount('-'), 0);
    assert.equal(parseAmount('abc'), null);
  });

  it('reads CSV saved by Excel (BOM, quotes, CRLF) and drops our formula guard', () => {
    const rows = parseCsv('﻿Employee code,Basic\r\n"EMP-001","30,000"\r\nEMP-002,\'=SUM(1)\r\n\r\n');
    assert.deepEqual(rows, [['Employee code', 'Basic'], ['EMP-001', '30,000'], ['EMP-002', '=SUM(1)']]);
  });
});

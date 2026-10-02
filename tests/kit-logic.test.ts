import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampWidth,
  compareValues,
  moveActiveRow,
  nextSort,
  parseGridPrefs,
  selectRange,
  selectionState,
  sortRows,
  sumAmounts,
  toggleAll,
  MIN_COL_WIDTH,
  MAX_COL_WIDTH,
} from '../lib/kit/grid';
import { formatAmount, parseAmount, isNegativeAmount } from '../lib/kit/amount';
import { resolveStatus, STATUS_VOCABULARY } from '../lib/kit/status';
import { nextTrapIndex } from '../lib/kit/focus';

describe('DataGrid logic (3.1)', () => {
  it('compares numbers, formatted amounts, dates and text naturally', () => {
    assert.ok(compareValues(9, 10) < 0);
    assert.ok(compareValues('4,52,300', '52,300') > 0);
    assert.ok(compareValues('EMP-2', 'EMP-10') < 0, 'numeric-aware text');
    assert.ok(compareValues(new Date('2026-01-01'), new Date('2025-01-01')) > 0);
    assert.ok(compareValues('apple', 'Banana') < 0, 'case-insensitive');
  });

  it('keeps empty values last in both directions and sorts stably', () => {
    const rows = [{ v: 2 }, { v: null }, { v: 1 }, { v: '' }, { v: 2 }];
    assert.deepEqual(sortRows(rows, (r) => r.v, 'asc').map((r) => r.v), [1, 2, 2, null, '']);
    assert.deepEqual(sortRows(rows, (r) => r.v, 'desc').map((r) => r.v), [2, 2, 1, null, '']);
    const stable = sortRows(rows, (r) => r.v, 'asc');
    assert.equal(stable[1], rows[0]);
    assert.equal(stable[2], rows[4]);
  });

  it('cycles header sorting none → asc → desc → none', () => {
    let s = nextSort(null, 'net');
    assert.deepEqual(s, { columnId: 'net', direction: 'asc' });
    s = nextSort(s, 'net');
    assert.deepEqual(s, { columnId: 'net', direction: 'desc' });
    assert.equal(nextSort(s, 'net'), null);
    assert.deepEqual(nextSort(s, 'gross'), { columnId: 'gross', direction: 'asc' });
  });

  it('selects ranges, toggles all and reports the header state', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    assert.deepEqual([...selectRange(ids, 'b', 'd', new Set())].sort(), ['b', 'c', 'd']);
    assert.deepEqual([...selectRange(ids, 'd', 'b', new Set(['a']))].sort(), ['a', 'b', 'c', 'd']);
    assert.deepEqual([...toggleAll(ids, new Set(['a']))].sort(), ids);
    assert.equal(toggleAll(ids, new Set(ids)).size, 0);
    assert.equal(selectionState(ids, new Set(['a'])), 'some');
    assert.equal(selectionState([], new Set()), 'none');
  });

  it('moves the active row with arrows, Home/End and Page keys', () => {
    assert.equal(moveActiveRow(0, 'ArrowUp', 5), 0);
    assert.equal(moveActiveRow(4, 'ArrowDown', 5), 4);
    assert.equal(moveActiveRow(2, 'End', 5), 4);
    assert.equal(moveActiveRow(3, 'Home', 5), 0);
    assert.equal(moveActiveRow(1, 'PageDown', 50, 10), 11);
    assert.equal(moveActiveRow(0, 'ArrowDown', 0), -1);
  });

  it('parses stored column prefs defensively', () => {
    const prefs = parseGridPrefs(JSON.stringify({ widths: { name: 9999, gone: 100, code: 'x' }, hidden: ['code', 'gone', 7] }), ['name', 'code']);
    assert.deepEqual(prefs, { widths: { name: MAX_COL_WIDTH }, hidden: ['code'] });
    assert.deepEqual(parseGridPrefs('{bad json', ['a']), { widths: {}, hidden: [] });
    assert.equal(clampWidth(3), MIN_COL_WIDTH);
  });

  it('sums money without floating-point drift', () => {
    assert.equal(sumAmounts([0.1, 0.2]), 0.3);
    assert.equal(sumAmounts(['1,20,000.50', 99.5, null, 'abc']), 120100);
  });
});

describe('Amount formatting (3.6, E7)', () => {
  it('uses lakh grouping and fixed decimals', () => {
    assert.equal(formatAmount(452300), '4,52,300.00');
    assert.equal(formatAmount('1234567.5'), '12,34,567.50');
    assert.equal(formatAmount(1500, { prefix: 'NPR', decimals: 0 }), 'NPR 1,500');
  });

  it('marks negatives with a minus or accounting parentheses', () => {
    assert.equal(formatAmount(-1250), '-1,250.00');
    assert.equal(formatAmount(-1250, { parentheses: true }), '(1,250.00)');
    assert.equal(isNegativeAmount('(10.00)'), true);
  });

  it('compacts large KPI figures into lakh and crore', () => {
    assert.equal(formatAmount(452300, { compact: true }), '4.52 L');
    assert.equal(formatAmount(84200000, { compact: true, prefix: 'NPR' }), 'NPR 8.42 Cr');
    assert.equal(formatAmount(85000, { compact: true }), '85,000');
  });

  it('parses formatted input and rejects non-numbers', () => {
    assert.equal(parseAmount('NPR 4,52,300.50'), 452300.5);
    assert.equal(parseAmount('Rs. 10'), 10);
    assert.equal(parseAmount('12abc'), null);
    assert.equal(formatAmount(undefined), '—');
  });
});

describe('Status vocabulary (3.6)', () => {
  it('maps raw states onto the fixed vocabulary', () => {
    assert.equal(resolveStatus('UNDER_REVIEW'), 'review');
    assert.equal(resolveStatus('Pending'), 'pending');
    assert.equal(resolveStatus('LOCKED'), 'locked');
    assert.equal(resolveStatus('on hold'), 'onHold');
    assert.equal(resolveStatus('weird'), null);
  });

  it('gives every status a label and an icon (never colour alone)', () => {
    for (const def of Object.values(STATUS_VOCABULARY)) {
      assert.ok(def.label && def.icon);
    }
  });
});

describe('Focus trap (3.4)', () => {
  it('wraps Tab and Shift+Tab inside the window', () => {
    assert.equal(nextTrapIndex(3, 2, false), 0);
    assert.equal(nextTrapIndex(3, 0, true), 2);
    assert.equal(nextTrapIndex(3, -1, false), 0);
    assert.equal(nextTrapIndex(3, -1, true), 2);
    assert.equal(nextTrapIndex(0, 0, false), -1);
  });
});

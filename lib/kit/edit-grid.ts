// Kit EditGrid (4.4): the spreadsheet table's pure logic, following Excel's
// conventions: cell movement, range selection, tab-separated copy / paste
// (to and from Excel), fill down and undo / redo. The component is
// components/kit/edit-grid.tsx.

export interface Cell {
  row: number;
  col: number;
}

export interface Range {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Dims {
  rows: number;
  cols: number;
}

export const clampCell = (c: Cell, d: Dims): Cell => ({
  row: Math.max(0, Math.min(d.rows - 1, c.row)),
  col: Math.max(0, Math.min(d.cols - 1, c.col)),
});

/** The rectangle between the anchor and the active cell. */
export function rangeOf(anchor: Cell, active: Cell): Range {
  return {
    top: Math.min(anchor.row, active.row),
    bottom: Math.max(anchor.row, active.row),
    left: Math.min(anchor.col, active.col),
    right: Math.max(anchor.col, active.col),
  };
}

export const inRange = (r: Range, c: Cell) => c.row >= r.top && c.row <= r.bottom && c.col >= r.left && c.col <= r.right;
export const rangeSize = (r: Range) => (r.bottom - r.top + 1) * (r.right - r.left + 1);

/**
 * Where a key moves the active cell (Excel): arrows, Tab / Shift+Tab (wrapping
 * to the next / previous row), Home / End within the row, Ctrl+Home /
 * Ctrl+End to the first / last cell, Ctrl+arrows to the edge, PageUp /
 * PageDown by a page. Null when the key is not a movement.
 */
export function moveFrom(c: Cell, key: string, d: Dims, opts: { ctrl?: boolean; shift?: boolean; page?: number } = {}): Cell | null {
  if (d.rows === 0 || d.cols === 0) return null;
  const page = opts.page ?? 10;
  switch (key) {
    case "ArrowUp":
      return clampCell({ row: opts.ctrl ? 0 : c.row - 1, col: c.col }, d);
    case "ArrowDown":
      return clampCell({ row: opts.ctrl ? d.rows - 1 : c.row + 1, col: c.col }, d);
    case "ArrowLeft":
      return clampCell({ row: c.row, col: opts.ctrl ? 0 : c.col - 1 }, d);
    case "ArrowRight":
      return clampCell({ row: c.row, col: opts.ctrl ? d.cols - 1 : c.col + 1 }, d);
    case "Home":
      return opts.ctrl ? { row: 0, col: 0 } : { row: c.row, col: 0 };
    case "End":
      return opts.ctrl ? { row: d.rows - 1, col: d.cols - 1 } : { row: c.row, col: d.cols - 1 };
    case "PageUp":
      return clampCell({ row: c.row - page, col: c.col }, d);
    case "PageDown":
      return clampCell({ row: c.row + page, col: c.col }, d);
    case "Tab": {
      if (opts.shift) return c.col > 0 ? { row: c.row, col: c.col - 1 } : c.row > 0 ? { row: c.row - 1, col: d.cols - 1 } : c;
      return c.col < d.cols - 1 ? { row: c.row, col: c.col + 1 } : c.row < d.rows - 1 ? { row: c.row + 1, col: 0 } : c;
    }
    default:
      return null;
  }
}

/**
 * Text from the clipboard as a block of cells. Excel copies tab-separated
 * rows ending in a newline; quoted cells may hold tabs, newlines and "".
 */
export function parseClipboard(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** A block of cells as Excel-ready text (tab-separated, quoted where needed). */
export function toClipboard(block: readonly (readonly string[])[]): string {
  const q = (s: string) => (/[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return block.map((r) => r.map(q).join("\t")).join("\n");
}

export interface CellChange {
  row: number;
  col: number;
  value: string;
}

/**
 * The cells a paste writes. A single value pasted over a selection fills the
 * whole selection; a block is written from the selection's top-left corner
 * and clipped to the grid. Cells that cannot be edited are skipped.
 */
export function pasteChanges(block: readonly (readonly string[])[], selection: Range, d: Dims, editable: (c: Cell) => boolean): CellChange[] {
  const out: CellChange[] = [];
  if (!block.length) return out;
  if (block.length === 1 && block[0].length === 1) {
    for (let r = selection.top; r <= selection.bottom; r++) for (let c = selection.left; c <= selection.right; c++) if (editable({ row: r, col: c })) out.push({ row: r, col: c, value: block[0][0] });
    return out;
  }
  block.forEach((cells, i) =>
    cells.forEach((value, j) => {
      const cell = { row: selection.top + i, col: selection.left + j };
      if (cell.row < d.rows && cell.col < d.cols && editable(cell)) out.push({ ...cell, value });
    })
  );
  return out;
}

/** Ctrl+D: the top row of the selection copied down through it (editable cells only). */
export function fillDownChanges(selection: Range, read: (c: Cell) => string, editable: (c: Cell) => boolean): CellChange[] {
  const out: CellChange[] = [];
  for (let c = selection.left; c <= selection.right; c++) {
    const value = read({ row: selection.top, col: c });
    for (let r = selection.top + 1; r <= selection.bottom; r++) if (editable({ row: r, col: c })) out.push({ row: r, col: c, value });
  }
  return out;
}

/** Undo / redo of applied change sets (each set stores the value before and after per cell). */
export interface AppliedChange {
  rowId: string;
  colId: string;
  before: unknown;
  after: unknown;
}

export class EditHistory {
  private done: AppliedChange[][] = [];
  private undone: AppliedChange[][] = [];

  constructor(private readonly limit = 100) {}

  push(set: AppliedChange[]) {
    const real = set.filter((c) => c.before !== c.after);
    if (!real.length) return;
    this.done.push(real);
    if (this.done.length > this.limit) this.done.shift();
    this.undone = [];
  }

  /** The changes to apply to undo the last set (after → before). */
  undo(): AppliedChange[] | null {
    const set = this.done.pop();
    if (!set) return null;
    this.undone.push(set);
    return set.map((c) => ({ ...c, before: c.after, after: c.before }));
  }

  redo(): AppliedChange[] | null {
    const set = this.undone.pop();
    if (!set) return null;
    this.done.push(set);
    return set;
  }

  get canUndo() {
    return this.done.length > 0;
  }

  get canRedo() {
    return this.undone.length > 0;
  }

  clear() {
    this.done = [];
    this.undone = [];
  }
}

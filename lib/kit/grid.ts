// DataGrid logic (roadmap 3.1), kept pure for unit tests.

export type SortDirection = "asc" | "desc";
export type SortState = { columnId: string; direction: SortDirection } | null;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const NUMERIC_TEXT = /^[+-]?\d[\d,]*(\.\d+)?$/;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
}

function toComparable(v: unknown): number | string {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "boolean") return v ? 1 : 0;
  const text = String(v).trim();
  // "4,52,300.00" and "-1,250" sort as numbers.
  if (NUMERIC_TEXT.test(text)) return Number(text.replace(/,/g, ""));
  return text;
}

/** Ascending comparison. Empty values always sort last (in both directions). */
export function compareValues(a: unknown, b: unknown): number {
  const ae = isEmpty(a);
  const be = isEmpty(b);
  if (ae || be) return ae === be ? 0 : ae ? 1 : -1;
  const x = toComparable(a);
  const y = toComparable(b);
  if (typeof x === "number" && typeof y === "number") return x - y;
  return collator.compare(String(x), String(y));
}

/** Stable sort; empty values stay at the bottom whichever way you sort. */
export function sortRows<T>(rows: readonly T[], getValue: (row: T) => unknown, direction: SortDirection): T[] {
  return rows
    .map((row, index) => ({ row, index, value: getValue(row) }))
    .sort((a, b) => {
      const ae = isEmpty(a.value);
      const be = isEmpty(b.value);
      if (ae || be) return ae === be ? a.index - b.index : ae ? 1 : -1;
      const c = compareValues(a.value, b.value);
      return (direction === "asc" ? c : -c) || a.index - b.index;
    })
    .map((r) => r.row);
}

/** Header click cycle: none → ascending → descending → none. */
export function nextSort(current: SortState, columnId: string): SortState {
  if (!current || current.columnId !== columnId) return { columnId, direction: "asc" };
  if (current.direction === "asc") return { columnId, direction: "desc" };
  return null;
}

/** Shift-click selection: everything between the anchor and the target. */
export function selectRange(orderedIds: readonly string[], anchorId: string | null, targetId: string, current: ReadonlySet<string>): Set<string> {
  const next = new Set(current);
  const to = orderedIds.indexOf(targetId);
  const from = anchorId ? orderedIds.indexOf(anchorId) : -1;
  if (to < 0) return next;
  if (from < 0) {
    next.add(targetId);
    return next;
  }
  const [lo, hi] = from < to ? [from, to] : [to, from];
  for (let i = lo; i <= hi; i++) next.add(orderedIds[i]);
  return next;
}

/** Header checkbox: select all visible rows, or clear them if all are selected. */
export function toggleAll(visibleIds: readonly string[], current: ReadonlySet<string>): Set<string> {
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => current.has(id));
  const next = new Set(current);
  for (const id of visibleIds) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}

export type CheckState = "none" | "some" | "all";
export function selectionState(visibleIds: readonly string[], current: ReadonlySet<string>): CheckState {
  const n = visibleIds.filter((id) => current.has(id)).length;
  return n === 0 ? "none" : n === visibleIds.length ? "all" : "some";
}

/** Keyboard row movement. Returns the new active row index. */
export function moveActiveRow(index: number, key: string, count: number, pageSize = 10): number {
  if (count <= 0) return -1;
  const clamp = (i: number) => Math.max(0, Math.min(count - 1, i));
  switch (key) {
    case "ArrowDown":
      return clamp(index + 1);
    case "ArrowUp":
      return clamp(index - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "PageDown":
      return clamp(index + pageSize);
    case "PageUp":
      return clamp(index - pageSize);
    default:
      return clamp(index);
  }
}

// ---- Persisted column preferences (UI only; never data) -------------------

export interface GridPrefs {
  widths: Record<string, number>;
  hidden: string[];
}

export const MIN_COL_WIDTH = 56;
export const MAX_COL_WIDTH = 720;

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return MIN_COL_WIDTH;
  return Math.round(Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, width)));
}

/** Parses stored prefs defensively: unknown columns and bad values are dropped. */
export function parseGridPrefs(raw: string | null, knownColumnIds: readonly string[]): GridPrefs {
  const empty: GridPrefs = { widths: {}, hidden: [] };
  if (!raw) return empty;
  try {
    const data = JSON.parse(raw) as Partial<GridPrefs>;
    const known = new Set(knownColumnIds);
    const widths: Record<string, number> = {};
    if (data.widths && typeof data.widths === "object") {
      for (const [id, w] of Object.entries(data.widths)) {
        if (known.has(id) && typeof w === "number") widths[id] = clampWidth(w);
      }
    }
    const hidden = Array.isArray(data.hidden) ? data.hidden.filter((id): id is string => typeof id === "string" && known.has(id)) : [];
    return { widths, hidden };
  } catch {
    return empty;
  }
}

/**
 * Sums money without float drift (0.1 + 0.2 problems) by working in paisa.
 * Non-numeric values are skipped.
 */
export function sumAmounts(values: readonly unknown[]): number {
  let paisa = 0;
  for (const v of values) {
    const n = typeof v === "number" ? v : typeof v === "string" && NUMERIC_TEXT.test(v.trim()) ? Number(v.replace(/,/g, "")) : NaN;
    if (Number.isFinite(n)) paisa += Math.round(n * 100);
  }
  return paisa / 100;
}

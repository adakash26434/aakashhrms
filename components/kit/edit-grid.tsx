"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import {
  EditHistory,
  fillDownChanges,
  inRange,
  moveFrom,
  parseClipboard,
  pasteChanges,
  rangeOf,
  toClipboard,
  type AppliedChange,
  type Cell,
  type CellChange,
} from "@/lib/kit/edit-grid";
import { usePopupPosition } from "./use-popup-position";
import { cn } from "@/lib/utils";

export interface EditGridColumn<R> {
  id: string;
  header: string;
  /** Header group shown above (e.g. "Allowances"). */
  group?: string;
  /** number: typed amount · choice: one of options · check: yes / no · readonly: worked out. */
  kind: "number" | "choice" | "check" | "readonly";
  width?: number;
  pinned?: boolean;
  align?: "left" | "right" | "center";
  options?: readonly { value: string; label: string }[];
  value: (row: R) => unknown;
  /** The value before any change, for the amber "changed" mark. */
  original?: (row: R) => unknown;
  format?: (value: unknown, row: R) => ReactNode;
  editable?: (row: R) => boolean;
  error?: (row: R) => string | undefined;
  warning?: (row: R) => string | undefined;
  /** Text shown in the header tooltip (how a worked-out column is calculated). */
  hint?: string;
}

export interface GridValueChange {
  rowId: string;
  colId: string;
  value: unknown;
}

const amountFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** Plain text of a cell value (what copy and the editor start from). */
function rawText(col: EditGridColumn<unknown>, v: unknown): string {
  if (col.kind === "check") return v ? "Yes" : "No";
  if (col.kind === "choice") return col.options?.find((o) => o.value === v)?.label ?? String(v ?? "");
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Text typed or pasted into a cell, as that column's value; an Error explains why not. */
function parseInput(col: EditGridColumn<unknown>, text: string): unknown | Error {
  const t = text.trim();
  if (col.kind === "number") {
    const clean = t.replace(/^npr\s*/i, "").replace(/,/g, "").replace(/\s/g, "");
    if (clean === "" || clean === "-") return 0;
    if (!/^-?\d+(\.\d+)?$/.test(clean)) return new Error(`"${text}" is not a number`);
    return Number(clean);
  }
  if (col.kind === "check") {
    const v = t.toLowerCase();
    if (["yes", "y", "1", "true", "x"].includes(v)) return true;
    if (["no", "n", "0", "false", ""].includes(v)) return false;
    return new Error("Use Yes or No");
  }
  if (col.kind === "choice") {
    const v = t.toLowerCase();
    const hit = col.options?.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v) ?? col.options?.find((o) => v && o.label.toLowerCase().startsWith(v));
    return hit ? hit.value : new Error(`Choose one of: ${col.options?.map((o) => o.label).join(", ")}`);
  }
  return new Error("This column is worked out");
}

/**
 * Spreadsheet table (4.4) for editing many records at once, with Excel's
 * conventions: arrows / Tab move, typing replaces, F2 or a double-click edits,
 * Enter saves and moves down, Esc cancels; Shift+arrows or drag select a
 * range; Ctrl+C / Ctrl+V copy and paste blocks to and from Excel; Ctrl+D
 * fills down; Delete clears; Ctrl+Z / Ctrl+Y undo and redo. Changed cells
 * get an amber mark (the old value in the tooltip), invalid ones a red frame.
 * The parent owns the values; every change arrives through onChange.
 */
export function EditGrid<R>({
  rows,
  getRowId,
  columns,
  onChange,
  onSelectRows,
  label,
  maxHeight = "calc(100vh - 360px)",
  empty,
  footer,
}: {
  rows: readonly R[];
  getRowId: (row: R) => string;
  columns: readonly EditGridColumn<R>[];
  onChange: (changes: GridValueChange[]) => void;
  /** Rows covered by the selection (for "apply to selected"). */
  onSelectRows?: (rowIds: string[]) => void;
  label: string;
  maxHeight?: string;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  const cols = columns as readonly EditGridColumn<unknown>[];
  const dims = { rows: rows.length, cols: columns.length };
  const [active, setActive] = useState<Cell>({ row: 0, col: 0 });
  const [anchor, setAnchor] = useState<Cell>({ row: 0, col: 0 });
  const [editing, setEditing] = useState<{ text: string; mode: "enter" | "edit" } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const history = useRef(new EditHistory());
  const [, setHistoryTick] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const activeCellRef = useRef<HTMLTableCellElement>(null);
  const dragging = useRef(false);

  const selection = rangeOf(anchor, active);
  const rowAt = (i: number) => rows[i];
  const colAt = (j: number) => cols[j];
  const editableAt = useCallback(
    (c: Cell) => {
      const col = cols[c.col];
      const row = rows[c.row];
      return !!col && !!row && col.kind !== "readonly" && (col.editable ? col.editable(row) : true);
    },
    [cols, rows]
  );

  // Keep the active cell inside the grid when rows or columns change.
  const safeActive = { row: Math.min(active.row, Math.max(0, dims.rows - 1)), col: Math.min(active.col, Math.max(0, dims.cols - 1)) };

  const pinnedOffsets = useMemo(() => {
    const offsets: number[] = [];
    let left = 0;
    columns.forEach((c, i) => {
      offsets[i] = left;
      if (c.pinned) left += c.width ?? 120;
    });
    return { offsets, total: left };
  }, [columns]);

  /** Apply typed / pasted / filled text to cells; records undo and reports problems. */
  const applyText = (changes: CellChange[], note?: string) => {
    const applied: AppliedChange[] = [];
    const problems: string[] = [];
    for (const ch of changes) {
      const col = colAt(ch.col);
      const row = rowAt(ch.row);
      if (!col || !row) continue;
      const parsed = parseInput(col, ch.value);
      if (parsed instanceof Error) {
        problems.push(`${col.header}: ${parsed.message}`);
        continue;
      }
      applied.push({ rowId: getRowId(row as R), colId: col.id, before: col.value(row), after: parsed });
    }
    commit(applied);
    setMessage(problems.length ? `${problems.length} cell${problems.length === 1 ? "" : "s"} not changed: ${problems[0]}` : note ?? null);
  };

  const commit = (applied: AppliedChange[]) => {
    const real = applied.filter((a) => a.before !== a.after);
    if (!real.length) return;
    history.current.push(real);
    setHistoryTick((t) => t + 1);
    onChange(real.map((a) => ({ rowId: a.rowId, colId: a.colId, value: a.after })));
  };

  const replay = (set: AppliedChange[] | null) => {
    if (!set) return;
    setHistoryTick((t) => t + 1);
    onChange(set.map((a) => ({ rowId: a.rowId, colId: a.colId, value: a.after })));
  };

  const moveTo = (c: Cell, extend = false) => {
    setActive(c);
    if (!extend) setAnchor(c);
  };

  // Report selected rows (for "apply to selected rows").
  useEffect(() => {
    if (!onSelectRows) return;
    const ids: string[] = [];
    for (let r = selection.top; r <= selection.bottom; r++) if (rows[r]) ids.push(getRowId(rows[r]));
    onSelectRows(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.top, selection.bottom, rows]);

  // Keep the active cell in view (scrolls the grid only, both ways, clear of the sticky header and pinned columns).
  useEffect(() => {
    const wrap = wrapRef.current;
    const cell = activeCellRef.current;
    if (!wrap || !cell) return;
    const header = wrap.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    const w = wrap.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    if (c.top < w.top + header) wrap.scrollTop -= w.top + header - c.top;
    else if (c.bottom > w.bottom) wrap.scrollTop += c.bottom - w.bottom;
    if (!columns[safeActive.col]?.pinned) {
      if (c.left < w.left + pinnedOffsets.total) wrap.scrollLeft -= w.left + pinnedOffsets.total - c.left;
      else if (c.right > w.right) wrap.scrollLeft += c.right - w.right;
    }
  }, [safeActive.row, safeActive.col, columns, pinnedOffsets.total]);

  const startEdit = (initial?: string) => {
    const col = colAt(safeActive.col);
    const row = rowAt(safeActive.row);
    if (!col || !row || !editableAt(safeActive)) {
      if (col?.kind === "readonly") setMessage(`${col.header} is worked out${col.hint ? `: ${col.hint}` : ""}`);
      return;
    }
    if (col.kind === "check") {
      commit([{ rowId: getRowId(row as R), colId: col.id, before: col.value(row), after: !col.value(row) }]);
      return;
    }
    setEditing(initial !== undefined ? { text: initial, mode: "enter" } : { text: rawText(col, col.value(row)), mode: "edit" });
  };

  const finishEdit = (move: string | null, shift = false, text?: string) => {
    if (!editing) return;
    applyText([{ row: safeActive.row, col: safeActive.col, value: text ?? editing.text }]);
    setEditing(null);
    if (move) {
      const next = moveFrom(safeActive, move, dims, { shift });
      if (next) moveTo(next);
    }
    requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));
  };

  const readCell = (c: Cell) => {
    const col = colAt(c.col);
    const row = rowAt(c.row);
    return col && row ? rawText(col, col.value(row)) : "";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing || dims.rows === 0) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    if (mod && key.toLowerCase() === "z") {
      e.preventDefault();
      replay(e.shiftKey ? history.current.redo() : history.current.undo());
      return;
    }
    if (mod && key.toLowerCase() === "y") {
      e.preventDefault();
      replay(history.current.redo());
      return;
    }
    if (mod && key.toLowerCase() === "a") {
      e.preventDefault();
      setAnchor({ row: 0, col: 0 });
      setActive({ row: dims.rows - 1, col: dims.cols - 1 });
      return;
    }
    if (mod && key.toLowerCase() === "c") {
      e.preventDefault();
      const block: string[][] = [];
      for (let r = selection.top; r <= selection.bottom; r++) {
        const line: string[] = [];
        for (let c = selection.left; c <= selection.right; c++) line.push(readCell({ row: r, col: c }));
        block.push(line);
      }
      void navigator.clipboard?.writeText(toClipboard(block)).catch(() => {});
      setMessage(`Copied ${block.length} × ${block[0]?.length ?? 0} cells`);
      return;
    }
    if (mod && key.toLowerCase() === "d") {
      e.preventDefault();
      applyText(fillDownChanges(selection, readCell, editableAt));
      return;
    }
    const moved = moveFrom(safeActive, key, dims, { ctrl: mod, shift: e.shiftKey });
    if (moved) {
      e.preventDefault();
      moveTo(moved, e.shiftKey && key !== "Tab");
      return;
    }
    if (key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) moveTo(moveFrom(safeActive, "ArrowUp", dims)!);
      else if (colAt(safeActive.col)?.kind === "check") startEdit();
      else moveTo(moveFrom(safeActive, "ArrowDown", dims)!);
      return;
    }
    if (key === "F2") {
      e.preventDefault();
      startEdit();
      return;
    }
    if (key === " " && colAt(safeActive.col)?.kind === "check") {
      e.preventDefault();
      startEdit();
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      e.preventDefault();
      const changes: CellChange[] = [];
      for (let r = selection.top; r <= selection.bottom; r++)
        for (let c = selection.left; c <= selection.right; c++) {
          const col = colAt(c);
          if (editableAt({ row: r, col: c }) && col && col.kind !== "choice") changes.push({ row: r, col: c, value: col.kind === "check" ? "No" : "0" });
        }
      applyText(changes);
      return;
    }
    if (key === "Escape") {
      setAnchor(safeActive);
      setMessage(null);
      return;
    }
    if (key.length === 1 && !mod && !e.altKey) {
      e.preventDefault();
      startEdit(key);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editing) return;
    e.preventDefault();
    const block = parseClipboard(e.clipboardData.getData("text/plain"));
    const changes = pasteChanges(block, selection, dims, editableAt);
    applyText(changes, changes.length > 1 ? `Pasted ${changes.length} cells` : undefined);
    if (block.length > 1 || (block[0]?.length ?? 0) > 1) {
      const bottom = Math.min(dims.rows - 1, selection.top + block.length - 1);
      const right = Math.min(dims.cols - 1, selection.left + (block[0]?.length ?? 1) - 1);
      setAnchor({ row: selection.top, col: selection.left });
      setActive({ row: bottom, col: right });
    }
  };

  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const groups = useMemo(() => {
    const out: { label: string; span: number; pinned: boolean }[] = [];
    columns.forEach((c) => {
      const label = c.group ?? "";
      const last = out[out.length - 1];
      if (last && last.label === label && last.pinned === !!c.pinned) last.span++;
      else out.push({ label, span: 1, pinned: !!c.pinned });
    });
    return out.some((g) => g.label) ? out : null;
  }, [columns]);

  const activeCol = colAt(safeActive.col);
  const activeRow = rowAt(safeActive.row);
  const activeError = activeCol && activeRow ? activeCol.error?.(activeRow) : undefined;
  const activeWarning = activeCol && activeRow ? activeCol.warning?.(activeRow) : undefined;

  if (!rows.length) return <div className="rounded-md border border-line bg-surface p-8 text-center text-sm text-ink-muted">{empty ?? "No rows"}</div>;

  return (
    <div className="rounded-md border border-line-card bg-surface shadow-sm">
      <div
        ref={gridRef}
        role="grid"
        aria-label={label}
        aria-rowcount={rows.length}
        aria-colcount={columns.length}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        <div ref={wrapRef} className="overflow-auto scroll-thin" style={{ maxHeight }}>
          <table className="border-separate border-spacing-0 text-sm tabular-nums">
            <thead className="sticky top-0 z-20">
              {groups && (
                <tr>
                  {groups.map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.span}
                      className={cn(
                        "border-b border-r border-line bg-surface-sunken px-2 py-1 text-left text-3xs font-semibold uppercase tracking-wide text-ink-faint",
                        g.pinned && "sticky left-0 z-30"
                      )}
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
              )}
              <tr>
                {columns.map((c, j) => (
                  <th
                    key={c.id}
                    scope="col"
                    title={c.hint}
                    style={{ width: c.width ?? 120, minWidth: c.width ?? 120, left: c.pinned ? pinnedOffsets.offsets[j] : undefined }}
                    className={cn(
                      "border-b border-r border-line-strong bg-surface-sunken px-2 py-1.5 text-2xs font-semibold text-ink-muted",
                      c.align === "left" || c.kind === "choice" ? "text-left" : c.kind === "check" ? "text-center" : "text-right",
                      c.pinned && "sticky z-30",
                      c.pinned && !columns[j + 1]?.pinned && "border-r-line-strong",
                      j === safeActive.col && "bg-brand-subtle text-brand-strong"
                    )}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={getRowId(row)} aria-rowindex={i + 1}>
                  {cols.map((c, j) => {
                    const cell = { row: i, col: j };
                    const isActive = i === safeActive.row && j === safeActive.col;
                    const selected = inRange(selection, cell) && (selection.top !== selection.bottom || selection.left !== selection.right);
                    const value = c.value(row);
                    const changed = c.original ? c.original(row) !== value : false;
                    const error = c.error?.(row);
                    const warning = c.warning?.(row);
                    const editable = editableAt(cell);
                    return (
                      <td
                        key={c.id}
                        ref={isActive ? activeCellRef : undefined}
                        role="gridcell"
                        aria-selected={isActive || selected}
                        aria-readonly={!editable || undefined}
                        aria-invalid={error ? true : undefined}
                        title={error ?? warning ?? (changed ? `Was: ${rawText(c, c.original?.(row))}` : c.hint)}
                        style={{ width: c.width ?? 120, minWidth: c.width ?? 120, left: c.pinned ? pinnedOffsets.offsets[j] : undefined }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          if (editing) finishEdit(null);
                          dragging.current = true;
                          moveTo(cell, e.shiftKey);
                          gridRef.current?.focus({ preventScroll: true });
                        }}
                        onMouseEnter={() => dragging.current && setActive(cell)}
                        onDoubleClick={() => startEdit()}
                        className={cn(
                          "relative h-8 border-b border-r border-line px-2 py-0",
                          c.align === "left" ? "text-left" : c.align === "center" || c.kind === "check" ? "text-center" : c.kind === "number" || c.kind === "readonly" ? "text-right" : "text-left",
                          c.pinned && !columns[j + 1]?.pinned && "border-r-line-strong",
                          !editable ? "bg-surface-sunken/60 text-ink-muted" : "bg-surface text-ink",
                          c.pinned && "sticky z-10 font-medium",
                          c.pinned && editable === false && "bg-surface",
                          selected && "bg-brand-subtle/70",
                          changed && !error && "bg-warning-subtle/50 shadow-[inset_3px_0_0_var(--color-warning)]",
                          warning && !error && !changed && "shadow-[inset_3px_0_0_var(--color-warning)]",
                          error && "bg-danger-subtle/50 shadow-[inset_0_0_0_1.5px_var(--color-danger)]",
                          isActive && "z-[15] shadow-[inset_0_0_0_2px_var(--color-brand)]"
                        )}
                      >
                        {isActive && editing ? (
                          <CellEditor col={c} text={editing.text} mode={editing.mode} cellRef={activeCellRef} onText={(t) => setEditing({ ...editing, text: t })} onDone={finishEdit} onCancel={() => {
                            setEditing(null);
                            requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));
                          }} />
                        ) : c.kind === "check" ? (
                          <span
                            aria-hidden
                            onMouseDown={(e) => {
                              if (!editable) return;
                              e.stopPropagation();
                              moveTo(cell);
                              commit([{ rowId: getRowId(row), colId: c.id, before: value, after: !value }]);
                              gridRef.current?.focus({ preventScroll: true });
                            }}
                            className={cn(
                              "mx-auto flex h-4 w-4 items-center justify-center rounded border",
                              value ? "border-brand bg-brand text-white" : "border-line-input bg-white",
                              editable ? "cursor-pointer" : "opacity-50"
                            )}
                          >
                            {value ? <Check className="h-3 w-3" /> : null}
                          </span>
                        ) : (
                          <span className="block truncate">
                            {c.format ? c.format(value, row) : c.kind === "number" ? (Number(value) ? amountFormat.format(Number(value)) : <span className="text-ink-faint">—</span>) : typeof value === "number" ? amountFormat.format(value) : rawText(c, value)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-sunken px-3 py-1.5 text-2xs text-ink-muted" aria-live="polite">
        <span className="font-medium text-ink">
          {activeCol?.header}
          {activeRow && ` · row ${safeActive.row + 1}`}
        </span>
        {activeError ? <span className="text-danger">{activeError}</span> : activeWarning ? <span className="text-warning">{activeWarning}</span> : null}
        {message && <span className="text-ink">{message}</span>}
        <span className="ml-auto hidden @min-[48rem]:inline">
          Type to replace · F2 edit · Ctrl+D fill down · Ctrl+C / Ctrl+V with Excel · Ctrl+Z undo
        </span>
        {footer}
      </div>
    </div>
  );
}

/** The text box (or choice list) for the cell being edited. */
function CellEditor<R>({
  col,
  text,
  mode,
  cellRef,
  onText,
  onDone,
  onCancel,
}: {
  col: EditGridColumn<R>;
  text: string;
  mode: "enter" | "edit";
  cellRef: React.RefObject<HTMLTableCellElement | null>;
  onText: (t: string) => void;
  onDone: (move: string | null, shift?: boolean, text?: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Saving closes the editor; the blur that follows must not save again.
  const done = useRef(false);
  const finish = (move: string | null, shift?: boolean, override?: string) => {
    if (done.current) return;
    done.current = true;
    onDone(move, shift, override);
  };
  const options = col.kind === "choice" ? (col.options ?? []) : [];
  const listStyle = usePopupPosition(cellRef, options.length > 0, { height: options.length * 28 + 8, matchWidth: true, gap: 1 });
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (mode === "edit") el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  }, [mode]);
  return (
    <>
      <input
        ref={inputRef}
        value={text}
        aria-label={`Edit ${col.header}`}
        onChange={(e) => onText(e.target.value)}
        onBlur={() => finish(null)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            finish(e.shiftKey ? "ArrowUp" : "ArrowDown");
          } else if (e.key === "Tab") {
            e.preventDefault();
            finish("Tab", e.shiftKey);
          } else if (e.key === "Escape") {
            e.preventDefault();
            done.current = true;
            onCancel();
          } else if (mode === "enter" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            // Started by typing: arrows save and move (Excel's Enter mode); after F2 they move the caret.
            e.preventDefault();
            finish(e.key);
          }
        }}
        className={cn("absolute inset-0 h-full w-full bg-white px-2 text-sm text-ink outline-none", col.kind === "number" ? "text-right" : "text-left")}
      />
      {options.length > 0 && (
        <ul role="listbox" style={listStyle} className="fixed z-[90] rounded-md border border-line-strong bg-surface py-1 text-left shadow-lg">
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.label.toLowerCase().startsWith(text.trim().toLowerCase()) && text.trim() !== ""}
              onMouseDown={(e) => {
                e.preventDefault();
                finish(null, false, o.label);
              }}
              className="cursor-pointer px-2.5 py-1 text-sm hover:bg-brand-subtle"
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Copy, Download, RotateCcw } from "lucide-react";
import { authorizeExportAction, type ExportModule } from "@/app/actions/export.actions";
import { toCsv, toTsv, safeFilename, type CsvValue } from "@/lib/export/csv";
import { downloadTextFile } from "@/lib/export/download";
import { formatAmount } from "@/lib/kit/amount";
import { ROW_HEIGHT, useDensity } from "@/lib/kit/density";
import {
  clampWidth,
  MAX_COL_WIDTH,
  MIN_COL_WIDTH,
  moveActiveRow,
  nextSort,
  parseGridPrefs,
  selectRange,
  selectionState,
  sortRows,
  sumAmounts,
  toggleAll,
  type GridPrefs,
  type SortState,
} from "@/lib/kit/grid";
import { cn } from "@/lib/utils";
import { Amount } from "./amount";
import { DateCell } from "./date-cell";
import { EmptyState, ErrorState } from "./empty-state";
import { GridSkeleton } from "./skeleton";
import { StatusChip } from "./status-chip";

export type ColumnType = "text" | "amount" | "number" | "date" | "code" | "status";

export interface GridColumn<T> {
  id: string;
  header: string;
  /** Raw value: used for sorting, totals, copy and export. */
  value?: (row: T) => unknown;
  /** Custom cell; defaults to a type-aware rendering of `value`. */
  cell?: (row: T) => ReactNode;
  type?: ColumnType;
  align?: "left" | "right" | "center";
  width?: number;
  sortable?: boolean;
  /** Can the user hide it? (default true; the first column never hides). */
  hideable?: boolean;
  defaultHidden?: boolean;
  /** Pin to the left while scrolling sideways (leading columns only). */
  sticky?: boolean;
  /** Footer total: sum the values, or render something custom. */
  total?: "sum" | ((rows: T[]) => ReactNode);
}

export type RowTone = "warning" | "danger" | "success" | "info";

export interface DataGridProps<T> {
  /** Stable id: column widths and visibility are remembered per grid. */
  id: string;
  /** Accessible name, e.g. "Employees". */
  label: string;
  columns: GridColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: { message: string; reference?: string; onRetry?: () => void } | null;
  empty?: { title: string; description?: string; action?: ReactNode };
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Enter / double-click. */
  onOpen?: (row: T) => void;
  /** Highlighted row (e.g. the record shown in a SplitView detail pane). */
  activeRowId?: string | null;
  onActiveRowChange?: (row: T) => void;
  /** Status edge (E9): a coloured left edge for rows that need attention. */
  rowTone?: (row: T) => RowTone | undefined;
  defaultSort?: SortState;
  /** Rows per page; 0 shows everything. */
  pageSize?: number;
  /** Left side of the grid header bar (filters, counts). */
  toolbar?: ReactNode;
  /** Enables the audited CSV export of the visible columns and filtered rows. */
  exportModule?: ExportModule;
  exportName?: string;
  /** Max height of the scroll area (sticky header inside). */
  maxHeight?: string;
}

const DEFAULT_WIDTH: Record<ColumnType, number> = { text: 180, amount: 130, number: 90, date: 112, code: 110, status: 120 };
const SELECT_COL_WIDTH = 36;
const PREFS_EVENT = "aakash:grid-prefs";

function prefsKey(id: string) {
  return `aakash.grid.${id}`;
}

function readPrefsRaw(id: string): string {
  try {
    return localStorage.getItem(prefsKey(id)) ?? "";
  } catch {
    return "";
  }
}

function usePersistedPrefs(id: string, columnIds: string[]): [GridPrefs, (next: GridPrefs | null) => void, boolean] {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener(PREFS_EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(PREFS_EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => readPrefsRaw(id),
    () => ""
  );
  const key = columnIds.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prefs = useMemo(() => parseGridPrefs(raw || null, columnIds), [raw, key]);
  const save = useCallback(
    (next: GridPrefs | null) => {
      try {
        if (next) localStorage.setItem(prefsKey(id), JSON.stringify(next));
        else localStorage.removeItem(prefsKey(id));
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event(PREFS_EVENT));
    },
    [id]
  );
  return [prefs, save, raw !== ""];
}

function alignOf<T>(c: GridColumn<T>): "left" | "right" | "center" {
  if (c.align) return c.align;
  return c.type === "amount" || c.type === "number" ? "right" : "left";
}

function renderCell<T>(c: GridColumn<T>, row: T): ReactNode {
  if (c.cell) return c.cell(row);
  const v = c.value?.(row);
  switch (c.type) {
    case "amount":
      return <Amount value={v as number | string | null} />;
    case "date":
      return <DateCell value={v as Date | string | null} />;
    case "status":
      return <StatusChip status={v as string} />;
    case "code":
      return <span className="text-ink-muted">{v === null || v === undefined || v === "" ? "—" : String(v)}</span>;
    default:
      return v === null || v === undefined || v === "" ? <span className="text-ink-faint">—</span> : String(v);
  }
}

function exportValue<T>(c: GridColumn<T>, row: T): CsvValue {
  const v = c.value?.(row);
  if (v === null || v === undefined) return "";
  if (v instanceof Date || typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  return String(v);
}

const TONE_EDGE: Record<RowTone, string> = {
  warning: "before:bg-warning",
  danger: "before:bg-danger",
  success: "before:bg-success",
  info: "before:bg-info",
};

/**
 * DataGrid (3.1) — the register table for every module.
 * Keyboard: ↑↓ PgUp PgDn Home End move · Shift+↑↓ extend selection · Space
 * select · Ctrl+A select all · Enter open · Ctrl+C copy rows (Excel-safe) ·
 * Esc clear selection.
 */
export function DataGrid<T>({
  id,
  label,
  columns,
  rows,
  getRowId,
  loading,
  error,
  empty,
  selectable,
  selected: selectedProp,
  onSelectedChange,
  onOpen,
  activeRowId,
  onActiveRowChange,
  rowTone,
  defaultSort = null,
  pageSize: initialPageSize = 50,
  toolbar,
  exportModule,
  exportName,
  maxHeight = "calc(100vh - 260px)",
}: DataGridProps<T>) {
  const [density] = useDensity();
  const rowHeight = ROW_HEIGHT[density];
  const columnIds = columns.map((c) => c.id);
  const [prefs, savePrefs, hasSavedPrefs] = usePersistedPrefs(id, columnIds);
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const selected = selectedProp ?? internalSelected;
  const setSelected = (next: Set<string>) => (onSelectedChange ? onSelectedChange(next) : setInternalSelected(next));
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [liveDraft, setLiveDraft] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Visible columns (first column can never be hidden).
  const hiddenIds = new Set(hasSavedPrefs ? prefs.hidden : columns.filter((c) => c.defaultHidden).map((c) => c.id));
  const visible = columns.filter((c, i) => i === 0 || !hiddenIds.has(c.id));
  const widthOf = (c: GridColumn<T>) => liveDraft[c.id] ?? prefs.widths[c.id] ?? c.width ?? DEFAULT_WIDTH[c.type ?? "text"];

  // Sort → page.
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.columnId);
    return col?.value ? sortRows(rows, col.value, sort.direction) : rows;
  }, [rows, sort, columns]);
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = pageSize > 0 ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;
  const pageIds = pageRows.map(getRowId);
  const activeIndex = Math.min(focusIndex, Math.max(0, pageRows.length - 1));

  // Sticky offsets for pinned leading columns.
  const stickyLeft: Record<string, number> = {};
  {
    let left = selectable ? SELECT_COL_WIDTH : 0;
    for (const c of visible) {
      if (!c.sticky) break;
      stickyLeft[c.id] = left;
      left += widthOf(c);
    }
  }
  // Freeze-pane divider on the last pinned column (content scrolls under it).
  const lastStickyId = Object.keys(stickyLeft).at(-1);
  const FREEZE_EDGE = "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-line-strong";

  // Close the column menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(t);
  }, [notice]);

  const focusRow = (index: number) => {
    setFocusIndex(index);
    requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)?.focus());
    const row = pageRows[index];
    if (row && onActiveRowChange) onActiveRowChange(row);
  };

  const toggleRow = (rowId: string, shift: boolean) => {
    if (shift && anchorId) {
      setSelected(selectRange(pageIds, anchorId, rowId, selected));
    } else {
      const next = new Set(selected);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      setSelected(next);
      setAnchorId(rowId);
    }
  };

  const copyRows = async () => {
    const targetRows = selected.size > 0 ? sorted.filter((r) => selected.has(getRowId(r))) : pageRows[activeIndex] ? [pageRows[activeIndex]] : [];
    if (targetRows.length === 0) return;
    const tsv = toTsv([visible.map((c) => c.header), ...targetRows.map((r) => visible.map((c) => exportValue(c, r)))]);
    try {
      await navigator.clipboard.writeText(tsv);
      setNotice(`Copied ${targetRows.length} row${targetRows.length === 1 ? "" : "s"} — paste into Excel`);
    } catch {
      setNotice("Copy is blocked by the browser");
    }
  };

  const exportCsv = async () => {
    if (!exportModule) return;
    const name = exportName ?? label;
    const gate = await authorizeExportAction({ module: exportModule, label: `${name} (CSV)`, rowCount: sorted.length });
    if (!gate.allowed) {
      setNotice(gate.error ?? "Export not allowed");
      return;
    }
    const csv = toCsv(
      visible.map((c) => ({ header: c.header, value: (r: T) => exportValue(c, r) })),
      sorted
    );
    downloadTextFile(`${safeFilename(name)}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setNotice(`Exported ${sorted.length} ${sorted.length === 1 ? "row" : "rows"}`);
  };

  const onBodyKeyDown = (e: React.KeyboardEvent) => {
    const row = pageRows[activeIndex];
    const ctrl = e.ctrlKey || e.metaKey;
    if (["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(e.key)) {
      e.preventDefault();
      const next = moveActiveRow(activeIndex, e.key, pageRows.length);
      if (e.shiftKey && selectable && row) {
        const from = anchorId ?? getRowId(row);
        setAnchorId(from);
        setSelected(selectRange(pageIds, from, pageIds[next], selected));
      }
      focusRow(next);
    } else if (e.key === " " && selectable && row) {
      e.preventDefault();
      toggleRow(getRowId(row), e.shiftKey);
    } else if (e.key === "Enter" && row && onOpen) {
      e.preventDefault();
      onOpen(row);
    } else if (ctrl && e.key.toLowerCase() === "a" && selectable) {
      e.preventDefault();
      setSelected(new Set([...selected, ...sorted.map(getRowId)]));
    } else if (ctrl && e.key.toLowerCase() === "c") {
      e.preventDefault();
      void copyRows();
    } else if (e.key === "Escape" && selected.size > 0) {
      e.preventDefault();
      setSelected(new Set());
    }
  };

  // ---- Column resize (pointer + keyboard) --------------------------------
  const startResize = (c: GridColumn<T>, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widthOf(c);
    const onMove = (ev: PointerEvent) => setLiveDraft({ [c.id]: clampWidth(startWidth + ev.clientX - startX) });
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setLiveDraft({});
      savePrefs({ hidden: [...hiddenIds], widths: { ...prefs.widths, [c.id]: clampWidth(startWidth + ev.clientX - startX) } });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const keyResize = (c: GridColumn<T>, e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 48 : 16);
    savePrefs({ hidden: [...hiddenIds], widths: { ...prefs.widths, [c.id]: clampWidth(widthOf(c) + delta) } });
  };

  const resetWidth = (c: GridColumn<T>) => {
    const widths = { ...prefs.widths };
    delete widths[c.id];
    savePrefs({ hidden: [...hiddenIds], widths });
  };

  const toggleColumn = (columnId: string) => {
    const next = new Set(hiddenIds);
    if (next.has(columnId)) next.delete(columnId);
    else next.add(columnId);
    savePrefs({ ...prefs, hidden: [...next] });
  };

  const totalsVisible = visible.some((c) => c.total);
  const checkState = selectionState(pageIds, selected);
  const tableWidth = visible.reduce((sum, c) => sum + widthOf(c), selectable ? SELECT_COL_WIDTH : 0);

  // ---- Header bar ---------------------------------------------------------
  const headerBar = (
    <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-1.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
      {selectable && selected.size > 0 && (
        <span className="rounded-md bg-selection px-2 py-0.5 text-2xs font-medium text-brand-strong tabular-nums">
          {selected.size} selected
          <button type="button" className="ml-1.5 underline-offset-2 hover:underline cursor-pointer" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </span>
      )}
      <span className="text-2xs text-ink-faint tabular-nums">{sorted.length.toLocaleString("en-IN")} {sorted.length === 1 ? "row" : "rows"}</span>
      <button type="button" onClick={() => void copyRows()} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer" title="Copy selected rows (Ctrl C)">
        <Copy className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Copy</span>
      </button>
      {exportModule && (
        <button type="button" onClick={() => void exportCsv()} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer" title="Export the visible columns as CSV">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      )}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer"
        >
          <Columns3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Columns</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-line bg-surface p-1.5 shadow-lg">
            <p className="px-2 pb-1 pt-0.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">Show columns</p>
            <div className="max-h-64 overflow-y-auto">
              {columns.map((c, i) => (
                <label key={c.id} className={cn("flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink hover:bg-surface-sunken", (i === 0 || c.hideable === false) && "opacity-50")}>
                  <input type="checkbox" checked={i === 0 || !hiddenIds.has(c.id)} disabled={i === 0 || c.hideable === false} onChange={() => toggleColumn(c.id)} />
                  {c.header}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                savePrefs(null);
                setMenuOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-ink-muted hover:bg-surface-sunken cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset widths and columns
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {headerBar}
        <GridSkeleton rows={8} columns={Math.min(visible.length, 7)} rowHeight={rowHeight} />
      </div>
    );
  }

  const cellPad = density === "compact" ? "px-2.5" : "px-3";

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {headerBar}
      {error ? (
        <ErrorState message={error.message} reference={error.reference} onRetry={error.onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState title={empty?.title ?? "Nothing here yet"} description={empty?.description} action={empty?.action} />
      ) : (
        <div className="overflow-auto" style={{ maxHeight }}>
          <table
            role="grid"
            aria-label={label}
            aria-rowcount={sorted.length + 1}
            aria-multiselectable={selectable || undefined}
            className="border-separate border-spacing-0 text-sm"
            style={{ tableLayout: "fixed", width: Math.max(tableWidth, 0), minWidth: "100%" }}
          >
            <colgroup>
              {selectable && <col style={{ width: SELECT_COL_WIDTH }} />}
              {visible.map((c) => (
                <col key={c.id} style={{ width: widthOf(c) }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr>
                {selectable && (
                  <th scope="col" className="sticky left-0 z-10 bg-surface-sunken px-2" style={{ height: rowHeight + 2 }}>
                    <input
                      type="checkbox"
                      aria-label={checkState === "all" ? "Deselect all rows on this page" : "Select all rows on this page"}
                      checked={checkState === "all"}
                      ref={(el) => {
                        if (el) el.indeterminate = checkState === "some";
                      }}
                      onChange={() => setSelected(toggleAll(pageIds, selected))}
                    />
                  </th>
                )}
                {visible.map((c) => {
                  const align = alignOf(c);
                  const sortable = c.sortable ?? Boolean(c.value);
                  const isSorted = sort?.columnId === c.id;
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={isSorted ? (sort!.direction === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined}
                      className={cn("group relative bg-surface-sunken text-left", c.id in stickyLeft && "sticky z-10", c.id === lastStickyId && FREEZE_EDGE)}
                      style={{ height: rowHeight + 2, left: stickyLeft[c.id] }}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSort(nextSort(sort, c.id));
                            setPage(0);
                          }}
                          className={cn(
                            "flex h-full w-full items-center gap-1 uppercase hover:text-ink cursor-pointer",
                            cellPad,
                            align === "right" && "flex-row-reverse text-right",
                            align === "center" && "justify-center"
                          )}
                        >
                          <span className="truncate">{c.header}</span>
                          {isSorted ? (
                            sort!.direction === "asc" ? <ArrowUp className="h-3 w-3 shrink-0 text-brand" /> : <ArrowDown className="h-3 w-3 shrink-0 text-brand" />
                          ) : (
                            <ArrowUp className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-30" />
                          )}
                        </button>
                      ) : (
                        <span className={cn("block truncate uppercase", cellPad, align === "right" && "text-right")}>{c.header}</span>
                      )}
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${c.header}`}
                        aria-valuenow={widthOf(c)}
                        aria-valuemin={MIN_COL_WIDTH}
                        aria-valuemax={MAX_COL_WIDTH}
                        title="Drag to resize · double-click to reset"
                        tabIndex={0}
                        onPointerDown={(e) => startResize(c, e)}
                        onKeyDown={(e) => keyResize(c, e)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          resetWidth(c);
                        }}
                        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none bg-transparent hover:bg-brand/40 focus-visible:bg-brand/60 focus-visible:outline-none"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody ref={bodyRef} onKeyDown={onBodyKeyDown}>
              {pageRows.map((row, index) => {
                const rowId = getRowId(row);
                const isSelected = selected.has(rowId);
                const isActive = activeRowId === rowId;
                const tone = rowTone?.(row);
                return (
                  <tr
                    key={rowId}
                    data-row-index={index}
                    aria-rowindex={safePage * pageSize + index + 2}
                    aria-selected={selectable ? isSelected : undefined}
                    tabIndex={index === activeIndex ? 0 : -1}
                    onFocus={() => setFocusIndex(index)}
                    onClick={(e) => {
                      setFocusIndex(index);
                      onActiveRowChange?.(row);
                      if (selectable && (e.ctrlKey || e.metaKey || e.shiftKey)) toggleRow(rowId, e.shiftKey);
                    }}
                    onDoubleClick={() => onOpen?.(row)}
                    className={cn(
                      "group/row outline-none focus-visible:[&>td]:shadow-[inset_0_1px_0_var(--focus),inset_0_-1px_0_var(--focus)]",
                      isSelected || isActive ? "[&>td]:bg-selection" : "hover:[&>td]:bg-surface-sunken",
                      onOpen && "cursor-default"
                    )}
                  >
                    {selectable && (
                      <td className="sticky left-0 z-[1] border-b border-line bg-surface px-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select row ${index + 1}`} checked={isSelected} onChange={(e) => toggleRow(rowId, (e.nativeEvent as MouseEvent).shiftKey)} tabIndex={-1} />
                      </td>
                    )}
                    {visible.map((c, ci) => {
                      const align = alignOf(c);
                      return (
                        <td
                          key={c.id}
                          className={cn(
                            "truncate border-b border-line bg-surface",
                            cellPad,
                            align === "right" && "text-right",
                            align === "center" && "text-center",
                            ci === 0 && tone && cn("relative before:absolute before:inset-y-0 before:left-0 before:w-[3px]", TONE_EDGE[tone]),
                            // After the tone classes: tailwind-merge keeps the last position utility,
                            // and a frozen cell must stay sticky (sticky also anchors the edge marker).
                            c.id in stickyLeft && "sticky z-[1]",
                            c.id === lastStickyId && FREEZE_EDGE
                          )}
                          style={{ height: rowHeight, left: stickyLeft[c.id] }}
                        >
                          {renderCell(c, row)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {totalsVisible && (
              <tfoot className="sticky bottom-0 z-20">
                <tr>
                  {selectable && <td className="sticky left-0 border-t border-line-strong bg-surface-sunken" />}
                  {visible.map((c, ci) => {
                    const align = alignOf(c);
                    let content: ReactNode = null;
                    if (typeof c.total === "function") content = c.total(sorted);
                    else if (c.total === "sum" && c.value) {
                      const total = sumAmounts(sorted.map(c.value));
                      content = c.type === "amount" ? <Amount value={total} emphasis /> : <span className="font-semibold tabular-nums">{formatAmount(total, { decimals: 0 })}</span>;
                    } else if (ci === 0) content = <span className="text-2xs font-semibold uppercase tracking-wider text-ink-muted" title={`Totals of ${sorted.length} rows`}>Total</span>;
                    return (
                      <td
                        key={c.id}
                        className={cn("truncate border-t border-line-strong bg-surface-sunken", cellPad, align === "right" && "text-right", c.id in stickyLeft && "sticky", c.id === lastStickyId && FREEZE_EDGE)}
                        style={{ height: rowHeight + 2, left: stickyLeft[c.id] }}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Footer: paging + live notices */}
      {!error && rows.length > 0 && (
        <div className="flex min-h-9 flex-wrap items-center gap-3 border-t border-line bg-surface px-3 py-1 text-2xs text-ink-muted">
          <span aria-live="polite" className="min-w-0 flex-1 truncate text-brand-strong">
            {notice}
          </span>
          {pageSize > 0 && sorted.length > pageSize && (
            <>
              <span className="tabular-nums">
                {(safePage * pageSize + 1).toLocaleString("en-IN")}–{Math.min(sorted.length, (safePage + 1) * pageSize).toLocaleString("en-IN")} of{" "}
                {sorted.length.toLocaleString("en-IN")}
              </span>
              <div className="flex items-center gap-0.5">
                <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-sunken disabled:opacity-40 cursor-pointer" aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="tabular-nums">
                  {safePage + 1} / {pageCount}
                </span>
                <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-sunken disabled:opacity-40 cursor-pointer" aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          {pageSize > 0 && (
            <label className="flex items-center gap-1.5">
              Rows
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="h-7 rounded-md border border-line bg-surface px-1.5 text-2xs text-ink"
              >
                {[25, 50, 100, 250].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

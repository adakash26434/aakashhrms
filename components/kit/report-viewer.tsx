"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FileSpreadsheet, FileText, Printer, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import type { ToolbarAction } from "@/components/frame/command-toolbar";
import { WindowButton } from "@/components/kit/window";
import { EmptyState } from "@/components/kit/empty-state";
import { authorizeExportAction, type ExportModule } from "@/app/actions/export.actions";
import { buildXlsx, XLSX_MIME, type XlsxSheet } from "@/lib/export/xlsx";
import { downloadBytes, downloadTextFile } from "@/lib/export/download";
import { columnTotal, formatReportValue, isNumericColumn, type ReportColumn, type ReportGroup } from "@/lib/kit/report";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { ReportCompany } from "@/lib/types/report";
import { cn } from "@/lib/utils";

// Report viewer (4.11, template D, design system §5): parameters on the
// left, the report as A4 paper on the right, and Print / PDF · Excel · CSV in
// the page bar. What prints is exactly the paper; the files are built from
// the same columns (lib/kit/report.ts), after the server allows and audits
// the export (authorizeExportAction).

export type ReportOrientation = "portrait" | "landscape";
export type { ReportCompany };

/** One "label: value" on the letterhead's parameter line. */
export interface ReportMetaItem {
  label: string;
  value: string;
}

// A4 at 96 px per inch, the width the preview fits to.
const PAPER_PX: Record<ReportOrientation, number> = { portrait: 794, landscape: 1123 };

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

export function ReportViewer({
  title,
  description,
  status,
  orientation = "portrait",
  params,
  paramsSummary,
  onRun,
  running = false,
  runLabel = "Show report",
  ready,
  onPrint,
  excel,
  csv,
  exporting = false,
  exportNote,
  actions = [],
  notice,
  children,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  orientation?: ReportOrientation;
  /** The parameter fields (ReportParam). */
  params?: ReactNode;
  /** One line saying what is shown, for when the panel is hidden. */
  paramsSummary?: string;
  onRun?: () => void;
  running?: boolean;
  runLabel?: string;
  /** There is something to print and export. */
  ready: boolean;
  /** Before the print dialog (e.g. to switch to the printable layout). */
  onPrint?: () => void;
  /** Builds and saves the Excel file; leave out when the viewer may not export. */
  excel?: () => void;
  csv?: () => void;
  exporting?: boolean;
  /** Why Excel / CSV are not offered (shown as the disabled reason). */
  exportNote?: string;
  actions?: ToolbarAction[];
  notice?: ReactNode;
  children: ReactNode;
}) {
  const wide = useMediaQuery("(min-width: 1024px)", true);
  // Open beside the paper on a wide screen, folded on a phone (the report is shown first), until the viewer chooses.
  const [panelChoice, setPanelOpen] = useState<boolean | null>(null);
  const panelOpen = panelChoice ?? wide;
  const [zoomMode, setZoomMode] = useState<"fit" | "full">("fit");
  const [areaWidth, setAreaWidth] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);

  // The printed page follows the report's orientation (the named @page in globals.css).
  useEffect(() => {
    document.body.classList.toggle("print-landscape", orientation === "landscape");
    return () => document.body.classList.remove("print-landscape");
  }, [orientation]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAreaWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The paper plus its side margins (mx-3) must fit the preview area.
  const fit = areaWidth > 0 ? Math.min(1, Math.max(0.3, (areaWidth - 26) / PAPER_PX[orientation])) : 1;
  const zoom = zoomMode === "fit" ? fit : 1;

  const print = () => {
    onPrint?.();
    // Let the layout settle (a switched view) before the dialog opens.
    window.setTimeout(() => window.print(), 60);
  };

  const run = () => {
    onRun?.();
    // On a phone the panel folds away so the report is in view.
    if (!wide) setPanelOpen(false);
  };

  const toolbar: ToolbarAction[] = [
    ...actions,
    {
      id: "print",
      label: "Print / PDF",
      icon: Printer,
      group: "output",
      shortcut: "Ctrl+P",
      onClick: print,
      disabled: !ready,
      disabledReason: "Show a report first",
    },
    {
      id: "excel",
      label: "Excel",
      icon: FileSpreadsheet,
      group: "output",
      shortcut: "Ctrl+Shift+E",
      onClick: excel,
      hidden: !excel && !exportNote,
      disabled: !excel || !ready || exporting,
      disabledReason: !excel ? exportNote : exporting ? "Exporting…" : "Show a report first",
    },
    {
      id: "csv",
      label: "CSV",
      icon: FileText,
      group: "output",
      onClick: csv,
      hidden: !csv && !exportNote,
      disabled: !csv || !ready || exporting,
      disabledReason: !csv ? exportNote : exporting ? "Exporting…" : "Show a report first",
    },
    ...(onRun ? [{ id: "refresh", label: running ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh" as const, onClick: run, disabled: running }] : []),
  ];

  return (
    <div>
      <div className="print:hidden">
        <PageBar title={title} description={description} status={status} actions={toolbar} />
      </div>
      {notice && <div className="mb-3 space-y-2 print:hidden">{notice}</div>}
      {/* In print the panel is gone and the paper takes the whole page (a grid would keep its first column). */}
      <div className={cn("grid gap-4 print:block", panelOpen && params ? "lg:grid-cols-[17rem_minmax(0,1fr)]" : "grid-cols-1")}>
        {panelOpen && params && (
          <aside aria-label="Report parameters" className="self-start rounded-md border border-line-card bg-surface print:hidden lg:sticky lg:top-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run();
              }}
            >
              <div className="flex items-center justify-between border-b border-line bg-surface-sunken/60 px-3 py-1.5">
                <h2 className="text-xs font-semibold text-ink">Parameters</h2>
                <button type="button" onClick={() => setPanelOpen(false)} className="rounded p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink" aria-label="Hide parameters" title="Hide parameters">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-3 p-3">{params}</div>
              {onRun && (
                <div className="border-t border-line p-3">
                  <WindowButton type="submit" variant="primary" className="w-full" disabled={running}>
                    {running ? "Loading…" : runLabel}
                  </WindowButton>
                </div>
              )}
            </form>
          </aside>
        )}
        <section aria-label={`${title} preview`} className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex min-w-0 items-center gap-2">
              {params && !panelOpen && (
                <WindowButton onClick={() => setPanelOpen(true)}>
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Parameters
                </WindowButton>
              )}
              {paramsSummary && <span className="truncate text-xs text-ink-muted">{paramsSummary}</span>}
            </div>
            <div className="flex items-center gap-1 text-2xs text-ink-muted" role="group" aria-label="Zoom">
              {(["fit", "full"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setZoomMode(mode)}
                  aria-pressed={zoomMode === mode}
                  className={cn("rounded px-2 py-1 font-medium", zoomMode === mode ? "bg-surface-sunken text-ink" : "hover:bg-surface-sunken hover:text-ink")}
                >
                  {mode === "fit" ? `Fit width${fit < 1 ? ` (${Math.round(fit * 100)}%)` : ""}` : "100%"}
                </button>
              ))}
            </div>
          </div>
          <div ref={areaRef} className="overflow-x-auto rounded-md bg-canvas print:overflow-visible print:rounded-none print:bg-transparent">
            <div className="mx-auto w-max py-3 [zoom:var(--report-zoom)] print:w-auto print:py-0 print:[zoom:1]" style={{ "--report-zoom": zoom } as React.CSSProperties}>
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** One parameter: the label above its control (the panel is narrow). */
export function ReportParam({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-medium text-ink-muted">{label}</span>
      {children}
      {help && <span className="mt-1 block text-2xs text-ink-faint">{help}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Paper
// ---------------------------------------------------------------------------

/** One A4 sheet. Several papers print one per page. */
export function ReportPaper({ orientation = "portrait", children, className }: { orientation?: ReportOrientation; children: ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        "mx-3 mb-3 bg-white text-ink shadow-sm ring-1 ring-line last:mb-0",
        orientation === "landscape" ? "min-h-[210mm] w-[297mm] px-[8mm] py-[7mm]" : "min-h-[297mm] w-[210mm] px-[12mm] py-[11mm]",
        "print:m-0 print:min-h-0 print:w-auto print:p-0 print:shadow-none print:ring-0 print:break-after-page print:last:break-after-auto",
        className
      )}
    >
      {children}
    </article>
  );
}

/** A paper that says there is nothing to show (no run in scope, no rows). */
export function ReportEmptyPaper({ orientation, title, description, icon, action }: { orientation?: ReportOrientation; title: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <ReportPaper orientation={orientation} className="flex items-start justify-center">
      <EmptyState className="mt-24" title={title} description={description} icon={icon} action={action} />
    </ReportPaper>
  );
}

export function ReportLetterhead({
  company,
  title,
  titleNp,
  subtitle,
  meta = [],
  printedBy,
  printedOn,
  aside,
}: {
  company: ReportCompany;
  title: string;
  titleNp?: string;
  /** The period or run, e.g. "Aswin 2083 · Regular salary". */
  subtitle?: string;
  meta?: ReportMetaItem[];
  printedBy?: string;
  /** Already formatted, e.g. "2083-06-24 10:42". */
  printedOn?: string;
  /** Extra text on the right, e.g. a status stamp. */
  aside?: ReactNode;
}) {
  const centered = (company.headerAlign ?? "center") === "center";
  const rule = company.ruleStyle ?? "brand";
  const details = [company.address, company.pan && `PAN ${company.pan}`, company.regNo && `Reg. no. ${company.regNo}`].filter(Boolean).join(" · ");
  // A <div>, not <header>: the print stylesheet hides header elements (the app's title bar).
  return (
    <div className="mb-3">
      <div className={cn("flex items-center gap-3 pb-2", centered ? "flex-col text-center" : "", rule === "brand" ? "border-b-2 border-brand" : rule === "line" ? "border-b border-line-input" : "")}>
        {company.logoDataUrl && (
          // The company's logo from its letter design: a checked PNG / JPEG data URL (the page allows data: images).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoDataUrl} alt="" className="h-10 w-auto object-contain" />
        )}
        <div>
          <p className="text-base font-semibold leading-tight tracking-tight text-brand-strong">{company.name || "Company"}</p>
          {details && <p className="text-2xs text-ink-muted">{details}</p>}
        </div>
      </div>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">
            {title}
            {titleNp && <span className="ml-1.5 font-normal text-ink-muted">{titleNp}</span>}
          </h2>
          {subtitle && <p className="text-xs font-medium text-ink">{subtitle}</p>}
          {meta.length > 0 && (
            <p className="mt-0.5 text-2xs text-ink-muted">
              {meta.map((m, i) => (
                <Fragment key={m.label}>
                  {i > 0 && " · "}
                  {m.label}: <span className="text-ink">{m.value}</span>
                </Fragment>
              ))}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right text-2xs text-ink-muted">
          {aside}
          {printedOn && <p>Printed {printedOn}</p>}
          {printedBy && <p>by {printedBy}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export interface ReportTableColumn<T> extends ReportColumn<T> {
  /** The cell on the page, when it needs more than the formatted value. */
  render?: (row: T) => ReactNode;
  /** Keep the cell on one line (names wrap by default). */
  nowrap?: boolean;
}

/**
 * The report's table as printed: header repeated on every page, optional
 * groups with subtotals, the total as the last row (never a repeating
 * footer, which would print the grand total on every page). A table wider
 * than the paper is drawn smaller until it fits, on the page and in print.
 */
export function ReportTable<T>({
  columns,
  rows,
  getRowId,
  groups,
  numbered = true,
  totals = false,
  dense = false,
  subtotalLabel = (g) => `Subtotal — ${g.label || "Not set"}`,
  totalLabel = "Total",
  empty = "Nothing to show for these parameters.",
}: {
  columns: ReportTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  groups?: ReportGroup<T>[];
  numbered?: boolean;
  totals?: boolean;
  /** Smaller type for wide sheets (landscape with many columns). */
  dense?: boolean;
  subtotalLabel?: (group: ReportGroup<T>) => string;
  totalLabel?: string;
  empty?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const table = tableRef.current;
    if (!wrap || !table) return;
    const fit = () => {
      table.style.zoom = "1";
      const natural = table.offsetWidth;
      const room = wrap.clientWidth;
      table.style.zoom = natural > room + 1 ? String(Math.max(0.5, room / natural)) : "1";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [columns, rows, groups]);
  const span = columns.length + (numbered ? 1 : 0);
  const cellPad = dense ? "px-1 py-0.5" : "px-1.5 py-1";
  const align = (c: ReportTableColumn<T>) => (isNumericColumn(c) ? "text-right" : "text-left");
  let n = 0;

  const dataRow = (row: T) => {
    n += 1;
    return (
      <tr key={getRowId(row)} className="border-b border-line align-top break-inside-avoid">
        {numbered && <td className={cn(cellPad, "text-right text-ink-muted")}>{n}</td>}
        {columns.map((c) => {
          const v = c.value(row);
          return (
            <td key={c.id} className={cn(cellPad, align(c), (c.nowrap || isNumericColumn(c) || c.kind === "code" || c.kind === "date") && "whitespace-nowrap", formatReportValue(c.kind, v) === "–" && "text-ink-faint")}>
              {c.render ? c.render(row) : formatReportValue(c.kind, v)}
            </td>
          );
        })}
      </tr>
    );
  };

  const totalRow = (key: string, label: string, subset: T[], strong: boolean) => (
    <tr key={key} className={cn("break-inside-avoid font-semibold", strong ? "border-y-2 border-line-strong bg-surface-sunken/60" : "border-b border-line-strong")}>
      <td className={cn(cellPad, "whitespace-nowrap")} colSpan={(numbered ? 1 : 0) + Math.max(1, columns.findIndex((c) => c.total))}>
        {label}
      </td>
      {columns.slice(Math.max(1, columns.findIndex((c) => c.total))).map((c) => {
        const t = columnTotal(c, subset);
        return (
          <td key={c.id} className={cn(cellPad, "whitespace-nowrap text-right")}>
            {t === null ? "" : formatReportValue(c.kind, t)}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div ref={wrapRef} className="w-full">
      <table ref={tableRef} className={cn("w-full border-collapse tabular-nums", dense ? "text-3xs" : "text-2xs")}>
        <thead>
          <tr className="border-y border-line-strong bg-surface-sunken">
            {numbered && <th className={cn(cellPad, "w-7 text-right font-semibold")}>S.N.</th>}
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn(cellPad, align(c), "align-bottom font-semibold leading-tight")}>
                {c.header}
                {c.headerNp && <span className="block font-normal text-ink-muted">{c.headerNp}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={span} className="px-2 py-6 text-center text-ink-muted">
                {empty}
              </td>
            </tr>
          )}
          {groups?.length
            ? groups.map((g) => (
                <Fragment key={`group:${g.key}`}>
                  <tr className="break-after-avoid border-b border-line bg-surface-sunken/40">
                    <td colSpan={span} className={cn(cellPad, "font-semibold text-ink")}>
                      {g.label || "Not set"} <span className="font-normal text-ink-muted">({g.rows.length})</span>
                    </td>
                  </tr>
                  {g.rows.map(dataRow)}
                  {totals && totalRow(`sub:${g.key}`, subtotalLabel(g), g.rows, false)}
                </Fragment>
              ))
            : rows.map(dataRow)}
          {totals && rows.length > 0 && totalRow("total", totalLabel, rows, true)}
        </tbody>
      </table>
    </div>
  );
}

/** Lines to sign under a report (prepared / checked / approved), with names when known. */
export function ReportSignatures({ blocks }: { blocks: { label: string; name?: string | null; note?: string | null }[] }) {
  return (
    <div className="mt-10 grid grid-cols-3 gap-8 text-2xs break-inside-avoid">
      {blocks.map((b) => (
        <div key={b.label}>
          <div className="h-8" aria-hidden />
          <p className="border-t border-line-input pt-1 font-semibold text-ink">{b.label}</p>
          {b.name && <p className="text-ink">{b.name}</p>}
          {b.note && <p className="text-ink-muted">{b.note}</p>}
        </div>
      ))}
    </div>
  );
}

/** Small print under a table: what the figures include, where they come from. */
export function ReportNote({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-2xs text-ink-muted">{children}</p>;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Excel and CSV from what the page holds: the server checks EXPORT on the
 * report's module and audits it first (authorizeExportAction); the file is
 * then built here from the same columns as the paper.
 */
export function useReportExport(module: ExportModule, onError: (message: string) => void) {
  const [exporting, setExporting] = useState(false);
  const gate = async (label: string, rowCount: number) => {
    const result = await authorizeExportAction({ module, label, rowCount });
    if (!result.allowed) onError(result.error ?? "You do not have permission to export this report.");
    return result.allowed;
  };
  const excel = async (p: { label: string; fileName: string; rowCount: number; sheets: () => XlsxSheet[]; title?: string; creator?: string }) => {
    setExporting(true);
    try {
      if (!(await gate(`${p.label} (Excel)`, p.rowCount))) return;
      downloadBytes(p.fileName, buildXlsx(p.sheets(), { title: p.title ?? p.label, creator: p.creator }), XLSX_MIME);
    } catch {
      onError("The Excel file could not be made. Try again, or use CSV.");
    } finally {
      setExporting(false);
    }
  };
  const csv = async (p: { label: string; fileName: string; rowCount: number; text: () => string }) => {
    setExporting(true);
    try {
      if (!(await gate(`${p.label} (CSV)`, p.rowCount))) return;
      downloadTextFile(p.fileName, p.text());
    } catch {
      onError("The CSV file could not be made. Try again.");
    } finally {
      setExporting(false);
    }
  };
  return { exporting, excel, csv };
}

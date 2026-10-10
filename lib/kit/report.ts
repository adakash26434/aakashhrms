// Report model (4.11, template D): the columns of a report, defined once and
// used three ways — the printed sheet, the CSV and the Excel workbook — so
// what is exported is what is on the page. Pure: tests/report-kit.test.ts.

import Decimal from "decimal.js";
import { safeFilename, toCsv, type CsvColumn } from "@/lib/export/csv";
import type { XlsxSheet, XlsxValue } from "@/lib/export/xlsx";
import { formatAmount } from "@/lib/kit/amount";

/** How a column's values read: money, counts (days, hours, people), dates and text. */
export type ReportKind = "text" | "code" | "amount" | "number" | "days" | "date";

export interface ReportColumn<T> {
  id: string;
  header: string;
  /** A Nepali line under the English header on the printed sheet. */
  headerNp?: string;
  kind?: ReportKind;
  /** The value as data: numbers (or numeric strings) for amounts, days and numbers; text otherwise. */
  value: (row: T) => string | number | null;
  /** Summed in the total and subtotal rows (numeric columns only). */
  total?: boolean;
  /** Width in characters for the Excel column (and a minimum on the page). */
  width?: number;
}

export interface ReportGroup<T> {
  key: string;
  label: string;
  rows: T[];
}

const NUMERIC: ReadonlySet<ReportKind> = new Set(["amount", "number", "days"]);

export const isNumericColumn = (column: Pick<ReportColumn<unknown>, "kind">): boolean => NUMERIC.has(column.kind ?? "text");

const NUMERIC_TEXT = /^[+-]?\d+(\.\d+)?$/;

/** A column value as a decimal, or null when it is not a number. */
export function decimalOf(value: unknown): Decimal | null {
  if (typeof value === "number") return Number.isFinite(value) ? new Decimal(value) : null;
  if (typeof value === "string" && NUMERIC_TEXT.test(value.trim())) return new Decimal(value.trim());
  return null;
}

/** The column's sum over the rows (2 decimals), or null when the column has no total. */
export function columnTotal<T>(column: ReportColumn<T>, rows: readonly T[]): number | null {
  if (!column.total || !isNumericColumn(column)) return null;
  let sum = new Decimal(0);
  for (const row of rows) {
    const d = decimalOf(column.value(row));
    if (d) sum = sum.plus(d);
  }
  return sum.toDecimalPlaces(2).toNumber();
}

/**
 * Rows split into groups (department, branch, bank…), groups in label order
 * with blank labels last; rows keep their order inside a group.
 */
export function groupRows<T>(rows: readonly T[], keyOf: (row: T) => string, labelOf: (row: T) => string): ReportGroup<T>[] {
  const groups = new Map<string, ReportGroup<T>>();
  for (const row of rows) {
    const key = keyOf(row);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: labelOf(row), rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => (!a.label ? 1 : !b.label ? -1 : a.label.localeCompare(b.label)));
}

const dayFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/**
 * A value as the page shows it: money with lakh grouping and two decimals,
 * days and counts with up to two decimals; zero money is a dash (salary
 * sheets read better without rows of 0.00).
 */
export function formatReportValue(kind: ReportKind | undefined, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (kind === "amount" || kind === "days" || kind === "number") {
    const d = decimalOf(value);
    if (!d) return String(value);
    if (kind === "amount") return d.isZero() ? "–" : formatAmount(d.toNumber());
    return dayFormat.format(d.toNumber());
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** The value written to a file: plain numbers (amounts with 2 decimals) for numeric columns. */
function fileValue<T>(column: ReportColumn<T>, row: T): string | number | null {
  const v = column.value(row);
  if (v === null || v === undefined || v === "") return null;
  if (!isNumericColumn(column)) return String(v);
  const d = decimalOf(v);
  if (!d) return String(v);
  return column.kind === "amount" ? d.toDecimalPlaces(2).toNumber() : d.toNumber();
}

/** CSV of the rows (data only: no title lines or totals, so it reads back cleanly). */
export function reportCsv<T>(columns: readonly ReportColumn<T>[], rows: readonly T[], options: { numbered?: boolean } = {}): string {
  type Numbered = { n: number; row: T };
  const cols: CsvColumn<Numbered>[] = [
    ...(options.numbered ? [{ header: "S.N.", value: (r: Numbered) => r.n }] : []),
    ...columns.map(
      (c): CsvColumn<Numbered> => ({
        header: c.header,
        value: (r) => {
          const v = fileValue(c, r.row);
          return typeof v === "number" && c.kind === "amount" ? v.toFixed(2) : v;
        },
      })
    ),
  ];
  return toCsv(
    cols,
    rows.map((row, i) => ({ n: i + 1, row }))
  );
}

export interface ReportSheetOptions<T> {
  /** The workbook tab. */
  name: string;
  /** Lines above the table: company, report and period, parameters. */
  title: string[];
  /** Rows written group by group with a subtotal under each. */
  groups?: ReportGroup<T>[];
  numbered?: boolean;
  /** A total row at the end (and subtotals under groups). */
  totals?: boolean;
  subtotalLabel?: (group: ReportGroup<T>) => string;
  totalLabel?: string;
  landscape?: boolean;
}

const DEFAULT_WIDTH: Record<ReportKind, number> = { text: 22, code: 12, amount: 14, number: 10, days: 9, date: 12 };

/** One Excel sheet of the report: title lines, the header row, rows (grouped), totals. */
export function reportSheet<T>(columns: readonly ReportColumn<T>[], rows: readonly T[], options: ReportSheetOptions<T>): XlsxSheet {
  const lead = options.numbered ? 1 : 0;
  const width = lead + columns.length;
  const out: XlsxValue[][] = [];
  options.title.forEach((line, i) => out.push([{ value: line, style: i === 0 ? "title" : i === 1 ? "subtitle" : "muted" }]));
  out.push([]);
  const headerIndex = out.length;
  out.push([
    ...(options.numbered ? [{ value: "S.N.", style: "headerRight" as const }] : []),
    ...columns.map((c) => ({ value: c.header, style: isNumericColumn(c) ? ("headerRight" as const) : ("header" as const) })),
  ]);

  let n = 0;
  const dataRow = (row: T): XlsxValue[] => {
    n += 1;
    return [
      ...(options.numbered ? [{ value: n, style: "number" as const }] : []),
      ...columns.map((c): XlsxValue => {
        const v = fileValue(c, row);
        if (typeof v === "number") return { value: v, style: c.kind === "amount" ? "money" : "number" };
        return v;
      }),
    ];
  };
  const totalRow = (label: string, subset: readonly T[]): XlsxValue[] => {
    const cells: XlsxValue[] = new Array(width).fill(null);
    cells[0] = { value: label, style: "bold" };
    columns.forEach((c, i) => {
      const total = columnTotal(c, subset);
      if (total !== null) cells[lead + i] = { value: total, style: c.kind === "amount" ? "moneyBold" : "numberBold" };
    });
    return cells;
  };

  if (options.groups?.length) {
    for (const group of options.groups) {
      out.push([{ value: group.label || "Not set", style: "bold" }]);
      for (const row of group.rows) out.push(dataRow(row));
      if (options.totals) out.push(totalRow(options.subtotalLabel ? options.subtotalLabel(group) : `Subtotal — ${group.label || "Not set"}`, group.rows));
    }
  } else {
    for (const row of rows) out.push(dataRow(row));
  }
  if (options.totals) out.push(totalRow(options.totalLabel ?? "Total", rows));

  return {
    name: options.name,
    rows: out,
    widths: [...(options.numbered ? [6] : []), ...columns.map((c) => c.width ?? DEFAULT_WIDTH[c.kind ?? "text"])],
    freezeRows: headerIndex + 1,
    repeatRow: headerIndex + 1,
    merges: options.title.map((_, i) => [i, 0, i, Math.max(0, width - 1)] as [number, number, number, number]),
    landscape: options.landscape,
  };
}

/** "salary-sheet" + "Aswin 2083" + "Lekhnath" → "salary-sheet-Aswin-2083-Lekhnath.xlsx". */
export function reportFileName(parts: readonly (string | null | undefined)[], extension: "csv" | "xlsx"): string {
  const name = parts
    .filter((p): p is string => !!p && !!p.trim())
    .map((p) => safeFilename(p))
    .join("-");
  return `${name || "report"}.${extension}`;
}

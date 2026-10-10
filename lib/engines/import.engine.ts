import { rowsToCsv } from "@/lib/export/csv";
import { bsToAD, isValidBSDate } from "@/lib/utils/bs-calendar";

// Import templates (4.8 / F15): reading a filled-in template (CSV, saved from Excel) into rows
// keyed by column, and the value readers every importer shares. Each importer defines its columns
// and turns rows into its own records; the server checks every row and reports per line before
// anything is saved (nothing is saved while a row has an error). Pure.

export interface ImportColumn {
  /** Stable key the importer reads. */
  key: string;
  /** The header in the template (matched without regard to case or spacing). */
  header: string;
  required?: boolean;
  /** What to type, shown next to the template. */
  help: string;
}

export interface SheetRow {
  /** Line in the file (the header is line 1). */
  line: number;
  cells: Record<string, string>;
}

export interface SheetRead {
  rows: SheetRow[];
  /** Problems with the file itself (headers, size): nothing can be imported until fixed. */
  fileIssues: string[];
  /** Headers that are not template columns (ignored). */
  ignored: string[];
}

export type IssueLevel = "error" | "warning";

export interface RowIssue {
  /** The column header the issue is about ("" for the whole row). */
  column: string;
  message: string;
  level: IssueLevel;
}

export interface ReportRow {
  line: number;
  /** "EMP-010 · Ram Thapa" — how the row reads in the report. */
  label: string;
  issues: RowIssue[];
}

export interface ImportReport {
  rows: ReportRow[];
  fileIssues: string[];
  ignored: string[];
  /** Rows with at least one error. */
  errorRows: number;
  /** Rows with warnings only. */
  warningRows: number;
  /** Every row can be imported (no file issue, no row error, at least one row). */
  ready: boolean;
}

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 2_000_000;

const norm = (s: string) => s.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");

/** The template's rows as cells keyed by column; blank lines are skipped. */
export function readSheet(table: readonly (readonly string[])[], columns: readonly ImportColumn[], maxRows = MAX_IMPORT_ROWS): SheetRead {
  const out: SheetRead = { rows: [], fileIssues: [], ignored: [] };
  if (!table.length) {
    out.fileIssues.push("The file is empty.");
    return out;
  }
  if (table[0].length === 1 && table[0][0].includes(";")) {
    out.fileIssues.push('The columns are separated by ";". In Excel, save the file as "CSV UTF-8 (Comma delimited)".');
    return out;
  }
  const header = table[0].map(norm);
  const byHeader = new Map(columns.map((c) => [norm(c.header), c]));
  const at = new Map<string, number>();
  header.forEach((h, i) => {
    const col = byHeader.get(h);
    if (!col) {
      if (h) out.ignored.push(table[0][i].trim());
    } else if (at.has(col.key)) out.fileIssues.push(`The column "${col.header}" appears twice.`);
    else at.set(col.key, i);
  });
  const missing = columns.filter((c) => c.required && !at.has(c.key)).map((c) => c.header);
  if (missing.length) out.fileIssues.push(`Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Download the template again.`);
  table.slice(1).forEach((cells, i) => {
    if (!cells.some((c) => c.trim())) return;
    const row: SheetRow = { line: i + 2, cells: {} };
    for (const [key, index] of at) row.cells[key] = (cells[index] ?? "").trim();
    out.rows.push(row);
  });
  if (out.rows.length > maxRows) out.fileIssues.push(`At most ${maxRows} rows at a time (this file has ${out.rows.length}).`);
  if (!out.rows.length && !out.fileIssues.length) out.fileIssues.push("The file has no rows under the header.");
  return out;
}

/** The report for checked rows. */
export function buildReport(read: Pick<SheetRead, "fileIssues" | "ignored">, rows: readonly ReportRow[]): ImportReport {
  const errorRows = rows.filter((r) => r.issues.some((i) => i.level === "error")).length;
  const warningRows = rows.filter((r) => !r.issues.some((i) => i.level === "error") && r.issues.length > 0).length;
  return { rows: [...rows], fileIssues: read.fileIssues, ignored: read.ignored, errorRows, warningRows, ready: !read.fileIssues.length && rows.length > 0 && errorRows === 0 };
}

/**
 * Problems with the file's text before it is read as a table: a workbook chosen instead of its CSV,
 * or a CSV saved in another encoding (Excel's plain "CSV" on Windows), whose Nepali letters are lost.
 */
export function textIssues(text: string): string[] {
  if (text.startsWith("PK\u0003\u0004")) return ['This is an Excel workbook. In Excel, use Save As → "CSV UTF-8 (Comma delimited)" and choose that file.'];
  if (text.includes("\uFFFD")) return ['The file is not saved as UTF-8, so some letters were lost. In Excel, use Save As → "CSV UTF-8 (Comma delimited)".'];
  return [];
}

/** The template's header line (the download adds the BOM Excel needs for Nepali text). */
export function templateHeader(columns: readonly ImportColumn[]): string {
  return `${rowsToCsv(columns.map((c) => c.header), [])}\r\n`;
}

// ---- value readers -------------------------------------------------------------------------

/** A BS date typed as YYYY-MM-DD or YYYY/MM/DD (Excel may drop leading zeros) → the AD date, or why not. */
export function readBsDate(text: string): { ad: string } | { error: string } {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text.trim());
  // Excel reads 2081-04-15 as an AD date and saves it in the computer's own order (4/15/2081).
  if (!m && /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(text.trim())) return { error: `Excel changed this date to ${text.trim()}: set the column to Text and type the BS date again as YYYY-MM-DD` };
  if (!m) return { error: "Type the BS date as YYYY-MM-DD, e.g. 2081-04-15" };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!isValidBSDate(y, mo, d)) return { error: `${text.trim()} is not a BS date` };
  const ad = bsToAD(y, mo, d);
  if (isNaN(ad.getTime())) return { error: `${text.trim()} is not a BS date` };
  return { ad: `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, "0")}-${String(ad.getDate()).padStart(2, "0")}` };
}

/** Excel shows a long number as 1.23457E+15 and saves it that way: its digits are lost. */
export function excelChangedNumber(text: string): boolean {
  return /^\d+(\.\d+)?e[+-]?\d+$/i.test(text.trim());
}

/** Yes / No (also Y / N, 1 / 0, true / false, हो / होइन); null when it is neither. */
export function readYesNo(text: string): boolean | null {
  const v = text.trim().toLowerCase();
  if (["yes", "y", "1", "true", "हो"].includes(v)) return true;
  if (["no", "n", "0", "false", "होइन", ""].includes(v)) return false;
  return null;
}

/** An amount as Excel writes it ("1,25,000", "125000.50"); null when it is not one. */
export function readAmount(text: string): number | null {
  const clean = text.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

/** A choice by value or label, without regard to case; null when nothing matches. */
export function readChoice<T extends string>(text: string, options: readonly { value: T; label: string; aliases?: readonly string[] }[]): T | null {
  const v = norm(text);
  if (!v) return null;
  return options.find((o) => norm(o.value) === v || norm(o.label) === v || o.aliases?.some((a) => norm(a) === v))?.value ?? null;
}

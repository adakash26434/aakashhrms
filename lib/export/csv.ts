// Safe CSV / clipboard export (roadmap 3.7, security plan S16 and standing
// measure 5). Every spreadsheet-bound value goes through escapeCsvCell so a
// cell that starts with = + - @ (or a tab / CR) is never executed as a formula
// when the file is opened in Excel, LibreOffice or Google Sheets.

export type CsvValue = string | number | boolean | null | undefined | Date;

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
/** "-1500", "+20", "-4,52,300.75" are plain numbers, never formulas. */
const NUMERIC_TEXT = /^[+-]?\d[\d,]*(\.\d+)?$/;

export interface CsvCellOptions {
  /**
   * Prefix formula triggers with an apostrophe (default true). Only turn this
   * off for machine-read files with a fixed format (e.g. bank upload files),
   * where the receiver rejects the apostrophe — and then strip triggers instead.
   */
  neutraliseFormulas?: boolean;
}

function stringify(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value);
}

/** One CSV field: formula-neutralised, quotes doubled, always quoted. */
export function escapeCsvCell(value: CsvValue, { neutraliseFormulas = true }: CsvCellOptions = {}): string {
  let text = stringify(value);
  // Plain numbers (including negatives) are data, not formulas.
  const isNumber = (typeof value === "number" && Number.isFinite(value)) || NUMERIC_TEXT.test(text);
  if (neutraliseFormulas && !isNumber && FORMULA_TRIGGER.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Field for fixed-format files read by other systems (bank uploads): quoted
 * only when needed, formula triggers and control characters removed rather
 * than prefixed, so the receiving parser sees clean values.
 */
export function plainCsvField(value: CsvValue): string {
  let text = stringify(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (typeof value !== "number") text = text.replace(/^[=+\-@]+/, "").trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

/** Builds CSV text (CRLF line endings, as Excel expects). */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  return lines.join("\r\n");
}

/** Builds CSV text from a header row and raw rows. */
export function rowsToCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return [headers, ...rows].map((r) => r.map((v) => escapeCsvCell(v)).join(",")).join("\r\n");
}

/** Tab-separated text for the clipboard (Excel paste), formula-neutralised. */
export function toTsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          let text = stringify(v).replace(/[\t\r\n]+/g, " ");
          if (typeof v !== "number" && !NUMERIC_TEXT.test(text) && FORMULA_TRIGGER.test(text)) text = `'${text}`;
          return text;
        })
        .join("\t")
    )
    .join("\r\n");
}

/** Filesystem-safe filename part ("Shrawan 2083 / Head Office" → "Shrawan-2083-Head-Office"). */
export function safeFilename(part: string): string {
  return (
    part
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/-+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "")
      .slice(0, 80) || "export"
  );
}

/**
 * Reads CSV text (as saved by Excel: commas, quoted cells with "" inside,
 * CRLF or LF line ends, an optional UTF-8 BOM) into rows of cells.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
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
  // A leading ' (formula guard added by our own export) is not part of the value.
  return rows.filter((r) => r.some((c) => c.trim() !== "")).map((r) => r.map((c) => (c.startsWith("'") ? c.slice(1) : c)));
}

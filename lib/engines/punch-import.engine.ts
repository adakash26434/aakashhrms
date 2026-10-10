import { readAdDate, readBsDate, readClock, readClocks, type ImportColumn, type RowIssue, type SheetRow } from "@/lib/engines/import.engine";

// Attendance punch import (4.8 / F15): an old system's or a device's punches, one row per employee
// and day (In / Out) or one per punch (Other punches). Only punches are imported: the day rules
// (attendance-day.engine) decide each day from them, as they do for device and web punches. Pure.

/** A month of a few hundred people fits; the file itself stays under the import size cap. */
export const MAX_PUNCH_ROWS = 10_000;
export const MAX_TIMES_PER_ROW = 12;

export const PUNCH_IMPORT_COLUMNS: readonly ImportColumn[] = [
  { key: "attendanceCode", header: "Attendance code", help: "The code on the attendance device (or give the employee code)." },
  { key: "employeeCode", header: "Employee code", help: "Instead of, or as well as, the attendance code." },
  { key: "dateBs", header: "Date (BS)", help: "YYYY-MM-DD in BS. Or fill Date (AD) instead." },
  { key: "dateAd", header: "Date (AD)", help: "YYYY-MM-DD in AD, as attendance devices export it." },
  { key: "in", header: "In", help: "Check-in time, e.g. 09:58 (24-hour; 9:58 AM also works)." },
  { key: "out", header: "Out", help: "Check-out time; earlier than In means the next morning (night shift)." },
  { key: "other", header: "Other punches", help: "More times of that day, e.g. 13:02 13:31. A device log with one punch per row puts each time here." },
  { key: "note", header: "Note", help: "Optional; kept with each punch (e.g. the old system's name)." },
];

const header = (key: string) => PUNCH_IMPORT_COLUMNS.find((c) => c.key === key)?.header ?? key;

/** What the file's header needs: a way to find the employee, a date and at least one time column. */
export function punchHeaderIssues(columns: readonly string[]): string[] {
  const has = (key: string) => columns.includes(key);
  const issues: string[] = [];
  if (!has("attendanceCode") && !has("employeeCode")) issues.push("Add an Attendance code or Employee code column.");
  if (!has("dateBs") && !has("dateAd")) issues.push("Add a Date (BS) or Date (AD) column.");
  if (!has("in") && !has("out") && !has("other")) issues.push("Add an In, Out or Other punches column.");
  return issues;
}

export type PunchKind = "in" | "out" | "auto";

export interface ParsedPunchRow {
  attendanceCode: string;
  employeeCode: string;
  /** The day, AD "YYYY-MM-DD". */
  date: string;
  /** The column the date came from (where a problem with the day is reported). */
  dateColumn: string;
  /** Minutes into the day; an Out before the In is the next morning (past 1440). */
  punches: { minutes: number; kind: PunchKind }[];
  note: string;
}

/** One row read; `parsed` is null when the row has errors of its own (codes are looked up later). */
export function readPunchRow(row: SheetRow): { parsed: ParsedPunchRow | null; issues: RowIssue[] } {
  const c = row.cells;
  const issues: RowIssue[] = [];
  const err = (key: string, message: string) => issues.push({ column: header(key), message, level: "error" });

  const attendanceCode = (c.attendanceCode ?? "").trim();
  const employeeCode = (c.employeeCode ?? "").trim();
  if (!attendanceCode && !employeeCode) err("attendanceCode" in c ? "attendanceCode" : "employeeCode", "Give the attendance code or the employee code");

  const bs = c.dateBs ? readBsDate(c.dateBs) : null;
  const ad = c.dateAd ? readAdDate(c.dateAd) : null;
  if (bs && "error" in bs) err("dateBs", bs.error);
  if (ad && "error" in ad) err("dateAd", ad.error);
  const fromBs = bs && "ad" in bs ? bs.ad : "";
  const fromAd = ad && "ad" in ad ? ad.ad : "";
  if (!c.dateBs && !c.dateAd) err("dateBs" in c ? "dateBs" : "dateAd", "Required");
  else if (fromBs && fromAd && fromBs !== fromAd) err("dateAd", "Not the same day as Date (BS)");

  const inText = c.in ?? "";
  const outText = c.out ?? "";
  const otherText = c.other ?? "";
  const inMin = inText ? readClock(inText) : null;
  const outMin = outText ? readClock(outText) : null;
  const others = otherText ? readClocks(otherText) : [];
  if (inText && inMin === null) err("in", "Use a time like 09:58");
  if (outText && outMin === null) err("out", "Use a time like 18:05");
  if (others === null) err("other", "Use times like 13:02 13:31");
  if (!inText && !outText && !otherText) err("in" in c ? "in" : "out" in c ? "out" : "other", "No time on this row");

  const punches: ParsedPunchRow["punches"] = [];
  if (inMin !== null) punches.push({ minutes: inMin, kind: "in" });
  if (outMin !== null) punches.push({ minutes: inMin !== null && outMin <= inMin ? outMin + 1440 : outMin, kind: "out" });
  for (const minutes of others ?? []) punches.push({ minutes, kind: "auto" });
  if (punches.length > MAX_TIMES_PER_ROW) err("other", `At most ${MAX_TIMES_PER_ROW} times on one row`);

  if (issues.length) return { parsed: null, issues };
  return {
    parsed: {
      attendanceCode,
      employeeCode,
      date: fromBs || fromAd,
      dateColumn: header(fromBs ? "dateBs" : "dateAd"),
      punches,
      note: (c.note ?? "").trim().slice(0, 300),
    },
    issues,
  };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TIMES_PER_ROW, PUNCH_IMPORT_COLUMNS, punchHeaderIssues, readPunchRow } from "@/lib/engines/punch-import.engine";
import { readBsDate, readSheet, type SheetRow } from "@/lib/engines/import.engine";

// F15: punches from a file — only times are read here; who and which days are allowed is the service's.

const row = (cells: Record<string, string>): SheetRow => ({ line: 2, cells: { attendanceCode: "", employeeCode: "", dateBs: "", dateAd: "", in: "", out: "", other: "", note: "", ...cells } });
const errors = (cells: Record<string, string>) => readPunchRow(row(cells)).issues.map((i) => `${i.column}: ${i.message}`);
const bsAd = (bs: string) => {
  const r = readBsDate(bs);
  assert.ok("ad" in r);
  return r.ad;
};

test("a day row gives an in and an out punch; an out before the in is the next morning", () => {
  const day = readPunchRow(row({ attendanceCode: "A01", dateBs: "2083-06-01", in: "09:58", out: "18:05", note: " old system " }));
  assert.deepEqual(day.issues, []);
  assert.deepEqual(day.parsed, {
    attendanceCode: "A01",
    employeeCode: "",
    date: bsAd("2083-06-01"),
    dateColumn: "Date (BS)",
    punches: [
      { minutes: 598, kind: "in" },
      { minutes: 1085, kind: "out" },
    ],
    note: "old system",
  });
  const night = readPunchRow(row({ employeeCode: "EMP-001", dateAd: "2026-09-17", in: "22:00", out: "6:10 AM" })).parsed;
  assert.deepEqual(night?.punches, [
    { minutes: 1320, kind: "in" },
    { minutes: 1440 + 370, kind: "out" },
  ]);
  assert.equal(night?.date, "2026-09-17");
  assert.equal(night?.dateColumn, "Date (AD)");
});

test("a device log row is one punch whose direction the day rules work out", () => {
  assert.deepEqual(readPunchRow(row({ attendanceCode: "A02", dateAd: "2026-09-17", other: "13:02" })).parsed?.punches, [{ minutes: 782, kind: "auto" }]);
  assert.deepEqual(readPunchRow(row({ attendanceCode: "A02", dateAd: "2026-09-17", in: "9:00", other: "13:02 13:31" })).parsed?.punches, [
    { minutes: 540, kind: "in" },
    { minutes: 782, kind: "auto" },
    { minutes: 811, kind: "auto" },
  ]);
});

test("a row needs a code, one day and a time, each readable", () => {
  assert.deepEqual(errors({ dateBs: "2083-06-01", in: "09:58" }), ["Attendance code: Give the attendance code or the employee code"]);
  assert.deepEqual(errors({ attendanceCode: "A01", in: "09:58" }), ["Date (BS): Required"]);
  assert.deepEqual(errors({ attendanceCode: "A01", dateBs: "2083-06-01" }), ["In: No time on this row"]);
  assert.deepEqual(errors({ attendanceCode: "A01", dateBs: "2083-06-01", in: "9.58", out: "25:00", other: "13:02 lunch" }), [
    "In: Use a time like 09:58",
    "Out: Use a time like 18:05",
    "Other punches: Use times like 13:02 13:31",
  ]);
  // Both dates may be given, but they must be the same day.
  assert.deepEqual(errors({ attendanceCode: "A01", dateBs: "2083-06-01", dateAd: bsAd("2083-06-01"), in: "09:58" }), []);
  assert.deepEqual(errors({ attendanceCode: "A01", dateBs: "2083-06-01", dateAd: "2026-01-01", in: "09:58" }), ["Date (AD): Not the same day as Date (BS)"]);
  assert.match(errors({ attendanceCode: "A01", dateAd: "9/17/2026", in: "09:58" })[0], /Excel changed this date/);
  const many = Array.from({ length: MAX_TIMES_PER_ROW }, (_, i) => `${10 + Math.floor(i / 6)}:${String((i % 6) * 10).padStart(2, "0")}`).join(" ");
  assert.deepEqual(errors({ attendanceCode: "A01", dateBs: "2083-06-01", in: "09:00", other: many }), [`Other punches: At most ${MAX_TIMES_PER_ROW} times on one row`]);
});

test("the file needs a way to find the employee, a date and a time column — in any template order", () => {
  assert.deepEqual(punchHeaderIssues(["employeeCode", "dateAd", "other"]), []);
  assert.deepEqual(punchHeaderIssues(["note"]), [
    "Add an Attendance code or Employee code column.",
    "Add a Date (BS) or Date (AD) column.",
    "Add an In, Out or Other punches column.",
  ]);
  // A device export with only three of the template's columns reads fine.
  const read = readSheet([["Date (AD)", "Attendance code", "Other punches"], ["2026-09-17", "A01", "09:58"]], PUNCH_IMPORT_COLUMNS, 10);
  assert.deepEqual([read.fileIssues, read.columns], [[], ["dateAd", "attendanceCode", "other"]]);
  assert.deepEqual(readPunchRow(read.rows[0]).issues, []);
});

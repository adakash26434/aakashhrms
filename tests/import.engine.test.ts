import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, excelChangedNumber, readAdDate, readAmount, readBsDate, readChoice, readClock, readClocks, readSheet, readYesNo, templateHeader, textIssues, type ImportColumn } from "@/lib/engines/import.engine";

const cols: ImportColumn[] = [
  { key: "code", header: "Employee code", help: "" },
  { key: "name", header: "Full name", required: true, help: "" },
  { key: "dob", header: "Date of birth (BS)", required: true, help: "" },
];

test("headers match without regard to case, spacing or Excel's BOM; blank lines are skipped", () => {
  const read = readSheet([["\uFEFFfull  NAME", "date of birth (bs)", "Notes"], ["Ram", "2050-01-01", "x"], ["", " ", ""], ["Sita", "2051-02-02", ""]], cols);
  assert.deepEqual(read.fileIssues, []);
  assert.deepEqual(read.ignored, ["Notes"]);
  assert.deepEqual(read.columns, ["name", "dob"]);
  assert.deepEqual(read.rows.map((r) => [r.line, r.cells.name, r.cells.dob, r.cells.code]), [
    [2, "Ram", "2050-01-01", undefined],
    [4, "Sita", "2051-02-02", undefined],
  ]);
});

test("a file without the template's required columns, twice the same column, or too many rows is refused as a whole", () => {
  assert.match(readSheet([["Employee code"], ["E1"]], cols).fileIssues[0], /Missing columns: Full name, Date of birth \(BS\)/);
  assert.match(readSheet([["Full name", "Full name", "Date of birth (BS)"], ["a", "b", "c"]], cols).fileIssues[0], /appears twice/);
  const many = [["Full name", "Date of birth (BS)"], ...Array.from({ length: 3 }, () => ["a", "b"])];
  assert.match(readSheet(many, cols, 2).fileIssues[0], /At most 2 rows/);
  assert.deepEqual(readSheet([], cols).fileIssues, ["The file is empty."]);
  assert.deepEqual(readSheet([["Full name", "Date of birth (BS)"]], cols).fileIssues, ["The file has no rows under the header."]);
});

test("the report is ready only with rows and no errors (warnings allowed)", () => {
  const read = { fileIssues: [], ignored: [] };
  const ok = buildReport(read, [{ line: 2, label: "a", issues: [{ column: "x", message: "note", level: "warning" }] }]);
  assert.equal(ok.ready, true);
  assert.equal(ok.warningRows, 1);
  const bad = buildReport(read, [{ line: 2, label: "a", issues: [{ column: "x", message: "no", level: "error" }] }, { line: 3, label: "b", issues: [] }]);
  assert.deepEqual([bad.ready, bad.errorRows, bad.warningRows], [false, 1, 0]);
  // Only the rows with issues travel back; the total counts them all.
  assert.deepEqual([bad.total, bad.rows.map((r) => r.line)], [2, [2]]);
  assert.equal(buildReport(read, []).ready, false);
});

test("BS dates become AD dates; anything else says how to type them", () => {
  // Shrawan 1, 2081 was 16 July 2024.
  assert.deepEqual(readBsDate("2081-04-15"), { ad: "2024-07-30" });
  assert.deepEqual(readBsDate("2081/4/15"), { ad: "2024-07-30" });
  assert.ok("error" in readBsDate("2081-13-01"));
  assert.ok("error" in readBsDate("2081-04-33"));
  assert.ok("error" in readBsDate("15/04/2081"));
});

test("yes / no, amounts and choices are read leniently but never guessed", () => {
  assert.equal(readYesNo("Yes"), true);
  assert.equal(readYesNo("हो"), true);
  assert.equal(readYesNo(""), false);
  assert.equal(readYesNo("maybe"), null);
  assert.equal(readAmount("1,25,000.50"), 125000.5);
  assert.equal(readAmount("12a"), null);
  assert.equal(readAmount("1.234"), null);
  const opts = [{ value: "Normal Single", label: "Single", aliases: ["unmarried"] }];
  assert.equal(readChoice(" single ", opts), "Normal Single");
  assert.equal(readChoice("Unmarried", opts), "Normal Single");
  assert.equal(readChoice("couple", opts), null);
});

test("the template is the header line, every cell quoted (quotes inside doubled)", () => {
  assert.equal(templateHeader([...cols, { key: "q", header: 'Odd, "one"', help: "" }]), '"Employee code","Full name","Date of birth (BS)","Odd, ""one"""\r\n');
});

test("files Excel saved the wrong way are refused with how to save them", () => {
  assert.match(textIssues("PK\u0003\u0004[Content_Types].xml")[0], /Excel workbook/);
  assert.match(textIssues("Full name\r\nR\uFFFDm")[0], /not saved as UTF-8/);
  assert.deepEqual(textIssues("Full name\r\nराम"), []);
  assert.match(readSheet([["Employee code;Full name;Date of birth (BS)"], ["E1;Ram;2050-01-01"]], cols).fileIssues[0], /separated by ";"/);
});

test("Excel's scientific notation is recognised; plain numbers and codes are not", () => {
  assert.equal(excelChangedNumber("1.23457E+15"), true);
  assert.equal(excelChangedNumber("9.84E+09"), true);
  assert.equal(excelChangedNumber("01234567890123"), false);
  assert.equal(excelChangedNumber("45-01-75-12345"), false);
  assert.ok("error" in readBsDate("15-04-2081"));
});

test("AD dates and times of day are read as typed, never guessed", () => {
  assert.deepEqual(readAdDate("2026-10-10"), { ad: "2026-10-10" });
  assert.deepEqual(readAdDate("2026/1/5"), { ad: "2026-01-05" });
  assert.ok("error" in readAdDate("2026-02-30"));
  assert.match((readAdDate("10/10/2026") as { error: string }).error, /Excel changed this date/);
  assert.equal(readClock("9:58"), 598);
  assert.equal(readClock("09:58:59"), 598);
  assert.equal(readClock("6:05 PM"), 18 * 60 + 5);
  assert.equal(readClock("12:10 am"), 10);
  assert.equal(readClock("12:10 p.m."), 12 * 60 + 10);
  assert.equal(readClock("24:00"), null);
  assert.equal(readClock("13:00 PM"), null);
  assert.equal(readClock("958"), null);
  assert.deepEqual(readClocks("13:02 13:31"), [782, 811]);
  assert.deepEqual(readClocks("1:02 PM, 1:31 PM"), [782, 811]);
  assert.equal(readClocks("13:02 lunch"), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  bsMonthOfFiscal,
  coveredByOpeningMessage,
  coveredMonths,
  isAfterOpening,
  openingAsPastMonth,
  openingAsYearEndSlip,
  openingTds,
  readOpeningRow,
  type OpeningAmounts,
} from "@/lib/engines/opening-balance.engine";
import { buildTaxSheet } from "@/lib/engines/tax-projection.engine";
import { certificateTotals, openingCertificateLine, openingTaxItem, splitSocialSecurityTax, type TaxItem } from "@/lib/engines/statutory-returns.engine";
import { preflightFindings } from "@/lib/engines/payroll-control.engine";
import type { SheetRow } from "@/lib/engines/import.engine";

// F15: opening balances — what an old system paid before payroll started here mid-year.

const opening: OpeningAmounts = { months: 3, grossEarnings: "180000.00", retirement: "15000.00", cit: "5000.00", taxableIncome: "150000.00", sst: "1500.00", incomeTax: "0.00" };
const row = (cells: Record<string, string>): SheetRow => ({ line: 2, cells: { employeeCode: "EMP-010", months: "3", grossEarnings: "1,80,000", retirement: "15000", cit: "5000", taxableIncome: "150000", sst: "1500", incomeTax: "", note: "", ...cells } });
const errors = (cells: Record<string, string>) =>
  readOpeningRow(row(cells))
    .issues.filter((i) => i.level === "error")
    .map((i) => `${i.column}: ${i.message}`);

test("fiscal months map to BS months, and the covered months read from Shrawan", () => {
  assert.deepEqual(bsMonthOfFiscal(2083, 1), { year: 2083, month: 4 });
  assert.deepEqual(bsMonthOfFiscal(2083, 9), { year: 2083, month: 12 });
  assert.deepEqual(bsMonthOfFiscal(2083, 10), { year: 2084, month: 1 });
  assert.deepEqual(bsMonthOfFiscal(2083, 12), { year: 2084, month: 3 });
  assert.equal(coveredMonths(1), "Shrawan");
  assert.equal(coveredMonths(3), "Shrawan–Aswin");
  assert.equal(coveredMonths(11), "Shrawan–Jestha");
  assert.equal(coveredMonths(3, "np"), "श्रावण–असोज");
});

test("an opening balance counts as the months it covers: tax projection, Ashadh, run guard", () => {
  assert.equal(openingTds({ sst: "1500", incomeTax: "250.50" }), "1750.50");
  assert.deepEqual(openingAsPastMonth(opening), { taxableIncome: "150000.00", tds: "1500.00", months: 3 });
  assert.deepEqual(openingAsYearEndSlip(opening), { grossEarnings: "180000.00", pfEmployee: "15000.00", citDeduction: "5000.00", tdsThisMonth: "1500.00" });
  assert.equal(isAfterOpening(opening, 3), false);
  assert.equal(isAfterOpening(opening, 4), true);
  // Kartik (4th month): the 3 months before come from the opening, 9 months are left.
  const flat1pc = (annual: Decimal) => annual.times(0.01);
  const sheet = buildTaxSheet({ past: [openingAsPastMonth(opening)], currentTaxable: 50000, monthsRemaining: 9, taxOn: flat1pc });
  assert.deepEqual([sheet.monthsPaid, sheet.ytdTaxable, sheet.ytdTds, sheet.projectedAnnualTaxable, sheet.annualTax, sheet.tdsThisMonth], [3, "150000.00", "1500.00", "600000.00", "6000.00", "500"]);
  assert.match(coveredByOpeningMessage([{ employeeCode: "EMP-010", fullName: "Gita Gurung" }], "Bhadra"), /^Opening balances already cover Bhadra for Gita Gurung \(EMP-010\): the old system paid it\./);
});

test("the certificate takes the old system's social security tax as deducted, and later months build on it", () => {
  const sstOn = (annual: Decimal) => Decimal.min(annual, 500000).times(0.01);
  const kartik: TaxItem = { key: "slip-4", fiscalMonthIndex: 4, order: 0, taxable: 50000, tds: 500, annualTaxable: null, closing: false, flatRate: false, ssf: false };
  const split = splitSocialSecurityTax([kartik, openingTaxItem({ ...opening, employeeId: "e1" })], sstOn);
  assert.deepEqual(split.get("opening:e1"), { sst: "1500.00", remuneration: "0.00" });
  // SST due on 600,000 is 5,000 (capped band): 3,500 left after the opening, over 9 months.
  assert.deepEqual(split.get("slip-4"), { sst: "389.00", remuneration: "111.00" });
  const line = openingCertificateLine(opening);
  assert.deepEqual([line.label, line.labelNp, line.source, line.retirement, line.tds], ["Before this system (Shrawan–Aswin)", "यो प्रणालीभन्दा अघि (श्रावण–असोज)", "opening", "20000.00", "1500.00"]);
  assert.equal(certificateTotals([line, line]).gross, "360000.00");
});

test("a row is read with its amounts; an empty taxable income is worked out and said so", () => {
  const ok = readOpeningRow(row({ note: " Old Excel " }));
  assert.deepEqual(ok.issues, []);
  assert.deepEqual(ok.opening, opening);
  assert.equal(ok.note, "Old Excel");
  const derived = readOpeningRow(row({ taxableIncome: "" }));
  assert.equal(derived.opening?.taxableIncome, "160000.00");
  assert.deepEqual(derived.issues, [{ column: "Taxable income", message: "Worked out as gross less PF / SSF and CIT (160000.00)", level: "warning" }]);
});

test("months, amounts and their relations are checked, never guessed", () => {
  assert.deepEqual(errors({ months: "12" }), ["Months paid before: Use a whole number from 1 to 11 (months from Shrawan)"]);
  assert.deepEqual(errors({ months: "2.5" }), ["Months paid before: Use a whole number from 1 to 11 (months from Shrawan)"]);
  assert.deepEqual(errors({ months: "", employeeCode: "" }), ["Employee code: Required", "Months paid before: Required"]);
  assert.deepEqual(errors({ grossEarnings: "" }), ["Gross earnings: Required"]);
  assert.deepEqual(errors({ sst: "abc" }), ['Social security tax: "abc" is not an amount']);
  assert.deepEqual(errors({ cit: "-5" }), ['CIT deducted: "-5" is not an amount']);
  assert.deepEqual(errors({ taxableIncome: "200000" }), ["Taxable income: More than the gross earnings"]);
  assert.deepEqual(errors({ retirement: "180000" }), ["PF / SSF deducted: PF / SSF and CIT are more than the gross earnings"]);
  assert.deepEqual(errors({ incomeTax: "179000" }), ["Income tax: The tax deducted is more than the gross earnings"]);
});

test("pre-flight stops a run for a month an opening balance covers", () => {
  const base = { openAttendanceBranches: [], employeesWithoutSalary: [], employeesNeedingSetup: [], pendingLeaveCount: 0, employeesWithoutBank: [], employeesWithoutPan: [], existingRunStatus: null, requireClosedAttendance: false };
  assert.deepEqual(preflightFindings(base), []);
  const found = preflightFindings({ ...base, employeesCoveredByOpening: ["Gita Gurung (EMP-010)"] });
  assert.deepEqual(
    found.map((f) => [f.code, f.severity, f.people]),
    [["covered_by_opening", "blocker", ["Gita Gurung (EMP-010)"]]]
  );
});

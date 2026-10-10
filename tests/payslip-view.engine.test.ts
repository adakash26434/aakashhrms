import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { headRole, lineAmount, payslipStatement, type HeadFigures } from "@/lib/engines/payslip-view.engine";
import { asPayslipLanguage } from "@/lib/constants/payslip-labels";

const head = (over: Partial<HeadFigures> & { payHeadId: string }): HeadFigures => ({
  payHeadName: over.payHeadId,
  nameNp: null,
  headType: "allowance",
  amount: "0",
  calculatedAmount: "0",
  isManualOverride: false,
  role: null,
  ...over,
});

// Basic 30,000 + grade 3,000; transport 2,000; SSF employer 20% on 33,000 = 6,600 (in gross);
// OT 1,500; absence 1,000 → gross 42,100. SSF 31% = 10,230; CIT 1,000; staff fund 500; loan 2,000;
// TDS 1,200 → deductions 14,930; net 27,170.
const slip = { basicSalary: "30000", gradeAmount: "3000", otAmount: "1500", absentDeduction: "1000", loanDeduction: "2000", grossEarnings: "42100", totalDeductions: "14930", netPayable: "27170", pfEmployer: "0" };
const heads: HeadFigures[] = [
  head({ payHeadId: "tds", payHeadName: "Tax Deducted at Source (TDS)", headType: "deduction", calculatedAmount: "1200", role: "tds" }),
  head({ payHeadId: "ssf-er", payHeadName: "SSF Employer", calculatedAmount: "6600", role: "ssfEmployer" }),
  head({ payHeadId: "transport", payHeadName: "Transport", nameNp: "यातायात भत्ता", amount: "2000", calculatedAmount: "2000" }),
  head({ payHeadId: "ssf", payHeadName: "SSF", headType: "deduction", calculatedAmount: "10230", role: "ssf" }),
  head({ payHeadId: "fund", payHeadName: "Staff welfare fund", headType: "deduction", calculatedAmount: "500" }),
  head({ payHeadId: "cit", payHeadName: "CIT", headType: "deduction", amount: "1000", calculatedAmount: "1000", role: "cit" }),
];

describe("payslip statement", () => {
  it("columns add up to the stored totals, in reading order", () => {
    const s = payslipStatement(slip, heads);
    assert.deepEqual(s.earnings.map((l) => [l.key, l.amount]), [
      ["basic", "30000.00"],
      ["grade", "3000.00"],
      ["head:transport", "2000.00"],
      ["head:ssf-er", "6600.00"],
      ["ot", "1500.00"],
      ["absence", "-1000.00"],
    ]);
    assert.deepEqual(s.deductions.map((l) => l.key), ["head:ssf", "head:cit", "head:fund", "loan", "head:tds"]);
    assert.equal(s.balanced, true);
    assert.deepEqual([s.gross, s.totalDeductions, s.net], ["42100.00", "14930.00", "27170.00"]);
  });

  it("statutory lines get bilingual labels; custom heads use their Nepali name", () => {
    const s = payslipStatement(slip, heads);
    assert.equal(s.deductions.find((l) => l.key === "head:tds")?.label.np, "आयकर (स्रोतमा कट्टी)");
    assert.equal(s.deductions.find((l) => l.key === "head:ssf")?.note?.en, "11% yours + 20% employer's");
    assert.equal(s.earnings.find((l) => l.key === "head:transport")?.label.np, "यातायात भत्ता");
    assert.equal(s.deductions.find((l) => l.key === "head:fund")?.label.np, "Staff welfare fund");
  });

  it("an override prints the typed amount and is marked", () => {
    const h = head({ payHeadId: "x", amount: "2500", calculatedAmount: "2000", isManualOverride: true });
    assert.equal(lineAmount(h).toString(), "2500");
    assert.equal(payslipStatement(slip, [h]).earnings.find((l) => l.key === "head:x")?.adjusted, true);
  });

  it("flags a payslip whose lines do not reach its totals", () => {
    assert.equal(payslipStatement({ ...slip, grossEarnings: "99999" }, heads).balanced, false);
  });

  it("an off-cycle payslip prints its own lines only, and employer PF shows apart", () => {
    const s = payslipStatement(
      { basicSalary: "0", gradeAmount: "0", otAmount: "0", absentDeduction: "0", loanDeduction: "0", grossEarnings: "35000", totalDeductions: "315", netPayable: "34685", pfEmployer: "0" },
      [head({ payHeadId: "dashain", payHeadName: "Dashain allowance", calculatedAmount: "35000" }), head({ payHeadId: "tds", headType: "deduction", calculatedAmount: "315", role: "tds" })],
    );
    assert.deepEqual(s.earnings.map((l) => l.key), ["head:dashain"]);
    assert.equal(s.balanced, true);
    assert.equal(payslipStatement({ ...slip, pfEmployer: "3300" }, heads).employerPf, "3300.00");
  });

  it("roles come from the pay-head flags; languages default to both", () => {
    assert.equal(headRole({ isTdsHead: true }), "tds");
    assert.equal(headRole({ isSsfEmployerHead: true, isSsfHead: true }), "ssfEmployer");
    assert.equal(headRole({}), null);
    assert.equal(asPayslipLanguage("np"), "np");
    assert.equal(asPayslipLanguage("fr"), "both");
  });
});

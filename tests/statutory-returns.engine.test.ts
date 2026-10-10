import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  certificateTotals,
  citCsv,
  citSchedule,
  contributionBase,
  etdsCsv,
  etdsLines,
  pfSchedule,
  settlementTaxItem,
  slipTaxItem,
  socialSecurityBand,
  splitSocialSecurityTax,
  ssfCsv,
  ssfSchedule,
  tdsRowFromSlip,
  voucherSummary,
  type SettlementFact,
  type SlipFact,
  type TaxItem,
} from "@/lib/engines/statutory-returns.engine";

const slab = (amountFrom: string, amountTo: string | null, ratePercent: string) => ({ id: amountFrom, category: "Normal Single", amountFrom, amountTo, ratePercent, fixedDeduction: "0" });
// SST: 1% of the part of the income inside the first 5,00,000.
const BAND = new Decimal(500000);
const sstOn = (annual: Decimal) => Decimal.min(annual, BAND).times(0.01);

const item = (over: Partial<TaxItem> & { key: string; fiscalMonthIndex: number }): TaxItem => ({
  order: 0,
  taxable: 50000,
  tds: 2000,
  annualTaxable: null,
  closing: false,
  flatRate: false,
  ssf: false,
  ...over,
});

const slip = (over: Partial<SlipFact> = {}): SlipFact => ({
  slipId: "s1",
  employeeId: "e1",
  employeeCode: "EMP-001",
  employeeName: "Sita Sharma",
  pan: "601234567",
  ssfNumber: "SS-1001",
  pfNumber: null,
  citNumber: "CIT-77",
  payYear: 2083,
  payMonth: 4,
  fiscalMonthIndex: 1,
  paymentDateBs: "2083-04-32",
  basicSalary: "30000",
  gradeAmount: "3000",
  grossEarnings: "39600",
  taxableIncome: "29370",
  tds: "1200",
  ssfEmployee: "3630.00",
  ssfEmployer: "6600.00",
  pfEmployee: "0",
  pfEmployer: "0",
  cit: "1000",
  projectedAnnualTaxable: null,
  isYearEnd: false,
  flatRate: false,
  ...over,
});

describe("social security band", () => {
  it("is the first slab's top when that slab is the 1% band", () => {
    assert.equal(socialSecurityBand([slab("0", "500000", "1"), slab("500000", "700000", "10")])?.toString(), "500000");
    assert.equal(socialSecurityBand([slab("0", "500000", "10")]), null);
    assert.equal(socialSecurityBand([]), null);
  });
});

describe("TDS split between 11211 and 11112", () => {
  it("collects the year's SST evenly and exactly by the year-end slip", () => {
    const items = Array.from({ length: 12 }, (_, i) => item({ key: `m${i + 1}`, fiscalMonthIndex: i + 1, annualTaxable: i < 11 ? 600000 : null, closing: i === 11 }));
    const split = splitSocialSecurityTax(items, sstOn);
    const ssts = items.map((it) => Number(split.get(it.key)!.sst));
    assert.equal(ssts[0], 417); // 5,000 ÷ 12, whole rupees
    assert.equal(ssts.reduce((a, b) => a + b, 0), 5000);
    for (const it of items) {
      const s = split.get(it.key)!;
      assert.equal(new Decimal(s.sst).plus(s.remuneration).toFixed(2), "2000.00");
    }
  });

  it("an SSF contributor or a flat-rate payee pays no SST", () => {
    const split = splitSocialSecurityTax([item({ key: "a", fiscalMonthIndex: 1, ssf: true }), item({ key: "b", fiscalMonthIndex: 2, flatRate: true })], sstOn);
    assert.deepEqual(split.get("a"), { sst: "0.00", remuneration: "2000.00" });
    assert.deepEqual(split.get("b"), { sst: "0.00", remuneration: "2000.00" });
  });

  it("SST never exceeds the TDS withheld", () => {
    const split = splitSocialSecurityTax([item({ key: "a", fiscalMonthIndex: 12, closing: true, taxable: 600000, tds: 300 })], sstOn);
    assert.deepEqual(split.get("a"), { sst: "300.00", remuneration: "0.00" });
  });

  it("a final settlement closes the year's SST after the month's payslip", () => {
    const items = [
      item({ key: "m1", fiscalMonthIndex: 1, annualTaxable: 600000 }),
      item({ key: "m2", fiscalMonthIndex: 2, annualTaxable: 600000 }),
      item({ key: "fs", fiscalMonthIndex: 2, order: 1, closing: true, annualTaxable: 300000, taxable: 200000, tds: 9000 }),
    ];
    const split = splitSocialSecurityTax(items, sstOn);
    // 417 + 417 collected; the year closes at 3,000 of SST on 3,00,000.
    assert.equal(split.get("fs")!.sst, "2166.00");
    assert.equal(split.get("fs")!.remuneration, "6834.00");
  });

  it("derives the projection when an older slip has no tax sheet", () => {
    const split = splitSocialSecurityTax([item({ key: "a", fiscalMonthIndex: 1, taxable: 50000 })], sstOn);
    assert.equal(split.get("a")!.sst, "417.00"); // 50,000 × 12 = 6,00,000 projected
  });

  it("maps slips and settlements to items", () => {
    assert.equal(slipTaxItem(slip({ isYearEnd: true, projectedAnnualTaxable: "999" }), false).annualTaxable, null);
    assert.equal(slipTaxItem(slip({ projectedAnnualTaxable: "999" }), false).annualTaxable, "999");
    const fs = { settlementId: "x", fiscalMonthIndex: 3, taxable: "1", tds: "2", annualTaxable: "3" } as SettlementFact;
    assert.deepEqual({ ...settlementTaxItem(fs, true) }, { key: "x", fiscalMonthIndex: 3, order: 1, taxable: "1", tds: "2", annualTaxable: "3", closing: true, flatRate: false, ssf: true });
  });
});

describe("contribution base", () => {
  it("matches basic + grade or basic only, else amount ÷ rate", () => {
    assert.equal(contributionBase(30000, 3000, "3630.00", 0.11).toString(), "33000");
    assert.equal(contributionBase(30000, 3000, "3300.00", 0.11).toString(), "30000");
    assert.equal(contributionBase(30000, 3000, "1100.00", 0.11).toString(), "10000");
    assert.equal(contributionBase(30000, 3000, "0", 0.11).toString(), "0");
  });
});

describe("fund schedules", () => {
  it("SSF: one row per employee, merged across runs, missing IDs counted", () => {
    const s = ssfSchedule([slip(), slip({ slipId: "s2", basicSalary: "10000", gradeAmount: "0", ssfEmployee: "1100", ssfEmployer: "2000" }), slip({ slipId: "s3", employeeId: "e2", employeeName: "Ram", ssfNumber: null }), slip({ slipId: "s4", employeeId: "e3", employeeName: "Hari", ssfEmployee: "0", ssfEmployer: "0" })]);
    assert.equal(s.rows.length, 2);
    const sita = s.rows.find((r) => r.employeeId === "e1")!;
    assert.deepEqual([sita.base, sita.employee, sita.employer, sita.total], ["43000.00", "4730.00", "8600.00", "13330.00"]);
    assert.equal(s.missingNumbers, 1);
    assert.equal(s.totals.total, "23560.00");
  });

  it("PF uses the PF columns and number", () => {
    const s = pfSchedule([slip({ ssfEmployee: "0", ssfEmployer: "0", pfEmployee: "3000", pfEmployer: "3000", pfNumber: "PF-9" })]);
    assert.deepEqual([s.rows[0].number, s.rows[0].base, s.rows[0].total], ["PF-9", "30000.00", "6000.00"]);
  });

  it("CIT lists deductions with the CIT number", () => {
    const c = citSchedule([slip(), slip({ slipId: "s2", employeeId: "e2", employeeName: "Ram", cit: "0" })]);
    assert.equal(c.rows.length, 1);
    assert.equal(c.total, "1000.00");
    assert.match(citCsv(c), /^SN,CITNumber,Name,EmployeeCode,Amount\r\n1,CIT-77,Sita Sharma,EMP-001,1000.00\r\n$/);
  });
});

describe("eTDS", () => {
  const rows = [tdsRowFromSlip(slip(), { sst: "0.00", remuneration: "1200.00" }), tdsRowFromSlip(slip({ slipId: "s2", employeeId: "e2", employeeName: "Ram, Thapa", pan: null, tds: "900" }), { sst: "417.00", remuneration: "483.00" })];

  it("one line per revenue code with tax, SST first, numbered", () => {
    const lines = etdsLines(rows);
    assert.deepEqual(
      lines.map((l) => [l.sn, l.employeeName, l.revenueCode, l.tds]),
      [
        [1, "Ram, Thapa", "11211", "417.00"],
        [2, "Ram, Thapa", "11112", "483.00"],
        [3, "Sita Sharma", "11112", "1200.00"],
      ],
    );
    assert.deepEqual(voucherSummary(lines), [
      { revenueCode: "11211", transactions: 1, tds: "417.00" },
      { revenueCode: "11112", transactions: 2, tds: "1683.00" },
    ]);
  });

  it("the file quotes commas and never starts a cell with a formula", () => {
    const file = etdsCsv(etdsLines([tdsRowFromSlip(slip({ employeeName: "=cmd|x" }), { sst: "0.00", remuneration: "10.00" }), ...rows]));
    assert.ok(file.includes('"Ram, Thapa"'));
    assert.ok(!/(^|,)=/m.test(file));
    assert.ok(file.endsWith("\r\n"));
  });

  it("the SSF file carries the SSID", () => {
    assert.match(ssfCsv(ssfSchedule([slip()])), /\r\n1,SS-1001,Sita Sharma,EMP-001,33000.00,3630.00,6600.00,10230.00\r\n$/);
  });
});

describe("certificate", () => {
  it("adds the year up", () => {
    const line = { label: "Shrawan 2083", labelNp: "साउन २०८३", source: "payroll" as const, paymentDateBs: "2083-04-32", gross: "100.50", retirement: "10", taxable: "90.50", sst: "1", remuneration: "2", tds: "3" };
    assert.deepEqual(certificateTotals([line, { ...line, gross: "0.50" }]), { gross: "101.00", retirement: "20.00", taxable: "181.00", sst: "2.00", remuneration: "4.00", tds: "6.00" });
  });
});

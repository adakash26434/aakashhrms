import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  asRunType,
  calculateOffCycleSlip,
  completedServiceMonths,
  festivalShare,
  isMarginalSheet,
  isOffCycle,
  marginalTax,
  projectedBefore,
} from "@/lib/engines/off-cycle.engine";
import { occasionalHeadAmount } from "@/lib/engines/payroll.engine";

// 1% to 5,00,000 · 10% to 7,00,000 · 20% above (enough for the tests).
const taxOn = (a: Decimal) => {
  const slab = (from: number, to: number, rate: number) => Decimal.max(0, Decimal.min(a, to).minus(from)).times(rate);
  return slab(0, 500000, 0.01).plus(slab(500000, 700000, 0.1)).plus(slab(700000, 1e12, 0.2));
};
const TDS = { id: "tds", name: "TDS" };

describe("run types", () => {
  it("unknown values are regular", () => {
    assert.equal(asRunType("FESTIVAL"), "FESTIVAL");
    assert.equal(asRunType("BONUS"), "REGULAR");
    assert.equal(isOffCycle("ARREARS"), true);
    assert.equal(isOffCycle(undefined), false);
  });
});

describe("festival allowance (Labour Act 2074 §37)", () => {
  it("a year or more of service gets the whole allowance, otherwise completed months ÷ 12", () => {
    assert.equal(completedServiceMonths("2025-03-15", "2025-11-14"), 7);
    assert.equal(completedServiceMonths("2025-03-15", "2025-11-15"), 8);
    assert.equal(festivalShare("2025-03-15", "2025-11-15").toFixed(4), "0.6667");
    assert.equal(festivalShare("2020-01-01", "2025-11-15").toString(), "1");
    assert.equal(festivalShare("2026-01-01", "2025-11-15").toString(), "0");
  });

  it("the head rule is shared with the regular engine", () => {
    const head = { isFestivalAllowance: true, isRemoteAllowance: false, isManualOverride: false, calcBasis: "BasicSalary", calcPercent: "0", amount: "0" };
    const opts = { festivalMonth: true, remoteMonth: false, remoteLimit: 0 };
    assert.equal(occasionalHeadAmount(head, new Decimal(30000), new Decimal(33000), opts)?.toString(), "30000");
    assert.equal(occasionalHeadAmount({ ...head, calcBasis: "BasicPlusGrade" }, new Decimal(30000), new Decimal(33000), opts)?.toString(), "33000");
    assert.equal(occasionalHeadAmount(head, new Decimal(30000), new Decimal(33000), { ...opts, festivalMonth: false }), null);
    assert.equal(occasionalHeadAmount({ ...head, isManualOverride: true, amount: "123" }, new Decimal(30000), new Decimal(33000), opts)?.toString(), "123");
    const remote = { ...head, isFestivalAllowance: false, isRemoteAllowance: true, calcBasis: "BasicSalary", calcPercent: "50" };
    assert.equal(occasionalHeadAmount(remote, new Decimal(30000), new Decimal(33000), { festivalMonth: false, remoteMonth: true, remoteLimit: 10000 })?.toString(), "10000");
  });
});

describe("marginal tax", () => {
  it("is the extra annual tax the payment causes", () => {
    // 4,80,000 projected: the first 20,000 of a 50,000 bonus is in the 1% band, the rest at 10%.
    assert.equal(marginalTax(480000, 50000, taxOn).toString(), "3200");
    assert.equal(marginalTax(800000, 50000, taxOn).toString(), "10000");
    assert.equal(marginalTax(800000, 0, taxOn).toString(), "0");
  });

  it("projects the year from what is paid plus the regular months ahead", () => {
    assert.equal(projectedBefore({ ytdTaxable: 120000, regularMonthlyTaxable: 40000, monthsAhead: 9 }).toString(), "480000");
  });
});

describe("off-cycle payslip", () => {
  const lines = [{ payHeadId: "fest", payHeadName: "Dashain allowance", amount: "50000", taxable: true }];

  it("pays the lines and withholds the marginal tax, nothing else", () => {
    const slip = calculateOffCycleSlip({ category: "Permanent", lines, base: 480000, taxOn, tdsHead: TDS });
    assert.deepEqual(
      [slip.basicSalary, slip.grossEarnings, slip.taxableIncome, slip.tdsThisMonth, slip.netPayable, slip.ssfEmployee, slip.loanDeduction],
      ["0", "50000.00", "50000.00", "3200", "46800.00", "0", "0"],
    );
    assert.equal(slip.heads.length, 2);
    assert.ok(isMarginalSheet(slip.marginal));
    assert.equal(slip.marginal?.marginalBase, "480000.00");
  });

  it("contract is a flat 15%, trainees and volunteers pay none", () => {
    assert.equal(calculateOffCycleSlip({ category: "Contract", lines, base: 0, taxOn, tdsHead: TDS }).tdsThisMonth, "7500");
    const trainee = calculateOffCycleSlip({ category: "Trainee", lines, base: 900000, taxOn, tdsHead: TDS });
    assert.equal(trainee.tdsThisMonth, "0");
    assert.equal(trainee.heads.length, 1);
  });

  it("drops zero lines and needs a TDS head when tax is due", () => {
    const slip = calculateOffCycleSlip({ category: "Permanent", lines: [...lines, { payHeadId: "x", payHeadName: "X", amount: 0, taxable: true }], base: 0, taxOn, tdsHead: TDS });
    assert.equal(slip.heads.filter((h) => h.headType === "allowance").length, 1);
    assert.throws(() => calculateOffCycleSlip({ category: "Permanent", lines, base: 480000, taxOn, tdsHead: null }), /TDS/);
  });

  it("a non-taxable line is paid but not taxed", () => {
    const slip = calculateOffCycleSlip({ category: "Permanent", lines: [{ ...lines[0], taxable: false }], base: 800000, taxOn, tdsHead: TDS });
    assert.deepEqual([slip.grossEarnings, slip.taxableIncome, slip.tdsThisMonth], ["50000.00", "0.00", "0"]);
  });
});

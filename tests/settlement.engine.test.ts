import test from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { buildSettlement, canMove, completedYears, DEFAULT_POLICY, normalizePolicy, type SettlementInput } from "@/lib/engines/settlement.engine";

// 1% on the first 500,000, 10% above.
const taxOn = (a: Decimal) => (a.lte(500000) ? a.times(0.01) : new Decimal(5000).plus(a.minus(500000).times(0.1)));

const base: SettlementInput = {
  kind: "resignation",
  monthlyBasic: "30000",
  monthlyGrade: "3000",
  periods: [{ label: "Falgun", workedDays: 15, monthDays: 30 }],
  leave: [{ leaveType: "Home leave", days: 10, perDayRate: "1000.00" }],
  noticeServedDays: 30,
  yearsOfService: 5,
  loanOutstanding: "0",
  past: [],
  taxOn,
  policy: DEFAULT_POLICY,
};

test("salary is pro rata on basic + grade, leave at the type's rate", () => {
  const s = buildSettlement(base);
  const salary = s.lines.find((l) => l.code === "salary")!;
  assert.equal(salary.amount, "16500.00");
  assert.equal(s.lines.find((l) => l.code === "leave")!.amount, "10000.00");
  assert.equal(s.earnings, "26500.00");
});

test("gratuity is off by default and needs the company's rate when on", () => {
  assert.ok(!buildSettlement(base).lines.some((l) => l.code === "gratuity"));
  const on = buildSettlement({ ...base, policy: { ...DEFAULT_POLICY, gratuity: { enabled: true, minYears: 3, monthsPerYear: 0.5 } } });
  assert.equal(on.lines.find((l) => l.code === "gratuity")!.amount, "75000.00"); // 30000 × 0.5 × 5
  const tooShort = buildSettlement({ ...base, yearsOfService: 2, policy: { ...DEFAULT_POLICY, gratuity: { enabled: true, minYears: 3, monthsPerYear: 0.5 } } });
  assert.ok(!tooShort.lines.some((l) => l.code === "gratuity"));
  const fired = buildSettlement({ ...base, kind: "termination", policy: { ...DEFAULT_POLICY, gratuity: { enabled: true, minYears: 3, monthsPerYear: 0.5 } } });
  assert.ok(!fired.lines.some((l) => l.code === "gratuity"));
});

test("notice shortfall applies to resignation only, at monthly pay ÷ 30 a day", () => {
  const policy = { ...DEFAULT_POLICY, noticeDays: 30 };
  const s = buildSettlement({ ...base, noticeServedDays: 10, policy });
  assert.equal(s.lines.find((l) => l.code === "notice")!.amount, "22000.00"); // 20 × 1100
  assert.ok(!buildSettlement({ ...base, kind: "retirement", noticeServedDays: 0, policy }).lines.some((l) => l.code === "notice"));
  assert.ok(!buildSettlement({ ...base, noticeServedDays: 30, policy }).lines.some((l) => l.code === "notice"));
});

test("loan outstanding is deducted; net can go negative and flags a recovery", () => {
  const s = buildSettlement({ ...base, leave: [], loanOutstanding: "50000" });
  assert.equal(s.lines.find((l) => l.code === "loan")!.amount, "50000.00");
  assert.equal(s.net, "-33665.00");
  assert.equal(s.recovery, true);
});

test("final TDS is the tax on earlier + settlement taxable income less TDS already paid", () => {
  const past = Array.from({ length: 6 }, () => ({ taxableIncome: "100000", tds: "1000" }));
  const s = buildSettlement({ ...base, past });
  // taxable now 26,500; annual 626,500; tax 5,000 + 12,650 = 17,650; minus 6,000 paid
  assert.equal(s.lines.find((l) => l.code === "tds")!.amount, "11650.00");
  assert.equal(s.taxSheet!.monthsRemaining, 1);
  assert.equal(s.net, new Decimal("26500").minus("11650").toFixed(2));
});

test("no tax line when TDS already covers the year", () => {
  const past = [{ taxableIncome: "100000", tds: "99999" }];
  assert.ok(!buildSettlement({ ...base, past }).lines.some((l) => l.code === "tds"));
});

test("completedYears counts anniversaries", () => {
  assert.equal(completedYears("2020-05-10", "2025-05-09"), 4);
  assert.equal(completedYears("2020-05-10", "2025-05-10"), 5);
  assert.equal(completedYears("2025-01-01", "2024-01-01"), 0);
});

test("policy input is cleaned", () => {
  assert.deepEqual(normalizePolicy({ noticeDays: -5, gratuity: { enabled: "yes", monthsPerYear: 99 } }), { noticeDays: 0, gratuity: { enabled: false, minYears: 0, monthsPerYear: 12 } });
});

test("approval needs a second person; only draft→approved→paid", () => {
  assert.ok(canMove("draft", "approved", "a", "a"));
  assert.equal(canMove("draft", "approved", "a", "b"), null);
  assert.equal(canMove("approved", "paid", "a", "a"), null);
  assert.ok(canMove("paid", "draft", "a", "b"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULE, applyIncrement, describeRule, ruleErrors, type IncrementContext, type IncrementRule } from "@/lib/engines/increment.engine";
import type { StructureLines } from "@/lib/types/salary-structure";

const lines = (basic: number, gradeCount = 2): StructureLines => ({ basic, gradeCount, gradeAmount: 1000, gradeManual: false, scheme: "ssf", amounts: { a: 1500 }, computed: ["c"] });
const ctx: IncrementContext = { levelStart: 30000, levelMax: 60000, maxGrades: 10, gradesOff: false };
const rule = (over: Partial<IncrementRule>): IncrementRule => ({ ...DEFAULT_RULE, ...over });

test("percent: basic up and rounded up, everything else kept", () => {
  const r = applyIncrement(lines(33333), rule({ basic: "percent", value: 5, roundTo: 10 }), ctx);
  assert.equal(r.lines.basic, 35000); // 34999.65 → 35000
  assert.deepEqual({ ...r.lines, basic: 0 }, { ...lines(0) });
  assert.equal(r.changed, true);
  assert.equal(applyIncrement(lines(33333), rule({ basic: "percent", value: 5, roundTo: 1 }), ctx).lines.basic, 35000);
  assert.equal(applyIncrement(lines(33310), rule({ basic: "percent", value: 5, roundTo: 1 }), ctx).lines.basic, 34976); // 34975.5 → up
});

test("amount and grades, within the grade policy's cap", () => {
  const r = applyIncrement(lines(40000, 9), rule({ basic: "amount", value: 1500, roundTo: 100, grades: 2 }), ctx);
  assert.equal(r.lines.basic, 41500);
  assert.equal(r.lines.gradeCount, 10);
  assert.deepEqual(r.notes, ["grades capped at 10"]);
  const atCap = applyIncrement(lines(40000, 10), rule({ basic: "none", grades: 1 }), ctx);
  assert.equal(atCap.changed, false);
  assert.deepEqual(atCap.notes, ["already at 10 grades (the most)"]);
  // Someone above the cap (older data) keeps their grades.
  assert.equal(applyIncrement(lines(40000, 12), rule({ basic: "none", grades: 1 }), ctx).lines.gradeCount, 12);
  assert.deepEqual(applyIncrement(lines(40000), rule({ basic: "none", grades: 1 }), { ...ctx, gradesOff: true }).notes, ["grades are switched off in the grade policy"]);
});

test("the level's maximum caps the basic, never lowering it", () => {
  const capped = applyIncrement(lines(58000), rule({ basic: "percent", value: 10 }), ctx);
  assert.equal(capped.lines.basic, 60000);
  assert.match(capped.notes[0], /capped at the level's maximum \(60,000\)/);
  const above = applyIncrement(lines(65000), rule({ basic: "percent", value: 10 }), ctx);
  assert.equal(above.lines.basic, 65000);
  assert.match(above.notes[0], /already at the level's maximum/);
  assert.equal(applyIncrement(lines(58000), rule({ basic: "percent", value: 10, capAtLevelMax: false }), ctx).lines.basic, 63800);
  assert.equal(applyIncrement(lines(58000), rule({ basic: "percent", value: 10 }), { ...ctx, levelMax: 0 }).lines.basic, 63800);
});

test("raise to the level's starting salary (pay-scale revision) only lifts those below it", () => {
  assert.equal(applyIncrement(lines(28000), rule({ basic: "level_start" }), ctx).lines.basic, 30000);
  const above = applyIncrement(lines(32000), rule({ basic: "level_start" }), ctx);
  assert.equal(above.changed, false);
  assert.deepEqual(above.notes, ["already at or above the level's starting salary"]);
});

test("rules are checked: increases only, sane sizes, something to do", () => {
  assert.deepEqual(ruleErrors(DEFAULT_RULE), {});
  assert.ok(ruleErrors(rule({ value: 0 })).value);
  assert.ok(ruleErrors(rule({ value: 51 })).value);
  assert.ok(ruleErrors(rule({ basic: "amount", value: -100 })).value);
  assert.ok(ruleErrors(rule({ grades: 6 })).grades);
  assert.ok(ruleErrors(rule({ grades: 1.5 })).grades);
  assert.ok(ruleErrors(rule({ roundTo: 7 as never })).roundTo);
  assert.ok(ruleErrors(rule({ basic: "none", grades: 0 })).basic);
  assert.deepEqual(ruleErrors(rule({ basic: "none", grades: 1 })), {});
});

test("the rule in words", () => {
  assert.equal(describeRule(rule({ basic: "percent", value: 5, roundTo: 10, grades: 1 })), "basic +5% (rounded up to 10), +1 grade");
  assert.equal(describeRule(rule({ basic: "amount", value: 1500, roundTo: 1 })), "basic +1,500");
  assert.equal(describeRule(rule({ basic: "level_start", grades: 0 })), "basic raised to the level's starting salary");
  assert.equal(describeRule(rule({ basic: "none", grades: 2 })), "+2 grades");
});

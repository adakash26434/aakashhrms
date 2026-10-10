import Decimal from "decimal.js";
import type { StructureLines } from "@/lib/types/salary-structure";

// Mass increment (4.8 / F14): one rule applied to many salary structures at once — basic up by a
// percentage or an amount (or raised to the level's starting salary after a pay-scale revision),
// grades added within the grade policy's cap — producing the new lines that Bulk edit shows,
// reviews and sends as one salary-change batch through the approval flow. Increments only: a rule
// never lowers anyone's basic or grades. Pure; the grade amount is worked out afterwards by the
// grade policy (gradeAmountFor), as for any edited row.

export type BasicRule = "none" | "percent" | "amount" | "level_start";
export const BASIC_RULES: readonly BasicRule[] = ["none", "percent", "amount", "level_start"];
export const ROUNDINGS = [1, 10, 50, 100] as const;
export type Rounding = (typeof ROUNDINGS)[number];

export const MAX_PERCENT = 50;
export const MAX_AMOUNT = 100_000;
export const MAX_GRADES_AT_ONCE = 5;

export interface IncrementRule {
  basic: BasicRule;
  /** Percent (0 < v ≤ 50) or rupees (0 < v ≤ 1,00,000); unused for none / level_start. */
  value: number;
  /** The new basic is rounded up to this many rupees. */
  roundTo: Rounding;
  /** Grades added (0–5); the per-level cap of the grade policy applies. */
  grades: number;
  /** Not above the level's maximum salary, when the level has one. */
  capAtLevelMax: boolean;
}

export const DEFAULT_RULE: IncrementRule = { basic: "percent", value: 5, roundTo: 10, grades: 0, capAtLevelMax: true };

export interface IncrementContext {
  /** The level's starting salary (0: none). */
  levelStart: number;
  /** The level's maximum salary (0: none). */
  levelMax: number;
  /** The grade policy's grades per level (0: no cap). */
  maxGrades: number;
  /** Grades are switched off in the grade policy. */
  gradesOff: boolean;
}

export interface IncrementResult {
  lines: StructureLines;
  /** Why a row got less than the rule ("capped at the level's maximum"). */
  notes: string[];
  changed: boolean;
}

/** Errors in a rule before it is applied (keys: basic, value, roundTo, grades). */
export function ruleErrors(rule: IncrementRule): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!BASIC_RULES.includes(rule.basic)) errors.basic = "Choose how the basic salary changes";
  if (rule.basic === "percent" && !(rule.value > 0 && rule.value <= MAX_PERCENT)) errors.value = `Give a percentage above 0 and at most ${MAX_PERCENT}`;
  if (rule.basic === "amount" && !(rule.value > 0 && rule.value <= MAX_AMOUNT)) errors.value = `Give an amount above 0 and at most ${MAX_AMOUNT.toLocaleString("en-IN")}`;
  if (!(ROUNDINGS as readonly number[]).includes(rule.roundTo)) errors.roundTo = "Choose how the new basic is rounded";
  if (!Number.isInteger(rule.grades) || rule.grades < 0 || rule.grades > MAX_GRADES_AT_ONCE) errors.grades = `Add 0 to ${MAX_GRADES_AT_ONCE} grades`;
  if (!errors.basic && !errors.grades && rule.basic === "none" && rule.grades === 0) errors.basic = "Choose a basic salary increase or grades to add";
  return errors;
}

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** Rounded up to the next multiple (so nobody gets less than the rule gives). */
function roundUp(amount: Decimal, to: Rounding): Decimal {
  return amount.dividedBy(to).toDecimalPlaces(0, Decimal.ROUND_CEIL).times(to);
}

/** One structure after the rule. Basic and grades never go down. */
export function applyIncrement(lines: StructureLines, rule: IncrementRule, ctx: IncrementContext): IncrementResult {
  const notes: string[] = [];
  const old = new Decimal(lines.basic || 0);
  let basic = old;
  if (rule.basic === "percent") basic = roundUp(old.times(new Decimal(100).plus(rule.value)).dividedBy(100), rule.roundTo);
  else if (rule.basic === "amount") basic = roundUp(old.plus(rule.value), rule.roundTo);
  else if (rule.basic === "level_start") {
    if (ctx.levelStart > 0 && old.lt(ctx.levelStart)) basic = new Decimal(ctx.levelStart);
    else notes.push(ctx.levelStart > 0 ? "already at or above the level's starting salary" : "the level has no starting salary");
  }
  if (rule.capAtLevelMax && ctx.levelMax > 0 && basic.gt(ctx.levelMax) && basic.gt(old)) {
    basic = Decimal.max(old, new Decimal(ctx.levelMax));
    notes.push(old.gte(ctx.levelMax) ? `already at the level's maximum (${money(ctx.levelMax)})` : `capped at the level's maximum (${money(ctx.levelMax)})`);
  }

  let gradeCount = lines.gradeCount;
  if (rule.grades > 0) {
    if (ctx.gradesOff) notes.push("grades are switched off in the grade policy");
    else {
      const wanted = lines.gradeCount + rule.grades;
      const cap = ctx.maxGrades > 0 ? Math.max(ctx.maxGrades, lines.gradeCount) : Infinity;
      gradeCount = Math.min(wanted, cap);
      if (gradeCount < wanted) notes.push(gradeCount === lines.gradeCount ? `already at ${lines.gradeCount} grades (the most)` : `grades capped at ${gradeCount}`);
    }
  }

  const next: StructureLines = { ...lines, basic: basic.toDecimalPlaces(2).toNumber(), gradeCount };
  return { lines: next, notes, changed: next.basic !== lines.basic || next.gradeCount !== lines.gradeCount };
}

/** The rule in words, for the batch's reason and the notice ("basic +5% (rounded up to 10), +1 grade"). */
export function describeRule(rule: IncrementRule): string {
  const rounded = rule.roundTo > 1 ? ` (rounded up to ${rule.roundTo})` : "";
  const basic =
    rule.basic === "percent"
      ? `basic +${rule.value}%${rounded}`
      : rule.basic === "amount"
        ? `basic +${money(rule.value)}${rounded}`
        : rule.basic === "level_start"
          ? "basic raised to the level's starting salary"
          : null;
  const grades = rule.grades > 0 ? `+${rule.grades} grade${rule.grades === 1 ? "" : "s"}` : null;
  return [basic, grades].filter(Boolean).join(", ");
}

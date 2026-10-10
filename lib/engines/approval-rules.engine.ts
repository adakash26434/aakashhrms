/**
 * Custom approval rules (4.12d) for salary changes — pure.
 *
 * A rule sends a salary change to its own approvers when its conditions
 * hold: a raise above a percentage, a change to the monthly salary bill
 * above an amount (up or down), a new total salary above an amount, or
 * someone in chosen branches or departments. The conditions about a person
 * must hold for the same person; the bill condition is the change's total.
 * Rules are read in order: the first that applies decides, and the company
 * policy decides when none does. A rule always asks for approval (simple or
 * levels): it never removes it. The flow is fixed on the change when it is
 * submitted, like any other. Tests: tests/approval-rules.engine.test.ts.
 */

import { MAX_APPROVAL_LEVELS, validatePolicy } from "@/lib/engines/approval.engine";
import type { ApprovalPolicy, ApprovalRule, ApprovalRuleConditions, ApproverInfo } from "@/lib/types/approval";

export const MAX_RULES = 10;
export const RULE_NAME_MAX = 60;

/** One person in a salary change, as the rules see them. */
export interface ChangeFact {
  /** Total salary a month before the change (null: no salary yet — a new hire's first structure). */
  before: number | null;
  after: number;
  branchId: string | null;
  departmentId: string | null;
}

export interface ChangeFacts {
  /** The change to the monthly salary bill (all people; negative when it falls). */
  monthlyChange: number;
  people: readonly ChangeFact[];
}

export const EMPTY_CONDITIONS: ApprovalRuleConditions = { raisePercentOver: null, monthlyChangeOver: null, newTotalOver: null, branchIds: [], departmentIds: [] };

/** A person's raise in percent (null: no salary before, or none to compare). */
export const raisePercent = (p: Pick<ChangeFact, "before" | "after">): number | null => (p.before && p.before > 0 ? ((p.after - p.before) / p.before) * 100 : null);

const personal = (w: ApprovalRuleConditions) => w.raisePercentOver !== null || w.newTotalOver !== null || w.branchIds.length > 0 || w.departmentIds.length > 0;

/** Whether one person meets every condition about a person. */
function personMeets(w: ApprovalRuleConditions, p: ChangeFact): boolean {
  if (w.raisePercentOver !== null) {
    const raise = raisePercent(p);
    if (raise === null || !(raise > w.raisePercentOver)) return false;
  }
  if (w.newTotalOver !== null && !(p.after > w.newTotalOver)) return false;
  if (w.branchIds.length && !(p.branchId && w.branchIds.includes(p.branchId))) return false;
  if (w.departmentIds.length && !(p.departmentId && w.departmentIds.includes(p.departmentId))) return false;
  return true;
}

/** Whether a rule applies to a change: the bill condition, and someone meeting the conditions about a person. */
export function ruleApplies(rule: Pick<ApprovalRule, "when">, change: ChangeFacts): boolean {
  const w = rule.when;
  if (w.monthlyChangeOver !== null && !(Math.abs(change.monthlyChange) > w.monthlyChangeOver)) return false;
  return !personal(w) || change.people.some((p) => personMeets(w, p));
}

/** The policy a change gets: the first rule that applies, else the company policy. */
export function policyForChange(settings: { policy: ApprovalPolicy; rules: readonly ApprovalRule[] }, change: ChangeFacts): { policy: ApprovalPolicy; rule: ApprovalRule | null } {
  const rule = settings.rules.find((r) => ruleApplies(r, change)) ?? null;
  return rule ? { policy: rule.then, rule } : { policy: settings.policy, rule: null };
}

// ---------------------------------------------------------------------------
// Reading and checking
// ---------------------------------------------------------------------------

const amount = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))].slice(0, 200) : []);
const text = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** A rule from storage or the browser: known fields only; a rule asks for simple or levels approval. */
export function normalizeRule(raw: unknown): ApprovalRule {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const w = (r.when && typeof r.when === "object" ? r.when : {}) as Record<string, unknown>;
  const t = (r.then && typeof r.then === "object" ? r.then : {}) as Record<string, unknown>;
  const levels = Array.isArray(t.levels) ? t.levels.filter((x): x is string => typeof x === "string").slice(0, MAX_APPROVAL_LEVELS) : [];
  return {
    id: text(r.id),
    name: text(r.name),
    when: {
      raisePercentOver: amount(w.raisePercentOver),
      monthlyChangeOver: amount(w.monthlyChangeOver),
      newTotalOver: amount(w.newTotalOver),
      branchIds: ids(w.branchIds),
      departmentIds: ids(w.departmentIds),
    },
    then: t.type === "multi_level" ? { type: "multi_level", levels } : { type: "simple", levels: [] },
  };
}

/** The stored list (anything unreadable is dropped). */
export function readRules(stored: unknown): ApprovalRule[] {
  if (!Array.isArray(stored)) return [];
  return stored
    .map(normalizeRule)
    .filter((r) => r.id && r.name)
    .slice(0, MAX_RULES);
}

/** Errors in a rule before saving (keys: name, when, raisePercentOver, …, levels, level.N). */
export function validateRule(
  rule: ApprovalRule,
  ctx: { otherNames: readonly string[]; approvers: readonly ApproverInfo[]; branchIds: readonly string[]; departmentIds: readonly string[] }
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!rule.name) e.name = "Give the rule a name.";
  else if (rule.name.length > RULE_NAME_MAX) e.name = `At most ${RULE_NAME_MAX} characters.`;
  else if (ctx.otherNames.some((n) => n.trim().toLowerCase() === rule.name.toLowerCase())) e.name = "Another rule has this name.";
  const w = rule.when;
  if (w.raisePercentOver !== null && !(w.raisePercentOver >= 0 && w.raisePercentOver < 1000)) e.raisePercentOver = "A percentage from 0.";
  if (w.monthlyChangeOver !== null && !(w.monthlyChangeOver >= 0)) e.monthlyChangeOver = "An amount from 0.";
  if (w.newTotalOver !== null && !(w.newTotalOver >= 0)) e.newTotalOver = "An amount from 0.";
  if (w.branchIds.some((id) => !ctx.branchIds.includes(id))) e.branchIds = "A chosen branch no longer exists.";
  if (w.departmentIds.some((id) => !ctx.departmentIds.includes(id))) e.departmentIds = "A chosen department no longer exists.";
  if (w.monthlyChangeOver === null && !personal(w)) e.when = "Give the rule at least one condition.";
  if (rule.then.type !== "simple" && rule.then.type !== "multi_level") e.type = "A rule asks for simple or multi-level approval.";
  Object.assign(e, validatePolicy(rule.then, ctx.approvers));
  return e;
}

export const ruleIsValid = (e: Record<string, string>) => Object.keys(e).length === 0;

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const npr = (n: number) => `NPR ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const listed = (ids: readonly string[], names: ReadonlyMap<string, string>, gone: string) =>
  ids
    .map((id) => names.get(id) ?? gone)
    .sort((a, b) => a.localeCompare(b))
    .join(", ");

/** "Raise over 10% · New total over NPR 1,00,000 · Branches: Lekhnath Branch". */
export function describeConditions(w: ApprovalRuleConditions, names: { branches: ReadonlyMap<string, string>; departments: ReadonlyMap<string, string> }): string {
  return [
    w.raisePercentOver !== null ? `Raise over ${w.raisePercentOver}%` : "",
    w.monthlyChangeOver !== null ? `Monthly bill changes by more than ${npr(w.monthlyChangeOver)}` : "",
    w.newTotalOver !== null ? `New total over ${npr(w.newTotalOver)}` : "",
    w.branchIds.length ? `Branches: ${listed(w.branchIds, names.branches, "a deleted branch")}` : "",
    w.departmentIds.length ? `Departments: ${listed(w.departmentIds, names.departments, "a deleted department")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Any approver" or "Level 1: Hari Thapa → Level 2: Sita Sharma". */
export function describeApproval(policy: ApprovalPolicy, nameOf: (userId: string) => string): string {
  if (policy.type === "none") return "No approval";
  if (policy.type === "simple" || !policy.levels.length) return "Any approver";
  return policy.levels.map((id, i) => `Level ${i + 1}: ${nameOf(id)}`).join(" → ");
}

/** The rules after one is added or saved (in place), removed, or moved up / down. */
export function withRule(rules: readonly ApprovalRule[], rule: ApprovalRule): ApprovalRule[] {
  const at = rules.findIndex((r) => r.id === rule.id);
  return at < 0 ? [...rules, rule] : rules.map((r, i) => (i === at ? rule : r));
}

export const withoutRule = (rules: readonly ApprovalRule[], id: string) => rules.filter((r) => r.id !== id);

export function movedRule(rules: readonly ApprovalRule[], id: string, step: -1 | 1): ApprovalRule[] {
  const at = rules.findIndex((r) => r.id === id);
  const to = at + step;
  if (at < 0 || to < 0 || to >= rules.length) return [...rules];
  const next = [...rules];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_CONDITIONS,
  MAX_RULES,
  describeApproval,
  describeConditions,
  movedRule,
  normalizeRule,
  policyForChange,
  raisePercent,
  readRules,
  ruleApplies,
  ruleIsValid,
  validateRule,
  withRule,
  withoutRule,
  type ChangeFacts,
} from '../lib/engines/approval-rules.engine';
import type { ApprovalPolicy, ApprovalRule, ApproverInfo } from '../lib/types/approval';

// Custom approval rules for salary changes (4.12d): when a rule applies, the first that applies
// decides, a rule never removes approval, and the rules in words.

const approver = (userId: string, over: Partial<ApproverInfo> = {}): ApproverInfo => ({ userId, name: userId.toUpperCase(), employeeId: `e-${userId}`, active: true, canApprove: true, delegatedTo: null, delegatedUntil: null, ...over });
const APPROVERS = [approver('hari'), approver('sita'), approver('ram', { canApprove: false })];
const rule = (over: Omit<Partial<ApprovalRule>, 'when'> & { when?: Partial<ApprovalRule['when']> } = {}): ApprovalRule => ({
  id: over.id ?? 'r1',
  name: over.name ?? 'Large raises',
  when: { ...EMPTY_CONDITIONS, ...over.when },
  then: over.then ?? { type: 'multi_level', levels: ['hari', 'sita'] },
});
const change = (people: ChangeFacts['people'], monthlyChange?: number): ChangeFacts => ({ people, monthlyChange: monthlyChange ?? people.reduce((n, p) => n + p.after - (p.before ?? 0), 0) });
const person = (before: number | null, after: number, branchId = 'lkn', departmentId = 'credit') => ({ before, after, branchId, departmentId });
const COMPANY: ApprovalPolicy = { type: 'simple', levels: [] };

describe('when a rule applies (4.12d)', () => {
  it('a raise above a percentage, for someone', () => {
    const r = rule({ when: { raisePercentOver: 10 } });
    assert.equal(raisePercent(person(30000, 33300)), 11);
    assert.equal(ruleApplies(r, change([person(30000, 33000)])), false, 'exactly 10% is not more than 10%');
    assert.equal(ruleApplies(r, change([person(30000, 33300)])), true);
    assert.equal(ruleApplies(r, change([person(30000, 31000), person(20000, 22500)])), true, 'someone in the change');
    assert.equal(ruleApplies(r, change([person(null, 50000)])), false, 'a first structure has no raise');
    assert.equal(ruleApplies(r, change([person(30000, 25000)])), false, 'a cut is not a raise');
  });

  it('the monthly bill, up or down, all people together', () => {
    const r = rule({ when: { monthlyChangeOver: 50000 } });
    assert.equal(ruleApplies(r, change([person(30000, 60000), person(30000, 51000)])), true);
    assert.equal(ruleApplies(r, change([person(100000, 40000)])), true, 'a fall of 60,000 counts too');
    assert.equal(ruleApplies(r, change([person(30000, 80000)])), false, 'exactly 50,000 is not more');
  });

  it('a new total, a branch, a department', () => {
    assert.equal(ruleApplies(rule({ when: { newTotalOver: 100000 } }), change([person(90000, 100001)])), true);
    assert.equal(ruleApplies(rule({ when: { newTotalOver: 100000 } }), change([person(90000, 100000)])), false);
    assert.equal(ruleApplies(rule({ when: { branchIds: ['ho'] } }), change([person(1, 2, 'lkn'), person(1, 2, 'ho')])), true);
    assert.equal(ruleApplies(rule({ when: { branchIds: ['ho'] } }), change([person(1, 2, 'lkn')])), false);
    assert.equal(ruleApplies(rule({ when: { departmentIds: ['admin'] } }), change([{ ...person(1, 2), departmentId: null }])), false);
  });

  it('conditions about a person hold for the same person', () => {
    const r = rule({ when: { raisePercentOver: 10, branchIds: ['ho'] } });
    // Lekhnath has the big raise, Head Office a small one: nobody meets both.
    assert.equal(ruleApplies(r, change([person(30000, 40000, 'lkn'), person(30000, 30500, 'ho')])), false);
    assert.equal(ruleApplies(r, change([person(30000, 40000, 'ho')])), true);
    // The bill condition is the change's total, together with someone meeting the rest.
    const both = rule({ when: { raisePercentOver: 10, monthlyChangeOver: 20000 } });
    assert.equal(ruleApplies(both, change([person(30000, 40000)])), false, 'a 10,000 bill change');
    assert.equal(ruleApplies(both, change([person(30000, 40000), person(30000, 45000)])), true);
  });

  it('the first rule that applies decides; none: the company policy', () => {
    const big = rule({ id: 'big', name: 'Big', when: { raisePercentOver: 20 }, then: { type: 'multi_level', levels: ['hari', 'sita'] } });
    const any = rule({ id: 'any', name: 'Any raise', when: { raisePercentOver: 5 }, then: { type: 'multi_level', levels: ['sita'] } });
    const settings = { policy: COMPANY, rules: [big, any] };
    assert.equal(policyForChange(settings, change([person(100, 130)])).rule?.id, 'big');
    assert.equal(policyForChange(settings, change([person(100, 110)])).rule?.id, 'any');
    assert.deepEqual(policyForChange(settings, change([person(100, 102)])), { policy: COMPANY, rule: null });
    assert.deepEqual(policyForChange({ policy: COMPANY, rules: [any, big] }, change([person(100, 130)])).policy, { type: 'multi_level', levels: ['sita'] }, 'order matters');
  });
});

describe('reading and checking a rule (4.12d)', () => {
  it('a rule never removes approval: anything but levels is simple', () => {
    assert.deepEqual(normalizeRule({ id: 'x', name: ' Free ', when: { newTotalOver: '5' }, then: { type: 'none' } }).then, { type: 'simple', levels: [] });
    const r = normalizeRule({ id: 'x', name: 'Six', when: { branchIds: ['a', 'a', 3] }, then: { type: 'multi_level', levels: ['a', 'b', 'c', 'd', 'e', 'f'] } });
    assert.equal(r.then.levels.length, 5);
    assert.deepEqual(r.when.branchIds, ['a']);
    assert.equal(r.when.newTotalOver, null);
    assert.equal(normalizeRule({ when: { raisePercentOver: '7.5' } }).when.raisePercentOver, 7.5);
  });

  it('the stored list keeps readable rules, at most ten', () => {
    assert.deepEqual(readRules('nonsense'), []);
    assert.deepEqual(readRules([{ name: 'no id' }, { id: 'a' }]).length, 0);
    assert.equal(readRules(Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, name: `Rule ${i}`, when: { newTotalOver: i } }))).length, MAX_RULES);
  });

  it('checks: a unique name, at least one condition, sensible numbers, real branches and approvers', () => {
    const ctx = { otherNames: ['Big raises'], approvers: APPROVERS, branchIds: ['lkn', 'ho'], departmentIds: ['credit'] };
    assert.deepEqual(validateRule(rule({ when: { raisePercentOver: 10 } }), ctx), {});
    assert.equal(validateRule(rule({ name: '', when: { raisePercentOver: 10 } }), ctx).name, 'Give the rule a name.');
    assert.equal(validateRule(rule({ name: 'big RAISES', when: { raisePercentOver: 10 } }), ctx).name, 'Another rule has this name.');
    assert.equal(validateRule(rule(), ctx).when, 'Give the rule at least one condition.');
    assert.equal(validateRule(rule({ when: { raisePercentOver: -1 } }), ctx).raisePercentOver, 'A percentage from 0.');
    assert.equal(validateRule(rule({ when: { branchIds: ['gone'] } }), ctx).branchIds, 'A chosen branch no longer exists.');
    assert.equal(validateRule(rule({ when: { departmentIds: ['gone'] } }), ctx).departmentIds, 'A chosen department no longer exists.');
    assert.match(validateRule(rule({ when: { newTotalOver: 1 }, then: { type: 'multi_level', levels: ['ram'] } }), ctx)['level.1'] ?? '', /cannot approve/);
    assert.equal(validateRule(rule({ when: { newTotalOver: 1 }, then: { type: 'multi_level', levels: [] } }), ctx).levels, 'Add at least one approver');
    assert.deepEqual(validateRule(rule({ when: { newTotalOver: 0 }, then: { type: 'simple', levels: [] } }), ctx), {}, 'over 0 is a condition');
    assert.equal(ruleIsValid({}), true);
  });
});

describe('rules in words and in order (4.12d)', () => {
  it('conditions and approvers in words', () => {
    const names = { branches: new Map([['lkn', 'Lekhnath Branch']]), departments: new Map([['credit', 'Credit']]) };
    assert.equal(
      describeConditions({ raisePercentOver: 10, monthlyChangeOver: 50000, newTotalOver: 100000, branchIds: ['lkn'], departmentIds: ['credit', 'gone'] }, names),
      'Raise over 10% · Monthly bill changes by more than NPR 50,000 · New total over NPR 1,00,000 · Branches: Lekhnath Branch · Departments: a deleted department, Credit'
    );
    const nameOf = (id: string) => id.toUpperCase();
    assert.equal(describeApproval({ type: 'simple', levels: [] }, nameOf), 'Any approver');
    assert.equal(describeApproval({ type: 'multi_level', levels: ['hari', 'sita'] }, nameOf), 'Level 1: HARI → Level 2: SITA');
    assert.equal(describeApproval({ type: 'none', levels: [] }, nameOf), 'No approval');
  });

  it('add, save in place, remove, move', () => {
    const a = rule({ id: 'a', name: 'A' });
    const b = rule({ id: 'b', name: 'B' });
    const c = rule({ id: 'c', name: 'C' });
    assert.deepEqual(withRule([a, b], c).map((r) => r.id), ['a', 'b', 'c']);
    assert.equal(withRule([a, b], { ...b, name: 'B2' })[1].name, 'B2');
    assert.deepEqual(withoutRule([a, b, c], 'b').map((r) => r.id), ['a', 'c']);
    assert.deepEqual(movedRule([a, b, c], 'c', -1).map((r) => r.id), ['a', 'c', 'b']);
    assert.deepEqual(movedRule([a, b, c], 'a', -1).map((r) => r.id), ['a', 'b', 'c'], 'the first stays first');
    assert.deepEqual(movedRule([a, b, c], 'x', 1).map((r) => r.id), ['a', 'b', 'c']);
  });
});

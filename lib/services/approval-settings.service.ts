import { randomUUID } from "node:crypto";
import * as salaryRepository from "@/lib/repositories/salary-structure.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as salaryService from "@/lib/services/salary-structure.service";
import * as loanService from "@/lib/services/loan.service";
import {
  MAX_RULES,
  describeApproval,
  describeConditions,
  movedRule,
  normalizeRule,
  ruleIsValid,
  validateRule,
  withRule,
  withoutRule,
} from "@/lib/engines/approval-rules.engine";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type { ApprovalPolicy, ApprovalRule, ApprovalSettingsPage, ApproverInfo } from "@/lib/types/approval";

// Setup → Approvals (4.12d): who approves salary changes and loans, in one place. Each module's
// setting is a company control (its Approve with a company-wide role, checked in the actions);
// salary changes add custom rules, read in order. Requests already waiting keep the flow they were
// sent with. Every change is audited in words.

export class ApprovalSettingsValidationError extends UserFacingError {
  constructor(public errors: Record<string, string>) {
    super("Check the highlighted fields.");
    this.name = "ApprovalSettingsValidationError";
  }
}

export interface ApprovalSettingsCtx {
  userId: string;
  scope: ScopeFilter;
  /** View and Approve on each module. */
  can: { salaryView: boolean; salaryApprove: boolean; loansView: boolean; loansApprove: boolean };
}

const companyWide = (scope: ScopeFilter) => scope.scopeType === "GLOBAL" && !scope.isImpersonation;

/** The signed-in user's context: View on each module decides what the page shows. */
export async function contextFor(): Promise<ApprovalSettingsCtx> {
  const [salaryView, salaryApprove, loansView, loansApprove] = await Promise.all([
    hasPermission("VIEW", "SALARY_MAPPING"),
    hasPermission("APPROVE", "SALARY_MAPPING"),
    hasPermission("VIEW", "LOANS"),
    hasPermission("APPROVE", "LOANS"),
  ]);
  if (!salaryView && !loansView) throw new UserFacingError("Approval settings need Salary structure or Loans → View.");
  const scope = await checkPermissionWithScope("VIEW", salaryView ? "SALARY_MAPPING" : "LOANS");
  return { userId: scope.userId, scope, can: { salaryView, salaryApprove, loansView, loansApprove } };
}

type Names = { branches: Map<string, string>; departments: Map<string, string> };

async function orgNames(): Promise<Names & { branchList: { id: string; name: string }[]; departmentList: { id: string; name: string }[] }> {
  const [branches, departments] = await Promise.all([branchRepository.findAllBranches(), departmentRepository.findAllDepartments()]);
  const branchList = branches.map((b) => ({ id: b.id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
  const departmentList = departments.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name));
  return { branches: new Map(branchList.map((b) => [b.id, b.name])), departments: new Map(departmentList.map((d) => [d.id, d.name])), branchList, departmentList };
}

const nameOf = (approvers: readonly ApproverInfo[]) => (id: string) => approvers.find((a) => a.userId === id)?.name ?? "a removed user";

const ruleRow = (rule: ApprovalRule, names: Names, approvers: readonly ApproverInfo[]) => ({
  ...rule,
  conditions: describeConditions(rule.when, names),
  approval: describeApproval(rule.then, nameOf(approvers)),
});

export async function approvalSettingsPage(ctx: ApprovalSettingsCtx): Promise<ApprovalSettingsPage> {
  const names = await orgNames();
  const [salary, loans] = await Promise.all([
    ctx.can.salaryView
      ? Promise.all([salaryRepository.getApprovalPolicy(), salaryRepository.getApprovalRules(), salaryRepository.findApprovers(), salaryRepository.findBatches()]).then(([policy, { rules, version }, approvers, batches]) => ({
          policy,
          approvers,
          pending: batches.filter((b) => b.status === "pending").length,
          canEdit: ctx.can.salaryApprove && companyWide(ctx.scope),
          rules: rules.map((r) => ruleRow(r, names, approvers)),
          rulesVersion: version,
        }))
      : Promise.resolve(null),
    ctx.can.loansView
      ? loanService.approvalSettings().then((s) => ({ ...s, canEdit: ctx.can.loansApprove && companyWide(ctx.scope) }))
      : Promise.resolve(null),
  ]);
  return { salary, loans, branches: names.branchList, departments: names.departmentList };
}

/** A policy in words for the audit line. */
const policyWords = (policy: ApprovalPolicy, approvers: readonly ApproverInfo[]) => describeApproval(policy, nameOf(approvers));

/** The company policy for salary changes (custom rules stay as they are). */
export async function saveSalaryPolicy(raw: unknown, ctx: Pick<ApprovalSettingsCtx, "userId">): Promise<{ pendingKept: number }> {
  const [before, approvers] = await Promise.all([salaryRepository.getApprovalPolicy(), salaryRepository.findApprovers()]);
  let saved: Awaited<ReturnType<typeof salaryService.saveApprovalPolicy>>;
  try {
    saved = await salaryService.saveApprovalPolicy(raw);
  } catch (error) {
    if (error instanceof salaryService.StructureValidationError) throw new ApprovalSettingsValidationError(error.errors.settings ?? {});
    throw error;
  }
  await recordAuditLog({
    userId: ctx.userId,
    action: "EDIT",
    module: "SALARY_MAPPING",
    recordId: "Salary approval setting",
    oldValues: { approval: policyWords(before, approvers) },
    newValues: { approval: policyWords(saved.policy, approvers) },
  });
  return { pendingKept: saved.pendingKept };
}

/** The company policy for loans and advances. */
export async function saveLoanPolicy(raw: unknown, ctx: Pick<ApprovalSettingsCtx, "userId">): Promise<{ pendingKept: number }> {
  const before = await loanService.approvalSettings();
  let saved: Awaited<ReturnType<typeof loanService.saveApprovalPolicy>>;
  try {
    saved = await loanService.saveApprovalPolicy(raw);
  } catch (error) {
    if (error instanceof loanService.LoanValidationError) throw new ApprovalSettingsValidationError(error.errors);
    throw error;
  }
  await recordAuditLog({
    userId: ctx.userId,
    action: "EDIT",
    module: "LOANS",
    recordId: "Loan approval setting",
    oldValues: { approval: policyWords(before.policy, before.approvers) },
    newValues: { approval: policyWords(saved.policy, before.approvers) },
  });
  return { pendingKept: saved.pendingKept };
}

const STALE = "The rules were changed by someone else meanwhile: refresh and try again.";

/** Adds a rule (id empty) or saves one in place; the list must still be at `version`. */
export async function saveSalaryRule(raw: unknown, version: string, ctx: Pick<ApprovalSettingsCtx, "userId">): Promise<{ id: string; name: string }> {
  const [{ rules, version: current }, approvers, names] = await Promise.all([salaryRepository.getApprovalRules(), salaryRepository.findApprovers(), orgNames()]);
  if (current !== version) throw new UserFacingError(STALE);
  const input = normalizeRule(raw);
  const existing = input.id ? rules.find((r) => r.id === input.id) ?? null : null;
  if (input.id && !existing) throw new UserFacingError("That rule no longer exists.");
  if (!existing && rules.length >= MAX_RULES) throw new UserFacingError(`At most ${MAX_RULES} rules: remove one first.`);
  const rule: ApprovalRule = { ...input, id: existing?.id ?? randomUUID() };
  const errors = validateRule(rule, {
    otherNames: rules.filter((r) => r.id !== rule.id).map((r) => r.name),
    approvers,
    branchIds: names.branchList.map((b) => b.id),
    departmentIds: names.departmentList.map((d) => d.id),
  });
  if (!ruleIsValid(errors)) throw new ApprovalSettingsValidationError(errors);
  const words = (r: ApprovalRule) => ({ name: r.name, when: describeConditions(r.when, names), approval: describeApproval(r.then, nameOf(approvers)) });
  if (existing && JSON.stringify(existing) === JSON.stringify(rule)) throw new UserFacingError("Nothing changed.");
  if (!(await salaryRepository.replaceApprovalRules(withRule(rules, rule), version))) throw new UserFacingError(STALE);
  await recordAuditLog({
    userId: ctx.userId,
    action: existing ? "EDIT" : "ADD",
    module: "SALARY_MAPPING",
    recordId: `Salary approval rule: ${rule.name}`,
    oldValues: existing ? words(existing) : null,
    newValues: words(rule),
  });
  return { id: rule.id, name: rule.name };
}

/** Removes a rule; the list must still be at `version`. */
export async function deleteSalaryRule(id: string, version: string, ctx: Pick<ApprovalSettingsCtx, "userId">): Promise<{ name: string }> {
  const [{ rules, version: current }, approvers, names] = await Promise.all([salaryRepository.getApprovalRules(), salaryRepository.findApprovers(), orgNames()]);
  if (current !== version) throw new UserFacingError(STALE);
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new UserFacingError("That rule no longer exists.");
  if (!(await salaryRepository.replaceApprovalRules(withoutRule(rules, id), version))) throw new UserFacingError(STALE);
  await recordAuditLog({
    userId: ctx.userId,
    action: "DELETE",
    module: "SALARY_MAPPING",
    recordId: `Salary approval rule: ${rule.name}`,
    oldValues: { name: rule.name, when: describeConditions(rule.when, names), approval: describeApproval(rule.then, nameOf(approvers)) },
  });
  return { name: rule.name };
}

/** Moves a rule up (-1) or down (+1): the first rule that applies decides. */
export async function moveSalaryRule(id: string, step: -1 | 1, version: string, ctx: Pick<ApprovalSettingsCtx, "userId">): Promise<void> {
  const { rules, version: current } = await salaryRepository.getApprovalRules();
  if (current !== version) throw new UserFacingError(STALE);
  if (!rules.some((r) => r.id === id)) throw new UserFacingError("That rule no longer exists.");
  const next = movedRule(rules, id, step);
  if (next.map((r) => r.id).join() === rules.map((r) => r.id).join()) return;
  if (!(await salaryRepository.replaceApprovalRules(next, version))) throw new UserFacingError(STALE);
  await recordAuditLog({
    userId: ctx.userId,
    action: "EDIT",
    module: "SALARY_MAPPING",
    recordId: "Salary approval rules: order",
    oldValues: { order: rules.map((r) => r.name).join(" → ") },
    newValues: { order: next.map((r) => r.name).join(" → ") },
  });
}

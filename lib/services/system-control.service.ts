import * as repository from "@/lib/repositories/system-control.repository";
import * as salaryRepository from "@/lib/repositories/salary-structure.repository";
import { findActiveOtRules } from "@/lib/repositories/ot-rule.repository";
import { findAll as findAllEmployees } from "@/lib/repositories/employee.repository";
import { applyRulesForm, gradePolicyChanged, gradePolicyOf, normalizeRulesForm, rulesAreValid, rulesChanges, rulesFormOf, validateRulesForm } from "@/lib/engines/rules.engine";
import { resolveOtMultipliers } from "@/lib/engines/ot-pay.engine";
import { applyPolicyGrades, previewPolicyGrades } from "@/lib/services/salary-structure.service";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type { GradePolicyImpact, RulesErrors, RulesPage, RulesSaveResult, SystemControlData } from "@/lib/types/system-control";

// Rules & controls (4.12b, S50): the company rules payroll reads — retirement and insurance
// limits, the remote-area cap, the women's rebate, SSF, the overtime multipliers used when no
// overtime rule is active, and the grade policy. Saved with a company-wide role
// (checkCompanyControl in the actions) and audited field by field. A grade-policy change is a
// salary change: it goes through salary approval (applyPolicyGrades) and needs Salary structure →
// Edit as well.

export class RulesValidationError extends UserFacingError {
  constructor(public errors: RulesErrors) {
    super("Check the highlighted rules.");
    this.name = "RulesValidationError";
  }
}

export interface RulesCtx {
  userId: string;
  scope: ScopeFilter;
  /** Salary structure → Edit: a grade-policy change prepares salary changes. */
  canChangeGrades: boolean;
}

export async function getSystemControlData(): Promise<SystemControlData> {
  return repository.findSettings();
}

export async function rulesPage(can: { edit: boolean; grades: boolean }): Promise<RulesPage> {
  const [settings, rules, approval, employees] = await Promise.all([
    repository.findSettings(),
    findActiveOtRules(),
    salaryRepository.getApprovalPolicy(),
    findAllEmployees({ search: "", departmentId: "all", branchId: "all", category: "all", status: "Active" }),
  ]);
  const ot = resolveOtMultipliers(
    rules.map((r) => ({ ruleType: r.ruleType, isActive: r.isActive, rateOfficeDay: Number(r.rateOfficeDay), rateOffDay: Number(r.rateOffDay) })),
    { work: settings.officeTime.otMultiplierOfficeDay, off: settings.officeTime.otMultiplierOffDay }
  );
  return {
    form: rulesFormOf(settings),
    canEdit: can.edit,
    canChangeGrades: can.edit && can.grades,
    otRule: ot.source === "rule" ? { work: ot.work, off: ot.off } : null,
    salaryApproval: approval.type,
    activeEmployees: employees.length,
  };
}

/** The checked form and what it changes against what is stored. */
async function prepare(raw: unknown) {
  const settings = await repository.findSettings();
  const form = normalizeRulesForm(raw);
  const errors = validateRulesForm(form);
  if (!rulesAreValid(errors)) throw new RulesValidationError(errors);
  const before = rulesFormOf(settings);
  return { settings, form, before, changes: rulesChanges(before, form), gradesChange: gradePolicyChanged(before, form) };
}

const gradesRefused = () => new UserFacingError("Changing the grade policy changes salaries: it needs Salary structure → Edit as well.");

/** What saving would do to salaries (null: the grade policy is not changed). Nothing is written. */
export async function previewRules(raw: unknown, ctx: RulesCtx): Promise<GradePolicyImpact | null> {
  const { settings, form, gradesChange } = await prepare(raw);
  if (!gradesChange) return null;
  if (!ctx.canChangeGrades) throw gradesRefused();
  return previewPolicyGrades(gradePolicyOf(form, settings.gradePolicy), ctx);
}

/** Saves the rules; a changed grade policy becomes one salary change through approval. */
export async function saveRules(raw: unknown, ctx: RulesCtx): Promise<RulesSaveResult> {
  const { settings, form, changes, gradesChange } = await prepare(raw);
  if (!changes.length) throw new UserFacingError("Nothing changed.");
  if (gradesChange && !ctx.canChangeGrades) throw gradesRefused();
  await repository.updateSettings(applyRulesForm(settings, form));
  await recordAuditLog({
    userId: ctx.userId,
    action: "EDIT",
    module: "SYSTEM_CONTROL",
    recordId: "Rules & controls",
    oldValues: Object.fromEntries(changes.map((c) => [c.key, c.from])),
    newValues: Object.fromEntries(changes.map((c) => [c.key, c.to])),
  });
  if (!gradesChange) return { changed: changes, grades: null };
  const grades = await applyPolicyGrades(gradePolicyOf(form, settings.gradePolicy), ctx);
  if (grades.employees) {
    await recordAuditLog({ userId: ctx.userId, action: "EDIT", module: "SALARY_MAPPING", recordId: grades.batchId ?? "grade-policy", newValues: { gradePolicy: form.gradeMethod, employees: grades.employees, monthlyChange: grades.monthlyChange, waitingFor: grades.waitingFor } });
  }
  return { changed: changes, grades };
}

/** Applies the saved grade policy again — for employees left out while a change of theirs was waiting. */
export async function applyGradePolicy(ctx: RulesCtx): Promise<GradePolicyImpact & { batchId: string | null }> {
  if (!ctx.canChangeGrades) throw gradesRefused();
  const settings = await repository.findSettings();
  const grades = await applyPolicyGrades(gradePolicyOf(rulesFormOf(settings), settings.gradePolicy), ctx);
  if (grades.employees) {
    await recordAuditLog({ userId: ctx.userId, action: "EDIT", module: "SALARY_MAPPING", recordId: grades.batchId ?? "grade-policy", newValues: { gradePolicy: settings.gradePolicy?.calculationMethod, employees: grades.employees, monthlyChange: grades.monthlyChange, waitingFor: grades.waitingFor, reapplied: true } });
  }
  return grades;
}

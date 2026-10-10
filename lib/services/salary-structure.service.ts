import * as repository from "@/lib/repositories/salary-structure.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as payHeadRepository from "@/lib/repositories/pay-head.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as shreniRepository from "@/lib/repositories/shreni.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import * as taxRateRepository from "@/lib/repositories/tax-rate.repository";
import { findAllEmploymentTypes } from "@/lib/repositories/employment-type.repository";
import { gradeMethodLabel } from "@/lib/engines/grade-policy.engine";
import {
  EMPTY_LINES,
  batchSummary,
  changedLines,
  classifyHead,
  estimatePay,
  gradeAmountFor,
  headsFromLines,
  latestApproved,
  linesFromHeads,
  needsSetup,
  resolveLevelCode,
  structureTotals,
  validateLines,
  type PayHeadLike,
  type TotalsSettings,
} from "@/lib/engines/salary-structure.engine";
import {
  applyDecision,
  availableActions,
  buildFlow,
  isCompanyAdministrator,
  parsePolicy,
  validatePolicy,
  waitingFor,
  type ApprovalActor,
  type ApprovalRequest,
  type Decision,
} from "@/lib/engines/approval.engine";
import { policyForChange, type ChangeFact } from "@/lib/engines/approval-rules.engine";
import type { ApprovalFlow, ApprovalPolicy, ApprovalRoute, ApprovalTimelineEntry, ApproverInfo } from "@/lib/types/approval";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import type { PayHead } from "@/lib/types/pay-head";
import type { Employee } from "@/lib/types/employee";
import type {
  BatchInput,
  BatchKind,
  BatchLine,
  BatchRow,
  BatchStatus,
  PayProfile,
  RevisionStatus,
  RevisionSummary,
  RetirementScheme,
  SalaryStructureData,
  StructureHead,
  StructureLines,
  StructureRow,
  StructureTab,
  TaxRules,
  TemplateInput,
  TemplateRow,
} from "@/lib/types/salary-structure";

const ALL = { search: "", departmentId: "all", branchId: "all", category: "all", status: "all" } as const;
export const MAX_BATCH_ROWS = 2000;

/** A request named employees outside the user's scope; the action audits it as DENIED_SCOPE. */
export class OutOfScopeError extends UserFacingError {
  constructor(public employeeIds: string[]) {
    super("Some employees are not in your branch / department. Refresh and try again.");
    this.name = "OutOfScopeError";
  }
}

export class StructureValidationError extends Error {
  constructor(public errors: Record<string, Record<string, string>>) {
    super("Some cells need attention.");
    this.name = "StructureValidationError";
  }
}

const toLike = (h: PayHead): PayHeadLike => ({
  id: h.id,
  code: h.code,
  name: h.name,
  type: h.type,
  calcBasis: h.calcBasis,
  calcParameter: h.calcParameter,
  calcPercent: h.calcPercent,
  isFestivalAllowance: !!h.flags.isFestivalAllowance,
  isAbsentDeduct: !!h.flags.isAbsentDeduct,
  isOtHead: !!h.flags.isOtHead,
  isLeaveHead: !!h.flags.isLeaveHead,
  isTdsHead: !!h.flags.isTdsHead,
  isPfHead: !!h.flags.isPfHead,
  isSsfHead: !!h.flags.isSsfHead,
  isSsfEmployerHead: !!h.flags.isSsfEmployerHead,
  isRemoteAllowance: !!h.flags.isRemoteAllowance,
  isCitHead: !!h.flags.isCitHead,
  effectOnTax: h.effectOnTax,
  applicableDepartmentIds: h.applicableDepartmentIds ?? [],
  applicableDesignationIds: h.applicableDesignationIds ?? [],
});

async function loadContext() {
  const [payHeads, settings] = await Promise.all([payHeadRepository.findAllPayHeads(), systemControlRepository.findSettings()]);
  const heads = payHeads.map((h) => classifyHead(toLike(h))).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "allowance" ? -1 : 1));
  const totalsSettings: TotalsSettings = {
    ssfBase: settings.statutoryDeductionLimits.ssfContributionBase === "BasicSalary" ? "BasicSalary" : "BasicPlusGrade",
    pfPercent: 10,
  };
  return { heads, settings, totalsSettings };
}

/**
 * The tax rules for estimates: the active fiscal year's slabs (all slabs when
 * none is marked active), and the statutory and insurance limits.
 */
async function loadTaxRules(settings: Awaited<ReturnType<typeof systemControlRepository.findSettings>>): Promise<TaxRules> {
  const [years, slabs] = await Promise.all([fiscalYearRepository.findAllFiscalYears(), taxRateRepository.findAllSlabs()]);
  const active = years.find((y) => y.status === "Active");
  const mine = active ? slabs.filter((s) => s.fiscalYearId === active.id) : [];
  return {
    slabs: (mine.length ? mine : slabs).map((s) => ({
      id: s.id,
      category: s.category,
      amountFrom: String(s.amountFrom),
      amountTo: s.amountTo === null ? null : String(s.amountTo),
      ratePercent: String(s.ratePercent),
      fixedDeduction: String(s.fixedDeduction),
    })),
    limits: settings.statutoryDeductionLimits,
    insurance: settings.insuranceDiscounts,
  };
}

/** The employee details payroll's tax reads. */
const profileOf = (e: Employee): PayProfile => ({
  taxStatus: e.taxStatus,
  isDisabled: !!e.isDisabled,
  category: e.category,
  gender: e.gender,
  joiningDate: isoDate(e.joiningDate),
});

const isoDate = (d: Date | string | null | undefined): string => {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

/** SSF is the expected scheme: the company has SSF and the employee's employment type allows it. */
async function ssfExpectation(settings: Awaited<ReturnType<typeof systemControlRepository.findSettings>>): Promise<(category: string) => boolean> {
  if (!settings.statutoryDeductionLimits.companyHasSsf) return () => false;
  const types = await findAllEmploymentTypes();
  return (category) => {
    const t = types.find((x) => x.name === category || x.code.toUpperCase() === category.toUpperCase());
    return t ? t.isSsfEligible : true;
  };
}

/** Employees within the user's scope (active only unless asked). */
async function employeesInScope(scope: ScopeFilter, opts: { includeInactive?: boolean } = {}): Promise<Employee[]> {
  const all = await employeeRepository.findAll(ALL, buildEmployeeScopeCondition(scope));
  return opts.includeInactive ? all : all.filter((e) => e.status === "Active");
}

function toSummary(
  r: repository.RevisionRow,
  stored: repository.StoredHead[],
  heads: StructureHead[],
  settings: TotalsSettings,
  names: Map<string, string>,
  pay: { profile: PayProfile; tax: TaxRules } | null
): RevisionSummary {
  const lines = linesFromHeads(
    { basic: Number(r.basicSalary) || 0, gradeCount: r.gradeCount ?? 0, gradeAmount: Number(r.gradeAmount) || 0, gradeManual: !!r.gradeManual },
    stored.filter((s) => s.salaryMapId === r.id),
    heads
  );
  return {
    id: r.id,
    batchId: r.batchId ?? null,
    effectiveFrom: r.effectiveFrom,
    status: (r.status as RevisionStatus) ?? "approved",
    reason: r.reason ?? "",
    lines,
    // As payroll would pay it (income tax estimated) when the employee is known.
    totals: pay ? estimatePay(lines, heads, pay.profile, pay.tax, settings) : structureTotals(lines, heads, settings),
    preparedBy: r.createdBy ? names.get(r.createdBy) ?? null : null,
    approvedBy: r.approvedBy ? names.get(r.approvedBy) ?? null : null,
    createdAt: r.createdAt.toISOString(),
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
  };
}

/** History of one employee's revisions, newest first. */
export type EmployeeHistory = Record<string, RevisionSummary[]>;

export async function getStructureData(params: {
  tab: StructureTab;
  scope: ScopeFilter;
  userId: string;
  permissions: SalaryStructureData["permissions"];
}): Promise<SalaryStructureData> {
  const [{ heads, settings, totalsSettings }, employees, branches, departments, designations, levels, batches, templates, policy, { rules }, batchEmployees, approvers] = await Promise.all([
    loadContext(),
    employeesInScope(params.scope),
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    shreniRepository.findAllShreniLevels(),
    repository.findBatches(),
    repository.findTemplates(),
    repository.getApprovalPolicy(),
    repository.getApprovalRules(),
    repository.findBatchEmployeeIds(),
    repository.findApprovers(),
  ]);
  const actions = await repository.findApprovalActions(batches.map((b) => b.id));
  const userName = new Map(approvers.map((a) => [a.userId, a.name]));
  const ids = employees.map((e) => e.id);
  const [{ revisions, heads: stored }, finalisedUntil, tax, ssfExpected] = await Promise.all([
    repository.findRevisions(ids),
    repository.findOpenRunUntil(ids),
    loadTaxRules(settings),
    ssfExpectation(settings),
  ]);
  const profiles = new Map(employees.map((e) => [e.id, profileOf(e)]));
  const batchKind = new Map(batches.map((b) => [b.id, b.kind]));
  const names = await repository.findUserNames([...revisions.flatMap((r) => [r.createdBy ?? "", r.approvedBy ?? ""]), ...batches.flatMap((b) => [b.preparedBy ?? "", b.decidedBy ?? ""])]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));
  const designationName = new Map(designations.map((d) => [d.id, d.name]));
  const today = nepalDateIso();

  const history: EmployeeHistory = {};
  const summariesByEmployee = new Map<string, RevisionSummary[]>();
  for (const r of revisions) {
    const list = summariesByEmployee.get(r.employeeId) ?? [];
    const profile = profiles.get(r.employeeId);
    list.push(toSummary(r, stored, heads, totalsSettings, names, profile ? { profile, tax } : null));
    summariesByEmployee.set(r.employeeId, list);
  }

  const rows: StructureRow[] = employees.map((e) => {
    const list = summariesByEmployee.get(e.id) ?? [];
    history[e.id] = [...list].sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? b.createdAt.localeCompare(a.createdAt) : b.effectiveFrom.localeCompare(a.effectiveFrom)));
    const current = latestApproved(list);
    const pending = list.find((s) => s.status === "pending");
    const setup = needsSetup(current, current?.batchId ? batchKind.get(current.batchId) : null);
    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      bankAccountNumber: e.bankAccountNumber || "",
      branchId: e.branchId,
      branchName: branchName.get(e.branchId) ?? "",
      departmentId: e.departmentId,
      departmentName: departmentName.get(e.departmentId) ?? "",
      designationId: e.designationId,
      designationName: designationName.get(e.designationId) ?? "",
      levelCode: resolveLevelCode(e.shreni ?? "", levels),
      levelKnown: levels.some((l) => l.code === resolveLevelCode(e.shreni ?? "", levels)),
      category: e.category,
      joiningDate: isoDate(e.joiningDate),
      profile: profiles.get(e.id)!,
      ssfExpected: ssfExpected(e.category),
      status: pending ? "pending" : !current ? "none" : setup ? "setup" : current.effectiveFrom > today ? "future" : "current",
      current,
      pendingBatchId: pending?.batchId ?? null,
    };
  });

  // Batches: only the lines of employees in scope; batches with none are not shown.
  const byEmployee = new Map(employees.map((e) => [e.id, e]));
  const batchRows: BatchRow[] = [];
  for (const b of batches) {
    const mine = revisions.filter((r) => r.batchId === b.id);
    if (!mine.length) continue;
    const lines: BatchLine[] = mine.map((r) => {
      const emp = byEmployee.get(r.employeeId)!;
      const all = summariesByEmployee.get(r.employeeId) ?? [];
      const after = all.find((s) => s.id === r.id)!;
      // "Before" = what was current when the batch was made: the latest approved revision older than this one.
      const before = latestApproved(all.filter((s) => s.id !== r.id && s.createdAt < after.createdAt));
      return {
        employeeId: r.employeeId,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        before: before ? { lines: before.lines, totals: before.totals } : null,
        after: { lines: after.lines, totals: after.totals },
      };
    });
    batchRows.push({
      id: b.id,
      kind: b.kind as BatchKind,
      effectiveFrom: b.effectiveFrom,
      reason: b.reason,
      status: b.status as BatchStatus,
      employeeCount: b.employeeCount,
      monthlyChange: Number(b.monthlyChange) || 0,
      preparedById: b.preparedBy,
      preparedBy: b.preparedBy ? names.get(b.preparedBy) ?? "Unknown user" : "System",
      decidedBy: b.decidedBy ? names.get(b.decidedBy) ?? null : null,
      decidedAt: b.decidedAt ? b.decidedAt.toISOString() : null,
      decisionNote: b.decisionNote,
      approvalRoute: (b.approvalRoute as ApprovalRoute | null) ?? null,
      flow: flowOf(b),
      currentLevel: b.currentLevel ?? 0,
      // "Submitted" first: older rows mix database and app clocks (time zones), so time alone can misorder it.
      timeline: actions
        .filter((a) => a.requestId === b.id)
        .sort((x, y) => (x.action === "submitted" ? 0 : 1) - (y.action === "submitted" ? 0 : 1) || x.createdAt.getTime() - y.createdAt.getTime())
        .map(
          (a): ApprovalTimelineEntry => ({
            id: a.id,
            level: a.level,
            action: a.action as ApprovalTimelineEntry["action"],
            actorId: a.actorId,
            actorName: a.actorId ? userName.get(a.actorId) ?? "Unknown user" : "System",
            onBehalfOfName: a.onBehalfOf ? userName.get(a.onBehalfOf) ?? "Unknown user" : null,
            note: a.note,
            at: a.createdAt.toISOString(),
          })
        ),
      createdAt: b.createdAt.toISOString(),
      lines,
      employeeIds: batchEmployees.get(b.id) ?? lines.map((l) => l.employeeId),
    });
  }

  return {
    tab: params.tab,
    rows: rows.sort((a, b) => a.fullName.localeCompare(b.fullName)),
    heads,
    levels: levels.map((l) => ({ code: l.code, name: l.name, minSalary: l.minSalary ?? 0, maxSalary: l.maxSalary ?? 0 })),
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    designations: designations.map((d) => ({ id: d.id, name: d.name })),
    batches: batchRows,
    templates: templates.map(toTemplateRow),
    gradePolicy: settings.gradePolicy ?? null,
    ssfBase: totalsSettings.ssfBase,
    pfPercent: totalsSettings.pfPercent,
    tax,
    approvalPolicy: policy,
    approvalRules: rules,
    approvers,
    today: nepalDateIso(),
    currentUserId: params.userId,
    me: {
      employeeId: params.scope.employeeId,
      isAdministrator: isCompanyAdministrator(params.scope, params.permissions.approve),
      otherApprovers: approvers.filter((a) => a.active && a.canApprove && a.userId !== params.userId).length,
    },
    finalisedUntil,
    permissions: params.permissions,
    history,
  };
}

const toTemplateRow = (t: repository.TemplateRowDb): TemplateRow => ({
  id: t.id,
  code: t.code,
  name: t.name,
  levelCodes: t.levelCodes ?? [],
  designationIds: t.designationIds ?? [],
  basicMode: t.basicMode === "level_start" ? "level_start" : "amount",
  basicAmount: Number(t.basicAmount) || 0,
  scheme: (["ssf", "pf", "none", "keep"].includes(t.scheme) ? t.scheme : "keep") as TemplateRow["scheme"],
  heads: Array.isArray(t.heads) ? t.heads : [],
  isActive: t.isActive,
});

// ---------------------------------------------------------------------------
// Submitting changes
// ---------------------------------------------------------------------------

export interface SubmitResult {
  batchId: string;
  approved: boolean;
  /** How it counted at once (null: waiting for approval). */
  route: ApprovalRoute | null;
  /** It waits because it includes the preparer's own salary (S21). */
  ownSalary: boolean;
  employeeCount: number;
  monthlyChange: number;
  /** Draft or in-review payroll months (e.g. "Aswin 2083") to recalculate. */
  recalculate: string[];
  /** Who it waits for: "Level 1: Hari Thapa", or "an approver". */
  waitingFor: string | null;
}

/** The acting user for the approval rules (S21: own salary; Final approve for administrators). */
function actorFrom(scope: ScopeFilter, canApprove: boolean): ApprovalActor {
  return { userId: scope.userId, employeeId: scope.employeeId, canApprove, isAdministrator: isCompanyAdministrator(scope, canApprove) };
}

/** The flow kept on a batch (older batches without one are simple). */
function flowOf(b: repository.BatchRowDb): ApprovalFlow {
  const levels = Array.isArray(b.approvalLevels) ? b.approvalLevels : [];
  return { type: b.approvalType === "multi_level" && levels.length ? "multi_level" : "simple", levels };
}

/** A batch as the approval engine sees it. */
function requestOf(b: repository.BatchRowDb, subjectEmployeeIds: string[]): ApprovalRequest {
  return { status: b.status as ApprovalRequest["status"], preparedById: b.preparedBy, subjectEmployeeIds, flow: flowOf(b), currentLevel: b.currentLevel ?? 0 };
}

/**
 * One change batch (a single revision, a bulk edit or an import). Every value
 * is re-checked here: employees must be active and in scope, with no change
 * already waiting; grades follow the policy unless typed by hand; rows that
 * change nothing are dropped.
 */
export async function submitBatch(raw: unknown, ctx: { scope: ScopeFilter; userId: string; canApprove: boolean; approveNow?: boolean }): Promise<SubmitResult> {
  const input = normalizeBatch(raw);
  const [{ heads, settings, totalsSettings }, employees, levels, policy, { rules }, approvers] = await Promise.all([
    loadContext(),
    employeesInScope(ctx.scope, { includeInactive: true }),
    shreniRepository.findAllShreniLevels(),
    repository.getApprovalPolicy(),
    repository.getApprovalRules(),
    repository.findApprovers(),
  ]);
  const scoped = new Map(employees.map((e) => [e.id, e]));
  const outside = input.rows.filter((r) => !scoped.has(r.employeeId)).map((r) => r.employeeId);
  if (outside.length) throw new OutOfScopeError(outside);
  const left = input.rows.filter((r) => scoped.get(r.employeeId)!.status !== "Active");
  if (left.length) throw new UserFacingError(`Only active employees can be revised: ${left.slice(0, 5).map((r) => scoped.get(r.employeeId)!.fullName).join(", ")}.`);
  const byId = scoped;
  const pending = await repository.countPendingFor(input.rows.map((r) => r.employeeId));
  if (pending.size) {
    const names = [...pending.keys()].map((id) => byId.get(id)?.fullName).filter(Boolean).slice(0, 5).join(", ");
    throw new UserFacingError(`A change is already waiting for approval for: ${names}. Approve, reject or withdraw it first.`);
  }
  const [{ revisions, heads: stored }, allBatches] = await Promise.all([
    repository.findRevisions(input.rows.map((r) => r.employeeId)),
    input.kind === "setup" ? repository.findBatches() : Promise.resolve([]),
  ]);
  const batchKind = new Map(allBatches.map((b) => [b.id, b.kind]));
  const levelStart = (saved: string) => levels.find((l) => l.code === resolveLevelCode(saved, levels))?.minSalary ?? 0;

  const errors: Record<string, Record<string, string>> = {};
  const prepared: { revision: repository.NewRevision; before: ReturnType<typeof structureTotals> | null; after: ReturnType<typeof structureTotals> }[] = [];
  for (const row of input.rows) {
    const emp = byId.get(row.employeeId)!;
    const lines: StructureLines = { ...row.lines, gradeAmount: gradeAmountFor(row.lines, settings.gradePolicy) };
    const check = validateLines(lines, heads, levelStart(emp.shreni ?? ""));
    if (Object.keys(check.errors).length) {
      errors[row.employeeId] = check.errors;
      continue;
    }
    const mine = revisions.filter((r) => r.employeeId === row.employeeId);
    const currentRow = latestApproved(mine.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
    const current = currentRow
      ? linesFromHeads(
          { basic: Number(currentRow.basicSalary) || 0, gradeCount: currentRow.gradeCount ?? 0, gradeAmount: Number(currentRow.gradeAmount) || 0, gradeManual: !!currentRow.gradeManual },
          stored.filter((s) => s.salaryMapId === currentRow.id),
          heads
        )
      : null;
    if (input.kind === "setup") {
      // Adding a structure (Add new / Bulk add): only for someone with none yet, or with
      // basic + grade from the employee form; the latter may be confirmed unchanged.
      if (current && !needsSetup({ lines: current }, currentRow?.batchId ? batchKind.get(currentRow.batchId) : null)) {
        throw new UserFacingError(`${emp.fullName} already has a salary structure. Use Revise salary to change it.`);
      }
    } else if (current && !changedLines(current, lines).length) continue;
    const after = structureTotals(lines, heads, totalsSettings);
    prepared.push({
      revision: {
        employeeId: row.employeeId,
        basic: lines.basic,
        gradeCount: lines.gradeCount,
        gradeAmount: lines.gradeAmount,
        gradeManual: lines.gradeManual,
        netAmount: after.netBeforeTax,
        heads: headsFromLines(lines, heads),
      },
      before: current ? structureTotals(current, heads, totalsSettings) : null,
      after,
    });
  }
  if (Object.keys(errors).length) throw new StructureValidationError(errors);
  if (!prepared.length) throw new UserFacingError("Nothing changed: every row matches the current salary.");

  const summary = batchSummary(prepared);
  const changedIds = prepared.map((p) => p.revision.employeeId);
  const actor = actorFrom(ctx.scope, ctx.canApprove);
  // 4.12d: the first custom rule that applies decides who approves; else the company policy.
  const people: ChangeFact[] = prepared.map((p) => {
    const e = byId.get(p.revision.employeeId)!;
    return { before: p.before?.totalSalary ?? null, after: p.after.totalSalary, branchId: e.branchId ?? null, departmentId: e.departmentId ?? null };
  });
  const routed = policyForChange({ policy, rules }, { monthlyChange: summary.monthlyChange, people });
  const outcome = buildFlow(routed.policy, { preparerId: ctx.userId, preparerEmployeeId: ctx.scope.employeeId, subjectEmployeeIds: changedIds, approvers });
  const ownSalary = !outcome.approvedAtOnce && outcome.ownSubject;
  // "Save and approve": an administrator's Final approve in the same step, never on their own salary (S21).
  const finalNow = !!ctx.approveNow && !outcome.approvedAtOnce;
  if (finalNow && !actor.isAdministrator) throw new UserFacingError("Only a company administrator can save and approve in one step.");
  if (finalNow && ownSalary) throw new SelfDecisionError("This change includes your own salary, so someone else has to approve it.", "own_salary");

  const steps: repository.NewApprovalAction[] = [{ level: 0, actorId: ctx.userId, action: "submitted", note: routed.rule ? `Approval rule: ${routed.rule.name}` : undefined }];
  for (const l of outcome.flow.levels.filter((x) => x.skipped)) {
    steps.push({ level: l.level, actorId: null, action: "skipped", note: l.skipped === "preparer" ? "Approver prepared this change" : "Approver's own salary is in this change" });
  }
  if (outcome.approvedAtOnce) steps.push({ level: 0, actorId: ctx.userId, action: "not_required" });
  if (finalNow) steps.push({ level: 0, actorId: ctx.userId, action: "final_approved", note: "Saved and approved by a company administrator" });

  const route: ApprovalRoute | null = outcome.approvedAtOnce ? outcome.route : finalNow ? "final_approve" : null;
  const batchId = await repository.createBatch({
    kind: input.kind,
    effectiveFrom: input.effectiveFrom,
    reason: input.reason,
    monthlyChange: summary.monthlyChange,
    preparedBy: ctx.userId,
    approvedRoute: route,
    approvalType: outcome.approvedAtOnce ? "none" : outcome.flow.type,
    flow: outcome.flow,
    currentLevel: outcome.currentLevel,
    actions: steps,
    revisions: prepared.map((p) => p.revision),
  });
  const approved = route !== null;
  const open = approved ? await repository.findOpenRunsFrom(input.effectiveFrom, changedIds) : [];
  const levelUser = outcome.flow.levels.find((l) => l.level === outcome.currentLevel)?.userId;
  return {
    batchId,
    approved,
    route,
    ownSalary,
    employeeCount: summary.employeeCount,
    monthlyChange: summary.monthlyChange,
    recalculate: open.map((r) => `${BS_MONTHS_EN[r.month] ?? r.month} ${r.year}`),
    waitingFor: approved ? null : outcome.flow.type === "multi_level" && levelUser ? `Level ${outcome.currentLevel}: ${approvers.find((x) => x.userId === levelUser)?.name ?? "approver"}` : "an approver",
  };
}

/** A new employee's first structure (from the employee form): approved at once, effective from joining. */
export async function createStartingStructure(params: {
  employeeId: string;
  joiningDate: string;
  basic: number;
  gradeCount: number;
  gradeAmount: number;
  gradeManual: boolean;
  userId: string | null;
}): Promise<void> {
  const { heads, totalsSettings } = await loadContext();
  const lines: StructureLines = { ...EMPTY_LINES, basic: params.basic, gradeCount: params.gradeCount, gradeAmount: params.gradeAmount, gradeManual: params.gradeManual };
  const totals = structureTotals(lines, heads, totalsSettings);
  await repository.createBatch({
    kind: "hire",
    effectiveFrom: params.joiningDate,
    reason: "Starting salary",
    monthlyChange: totals.totalSalary,
    preparedBy: params.userId,
    approvedRoute: "on_hire",
    approvalType: "none",
    actions: [
      { level: 0, actorId: params.userId, action: "submitted" },
      { level: 0, actorId: params.userId, action: "not_required", note: "Starting salary on hire" },
    ],
    revisions: [{ employeeId: params.employeeId, basic: params.basic, gradeCount: params.gradeCount, gradeAmount: params.gradeAmount, gradeManual: params.gradeManual, netAmount: totals.netBeforeTax, heads: [] }],
  });
}

// ---------------------------------------------------------------------------
// Grade policy (4.12b, S50): a policy change is a salary change like any other
// ---------------------------------------------------------------------------

/** What a grade-policy change does: new grade amounts for active employees whose grade is worked out. */
async function policyGradeChanges(policy: Parameters<typeof gradeAmountFor>[1], scope: ScopeFilter) {
  const [{ heads, totalsSettings }, employees] = await Promise.all([loadContext(), employeesInScope(scope)]);
  const ids = employees.map((e) => e.id);
  const [{ revisions, heads: stored }, pending] = await Promise.all([repository.findRevisions(ids), repository.countPendingFor(ids)]);
  const changes: repository.NewRevision[] = [];
  const people: ChangeFact[] = [];
  let monthlyChange = 0;
  if (policy?.calculationMethod !== "MANUAL_INPUT") {
    for (const e of employees) {
      if (pending.has(e.id)) continue;
      const cur = latestApproved(revisions.filter((r) => r.employeeId === e.id).map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
      // Grades typed by hand stay as they are.
      if (!cur || cur.gradeManual) continue;
      const lines = linesFromHeads(
        { basic: Number(cur.basicSalary) || 0, gradeCount: cur.gradeCount ?? 0, gradeAmount: Number(cur.gradeAmount) || 0, gradeManual: false },
        stored.filter((h) => h.salaryMapId === cur.id),
        heads
      );
      const grade = gradeAmountFor(lines, policy);
      if (Math.abs(grade - lines.gradeAmount) < 0.005) continue;
      const before = structureTotals(lines, heads, totalsSettings);
      const next = { ...lines, gradeAmount: grade };
      const after = structureTotals(next, heads, totalsSettings);
      monthlyChange += after.totalSalary - before.totalSalary;
      changes.push({ employeeId: e.id, basic: next.basic, gradeCount: next.gradeCount, gradeAmount: grade, gradeManual: false, netAmount: after.netBeforeTax, heads: headsFromLines(next, heads) });
      people.push({ before: before.totalSalary, after: after.totalSalary, branchId: e.branchId ?? null, departmentId: e.departmentId ?? null });
    }
  }
  const byId = new Map(employees.map((e) => [e.id, e]));
  return { changes, people, monthlyChange: Math.round(monthlyChange * 100) / 100, pending: [...pending.keys()].map((id) => byId.get(id)?.fullName ?? "Unknown").sort() };
}

export interface PolicyGradeOutcome {
  employees: number;
  monthlyChange: number;
  /** Employees with a salary change already waiting: left out, by name. */
  pending: string[];
  ownSalary: boolean;
  approvedAtOnce: boolean;
  waitingFor: string | null;
  batchId: string | null;
}

async function policyFlow(changedIds: string[], change: { monthlyChange: number; people: ChangeFact[] }, ctx: { userId: string; scope: ScopeFilter }) {
  const [policy, { rules }, approvers] = await Promise.all([repository.getApprovalPolicy(), repository.getApprovalRules(), repository.findApprovers()]);
  // 4.12d: custom rules route a grade-policy change like any other salary change.
  const routed = policyForChange({ policy, rules }, change);
  const outcome = buildFlow(routed.policy, { preparerId: ctx.userId, preparerEmployeeId: ctx.scope.employeeId, subjectEmployeeIds: changedIds, approvers });
  const levelUser = outcome.flow.levels.find((l) => l.level === outcome.currentLevel)?.userId;
  const waiting = outcome.approvedAtOnce ? null : outcome.flow.type === "multi_level" && levelUser ? `Level ${outcome.currentLevel}: ${approvers.find((x) => x.userId === levelUser)?.name ?? "approver"}` : "an approver";
  return { outcome, waiting, ownSalary: !outcome.approvedAtOnce && !!outcome.ownSubject, rule: routed.rule };
}

/** What changing to this grade policy would do (nothing is written). */
export async function previewPolicyGrades(policy: Parameters<typeof gradeAmountFor>[1], ctx: { userId: string; scope: ScopeFilter }): Promise<Omit<PolicyGradeOutcome, "batchId">> {
  const { changes, people, monthlyChange, pending } = await policyGradeChanges(policy, ctx.scope);
  if (!changes.length) return { employees: 0, monthlyChange: 0, pending, ownSalary: false, approvedAtOnce: true, waitingFor: null };
  const { outcome, waiting, ownSalary } = await policyFlow(changes.map((c) => c.employeeId), { monthlyChange, people }, ctx);
  return { employees: changes.length, monthlyChange, pending, ownSalary, approvedAtOnce: outcome.approvedAtOnce, waitingFor: waiting };
}

/**
 * The grade policy changed: one "Grade policy" salary change for every active
 * employee whose worked-out grade changes, prepared by the user and decided
 * like any salary change — the company's approval settings, never by the
 * person it pays (S21), nothing edited in place. Grades typed by hand, and
 * employees with a change already waiting, are left out (the latter listed:
 * apply the policy again once that change is decided).
 */
export async function applyPolicyGrades(policy: Parameters<typeof gradeAmountFor>[1], ctx: { userId: string; scope: ScopeFilter }): Promise<PolicyGradeOutcome> {
  const { changes, people, monthlyChange, pending } = await policyGradeChanges(policy, ctx.scope);
  if (!changes.length) return { employees: 0, monthlyChange: 0, pending, ownSalary: false, approvedAtOnce: true, waitingFor: null, batchId: null };
  const { outcome, waiting, ownSalary, rule } = await policyFlow(changes.map((c) => c.employeeId), { monthlyChange, people }, ctx);
  const steps: repository.NewApprovalAction[] = [{ level: 0, actorId: ctx.userId, action: "submitted", note: rule ? `Grade policy changed · approval rule: ${rule.name}` : "Grade policy changed" }];
  for (const l of outcome.flow.levels.filter((x) => x.skipped)) {
    steps.push({ level: l.level, actorId: null, action: "skipped", note: l.skipped === "preparer" ? "Approver prepared this change" : "Approver's own salary is in this change" });
  }
  if (outcome.approvedAtOnce) steps.push({ level: 0, actorId: ctx.userId, action: "not_required" });
  const batchId = await repository.createBatch({
    kind: "policy",
    effectiveFrom: nepalDateIso(),
    reason: `Grade policy: ${gradeMethodLabel(policy ?? undefined)}`,
    monthlyChange,
    preparedBy: ctx.userId,
    approvedRoute: outcome.approvedAtOnce ? outcome.route : null,
    approvalType: outcome.approvedAtOnce ? "none" : outcome.flow.type,
    flow: outcome.flow,
    currentLevel: outcome.currentLevel,
    actions: steps,
    revisions: changes,
  });
  return { employees: changes.length, monthlyChange, pending, ownSalary, approvedAtOnce: outcome.approvedAtOnce, waitingFor: waiting, batchId };
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/** A refusal because the request concerns the user's own salary or is their own (the action audits it DENIED_SELF). */
export class SelfDecisionError extends UserFacingError {
  constructor(message: string, public code: "own_salary" | "own_request") {
    super(message);
    this.name = "SelfDecisionError";
  }
}

export interface DecideResult {
  employeeCount: number;
  status: BatchStatus;
  route: ApprovalRoute | null;
  /** The level approved (0: simple or final). */
  level: number;
}

/**
 * One decision on a pending batch: approve the current level (or, simple, the
 * batch), Final approve (company administrator), reject (reason required) or
 * withdraw (its preparer). Every employee in it must be in the user's scope;
 * the approval engine decides who may act (S21). Approving it for good
 * re-checks that payroll is still open for its months.
 */
export async function decideBatch(
  batchId: string,
  decision: Decision,
  note: string | null,
  ctx: { scope: ScopeFilter; userId: string; canApprove: boolean }
): Promise<DecideResult> {
  const batch = await repository.findBatchById(batchId);
  if (!batch) throw new UserFacingError("That change no longer exists. Refresh the page.");
  const inBatch = (await repository.findBatchEmployeeIds(batchId)).get(batchId) ?? [];
  const scoped = await employeesInScope(ctx.scope, { includeInactive: true });
  const allowed = new Set(scoped.map((e) => e.id));
  const outside = inBatch.filter((id) => !allowed.has(id));
  if (outside.length) throw new OutOfScopeError(outside);

  const approvers = await repository.findApprovers();
  const request = requestOf(batch, inBatch);
  const actor = actorFrom(ctx.scope, ctx.canApprove);
  const can = availableActions(request, actor, { approvers, today: nepalDateIso() });
  const ownSalary = includesOwn(actor.employeeId, inBatch);
  const refuse = (message: string) => {
    if (ownSalary) throw new SelfDecisionError("This change includes your own salary, so someone else has to approve or reject it.", "own_salary");
    if (request.preparedById === actor.userId && decision !== "withdraw") throw new SelfDecisionError(message, "own_request");
    throw new UserFacingError(message);
  };
  if (decision === "approve" && !can.approve) refuse(can.reason ?? "You cannot approve this change.");
  if (decision === "final_approve" && !can.finalApprove) refuse(can.reason ?? "Only a company administrator can Final approve.");
  if (decision === "reject" && !can.reject) refuse(request.preparedById === actor.userId ? "You prepared this change: withdraw it instead of rejecting it." : can.reason ?? "You cannot reject this change.");
  if (decision === "withdraw" && !can.withdraw) throw new UserFacingError(request.status !== "pending" ? `This change was already ${request.status}.` : "Only the person who prepared a change can withdraw it.");
  const cleanNote = note?.trim() || null;
  if (decision === "reject" && (!cleanNote || cleanNote.length < 3)) throw new UserFacingError("Give a reason for rejecting.");

  const next = applyDecision(request, decision);
  const level = decision === "approve" ? can.approve!.level : 0;
  const changed = await repository.decideBatch({
    batchId,
    expectedLevel: request.currentLevel,
    next,
    actorId: ctx.userId,
    note: cleanNote,
    action: {
      level,
      actorId: ctx.userId,
      onBehalfOf: decision === "approve" ? can.approve!.onBehalfOf : null,
      action: decision === "approve" ? "approved" : decision === "final_approve" ? "final_approved" : decision === "reject" ? "rejected" : "withdrawn",
      note: cleanNote,
    },
  });
  if (changed === null) throw new UserFacingError("Someone else acted on this change a moment ago. Refresh the page.");
  return { employeeCount: inBatch.length, status: next.status, route: next.route, level };
}

const includesOwn = (employeeId: string | null, ids: string[]) => !!employeeId && ids.includes(employeeId);

export interface ManyResult {
  id: string;
  ok: boolean;
  error?: string;
  /** Set when refused for the user's own salary / own request or out of scope (the action audits it). */
  refusal?: "own_salary" | "own_request" | "scope";
  result?: DecideResult;
}

/** The same decision on several batches (bulk approve / reject); each is checked on its own. */
export async function decideMany(ids: string[], decision: Decision, note: string | null, ctx: { scope: ScopeFilter; userId: string; canApprove: boolean }): Promise<ManyResult[]> {
  const out: ManyResult[] = [];
  for (const id of ids) {
    try {
      out.push({ id, ok: true, result: await decideBatch(id, decision, note, ctx) });
    } catch (error) {
      if (error instanceof SelfDecisionError) out.push({ id, ok: false, error: error.message, refusal: error.code });
      else if (error instanceof OutOfScopeError) out.push({ id, ok: false, error: error.message, refusal: "scope" });
      else if (error instanceof UserFacingError) out.push({ id, ok: false, error: error.message });
      else throw error;
    }
  }
  return out;
}

/** Salary changes this person can act on now (the title-bar bell). */
export async function countWaitingFor(scope: ScopeFilter, canApprove: boolean): Promise<number> {
  const pending = (await repository.findBatches()).filter((b) => b.status === "pending");
  if (!pending.length) return 0;
  const [approvers, members, scoped] = await Promise.all([repository.findApprovers(), repository.findBatchEmployeeIds(), employeesInScope(scope, { includeInactive: true })]);
  const allowed = new Set(scoped.map((e) => e.id));
  const actor = actorFrom(scope, canApprove);
  const today = nepalDateIso();
  return pending.filter((b) => {
    const ids = members.get(b.id) ?? [];
    return ids.every((id) => allowed.has(id)) && waitingFor(requestOf(b, ids), actor, { approvers, today });
  }).length;
}

// ---------------------------------------------------------------------------
// Approval settings
// ---------------------------------------------------------------------------

/** Pending changes keep the approvers they were submitted with; this says how many. */
export async function saveApprovalPolicy(raw: unknown): Promise<{ policy: ApprovalPolicy; pendingKept: number }> {
  const policy = parsePolicy(raw);
  const requested = raw && typeof raw === "object" ? (raw as { type?: unknown }).type : undefined;
  if (requested === "multi_level" && policy.type !== "multi_level") throw new StructureValidationError({ settings: { levels: "Add at least one approver" } });
  const approvers = await repository.findApprovers();
  const errors = validatePolicy(policy, approvers);
  if (Object.keys(errors).length) throw new StructureValidationError({ settings: errors });
  await repository.setApprovalPolicy(policy);
  const pendingKept = (await repository.findBatches()).filter((b) => b.status === "pending").length;
  return { policy, pendingKept };
}

export async function listApprovers(): Promise<ApproverInfo[]> {
  return repository.findApprovers();
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function saveTemplate(id: string | null, raw: unknown): Promise<TemplateRow> {
  const input = normalizeTemplate(raw);
  const errors: Record<string, string> = {};
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/.test(input.code)) errors.code = "Use up to 20 letters, digits, - or _";
  if (!input.name.trim()) errors.name = "Enter a name";
  if (input.basicMode === "amount" && !(input.basicAmount > 0)) errors.basicAmount = "Enter the basic salary, or use the level's starting salary";
  const { heads } = await loadContext();
  const known = new Set(heads.filter((h) => h.kind === "amount" || h.kind === "computed").map((h) => h.id));
  if (input.heads.some((h) => !known.has(h.payHeadId) || !(h.amount >= 0))) errors.heads = "Check the pay heads and amounts";
  const others = (await repository.findTemplates()).filter((t) => t.id !== id);
  if (others.some((t) => t.code.toUpperCase() === input.code.toUpperCase())) errors.code = "Another template uses this code";
  if (Object.keys(errors).length) throw new StructureValidationError({ template: errors });
  return toTemplateRow(await repository.saveTemplate(id, input));
}

export async function setTemplateActive(id: string, active: boolean): Promise<void> {
  await repository.setTemplateActive(id, active);
}

/**
 * Deletes a template. Salaries already filled from it are not touched: a
 * revision stores its own amounts and never points at a template.
 */
export async function deleteTemplate(id: string): Promise<{ code: string; name: string }> {
  const row = await repository.deleteTemplate(id);
  if (!row) throw new UserFacingError("That template no longer exists. Refresh the page.");
  return { code: row.code, name: row.name };
}



// ---------------------------------------------------------------------------
// Revision letter
// ---------------------------------------------------------------------------

export interface LetterData {
  employee: { fullName: string; employeeCode: string; designation: string; department: string; branch: string };
  revision: RevisionSummary;
  previous: RevisionSummary | null;
  heads: StructureHead[];
}

export async function getLetter(revisionId: string, scope: ScopeFilter): Promise<LetterData | null> {
  const employees = await employeesInScope(scope);
  const { heads, settings, totalsSettings } = await loadContext();
  const { revisions, heads: stored } = await repository.findRevisions(employees.map((e) => e.id));
  const rev = revisions.find((r) => r.id === revisionId);
  if (!rev || rev.status !== "approved") return null;
  const emp = employees.find((e) => e.id === rev.employeeId)!;
  const [names, tax] = await Promise.all([repository.findUserNames([rev.createdBy ?? "", rev.approvedBy ?? ""]), loadTaxRules(settings)]);
  const pay = { profile: profileOf(emp), tax };
  const mine = revisions.filter((r) => r.employeeId === rev.employeeId).map((r) => toSummary(r, stored, heads, totalsSettings, names, pay));
  const revision = mine.find((s) => s.id === revisionId)!;
  const previous = latestApproved(mine.filter((s) => s.id !== revisionId && (s.effectiveFrom < revision.effectiveFrom || (s.effectiveFrom === revision.effectiveFrom && s.createdAt < revision.createdAt))));
  const [departments, designations, branches] = await Promise.all([departmentRepository.findAllDepartments(), designationRepository.findAllDesignations(), branchRepository.findAllBranches()]);
  return {
    employee: {
      fullName: emp.fullName,
      employeeCode: emp.employeeCode,
      designation: designations.find((d) => d.id === emp.designationId)?.name ?? "",
      department: departments.find((d) => d.id === emp.departmentId)?.name ?? "",
      branch: branches.find((b) => b.id === emp.branchId)?.name ?? "",
    },
    revision,
    previous,
    heads,
  };
}

// ---------------------------------------------------------------------------
// Input reshaping (never trust what the browser sends)
// ---------------------------------------------------------------------------

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : NaN);
const str = (v: unknown, max: number) => (typeof v === "string" ? v : "").slice(0, max);

function normalizeLines(raw: unknown): StructureLines {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const amounts: Record<string, number> = {};
  if (o.amounts && typeof o.amounts === "object") for (const [k, v] of Object.entries(o.amounts as Record<string, unknown>).slice(0, 200)) amounts[k.slice(0, 64)] = num(v);
  const scheme = (["ssf", "pf", "none"].includes(o.scheme as string) ? o.scheme : "none") as RetirementScheme;
  return {
    basic: num(o.basic),
    gradeCount: Math.trunc(num(o.gradeCount)),
    gradeAmount: num(o.gradeAmount),
    gradeManual: o.gradeManual === true,
    scheme,
    amounts,
    computed: Array.isArray(o.computed) ? o.computed.filter((x): x is string => typeof x === "string").slice(0, 100) : [],
  };
}

export function normalizeBatch(raw: unknown): BatchInput {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = (["single", "bulk", "import", "setup", "increment"].includes(o.kind as string) ? o.kind : "bulk") as BatchInput["kind"];
  const effectiveFrom = str(o.effectiveFrom, 10);
  const reason = str(o.reason, 500).trim();
  if (!ISO.test(effectiveFrom)) throw new UserFacingError("Choose the date the change takes effect.");
  if (reason.length < 3) throw new UserFacingError("Give a short reason for the change.");
  const rows = Array.isArray(o.rows) ? o.rows : [];
  if (!rows.length) throw new UserFacingError("There are no rows to save.");
  if (rows.length > MAX_BATCH_ROWS) throw new UserFacingError(`Save at most ${MAX_BATCH_ROWS} employees at a time.`);
  const seen = new Set<string>();
  const out = rows.map((r) => {
    const x = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const employeeId = str(x.employeeId, 64);
    if (!employeeId || seen.has(employeeId)) throw new UserFacingError("Each employee can appear only once.");
    seen.add(employeeId);
    return { employeeId, lines: normalizeLines(x.lines) };
  });
  return { kind, effectiveFrom, reason, rows: out };
}

export function normalizeTemplate(raw: unknown): TemplateInput {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 200) : []);
  return {
    code: str(o.code, 30).trim(),
    name: str(o.name, 200).trim(),
    levelCodes: list(o.levelCodes),
    designationIds: list(o.designationIds),
    basicMode: o.basicMode === "level_start" ? "level_start" : "amount",
    basicAmount: num(o.basicAmount) || 0,
    scheme: (["ssf", "pf", "none", "keep"].includes(o.scheme as string) ? o.scheme : "keep") as TemplateInput["scheme"],
    heads: (Array.isArray(o.heads) ? o.heads : []).slice(0, 100).map((h) => {
      const x = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
      return { payHeadId: str(x.payHeadId, 64), amount: num(x.amount) || 0 };
    }),
  };
}

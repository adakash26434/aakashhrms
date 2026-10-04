import * as repository from "@/lib/repositories/salary-structure.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as payHeadRepository from "@/lib/repositories/pay-head.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as shreniRepository from "@/lib/repositories/shreni.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import {
  EMPTY_LINES,
  batchSummary,
  canDecideBatch,
  canWithdrawBatch,
  changedLines,
  classifyHead,
  gradeAmountFor,
  headsFromLines,
  latestApproved,
  linesFromHeads,
  structureTotals,
  validateLines,
  type PayHeadLike,
  type TotalsSettings,
} from "@/lib/engines/salary-structure.engine";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { PayHead } from "@/lib/types/pay-head";
import type { Employee } from "@/lib/types/employee";
import type {
  BatchInput,
  BatchKind,
  BatchLine,
  BatchRow,
  BatchStatus,
  RevisionStatus,
  RevisionSummary,
  RetirementScheme,
  SalaryStructureData,
  StructureHead,
  StructureLines,
  StructureRow,
  StructureTab,
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
  names: Map<string, string>
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
    totals: structureTotals(lines, heads, settings),
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
  const [{ heads, settings, totalsSettings }, employees, branches, departments, designations, levels, batches, templates, approval] = await Promise.all([
    loadContext(),
    employeesInScope(params.scope),
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    shreniRepository.findAllShreniLevels(),
    repository.findBatches(),
    repository.findTemplates(),
    repository.approvalRequired(),
  ]);
  const ids = employees.map((e) => e.id);
  const { revisions, heads: stored } = await repository.findRevisions(ids);
  const names = await repository.findUserNames([...revisions.flatMap((r) => [r.createdBy ?? "", r.approvedBy ?? ""]), ...batches.flatMap((b) => [b.preparedBy ?? "", b.decidedBy ?? ""])]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));
  const designationName = new Map(designations.map((d) => [d.id, d.name]));
  const today = nepalDateIso();

  const history: EmployeeHistory = {};
  const summariesByEmployee = new Map<string, RevisionSummary[]>();
  for (const r of revisions) {
    const list = summariesByEmployee.get(r.employeeId) ?? [];
    list.push(toSummary(r, stored, heads, totalsSettings, names));
    summariesByEmployee.set(r.employeeId, list);
  }

  const rows: StructureRow[] = employees.map((e) => {
    const list = summariesByEmployee.get(e.id) ?? [];
    history[e.id] = [...list].sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? b.createdAt.localeCompare(a.createdAt) : b.effectiveFrom.localeCompare(a.effectiveFrom)));
    const current = latestApproved(list);
    const pending = list.find((s) => s.status === "pending");
    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      branchId: e.branchId,
      branchName: branchName.get(e.branchId) ?? "",
      departmentId: e.departmentId,
      departmentName: departmentName.get(e.departmentId) ?? "",
      designationId: e.designationId,
      designationName: designationName.get(e.designationId) ?? "",
      levelCode: e.shreni ?? "",
      category: e.category,
      status: pending ? "pending" : !current ? "none" : current.effectiveFrom > today ? "future" : "current",
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
      createdAt: b.createdAt.toISOString(),
      lines,
    });
  }

  return {
    tab: params.tab,
    rows: rows.sort((a, b) => a.fullName.localeCompare(b.fullName)),
    heads,
    levels: levels.map((l) => ({ code: l.code, name: l.name, minSalary: l.minSalary ?? 0 })),
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    designations: designations.map((d) => ({ id: d.id, name: d.name })),
    batches: batchRows,
    templates: templates.map(toTemplateRow),
    gradePolicy: settings.gradePolicy ?? null,
    ssfBase: totalsSettings.ssfBase,
    pfPercent: totalsSettings.pfPercent,
    approvalRequired: approval,
    currentUserId: params.userId,
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
  employeeCount: number;
  monthlyChange: number;
}

/**
 * One change batch (a single revision, a bulk edit or an import). Every value
 * is re-checked here: employees must be active and in scope, with no change
 * already waiting; grades follow the policy unless typed by hand; rows that
 * change nothing are dropped.
 */
export async function submitBatch(raw: unknown, ctx: { scope: ScopeFilter; userId: string }): Promise<SubmitResult> {
  const input = normalizeBatch(raw);
  const [{ heads, settings, totalsSettings }, employees, levels, approval] = await Promise.all([
    loadContext(),
    employeesInScope(ctx.scope, { includeInactive: true }),
    shreniRepository.findAllShreniLevels(),
    repository.approvalRequired(),
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
  const { revisions, heads: stored } = await repository.findRevisions(input.rows.map((r) => r.employeeId));
  const levelStart = (code: string) => levels.find((l) => l.code === code || l.name === code)?.minSalary ?? 0;

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
    if (current && !changedLines(current, lines).length) continue;
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
  const batchId = await repository.createBatch({
    kind: input.kind,
    effectiveFrom: input.effectiveFrom,
    reason: input.reason,
    monthlyChange: summary.monthlyChange,
    preparedBy: ctx.userId,
    approved: !approval,
    revisions: prepared.map((p) => p.revision),
  });
  return { batchId, approved: !approval, employeeCount: summary.employeeCount, monthlyChange: summary.monthlyChange };
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
    monthlyChange: totals.gross,
    preparedBy: params.userId,
    approved: true,
    revisions: [{ employeeId: params.employeeId, basic: params.basic, gradeCount: params.gradeCount, gradeAmount: params.gradeAmount, gradeManual: params.gradeManual, netAmount: totals.netBeforeTax, heads: [] }],
  });
}

/**
 * The grade policy changed: one approved, system-prepared revision per
 * employee whose policy grade changes (grades typed by hand are left alone).
 */
export async function applyPolicyGrades(policy: Parameters<typeof gradeAmountFor>[1], userId: string | null): Promise<number> {
  const { heads, totalsSettings } = await loadContext();
  const employees = (await employeeRepository.findAll(ALL)).filter((e) => e.status === "Active");
  const { revisions, heads: stored } = await repository.findRevisions(employees.map((e) => e.id));
  if (policy?.calculationMethod === "MANUAL_INPUT") return 0;
  const changes: repository.NewRevision[] = [];
  let monthlyChange = 0;
  for (const e of employees) {
    const mine = revisions.filter((r) => r.employeeId === e.id);
    const cur = latestApproved(mine.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
    if (!cur || cur.gradeManual) continue;
    const lines = linesFromHeads(
      { basic: Number(cur.basicSalary) || 0, gradeCount: cur.gradeCount ?? 0, gradeAmount: Number(cur.gradeAmount) || 0, gradeManual: false },
      stored.filter((s) => s.salaryMapId === cur.id),
      heads
    );
    const grade = gradeAmountFor(lines, policy);
    if (Math.abs(grade - lines.gradeAmount) < 0.005) continue;
    const before = structureTotals(lines, heads, totalsSettings);
    const next = { ...lines, gradeAmount: grade };
    const after = structureTotals(next, heads, totalsSettings);
    monthlyChange += after.gross - before.gross;
    changes.push({ employeeId: e.id, basic: next.basic, gradeCount: next.gradeCount, gradeAmount: grade, gradeManual: false, netAmount: after.netBeforeTax, heads: headsFromLines(next, heads) });
  }
  if (!changes.length) return 0;
  await repository.createBatch({
    kind: "policy",
    effectiveFrom: nepalDateIso(),
    reason: "Grade policy changed",
    monthlyChange,
    preparedBy: userId,
    approved: true,
    revisions: changes,
  });
  return changes.length;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/** Approve or reject (needs Approve, never your own batch) or withdraw (only your own). */
export async function decideBatch(
  batchId: string,
  decision: "approved" | "rejected" | "withdrawn",
  note: string | null,
  ctx: { scope: ScopeFilter; userId: string; canApprove: boolean }
): Promise<{ employeeCount: number; ownBatch: boolean }> {
  const batch = await repository.findBatchById(batchId);
  if (!batch) throw new UserFacingError("That change no longer exists. Refresh the page.");
  const status = batch.status as BatchStatus;
  const ref = { status, preparedById: batch.preparedBy };
  // Every employee in the batch must be in the user's scope.
  const { revisions } = await repository.findRevisions(null);
  const inBatch = revisions.filter((r) => r.batchId === batchId).map((r) => r.employeeId);
  const allowed = new Set((await employeesInScope(ctx.scope, { includeInactive: true })).map((e) => e.id));
  const outside = inBatch.filter((id) => !allowed.has(id));
  if (outside.length) throw new OutOfScopeError(outside);
  if (status !== "pending") throw new UserFacingError(`This change was already ${status}.`);
  if (decision === "withdrawn") {
    if (!canWithdrawBatch(ref, ctx.userId)) throw new UserFacingError("Only the person who prepared a change can withdraw it.");
  } else {
    if (batch.preparedBy === ctx.userId) return { employeeCount: 0, ownBatch: true };
    if (!canDecideBatch(ref, ctx.userId, ctx.canApprove)) throw new UserFacingError("You cannot approve or reject salary changes.");
    if (decision === "rejected" && !(note ?? "").trim()) throw new UserFacingError("Give a reason for rejecting.");
  }
  const changed = await repository.decideBatch(batchId, decision, ctx.userId, note?.trim() || null);
  return { employeeCount: changed.length, ownBatch: false };
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

export async function setApprovalRequired(on: boolean): Promise<void> {
  await repository.setApprovalRequired(on);
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
  const { heads, totalsSettings } = await loadContext();
  const { revisions, heads: stored } = await repository.findRevisions(employees.map((e) => e.id));
  const rev = revisions.find((r) => r.id === revisionId);
  if (!rev || rev.status !== "approved") return null;
  const emp = employees.find((e) => e.id === rev.employeeId)!;
  const names = await repository.findUserNames([rev.createdBy ?? "", rev.approvedBy ?? ""]);
  const mine = revisions.filter((r) => r.employeeId === rev.employeeId).map((r) => toSummary(r, stored, heads, totalsSettings, names));
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
  const kind = (["single", "bulk", "import"].includes(o.kind as string) ? o.kind : "bulk") as BatchInput["kind"];
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

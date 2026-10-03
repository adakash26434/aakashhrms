// Organization (4.3): pure rules for the workforce masters — validation,
// what blocks a delete, the branch × department matrix, the reporting tree,
// which departments a branch may use, and the renames that must follow to
// employees. No database access here; see organization.service.ts.

import { validatePhoneNumber } from "@/lib/utils/phone";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type {
  BranchInput,
  DepartmentInput,
  DesignationInput,
  EmploymentTypeInput,
  LevelInput,
  OrgErrors,
  OrgHeadcount,
  OrgKind,
  OrgPerson,
  OrgTab,
  OrgUsage,
} from "@/lib/types/organization";
import { ORG_TABS } from "@/lib/types/organization";

const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REMOTE_CATEGORIES: { value: string; label: string }[] = [
  { value: "NONE", label: "Not a remote area" },
  { value: "A", label: "Remote area A (क)" },
  { value: "B", label: "Remote area B (ख)" },
  { value: "C", label: "Remote area C (ग)" },
  { value: "D", label: "Remote area D (घ)" },
  { value: "E", label: "Remote area E (ङ)" },
];

export const ORG_KIND_LABEL: Record<OrgKind, string> = {
  branch: "branch",
  department: "department",
  designation: "designation",
  level: "grade level",
  type: "employment type",
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Unique within its list (case-insensitive), ignoring the record being edited. */
function taken<T extends { id: string }>(list: readonly T[], pick: (row: T) => string, value: string, excludeId?: string | null): boolean {
  return list.some((row) => row.id !== excludeId && same(pick(row), value));
}

function text(errors: OrgErrors, field: string, value: string, label: string, max: number, required = true) {
  const v = value.trim();
  if (!v) {
    if (required) errors[field] = `Enter the ${label}`;
  } else if (v.length > max) errors[field] = `${label[0].toUpperCase()}${label.slice(1)} can be at most ${max} characters`;
}

function code(errors: OrgErrors, value: string, list: readonly { id: string; code: string }[], excludeId: string | null | undefined, what: string) {
  const v = value.trim();
  if (!v) errors.code = "Enter a code";
  else if (!CODE.test(v)) errors.code = "Use up to 20 letters, digits, - or _ (no spaces)";
  else if (taken(list, (r) => r.code, v, excludeId)) errors.code = `Another ${what} already uses code ${v.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Validation (the same rules run in the Window on Enter and on the server)
// ---------------------------------------------------------------------------

export function validateBranchInput(
  input: BranchInput,
  existing: readonly { id: string; code: string; name: string }[],
  excludeId?: string | null
): OrgErrors {
  const errors: OrgErrors = {};
  code(errors, input.code, existing, excludeId, "branch");
  text(errors, "name", input.name, "branch name", 120);
  if (!errors.name && taken(existing, (r) => r.name, input.name, excludeId)) errors.name = "Another branch has this name";
  text(errors, "location", input.location, "location", 600);
  if (input.phone.trim() && !validatePhoneNumber(input.phone).isValid) errors.phone = "Enter a valid phone number for the chosen country";
  if (input.email.trim() && !EMAIL.test(input.email.trim())) errors.email = "Enter a valid email address";
  if (!REMOTE_CATEGORIES.some((c) => c.value === input.remoteCategory) && input.remoteCategory) errors.remoteCategory = "Choose a remote-area category";
  return errors;
}

export function validateDepartmentInput(
  input: DepartmentInput,
  existing: readonly { id: string; code: string; name: string }[],
  branchIds: readonly string[],
  excludeId?: string | null
): OrgErrors {
  const errors: OrgErrors = {};
  code(errors, input.code, existing, excludeId, "department");
  text(errors, "name", input.name, "department name", 120);
  if (!errors.name && taken(existing, (r) => r.name, input.name, excludeId)) errors.name = "Another department has this name";
  if (input.branchIds.some((id) => !branchIds.includes(id))) errors.branchIds = "One of the chosen branches no longer exists";
  text(errors, "description", input.description, "description", 500, false);
  return errors;
}

export function validateDesignationInput(
  input: DesignationInput,
  existing: readonly { id: string; name: string; departmentId: string }[],
  departmentIds: readonly string[],
  excludeId?: string | null
): OrgErrors {
  const errors: OrgErrors = {};
  text(errors, "name", input.name, "designation", 120);
  if (!input.departmentId) errors.departmentId = "Choose the department";
  else if (!departmentIds.includes(input.departmentId)) errors.departmentId = "That department no longer exists";
  if (!errors.name && !errors.departmentId && existing.some((d) => d.id !== excludeId && d.departmentId === input.departmentId && same(d.name, input.name))) {
    errors.name = "This department already has a designation with this name";
  }
  text(errors, "description", input.description, "description", 500, false);
  return errors;
}

export function validateLevelInput(
  input: LevelInput,
  existing: readonly { id: string; code: string; name: string }[],
  excludeId?: string | null
): OrgErrors {
  const errors: OrgErrors = {};
  code(errors, input.code, existing, excludeId, "level");
  text(errors, "name", input.name, "level name", 120);
  if (!errors.name && taken(existing, (r) => r.name, input.name, excludeId)) errors.name = "Another level has this name";
  if (!Number.isInteger(input.levelNumber) || input.levelNumber < 1 || input.levelNumber > 99) errors.levelNumber = "Level number must be 1 to 99";
  if (input.minSalary < 0) errors.minSalary = "Starting salary cannot be negative";
  if (input.maxSalary < 0) errors.maxSalary = "Maximum salary cannot be negative";
  else if (input.maxSalary > 0 && input.maxSalary < input.minSalary) errors.maxSalary = "Maximum salary is below the starting salary";
  text(errors, "labelNepali", input.labelNepali, "Nepali label", 120, false);
  return errors;
}

export function validateTypeInput(
  input: EmploymentTypeInput,
  existing: readonly { id: string; code: string; name: string }[],
  excludeId?: string | null
): OrgErrors {
  const errors: OrgErrors = {};
  code(errors, input.code, existing, excludeId, "employment type");
  text(errors, "name", input.name, "type name", 50);
  if (!errors.name && taken(existing, (r) => r.name, input.name, excludeId)) errors.name = "Another employment type has this name";
  if (!Number.isInteger(input.noticePeriodDays) || input.noticePeriodDays < 0 || input.noticePeriodDays > 365) errors.noticePeriodDays = "Notice period must be 0 to 365 days";
  if (!Number.isInteger(input.probationMonths) || input.probationMonths < 0 || input.probationMonths > 24) errors.probationMonths = "Probation must be 0 to 24 months";
  return errors;
}

// ---------------------------------------------------------------------------
// Deletes: only records nothing has ever used (otherwise make them inactive)
// ---------------------------------------------------------------------------

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Why a record cannot be deleted; empty when it may be. */
export function deleteBlockers(usage: OrgUsage): string[] {
  const out: string[] = [];
  if (usage.employees) out.push(plural(usage.employees, "employee"));
  if (usage.designations) out.push(plural(usage.designations, "designation"));
  if (usage.departments) out.push(plural(usage.departments, "department limited to it", "departments limited to it"));
  if (usage.users) out.push(plural(usage.users, "user login's access", "user logins' access"));
  if (usage.holidays) out.push(plural(usage.holidays, "holiday"));
  if (usage.payrollRuns) out.push(plural(usage.payrollRuns, "payroll run"));
  return out;
}

export function deleteRefusal(kind: OrgKind, usage: OrgUsage): string | null {
  const blockers = deleteBlockers(usage);
  if (!blockers.length) return null;
  return `This ${ORG_KIND_LABEL[kind]} is used by ${blockers.join(", ")}, so it is kept for the records. Make it inactive instead.`;
}

// ---------------------------------------------------------------------------
// Company-wide departments
// ---------------------------------------------------------------------------

/** A department with no branch list is open to every branch. */
export function departmentOpenToBranch(department: { branchIds: readonly string[] }, branchId: string): boolean {
  return department.branchIds.length === 0 || !branchId || department.branchIds.includes(branchId);
}

/**
 * Where an employee may be placed (the save checks this): branch, department
 * and designation must be active unless they are the stored values, the
 * department must be open to the branch, and the designation must belong to
 * the department.
 */
export function placementErrors(
  next: { branchId: string; departmentId: string; designationId: string },
  stored: { branchId: string; departmentId: string; designationId: string } | null,
  org: {
    branches: readonly { id: string; status: string }[];
    departments: readonly { id: string; status: string; branchIds: readonly string[] }[];
    designations: readonly { id: string; status: string; departmentId: string }[];
  }
): Record<string, string> {
  const errors: Record<string, string> = {};
  const branch = org.branches.find((b) => b.id === next.branchId);
  const department = org.departments.find((d) => d.id === next.departmentId);
  const designation = org.designations.find((d) => d.id === next.designationId);
  if (branch && branch.status === "inactive" && branch.id !== stored?.branchId) errors.branchId = "This branch is inactive. Choose an active branch.";
  if (department && department.status === "inactive" && department.id !== stored?.departmentId) errors.departmentId = "This department is inactive. Choose an active department.";
  // Only on a change, so older placements never block an unrelated edit (Structure flags them instead).
  else if (department && branch && !departmentOpenToBranch(department, branch.id) && (department.id !== stored?.departmentId || branch.id !== stored?.branchId)) {
    errors.departmentId = "This department is not open to the chosen branch.";
  }
  if (designation && designation.status === "inactive" && designation.id !== stored?.designationId) errors.designationId = "This designation is inactive. Choose an active designation.";
  else if (designation && department && designation.departmentId !== department.id && designation.id !== stored?.designationId) {
    errors.designationId = "This designation belongs to another department.";
  }
  return errors;
}

/** Options for a picker: active records, plus the current value even if it is now inactive. */
export function pickable<T extends { id: string; status: string }>(rows: readonly T[], current?: string | null): T[] {
  return rows.filter((r) => r.status === "active" || r.id === current);
}

// ---------------------------------------------------------------------------
// Structure: branch × department headcount
// ---------------------------------------------------------------------------

export interface OrgMatrix {
  /** cells[branchId][departmentId] = active headcount */
  cells: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  columnTotals: Record<string, number>;
  total: number;
}

export function branchDepartmentMatrix(headcounts: readonly OrgHeadcount[]): OrgMatrix {
  const matrix: OrgMatrix = { cells: {}, rowTotals: {}, columnTotals: {}, total: 0 };
  for (const h of headcounts) {
    const row = (matrix.cells[h.branchId] ??= {});
    row[h.departmentId] = (row[h.departmentId] ?? 0) + h.count;
    matrix.rowTotals[h.branchId] = (matrix.rowTotals[h.branchId] ?? 0) + h.count;
    matrix.columnTotals[h.departmentId] = (matrix.columnTotals[h.departmentId] ?? 0) + h.count;
    matrix.total += h.count;
  }
  return matrix;
}

/** Active headcount by any key of the rows (designation, department, branch). */
export function headcountBy(headcounts: readonly OrgHeadcount[], key: keyof Omit<OrgHeadcount, "count">): Map<string, number> {
  const out = new Map<string, number>();
  for (const h of headcounts) out.set(h[key], (out.get(h[key]) ?? 0) + h.count);
  return out;
}

// ---------------------------------------------------------------------------
// Reporting chart (from each employee's "Reports to")
// ---------------------------------------------------------------------------

export interface ReportingNode {
  person: OrgPerson;
  children: ReportingNode[];
  /** Everyone below, at any depth. */
  teamSize: number;
}

export interface ReportingTree {
  roots: ReportingNode[];
  /** People in a loop of "reports to" (A → B → A); drawn once under the first of them. */
  inCycle: string[];
  /** Active people whose supervisor is inactive. */
  inactiveSupervisor: string[];
  /** Active people with no supervisor who manage nobody. */
  unassigned: string[];
}

/**
 * Builds the chart from "Reports to". Only active people are drawn; someone
 * whose supervisor is missing, inactive or outside the list becomes a root.
 * Cycles are broken at the first person reached, so every person appears once.
 */
export function reportingTree(people: readonly OrgPerson[]): ReportingTree {
  const active = people.filter((p) => p.status === "Active");
  const byId = new Map(people.map((p) => [p.id, p]));
  const activeIds = new Set(active.map((p) => p.id));
  const parentOf = (p: OrgPerson) => (p.supervisorId && p.supervisorId !== p.id && activeIds.has(p.supervisorId) ? p.supervisorId : null);

  const children = new Map<string, OrgPerson[]>();
  for (const p of active) {
    const parent = parentOf(p);
    if (parent) children.set(parent, [...(children.get(parent) ?? []), p]);
  }

  // People in a cycle never reach a root by walking up.
  const inCycle = new Set<string>();
  for (const p of active) {
    const seen = new Set<string>();
    let cur: OrgPerson | undefined = p;
    while (cur && parentOf(cur)) {
      if (seen.has(cur.id)) {
        // Mark the loop itself.
        let loop: OrgPerson | undefined = cur;
        do {
          inCycle.add(loop!.id);
          loop = byId.get(parentOf(loop!)!);
        } while (loop && loop.id !== cur.id);
        break;
      }
      seen.add(cur.id);
      cur = byId.get(parentOf(cur)!);
    }
  }

  const sortByName = (a: OrgPerson, b: OrgPerson) => a.fullName.localeCompare(b.fullName);
  const placed = new Set<string>();
  const build = (p: OrgPerson): ReportingNode => {
    placed.add(p.id);
    const kids = (children.get(p.id) ?? []).filter((c) => !placed.has(c.id)).sort(sortByName).map(build);
    return { person: p, children: kids, teamSize: kids.reduce((n, k) => n + 1 + k.teamSize, 0) };
  };

  const roots = active.filter((p) => !parentOf(p)).sort(sortByName).map(build);
  // A cycle has no root: draw it from its first member (alphabetically).
  for (const p of active.filter((x) => inCycle.has(x.id)).sort(sortByName)) {
    if (!placed.has(p.id)) roots.push(build(p));
  }

  return {
    roots,
    inCycle: [...inCycle],
    inactiveSupervisor: active.filter((p) => p.supervisorId && byId.get(p.supervisorId)?.status === "Inactive").map((p) => p.id),
    unassigned: active.filter((p) => !p.supervisorId && !(children.get(p.id)?.length)).map((p) => p.id),
  };
}

// ---------------------------------------------------------------------------
// Renames that must follow to employees (they hold levels and types as text)
// ---------------------------------------------------------------------------

/** Employees store a level by code (older ones by name): both move to the new code. */
export function levelRenames(before: { code: string; name: string }, after: { code: string; name: string }): { from: string; to: string }[] {
  const to = after.code.trim().toUpperCase();
  const out: { from: string; to: string }[] = [];
  if (before.code !== to) out.push({ from: before.code, to });
  if (before.name.trim() !== after.name.trim() || before.code !== to) out.push({ from: before.name, to });
  return out.filter((r, i, all) => r.from && r.from !== r.to && all.findIndex((x) => x.from === r.from) === i);
}

/** Employees store an employment type by its name. */
export function typeRenames(before: { name: string }, after: { name: string }): { from: string; to: string }[] {
  return before.name.trim() === after.name.trim() ? [] : [{ from: before.name, to: after.name.trim() }];
}

// ---------------------------------------------------------------------------
// Security (S19)
// ---------------------------------------------------------------------------

/** Masters are company-wide: only a company-wide (GLOBAL) role may change them. */
export function canChangeMasters(scope: Pick<ScopeFilter, "scopeType">): boolean {
  return scope.scopeType === "GLOBAL";
}

/** Field names that changed (the audit records names only, never values). */
export function changedOrgFields(before: object, after: object): string[] {
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return Object.keys(a).filter((key) => key in b && JSON.stringify(b[key] ?? null) !== JSON.stringify(a[key] ?? null));
}

/** Next free code with a prefix: DEPT-001, DEPT-002 … (gaps are not reused). */
export function nextOrgCode(existing: readonly string[], prefix: string): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const max = existing.reduce((m, c) => Math.max(m, Number(re.exec(c)?.[1] ?? 0)), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** The tab to open: a known one, else Structure. Older links used "shreni" / "employment_types". */
export function resolveOrgTab(raw: string | undefined | null): OrgTab {
  const t = (raw ?? "").toLowerCase().replace(/[- ]/g, "_");
  if (t === "shreni") return "levels";
  if (t === "employment_types") return "types";
  return (ORG_TABS as readonly string[]).includes(t) ? (t as OrgTab) : "structure";
}

/** What an employment type entitles people to, in short ("PF · SSF · Leave"). */
export function typeEligibility(t: { isPfEligible: boolean; isSsfEligible: boolean; isFestivalEligible: boolean; isLeaveEligible: boolean; isOtEligible: boolean }): string {
  return [t.isPfEligible && "PF", t.isSsfEligible && "SSF", t.isFestivalEligible && "Festival", t.isLeaveEligible && "Leave", t.isOtEligible && "OT"].filter(Boolean).join(" · ");
}

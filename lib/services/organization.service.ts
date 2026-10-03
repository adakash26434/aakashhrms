import * as repository from "@/lib/repositories/organization.repository";
import { seedShreniPreset } from "@/lib/repositories/shreni.repository";
import { INDUSTRY_PRESET_TEMPLATES } from "@/lib/constants/industry-types";
import {
  changedOrgFields,
  deleteRefusal,
  levelRenames,
  typeRenames,
  validateBranchInput,
  validateDepartmentInput,
  validateDesignationInput,
  validateLevelInput,
  validateTypeInput,
} from "@/lib/engines/organization.engine";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { UserFacingError } from "@/lib/errors/action-error";
import type {
  BranchInput,
  DepartmentInput,
  DesignationInput,
  EmploymentTypeInput,
  LevelInput,
  OrgBranch,
  OrgDepartment,
  OrgDesignation,
  OrgEmploymentType,
  OrgErrors,
  OrgKind,
  OrgLevel,
  OrgStatus,
  OrgTab,
  OrganizationData,
  OrgUsage,
} from "@/lib/types/organization";

export class OrgValidationError extends Error {
  constructor(public errors: OrgErrors) {
    super("Some fields need attention.");
    this.name = "OrgValidationError";
  }
}

const NOT_FOUND = "That record no longer exists. Refresh the page.";
const status = (s: string): OrgStatus => (s === "inactive" ? "inactive" : "active");
const activeFlag = (b: boolean): OrgStatus => (b ? "active" : "inactive");

type Masters = Awaited<ReturnType<typeof repository.findMasters>>;
type Usage = repository.UsageCounts;

function toBranches(m: Masters, u: Usage): OrgBranch[] {
  return m.branchRows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    location: r.location,
    phone: r.phone,
    email: r.email,
    isHeadOffice: r.isHeadOffice,
    remoteCategory: r.remoteCategory || "NONE",
    status: status(r.status),
    headcount: 0,
    usage: {
      employees: u.employeesByBranch.get(r.id) ?? 0,
      departments: u.departmentsByBranch.get(r.id) ?? 0,
      users: u.usersByBranch.get(r.id) ?? 0,
      holidays: u.holidaysByBranch.get(r.id) ?? 0,
      payrollRuns: u.runsByBranch.get(r.id) ?? 0,
    },
  }));
}

function toDepartments(m: Masters, u: Usage): OrgDepartment[] {
  return m.departmentRows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    branchIds: r.branchIds ?? [],
    headEmployeeId: r.headEmployeeId ?? null,
    headName: r.headName ?? null,
    description: r.description ?? "",
    status: status(r.status),
    headcount: 0,
    usage: {
      employees: u.employeesByDepartment.get(r.id) ?? 0,
      designations: u.designationsByDepartment.get(r.id) ?? 0,
      users: u.usersByDepartment.get(r.id) ?? 0,
      payrollRuns: u.runsByDepartment.get(r.id) ?? 0,
    },
  }));
}

function toDesignations(m: Masters, u: Usage): OrgDesignation[] {
  return m.designationRows.map((r) => ({
    id: r.id,
    name: r.name,
    departmentId: r.departmentId,
    description: r.description ?? "",
    status: status(r.status),
    headcount: 0,
    usage: { employees: u.employeesByDesignation.get(r.id) ?? 0, payrollRuns: u.runsByDesignation.get(r.id) ?? 0 },
  }));
}

/** Employees hold a level by code (older ones by name). */
function levelUsage(r: repository.LevelRow, u: Usage): OrgUsage {
  const byName = r.name !== r.code ? (u.employeesByLevel.get(r.name) ?? 0) : 0;
  return { employees: (u.employeesByLevel.get(r.code) ?? 0) + byName };
}

function toLevels(m: Masters, u: Usage): OrgLevel[] {
  return m.levelRows
    .map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      levelNumber: r.levelNumber,
      labelNepali: r.labelNepali ?? "",
      description: r.description ?? "",
      minSalary: Number(r.minSalary) || 0,
      maxSalary: Number(r.maxSalary) || 0,
      rankOrder: r.rankOrder,
      status: activeFlag(r.isActive),
      headcount: 0,
      usage: levelUsage(r, u),
    }))
    .sort((a, b) => a.rankOrder - b.rankOrder || a.levelNumber - b.levelNumber);
}

function toTypes(m: Masters, u: Usage): OrgEmploymentType[] {
  return m.typeRows
    .map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameNepali: r.nameNepali ?? "",
      isPfEligible: r.isPfEligible,
      isSsfEligible: r.isSsfEligible,
      isFestivalEligible: r.isFestivalEligible,
      isLeaveEligible: r.isLeaveEligible,
      isOtEligible: r.isOtEligible,
      noticePeriodDays: r.noticePeriodDays,
      probationMonths: r.probationMonths,
      rankOrder: r.rankOrder,
      status: activeFlag(r.isActive),
      headcount: 0,
      usage: { employees: u.employeesByCategory.get(r.name) ?? 0, payrollRuns: u.runsByCategory.get(r.name) ?? 0 },
    }))
    .sort((a, b) => a.rankOrder - b.rankOrder);
}

/**
 * Everything the Organization page shows. Masters and headcounts need only
 * Organization → View (counts, no names); people (reporting chart, head
 * picker) need Employees → View and follow that scope.
 */
export async function getOrganizationData(params: {
  tab: OrgTab;
  peopleScope: ScopeFilter | null;
  permissions: OrganizationData["permissions"];
  activeOnlyHeadcount?: boolean;
}): Promise<OrganizationData> {
  const [masters, usage, people] = await Promise.all([
    repository.findMasters(),
    repository.findUsage(),
    params.peopleScope ? repository.findPeople(buildEmployeeScopeCondition(params.peopleScope)) : Promise.resolve(null),
  ]);
  const branches = toBranches(masters, usage);
  const departments = toDepartments(masters, usage);
  const designations = toDesignations(masters, usage);
  const levels = toLevels(masters, usage);
  const types = toTypes(masters, usage);

  // Active headcount per record (from the same grouped query as the matrix).
  const add = (map: Map<string, number>, key: string, n: number) => map.set(key, (map.get(key) ?? 0) + n);
  const byBranch = new Map<string, number>();
  const byDept = new Map<string, number>();
  const byDesig = new Map<string, number>();
  for (const h of usage.headcounts) {
    add(byBranch, h.branchId, h.count);
    add(byDept, h.departmentId, h.count);
    add(byDesig, h.designationId, h.count);
  }
  branches.forEach((b) => (b.headcount = byBranch.get(b.id) ?? 0));
  departments.forEach((d) => (d.headcount = byDept.get(d.id) ?? 0));
  designations.forEach((d) => (d.headcount = byDesig.get(d.id) ?? 0));
  // Levels and types are held as text; their headcount is every employee holding them, any status.
  levels.forEach((l) => (l.headcount = l.usage.employees));
  types.forEach((t) => (t.headcount = t.usage.employees));

  return {
    tab: params.tab,
    branches: branches.sort((a, b) => Number(b.isHeadOffice) - Number(a.isHeadOffice) || a.name.localeCompare(b.name)),
    departments: departments.sort((a, b) => a.name.localeCompare(b.name)),
    designations: designations.sort((a, b) => a.name.localeCompare(b.name)),
    levels,
    types,
    headcounts: usage.headcounts,
    people,
    levelPresets: INDUSTRY_PRESET_TEMPLATES.map((t) => ({ key: t.key, label: t.name })),
    permissions: params.permissions,
  };
}

// ---------------------------------------------------------------------------
// Writes (the action has checked permission and company-wide scope)
// ---------------------------------------------------------------------------

export interface OrgSaveResult {
  id: string;
  name: string;
  /** Field names that changed (empty on create). */
  changed: string[];
  /** Employees whose level or employment type followed a rename. */
  moved: number;
}

const BRANCH_FIELDS = (r: repository.BranchRow): BranchInput => ({
  code: r.code,
  name: r.name,
  location: r.location,
  phone: r.phone,
  email: r.email,
  isHeadOffice: r.isHeadOffice,
  remoteCategory: r.remoteCategory || "NONE",
});
const DEPARTMENT_FIELDS = (r: repository.DepartmentRow): DepartmentInput => ({
  code: r.code,
  name: r.name,
  branchIds: r.branchIds ?? [],
  headEmployeeId: r.headEmployeeId ?? null,
  description: r.description ?? "",
});
const DESIGNATION_FIELDS = (r: repository.DesignationRow): DesignationInput => ({ name: r.name, departmentId: r.departmentId, description: r.description ?? "" });
const LEVEL_FIELDS = (r: repository.LevelRow): LevelInput => ({
  code: r.code,
  name: r.name,
  levelNumber: r.levelNumber,
  labelNepali: r.labelNepali ?? "",
  description: r.description ?? "",
  minSalary: Number(r.minSalary) || 0,
  maxSalary: Number(r.maxSalary) || 0,
  rankOrder: r.rankOrder,
});
const TYPE_FIELDS = (r: repository.TypeRow): EmploymentTypeInput => ({
  code: r.code,
  name: r.name,
  nameNepali: r.nameNepali ?? "",
  isPfEligible: r.isPfEligible,
  isSsfEligible: r.isSsfEligible,
  isFestivalEligible: r.isFestivalEligible,
  isLeaveEligible: r.isLeaveEligible,
  isOtEligible: r.isOtEligible,
  noticePeriodDays: r.noticePeriodDays,
  probationMonths: r.probationMonths,
  rankOrder: r.rankOrder,
});

function fail(errors: OrgErrors) {
  if (Object.keys(errors).length) throw new OrgValidationError(errors);
}

export async function saveMaster(kind: OrgKind, id: string | null, raw: unknown): Promise<OrgSaveResult> {
  const masters = await repository.findMasters();
  switch (kind) {
    case "branch": {
      const input = normalizeBranch(raw);
      const before = id ? masters.branchRows.find((r) => r.id === id) : undefined;
      if (id && !before) throw new UserFacingError(NOT_FOUND);
      fail(validateBranchInput(input, masters.branchRows, id));
      const row = await repository.saveBranch(id, input);
      return { id: row.id, name: row.name, changed: before ? changedOrgFields(BRANCH_FIELDS(before), BRANCH_FIELDS(row)) : [], moved: 0 };
    }
    case "department": {
      const input = normalizeDepartment(raw);
      const before = id ? masters.departmentRows.find((r) => r.id === id) : undefined;
      if (id && !before) throw new UserFacingError(NOT_FOUND);
      fail(validateDepartmentInput(input, masters.departmentRows, masters.branchRows.map((b) => b.id), id));
      if (input.headEmployeeId && !(await repository.employeeExists(input.headEmployeeId))) fail({ headEmployeeId: "That employee no longer exists" });
      const row = await repository.saveDepartment(id, input);
      return { id: row.id, name: row.name, changed: before ? changedOrgFields(DEPARTMENT_FIELDS(before), DEPARTMENT_FIELDS(row)) : [], moved: 0 };
    }
    case "designation": {
      const input = normalizeDesignation(raw);
      const before = id ? masters.designationRows.find((r) => r.id === id) : undefined;
      if (id && !before) throw new UserFacingError(NOT_FOUND);
      fail(validateDesignationInput(input, masters.designationRows, masters.departmentRows.map((d) => d.id), id));
      const row = await repository.saveDesignation(id, input);
      return { id: row.id, name: row.name, changed: before ? changedOrgFields(DESIGNATION_FIELDS(before), DESIGNATION_FIELDS(row)) : [], moved: 0 };
    }
    case "level": {
      const input = normalizeLevel(raw);
      const before = id ? masters.levelRows.find((r) => r.id === id) : undefined;
      if (id && !before) throw new UserFacingError(NOT_FOUND);
      fail(validateLevelInput(input, masters.levelRows, id));
      const { row, moved } = await repository.saveLevel(id, input, before ? levelRenames(before, input) : []);
      return { id: row.id, name: row.name, changed: before ? changedOrgFields(LEVEL_FIELDS(before), LEVEL_FIELDS(row)) : [], moved };
    }
    case "type": {
      const input = normalizeType(raw);
      const before = id ? masters.typeRows.find((r) => r.id === id) : undefined;
      if (id && !before) throw new UserFacingError(NOT_FOUND);
      fail(validateTypeInput(input, masters.typeRows, id));
      const { row, moved } = await repository.saveType(id, input, before ? typeRenames(before, input) : []);
      return { id: row.id, name: row.name, changed: before ? changedOrgFields(TYPE_FIELDS(before), TYPE_FIELDS(row)) : [], moved };
    }
  }
}

/** The record's name and current status, or null when it does not exist. */
async function findOne(kind: OrgKind, id: string): Promise<{ name: string; status: OrgStatus; usage: OrgUsage; isHeadOffice?: boolean } | null> {
  const [masters, usage] = await Promise.all([repository.findMasters(), repository.findUsage()]);
  const pick = <T extends { id: string; name: string; status: OrgStatus; usage: OrgUsage }>(list: T[]) => list.find((r) => r.id === id) ?? null;
  switch (kind) {
    case "branch":
      return pick(toBranches(masters, usage));
    case "department":
      return pick(toDepartments(masters, usage));
    case "designation":
      return pick(toDesignations(masters, usage));
    case "level":
      return pick(toLevels(masters, usage));
    case "type":
      return pick(toTypes(masters, usage));
  }
}

export async function setMasterStatus(kind: OrgKind, id: string, next: OrgStatus): Promise<{ name: string; previous: OrgStatus }> {
  const record = await findOne(kind, id);
  if (!record) throw new UserFacingError(NOT_FOUND);
  if (record.status === next) throw new UserFacingError(`It is already ${next}.`);
  if (kind === "branch" && next === "inactive" && record.isHeadOffice) {
    throw new UserFacingError("The head office cannot be made inactive. Make another branch the head office first.");
  }
  await repository.setStatus(kind, id, next);
  return { name: record.name, previous: record.status };
}

export async function deleteMaster(kind: OrgKind, id: string): Promise<{ name: string }> {
  const record = await findOne(kind, id);
  if (!record) throw new UserFacingError(NOT_FOUND);
  const refusal = deleteRefusal(kind, record.usage);
  if (refusal) throw new UserFacingError(refusal);
  if (kind === "branch" && record.isHeadOffice) throw new UserFacingError("The head office cannot be deleted.");
  await repository.deleteRecord(kind, id);
  return { name: record.name };
}

export async function loadLevelPreset(key: string): Promise<{ label: string; count: number }> {
  const preset = INDUSTRY_PRESET_TEMPLATES.find((t) => t.key === key);
  if (!preset) throw new UserFacingError("Choose one of the listed presets.");
  await seedShreniPreset(preset.key);
  return { label: preset.name, count: preset.levels.length };
}

// ---------------------------------------------------------------------------
// Input normalising (the server never trusts the shape the browser sends)
// ---------------------------------------------------------------------------

const str = (v: unknown, max = 600) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);
const bool = (v: unknown) => v === true;
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : NaN);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function normalizeBranch(raw: unknown): BranchInput {
  const o = obj(raw);
  return {
    code: str(o.code, 30),
    name: str(o.name, 200),
    location: str(o.location, 1000),
    phone: str(o.phone, 40),
    email: str(o.email, 255),
    isHeadOffice: bool(o.isHeadOffice),
    remoteCategory: str(o.remoteCategory, 20) || "NONE",
  };
}

export function normalizeDepartment(raw: unknown): DepartmentInput {
  const o = obj(raw);
  const ids = Array.isArray(o.branchIds) ? o.branchIds.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  return {
    code: str(o.code, 30),
    name: str(o.name, 200),
    branchIds: ids,
    headEmployeeId: typeof o.headEmployeeId === "string" && o.headEmployeeId ? o.headEmployeeId : null,
    description: str(o.description, 1000),
  };
}

export function normalizeDesignation(raw: unknown): DesignationInput {
  const o = obj(raw);
  return { name: str(o.name, 200), departmentId: str(o.departmentId, 64), description: str(o.description, 1000) };
}

export function normalizeLevel(raw: unknown): LevelInput {
  const o = obj(raw);
  return {
    code: str(o.code, 30),
    name: str(o.name, 200),
    levelNumber: int(o.levelNumber),
    labelNepali: str(o.labelNepali, 200),
    description: str(o.description, 1000),
    minSalary: num(o.minSalary),
    maxSalary: num(o.maxSalary),
    rankOrder: Number.isFinite(int(o.rankOrder)) ? int(o.rankOrder) : 0,
  };
}

export function normalizeType(raw: unknown): EmploymentTypeInput {
  const o = obj(raw);
  return {
    code: str(o.code, 30),
    name: str(o.name, 100),
    nameNepali: str(o.nameNepali, 200),
    isPfEligible: bool(o.isPfEligible),
    isSsfEligible: bool(o.isSsfEligible),
    isFestivalEligible: bool(o.isFestivalEligible),
    isLeaveEligible: bool(o.isLeaveEligible),
    isOtEligible: bool(o.isOtEligible),
    noticePeriodDays: int(o.noticePeriodDays),
    probationMonths: int(o.probationMonths),
    rankOrder: Number.isFinite(int(o.rankOrder)) ? int(o.rankOrder) : 0,
  };
}

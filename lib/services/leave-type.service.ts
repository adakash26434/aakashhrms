import { randomUUID } from "node:crypto";
import * as repository from "@/lib/repositories/leave.repository";
import * as policyRepo from "@/lib/repositories/leave-policy.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as engine from "@/lib/engines/leave-type.engine";
import { balanceOn, fmt, thisYearChange, typeAppliesTo, yearShare } from "@/lib/engines/leave.engine";
import { deduplicateStatutoryLeaves } from "@/lib/services/leave-cleanup.service";
import { leaveYearOf, postingYear, rolledYears } from "@/lib/services/leave.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { NewLedgerLine } from "@/lib/repositories/leave.repository";
import type {
  CompanyTypeChange,
  LeaveTypeRecord,
  LeaveTypeFormData,
  LeaveTypeKPIs,
  LeaveTypeSaveOptions,
  LeaveTypeValidationErrors,
  ThisYearPreview,
} from "@/lib/types/leave-type";

const STATUTORY_LOCKED = "Statutory leave follows the Labour Act and can't be changed here. Choose it under Statutory leave on this tab and Propose a change: only in the employees' favour, approved by a second person.";
const CHANGED_SINCE = "Someone else saved this leave type after you opened it. Close the window, refresh and make your change again.";

export class LeaveTypeValidationError extends Error {
  constructor(public errors: LeaveTypeValidationErrors) {
    super("Leave type validation failed");
    this.name = "LeaveTypeValidationError";
  }
}

/** Who saves: company types are company-wide settings (S24, 4.6e). */
export interface LeaveTypeCtx {
  userId: string;
  companyWide: boolean;
}

const assertCompanyWide = (ctx: LeaveTypeCtx) => {
  if (!ctx.companyWide) throw new UserFacingError("Company leave types apply to everyone, so changing them needs a company-wide role with Leave types → Edit.");
};

export async function getLeaveTypesWithKPIs(): Promise<{
  types: LeaveTypeRecord[];
  kpis: LeaveTypeKPIs;
}> {
  await deduplicateStatutoryLeaves();
  const types = await repository.findAllLeaveTypesIncludingInactive();
  const kpis = engine.calculateLeaveTypeKPIs(types);
  return { types, kpis };
}

/** Company leave types for the Policies screen: the types, each one's history, and the lists the window chooses from. */
export async function companyTypesData(): Promise<{
  types: LeaveTypeRecord[];
  history: Record<string, CompanyTypeChange[]>;
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
}> {
  const { types } = await getLeaveTypesWithKPIs();
  const company = types.filter((t) => !t.isStatutory);
  const [rows, departments, designations] = await Promise.all([
    policyRepo.findCompanyTypeChanges(company.map((t) => t.id)),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
  ]);
  const history: Record<string, CompanyTypeChange[]> = {};
  for (const r of rows) {
    const c = r.change;
    const lines = Object.keys(c.before).length ? engine.leaveTypeChangeLines(c.before as Partial<LeaveTypeFormData>, c.after as Partial<LeaveTypeFormData>) : ["Added"];
    (history[c.leaveTypeId] ??= []).push({ id: c.id, at: c.preparedAt.toISOString(), by: r.name || r.email || "Unknown user", lines, note: c.reason });
  }
  return {
    types,
    history,
    departments: departments.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)),
    designations: designations.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function getActiveLeaveTypes(): Promise<LeaveTypeRecord[]> {
  return repository.findAllLeaveTypes();
}

export async function getLeaveTypeById(id: string): Promise<LeaveTypeRecord | null> {
  return repository.findLeaveTypeById(id);
}

/** The form checked the way it will be saved (departments and designations that no longer exist are dropped). */
async function checkedForm(id: string | null, raw: unknown): Promise<LeaveTypeFormData> {
  const form = engine.normalizeLeaveTypeForm((raw && typeof raw === "object" ? raw : {}) as Partial<LeaveTypeFormData>);
  const [all, departments, designations] = await Promise.all([repository.findAllLeaveTypes(), departmentRepository.findAllDepartments(), designationRepository.findAllDesignations()]);
  const dep = new Set(departments.map((d) => d.id));
  const des = new Set(designations.map((d) => d.id));
  form.applicableDepartments = form.applicableDepartments.filter((x) => dep.has(x));
  form.applicableDesignations = form.applicableDesignations.filter((x) => des.has(x));
  const errors = engine.validateLeaveTypeForm(form);
  if (!errors.code && all.some((t) => t.id !== id && t.code === form.code)) errors.code = "Another leave type has this code";
  if (!errors.name && all.some((t) => t.id !== id && t.name.trim().toLowerCase() === form.name.toLowerCase())) errors.name = "Another leave type has this name";
  if (Object.keys(errors).length) throw new LeaveTypeValidationError(errors);
  return form;
}

/** "Also this year" applies to balance types given at the start of the year whose days are new or changed. */
const thisYearApplies = (form: LeaveTypeFormData, before: LeaveTypeFormData | null) =>
  form.kind === "balance" && form.creditMode === "yearly" && form.isActive && (!before || before.kind !== "balance" || before.creditMode !== "yearly" || before.noOfDays !== form.noOfDays);

/**
 * The ledger lines that bring this leave year's credit to the new figure for
 * everyone the type is for (4.6e "also this year"), ref policy:<change>.
 */
async function thisYearLines(form: LeaveTypeFormData, typeId: string | null, before: LeaveTypeFormData | null, changeId: string, userId: string | null, today: string): Promise<{ lines: NewLedgerLine[]; preview: ThisYearPreview | null }> {
  const year = await leaveYearOf(today);
  if (!year || (await rolledYears()).has(year.id)) return { lines: [], preview: null };
  const fiscalYearId = await postingYear(year.id);
  const asType = { isStatutory: false, proRataForJoiners: form.proRataForNewJoinees, genderApplicable: form.genderApplicable, applicableDepartments: form.applicableDepartments, applicableDesignations: form.applicableDesignations };
  const people = (await attendanceRepo.findEmployees()).filter((p) => p.joiningDate <= year.end && (!p.terminationDate || p.terminationDate >= today) && typeAppliesTo(asType, p));
  const ledger = typeId ? (await repository.findLedger(people.map((p) => p.id), fiscalYearId)).filter((l) => l.leaveTypeId === typeId) : [];
  const oldDays = before && before.kind === "balance" && before.creditMode === "yearly" ? before.noOfDays : 0;
  const lines: NewLedgerLine[] = [];
  const examples: { name: string; days: number }[] = [];
  let added = 0;
  let taken = 0;
  for (const p of people) {
    const mine = ledger.filter((l) => l.employeeId === p.id);
    const credited = mine.filter((l) => l.kind === "credit").reduce((n, l) => n + l.days, 0);
    const days = thisYearChange({
      target: yearShare(asType, form.noOfDays, p.joiningDate, year),
      credited: Math.round(credited * 100) / 100,
      hasStart: mine.some((l) => l.kind === "opening"),
      balance: balanceOn(mine, today).available,
    });
    if (days === 0) continue;
    lines.push({
      employeeId: p.id,
      leaveTypeId: typeId ?? "",
      fiscalYearId,
      entryDate: today,
      kind: "credit",
      days,
      note: before ? `${form.name}: ${fmt(oldDays)} → ${fmt(form.noOfDays)} days a year, this year too` : `${form.name}: this year's days`,
      ref: `policy:${changeId}`,
      createdBy: userId,
    });
    if (days > 0) added += days;
    else taken -= days;
    if (examples.length < 3) examples.push({ name: p.fullName, days });
  }
  return { lines, preview: { yearLabel: year.label, people: lines.length, added: Math.round(added * 100) / 100, taken: Math.round(taken * 100) / 100, examples } };
}

/** What "also this year" would do for the form as it is now (nothing is saved). */
export async function previewThisYear(id: string | null, raw: unknown, ctx: LeaveTypeCtx): Promise<ThisYearPreview | null> {
  assertCompanyWide(ctx);
  const form = engine.normalizeLeaveTypeForm((raw && typeof raw === "object" ? raw : {}) as Partial<LeaveTypeFormData>);
  const existing = id ? await repository.findLeaveTypeById(id) : null;
  if (id && (!existing || existing.isStatutory)) throw new UserFacingError("This leave type no longer exists. Refresh the page.");
  const before = existing ? engine.formOfRecord(existing) : null;
  if (!thisYearApplies(form, before) || !(form.noOfDays > 0)) return null;
  return (await thisYearLines(form, id, before, "preview", null, nepalDateIso())).preview;
}

/**
 * Adds or changes a company leave type. It applies when saved (the law sets
 * no minimum); every save is a version in the type's history. "Also this
 * year" brings this year's credit to the new days a year.
 */
export async function saveLeaveType(id: string | null, raw: unknown, options: LeaveTypeSaveOptions & { version?: string }, ctx: LeaveTypeCtx): Promise<LeaveTypeRecord> {
  assertCompanyWide(ctx);
  const existing = id ? await repository.findLeaveTypeById(id) : null;
  if (id && !existing) throw new UserFacingError("This leave type no longer exists. Refresh the page.");
  // Statutory types follow the Labour Act: they change only through a proposal a
  // second person approves (leave-policy.service), never below the law (S24).
  if (existing?.isStatutory) throw new UserFacingError(STATUTORY_LOCKED);
  if (existing && options.version && existing.updatedAt.toISOString() !== options.version) throw new UserFacingError(CHANGED_SINCE);
  const form = await checkedForm(id, raw);
  const before = existing ? engine.formOfRecord(existing) : null;
  if (existing && before!.kind !== form.kind && (await repository.leaveTypeInUse(existing.id))) {
    throw new LeaveTypeValidationError({ kind: `${existing.name} has been used, so how its days are given can't change. Add a new type and switch this one off.` });
  }
  const diff = before ? engine.changedFields(before, form) : { before: {}, after: form };
  const today = nepalDateIso();
  const changeId = randomUUID();
  const ledger = options.thisYear && thisYearApplies(form, before) ? (await thisYearLines(form, id, before, changeId, ctx.userId, today)).lines : [];
  if (existing && !Object.keys(diff.after).length && !ledger.length) return existing;
  const note = String(options.note ?? "").trim().slice(0, 300) || (existing ? "Changed" : "Added");
  const saved = await policyRepo.saveCompanyType({
    id,
    changeId,
    form,
    before: diff.before as Record<string, unknown>,
    after: diff.after as Record<string, unknown>,
    note,
    userId: ctx.userId,
    today,
    readAt: existing?.updatedAt,
    ledger,
  });
  if (!saved) throw new UserFacingError(CHANGED_SINCE);
  const record = await repository.findLeaveTypeById(saved.id);
  if (!record) throw new UserFacingError("This leave type no longer exists. Refresh the page.");
  return record;
}

export async function deleteLeaveType(id: string, ctx: LeaveTypeCtx): Promise<boolean> {
  assertCompanyWide(ctx);
  const existing = await repository.findLeaveTypeById(id);
  if (!existing) throw new UserFacingError("This leave type no longer exists.");
  if (existing.isStatutory) throw new UserFacingError("Statutory leave follows the Labour Act and can't be deleted.");
  // Requests and the leave ledger keep their history: a used type is switched off instead.
  if (await repository.leaveTypeInUse(id)) throw new UserFacingError(`${existing.name} has been used in requests or balances, so it can't be deleted. Switch it off instead.`);
  return policyRepo.deleteUnusedCompanyType(id);
}

/** Switches a company type off (not offered for new requests; balances and history stay) or on again, as a version in its history. */
export async function toggleLeaveTypeStatus(id: string, isActive: boolean, ctx: LeaveTypeCtx): Promise<LeaveTypeRecord> {
  assertCompanyWide(ctx);
  const existing = await repository.findLeaveTypeById(id);
  if (!existing) throw new UserFacingError("This leave type no longer exists. Refresh the page.");
  if (existing.isStatutory) throw new UserFacingError(STATUTORY_LOCKED);
  if (existing.isActive === isActive) return existing;
  const saved = await policyRepo.saveCompanyType({
    id,
    changeId: randomUUID(),
    form: { ...engine.formOfRecord(existing), isActive },
    before: { isActive: existing.isActive },
    after: { isActive },
    note: isActive ? "Switched on" : "Switched off",
    userId: ctx.userId,
    today: nepalDateIso(),
    readAt: existing.updatedAt,
  });
  if (!saved) throw new UserFacingError(CHANGED_SINCE);
  return (await repository.findLeaveTypeById(id)) ?? existing;
}

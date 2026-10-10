import * as repository from "@/lib/repositories/pay-head.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import { labelAmounts } from "@/lib/services/salary-structure.service";
import {
  appliesToLabel,
  appliesToNames,
  cannotDeletePayHead,
  describeCalc,
  formOf,
  nextPayHeadCode,
  normalizePayHeadForm,
  payHeadFormIsValid,
  payHeadWrite,
  roleDef,
  roleOf,
  sameChoices,
  systemReason,
  validatePayHeadForm,
  type PayHeadWrite,
} from "@/lib/engines/pay-head.engine";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type { PayHead, PayHeadFormErrors, PayHeadsPage } from "@/lib/types/pay-head";

// Pay heads (4.12b, S51): a company-wide list — Pay heads → Add / Edit / Delete with a
// company-wide role (checkCompanyControl in the actions). What a head is sets its type and the
// statutory flag payroll reads (lib/engines/pay-head.engine.ts); system heads keep their role and
// sums. Reads never write. Codes are given once ("PH-001", next free). Every change is audited.

export class PayHeadValidationError extends UserFacingError {
  constructor(public errors: PayHeadFormErrors) {
    super("Check the highlighted fields.");
    this.name = "PayHeadValidationError";
  }
}

export interface PayHeadCtx {
  userId: string;
}

/**
 * The register. `salaryScope` is the reader's Salary structure → View scope (null without it): who
 * still holds an amount on a label head, and how much, is salary data (S20), so only those readers
 * see names and amounts, within their scope; everyone sees the company's count (4.12e).
 */
export async function payHeadsPage(can: PayHeadsPage["can"], salaryScope: ScopeFilter | null): Promise<PayHeadsPage> {
  const [heads, usage, departments, designations, labelled, labelledInScope] = await Promise.all([
    repository.findAllPayHeads(),
    repository.usageByHead(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    labelAmounts(null),
    salaryScope && salaryScope.scopeType !== "GLOBAL" ? labelAmounts(salaryScope) : Promise.resolve(null),
  ]);
  const none = { structures: 0, payslips: 0, templates: 0 };
  const live = { departmentIds: new Set(departments.map((d) => d.id)), designationIds: new Set(designations.map((d) => d.id)) };
  const rows = heads.map((h) => {
    const use = usage.get(h.id) ?? none;
    const role = roleOf(h);
    return {
      id: h.id,
      code: h.code,
      name: h.name,
      nameNp: h.nameNp ?? null,
      type: h.type,
      role,
      roleLabel: roleDef(role).label,
      calc: describeCalc(h),
      taxable: h.effectOnTax,
      appliesTo: appliesToLabel(h, live),
      usage: use,
      system: systemReason(h),
      cannotDelete: cannotDeletePayHead(h, use),
      form: formOf(h),
    };
  });
  // Allowances first, then deductions; system heads after the company's own; by name.
  rows.sort((a, b) => (a.type !== b.type ? (a.type === "allowance" ? -1 : 1) : !!a.system !== !!b.system ? (a.system ? 1 : -1) : a.name.localeCompare(b.name)));
  const count = new Set(labelled.map((l) => l.employeeId)).size;
  return {
    heads: rows,
    labelAmounts: { count, people: salaryScope ? labelledInScope ?? labelled : null },
    departments: departments.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)),
    designations: designations.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)),
    can,
  };
}

const isViolation = (e: unknown, code: string) => !!e && typeof e === "object" && ((e as { code?: string }).code === code || (e as { cause?: { code?: string } }).cause?.code === code);

type Names = Parameters<typeof appliesToNames>[1];

type Named = { id: string; name: string }[];
const namesOf = (departments: Named, designations: Named): Names => ({
  departments: new Map(departments.map((d) => [d.id, d.name])),
  designations: new Map(designations.map((d) => [d.id, d.name])),
});

/** The departments' and designations' names, for the audit line. */
async function orgNames(): Promise<Names> {
  const [departments, designations] = await Promise.all([departmentRepository.findAllDepartments(), designationRepository.findAllDesignations()]);
  return namesOf(departments, designations);
}

/** What the audit line keeps of a head: what it is, how much, taxable, and who it is for by name. */
const audited = (
  h: Pick<PayHead, "code" | "type" | "calcBasis" | "calcParameter" | "calcPercent" | "flags" | "applicableDepartmentIds" | "applicableDesignationIds"> & { name: string; nameNp?: string | null; effectOnTax: boolean },
  names: Names
) => ({
  name: h.name,
  nameNp: h.nameNp ?? null,
  role: roleDef(roleOf(h)).label,
  amount: describeCalc(h),
  taxable: h.effectOnTax,
  appliesTo: appliesToNames(h, names),
});

/** Adds a head (id null) or saves one; a system head only takes new names. */
export async function savePayHead(id: string | null, raw: unknown, ctx: PayHeadCtx): Promise<PayHead> {
  const [heads, departments, designations] = await Promise.all([repository.findAllPayHeads(), departmentRepository.findAllDepartments(), designationRepository.findAllDesignations()]);
  const names = namesOf(departments, designations);
  const current = id ? heads.find((h) => h.id === id) ?? null : null;
  if (id && !current) throw new UserFacingError("That pay head no longer exists.");
  const form = normalizePayHeadForm(raw);
  const errors = validatePayHeadForm(form, {
    otherNames: heads.filter((h) => h.id !== id).map((h) => h.name),
    current,
    departmentIds: departments.map((d) => d.id),
    designationIds: designations.map((d) => d.id),
  });
  if (!payHeadFormIsValid(errors)) throw new PayHeadValidationError(errors);
  const write: PayHeadWrite = payHeadWrite(form, current);

  if (!current) {
    let codes = heads.map((h) => h.code);
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await repository.insertPayHead(nextPayHeadCode(codes), write);
        await recordAuditLog({ userId: ctx.userId, action: "ADD", module: "PAY_HEADS", recordId: `${created.name} (${created.code})`, newValues: audited(created, names) });
        return created;
      } catch (error) {
        // Someone took the code meanwhile: the next one.
        if (attempt < 2 && isViolation(error, "23505")) {
          codes = (await repository.findAllPayHeads()).map((h) => h.code);
          continue;
        }
        if (isViolation(error, "23505")) throw new UserFacingError("Another pay head was added at the same moment. Try again.");
        throw error;
      }
    }
  }

  const before = audited(current, names);
  const after = audited({ ...current, ...write, flags: write.flags }, names);
  // Who it is for is compared by id: two departments may share a name.
  const changed = (Object.keys(after) as (keyof typeof after)[]).filter((k) => (k === "appliesTo" ? !sameChoices(current, write) : JSON.stringify(after[k]) !== JSON.stringify(before[k])));
  if (!changed.length) throw new UserFacingError("Nothing changed.");
  const saved = await repository.updatePayHead(current.id, write);
  if (!saved) throw new UserFacingError("That pay head no longer exists.");
  await recordAuditLog({
    userId: ctx.userId,
    action: "EDIT",
    module: "PAY_HEADS",
    recordId: `${saved.name} (${saved.code})`,
    oldValues: Object.fromEntries(changed.map((k) => [k, before[k]])),
    newValues: Object.fromEntries(changed.map((k) => [k, after[k]])),
  });
  return saved;
}

/** Deletes a head nothing uses; system heads stay. */
export async function deletePayHead(id: string, ctx: PayHeadCtx): Promise<void> {
  const [head, usage, names] = await Promise.all([repository.findPayHeadById(id), repository.usageByHead(), orgNames()]);
  if (!head) throw new UserFacingError("That pay head no longer exists.");
  const blocked = cannotDeletePayHead(head, usage.get(id) ?? { structures: 0, payslips: 0, templates: 0 });
  if (blocked) throw new UserFacingError(blocked);
  try {
    if (!(await repository.deletePayHead(id))) throw new UserFacingError("That pay head no longer exists.");
  } catch (error) {
    // Put on a salary structure or payslip since it was checked.
    if (isViolation(error, "23503")) throw new UserFacingError(`${head.name} is in use now, so it stays.`);
    throw error;
  }
  await recordAuditLog({ userId: ctx.userId, action: "DELETE", module: "PAY_HEADS", recordId: `${head.name} (${head.code})`, oldValues: audited(head, names) });
}

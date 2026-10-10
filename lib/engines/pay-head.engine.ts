/**
 * Pay heads (4.12b) — pure logic for the Pay heads screen and the service.
 *
 * A head is described by what it is (its role: an allowance, a deduction,
 * the festival or remote-area allowance, a line worked out from attendance,
 * or a statutory head) and how its amount is worked out. The role sets the
 * type and the statutory flags payroll reads, so a head can never be an
 * allowance flagged as a deduction. System heads — the statutory ones and
 * the lines other modules feed into a pay run — keep their role, sum and
 * tax treatment: only their names change. Tests: tests/pay-head.engine.test.ts.
 */

import { FEED_SOURCE, isFeedHeadCode } from "@/lib/constants/payroll-feeds";
import type { CalcBasis, CalcParameter, PayHead, PayHeadCalc, PayHeadForm, PayHeadFormErrors, PayHeadRole, PayHeadType, StatutoryFlag } from "@/lib/types/pay-head";
import { STATUTORY_FLAGS } from "@/lib/types/pay-head";

export interface RoleDef {
  value: PayHeadRole;
  label: string;
  type: PayHeadType;
  /** The statutory flag that marks it (none for an ordinary allowance or deduction). */
  flag: StatutoryFlag | null;
  hint: string;
  /** Offered for a new head (statutory heads exist once, from setup). */
  creatable: boolean;
  /** How its amount can be worked out (empty: payroll works it out). */
  calcs: PayHeadCalc[];
}

export const PAY_HEAD_ROLES: RoleDef[] = [
  { value: "allowance", label: "Allowance", type: "allowance", flag: null, hint: "Paid every month: an amount typed for each employee, or a share of their pay", creatable: true, calcs: ["typed", "basic", "basicPlusGrade"] },
  { value: "deduction", label: "Deduction", type: "deduction", flag: null, hint: "Taken every month: an amount typed for each employee, or a share of their pay", creatable: true, calcs: ["typed", "basic", "basicPlusGrade"] },
  { value: "festival", label: "Festival allowance", type: "allowance", flag: "isFestivalAllowance", hint: "Paid once a year: in the festival month, or by a festival run (which can share it out by the months served)", creatable: true, calcs: ["basic", "basicPlusGrade", "typed"] },
  { value: "remote", label: "Remote area allowance", type: "allowance", flag: "isRemoteAllowance", hint: "Paid for the remote-area months, never more than the Rules & controls limit", creatable: true, calcs: ["typed", "basic", "basicPlusGrade"] },
  { value: "overtime", label: "Overtime pay", type: "allowance", flag: "isOtHead", hint: "Worked out from attendance and the overtime rules", creatable: true, calcs: [] },
  { value: "absence", label: "Absence deduction", type: "deduction", flag: "isAbsentDeduct", hint: "Worked out from attendance: unpaid days", creatable: true, calcs: [] },
  { value: "leave", label: "Leave pay (attendance)", type: "allowance", flag: "isLeaveHead", hint: "Worked out from attendance and leave", creatable: true, calcs: [] },
  { value: "tds", label: "Income tax (TDS)", type: "deduction", flag: "isTdsHead", hint: "Worked out by payroll from the tax slabs", creatable: false, calcs: [] },
  { value: "pf", label: "Provident fund (PF)", type: "deduction", flag: "isPfHead", hint: "Worked out by payroll", creatable: false, calcs: [] },
  { value: "ssf", label: "SSF contribution", type: "deduction", flag: "isSsfHead", hint: "11% employee + 20% employer, worked out by payroll", creatable: false, calcs: [] },
  { value: "ssfEmployer", label: "SSF employer share", type: "allowance", flag: "isSsfEmployerHead", hint: "The employer's 20%, shown on the payslip", creatable: false, calcs: [] },
  { value: "cit", label: "CIT contribution", type: "deduction", flag: "isCitHead", hint: "A monthly amount typed for each employee, counted against tax", creatable: false, calcs: ["typed"] },
];

const ROLE = new Map(PAY_HEAD_ROLES.map((r) => [r.value, r]));
export const roleDef = (role: PayHeadRole): RoleDef => ROLE.get(role) ?? PAY_HEAD_ROLES[0];

/** What a stored head is, from its flags and type (the first flag wins on old data with several). */
export function roleOf(head: Pick<PayHead, "type" | "flags">): PayHeadRole {
  for (const r of PAY_HEAD_ROLES) if (r.flag && head.flags[r.flag]) return r.value;
  return head.type === "deduction" ? "deduction" : "allowance";
}

/** The flags a role sets: its own, every other one off. */
export function flagsOfRole(role: PayHeadRole): Record<StatutoryFlag, boolean> {
  const flag = roleDef(role).flag;
  return Object.fromEntries(STATUTORY_FLAGS.map((f) => [f, f === flag])) as Record<StatutoryFlag, boolean>;
}

/** How a stored head's amount is worked out. */
export function calcOf(head: Pick<PayHead, "calcBasis" | "calcParameter" | "calcPercent" | "flags">): PayHeadCalc {
  if (head.flags.isFestivalAllowance) return head.calcBasis === "BasicSalary" ? "basic" : head.calcBasis === "BasicPlusGrade" ? "basicPlusGrade" : "typed";
  if (head.calcParameter === "FixedAmount" || head.calcBasis === "None" || !(head.calcPercent > 0)) return "typed";
  return head.calcBasis === "BasicPlusGrade" ? "basicPlusGrade" : head.calcBasis === "BasicSalary" ? "basic" : "typed";
}

/** The choice's words for a role ("One month's basic" for the festival allowance, "A share of basic" otherwise). */
export function calcLabel(role: PayHeadRole, calc: PayHeadCalc): string {
  if (role === "festival") return calc === "basic" ? "One month's basic salary" : calc === "basicPlusGrade" ? "One month's basic + grade" : "An amount typed for each employee";
  return calc === "basic" ? "A share of basic salary" : calc === "basicPlusGrade" ? "A share of basic + grade" : "An amount typed for each employee";
}

/** Whether the choice needs a percentage. */
export const calcNeedsPercent = (role: PayHeadRole, calc: PayHeadCalc) => role !== "festival" && calc !== "typed";

/** How the amount is worked out, in a few words, for the register. */
export function describeCalc(head: Pick<PayHead, "code" | "type" | "calcBasis" | "calcParameter" | "calcPercent" | "flags">): string {
  if (isFeedHeadCode(head.code)) return "From other records";
  const role = roleOf(head);
  const def = roleDef(role);
  if (!def.calcs.length) return def.hint.split(":")[0];
  if (role === "cit") return "Typed for each employee";
  const calc = calcOf(head);
  if (role === "festival") return calc === "typed" ? "Typed, festival month" : `One month's ${calc === "basic" ? "basic" : "basic + grade"}`;
  if (calc === "typed") return "Typed for each employee";
  return `${head.calcPercent}% of ${calc === "basic" ? "basic" : "basic + grade"}`;
}

/** Why a head keeps its role and sums (null: an ordinary head the company set up). */
export function systemReason(head: Pick<PayHead, "code" | "flags">): string | null {
  if (isFeedHeadCode(head.code)) return `Paid from ${FEED_SOURCE[head.code] ?? "other records"}.`;
  if (head.flags.isTdsHead || head.flags.isPfHead || head.flags.isSsfHead || head.flags.isSsfEmployerHead || head.flags.isCitHead) return "A statutory head: payroll works it out.";
  return null;
}

/**
 * The register's line for who a head is for. With `live` (the departments and
 * designations that exist) deleted ones are not counted, and a list left with
 * none of its choices reaches no one (an empty list is everyone).
 */
export function appliesToLabel(
  head: Pick<PayHead, "applicableDepartmentIds" | "applicableDesignationIds">,
  live?: { departmentIds: ReadonlySet<string>; designationIds: ReadonlySet<string> }
): string {
  const depts = head.applicableDepartmentIds;
  const desigs = head.applicableDesignationIds;
  if (!depts.length && !desigs.length) return "Everyone";
  const d = live ? depts.filter((id) => live.departmentIds.has(id)).length : depts.length;
  const g = live ? desigs.filter((id) => live.designationIds.has(id)).length : desigs.length;
  if (depts.length && !d) return "No one: its departments were deleted";
  if (desigs.length && !g) return "No one: its designations were deleted";
  return [d ? `${d} department${d === 1 ? "" : "s"}` : "", g ? `${g} designation${g === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
}

/** Who a head is for, by name (the audit line): "Everyone", or its departments and designations. */
export function appliesToNames(
  head: Pick<PayHead, "applicableDepartmentIds" | "applicableDesignationIds">,
  names: { departments: ReadonlyMap<string, string>; designations: ReadonlyMap<string, string> }
): string {
  const list = (ids: readonly string[], of: ReadonlyMap<string, string>, gone: string) =>
    ids
      .map((id) => of.get(id) ?? gone)
      .sort((a, b) => a.localeCompare(b))
      .join(", ");
  const { applicableDepartmentIds: depts, applicableDesignationIds: desigs } = head;
  if (!depts.length && !desigs.length) return "Everyone";
  return [
    depts.length ? `Departments: ${list(depts, names.departments, "a deleted department")}` : "",
    desigs.length ? `Designations: ${list(desigs, names.designations, "a deleted designation")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Whether two heads are for the same departments and designations (order aside). */
export function sameChoices(
  a: Pick<PayHead, "applicableDepartmentIds" | "applicableDesignationIds">,
  b: Pick<PayHead, "applicableDepartmentIds" | "applicableDesignationIds">
): boolean {
  const same = (x: readonly string[], y: readonly string[]) => x.length === y.length && [...x].sort().join("\n") === [...y].sort().join("\n");
  return same(a.applicableDepartmentIds, b.applicableDepartmentIds) && same(a.applicableDesignationIds, b.applicableDesignationIds);
}

/** The form for an existing head. */
export function formOf(head: PayHead): PayHeadForm {
  const role = roleOf(head);
  const calc = calcOf(head);
  return {
    name: head.name,
    nameNp: head.nameNp ?? "",
    role,
    calc,
    percent: calcNeedsPercent(role, calc) ? head.calcPercent : 0,
    taxable: head.effectOnTax,
    departmentIds: [...head.applicableDepartmentIds],
    designationIds: [...head.applicableDesignationIds],
  };
}

export const NEW_PAY_HEAD: PayHeadForm = { name: "", nameNp: "", role: "allowance", calc: "typed", percent: 0, taxable: true, departmentIds: [], designationIds: [] };

const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))].slice(0, 500) : []);

/** The form from the browser: known roles and choices only. */
export function normalizePayHeadForm(raw: unknown): PayHeadForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const role = ROLE.has(r.role as PayHeadRole) ? (r.role as PayHeadRole) : ("" as PayHeadRole);
  const calc = r.calc === "basic" || r.calc === "basicPlusGrade" || r.calc === "typed" ? r.calc : ("" as PayHeadCalc);
  const percent = typeof r.percent === "number" ? r.percent : typeof r.percent === "string" && r.percent.trim() ? Number(r.percent) : 0;
  return {
    name: typeof r.name === "string" ? r.name.trim().replace(/\s+/g, " ") : "",
    nameNp: typeof r.nameNp === "string" ? r.nameNp.trim().replace(/\s+/g, " ") : "",
    role,
    calc,
    percent,
    taxable: r.taxable === true,
    departmentIds: ids(r.departmentIds),
    designationIds: ids(r.designationIds),
  };
}

export const NAME_MAX = 60;

/** The checks the form can make on its own: names, the amount choice and its percentage. */
export function validatePayHeadFields(f: PayHeadForm, otherNames: readonly string[]): PayHeadFormErrors {
  const e: PayHeadFormErrors = {};
  if (!f.name) e.name = "Give the pay head a name.";
  else if (f.name.length > NAME_MAX) e.name = `At most ${NAME_MAX} characters.`;
  else if (otherNames.some((n) => n.trim().toLowerCase() === f.name.toLowerCase())) e.name = "Another pay head has this name.";
  if (f.nameNp.length > NAME_MAX) e.nameNp = `At most ${NAME_MAX} characters.`;
  const def = ROLE.get(f.role);
  if (!def) e.role = "Choose what the pay head is.";
  else if (def.calcs.length && !def.calcs.includes(f.calc)) e.calc = "Choose how the amount is worked out.";
  else if (def.calcs.length && calcNeedsPercent(f.role, f.calc)) {
    if (!Number.isFinite(f.percent) || f.percent <= 0 || f.percent > 100) e.percent = "A percentage above 0, at most 100.";
    else if ((String(f.percent).split(".")[1] ?? "").length > 2) e.percent = "At most two decimals.";
  }
  return e;
}

/**
 * Checks a head. A new head takes a role a company may add; a system head
 * keeps its role, sum, tax treatment and who it is for (only names change).
 */
export function validatePayHeadForm(
  f: PayHeadForm,
  ctx: { otherNames: readonly string[]; current: PayHead | null; departmentIds: readonly string[]; designationIds: readonly string[] }
): PayHeadFormErrors {
  const system = ctx.current ? systemReason(ctx.current) : null;
  if (system) {
    const e = validatePayHeadFields({ ...formOf(ctx.current!), name: f.name, nameNp: f.nameNp }, ctx.otherNames);
    const was = formOf(ctx.current!);
    const same = f.role === was.role && f.calc === was.calc && Math.abs(f.percent - was.percent) < 1e-9 && f.taxable === was.taxable && f.departmentIds.join() === was.departmentIds.join() && f.designationIds.join() === was.designationIds.join();
    if (!same) e.role = `${system} Only its names can change.`;
    return e;
  }
  const e = validatePayHeadFields(f, ctx.otherNames);
  const def = ROLE.get(f.role);
  if (def && !def.creatable && (!ctx.current || roleOf(ctx.current) !== f.role)) e.role = `${def.label} is a statutory head: the company has one, set up with payroll.`;
  // A deleted department (designation) already on the head may stay until it is unticked; a new choice must exist.
  const onHead = { d: ctx.current?.applicableDepartmentIds ?? [], g: ctx.current?.applicableDesignationIds ?? [] };
  if (f.departmentIds.some((id) => !ctx.departmentIds.includes(id) && !onHead.d.includes(id))) e.departmentIds = "A chosen department no longer exists.";
  if (f.designationIds.some((id) => !ctx.designationIds.includes(id) && !onHead.g.includes(id))) e.designationIds = "A chosen designation no longer exists.";
  return e;
}

export const payHeadFormIsValid = (e: PayHeadFormErrors) => Object.keys(e).length === 0;

export interface PayHeadWrite {
  name: string;
  nameNp: string | null;
  type: PayHeadType;
  effectOnTax: boolean;
  calcBasis: CalcBasis;
  calcParameter: CalcParameter;
  calcPercent: number;
  applicableDepartmentIds: string[];
  applicableDesignationIds: string[];
  flags: Record<StatutoryFlag, boolean>;
}

/**
 * What is stored for a checked form. A system head writes back its stored
 * role and sums with the new names; a deduction keeps its tax flag as it was
 * (payroll counts only taxable allowances).
 */
export function payHeadWrite(f: PayHeadForm, current: PayHead | null): PayHeadWrite {
  const names = { name: f.name, nameNp: f.nameNp || null };
  if (current && systemReason(current)) {
    return {
      ...names,
      type: current.type,
      effectOnTax: current.effectOnTax,
      calcBasis: current.calcBasis,
      calcParameter: current.calcParameter,
      calcPercent: current.calcPercent,
      applicableDepartmentIds: current.applicableDepartmentIds,
      applicableDesignationIds: current.applicableDesignationIds,
      flags: Object.fromEntries(STATUTORY_FLAGS.map((x) => [x, current.flags[x] === true])) as Record<StatutoryFlag, boolean>,
    };
  }
  const def = roleDef(f.role);
  const calc: PayHeadCalc = def.calcs.length ? f.calc : "typed";
  const basis: CalcBasis = calc === "basic" ? "BasicSalary" : calc === "basicPlusGrade" ? "BasicPlusGrade" : "None";
  const percent = calcNeedsPercent(f.role, calc) ? Math.round(f.percent * 100) / 100 : 0;
  return {
    ...names,
    type: def.type,
    effectOnTax: def.type === "allowance" ? f.taxable : current?.effectOnTax ?? false,
    calcBasis: basis,
    calcParameter: basis === "None" ? "FixedAmount" : basis,
    calcPercent: percent,
    applicableDepartmentIds: [...f.departmentIds].sort(),
    applicableDesignationIds: [...f.designationIds].sort(),
    flags: flagsOfRole(f.role),
  };
}

/** Why a head can't be deleted (null: it can). */
export function cannotDeletePayHead(head: Pick<PayHead, "code" | "flags">, usage: { structures: number; payslips: number; templates: number }): string | null {
  const system = systemReason(head);
  if (system) return `${system} It stays.`;
  if (usage.payslips) return `It is on ${usage.payslips} payslip line${usage.payslips === 1 ? "" : "s"}: it stays for the payroll history.`;
  if (usage.structures) return `${usage.structures} salary structure${usage.structures === 1 ? " uses" : "s use"} it (current or past). Take it off those first.`;
  if (usage.templates) return `${usage.templates} salary template${usage.templates === 1 ? " uses" : "s use"} it. Take it off those first.`;
  return null;
}

/** The next "PH-001" style code after the ones in use. */
export function nextPayHeadCode(codes: readonly string[]): string {
  let max = 0;
  for (const c of codes) {
    const m = /^PH-(\d+)$/i.exec(c);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PH-${String(max + 1).padStart(3, "0")}`;
}

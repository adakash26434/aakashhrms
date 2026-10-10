import { getCompanyProfileSetup } from "@/lib/repositories/company-setup.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as payHeadRepository from "@/lib/repositories/pay-head.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import * as holidayRepository from "@/lib/repositories/holiday.repository";
import { findSettings } from "@/lib/repositories/system-control.repository";
import { labelAmounts } from "@/lib/services/salary-structure.service";
import { systemReason } from "@/lib/engines/pay-head.engine";
import { daysInclusive, fiscalYearLabel, fiscalYearOf } from "@/lib/engines/holiday.engine";
import { bsStringToAD } from "@/lib/utils/bs-calendar";
import { nepalDateIso, toIsoDate } from "@/lib/utils/nepal-time";

// Setup overview (4.12c): one line of state under each setting the user can open — what is set
// and what still needs doing. Each fact is read only when the page shows that entry.

export type SetupEntryId = "company" | "organization" | "payHeads" | "rules" | "fiscalYears" | "taxSlabs" | "holidays";

export interface SetupFact {
  text: string;
  /** Something payroll needs is missing. */
  warning?: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function company(): Promise<SetupFact> {
  const p = await getCompanyProfileSetup();
  const name = p.displayName || p.legalName;
  return p.panVatNumber ? { text: `${name} · PAN ${p.panVatNumber}` } : { text: `${name} · PAN not set`, warning: true };
}

async function organization(): Promise<SetupFact> {
  const [b, d, g] = await Promise.all([branchRepository.findAllBranches(), departmentRepository.findAllDepartments(), designationRepository.findAllDesignations()]);
  return { text: `${plural(b.length, "branch", "branches")} · ${plural(d.length, "department")} · ${plural(g.length, "designation")}` };
}

async function payHeads(): Promise<SetupFact> {
  const [heads, labelled] = await Promise.all([payHeadRepository.findAllPayHeads(), labelAmounts(null)]);
  const system = heads.filter((h) => systemReason(h)).length;
  const own = heads.length - system;
  const text = `${plural(own, "company pay head")} · ${plural(system, "system head")}`;
  // 4.12e: amounts left on the Basic Salary / Grade Amount labels are paid on top of basic / grade.
  const held = new Set(labelled.map((l) => l.employeeId)).size;
  return held ? { text: `${text} · ${plural(held, "structure")} with an amount on a label head`, warning: true } : { text };
}

async function rules(): Promise<SetupFact> {
  const s = await findSettings();
  return { text: s.statutoryDeductionLimits.companyHasSsf ? "In the social security fund (SSF)" : "Not in the social security fund (SSF)" };
}

async function currentYear() {
  return (await fiscalYearRepository.findAllFiscalYears()).find((y) => y.status === "Active") ?? null;
}

async function fiscalYears(): Promise<SetupFact> {
  const current = await currentYear();
  return current ? { text: `Current: ${current.label}` } : { text: "No current fiscal year: payroll can't run", warning: true };
}

async function taxSlabs(): Promise<SetupFact> {
  const current = await currentYear();
  if (!current) return { text: "No current fiscal year", warning: true };
  return (await fiscalYearRepository.hasIndividualLadder(current.id))
    ? { text: `${current.label}: slabs set` }
    : { text: `${current.label}: no Individual slabs — payroll refuses its months`, warning: true };
}

async function holidays(): Promise<SetupFact> {
  const year = fiscalYearOf(nepalDateIso());
  const all = await holidayRepository.findAllHolidays();
  let count = 0;
  let days = 0;
  for (const h of all) {
    const from = bsStringToAD(h.startDate);
    const to = bsStringToAD(h.endDate);
    if (!from || !to || fiscalYearOf(toIsoDate(from)) !== year) continue;
    count += 1;
    days += daysInclusive(toIsoDate(from), toIsoDate(to));
  }
  return count ? { text: `${fiscalYearLabel(year)}: ${plural(count, "holiday")}, ${plural(days, "day")}` } : { text: `${fiscalYearLabel(year)}: none yet`, warning: true };
}

const FACTS: Record<SetupEntryId, () => Promise<SetupFact>> = { company, organization, payHeads, rules, fiscalYears, taxSlabs, holidays };

/** The facts for the entries shown (one failing read leaves its line out). */
export async function setupFacts(ids: readonly SetupEntryId[]): Promise<Partial<Record<SetupEntryId, SetupFact>>> {
  const results = await Promise.all(ids.map((id) => FACTS[id]().catch(() => null)));
  return Object.fromEntries(ids.flatMap((id, i) => (results[i] ? [[id, results[i]]] : [])));
}

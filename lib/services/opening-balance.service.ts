import Decimal from "decimal.js";
import { parseCsv } from "@/lib/export/csv";
import { MAX_IMPORT_BYTES, TOO_LARGE, buildReport, fileReport, readSheet, textIssues, type ImportReport, type ReportRow, type RowIssue } from "@/lib/engines/import.engine";
import { OPENING_IMPORT_COLUMNS, bsMonthOfFiscal, coveredMonths, openingTds, readOpeningRow } from "@/lib/engines/opening-balance.engine";
import * as openingRepository from "@/lib/repositories/opening-balance.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import { findUserNames } from "@/lib/repositories/salary-structure.repository";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { isOwnRecord } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { BS_MONTHS_EN, getBSMonthRange } from "@/lib/utils/bs-calendar";
import { toIsoDate } from "@/lib/utils/nepal-time";
import type { OpeningBalancesPage } from "@/lib/types/opening-balance";

// Opening balances (4.8 / F15): for a company that starts payroll here mid-year, what the old
// system paid each employee in the fiscal year's first months, entered from a file. The rules of
// what may be carried: employees within the user's scope, never one's own pay record (S21), one
// per employee and year (a new file replaces it), and never a month that already has a payslip
// here — a month is paid by one system only. Payroll then counts it as those months (tax
// projection, Ashadh reconciliation, tax certificate), and refuses runs for the months it covers.

export interface OpeningCtx {
  scope: ScopeFilter;
  userId: string;
}

/** A removal refused for who asked: their own record (S21) or one outside their scope. Audited by the action. */
export class OpeningRefused extends UserFacingError {
  constructor(
    message: string,
    readonly reason: "self" | "scope",
  ) {
    super(message);
  }
}

const npr = (v: Decimal.Value) => `NPR ${new Decimal(v || 0).toNumber().toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const monthName = (fiscalIndex: number) => BS_MONTHS_EN[bsMonthOfFiscal(0, fiscalIndex).month];

/** The screen: the active fiscal year's opening balances for employees in the viewer's scope. */
export async function openingPage(ctx: OpeningCtx, permissions: OpeningBalancesPage["permissions"]): Promise<OpeningBalancesPage> {
  const fy = await openingRepository.activeFiscalYear();
  if (!fy) return { fiscalYear: null, rows: [], permissions };
  const rows = await openingRepository.findOpenings(fy.id, buildEmployeeScopeCondition(ctx.scope));
  const names = await findUserNames(rows.map((r) => r.updatedBy ?? ""));
  return {
    fiscalYear: { id: fy.id, label: fy.label },
    rows: rows.map((r) => ({
      ...r,
      covered: coveredMonths(r.months),
      tds: openingTds(r),
      updatedByName: r.updatedBy ? (names.get(r.updatedBy) ?? null) : null,
      own: isOwnRecord(ctx.scope.employeeId, r.employeeId),
    })),
    permissions,
  };
}

async function plan(csv: unknown, ctx: OpeningCtx): Promise<{ report: ImportReport; rows: openingRepository.NewOpening[] }> {
  if (typeof csv !== "string" || !csv.trim()) return { report: fileReport("The file is empty."), rows: [] };
  if (csv.length > MAX_IMPORT_BYTES) return { report: fileReport(TOO_LARGE), rows: [] };
  const unreadable = textIssues(csv);
  if (unreadable.length) return { report: fileReport(...unreadable), rows: [] };
  const fy = await openingRepository.activeFiscalYear();
  if (!fy) return { report: fileReport("There is no active fiscal year: set one up under Setup → Fiscal year first."), rows: [] };
  const read = readSheet(parseCsv(csv), OPENING_IMPORT_COLUMNS);
  if (read.fileIssues.length) return { report: buildReport(read, []), rows: [] };

  const [codes, inScope] = await Promise.all([
    employeeRepository.findAllCodes(),
    employeeRepository.findAll({ search: "", departmentId: "all", branchId: "all", category: "all", status: "all" }, buildEmployeeScopeCondition(ctx.scope)),
  ]);
  const key = (code: string) => code.trim().toUpperCase();
  const known = new Set(codes.map((c) => key(c.employeeCode)));
  const byCode = new Map(inScope.map((e) => [key(e.employeeCode), e]));
  const ids = inScope.map((e) => e.id);
  const [existing, slipMonths] = await Promise.all([openingRepository.openingsFor(ids, fy.id), openingRepository.slipMonthsFor(ids, fy.id)]);
  const fyStartBsYear = Number(String(fy.startDateBS).slice(0, 4));

  const seen = new Map<string, number>();
  const rows: openingRepository.NewOpening[] = [];
  const report: ReportRow[] = [];
  let gross = new Decimal(0);
  let tax = new Decimal(0);
  for (const r of read.rows) {
    const { employeeCode, opening, note, issues } = readOpeningRow(r);
    const err = (column: string, message: string) => issues.push({ column, message, level: "error" } satisfies RowIssue);
    const warn = (column: string, message: string) => issues.push({ column, message, level: "warning" } satisfies RowIssue);
    const employee = employeeCode ? byCode.get(key(employeeCode)) : undefined;
    let label = employeeCode || "(no code)";
    if (employeeCode && !employee) err("Employee code", known.has(key(employeeCode)) ? "Outside the branches / departments you manage" : `No employee ${employeeCode}`);
    if (employee) {
      label = `${employee.employeeCode} · ${employee.fullName}`;
      const line = seen.get(employee.id);
      if (line) err("Employee code", `Also on line ${line}`);
      else seen.set(employee.id, r.line);
      if (isOwnRecord(ctx.scope.employeeId, employee.id)) err("Employee code", "Your own pay record is entered by someone else");
    }
    if (employee && opening) {
      // A month is paid by one system only.
      const paidHere = (slipMonths.get(employee.id) ?? []).filter((m) => m.index <= opening.months).sort((a, b) => a.index - b.index)[0];
      if (paidHere) err("Months paid before", `${monthName(paidHere.index)} is already in a payroll run here (${paidHere.status.toLowerCase().replace("_", " ")}): cover fewer months, or delete that payslip`);
      const last = bsMonthOfFiscal(fyStartBsYear, opening.months);
      // bsToAD gives a local-midnight date: read it with local getters.
      const coveredEnd = toIsoDate(getBSMonthRange(last.year, last.month).end);
      const joined = new Date(employee.joiningDate).toISOString().slice(0, 10);
      if (joined > coveredEnd) err("Months paid before", `Joined after ${BS_MONTHS_EN[last.month]} ${last.year}: nothing to carry for those months`);
      // What saving would change (only for a row that can be saved).
      if (!issues.some((i) => i.level === "error")) {
        const before = existing.get(employee.id);
        if (before) warn("Months paid before", `Replaces the opening balance entered before (${coveredMonths(before.months)}, gross ${npr(before.grossEarnings)})`);
        if ((slipMonths.get(employee.id) ?? []).some((m) => m.index > opening.months && (m.status === "APPROVED" || m.status === "LOCKED"))) {
          warn("Months paid before", "Payslips already final after these months worked their tax without it; the next month's tax catches up");
        }
      }
    }
    report.push({ line: r.line, label, issues });
    if (employee && opening && !issues.some((i) => i.level === "error")) {
      rows.push({ ...opening, employeeId: employee.id, fiscalYearId: fy.id, note: note || null });
      gross = gross.plus(opening.grossEarnings);
      tax = tax.plus(openingTds(opening));
    }
  }
  const result = buildReport(read, report);
  if (!result.ready) return { report: result, rows: [] };
  result.summary = `${rows.length} opening balance${rows.length === 1 ? "" : "s"} for ${fy.label}: gross ${npr(gross)}, tax deducted ${npr(tax)}`;
  return { report: result, rows };
}

/** The report for a file, saving nothing. */
export async function previewOpeningImport(csv: unknown, ctx: OpeningCtx): Promise<ImportReport> {
  return (await plan(csv, ctx)).report;
}

/** Saves every opening balance of a file that checks clean (checked again here). */
export async function commitOpeningImport(csv: unknown, ctx: OpeningCtx): Promise<{ saved: number; openings: { employeeId: string; months: number }[] }> {
  const { report, rows } = await plan(csv, ctx);
  if (!report.ready) throw new UserFacingError("Some rows have errors: fix them in the file and check it again.");
  return { saved: await openingRepository.upsertOpenings(rows, ctx.userId), openings: rows.map((r) => ({ employeeId: r.employeeId, months: r.months })) };
}

/** Removes an opening balance of an employee in scope (never one's own). */
export async function removeOpening(id: unknown, ctx: OpeningCtx): Promise<{ employeeId: string }> {
  if (typeof id !== "string" || !id) throw new UserFacingError("Choose an opening balance.");
  const row = await openingRepository.findOpeningById(id);
  if (!row) throw new UserFacingError("That opening balance no longer exists. Refresh the page.");
  const inScope = await openingRepository.findOpenings(row.fiscalYearId, buildEmployeeScopeCondition(ctx.scope));
  if (!inScope.some((o) => o.id === id)) throw new OpeningRefused("That employee is outside the branches / departments you manage.", "scope");
  if (isOwnRecord(ctx.scope.employeeId, row.employeeId)) throw new OpeningRefused("Your own pay record is changed by someone else.", "self");
  if (!(await openingRepository.deleteOpening(id))) throw new UserFacingError("That opening balance was already removed.");
  return { employeeId: row.employeeId };
}

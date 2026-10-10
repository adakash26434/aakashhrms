import Decimal from "decimal.js";
import { parseCsv } from "@/lib/export/csv";
import { MAX_IMPORT_BYTES, TOO_LARGE, buildReport, fileReport, readSheet, textIssues, type ImportReport, type ReportRow, type RowIssue } from "@/lib/engines/import.engine";
import { LOAN_OPENING_COLUMNS, npr, openingTerms, readOpeningLoanRow } from "@/lib/engines/loan.engine";
import * as repo from "@/lib/repositories/loan.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import { withOpenCase } from "@/lib/repositories/exit.repository";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { isOwnRecord } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";

// Loan opening balances (4.10 / F15): loans an employee is still repaying from before this
// system, entered from a file — the date given, the amount, what is still to recover and the
// installment payroll deducts from now on. Employees within the user's scope, never one's own
// (S21), one running loan of a type per employee, and never the same loan twice. Nothing is saved
// while a row has an error; payroll deducts them from the next pay run it works out.

export interface LoanOpeningCtx {
  scope: ScopeFilter;
  userId: string;
}

type NewLoan = Parameters<typeof repo.insertOpeningLoans>[0][number];

async function plan(csv: unknown, ctx: LoanOpeningCtx): Promise<{ report: ImportReport; rows: NewLoan[] }> {
  if (typeof csv !== "string" || !csv.trim()) return { report: fileReport("The file is empty."), rows: [] };
  if (csv.length > MAX_IMPORT_BYTES) return { report: fileReport(TOO_LARGE), rows: [] };
  const unreadable = textIssues(csv);
  if (unreadable.length) return { report: fileReport(...unreadable), rows: [] };
  const read = readSheet(parseCsv(csv), LOAN_OPENING_COLUMNS);
  if (read.fileIssues.length) return { report: buildReport(read, []), rows: [] };

  const [codes, inScope, types] = await Promise.all([
    employeeRepository.findAllCodes(),
    employeeRepository.findAll({ search: "", departmentId: "all", branchId: "all", category: "all", status: "all" }, buildEmployeeScopeCondition(ctx.scope)),
    repo.listTypes(),
  ]);
  const key = (s: string) => s.trim().toUpperCase();
  const known = new Set(codes.map((c) => key(c.employeeCode)));
  const byCode = new Map(inScope.map((e) => [key(e.employeeCode), e]));
  const typeByName = new Map(types.map((t) => [t.name.trim().toLowerCase(), t]));
  const ids = inScope.map((e) => e.id);
  const [existing, leaving, settled] = await Promise.all([repo.loanKeys(ids), withOpenCase(ids), repo.openCaseSettlements(ids)]);
  const today = nepalDateIso();

  const seen = new Map<string, number>();
  const rows: NewLoan[] = [];
  const report: ReportRow[] = [];
  let toRecover = new Decimal(0);
  let monthly = new Decimal(0);
  const people = new Set<string>();
  for (const r of read.rows) {
    const { employeeCode, typeName, loan, note, issues } = readOpeningLoanRow(r, today);
    const err = (column: string, message: string) => issues.push({ column, message, level: "error" } satisfies RowIssue);
    const warn = (column: string, message: string) => issues.push({ column, message, level: "warning" } satisfies RowIssue);
    const employee = employeeCode ? byCode.get(key(employeeCode)) : undefined;
    const type = typeName ? typeByName.get(typeName.toLowerCase()) : undefined;
    let label = employeeCode || "(no code)";
    if (employeeCode && !employee) err("Employee code", known.has(key(employeeCode)) ? "Outside the branches / departments you manage" : `No employee ${employeeCode}`);
    if (typeName && !type) err("Loan type", `No loan type "${typeName}": add it under Loans → Loan types first`);
    if (employee) {
      label = `${employee.employeeCode} · ${employee.fullName}`;
      if (employee.status !== "Active") err("Employee code", "Not an active employee");
      if (isOwnRecord(ctx.scope.employeeId, employee.id)) err("Employee code", "Your own loans are entered by someone else");
      const settlement = settled.get(employee.id);
      if (settlement === "approved" || settlement === "paid") err("Employee code", `Their final settlement is already ${settlement}: it would not recover this loan`);
      else if (leaving.has(employee.id)) warn("Employee code", "Leaving (an exit case is open): prepare the final settlement again so it recovers this loan");
    }
    if (employee && type) {
      const pair = `${employee.id}|${type.id}`;
      const line = seen.get(pair);
      if (line) err("Loan type", `Also on line ${line} (one running loan of a type per person)`);
      else seen.set(pair, r.line);
      if (existing.running.has(pair)) err("Loan type", `Already has a ${type.name} running here`);
      if (loan && existing.keys.has(repo.openingKey(employee.id, type.id, loan.givenDate, loan.amount))) err("Date given (BS)", "This loan is already recorded");
      if (!type.isActive) warn("Loan type", `${type.name} is no longer offered; the loan is carried anyway`);
      // The joining date is read as UTC midnight of its day (employee.repository), so its ISO day is the day itself.
      if (loan && loan.givenDate < new Date(employee.joiningDate).toISOString().slice(0, 10)) warn("Date given (BS)", "Before the employee joined: check the date");
    }
    report.push({ line: r.line, label, issues });
    if (employee && type && loan && !issues.some((i) => i.level === "error")) {
      const terms = openingTerms(loan);
      rows.push({
        employeeId: employee.id,
        loanTypeId: type.id,
        givenDate: loan.givenDate,
        source: "opening",
        loanAmount: loan.amount,
        interestRate: terms.interestRate,
        totalPayable: terms.totalPayable,
        installmentAmount: loan.installment,
        noOfInstallments: Math.max(1, terms.installmentsLeft),
        firstDeductionMonth: null,
        totalReturned: loan.repaid,
        remainingAmount: loan.balance,
        status: "ACTIVE",
        note: note || null,
        createdBy: ctx.userId,
      });
      toRecover = toRecover.plus(loan.balance);
      monthly = monthly.plus(Decimal.min(loan.installment, loan.balance));
      people.add(employee.id);
    }
  }
  const result = buildReport(read, report);
  if (!result.ready) return { report: result, rows: [] };
  result.summary = `${rows.length} loan${rows.length === 1 ? "" : "s"} for ${people.size} employee${people.size === 1 ? "" : "s"}: NPR ${npr(toRecover)} to recover, NPR ${npr(monthly)} a month from the next pay run`;
  return { report: result, rows };
}

/** The report for a file, saving nothing. */
export async function previewLoanOpeningImport(csv: unknown, ctx: LoanOpeningCtx): Promise<ImportReport> {
  return (await plan(csv, ctx)).report;
}

/** Saves every loan of a file that checks clean (checked again here), in one transaction. */
export async function commitLoanOpeningImport(csv: unknown, ctx: LoanOpeningCtx): Promise<{ saved: number; loans: { id: string; employeeId: string; remaining: string }[] }> {
  const { report, rows } = await plan(csv, ctx);
  if (!report.ready) throw new UserFacingError("Some rows have errors: fix them in the file and check it again.");
  const saved = await repo.insertOpeningLoans(rows);
  return { saved: saved.length, loans: saved.map((l) => ({ id: l.id, employeeId: l.employeeId, remaining: l.remainingAmount })) };
}

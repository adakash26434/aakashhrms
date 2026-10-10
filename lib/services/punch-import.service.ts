import { parseCsv } from "@/lib/export/csv";
import { MAX_IMPORT_BYTES, TOO_LARGE, buildReport, fileReport, readSheet, textIssues, type ImportReport, type ReportRow, type RowIssue } from "@/lib/engines/import.engine";
import { MAX_PUNCH_ROWS, PUNCH_IMPORT_COLUMNS, punchHeaderIssues, readPunchRow } from "@/lib/engines/punch-import.engine";
import { instantAt } from "@/lib/engines/attendance-day.engine";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { isOwnRecord } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { adToBSString } from "@/lib/utils/bs-calendar";

// Attendance punch import (4.8 / F15): the same checks as an HR punch (attendance.service
// guardDays) for every row — people within the user's scope, never the user's own attendance
// (S21), employed that day, not a future day, not in a closed month — reported per line;
// nothing is added while any row has an error. Punches are added with source "import" and are
// idempotent (employee, time, source), so importing a file twice adds nothing the second time.

export interface PunchImportContext {
  scope: ScopeFilter;
  userId: string;
}

export interface PunchImportResult {
  /** Punches added now. */
  added: number;
  /** Punches the file had that were already imported before. */
  alreadyThere: number;
  employees: number;
}

const INSERT_CHUNK = 500;
/** An AD "YYYY-MM-DD" as the BS "YYYY-MM-DD" people read. */
const bs = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return adToBSString(new Date(y, m - 1, d));
};
const DEFAULT_NOTE = "Imported from a file";

async function plan(csv: unknown, ctx: PunchImportContext): Promise<{ report: ImportReport; punches: attendanceRepo.NewPunch[] }> {
  if (typeof csv !== "string" || !csv.trim()) return { report: fileReport("The file is empty."), punches: [] };
  if (csv.length > MAX_IMPORT_BYTES) return { report: fileReport(TOO_LARGE), punches: [] };
  const unreadable = textIssues(csv);
  if (unreadable.length) return { report: fileReport(...unreadable), punches: [] };
  const read = readSheet(parseCsv(csv), PUNCH_IMPORT_COLUMNS, MAX_PUNCH_ROWS);
  const headerIssues = read.fileIssues.length ? [] : punchHeaderIssues(read.columns);
  if (read.fileIssues.length || headerIssues.length) return { report: buildReport({ ...read, fileIssues: [...read.fileIssues, ...headerIssues] }, []), punches: [] };

  const rows = read.rows.map((r) => ({ row: r, ...readPunchRow(r) }));
  const days = rows.flatMap((r) => (r.parsed ? [r.parsed.date] : [])).sort();
  const [codes, inScope, closed] = await Promise.all([
    employeeRepository.findAllCodes(),
    attendanceRepo.findEmployees(buildEmployeeScopeCondition(ctx.scope)),
    days.length ? attendanceRepo.findClosedPeriodsOverlapping(days[0], days[days.length - 1]) : Promise.resolve([]),
  ]);
  const key = (code: string) => code.trim().toUpperCase();
  const byAttendanceCode = new Map(codes.filter((c) => c.attendanceCode).map((c) => [key(c.attendanceCode), c.id]));
  const byEmployeeCode = new Map(codes.map((c) => [key(c.employeeCode), c.id]));
  const scoped = new Map(inScope.map((e) => [e.id, e]));
  const today = nepalDateIso();

  const seen = new Set<string>();
  const people = new Set<string>();
  const punches: attendanceRepo.NewPunch[] = [];
  const report: ReportRow[] = [];
  for (const { row, parsed, issues } of rows) {
    const typedDate = row.cells.dateBs || row.cells.dateAd || "";
    let label = [row.cells.employeeCode || row.cells.attendanceCode || "(no code)", typedDate].filter(Boolean).join(" · ");
    if (parsed) {
      const err = (column: string, message: string) => issues.push({ column, message, level: "error" } satisfies RowIssue);
      const byAttendance = parsed.attendanceCode ? byAttendanceCode.get(key(parsed.attendanceCode)) : undefined;
      const byEmployee = parsed.employeeCode ? byEmployeeCode.get(key(parsed.employeeCode)) : undefined;
      const codeColumn = parsed.attendanceCode ? "Attendance code" : "Employee code";
      if (parsed.attendanceCode && !byAttendance) err("Attendance code", `No employee has attendance code ${parsed.attendanceCode}`);
      else if (parsed.employeeCode && !byEmployee) err("Employee code", `No employee ${parsed.employeeCode}`);
      else if (byAttendance && byEmployee && byAttendance !== byEmployee) err("Attendance code", `${parsed.attendanceCode} is another employee's attendance code`);
      else {
        const employee = scoped.get((byAttendance ?? byEmployee)!);
        if (!employee) err(codeColumn, "Outside the branches / departments you manage");
        else {
          label = `${employee.employeeCode} · ${employee.fullName} · ${typedDate}`;
          const inClosedMonth = closed.some((p) => p.branchId === employee.branchId && parsed.date >= String(p.startDate) && parsed.date <= String(p.endDate));
          if (isOwnRecord(ctx.scope.employeeId, employee.id)) err(codeColumn, "Your own attendance is entered by someone else");
          else if (parsed.date > today) err(parsed.dateColumn, "A future day");
          else if (parsed.date < employee.joiningDate) err(parsed.dateColumn, "Before the employee joined");
          else if (employee.terminationDate && parsed.date > employee.terminationDate) err(parsed.dateColumn, "After the employee left");
          else if (employee.status !== "Active" && !employee.terminationDate) err(codeColumn, "The employee is inactive");
          else if (inClosedMonth) err(parsed.dateColumn, "In a closed attendance month: reopen the month first");
          else {
            people.add(employee.id);
            for (const p of parsed.punches) {
              const punchedAt = instantAt(parsed.date, p.minutes);
              // The same punch twice in the file (or a row repeated) is added once.
              if (seen.has(`${employee.id}|${punchedAt}`)) continue;
              seen.add(`${employee.id}|${punchedAt}`);
              punches.push({ employeeId: employee.id, punchedAt, kind: p.kind, source: "import", note: parsed.note || DEFAULT_NOTE, createdBy: ctx.userId });
            }
          }
        }
      }
    }
    report.push({ line: row.line, label, issues });
  }
  const result = buildReport(read, report);
  if (!result.ready) return { report: result, punches: [] };
  const [first, last] = [bs(days[0]), bs(days[days.length - 1])];
  const span = first === last ? `on ${first}` : `from ${first} to ${last}`;
  result.summary = `${punches.length.toLocaleString("en-IN")} punch${punches.length === 1 ? "" : "es"} for ${people.size} employee${people.size === 1 ? "" : "s"} ${span} (BS)`;
  return { report: result, punches };
}

/** The report for a file, adding nothing. */
export async function previewPunchImport(csv: unknown, ctx: PunchImportContext): Promise<ImportReport> {
  return (await plan(csv, ctx)).report;
}

/** Adds every punch of a file that checks clean (checked again here). Punches imported before are skipped. */
export async function commitPunchImport(csv: unknown, ctx: PunchImportContext): Promise<PunchImportResult> {
  const { report, punches } = await plan(csv, ctx);
  if (!report.ready) throw new UserFacingError("Some rows have errors: fix them in the file and check it again.");
  let added = 0;
  for (let i = 0; i < punches.length; i += INSERT_CHUNK) added += await attendanceRepo.insertPunches(punches.slice(i, i + INSERT_CHUNK));
  return { added, alreadyThere: punches.length - added, employees: new Set(punches.map((p) => p.employeeId)).size };
}

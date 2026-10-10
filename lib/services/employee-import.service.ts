import { parseCsv } from "@/lib/export/csv";
import { MAX_IMPORT_BYTES, buildReport, readSheet, textIssues, type ImportReport, type ReportRow, type RowIssue } from "@/lib/engines/import.engine";
import { EMPLOYEE_IMPORT_COLUMNS, columnOfField, columnsBehindField, employeeRowToForm, numberKey, type EmployeeImportLookups } from "@/lib/engines/employee-import.engine";
import { canPlaceInScope, codeConflicts, getNextAttendanceCode, getNextEmployeeCode, validateEmployee } from "@/lib/engines/employee.engine";
import { placementErrors } from "@/lib/engines/organization.engine";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as shreniRepository from "@/lib/repositories/shreni.repository";
import { findAllEmploymentTypes } from "@/lib/repositories/employment-type.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import { placementChecker } from "@/lib/services/darbandi.service";
import { EMPTY_EMPLOYEE_FORM, EmployeeValidationError, saveEmployee } from "@/lib/services/employee.service";
import { EMPLOYEE_CATEGORIES } from "@/lib/types/system-control";
import { UserFacingError } from "@/lib/errors/action-error";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import type { EmployeeFormData } from "@/lib/types/employee";

// Employee import (4.8 / F15): a filled-in template is checked row by row on the server with the
// employee form's own rules (codes, placement within the user's scope, darbandi, documents —
// a citizenship scan is added on the record later) and reported per line; nothing is saved while
// any row has an error. Saving goes through saveEmployee, one employee at a time, exactly as the
// form would (no self-service logins are created by an import).

export interface ImportContext {
  scope: ScopeFilter;
  userId: string;
  /** Salary mapping → Edit: basic salary and grades from the file (otherwise the level's starting salary). */
  canEditPay: boolean;
}

interface PlannedRow {
  line: number;
  form: EmployeeFormData;
}

export interface EmployeeImportResult {
  created: { line: number; employeeId: string; employeeCode: string; fullName: string }[];
  failed: { line: number; message: string }[];
}

type Lookups = EmployeeImportLookups & {
  codes: { id: string; employeeCode: string; attendanceCode: string }[];
  /** As placementErrors reads the organization (statuses, departments open to branches). */
  org: Parameters<typeof placementErrors>[2];
  /** Company emails of active employees → their code (a login later needs its own email). */
  emails: Map<string, string>;
  /** The grade policy has grade amounts typed in by hand (the file has no amount column). */
  gradesTypedIn: boolean;
  /** Citizenship / NID numbers and primary accounts on record (numberKey → employee; active ones first). */
  onRecord: Record<"identity" | "account", Map<string, { code: string; active: boolean }>>;
};

async function lookups(): Promise<Lookups> {
  const [branches, departments, designations, levels, types, codes, employees, settings, numbers] = await Promise.all([
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    shreniRepository.findAllShreniLevels(),
    findAllEmploymentTypes().catch(() => []),
    employeeRepository.findAllCodes(),
    employeeRepository.findAll({ search: "", departmentId: "all", branchId: "all", category: "all", status: "Active" }),
    systemControlRepository.findSettings(),
    employeeRepository.findIdentityNumbers(),
  ]);
  const onRecord: Lookups["onRecord"] = { identity: new Map(), account: new Map() };
  for (const n of numbers) {
    const key = numberKey(n.number);
    if (key && (!onRecord[n.kind].has(key) || n.active)) onRecord[n.kind].set(key, { code: n.employeeCode, active: n.active });
  }
  return {
    branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code, status: b.status })),
    departments: departments.map((d) => ({ id: d.id, name: d.name, code: d.code, status: d.status })),
    designations: designations.map((d) => ({ id: d.id, name: d.name, departmentId: d.departmentId, status: d.status })),
    levels: levels.filter((l) => l.isActive !== false).map((l) => ({ code: l.code, name: l.name, minSalary: Number(l.minSalary) || 0 })),
    categories: types.length ? types.filter((t) => t.isActive).map((t) => t.name) : [...EMPLOYEE_CATEGORIES],
    supervisors: employees.filter((e) => e.isSupervisor).map((e) => ({ id: e.id, employeeCode: e.employeeCode })),
    codes,
    org: { branches, departments, designations },
    emails: new Map(employees.filter((e) => e.companyEmail).map((e) => [e.companyEmail.trim().toLowerCase(), e.employeeCode])),
    gradesTypedIn: settings.gradePolicy?.calculationMethod === "MANUAL_INPUT",
    onRecord,
  };
}

/** Checks the whole file; `rows` are the employees ready to save (only when the report is ready). */
async function plan(csv: unknown, ctx: ImportContext): Promise<{ report: ImportReport; rows: PlannedRow[] }> {
  if (typeof csv !== "string" || !csv.trim()) return { report: buildReport({ fileIssues: ["The file is empty."], ignored: [] }, []), rows: [] };
  if (csv.length > MAX_IMPORT_BYTES) return { report: buildReport({ fileIssues: ["The file is too large (2 MB at most)."], ignored: [] }, []), rows: [] };
  const unreadable = textIssues(csv);
  if (unreadable.length) return { report: buildReport({ fileIssues: unreadable, ignored: [] }, []), rows: [] };
  const read = readSheet(parseCsv(csv), EMPLOYEE_IMPORT_COLUMNS);
  if (read.fileIssues.length) return { report: buildReport(read, []), rows: [] };

  const lk = await lookups();
  // Codes typed in the file are kept for their rows; empty ones get the next free codes after them.
  const typedEmp = new Map<string, number>();
  const typedAtt = new Map<string, number>();
  for (const r of read.rows) {
    const e = (r.cells.employeeCode ?? "").trim().toUpperCase();
    const a = (r.cells.attendanceCode ?? "").trim().toUpperCase();
    if (e) typedEmp.set(e, (typedEmp.get(e) ?? 0) + 1);
    if (a) typedAtt.set(a, (typedAtt.get(a) ?? 0) + 1);
  }
  const empCodes = [...lk.codes.map((c) => c.employeeCode), ...typedEmp.keys()];
  const attCodes = [...lk.codes.map((c) => c.attendanceCode), ...typedAtt.keys()];
  const seenEmails = new Map<string, number>();
  const inFile: Record<"identity" | "account", Map<string, number>> = { identity: new Map(), account: new Map() };
  const darbandi = await placementChecker();

  const report: ReportRow[] = [];
  const rows: PlannedRow[] = [];
  for (const r of read.rows) {
    const { form: partial, issues } = employeeRowToForm(r, lk);
    const form: EmployeeFormData = { ...EMPTY_EMPLOYEE_FORM, ...partial, status: "Active" };
    if (!form.employeeCode) {
      form.employeeCode = getNextEmployeeCode(empCodes);
      empCodes.push(form.employeeCode);
    } else if ((typedEmp.get(form.employeeCode.toUpperCase()) ?? 0) > 1) {
      issues.push({ column: "Employee code", message: `${form.employeeCode} is used on more than one row`, level: "error" });
    }
    if (!form.attendanceCode) {
      form.attendanceCode = getNextAttendanceCode(attCodes, "ATD-");
      attCodes.push(form.attendanceCode);
    } else if ((typedAtt.get(form.attendanceCode.toUpperCase()) ?? 0) > 1) {
      issues.push({ column: "Attendance code", message: `${form.attendanceCode} is used on more than one row`, level: "error" });
    }

    // The employee form's own rules (an identity scan is added on the record later).
    const errors: Record<string, string | undefined> = {
      ...validateEmployee(form, { scanRequired: false }),
      ...codeConflicts(lk.codes, form, null),
      ...placementErrors(form, null, lk.org),
    };
    const known = new Set(issues.map((i) => `${i.column}|${i.message}`));
    for (const [field, message] of Object.entries(errors)) {
      if (!message) continue;
      const column = columnOfField(field, message);
      // A value that already failed to read explains the field it left empty.
      const behind = columnsBehindField(field, message);
      if (issues.some((i) => i.level === "error" && behind.includes(i.column)) || known.has(`${column}|${message}`)) continue;
      known.add(`${column}|${message}`);
      issues.push({ column, message, level: "error" });
    }
    if (form.branchId && form.departmentId && !canPlaceInScope(ctx.scope, { branchId: form.branchId, departmentId: form.departmentId })) {
      issues.push({ column: "Branch", message: "Outside the branches / departments you manage", level: "error" });
    }
    const email = form.companyEmail.trim().toLowerCase();
    if (email) {
      if (seenEmails.has(email)) issues.push({ column: "Company email", message: `Also on line ${seenEmails.get(email)}`, level: "warning" });
      else seenEmails.set(email, r.line);
      if (lk.emails.has(email)) issues.push({ column: "Company email", message: `Already the company email of ${lk.emails.get(email)}`, level: "warning" });
    }
    // One person, one row and one active record: a citizenship number seen earlier in the file or
    // on an active employee is an error (a second import of the same file stops here); on an
    // inactive employee it may be a re-hire. A bank account shared with anyone is pointed out.
    const sameNumber = (kind: "identity" | "account", text: string, column: string) => {
      const key = numberKey(text);
      if (!key) return;
      const strict = kind === "identity";
      const line = inFile[kind].get(key);
      if (line) issues.push({ column, message: `Same as line ${line}`, level: strict ? "error" : "warning" });
      else inFile[kind].set(key, r.line);
      const held = lk.onRecord[kind].get(key);
      if (held) {
        const message = held.active ? `Already on record for ${held.code}` : `Already on record for ${held.code} (inactive): a re-hire?`;
        issues.push({ column, message, level: strict && held.active ? "error" : "warning" });
      }
    };
    sameNumber("identity", r.cells.citizenshipNo ?? "", "Citizenship number");
    sameNumber("account", form.bankAccountNumber, "Account number");
    // Pay typed in the file (an empty basic salary is the level's starting salary).
    if (!ctx.canEditPay && (r.cells.basicSalary || r.cells.gradeCount)) {
      issues.push({ column: "Basic salary", message: "Ignored: setting pay needs Salary mapping → Edit (the level's starting salary applies)", level: "warning" });
    } else if (ctx.canEditPay && lk.gradesTypedIn && (form.gradeCount ?? 0) > 0) {
      issues.push({ column: "Grades", message: "The grade policy has grade amounts typed in: add the amount on the record (saved as 0)", level: "warning" });
    }
    if (form.designationId && form.branchId && !issues.some((i) => i.level === "error")) {
      try {
        const warning = await darbandi(form.designationId, form.branchId);
        if (warning) issues.push({ column: "Designation", message: warning, level: "warning" });
      } catch (error) {
        issues.push({ column: "Designation", message: error instanceof Error ? error.message : "Over the approved positions", level: "error" });
      }
    }
    report.push({ line: r.line, label: `${form.employeeCode} · ${form.fullName || "(no name)"}`, issues });
    rows.push({ line: r.line, form });
  }
  const result = buildReport(read, report);
  return { report: result, rows: result.ready ? rows : [] };
}

/** The report for a file, saving nothing. */
export async function previewEmployeeImport(csv: unknown, ctx: ImportContext): Promise<ImportReport> {
  return (await plan(csv, ctx)).report;
}

/**
 * Saves every row of a file that checks clean (it is checked again here). Each employee is saved
 * on its own, as the form saves it; a row that fails now (someone took a code meanwhile) is
 * reported and the others are kept.
 */
export async function commitEmployeeImport(csv: unknown, ctx: ImportContext): Promise<EmployeeImportResult> {
  const { report, rows } = await plan(csv, ctx);
  if (!report.ready) throw new UserFacingError("Some rows have errors: fix them in the file and check it again.");
  const out: EmployeeImportResult = { created: [], failed: [] };
  for (const r of rows) {
    try {
      const saved = await saveEmployee(null, r.form, { userId: ctx.userId, access: { createLogin: false }, canEditPay: ctx.canEditPay, canManageLogins: false, withoutScans: true });
      out.created.push({ line: r.line, employeeId: saved.employee.id, employeeCode: saved.employee.employeeCode, fullName: saved.employee.fullName });
    } catch (error) {
      const message =
        error instanceof EmployeeValidationError
          ? Object.entries(error.errors)
              .filter(([, m]) => !!m)
              .map(([f, m]) => `${columnOfField(f, m)}: ${m}`)
              .slice(0, 2)
              .join("; ")
          : error instanceof UserFacingError
            ? error.message
            : "Could not be saved";
      out.failed.push({ line: r.line, message });
    }
  }
  return out;
}

export { EMPLOYEE_IMPORT_COLUMNS };
export type { RowIssue };

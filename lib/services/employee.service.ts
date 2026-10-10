import { checkPlacement } from "@/lib/services/darbandi.service";
import { normalizeDossier, validateDossier } from "@/lib/engines/employee-dossier.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import * as repository from "@/lib/repositories/employee.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as engine from "@/lib/engines/employee.engine";
import type { Employee, EmployeeFormContext, EmployeeFormData, EmployeeRegisterData, EmployeeValidationErrors } from "@/lib/types/employee";
import { toE164Phone } from "@/lib/utils/phone";
import { EMPLOYEE_CATEGORIES } from "@/lib/types/system-control";
import { findAllEmploymentTypes } from "@/lib/repositories/employment-type.repository";
import * as roleService from "@/lib/services/role.service";
import * as userService from "@/lib/services/user.service";
import { getDb } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { creditOnJoining } from "@/lib/services/leave.service";
import { ScopeFilter, buildEmployeeScopeCondition } from "@/lib/auth/scope-filter";
import {
  findUserByEmployeeId,
  findUserByEmail,
  updateUser as updateUserRepository,
} from "@/lib/repositories/user.repository";
import { EMPLOYEE_ROLE_SLUG, EMPLOYEE_ROLE_SLUG_FALLBACK } from "@/lib/auth/employee-self-service-role";
import { DENIED_SELF } from "@/lib/auth/self-action";
import { employeeInScope } from "@/lib/engines/leave.engine";
import { recordAuditLog } from "@/lib/services/audit.service";
import { isUuid } from "@/lib/utils/uuid";

export class EmployeeValidationError extends Error {
  constructor(public errors: EmployeeValidationErrors) {
    super("Employee validation failed");
    this.name = "EmployeeValidationError";
  }
}

import * as shreniRepository from "@/lib/repositories/shreni.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import { resolvePay } from "@/lib/engines/grade-policy.engine";
import * as salaryStructureService from "@/lib/services/salary-structure.service";
import { pickable, placementErrors } from "@/lib/engines/organization.engine";
import { legacyDocumentColumns, normalizeDocuments } from "@/lib/engines/employee-document.engine";
import { detailValues } from "@/lib/engines/employee-detail.engine";
import * as detailService from "@/lib/services/employee-detail.service";
import type { DetailPlan } from "@/lib/services/employee-detail.service";
import type { DetailFormInfo, DetailSaveResult } from "@/lib/types/employee-detail";

const ALL_EMPLOYEES = { search: "", departmentId: "all", branchId: "all", category: "all", status: "all" } as const;

export interface EmployeeLookupData {
  branches: { id: string; name: string; status: "active" | "inactive" }[];
  departments: { id: string; name: string; branchIds: string[]; status: "active" | "inactive" }[];
  designations: { id: string; name: string; departmentId: string; status: "active" | "inactive" }[];
}

export async function getEmployeeLookupData(scope?: ScopeFilter) {
  const scopeCondition = scope ? buildEmployeeScopeCondition(scope) : undefined;
  const db = (await getDb());
  const [branches, departments, designations, allEmployees, shreniLevels, systemControl, industryRow] = await Promise.all([
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    repository.findAll(ALL_EMPLOYEES, scopeCondition),
    shreniRepository.findAllShreniLevels(),
    systemControlRepository.findSettings(),
    db
      .select({ value: systemConfig.value })
      .from(systemConfig)
      .where(eq(systemConfig.key, "company_industry_type"))
      .limit(1)
      .catch(() => []),
  ]);
  return {
    branches: branches.map((b) => ({ id: b.id, name: b.name, status: b.status })),
    departments: departments.map((d) => ({ id: d.id, name: d.name, branchIds: d.branchIds, status: d.status })),
    designations: designations.map((d) => ({ id: d.id, name: d.name, departmentId: d.departmentId, status: d.status })),
    shreniLevels,
    gradePolicy: systemControl.gradePolicy,
    employees: allEmployees.map((e) => ({
      id: e.id,
      name: e.fullName, // the repository already falls back to legacy first/last names
      employeeCode: e.employeeCode,
      attendanceCode: e.attendanceCode,
      isSupervisor: e.isSupervisor,
    })),
    industryType: industryRow[0]?.value || "General",
  };
}

/**
 * The register (4.2): every employee in the user's scope as slim list rows
 * (S18), plus the filter choices. Filtering happens in the browser.
 */
export async function getEmployeeRegister(
  scope: ScopeFilter,
  permissions: EmployeeRegisterData["permissions"],
  /** Employees → Approve (F13: which waiting detail changes are this user's to decide). */
  canApproveDetails = false
): Promise<EmployeeRegisterData> {
  const [employees, branches, departments, designations, detailChanges] = await Promise.all([
    repository.findAll(ALL_EMPLOYEES, buildEmployeeScopeCondition(scope)),
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    detailService.pendingCounts(scope, canApproveDetails).catch((error) => {
      console.error("[employees] detail changes unavailable", error instanceof Error ? error.message.slice(0, 120) : error);
      return { pending: 0, waitingForMe: 0 };
    }),
  ]);
  const names: engine.RegisterNames = {
    department: new Map(departments.map((d) => [d.id, d.name])),
    designation: new Map(designations.map((d) => [d.id, d.name])),
    branch: new Map(branches.map((b) => [b.id, b.name])),
    employee: new Map(employees.map((e) => [e.id, e.fullName])),
  };
  const rows = employees.map((e) => engine.toEmployeeListRow(e, names)).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const used = (ids: Set<string>, list: { id: string; name: string }[]) =>
    list.filter((x) => ids.has(x.id)).map((x) => ({ id: x.id, name: x.name })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    rows,
    counts: engine.registerCounts(rows),
    departments: used(new Set(rows.map((r) => r.departmentId)), departments),
    branches: used(new Set(rows.map((r) => r.branchId)), branches),
    permissions,
    detailChanges,
  };
}

export async function getEmployeeById(id: string) {
  const employee = await repository.findById(id);
  if (!employee) throw new Error("Employee not found");
  return employee;
}

type EmployeeAuditAction = "VIEW" | "ADD" | "EDIT" | "DELETE";

/**
 * Loads one employee for a user with this scope (S18). A malformed id, a
 * missing record and a record outside the user's branch / department / self
 * scope all return null, so callers show the same "not found" for each; the
 * out-of-scope attempt is audited.
 */
export async function getEmployeeInScope(
  id: unknown,
  scope: ScopeFilter,
  action: EmployeeAuditAction = "VIEW"
): Promise<Employee | null> {
  if (!isUuid(id)) return null;
  const employee = await repository.findById(id);
  if (!employee) return null;
  if (!employeeInScope(scope, employee)) {
    await recordAuditLog({ userId: scope.userId, action, module: "EMPLOYEES", recordId: id, result: "DENIED_SCOPE" });
    return null;
  }
  return employee;
}

// ---------------------------------------------------------------------------
// Employee <-> User (self-service login) synchronization
// ---------------------------------------------------------------------------

export interface EmployeeAccessProvisioning {
  email: string;
  tempPassword: string;
  userName?: string;
}

export interface SaveEmployeeResult {
  employee: Employee;
  provisionedAccess?: EmployeeAccessProvisioning;
  accessWarning?: string;
  /** Hire or move recorded over the approved positions (warn mode). */
  darbandiWarning?: string | null;
  /** F13: a change to bank, PAN or tax status this save recorded (waiting, or applied with it). */
  detailChange?: DetailSaveResult | null;
}

/** Who saves, for the sensitive details (F13): their scope, Employees → Approve, and the reason given. */
export interface DetailSaveContext {
  scope: ScopeFilter;
  canApprove: boolean;
  reason?: unknown;
}

export interface EmployeeAccessOptions {
  createLogin?: boolean;
  roleSlug?: string;
  roleId?: string;
}

/**
 * Who saves, for the self-service login (S44): giving a login any role but the Employee one, or
 * changing a linked login's role, needs Users & roles → Edit with a company-wide role (as in
 * Admin → Users), and never on one's own login; the email of a login with an office role follows
 * the record only with it too. S59: the same access rules as Admin → Users apply on top — no role
 * beyond the user's own permissions, administrators only by administrators.
 */
export interface LoginAccessContext {
  canManageLogins: boolean;
  actorUserId: string | null;
}

/** The self-service roles (the canonical Employee role and its legacy slug). */
export const isSelfServiceRole = (slug: string | null | undefined) => slug === EMPLOYEE_ROLE_SLUG || slug === EMPLOYEE_ROLE_SLUG_FALLBACK;

/**
 * Keeps the employee's self-service login in sync with the employee record.
 *
 * - Unlinked employee with a real email -> creates a linked user with the
 *   canonical `employee` (self-service) role and returns the temp password.
 * - Linked employee whose email changed  -> updates the linked user's email
 *   (skipped with a warning if the new email is already in use).
 * - Linked employee whose role changed   -> updates the linked user's role.
 * - No real email / already in sync      -> no-op.
 *
 * `loginEmail` is the real email from the form (companyEmail || email). It is
 * NOT read from the persisted entity because the repository writes a
 * `{id}@placeholder.com` value when no email is supplied.
 *
 * Never throws: provisioning problems are reported via `accessWarning` so the
 * employee save itself is not blocked.
 */
async function syncEmployeeUserAccess(
  employee: Employee,
  loginEmail: string,
  accessOptions: EmployeeAccessOptions | undefined,
  guard: LoginAccessContext
): Promise<{
  provisionedAccess?: EmployeeAccessProvisioning;
  accessWarning?: string;
}> {
  const email = loginEmail.trim().toLowerCase();
  let roleSlug = accessOptions?.roleSlug || EMPLOYEE_ROLE_SLUG;
  const roleId = accessOptions?.roleId;
  const warnings: string[] = [];

  const linkedUser = await findUserByEmployeeId(employee.id);

  if (linkedUser) {
    const access = await userService.getEmployeeAccess(employee.id);
    const own = !!guard.actorUserId && linkedUser.id === guard.actorUserId;
    // S44: a login with an office role (Branch HR, Payroll controller, …) is managed under Admin → Users.
    const officeLogin = !isSelfServiceRole(access?.roleSlug);

    // Linked: keep the login email in sync with the employee record.
    if (email && linkedUser.email.trim().toLowerCase() !== email) {
      const conflict = await findUserByEmail(email);
      if (conflict && conflict.id !== linkedUser.id) {
        warnings.push(`Login email not updated: ${email} is already in use by another account.`);
      } else if (officeLogin && !guard.canManageLogins) {
        warnings.push("Login email not updated: this login has an office role, so its email is changed under Admin → Users.");
      } else {
        // S59: an office login's email changes only when the user may change that login.
        const problem = officeLogin && guard.actorUserId ? await userService.loginChangeProblemFor(guard.actorUserId, linkedUser.id, "edit") : null;
        if (problem) warnings.push(`Login email not updated: ${problem}`);
        else await updateUserRepository(linkedUser.id, { email });
      }
    }

    // Role update support on existing linked user (S44: Users & roles → Edit, never one's own).
    let targetRoleId = roleId;
    if (!targetRoleId && accessOptions?.roleSlug) {
      const { findRoleBySlug } = await import("@/lib/repositories/role.repository");
      const r = await findRoleBySlug(accessOptions.roleSlug);
      if (r) targetRoleId = r.id;
    }

    if (targetRoleId && targetRoleId !== access?.roleId) {
      if (own) {
        warnings.push("Role not changed: nobody changes the role of their own login.");
        await recordAuditLog({ userId: guard.actorUserId, action: "EDIT", module: "USERS_ROLES", recordId: linkedUser.id, result: DENIED_SELF, newValues: { roleChange: true } });
      } else if (!guard.canManageLogins || !guard.actorUserId) {
        warnings.push("Role not changed: giving a login another role needs Users & roles → Edit.");
        await recordAuditLog({ userId: guard.actorUserId, action: "EDIT", module: "USERS_ROLES", recordId: linkedUser.id, result: "DENIED_PERMISSION", newValues: { roleChange: true } });
      } else {
        // S59: the Admin → Users rules, under the same lock, audited there (refusals too).
        const problem = await userService.changeLinkedLoginRole(guard.actorUserId, linkedUser.id, targetRoleId);
        if (problem) warnings.push(`Role not changed: ${problem}`);
      }
    }

    return warnings.length ? { accessWarning: warnings.join(" ") } : {};
  }

  // Unlinked: only provision when the toggle is on (or unspecified) and a real
  // email is present.
  if (accessOptions?.createLogin === false) {
    return {};
  }
  if (!email) {
    return {};
  }

  try {
    const { createSecureUserAccount } = await import("@/lib/services/user.service");
    if (roleId) {
      const { findRoleById } = await import("@/lib/repositories/role.repository");
      const r = await findRoleById(roleId);
      if (r) roleSlug = r.slug;
    }
    // S44: a new login gets the Employee role unless the user may give roles (Users & roles → Edit).
    let resolvedSlug = roleSlug;
    if (!isSelfServiceRole(resolvedSlug) && !guard.canManageLogins) {
      resolvedSlug = EMPLOYEE_ROLE_SLUG;
      warnings.push("The login was given the Employee role: another role needs Users & roles → Edit.");
    }
    // S59: and only a role within the user's own permissions (administrators by administrators).
    if (!isSelfServiceRole(resolvedSlug) && guard.actorUserId) {
      const { findRoleBySlug } = await import("@/lib/repositories/role.repository");
      const chosen = await findRoleBySlug(resolvedSlug);
      const problem = chosen ? await userService.roleGiveProblemFor(guard.actorUserId, chosen.id) : null;
      if (problem) {
        resolvedSlug = EMPLOYEE_ROLE_SLUG;
        warnings.push(`The login was given the Employee role: ${problem}`);
        await recordAuditLog({ userId: guard.actorUserId, action: "ADD", module: "USERS_ROLES", recordId: employee.id, result: "DENIED_PERMISSION", newValues: { role: chosen?.name ?? resolvedSlug } });
      }
    }

    const { user, tempPassword } = await createSecureUserAccount(
      employee.id,
      email,
      resolvedSlug,
      employee.fullName
    );

    // Dispatch credentials email (asynchronously safe, non-blocking)
    try {
      const { sendEmployeeCredentialsEmail } = await import("@/lib/services/email.service");
      await sendEmployeeCredentialsEmail({
        to: email,
        employeeName: employee.fullName,
        tempPassword,
        isReset: false,
      });
    } catch (emailErr) {
      console.warn(`[EMPLOYEE_SERVICE] Welcome email dispatch warning for ${email}:`, emailErr);
    }

    return {
      provisionedAccess: {
        email,
        tempPassword,
        userName: user.name || employee.fullName,
      },
      ...(warnings.length ? { accessWarning: warnings.join(" ") } : {}),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "UserExistsError") {
      return {
        accessWarning: `Self-service login not created: ${email} is already in use by another account.`,
      };
    }
    console.error(`Failed to generate user account for employee ${employee.id}:`, err);
    return {
      accessWarning: "Self-service login could not be created. You can create it manually from Admin → Users.",
    };
  }
}

/** Who saves an employee and what they may do (each checked by the caller from the server session). */
export interface SaveEmployeeContext {
  /** The acting user (documents, salary structure, audit). */
  userId: string;
  /** Self-service login: create one, and with which role (S44 decides what is allowed). */
  access?: EmployeeAccessOptions;
  /** Salary mapping → Edit: without it pay is never taken from the form. */
  canEditPay: boolean;
  /** F13: needed to change an existing employee's bank, PAN or tax status (else they are kept). */
  detail?: DetailSaveContext | null;
  /** S44: may give logins roles (Users & roles → Edit); never their own login's role. */
  canManageLogins: boolean;
  /** F15 import: a new employee's identity document may come without its scan (listed under records to fix). */
  withoutScans?: boolean;
}

export async function saveEmployee(id: string | null, formData: EmployeeFormData, ctx: SaveEmployeeContext): Promise<SaveEmployeeResult> {
  const accessOptions = ctx.access;
  const payAccess = { canEditPay: ctx.canEditPay, userId: ctx.userId };
  const detailAccess = ctx.detail ?? null;
  const loginAccess: LoginAccessContext = { canManageLogins: ctx.canManageLogins, actorUserId: ctx.userId };
  // 1. Validate using engine
  const [allCodes, orgBranches, orgDepartments, orgDesignations, stored] = await Promise.all([
    repository.findAllCodes(),
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    id ? repository.findById(id) : Promise.resolve(null),
  ]);
  // Documents (4.2b): cleaned, and a row counts as saved before only when its id is one of this
  // employee's documents with the same type (new rows need their issued date and scan).
  const storedDocs = stored?.documents ?? [];
  formData = {
    ...formData,
    documents: normalizeDocuments(formData.documents).map((d) => (d.id && storedDocs.some((s) => s.id === d.id && s.type === d.type) ? d : { ...d, id: undefined })),
    dossier: normalizeDossier(formData.dossier),
  };
  const errors = {
    ...engine.validateEmployee(formData, { scanRequired: !(ctx.withoutScans && !id) }),
    ...validateDossier(formData.dossier, { today: nepalDateIso(), joiningDate: formData.joiningDate }),
    // Codes are unique company-wide; say so on the field instead of failing on the constraint.
    ...engine.codeConflicts(allCodes, formData, id),
    // Placement (4.3): active records only (unless unchanged), and a department open to the branch.
    ...placementErrors(formData, stored ?? null, { branches: orgBranches, departments: orgDepartments, designations: orgDesignations }),
  };
  if (Object.keys(errors).length > 0) {
    throw new EmployeeValidationError(errors);
  }

  // Status changes only through setEmployeeStatus (login switched off with it);
  // new employees always start Active.
  const current = stored ?? null;
  if (current) formData = { ...formData, status: current.status };
  else if (!id) formData = { ...formData, status: "Active" };

  // Sensitive details (F13, S43): an existing employee's bank account, PAN and tax status change
  // only as a recorded change — applied with this save, or kept as they are until a second person
  // approves it. Without the context they are simply kept.
  let detailPlan: DetailPlan | null = null;
  if (current) {
    if (detailAccess) {
      const planned = await detailService.planSave(current.id, current, formData, detailAccess.reason, {
        scope: detailAccess.scope,
        userId: payAccess.userId ?? detailAccess.scope.userId,
        canApprove: detailAccess.canApprove,
      });
      if (!planned.ok) throw new EmployeeValidationError(planned.errors);
      detailPlan = planned.plan;
    }
    const keep = detailPlan?.values ?? detailValues(current);
    formData = {
      ...formData,
      bankName: keep.bankName,
      bankBranch: keep.bankBranch,
      bankAccountNumber: keep.bankAccountNumber,
      panNumber: keep.panNumber,
      taxStatus: keep.taxStatus as EmployeeFormData["taxStatus"],
      isDisabled: keep.isDisabled,
    };
  }

  // Pay (S18): worked out here from the grade policy and the user's Salary mapping
  // permission; the grade amount the browser sent is used only when typed by hand.
  const [settings, levels] = await Promise.all([
    systemControlRepository.findSettings(),
    payAccess.canEditPay || current ? Promise.resolve([]) : shreniRepository.findAllShreniLevels(),
  ]);
  const storedPay = current
    ? {
        basicSalary: Number(current.basicSalary) || 0,
        gradeCount: current.gradeCount ?? 0,
        gradeAmount: Number(current.gradeAmount) || 0,
        gradeManual: !!current.gradeManual,
      }
    : null;
  const pay = resolvePay({
    submitted: {
      basicSalary: Number(formData.basicSalary) || 0,
      gradeCount: Number(formData.gradeCount) || 0,
      gradeAmount: Number(formData.gradeAmount) || 0,
      gradeManual: !!formData.gradeManual,
    },
    stored: storedPay,
    policy: settings.gradePolicy,
    // Existing employees: pay changes go through Salary structure (dated revisions), never this form.
    canEditPay: payAccess.canEditPay && !current,
    levelStartingSalary: levels.find((l) => l.code === formData.shreni || l.name === formData.shreni)?.minSalary,
  });
  formData = { ...formData, ...pay };

  // 2. Transform FormData (strings) -> Employee Entity (Dates)
  const employeeData: Partial<Employee> = {
    attendanceCode: formData.attendanceCode,
    employeeCode: formData.employeeCode,
    fullName: formData.fullName,
    gender: formData.gender,
    dateOfBirth: new Date(formData.dateOfBirth),
    taxStatus: formData.taxStatus,
    isDisabled: formData.isDisabled,
    category: formData.category,
    shreni: formData.shreni,
    departmentId: formData.departmentId,
    designationId: formData.designationId,
    branchId: formData.branchId,
    supervisorId: formData.supervisorId || null,
    isSupervisor: !!formData.isSupervisor,
    joiningDate: new Date(formData.joiningDate),
    confirmationDate: formData.confirmationDate ? new Date(formData.confirmationDate) : null,
    status: formData.status,
    basicSalary: formData.basicSalary ? Number(formData.basicSalary) : 0,
    gradePercent: formData.gradePercent,
    gradeCount: formData.gradeCount ?? 0,
    gradeAmount: formData.gradeAmount,
    gradeManual: formData.gradeManual,
    // The old columns mirror the documents list for older readers (until Phase 8).
    ...legacyDocumentColumns(formData.documents),
    panNumber: formData.panNumber || null,
    ssfNumber: formData.ssfNumber?.trim() || null,
    pfNumber: formData.pfNumber?.trim() || null,
    citNumber: formData.citNumber?.trim() || null,
    phoneHome: toE164Phone(formData.phoneHome) || null,
    mobileNo: toE164Phone(formData.mobileNo),
    email: formData.companyEmail || formData.email,
    companyEmail: formData.companyEmail || formData.email,
    personalEmail: formData.personalEmail || null,
    permanentAddress: formData.permanentAddress || formData.address1 || '',
    temporaryAddress: formData.temporaryAddress || formData.address2 || null,
    address1: formData.permanentAddress || formData.address1 || '',
    address2: formData.temporaryAddress || formData.address2 || null,
    fatherName: formData.fatherName || null,
    motherName: formData.motherName || null,
    spouseName: formData.spouseName || null,
    grandfatherName: formData.grandfatherName || null,
    bankName: formData.bankName,
    bankBranch: formData.bankBranch,
    bankAccountNumber: formData.bankAccountNumber,
    informedDate: formData.informedDate ? new Date(formData.informedDate) : null,
    terminationDate: formData.terminationDate ? new Date(formData.terminationDate) : null,
    terminationType: formData.terminationType || null,
    terminationReason: formData.terminationReason || null,
    terminationPlan: formData.terminationPlan || null,
    terminationRemarks: formData.terminationRemarks || null,
  };

  // Darbandi (G4): a hire, or an edit that moves the person to another designation × branch,
  // is checked against the approved positions — warn or block per company setting.
  const darbandiWarning = await checkPlacement({
    designationId: formData.designationId,
    branchId: formData.branchId,
    current: id ? await repository.findById(id).then((e) => (e ? { designationId: e.designationId, branchId: e.branchId } : null)) : null,
  });

  // 3. Persist via repository (documents and their scans in the same transaction)
  if (!payAccess.userId) throw new Error("saveEmployee needs the acting user for the documents");
  const documents = { rows: formData.documents, dossier: formData.dossier, photoId: isUuid(formData.photoId) ? formData.photoId : "", userId: payAccess.userId };
  if (id) {
    let saved: Awaited<ReturnType<typeof repository.updateWithDetailChange>>;
    try {
      saved = await repository.updateWithDetailChange(id, employeeData, documents, detailPlan?.change ? { change: detailPlan.change, refreshBank: detailPlan.refreshBank } : null);
    } catch (error) {
      // Someone recorded a change for this employee a moment ago (one waiting change per employee).
      if (detailService.isOnePendingViolation(error) && detailPlan?.change) {
        throw new EmployeeValidationError(Object.fromEntries(Object.keys(detailPlan.change.after).map((f) => [f, detailService.WAITING_MESSAGE])));
      }
      throw error;
    }
    const updated = saved.employee;
    const detailChange: DetailSaveResult | null =
      detailPlan?.change && saved.detailChangeId
        ? {
            id: saved.detailChangeId,
            fields: Object.keys(detailPlan.change.after),
            summary: detailPlan.summary,
            status: detailPlan.change.appliedRoute ? "approved" : "pending",
            route: detailPlan.change.appliedRoute,
            draftSlips: saved.draftSlips,
          }
        : null;

    // =======================================================================
    // EMPLOYEE-USER SYNC ON UPDATE
    // Provision a self-service login for previously-unlinked employees that
    // now have an email, and keep linked logins' email in sync.
    // =======================================================================
    const syncResult = await syncEmployeeUserAccess(
      updated,
      formData.companyEmail || formData.email || "",
      accessOptions,
      loginAccess
    );

    return { employee: updated, ...syncResult, darbandiWarning, detailChange };
  } else {
    const employee = await repository.create(employeeData, documents);
    
    // =======================================================================
    // EMPLOYEE-USER SYNC (STAGE A ARCHITECTURE)
    // Automatically generate a self-service login account for new employees
    // =======================================================================
    const syncResult = await syncEmployeeUserAccess(
      employee,
      formData.companyEmail || formData.email || "",
      accessOptions,
      loginAccess
    );

    // Leave on hire (4.6b): yearly credits (sick 12, company types), pro-rata from joining, in
    // the leave year; home leave is earned at month close and substitute leave granted.
    try {
      await creditOnJoining({ id: employee.id, gender: employee.gender, departmentId: employee.departmentId, designationId: employee.designationId, joiningDate: employee.joiningDate ? String(employee.joiningDate).slice(0, 10) : null });
    } catch (err) {
      console.error(`Failed to credit leave for employee ${employee.id}:`, err);
      // Non-blocking: HR can adjust the balance.
    }

    // =======================================================================
    // STARTING SALARY (4.4): the first salary revision, approved at once and
    // effective from the joining date, through Salary structure (one owner for pay).
    // =======================================================================
    if ((Number(employeeData.basicSalary) || 0) > 0) {
      try {
        await salaryStructureService.createStartingStructure({
          employeeId: employee.id,
          joiningDate: formData.joiningDate,
          basic: Number(employeeData.basicSalary) || 0,
          gradeCount: employeeData.gradeCount ?? 0,
          gradeAmount: Number(employeeData.gradeAmount) || 0,
          gradeManual: !!employeeData.gradeManual,
          userId: payAccess.userId ?? null,
        });
      } catch (err) {
        console.error(`Failed to create the starting salary for employee ${employee.id}:`, err);
        // Non-blocking: it can be added in Salary structure.
      }
    }
    
    return { employee, ...syncResult, darbandiWarning };
  }
}

export interface EmployeeSeparationInput {
  terminationDate: string;
  terminationType: string;
  terminationReason: string;
  terminationPlan?: string;
  informedDate?: string;
  terminationRemarks?: string;
}

/**
 * Makes an employee Inactive (with the separation details the rules require)
 * or Active again. Validation reuses the form rules, so the same dates and
 * reasons are enforced everywhere.
 */
export async function setEmployeeStatus(
  employee: Employee,
  status: "Active" | "Inactive",
  separation: EmployeeSeparationInput | null
): Promise<void> {
  if (status === "Inactive") {
    const data = {
      ...employeeToForm(employee),
      status: "Inactive" as const,
      terminationDate: separation?.terminationDate ?? "",
      terminationType: (separation?.terminationType ?? "") as EmployeeFormData["terminationType"],
      terminationReason: (separation?.terminationReason ?? "").trim().slice(0, 500),
      terminationPlan: (separation?.terminationPlan ?? "") as EmployeeFormData["terminationPlan"],
      informedDate: separation?.informedDate ?? "",
      terminationRemarks: (separation?.terminationRemarks ?? "").trim().slice(0, 1000),
    };
    const errors = engine.separationErrors(data);
    if (Object.keys(errors).length > 0) throw new EmployeeValidationError(errors);
    await repository.setStatus(employee.id, "Inactive", {
      informedDate: data.informedDate || null,
      terminationDate: data.terminationDate,
      type: data.terminationType,
      plan: data.terminationPlan || null,
      reason: data.terminationReason,
      remarks: data.terminationRemarks || null,
    });
  } else {
    await repository.setStatus(employee.id, "Active", null);
  }
}

// ---------------------------------------------------------------------------
// Full-page form (4.2)
// ---------------------------------------------------------------------------

function toDateValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const EMPTY_EMPLOYEE_FORM: EmployeeFormData = {
  attendanceCode: "", employeeCode: "", fullName: "", gender: "Male", dateOfBirth: "", taxStatus: "Normal Single", isDisabled: false,
  category: "Permanent", shreni: "", departmentId: "", designationId: "", branchId: "", isSupervisor: false, supervisorId: "",
  joiningDate: "", confirmationDate: "", status: "Active", basicSalary: 0, gradePercent: 0, gradeCount: 0, gradeAmount: 0, gradeManual: false,
  documents: [], dossier: { qualifications: [], workHistory: [], attachments: [] }, photoId: "", panNumber: "", ssfNumber: "", pfNumber: "", citNumber: "", phoneHome: "", mobileNo: "", email: "", companyEmail: "",
  personalEmail: "", permanentAddress: "", temporaryAddress: "", fatherName: "", motherName: "", spouseName: "",
  grandfatherName: "", bankName: "", bankBranch: "", bankAccountNumber: "", informedDate: "", terminationDate: "",
  terminationType: "", terminationReason: "", terminationPlan: "", terminationRemarks: "",
};

export function employeeToForm(emp: Employee): EmployeeFormData {
  return {
    ...EMPTY_EMPLOYEE_FORM,
    attendanceCode: emp.attendanceCode,
    employeeCode: emp.employeeCode,
    fullName: emp.fullName,
    gender: emp.gender,
    dateOfBirth: toDateValue(emp.dateOfBirth),
    taxStatus: emp.taxStatus,
    isDisabled: emp.isDisabled,
    category: emp.category,
    shreni: emp.shreni,
    departmentId: emp.departmentId,
    designationId: emp.designationId,
    branchId: emp.branchId,
    isSupervisor: !!emp.isSupervisor,
    supervisorId: emp.supervisorId || "",
    joiningDate: toDateValue(emp.joiningDate),
    confirmationDate: toDateValue(emp.confirmationDate),
    status: emp.status,
    basicSalary: emp.basicSalary ?? 0,
    gradePercent: emp.gradePercent,
    gradeCount: emp.gradeCount ?? 0,
    gradeAmount: emp.gradeAmount,
    gradeManual: !!emp.gradeManual,
    documents: (emp.documents ?? []).map((d) => ({ id: d.id, type: d.type, number: d.number, district: d.district, office: d.office, issuedDate: d.issuedDate ?? "", file: d.file })),
    dossier: emp.dossier ?? { qualifications: [], workHistory: [], attachments: [] },
    photoId: emp.photoId ?? "",
    panNumber: emp.panNumber || "",
    ssfNumber: emp.ssfNumber || "",
    pfNumber: emp.pfNumber || "",
    citNumber: emp.citNumber || "",
    phoneHome: emp.phoneHome || "",
    mobileNo: emp.mobileNo,
    email: emp.companyEmail || emp.email || "",
    companyEmail: emp.companyEmail || emp.email || "",
    personalEmail: emp.personalEmail || "",
    permanentAddress: emp.permanentAddress || "",
    temporaryAddress: emp.temporaryAddress || "",
    fatherName: emp.fatherName || "",
    motherName: emp.motherName || "",
    spouseName: emp.spouseName || "",
    grandfatherName: emp.grandfatherName || "",
    bankName: emp.bankName,
    bankBranch: emp.bankBranch,
    bankAccountNumber: emp.bankAccountNumber,
    informedDate: toDateValue(emp.informedDate),
    terminationDate: toDateValue(emp.terminationDate),
    terminationType: emp.terminationType || "",
    terminationReason: emp.terminationReason || "",
    terminationPlan: emp.terminationPlan || "",
    terminationRemarks: emp.terminationRemarks || "",
  };
}

/**
 * Everything the full-page form needs (4.2). Branch and department choices are
 * limited to the user's scope (the save re-checks, S18). Codes for the whole
 * company are included (codes only) so suggestions and duplicate hints are
 * right for branch-scoped users too.
 */
export async function getEmployeeFormContext(
  scope: ScopeFilter,
  employee: Employee | null,
  /** Salary mapping → Edit (the save checks it again). */
  canEditPay = false,
  /** Employees → Approve: decides what saving a change to bank, PAN or tax status does (F13). */
  canApproveDetails = false,
  /** Users & roles → Edit: may give a login another role (S44). */
  canManageLogins = false
): Promise<EmployeeFormContext> {
  const noDetails: DetailFormInfo = { pending: null, onSave: "wait" };
  const [lookups, codes, employmentTypes, allRoles, access, details] = await Promise.all([
    getEmployeeLookupData(scope),
    repository.findAllCodes(),
    findAllEmploymentTypes().catch(() => []),
    roleService.getAllRoles(),
    employee ? userService.getEmployeeAccess(employee.id) : Promise.resolve(null),
    employee ? detailService.formInfo(employee.id, { scope, userId: scope.userId, canApprove: canApproveDetails, canEdit: true }) : Promise.resolve(noDetails),
  ]);
  // S59: the roles offered are the ones the user may give (plus the login's current role).
  const managing = canManageLogins && !scope.isImpersonation;
  const roles = managing ? await userService.rolesWithinReach(scope.userId, access?.roleId) : allRoles;
  const loginOutOfReach = managing && access && access.userId !== scope.userId ? await userService.loginChangeProblemFor(scope.userId, access.userId, "role") : null;

  // GLOBAL users see everything; BRANCH / DEPARTMENT users only what they can place into (plus the current value).
  // Inactive organization records are not offered for new choices (4.3), except the record's current value.
  const activeBranches = pickable(lookups.branches, employee?.branchId);
  const activeDepartments = pickable(lookups.departments, employee?.departmentId);
  const branches = (
    scope.scopeType === "GLOBAL" || scope.scopeType === "DEPARTMENT"
      ? activeBranches
      : activeBranches.filter((b) => b.id === employee?.branchId || scope.branchIds.includes(b.id))
  ).map((b) => ({ id: b.id, name: b.name }));
  const departments = (
    scope.scopeType === "GLOBAL" || scope.scopeType === "BRANCH"
      ? activeDepartments
      : activeDepartments.filter((d) => d.id === employee?.departmentId || scope.departmentIds.includes(d.id))
  ).map((d) => ({ id: d.id, name: d.name, branchIds: d.branchIds }));

  const initial: EmployeeFormData = employee
    ? employeeToForm(employee)
    : {
        ...EMPTY_EMPLOYEE_FORM,
        employeeCode: engine.getNextEmployeeCode(codes.map((c) => c.employeeCode)),
        attendanceCode: engine.getNextAttendanceCode(codes.map((c) => c.attendanceCode), "ATD-"),
        branchId: branches.length === 1 ? branches[0].id : "",
        departmentId: departments.length === 1 ? departments[0].id : "",
      };

  const categories = employmentTypes.length
    ? employmentTypes.filter((t) => t.isActive || t.name === employee?.category).map((t) => ({ value: t.name, label: t.name }))
    : EMPLOYEE_CATEGORIES.map((c) => ({ value: c as string, label: c === "OutSource" ? "Outsourced" : c }));
  if (initial.category && !categories.some((c) => c.value === initial.category)) {
    categories.unshift({ value: initial.category, label: initial.category });
  }

  return {
    employeeId: employee?.id ?? null,
    initial,
    branches,
    departments,
    designations: pickable(lookups.designations, employee?.designationId).map((d) => ({ id: d.id, name: d.name, departmentId: d.departmentId })),
    categories,
    shreniLevels: (lookups.shreniLevels ?? [])
      .filter((l) => l.isActive !== false || l.code === employee?.shreni || l.name === employee?.shreni)
      .map((l) => ({ code: l.code, name: l.name, labelNepali: l.labelNepali, minSalary: l.minSalary })),
    gradePolicy: lookups.gradePolicy ?? null,
    canEditPay,
    supervisors: lookups.employees
      .filter((e) => e.isSupervisor && e.id !== employee?.id)
      .map((e) => ({ id: e.id, name: e.name, employeeCode: e.employeeCode })),
    codes,
    roles: roles.map((r) => ({ id: r.id, name: r.name, slug: r.slug })),
    roleChoiceReason: loginOutOfReach,
    access: access
      ? {
          email: access.email,
          roleId: access.roleId ?? null,
          roleName: access.roleName ?? null,
          state: !access.isActive ? "disabled" : access.mustChangePassword ? "pending" : "active",
        }
      : null,
    // S44: another role only with Users & roles → Edit (company-wide), and never on one's own login;
    // S59: nor on a login whose role is beyond the user's own permissions.
    roleChoice: !canManageLogins || scope.isImpersonation ? "employee_only" : access && access.userId === scope.userId ? "own_login" : loginOutOfReach ? "out_of_reach" : "any",
    details,
  };
}


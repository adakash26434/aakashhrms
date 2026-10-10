'use server';

import { ensureTenantContext } from '@/lib/db';
import * as empService from '@/lib/services/employee.service';
import * as userService from '@/lib/services/user.service';
import * as roleService from '@/lib/services/role.service';
import { revalidatePath } from 'next/cache';
import type { EmployeeFormData, EmployeeValidationErrors } from '@/lib/types/employee';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { canPlaceInScope, changedEmployeeFields } from '@/lib/engines/employee.engine';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';

// Security plan S18: every employee action resolves the caller's scope. A
// record outside it reads as "not found" (and the attempt is audited); new or
// moved employees must land inside it; every change is audited by field name.
const NOT_FOUND = 'Employee not found.';
const OUTSIDE_SCOPE = 'You can only place employees in a branch or department you manage.';

export type SaveEmployeeActionResult =
  | { success: true; data: empService.SaveEmployeeResult }
  | { success: false; error: string; ref?: string; validationErrors?: EmployeeValidationErrors };

export async function saveEmployeeAction(
  id: string | null,
  formData: EmployeeFormData,
  accessOptions?: empService.EmployeeAccessOptions,
  /** F13: why the bank, PAN or tax status changes (shown to the approver). */
  detail?: { reason?: string }
): Promise<SaveEmployeeActionResult> {
  await ensureTenantContext();
  try {
    const action = id ? 'EDIT' : 'ADD';
    const scope = await checkPermissionWithScope(action, 'EMPLOYEES');
    const before = id ? await empService.getEmployeeInScope(id, scope, 'EDIT') : null;
    if (id && !before) throw new UserFacingError(NOT_FOUND);

    if (!canPlaceInScope(scope, { branchId: formData?.branchId, departmentId: formData?.departmentId })) {
      await recordAuditLog({
        userId: scope.userId,
        action,
        module: 'EMPLOYEES',
        recordId: id,
        result: 'DENIED_SCOPE',
        newValues: { branchId: formData?.branchId ?? null, departmentId: formData?.departmentId ?? null },
      });
      throw new UserFacingError(OUTSIDE_SCOPE);
    }

    // Pay fields need Salary mapping → Edit as well (S18); without it they are kept / defaulted.
    // Bank, PAN and tax status (F13): Employees → Approve decides whether a change applies now.
    const [canEditPay, canApproveDetails] = await Promise.all([hasPermission('EDIT', 'SALARY_MAPPING'), hasPermission('APPROVE', 'EMPLOYEES')]);
    const result = await empService.saveEmployee(id, formData, accessOptions, { canEditPay, userId: scope.userId }, { scope, canApprove: canApproveDetails, reason: detail?.reason });
    const saved = result.employee;
    await recordAuditLog({
      userId: scope.userId,
      action,
      module: 'EMPLOYEES',
      recordId: saved.id,
      result: 'SUCCESS',
      newValues: before
        ? {
            // Pay and the sensitive details as saved (kept, recalculated or waiting), not as sent.
            changedFields: changedEmployeeFields(before, {
              ...formData,
              basicSalary: saved.basicSalary,
              gradeCount: saved.gradeCount,
              gradeAmount: saved.gradeAmount,
              gradeManual: saved.gradeManual,
              bankName: saved.bankName,
              bankBranch: saved.bankBranch,
              bankAccountNumber: saved.bankAccountNumber,
              panNumber: saved.panNumber ?? '',
              taxStatus: saved.taxStatus,
              isDisabled: saved.isDisabled,
            }),
            // Field names only, never values (S18).
            ...(result.detailChange
              ? { detailChange: { id: result.detailChange.id, status: result.detailChange.status, route: result.detailChange.route, fields: result.detailChange.fields } }
              : {}),
          }
        : {
            employeeCode: result.employee.employeeCode,
            branchId: result.employee.branchId,
            departmentId: result.employee.departmentId,
            loginCreated: !!result.provisionedAccess,
          },
    });
    revalidatePath('/workforce/employees');
    revalidatePath('/dashboard');
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (error instanceof empService.EmployeeValidationError) {
      return { success: false as const, error: 'Some fields need attention.', validationErrors: error.errors };
    }
    return toActionError(error, 'employee.save');
  }
}

/**
 * Employees are never deleted (4.2). Leaving is recorded here: Inactive with
 * separation details, which also switches the self-service login off;
 * Active again switches it back on. Needs EDIT, the employee in scope, and
 * not the user's own record.
 */
export async function setEmployeeStatusAction(
  id: string,
  status: 'Active' | 'Inactive',
  separation?: empService.EmployeeSeparationInput
): Promise<{ success: true } | { success: false; error: string; ref?: string; validationErrors?: EmployeeValidationErrors }> {
  await ensureTenantContext();
  try {
    if (status !== 'Active' && status !== 'Inactive') throw new UserFacingError('That is not a valid status.');
    const scope = await checkPermissionWithScope('EDIT', 'EMPLOYEES');
    const employee = await empService.getEmployeeInScope(id, scope, 'EDIT');
    if (!employee) throw new UserFacingError(NOT_FOUND);
    if (scope.employeeId && scope.employeeId === employee.id) {
      await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: employee.id, result: 'DENIED_SELF', newValues: { status } });
      throw new UserFacingError("You can't change your own employment status. Ask another administrator.");
    }
    if (employee.status === status) throw new UserFacingError(`This employee is already ${status.toLowerCase()}.`);

    await empService.setEmployeeStatus(employee, status, separation ?? null);
    await recordAuditLog({
      userId: scope.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: employee.id,
      result: 'SUCCESS',
      oldValues: { status: employee.status, terminationDate: employee.terminationDate ?? null, terminationType: employee.terminationType ?? null },
      newValues: { status, terminationDate: separation?.terminationDate ?? null, terminationType: separation?.terminationType ?? null, loginActive: status === 'Active' },
    });
    revalidatePath('/workforce/employees');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof empService.EmployeeValidationError) {
      return { success: false, error: 'Some fields need attention.', validationErrors: error.errors };
    }
    return toActionError(error, 'employee.setStatus');
  }
}

export async function getEmployeeLookupDataAction() {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    const data = await empService.getEmployeeLookupData(scope);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'employee.lookups');
  }
}

export async function getEmployeeByIdAction(id: string) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    const data = await empService.getEmployeeInScope(id, scope);
    if (!data) throw new UserFacingError(NOT_FOUND);
    return { success: true as const, data };
  } catch (error: unknown) {
    return toActionError(error, 'employee.getById');
  }
}

/**
 * Returns the self-service login linked to an employee (if any) plus the full
 * role list, so the employee form's Access section can render the linked-user
 * card and the role dropdown in a single round trip.
 */
export async function getEmployeeAccessAction(employeeId: string | null) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    if (employeeId && !(await empService.getEmployeeInScope(employeeId, scope))) {
      throw new UserFacingError(NOT_FOUND);
    }
    const [access, roles] = await Promise.all([
      employeeId ? userService.getEmployeeAccess(employeeId) : Promise.resolve(null),
      roleService.getAllRoles(),
    ]);
    return { success: true as const, data: { access, roles } };
  } catch (error: unknown) {
    return toActionError(error, 'employee.getAccess');
  }
}

/**
 * Re-sends onboarding credentials while the account is pending first login.
 * SECURITY (S2): temporary passwords are never stored, so a resend issues a
 * fresh temporary password (the previous one stops working), emails it, and
 * returns it once for HR to hand over.
 */
export async function resendEmployeeCredentialsAction(employeeId: string) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('EDIT', 'EMPLOYEES');
    const employee = await empService.getEmployeeInScope(employeeId, scope, 'EDIT');
    if (!employee) throw new UserFacingError(NOT_FOUND);

    const access = await userService.getEmployeeAccess(employeeId);
    if (!access) {
      throw new UserFacingError('No self-service account is linked to this employee.');
    }

    if (!access.mustChangePassword) {
      throw new UserFacingError('The employee has already set a permanent password. Use "Reset Password" in Admin → Users to issue a new temporary credential.');
    }

    const resetResult = await userService.resetUserPassword(access.userId);

    const { sendEmployeeCredentialsEmail } = await import('@/lib/services/email.service');
    const emailResult = await sendEmployeeCredentialsEmail({
      to: access.email,
      employeeName: employee.fullName,
      tempPassword: resetResult.tempPassword,
      isReset: false,
    });

    await recordAuditLog({
      userId: scope.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: employee.id,
      result: 'SUCCESS',
      newValues: { credentials: 'resent', deliveredVia: emailResult.deliveredVia },
    });
    return {
      success: true as const,
      email: access.email,
      tempPassword: resetResult.tempPassword,
      deliveredVia: emailResult.deliveredVia,
    };
  } catch (error: unknown) {
    return toActionError(error, 'employee.resendCredentials');
  }
}

/**
 * Generates a fresh temporary password for the employee's user account, requires password change
 * on next login, sends the credential email, and returns the temporary password to display to HR.
 */
export async function resetEmployeePasswordAction(employeeId: string) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('EDIT', 'EMPLOYEES');
    const employee = await empService.getEmployeeInScope(employeeId, scope, 'EDIT');
    if (!employee) throw new UserFacingError(NOT_FOUND);

    const access = await userService.getEmployeeAccess(employeeId);
    if (!access) {
      throw new UserFacingError('No self-service account is linked to this employee.');
    }

    // Reset password in user service
    const resetResult = await userService.resetUserPassword(access.userId);

    // Send new credentials email
    const { sendEmployeeCredentialsEmail } = await import('@/lib/services/email.service');
    const emailResult = await sendEmployeeCredentialsEmail({
      to: access.email,
      employeeName: employee.fullName,
      tempPassword: resetResult.tempPassword,
      isReset: true,
    });

    await recordAuditLog({
      userId: scope.userId,
      action: 'EDIT',
      module: 'EMPLOYEES',
      recordId: employee.id,
      result: 'SUCCESS',
      newValues: { credentials: 'reset', deliveredVia: emailResult.deliveredVia },
    });
    revalidatePath('/workforce/employees');
    return {
      success: true as const,
      email: access.email,
      tempPassword: resetResult.tempPassword,
      deliveredVia: emailResult.deliveredVia,
    };
  } catch (error: unknown) {
    return toActionError(error, 'employee.resetPassword');
  }
}
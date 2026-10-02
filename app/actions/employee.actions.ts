'use server';

import { ensureTenantContext } from '@/lib/db';
import * as empService from '@/lib/services/employee.service';
import * as userService from '@/lib/services/user.service';
import * as roleService from '@/lib/services/role.service';
import { revalidatePath } from 'next/cache';
import type { EmployeeFormData, EmployeeFilter } from '@/lib/types/employee';
import { checkPermission, checkPermissionWithScope } from '@/lib/auth/check-permission';

export async function saveEmployeeAction(
  id: string | null,
  formData: EmployeeFormData,
  accessOptions?: empService.EmployeeAccessOptions
) {
  await ensureTenantContext();
  try {
    if (id) {
      await checkPermission('EDIT', 'EMPLOYEES');
    } else {
      await checkPermission('ADD', 'EMPLOYEES');
    }
    const result = await empService.saveEmployee(id, formData, accessOptions);
    revalidatePath('/workforce/employees');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'EmployeeValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteEmployeeAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'EMPLOYEES');
    await empService.deleteEmployee(id);
    revalidatePath('/workforce/employees');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'EmployeeInUseError') {
        return { success: false, error: error.message };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getEmployeesAction(filter: EmployeeFilter) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    const data = await empService.getEmployees(filter, scope);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function getEmployeeLookupDataAction() {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    const data = await empService.getEmployeeLookupData(scope);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function getEmployeeByIdAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'EMPLOYEES');
    const data = await empService.getEmployeeById(id);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
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
    await checkPermission('VIEW', 'EMPLOYEES');
    const [access, roles] = await Promise.all([
      employeeId ? userService.getEmployeeAccess(employeeId) : Promise.resolve(null),
      roleService.getAllRoles(),
    ]);
    return { success: true, data: { access, roles } };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
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
    await checkPermission('EDIT', 'EMPLOYEES');
    const employee = await empService.getEmployeeById(employeeId);
    if (!employee) {
      return { success: false, error: 'Employee not found.' };
    }

    const access = await userService.getEmployeeAccess(employeeId);
    if (!access) {
      return { success: false, error: 'No self-service account is linked to this employee.' };
    }

    if (!access.mustChangePassword) {
      return {
        success: false,
        error: 'The employee has already set a permanent password. Use "Reset Password" in Admin → Users to issue a new temporary credential.',
      };
    }

    const resetResult = await userService.resetUserPassword(access.userId);

    const { sendEmployeeCredentialsEmail } = await import('@/lib/services/email.service');
    const emailResult = await sendEmployeeCredentialsEmail({
      to: access.email,
      employeeName: employee.fullName,
      tempPassword: resetResult.tempPassword,
      isReset: false,
    });

    return {
      success: true,
      email: access.email,
      tempPassword: resetResult.tempPassword,
      deliveredVia: emailResult.deliveredVia,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to resend credentials.';
    return { success: false, error: msg };
  }
}

/**
 * Generates a fresh temporary password for the employee's user account, requires password change
 * on next login, sends the credential email, and returns the temporary password to display to HR.
 */
export async function resetEmployeePasswordAction(employeeId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'EMPLOYEES');
    const employee = await empService.getEmployeeById(employeeId);
    if (!employee) {
      return { success: false, error: 'Employee not found.' };
    }

    const access = await userService.getEmployeeAccess(employeeId);
    if (!access) {
      return { success: false, error: 'No self-service account is linked to this employee.' };
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

    revalidatePath('/workforce/employees');
    return {
      success: true,
      email: access.email,
      tempPassword: resetResult.tempPassword,
      deliveredVia: emailResult.deliveredVia,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to reset employee password.';
    return { success: false, error: msg };
  }
}
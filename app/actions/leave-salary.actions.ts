'use server';

import { ensureTenantContext } from '@/lib/db';
import * as service from "@/lib/services/leave-salary.service";
import { checkPermission } from "@/lib/auth/check-permission";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { LeaveSalarySetupPayload, PaymentMethod, EncashmentType } from "@/lib/types/payroll";

export async function getLeaveSalaryHistoryAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LEAVE_SALARY');
    const data = await service.getLeaveSalaryHistory();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function getUserLeaveSalaryPermissionsAction() {
  await ensureTenantContext();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { canView: false, canAdd: false, canEdit: false, canDelete: false, canApprove: false };
    }

    // Check each permission via the established checkPermission pattern
    // These catch individually so partial permissions still work
    const results = await Promise.allSettled([
      checkPermission('VIEW', 'LEAVE_SALARY'),
      checkPermission('ADD', 'LEAVE_SALARY'),
      checkPermission('EDIT', 'LEAVE_SALARY'),
      checkPermission('DELETE', 'LEAVE_SALARY'),
      checkPermission('APPROVE', 'LEAVE_SALARY'),
    ]);

    return {
      canView: results[0].status === 'fulfilled',
      canAdd: results[1].status === 'fulfilled',
      canEdit: results[2].status === 'fulfilled',
      canDelete: results[3].status === 'fulfilled',
      canApprove: results[4].status === 'fulfilled',
    };
  } catch {
    // P0 SECURITY FIX: Fail CLOSED — deny all access on unexpected errors.
    // Previous implementation returned all-true on error, granting full access.
    return { canView: false, canAdd: false, canEdit: false, canDelete: false, canApprove: false };
  }
}

export async function createLeaveSalaryAction(payload: LeaveSalarySetupPayload) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'LEAVE_SALARY');
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    const result = await service.createLeaveSalary(payload, session.user.id);
    revalidatePath('/payroll/leave-salary');
    return { success: true, data: result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function updateLeaveSalaryDraftAction(
  id: string,
  payload: {
    leaveDays: number;
    paymentPeriod: string;
    paymentMethod: PaymentMethod;
    encashmentType: EncashmentType;
  }
) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'LEAVE_SALARY');
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    const result = await service.updateLeaveSalaryDraft(id, payload, session.user.id);
    revalidatePath('/payroll/leave-salary');
    return { success: true, data: result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

// BUG-1 FIX: Changed from 'ADD' to 'APPROVE' — separation of duties
export async function payLeaveSalaryAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('APPROVE', 'LEAVE_SALARY');
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    const result = await service.payLeaveSalary(id, session.user.id);
    revalidatePath('/payroll/leave-salary');
    return { success: true, data: result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

// FEAT-3: Delete draft leave salary records
export async function deleteLeaveSalaryAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'LEAVE_SALARY');
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    await service.deleteLeaveSalaryDraft(id, session.user.id);
    revalidatePath('/payroll/leave-salary');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

// FEAT-1: Get employee leave balance for encashment preview
export async function getEmployeeLeaveBalanceForEncashmentAction(
  employeeId: string,
  leaveTypeId: string
) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LEAVE_SALARY');
    const data = await service.getEmployeeLeaveBalanceForEncashment(employeeId, leaveTypeId);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

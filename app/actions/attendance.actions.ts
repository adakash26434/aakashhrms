'use server';

import { ensureTenantContext } from '@/lib/db';
import * as service from '@/lib/services/attendance.service';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/lib/auth/check-permission';
import type { AttendanceFormData, AttendanceBulkItem, AttendanceFilter } from '@/lib/types/attendance';

export async function getAttendanceDataAction(filter: AttendanceFilter) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'ATTENDANCE');
    const data = await service.getAttendanceData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch attendance data.' };
  }
}

export async function saveAttendancePunchAction(id: string | null, formData: AttendanceFormData) {
  await ensureTenantContext();
  try {
    if (id) {
      await checkPermission('EDIT', 'ATTENDANCE');
    } else {
      await checkPermission('ADD', 'ATTENDANCE');
    }
    const result = await service.saveAttendancePunch(id, formData);
    revalidatePath('/timeAndLeave/attendance');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save attendance punch.' };
  }
}

export async function bulkPostAttendanceAction(date: string, items: AttendanceBulkItem[], fiscalYearId?: string) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'ATTENDANCE');
    const result = await service.bulkPostAttendance(date, items, fiscalYearId);
    revalidatePath('/timeAndLeave/attendance');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk post attendance.' };
  }
}

export async function deleteAttendancePunchAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'ATTENDANCE');
    await service.deleteAttendanceRecord(id);
    revalidatePath('/timeAndLeave/attendance');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete attendance record.' };
  }
}

export async function runAndLockMonthlyCalculationAction(employeeId: string, bsMonth: number, datePrefix: string) {
  await ensureTenantContext();
  try {
    await checkPermission('LOCK', 'ATTENDANCE');
    const result = await service.runAndLockMonthlyCalculation(employeeId, bsMonth, datePrefix);
    revalidatePath('/timeAndLeave/attendance');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to lock calculation.' };
  }
}
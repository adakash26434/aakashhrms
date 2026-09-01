'use server';

import { ensureTenantContext } from '@/lib/db';
import * as holidayService from '@/lib/services/holiday.service';
import { revalidatePath } from 'next/cache';
import type { HolidayFormData } from '@/lib/types/holiday';
import { checkPermission } from '@/lib/auth/check-permission';

export async function createHolidayAction(data: HolidayFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'HOLIDAYS');
    const result = await holidayService.createHoliday(data);
    revalidatePath('/setup/holidays');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'HolidayValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateHolidayAction(id: string, data: HolidayFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'HOLIDAYS');
    const result = await holidayService.updateHoliday(id, data);
    revalidatePath('/setup/holidays');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'HolidayValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteHolidayAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'HOLIDAYS');
    await holidayService.deleteHoliday(id);
    revalidatePath('/setup/holidays');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}
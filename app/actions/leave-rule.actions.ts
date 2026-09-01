'use server';

import { ensureTenantContext } from '@/lib/db';
import * as leaveRuleService from '@/lib/services/leave-rule.service';
import { revalidatePath } from 'next/cache';
import type { LeaveRuleFormData } from '@/lib/types/leave-rule';
import { checkPermission } from '@/lib/auth/check-permission';

export async function saveLeaveRuleAction(id: string | null, formData: LeaveRuleFormData) {
  await ensureTenantContext();
  try {
    await checkPermission(id ? 'EDIT' : 'ADD', 'LEAVE_RULES');
    const result = await leaveRuleService.saveLeaveRule(id, formData);
    revalidatePath('/timeAndLeave/leave-rules');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error && 'errors' in error) {
      return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save Leave rule.' };
  }
}

export async function deleteLeaveRuleAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'LEAVE_RULES');
    await leaveRuleService.deleteLeaveRule(id);
    revalidatePath('/timeAndLeave/leave-rules');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete Leave rule.' };
  }
}

export async function toggleLeaveRuleStatusAction(id: string, isActive: boolean) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'LEAVE_RULES');
    const result = await leaveRuleService.toggleLeaveRuleStatus(id, isActive);
    revalidatePath('/timeAndLeave/leave-rules');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle Leave rule.' };
  }
}

export async function getLeaveRulesWithKPIsAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LEAVE_RULES');
    const data = await leaveRuleService.getLeaveRulesWithKPIs();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch Leave rules.' };
  }
}


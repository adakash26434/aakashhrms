'use server';

import { ensureTenantContext } from '@/lib/db';
import * as otService from '@/lib/services/ot-rule.service';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/lib/auth/check-permission';
import type { OtRuleFormData } from '@/lib/types/ot-rule';

export async function saveOtRuleAction(id: string | null, formData: OtRuleFormData) {
  await ensureTenantContext();
  try {
    if (id) {
      await checkPermission('EDIT', 'OT_RULES');
    } else {
      await checkPermission('ADD', 'OT_RULES');
    }
    const result = await otService.saveOtRule(id, formData);
    revalidatePath('/timeAndLeave/ot-rules');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error && 'errors' in error) {
      return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save OT rule.' };
  }
}

export async function deleteOtRuleAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'OT_RULES');
    await otService.deleteOtRule(id);
    revalidatePath('/timeAndLeave/ot-rules');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete OT rule.' };
  }
}

export async function toggleOtRuleStatusAction(id: string, isActive: boolean) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'OT_RULES');
    const result = await otService.toggleOtRuleStatus(id, isActive);
    revalidatePath('/timeAndLeave/ot-rules');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle OT rule.' };
  }
}

export async function getOtRulesWithKPIsAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'OT_RULES');
    const data = await otService.getOtRulesWithKPIs();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch OT rules.' };
  }
}
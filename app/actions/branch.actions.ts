'use server';

import { ensureTenantContext } from '@/lib/db';
import * as branchService from '@/lib/services/branch.service';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/lib/auth/check-permission';
import type { BranchFormData } from '@/lib/types/branch';

export async function createBranchAction(data: BranchFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'ORG_STRUCTURE');
    const result = await branchService.createBranch(data);
    revalidatePath('/workforce/departments'); 
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'BranchValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateBranchAction(id: string, data: BranchFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    const result = await branchService.updateBranch(id, data);
    revalidatePath('/workforce/departments');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'BranchValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteBranchAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'ORG_STRUCTURE');
    await branchService.deleteBranch(id);
    revalidatePath('/workforce/departments');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getBranchDataAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'ORG_STRUCTURE');
    const branches = await branchService.getBranchData();
    return { success: true, data: branches };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}
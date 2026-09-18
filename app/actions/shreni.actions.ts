'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkPermission } from '@/lib/auth/check-permission';
import { revalidatePath } from 'next/cache';
import {
  findAllShreniLevels,
  createShreniLevel,
  updateShreniLevel,
  deleteShreniLevel,
  seedShreniPreset,
} from '@/lib/repositories/shreni.repository';
import type { ShreniLevelFormData } from '@/lib/types/shreni';

export async function getShreniLevelsAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'ORG_STRUCTURE');
    const levels = await findAllShreniLevels();
    return { success: true, data: levels };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch Shreni levels';
    return { success: false, error: msg };
  }
}

export async function createShreniLevelAction(data: ShreniLevelFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'ORG_STRUCTURE');

    if (!data.code?.trim()) {
      return { success: false, validationErrors: { code: 'Level code is required (e.g. S1, L1)' } };
    }
    if (!data.name?.trim()) {
      return { success: false, validationErrors: { name: 'Level name is required' } };
    }

    const created = await createShreniLevel(data);
    revalidatePath('/setup/company-setup');
    revalidatePath('/workforce/employees');
    return { success: true, data: created };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create Shreni level';
    return { success: false, error: msg };
  }
}

export async function updateShreniLevelAction(id: string, data: Partial<ShreniLevelFormData>) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');

    if (data.code !== undefined && !data.code.trim()) {
      return { success: false, validationErrors: { code: 'Level code cannot be empty' } };
    }
    if (data.name !== undefined && !data.name.trim()) {
      return { success: false, validationErrors: { name: 'Level name cannot be empty' } };
    }

    const updated = await updateShreniLevel(id, data);
    revalidatePath('/setup/company-setup');
    revalidatePath('/workforce/employees');
    return { success: true, data: updated };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update Shreni level';
    return { success: false, error: msg };
  }
}

export async function deleteShreniLevelAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'ORG_STRUCTURE');
    await deleteShreniLevel(id);
    revalidatePath('/setup/company-setup');
    revalidatePath('/workforce/employees');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete Shreni level';
    return { success: false, error: msg };
  }
}

export async function loadShreniPresetAction(presetKey: string) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    const levels = await seedShreniPreset(presetKey);
    revalidatePath('/setup/company-setup');
    revalidatePath('/workforce/employees');
    return { success: true, data: levels };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load industry preset';
    return { success: false, error: msg };
  }
}

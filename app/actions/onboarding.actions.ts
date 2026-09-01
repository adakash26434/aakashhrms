'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import * as onboardingService from '@/lib/services/onboarding.service';
import type {
  OnboardingStep1PasswordInput,
  OnboardingStep2CompanyInput,
  OnboardingStep3OrgInput,
  OnboardingStep4LeaveOtInput,
  OnboardingStep5PayHeadsInput,
  FullOnboardingPayload,
  OnboardingStatus,
} from '@/lib/types/onboarding';

export type ActionResponse<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getOnboardingStatusAction(
  tenantSlug?: string
): Promise<ActionResponse<OnboardingStatus>> {
  await ensureTenantContext();
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized: Not authenticated' };
    }

    const status = await onboardingService.getOnboardingStatus(userId, tenantSlug);
    return { success: true, data: status };
  } catch (error: any) {
    console.error('[GET_ONBOARDING_STATUS_ACTION] Error:', error);
    return { success: false, error: error?.message || 'Failed to fetch onboarding status.' };
  }
}

export async function updatePasswordStepAction(
  input: OnboardingStep1PasswordInput
): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized: Not authenticated' };
    }

    await onboardingService.updatePasswordStep(userId, input);
    revalidatePath('/onboarding');
    return { success: true };
  } catch (error: any) {
    console.error('[UPDATE_PASSWORD_STEP_ACTION] Error:', error);
    return { success: false, error: error?.message || 'Failed to update password.' };
  }
}

export async function saveCompanyProfileStepAction(
  input: OnboardingStep2CompanyInput
): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized: Not authenticated' };
    }

    await onboardingService.saveCompanyProfileStep(input, userId);
    revalidatePath('/onboarding');
    return { success: true };
  } catch (error: any) {
    console.error('[SAVE_COMPANY_PROFILE_STEP_ACTION] Error:', error);
    return { success: false, error: error?.message || 'Failed to save company profile.' };
  }
}

export async function saveOrgStructureStepAction(
  input: OnboardingStep3OrgInput
): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized: Not authenticated' };
    }

    await onboardingService.saveOrgStructureStep(input, userId);
    revalidatePath('/onboarding');
    return { success: true };
  } catch (error: any) {
    console.error('[SAVE_ORG_STRUCTURE_STEP_ACTION] Error:', error);
    return { success: false, error: error?.message || 'Failed to save organizational structure.' };
  }
}

export async function saveLeaveOtStepAction(
  input: OnboardingStep4LeaveOtInput
): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized: Not authenticated' };
    }

    await onboardingService.saveLeaveOtStep(input, userId);
    revalidatePath('/onboarding');
    return { success: true };
  } catch (error: any) {
    console.error('[SAVE_LEAVE_OT_STEP_ACTION] Error:', error);
    return { success: false, error: error?.message || 'Failed to save leave & overtime rules.' };
  }
}

export async function savePayHeadsStepAction(
  input: OnboardingStep5PayHeadsInput
): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized: Not authenticated' };
    }

    await onboardingService.savePayHeadsStep(input, userId);
    revalidatePath('/onboarding');
    return { success: true };
  } catch (error: any) {
    console.error('[SAVE_PAY_HEADS_STEP_ACTION] Error:', error);
    return { success: false, error: error?.message || 'Failed to save pay heads.' };
  }
}

export async function completeFullOnboardingAction(
  payload: FullOnboardingPayload
): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'Unauthorized: Not authenticated' };
    }

    await onboardingService.executeFullOnboarding(payload, userId);
    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/onboarding');
    return { success: true };
  } catch (error: any) {
    console.error('[COMPLETE_FULL_ONBOARDING_ACTION] Error:', error);
    return { success: false, error: error?.message || 'Failed to complete company setup.' };
  }
}

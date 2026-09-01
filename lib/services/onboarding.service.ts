import bcrypt from 'bcryptjs';
import * as repository from '@/lib/repositories/onboarding.repository';
import type {
  OnboardingStep1PasswordInput,
  OnboardingStep2CompanyInput,
  OnboardingStep3OrgInput,
  OnboardingStep4LeaveOtInput,
  OnboardingStep5PayHeadsInput,
  FullOnboardingPayload,
  OnboardingStatus,
} from '@/lib/types/onboarding';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class OnboardingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnboardingValidationError';
  }
}

export async function getOnboardingStatus(
  userId: string,
  tenantSlug?: string
): Promise<OnboardingStatus> {
  return repository.getOnboardingStatus(userId, tenantSlug);
}

export async function updatePasswordStep(
  userId: string,
  input: OnboardingStep1PasswordInput
): Promise<void> {
  if (input.keepCurrentPassword) {
    await repository.clearMustChangePasswordFlag(userId);
    return;
  }

  if (!input.newPassword || input.newPassword.length < 8) {
    throw new OnboardingValidationError('New password must be at least 8 characters long.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(input.newPassword, salt);

  await repository.updateUserPassword(userId, passwordHash, true);
}

export async function saveCompanyProfileStep(
  data: OnboardingStep2CompanyInput,
  userId: string
): Promise<void> {
  if (!data.legalName?.trim()) {
    throw new OnboardingValidationError('Company legal name is required.');
  }
  if (!data.contactEmail?.trim()) {
    throw new OnboardingValidationError('Contact email is required.');
  }
  if (!data.fiscalYearSlug?.trim()) {
    throw new OnboardingValidationError('Active fiscal year is required.');
  }

  await repository.saveCompanyProfile(data);
}

export async function saveOrgStructureStep(
  data: OnboardingStep3OrgInput,
  userId: string
): Promise<void> {
  if (!data.branchName?.trim()) {
    throw new OnboardingValidationError('Primary branch name is required.');
  }
  if (!data.branchLocation?.trim()) {
    throw new OnboardingValidationError('Branch location is required.');
  }
  if (!data.departments || data.departments.length === 0) {
    throw new OnboardingValidationError('At least one department is required.');
  }

  await repository.bootstrapOrgStructure(data);
}

export async function saveLeaveOtStep(
  data: OnboardingStep4LeaveOtInput,
  userId: string
): Promise<void> {
  if (!data.leaveTypes || data.leaveTypes.length === 0) {
    throw new OnboardingValidationError('At least one leave type is required.');
  }

  await repository.bootstrapStatutoryLeavesAndOT(data);
}

export async function savePayHeadsStep(
  data: OnboardingStep5PayHeadsInput,
  userId: string
): Promise<void> {
  if (!data.payHeads || data.payHeads.length === 0) {
    throw new OnboardingValidationError('At least one pay head is required.');
  }

  await repository.bootstrapPayHeads(data);
}

export async function executeFullOnboarding(
  payload: FullOnboardingPayload,
  userId: string
): Promise<void> {
  // Step 1: Password (if requested)
  if (payload.step1.newPassword) {
    await updatePasswordStep(userId, payload.step1);
  } else {
    await repository.clearMustChangePasswordFlag(userId);
  }

  // Step 2: Company Profile & Fiscal Calendar
  await saveCompanyProfileStep(payload.step2, userId);

  // Step 3: Org Structure (Branch & Departments)
  await saveOrgStructureStep(payload.step3, userId);

  // Step 4: Statutory Leaves & OT Rules
  await saveLeaveOtStep(payload.step4, userId);

  // Step 5: Standard Pay Heads
  await savePayHeadsStep(payload.step5, userId);

  // Step 6: Finalize Onboarding
  await repository.completeOnboarding(userId);
}

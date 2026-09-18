'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkPermission } from '@/lib/auth/check-permission';
import { auth } from '@/lib/auth';
import { platformDb, ensurePlatformTablesExist } from '@/lib/platform/db';
import { companyChangeRequests, type CompanyChangeRequest } from '@/lib/platform/schema';
import { resolvePlatformCompanyForTenant, type Tier1CompanyValues } from '@/lib/platform/company-resolver';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import {
  getCompanyMasterSetupBundle,
  saveCompanyWorkSchedule,
  saveCompanyProfileSetup,
} from '@/lib/repositories/company-setup.repository';
import {
  createEmploymentType,
  updateEmploymentType,
  deleteEmploymentType,
  findAllEmploymentTypes,
} from '@/lib/repositories/employment-type.repository';
import type {
  CompanyWorkSchedule,
  CompanyProfileSetupData,
  EmploymentTypeFormData,
} from '@/lib/types/company-setup';

export async function getCompanyMasterSetupAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'ORG_STRUCTURE');
    const data = await getCompanyMasterSetupBundle();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load company master setup';
    return { success: false, error: msg };
  }
}

export async function saveCompanyWorkScheduleAction(data: CompanyWorkSchedule) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    await saveCompanyWorkSchedule(data);
    revalidatePath('/setup/company-setup');
    revalidatePath('/setup/system-control');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to save work schedule';
    return { success: false, error: msg };
  }
}

export async function saveCompanyProfileAction(data: CompanyProfileSetupData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    if (!data.legalName?.trim()) {
      return { success: false, error: 'Company legal name is required' };
    }
    await saveCompanyProfileSetup(data);
    revalidatePath('/setup/company-setup');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update company profile';
    return { success: false, error: msg };
  }
}

export async function createEmploymentTypeAction(data: EmploymentTypeFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'ORG_STRUCTURE');
    if (!data.name?.trim()) {
      return { success: false, error: 'Employment type name is required' };
    }
    const created = await createEmploymentType(data);
    revalidatePath('/setup/company-setup');
    revalidatePath('/workforce/employees');
    return { success: true, data: created };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create employment type';
    return { success: false, error: msg };
  }
}

export async function updateEmploymentTypeAction(id: string, data: Partial<EmploymentTypeFormData>) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    const updated = await updateEmploymentType(id, data);
    revalidatePath('/setup/company-setup');
    revalidatePath('/workforce/employees');
    return { success: true, data: updated };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update employment type';
    return { success: false, error: msg };
  }
}

export async function deleteEmploymentTypeAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'ORG_STRUCTURE');
    await deleteEmploymentType(id);
    revalidatePath('/setup/company-setup');
    revalidatePath('/workforce/employees');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete employment type';
    return { success: false, error: msg };
  }
}

export async function getEmploymentTypesAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'ORG_STRUCTURE');
    const types = await findAllEmploymentTypes();
    return { success: true, data: types };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load employment types';
    return { success: false, error: msg };
  }
}

// -----------------------------------------------------------------------------
// CHANGE REQUEST & VERIFICATION WORKFLOW ACTIONS
// -----------------------------------------------------------------------------

export async function submitCompanyChangeRequestAction(payload: {
  proposedValues: Tier1CompanyValues;
  reason: string;
  documentReference?: string;
}) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    await ensurePlatformTablesExist();

    const session = await auth();
    const company = await resolvePlatformCompanyForTenant(session?.user?.tenantSlug || undefined);

    // Validate non-empty inputs
    if (!payload.proposedValues?.legalName?.trim()) {
      return { success: false, error: 'Legal company name is required.' };
    }
    if (!payload.reason || payload.reason.trim().length < 8) {
      return {
        success: false,
        error: 'Please provide a clear justification for this change request (at least 8 characters).',
      };
    }

    // Check if an existing PENDING request exists
    const [existingPending] = await platformDb
      .select({ id: companyChangeRequests.id })
      .from(companyChangeRequests)
      .where(
        and(
          eq(companyChangeRequests.companyId, company.id),
          eq(companyChangeRequests.status, 'PENDING')
        )
      )
      .limit(1);

    if (existingPending) {
      return {
        success: false,
        error:
          'A pending change request is already awaiting Super Admin review. Please wait for verification or cancel the current request before submitting a new one.',
      };
    }

    const currentValues: Tier1CompanyValues = {
      legalName: company.legalName,
      panVatNumber: company.panVatNumber || '',
      registrationNumber: company.registrationNumber || '',
      industryType: company.industryType || 'General',
      headOfficeAddress: company.headOfficeAddress || '',
    };

    const [newRequest] = await platformDb
      .insert(companyChangeRequests)
      .values({
        companyId: company.id,
        requestedByUserId: session?.user?.id || null,
        requestedByUserEmail: session?.user?.email || 'admin@tenant.local',
        status: 'PENDING',
        currentValues,
        proposedValues: {
          legalName: payload.proposedValues.legalName.trim(),
          panVatNumber: (payload.proposedValues.panVatNumber || '').trim(),
          registrationNumber: (payload.proposedValues.registrationNumber || '').trim(),
          industryType: (payload.proposedValues.industryType || 'General').trim(),
          headOfficeAddress: (payload.proposedValues.headOfficeAddress || '').trim(),
        },
        reason: payload.reason.trim(),
        documentReference: payload.documentReference?.trim() || null,
      })
      .returning();

    revalidatePath('/setup/company-setup');
    return { success: true, data: newRequest };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to submit change request';
    return { success: false, error: msg };
  }
}

export async function cancelCompanyChangeRequestAction(requestId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    await ensurePlatformTablesExist();

    const [request] = await platformDb
      .select()
      .from(companyChangeRequests)
      .where(eq(companyChangeRequests.id, requestId))
      .limit(1);

    if (!request) {
      return { success: false, error: 'Change request not found.' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, error: 'Only pending requests can be cancelled.' };
    }

    await platformDb
      .update(companyChangeRequests)
      .set({
        status: 'CANCELLED',
        updatedAt: new Date(),
      })
      .where(eq(companyChangeRequests.id, requestId));

    revalidatePath('/setup/company-setup');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to cancel change request';
    return { success: false, error: msg };
  }
}

export async function getCompanyChangeRequestStatusAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'ORG_STRUCTURE');
    await ensurePlatformTablesExist();

    const session = await auth();
    const company = await resolvePlatformCompanyForTenant(session?.user?.tenantSlug || undefined);

    const [latest] = await platformDb
      .select()
      .from(companyChangeRequests)
      .where(eq(companyChangeRequests.companyId, company.id))
      .orderBy(desc(companyChangeRequests.createdAt))
      .limit(1);

    return { success: true, data: latest || null };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load change request status';
    return { success: false, error: msg };
  }
}


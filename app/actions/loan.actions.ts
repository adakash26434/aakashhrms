'use server';

import { ensureTenantContext } from '@/lib/db';
import * as loanService from '@/lib/services/loan.service';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/lib/auth/check-permission';
import type {
  LoanTypeFormData,
  DisburseLoanFormData,
  RepaymentFormData,
} from '@/lib/types/loan';

// ---------------------------------------------------------------------------
// Loan Types
// ---------------------------------------------------------------------------

export async function getLoanTypesAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LOANS');
    const data = await loanService.getLoanTypesWithKPIs();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch loan types.' };
  }
}

export async function saveLoanTypeAction(id: string | null, formData: LoanTypeFormData) {
  await ensureTenantContext();
  try {
    await checkPermission(id ? 'EDIT' : 'ADD', 'LOANS');
    const result = await loanService.saveLoanType(id, formData);
    revalidatePath('/loans');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'LoanTypeValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Failed to save loan type.' };
  }
}

export async function deleteLoanTypeAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'LOANS');
    await loanService.deleteLoanType(id);
    revalidatePath('/loans');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete loan type.' };
  }
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export async function getLoansAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LOANS');
    const data = await loanService.getLoansWithKPIs();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch loans.' };
  }
}

export async function getLoanLookupDataAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LOANS');
    const data = await loanService.getLoanLookupData();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch lookup data.' };
  }
}

export async function disburseLoanAction(formData: DisburseLoanFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'LOANS');
    const result = await loanService.disburseLoan(formData);
    revalidatePath('/loans');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'DisbursementValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Failed to disburse loan.' };
  }
}

// ---------------------------------------------------------------------------
// Repayments
// ---------------------------------------------------------------------------

export async function recordRepaymentAction(formData: RepaymentFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'LOANS');
    const result = await loanService.recordRepayment(formData);
    revalidatePath('/loans');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'RepaymentValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Failed to record repayment.' };
  }
}

export async function getLoanRepaymentsAction(loanId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LOANS');
    const data = await loanService.getLoanRepayments(loanId);
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch repayments.' };
  }
}

export async function getActiveLoansByEmployeeAction(employeeId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LOANS');
    const data = await loanService.getActiveLoansByEmployee(employeeId);
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch employee loans.' };
  }
}

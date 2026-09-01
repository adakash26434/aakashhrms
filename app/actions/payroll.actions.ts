'use server';

import { ensureTenantContext } from '@/lib/db';
import * as service from "@/lib/services/payroll.service";
import { checkPermission } from "@/lib/auth/check-permission";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { 
  PayrollRunSetupPayload, 
  PayrollSlipOverridePayload,
  PayrollRunStatus
} from "@/lib/types/payroll";

export async function getPayrollHistoryAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'PAYROLL_GENERATE');
    const data = await service.getPayrollHistory();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function getPayrollRunDetailsAction(runId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'PAYROLL_GENERATE');
    const data = await service.getPayrollRunDetails(runId);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function getPayslipWithHeadsAction(slipId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'PAYROLL_GENERATE');
    const data = await service.getPayslipWithHeads(slipId);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function generatePayrollRunAction(payload: PayrollRunSetupPayload) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'PAYROLL_GENERATE');
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    const result = await service.generatePayrollRun(payload, session.user.id);
    revalidatePath('/payroll/generate');
    revalidatePath('/payroll/review');
    return { success: true, data: result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function updatePayrollSlipOverrideAction(payload: PayrollSlipOverridePayload) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'PAYROLL_GENERATE');
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    await service.overridePayslipAllowanceDeduction(payload, session.user.id);
    revalidatePath('/payroll/review');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function transitionPayrollRunAction(runId: string, toStatus: PayrollRunStatus, notes?: string) {
  await ensureTenantContext();
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    if (toStatus === 'UNDER_REVIEW') {
      await checkPermission('EDIT', 'PAYROLL_GENERATE');
    } else if (toStatus === 'APPROVED') {
      await checkPermission('APPROVE', 'PAYROLL_REVIEW');
    } else if (toStatus === 'LOCKED') {
      await checkPermission('LOCK', 'PAYROLL_REVIEW');
    } else if (toStatus === 'DRAFT') {
      // Reverting back to draft is also a form of rejection/edit
      await checkPermission('APPROVE', 'PAYROLL_REVIEW');
    }

    const result = await service.transitionPayrollRun(runId, toStatus, session.user.id, notes);
    revalidatePath('/payroll/review');
    revalidatePath('/payroll/generate');
    return { success: true, data: result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function generateBankExportCSVAction(runId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('EXPORT', 'PAYROLL_GENERATE');
    const details = await service.getPayrollRunDetails(runId);
    if (details.payrollRun.status !== 'LOCKED') {
      throw new Error("Bank payment file can only be generated for LOCKED payroll runs.");
    }

    // Nepal commercial bank bulk payment format: SN, AccountNumber, AccountName, Amount, Remarks
    let csv = "SN,AccountNumber,AccountName,Amount,Remarks\n";
    details.slips.forEach((slip, idx) => {
      const remarks = `Salary Month ${details.payrollRun.payPeriodMonth} ${details.payrollRun.payPeriodYear}`;
      csv += `${idx + 1},${slip.bankAccountNumber},${slip.employeeName},${slip.netPayable},"${remarks}"\n`;
    });

    return { success: true, data: csv };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

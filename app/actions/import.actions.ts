'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import { commitEmployeeImport, previewEmployeeImport } from '@/lib/services/employee-import.service';

// Import templates (4.8 / F15): the server checks the whole file (the browser only sends its
// text) and saves nothing while a row has an error. Employees need Employees → Add within the
// user's scope (each row's branch / department is checked); pay from the file needs Salary
// mapping → Edit. Every created employee is audited like a form save, plus one line for the import.

async function employeeCtx() {
  const scope = await checkPermissionWithScope('ADD', 'EMPLOYEES');
  const canEditPay = await hasPermission('EDIT', 'SALARY_MAPPING');
  return { scope, userId: scope.userId, canEditPay };
}

export async function previewEmployeeImportAction(csv: string) {
  await ensureTenantContext();
  try {
    const ctx = await employeeCtx();
    return { success: true as const, data: await previewEmployeeImport(csv, ctx) };
  } catch (error: unknown) {
    return toActionError(error, 'import.employees.preview');
  }
}

export async function commitEmployeeImportAction(csv: string) {
  await ensureTenantContext();
  try {
    const ctx = await employeeCtx();
    const result = await commitEmployeeImport(csv, ctx);
    for (const c of result.created) {
      await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'EMPLOYEES', recordId: c.employeeId, result: 'SUCCESS', newValues: { employeeCode: c.employeeCode, imported: true, loginCreated: false } });
    }
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'EMPLOYEES', recordId: null, result: 'SUCCESS', newValues: { import: 'employees', created: result.created.length, failed: result.failed.length } });
    revalidatePath('/workforce/employees');
    revalidatePath('/dashboard');
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return toActionError(error, 'import.employees.commit');
  }
}

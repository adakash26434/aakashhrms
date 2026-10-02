'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { buildEmployeeScopeCondition } from '@/lib/auth/scope-filter';
import { quickSearch, type EmployeeQuickResult } from '@/lib/repositories/employee.repository';

/**
 * Command palette employee lookup (redesign 2.6). Requires EMPLOYEES VIEW and
 * applies the caller's branch / department scope. Returns display fields only.
 */
export async function searchEmployeesForPaletteAction(
  query: string
): Promise<{ success: boolean; data?: EmployeeQuickResult[] }> {
  if (typeof query !== 'string') return { success: false };
  const term = query.trim();
  if (term.length < 2 || term.length > 60) return { success: true, data: [] };

  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    const data = await quickSearch(term, buildEmployeeScopeCondition(scope));
    return { success: true, data };
  } catch {
    // No permission (or no tenant): the palette simply shows no employees.
    return { success: false };
  }
}

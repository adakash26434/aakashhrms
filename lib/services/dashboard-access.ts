import type { DashboardData } from '@/lib/types/dashboard';

/**
 * Which dashboard data groups the current user may see. Derived from VIEW
 * permissions on the matching modules (S3).
 */
export interface DashboardAccess {
  payroll: boolean;   // PAYROLL_GENERATE or PAYROLL_REVIEW
  approvals: boolean; // LEAVE_APPROVALS
  loans: boolean;     // LOANS
  audit: boolean;     // AUDIT_LOG
}

const RESTRICTED = 'Requires access';

/**
 * Removes data the user is not permitted to see before the snapshot is
 * serialised to the browser. Pure function so it can be unit tested.
 */
export function redactDashboardForAccess(data: DashboardData, access: DashboardAccess): DashboardData {
  const out: DashboardData = { ...data };

  if (!access.payroll) {
    out.currentRun = {
      ...data.currentRun,
      grossPayroll: 0,
      totalDeductions: 0,
      netPayable: 0,
      deductions: [],
      exceptions: 0,
    };
    out.validationExceptions = [];
    out.trend = [];
    out.hero = { ...data.hero, payrollLockNote: '' };
  }

  const approvalItems = (data.pendingApprovals.items ?? []).filter(
    (item) => item.category !== 'loans' || access.loans
  );
  out.pendingApprovals = access.approvals
    ? { ...data.pendingApprovals, items: approvalItems }
    : { ...data.pendingApprovals, value: 0, items: [], subtext: RESTRICTED, badge: '—' };

  out.metrics = data.metrics.map((metric) => {
    const hidden =
      (metric.id === 'liability' && !access.payroll) ||
      (metric.id === 'loans' && !access.loans) ||
      (metric.id === 'leave' && !access.approvals);
    return hidden
      ? { ...metric, value: '—', subtext: RESTRICTED, badge: '—', badgeVariant: 'neutral' as const }
      : metric;
  });

  if (!access.audit) {
    out.activity = [];
  }

  return out;
}

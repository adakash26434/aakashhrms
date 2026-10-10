import { can, permissionSetFor, type PermissionSet } from '@/lib/auth/get-user-permissions';
import { resolveUserScope, type ScopeFilter } from '@/lib/auth/scope-filter';
import { countWaitingFor as countLeaveWaitingFor } from '@/lib/services/leave.service';
import { countAdjustmentsWaitingFor } from '@/lib/services/attendance.service';
import { countWaitingFor as countSalaryWaitingFor } from '@/lib/services/salary-structure.service';
import { countWaitingFor as countDetailWaitingFor } from '@/lib/services/employee-detail.service';
import { countPolicyWaitingFor } from '@/lib/services/leave-policy.service';
import * as reimbursementService from '@/lib/services/reimbursement.service';
import * as travelService from '@/lib/services/travel.service';
import * as leaveSalaryService from '@/lib/services/leave-salary.service';
import * as evaluationService from '@/lib/services/evaluation.service';
import * as targetService from '@/lib/services/target.service';
import { runsWaitingFor } from '@/lib/services/payroll-control.service';
import * as leaveRepository from '@/lib/repositories/leave.repository';
import { upcomingDeadlines } from '@/lib/engines/dashboard.engine';
import { buildCentre } from '@/lib/engines/notification.engine';
import { nepalToday } from '@/lib/utils/nepal-time';
import type { ActionType, ModuleType } from '@/lib/types/role';
import type { NotificationCentre } from '@/lib/types/notification';

// F17 notification centre: orchestration. Each module counts what waits for this person by its
// own rules — within their scope, never their own record, through the approval engine or the
// maker-checker — and a count runs only when the person holds the permission that decides it.
// The actor is explicit (no session here), so a scheduled digest can reuse it.

export interface NotificationActor {
  userId: string;
  scope: ScopeFilter;
  permissions: PermissionSet;
}

/** One module's count. A failing module is logged and left out; it never breaks the frame. */
async function counted<T>(name: string, enabled: boolean, load: () => Promise<T>): Promise<T | null> {
  if (!enabled) return null;
  try {
    return await load();
  } catch (error) {
    console.error(`[notifications] "${name}" failed`, error);
    return null;
  }
}

export async function notificationCentre(actor: NotificationActor, today: Date = nepalToday()): Promise<NotificationCentre> {
  const { userId, scope, permissions } = actor;
  const has = (action: ActionType, module: ModuleType) => can(permissions, action, module);
  const views = (module: ModuleType) => has('VIEW', module);
  /** The permission the deciding action checks, plus the view its screen needs (the bell links there). */
  const decides = (action: ActionType, module: ModuleType) => views(module) && has(action, module);

  const policy = { canApprove: decides('APPROVE', 'LEAVE_TYPES'), canEdit: decides('EDIT', 'LEAVE_TYPES') };
  const payroll = { canSend: decides('EDIT', 'PAYROLL_GENERATE'), canApprove: decides('APPROVE', 'PAYROLL_REVIEW'), canLock: decides('LOCK', 'PAYROLL_REVIEW') };
  const gate = {
    leave: views('LEAVE_APPROVALS') || views('LEAVE_APPLICATIONS'),
    attendance: views('ATTENDANCE'),
    salary: views('SALARY_MAPPING'),
    details: decides('APPROVE', 'EMPLOYEES'),
    reimbursements: decides('APPROVE', 'REIMBURSEMENTS'),
    travel: decides('APPROVE', 'TRAVEL'),
    leaveSalary: decides('APPROVE', 'LEAVE_SALARY'),
    leavePolicy: policy.canApprove || policy.canEdit,
    evaluations: decides('EDIT', 'PERFORMANCE'),
    targets: decides('APPROVE', 'TARGETS'),
    teamTargets: !!scope.employeeId,
    runs: payroll.canSend || payroll.canApprove || payroll.canLock,
    deadlines: views('PAYROLL_GENERATE') || views('PAYROLL_REVIEW'),
  };

  const [leave, attendance, salary, details, reimbursements, travel, leaveSalary, leavePolicy, evaluations, targets, teamTargets, runs] = await Promise.all([
    // Supervisors count their supervisees' requests too; Approve adds everyone else's in scope.
    counted('leave', gate.leave, () => countLeaveWaitingFor(scope, has('APPROVE', 'LEAVE_APPROVALS'))),
    counted('attendance', gate.attendance, () => countAdjustmentsWaitingFor(scope, has('APPROVE', 'ATTENDANCE'))),
    counted('salary', gate.salary, () => countSalaryWaitingFor(scope, has('APPROVE', 'SALARY_MAPPING'))),
    counted('details', gate.details, () => countDetailWaitingFor(scope, true)),
    counted('reimbursements', gate.reimbursements, () => reimbursementService.countWaitingFor(scope)),
    counted('travel', gate.travel, () => travelService.countWaitingFor(scope)),
    counted('leaveSalary', gate.leaveSalary, () => leaveSalaryService.countWaitingFor(scope)),
    counted('leavePolicy', gate.leavePolicy, () => countPolicyWaitingFor({ scope, userId, ...policy, impersonation: false })),
    counted('evaluations', gate.evaluations, () => evaluationService.countWaitingFor(userId, scope)),
    counted('targets', gate.targets, () => targetService.countWaitingFor(scope)),
    counted('teamTargets', gate.teamTargets, () => targetService.countTeamWaiting(scope.employeeId as string)),
    counted('runs', gate.runs, () => runsWaitingFor({ userId, scope, isAdmin: permissions.isAdmin, ...payroll })),
  ]);

  return buildCentre({
    approvals: { leave, attendance, salary, details, reimbursements, travel, leaveSalary, leavePolicy, evaluations, targets, teamTargets },
    runs: runs ?? [],
    deadlines: gate.deadlines ? upcomingDeadlines(today) : null,
    deadlineHref: views('REPORTS_TAX_IRD') ? '/payroll/statutory' : '/dashboard',
    // Supervising someone shows up as a count; everything else is a permission.
    enabled: Object.entries(gate).some(([key, on]) => key !== 'teamTargets' && on),
  });
}

/** The centre for one user, by id (the signed-in user in an action, or a user a job writes to). */
export async function notificationsFor(userId: string, tenantSlug?: string | null): Promise<NotificationCentre> {
  const [scope, permissions] = await Promise.all([resolveUserScope(userId, tenantSlug), permissionSetFor(userId, tenantSlug)]);
  return notificationCentre({ userId, scope, permissions });
}

/**
 * Platform support view: the company's waiting leave requests as before, read-only (support
 * never decides anything, so nothing else is listed).
 */
export function supportCentre(leaveWaiting: number): NotificationCentre {
  const centre = buildCentre({ approvals: { leave: leaveWaiting }, runs: [], deadlines: null, deadlineHref: '/dashboard', enabled: true });
  return { ...centre, items: centre.items.map((i) => ({ ...i, detail: 'Waiting in the company (support view: read-only)' })) };
}

/** The support centre for the company the request is in. */
export async function supportNotifications(): Promise<NotificationCentre> {
  return supportCentre((await leaveRepository.findRequests({ statuses: ['Pending'] })).length);
}

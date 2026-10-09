import * as repo from '@/lib/repositories/notice.repository';
import { branchOptions } from '@/lib/repositories/asset.repository';
import { findEmployeeOptions } from '@/lib/repositories/letter.repository';
import { isVisible, normalizeNoticeForm, sortForBoard, validateNoticeForm, type Reader } from '@/lib/engines/notice.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { UserFacingError } from '@/lib/errors/action-error';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import type { BoardNotice, NoticeRow, NoticesPageData } from '@/lib/types/notice';

// Notice board (G14): orchestration. Posting needs NOTICE_BOARD; reading the
// board (Home, self-service) needs only a signed-in user — a reader sees
// company-wide notices plus those for their own branch / department, and
// notices that name them. Named-employee notices must name people inside the
// poster's scope. Withdrawn notices stay for the record.

export class NoticeValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'NoticeValidationError';
  }
}

const asStatus = (s: string): NoticeRow['status'] => (s === 'draft' || s === 'withdrawn' ? s : 'published');

const audienceLabel = (n: repo.NoticeJoined): string => {
  if (n.audience === 'branch') return n.branch ?? 'One branch';
  if (n.audience === 'department') return n.department ?? 'One department';
  if (n.audience === 'employees') return n.recipients.length === 1 ? n.recipients[0].name : `${n.recipients.length} employees`;
  return 'Whole company';
};
const asAudience = (a: string): NoticeRow['audience'] => (a === 'branch' || a === 'department' || a === 'employees' ? a : 'company');

const toRow = (n: repo.NoticeJoined): NoticeRow => ({
  id: n.id,
  title: n.title,
  body: n.body,
  audience: asAudience(n.audience),
  audienceLabel: audienceLabel(n),
  branchId: n.branchId,
  departmentId: n.departmentId,
  recipients: n.recipients,
  publishAd: n.publishAd,
  expiresAd: n.expiresAd,
  pinned: n.pinned,
  status: asStatus(n.status),
  authorName: n.authorName ?? '—',
});

export interface NoticeCtx {
  userId: string;
  scope: ScopeFilter;
}

export async function noticesPage(ctx: NoticeCtx, permissions: NoticesPageData['permissions']): Promise<NoticesPageData> {
  const [list, branches, departments, employees] = await Promise.all([repo.listNotices(), branchOptions(), repo.departmentOptions(), findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))]);
  return { notices: list.map(toRow), branches, departments, employees, permissions };
}

export async function saveNotice(id: string | null, raw: unknown, ctx: NoticeCtx): Promise<NoticeRow> {
  const form = normalizeNoticeForm(raw);
  const errors = validateNoticeForm(form);
  if (Object.keys(errors).length) throw new NoticeValidationError(errors);
  let recipientIds: string[] = [];
  if (form.audience === 'employees') {
    // Only active people inside the poster's own scope can be named.
    recipientIds = await repo.employeesInScope(form.recipientIds, buildEmployeeScopeCondition(ctx.scope));
    if (recipientIds.length !== form.recipientIds.length) throw new NoticeValidationError({ recipientIds: 'Some of these employees are not active in your scope.' });
  }
  const write: repo.NoticeWrite = {
    title: form.title,
    body: form.body,
    audience: form.audience,
    branchId: form.audience === 'branch' ? form.branchId : null,
    departmentId: form.audience === 'department' ? form.departmentId : null,
    recipientIds,
    publishAd: form.publishAd,
    expiresAd: form.expiresAd || null,
    pinned: form.pinned,
  };
  const row = id ? await repo.updateNotice(id, write, ctx.userId) : await repo.insertNotice(write, ctx.userId);
  if (!row) throw new UserFacingError('This notice is withdrawn and can no longer be edited.');
  return toRow((await repo.findNotice(row.id))!);
}

export async function withdrawNotice(id: string, userId: string): Promise<NoticeRow> {
  const row = await repo.withdrawNotice(id, userId);
  if (!row) throw new UserFacingError('This notice is already withdrawn.');
  return toRow((await repo.findNotice(row.id))!);
}

/**
 * Who the reader is: company-wide scope sees every branch and department;
 * otherwise their scope's branches / departments plus where their own employee
 * record sits, and their own employee id for named notices.
 */
async function readerFor(scope: ScopeFilter): Promise<Reader> {
  const own = scope.employeeId ? await repo.placementOfEmployee(scope.employeeId) : { branchId: null, departmentId: null };
  const branches: string[] = scope.scopeType === 'BRANCH' ? [...scope.branchIds] : [];
  const departments: string[] = scope.scopeType === 'DEPARTMENT' ? [...scope.departmentIds] : [];
  if (own.branchId) branches.push(own.branchId);
  if (own.departmentId) departments.push(own.departmentId);
  const all = scope.scopeType === 'GLOBAL';
  return { branches: all ? 'all' : [...new Set(branches)], departments: all ? 'all' : [...new Set(departments)], employeeId: scope.employeeId };
}

/** What Home shows the signed-in user today. */
export async function boardFor(scope: ScopeFilter, limit = 8): Promise<BoardNotice[]> {
  const reader = await readerFor(scope);
  const today = toIsoDate(nepalToday());
  const rows = (await repo.publishedFor(reader, today)).filter((n) => isVisible({ ...n, recipientIds: n.recipients.map((r) => r.id) }, today, reader));
  return sortForBoard(rows)
    .slice(0, limit)
    .map((n) => ({ id: n.id, title: n.title, body: n.body, branch: n.audience === 'company' ? null : audienceLabel(n), publishAd: n.publishAd, pinned: n.pinned }));
}

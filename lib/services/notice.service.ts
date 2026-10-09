import * as repo from '@/lib/repositories/notice.repository';
import { branchOptions } from '@/lib/repositories/asset.repository';
import { isVisible, normalizeNoticeForm, sortForBoard, validateNoticeForm } from '@/lib/engines/notice.engine';
import type { ScopeFilter } from '@/lib/auth/scope-filter';
import { UserFacingError } from '@/lib/errors/action-error';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import type { BoardNotice, NoticeRow, NoticesPageData } from '@/lib/types/notice';

// Notice board (G14): orchestration. Posting needs NOTICE_BOARD; reading the
// board (Home) needs only a signed-in user — a reader sees company-wide notices
// plus those for their own branch (branch scope: their branches; company-wide
// scope: everything). Withdrawn notices stay for the record.

export class NoticeValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'NoticeValidationError';
  }
}

const asStatus = (s: string): NoticeRow['status'] => (s === 'draft' || s === 'withdrawn' ? s : 'published');

const toRow = (n: repo.NoticeJoined): NoticeRow => ({
  id: n.id,
  title: n.title,
  body: n.body,
  branchId: n.branchId,
  branch: n.branch,
  publishAd: n.publishAd,
  expiresAd: n.expiresAd,
  pinned: n.pinned,
  status: asStatus(n.status),
  authorName: n.authorName ?? '—',
});

export async function noticesPage(permissions: NoticesPageData['permissions']): Promise<NoticesPageData> {
  const [list, branches] = await Promise.all([repo.listNotices(), branchOptions()]);
  return { notices: list.map(toRow), branches, permissions };
}

export async function saveNotice(id: string | null, raw: unknown, userId: string): Promise<NoticeRow> {
  const form = normalizeNoticeForm(raw);
  const errors = validateNoticeForm(form);
  if (Object.keys(errors).length) throw new NoticeValidationError(errors);
  const write: repo.NoticeWrite = { title: form.title, body: form.body, branchId: form.branchId || null, publishAd: form.publishAd, expiresAd: form.expiresAd || null, pinned: form.pinned };
  const row = id ? await repo.updateNotice(id, write, userId) : await repo.insertNotice(write, userId);
  if (!row) throw new UserFacingError('This notice is withdrawn and can no longer be edited.');
  return toRow((await repo.findNotice(row.id))!);
}

export async function withdrawNotice(id: string, userId: string): Promise<NoticeRow> {
  const row = await repo.withdrawNotice(id, userId);
  if (!row) throw new UserFacingError('This notice is already withdrawn.');
  return toRow((await repo.findNotice(row.id))!);
}

/** The reader's audience: company-wide scope sees every branch; otherwise their own branch(es). */
async function audienceFor(scope: ScopeFilter): Promise<string[] | 'all'> {
  if (scope.scopeType === 'GLOBAL') return 'all';
  if (scope.scopeType === 'BRANCH' && scope.branchIds.length) return scope.branchIds;
  if (scope.employeeId) {
    const branch = await repo.branchOfEmployee(scope.employeeId);
    return branch ? [branch] : [];
  }
  return [];
}

/** What Home shows the signed-in user today. */
export async function boardFor(scope: ScopeFilter, limit = 8): Promise<BoardNotice[]> {
  const audience = await audienceFor(scope);
  const today = toIsoDate(nepalToday());
  const rows = (await repo.publishedFor(audience)).filter((n) => isVisible(n, today, audience));
  return sortForBoard(rows)
    .slice(0, limit)
    .map((n) => ({ id: n.id, title: n.title, body: n.body, branch: n.branch, publishAd: n.publishAd, pinned: n.pinned }));
}

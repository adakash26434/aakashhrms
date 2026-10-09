// Notice board (G14): pure rules, no database access, unit-tested in
// tests/notice.engine.test.ts. A notice is visible when published, from its
// publish date, until its expiry (inclusive), to the whole company or one
// branch; pinned notices sort first, then newest.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export interface NoticeForm {
  title: string;
  body: string;
  branchId: string; // '' = whole company
  publishAd: string;
  expiresAd: string; // '' = never
  pinned: boolean;
}

export function normalizeNoticeForm(raw: unknown): NoticeForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    title: s(r.title, 200),
    body: s(r.body, 8000),
    branchId: s(r.branchId, 64),
    publishAd: s(r.publishAd, 10),
    expiresAd: s(r.expiresAd, 10),
    pinned: r.pinned === true,
  };
}

export function validateNoticeForm(form: NoticeForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.length < 3) errors.title = 'Give the notice a title (at least 3 characters).';
  if (form.body.length < 5) errors.body = 'Write the notice (at least 5 characters).';
  if (!ISO.test(form.publishAd)) errors.publishAd = 'Choose the publish date.';
  if (form.expiresAd && !ISO.test(form.expiresAd)) errors.expiresAd = 'A date, or leave it empty.';
  if (ISO.test(form.publishAd) && ISO.test(form.expiresAd) && form.expiresAd < form.publishAd) errors.expiresAd = 'Expiry before publication?';
  return errors;
}

export interface NoticeFact {
  status: string;
  branchId: string | null;
  publishAd: string;
  expiresAd: string | null;
  pinned: boolean;
}

/**
 * Visible to a reader on `today`: published, inside its window, and addressed
 * to the whole company or one of the reader's branches ('all' for someone
 * with company-wide scope).
 */
export function isVisible(n: NoticeFact, today: string, readerBranches: string[] | 'all'): boolean {
  if (n.status !== 'published') return false;
  if (n.publishAd > today) return false;
  if (n.expiresAd && n.expiresAd < today) return false;
  if (n.branchId === null) return true;
  return readerBranches === 'all' || readerBranches.includes(n.branchId);
}

/** Pinned first, then newest publish date. */
export function sortForBoard<T extends { pinned: boolean; publishAd: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishAd.localeCompare(a.publishAd));
}

// Notice board (G14): pure rules, no database access, unit-tested in
// tests/notice.engine.test.ts. A notice is visible when published, from its
// publish date, until its expiry (inclusive), to the whole company, one
// branch, one department or named employees; pinned notices sort first,
// then newest.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const AUDIENCES = [
  { code: 'company', label: 'Whole company' },
  { code: 'branch', label: 'One branch' },
  { code: 'department', label: 'One department' },
  { code: 'employees', label: 'Named employees' },
] as const;
export type Audience = (typeof AUDIENCES)[number]['code'];
export const MAX_RECIPIENTS = 50;

const asAudience = (v: unknown): Audience => (AUDIENCES.some((a) => a.code === v) ? (v as Audience) : 'company');

export interface NoticeForm {
  title: string;
  body: string;
  audience: Audience;
  branchId: string; // audience 'branch'
  departmentId: string; // audience 'department'
  recipientIds: string[]; // audience 'employees'
  publishAd: string;
  expiresAd: string; // '' = never
  pinned: boolean;
}

export function normalizeNoticeForm(raw: unknown): NoticeForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    title: s(r.title, 200),
    body: s(r.body, 8000),
    audience: asAudience(r.audience),
    branchId: s(r.branchId, 64),
    departmentId: s(r.departmentId, 64),
    recipientIds: [...new Set(Array.isArray(r.recipientIds) ? r.recipientIds.map((x) => s(x, 64)).filter(Boolean) : [])],
    publishAd: s(r.publishAd, 10),
    expiresAd: s(r.expiresAd, 10),
    pinned: r.pinned === true,
  };
}

export function validateNoticeForm(form: NoticeForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.length < 3) errors.title = 'Give the notice a title (at least 3 characters).';
  if (form.body.length < 5) errors.body = 'Write the notice (at least 5 characters).';
  if (form.audience === 'branch' && !form.branchId) errors.branchId = 'Choose the branch.';
  if (form.audience === 'department' && !form.departmentId) errors.departmentId = 'Choose the department.';
  if (form.audience === 'employees') {
    if (form.recipientIds.length === 0) errors.recipientIds = 'Add at least one employee.';
    else if (form.recipientIds.length > MAX_RECIPIENTS) errors.recipientIds = `At most ${MAX_RECIPIENTS} employees; use a department or branch instead.`;
  }
  if (!ISO.test(form.publishAd)) errors.publishAd = 'Choose the publish date.';
  if (form.expiresAd && !ISO.test(form.expiresAd)) errors.expiresAd = 'A date, or leave it empty.';
  if (ISO.test(form.publishAd) && ISO.test(form.expiresAd) && form.expiresAd < form.publishAd) errors.expiresAd = 'Expiry before publication?';
  return errors;
}

export interface NoticeFact {
  status: string;
  audience: string;
  branchId: string | null;
  departmentId: string | null;
  recipientIds: string[];
  publishAd: string;
  expiresAd: string | null;
  pinned: boolean;
}

/** Who is reading: their branches / departments ('all' = company-wide scope) and, if they are an employee, which one. */
export interface Reader {
  branches: string[] | 'all';
  departments: string[] | 'all';
  employeeId: string | null;
}

/**
 * Visible to a reader on `today`: published, inside its window, and addressed
 * to them. Company-wide readers (administrators) see company, branch and
 * department notices; named-employee notices are for the named people only,
 * so nobody reads another person's individual notice on their own Home.
 */
export function isVisible(n: NoticeFact, today: string, reader: Reader): boolean {
  if (n.status !== 'published') return false;
  if (n.publishAd > today) return false;
  if (n.expiresAd && n.expiresAd < today) return false;
  switch (n.audience) {
    case 'branch':
      return !!n.branchId && (reader.branches === 'all' || reader.branches.includes(n.branchId));
    case 'department':
      return !!n.departmentId && (reader.departments === 'all' || reader.departments.includes(n.departmentId));
    case 'employees':
      return !!reader.employeeId && n.recipientIds.includes(reader.employeeId);
    default:
      return true;
  }
}

/** Pinned first, then newest publish date. */
export function sortForBoard<T extends { pinned: boolean; publishAd: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishAd.localeCompare(a.publishAd));
}

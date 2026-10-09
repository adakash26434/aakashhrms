// Assets (G14, docs/redesign/06-hrms-gap-analysis.md): pure rules, no database
// access, unit-tested in tests/asset.engine.test.ts. An asset is available,
// issued (exactly one open handover) or retired; it is issued only while
// available and returned with a condition; a lost return retires it.

export const ASSET_CATEGORIES = [
  { code: 'laptop', name: 'Laptop / computer' },
  { code: 'phone', name: 'Phone / SIM' },
  { code: 'key', name: 'Keys' },
  { code: 'id_card', name: 'ID card' },
  { code: 'vehicle', name: 'Vehicle' },
  { code: 'furniture', name: 'Furniture / equipment' },
  { code: 'other', name: 'Other' },
] as const;

export const ASSET_STATUSES = ['available', 'issued', 'retired'] as const;
export const RETURN_CONDITIONS = ['good', 'damaged', 'lost'] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export interface AssetForm {
  tag: string;
  name: string;
  category: string;
  branchId: string;
  note: string;
}

export function normalizeAssetForm(raw: unknown): AssetForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    tag: s(r.tag, 50).toUpperCase(),
    name: s(r.name, 200),
    category: ASSET_CATEGORIES.some((c) => c.code === r.category) ? (r.category as string) : '',
    branchId: s(r.branchId, 64),
    note: s(r.note, 1000),
  };
}

export function validateAssetForm(form: AssetForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[A-Z0-9][A-Z0-9/_.-]{1,49}$/.test(form.tag)) errors.tag = 'Tag: 2–50 letters, digits, - _ / or .';
  if (form.name.length < 2) errors.name = 'Name the asset.';
  if (!form.category) errors.category = 'Choose a category.';
  return errors;
}

export const canIssue = (status: string): boolean => status === 'available';
export const canRetire = (status: string): boolean => status === 'available';

export interface IssueForm {
  employeeId: string;
  issuedAd: string;
  note: string;
}

export function normalizeIssueForm(raw: unknown): IssueForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { employeeId: s(r.employeeId, 64), issuedAd: s(r.issuedAd, 10), note: s(r.note, 500) };
}

export function validateIssueForm(form: IssueForm, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.employeeId) errors.employeeId = 'Choose the employee.';
  if (!ISO.test(form.issuedAd)) errors.issuedAd = 'Choose the handover date.';
  else if (form.issuedAd > today) errors.issuedAd = 'The handover date cannot be in the future.';
  return errors;
}

export interface ReturnForm {
  returnedAd: string;
  condition: string;
  note: string;
}

export function normalizeReturnForm(raw: unknown): ReturnForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { returnedAd: s(r.returnedAd, 10), condition: s(r.condition, 12), note: s(r.note, 500) };
}

export function validateReturnForm(form: ReturnForm, issuedAd: string, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!ISO.test(form.returnedAd)) errors.returnedAd = 'Choose the return date.';
  else if (form.returnedAd < issuedAd) errors.returnedAd = 'Returned before it was issued?';
  else if (form.returnedAd > today) errors.returnedAd = 'The return date cannot be in the future.';
  if (!(RETURN_CONDITIONS as readonly string[]).includes(form.condition)) errors.condition = 'Good, damaged or lost.';
  if ((form.condition === 'damaged' || form.condition === 'lost') && form.note.length < 5) errors.note = 'Say what happened (at least 5 characters).';
  return errors;
}

/** The asset status after a return: lost retires it, anything else makes it available again. */
export const statusAfterReturn = (condition: string): 'available' | 'retired' => (condition === 'lost' ? 'retired' : 'available');

import * as repo from '@/lib/repositories/letter.repository';
import { findAllEmploymentTypes } from '@/lib/repositories/employment-type.repository';
import { formatAmount } from '@/lib/kit/amount';
import { getCompanyProfileSetup } from '@/lib/repositories/company-setup.repository';
import { addressLine } from '@/lib/constants/nepal-locations';
import { DEFAULT_LETTER_TEMPLATES } from '@/lib/constants/letter-templates';
import { DEFAULT_DESIGN, normalizeDesign, validateDesign, type LetterDesign } from '@/lib/engines/letter-design.engine';
import {
  LETTER_KINDS,
  JOINING_PACK,
  LETTER_MERGE_FIELDS,
  formatLetterNumber,
  normalizePackForm,
  packLanguages,
  validatePackForm,
  inputFieldsFor,
  normalizeIssueForm,
  normalizeTemplateForm,
  renderLetterText,
  templateText,
  validateIssueForm,
  validateTemplateForm,
  validateVoidReason,
  type IssueLetterForm,
  type JoiningPackForm,
  type LetterLanguage,
  type LetterMergeField,
} from '@/lib/engines/letter.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import { adToBSString } from '@/lib/utils/bs-calendar';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import type { LetterDetail, LetterheadData, LetterListRow, LetterTemplateRow, LettersPageData } from '@/lib/types/letter';

// HR letters (G2): orchestration. Issue renders the chosen template with the
// employee's and company's facts and freezes the text under the fiscal year's
// next chalani number; a wrong letter is voided, never edited (S26: nobody
// issues or voids a letter about their own record).

export class LetterValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'LetterValidationError';
  }
}

export interface LetterCtx {
  userId: string;
  /** The acting user's linked employee (users.employeeId), for the own-record rule. */
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

const kindName = (kind: string, templates: LetterTemplateRow[]): string => {
  const preset = LETTER_KINDS.find((k) => k.code === kind);
  if (preset) return preset.name;
  return templates.find((t) => t.code === kind)?.name ?? kind;
};

/** Seeds every system template the company does not have yet (first read; later releases add new kinds the same way). */
export async function ensureDefaultTemplates(): Promise<void> {
  if ((await repo.countSystemTemplates()) >= DEFAULT_LETTER_TEMPLATES.length) return;
  await repo.insertDefaultTemplates(DEFAULT_LETTER_TEMPLATES);
}

const toListRow = (r: repo.LetterJoinedRow, templates: LetterTemplateRow[]): LetterListRow => ({
  id: r.id,
  letterNumber: r.letterNumber,
  kind: r.kind,
  kindName: kindName(r.kind, templates),
  language: r.language === 'np' ? 'np' : 'en',
  subject: r.subject,
  status: r.status === 'voided' ? 'voided' : 'issued',
  employeeId: r.employeeId,
  employeeName: r.employeeName,
  employeeCode: r.employeeCode,
  issuedDateBs: r.issuedDateBs,
  issuedDateAd: r.issuedDateAd,
  issuedByName: r.issuedByName ?? '—',
});

const toDetail = (r: repo.LetterJoinedRow, templates: LetterTemplateRow[]): LetterDetail => ({
  ...toListRow(r, templates),
  body: r.body,
  mergeData: (r.mergeData ?? {}) as Record<string, string>,
  voidReason: r.voidReason,
  voidedByName: r.voidedByName,
  voidedAt: r.voidedAt ? r.voidedAt.toISOString() : null,
});

export async function lettersPage(
  scope: ScopeFilter,
  permissions: { issue: boolean; templates: boolean; void: boolean },
  filter: repo.LetterFilter = {},
): Promise<LettersPageData> {
  await ensureDefaultTemplates();
  const scopeCondition = buildEmployeeScopeCondition(scope);
  const [letters, templates, employees, fiscalYears, head] = await Promise.all([
    repo.listLetters(filter, scopeCondition),
    repo.findTemplates(),
    repo.findEmployeeOptions(scopeCondition),
    repo.findFiscalYearsForLetters(),
    letterhead(),
  ]);
  return {
    letters: letters.map((r) => toListRow(r, templates)),
    templates,
    employees,
    fiscalYears: fiscalYears.map((f) => ({ id: f.id, label: f.label })),
    currentFiscalYearId: currentFiscalYear(fiscalYears)?.id ?? null,
    permissions,
    letterhead: head,
  };
}

function currentFiscalYear(years: repo.FiscalYearFacts[]): repo.FiscalYearFacts | null {
  const today = nepalToday();
  return (
    years.find((y) => y.startDateAD <= today && today <= y.endDateAD && y.status !== 'Locked') ??
    years.find((y) => y.status === 'Active') ??
    years[0] ??
    null
  );
}

// ---------------------------------------------------------------------------
// Merge data
// ---------------------------------------------------------------------------

export async function readDesign(): Promise<LetterDesign> {
  const json = await repo.readLetterDesignJson();
  if (!json) return DEFAULT_DESIGN;
  try {
    return normalizeDesign(JSON.parse(json));
  } catch {
    return DEFAULT_DESIGN;
  }
}

async function letterhead(): Promise<LetterheadData> {
  const [company, design] = await Promise.all([getCompanyProfileSetup().catch(() => null), readDesign()]);
  return {
    name: company?.displayName || company?.legalName || '',
    address: addressLine(company?.headOfficeAddress) ?? '',
    pan: company?.panVatNumber ?? '',
    signatoryName: company?.signatory1Name ?? '',
    signatoryTitle: company?.signatory1Title ?? '',
    signatory2Name: company?.signatory2Name ?? '',
    signatory2Title: company?.signatory2Title ?? '',
    regNo: company?.registrationNumber ?? '',
    phone: company?.contactPhone ?? '',
    email: company?.contactEmail ?? '',
    design,
  };
}

/** Saves the company's letter design (HR_LETTERS EDIT). The text of issued letters never changes. */
export async function saveDesign(raw: unknown): Promise<LetterDesign> {
  const errors = validateDesign(raw);
  if (Object.keys(errors).length) throw new LetterValidationError(errors);
  const design = normalizeDesign(raw);
  await repo.writeLetterDesignJson(JSON.stringify(design));
  return design;
}

function employeeMergeData(emp: repo.EmployeeLetterFacts): Record<string, string> {
  const joinAd = emp.joiningDate;
  let joinBs = '';
  try {
    joinBs = joinAd ? adToBSString(new Date(`${joinAd}T00:00:00`)) : '';
  } catch {
    joinBs = '';
  }
  return {
    employee_name: emp.fullName,
    employee_code: emp.employeeCode,
    designation: emp.designation,
    department: emp.department,
    branch: emp.branch,
    join_date_ad: joinAd ?? '',
    join_date_bs: joinBs,
    father_name: emp.fatherName,
    grandfather_name: emp.grandfatherName,
    citizenship_no: emp.citizenshipNo,
    employee_address: emp.permanentAddress,
    employee_mobile: emp.mobileNo,
  };
}

function companyMergeData(head: LetterheadData): Record<string, string> {
  return {
    company_name: head.name,
    company_address: head.address,
    company_pan: head.pan,
    signatory_name: head.signatoryName,
    signatory_title: head.signatoryTitle,
  };
}

// ---------------------------------------------------------------------------
// Preview and issue
// ---------------------------------------------------------------------------

export interface LetterPreview {
  subject: string;
  body: string;
  /** Fields the chosen template asks the issuer to type. */
  inputFields: LetterMergeField[];
  /** Values already known for the template's input fields (e.g. duties from the designation), to prefill the window. */
  defaults: Record<string, string>;
  /** Placeholders still without a value — issuing is blocked while any remain. */
  missing: string[];
  letterhead: LetterheadData;
  employee: { fullName: string; employeeCode: string; designation: string; department: string; branch: string } | null;
}

async function renderForIssue(form: IssueLetterForm, ctx: LetterCtx, seqText: string) {
  const template = form.templateId ? await repo.findTemplateById(form.templateId) : null;
  const formErrors = validateIssueForm(form, template);
  if (Object.keys(formErrors).length) throw new LetterValidationError(formErrors);
  const t = template!;

  const employee = form.employeeId ? await repo.findEmployeeForLetter(form.employeeId, buildEmployeeScopeCondition(ctx.scope)) : null;
  if (!employee) throw new LetterValidationError({ employeeId: 'Choose an employee (within your scope).' });

  const head = await letterhead();
  const today = nepalToday();
  const { subject, body } = templateText(t, form.language);
  const data: Record<string, string> = {
    ...employeeMergeData(employee),
    ...companyMergeData(head),
    letter_number: seqText,
    issue_date_bs: adToBSString(today),
    issue_date_ad: toIsoDate(today),
    // The designation's description is the starting point for a job description's duties.
    ...(employee.designationDescription.trim() ? { duties: employee.designationDescription.trim() } : {}),
    ...form.inputs,
  };
  return { template: t, employee, head, subject, body, data, today };
}

export async function previewLetter(rawForm: unknown, ctx: LetterCtx): Promise<LetterPreview> {
  const form = normalizeIssueForm(rawForm);
  const { subject, body, data, head, employee } = await renderForIssue(form, ctx, '—');
  const renderedBody = renderLetterText(body, data);
  const renderedSubject = renderLetterText(subject, data);
  // The chalani number only exists once the letter is issued.
  const missing = [...new Set([...renderedSubject.missing, ...renderedBody.missing])].filter((k) => k !== 'letter_number');
  return {
    subject: renderedSubject.text,
    body: renderedBody.text,
    inputFields: inputFieldsFor(body, subject),
    defaults: employee.designationDescription.trim() ? { duties: employee.designationDescription.trim() } : {},
    missing,
    letterhead: head,
    employee: {
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      designation: employee.designation,
      department: employee.department,
      branch: employee.branch,
    },
  };
}

export async function issueLetter(rawForm: unknown, ctx: LetterCtx): Promise<LetterDetail> {
  const form = normalizeIssueForm(rawForm);

  // S26 (the S21 pattern): nobody issues a formal letter about their own record.
  if (isOwnRecord(ctx.actorEmployeeId, form.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'HR_LETTERS', recordId: form.employeeId, result: DENIED_SELF });
    throw new UserFacingError('A letter about your own record must be issued by someone else.');
  }

  const years = await repo.findFiscalYearsForLetters();
  const fy = currentFiscalYear(years);
  if (!fy) throw new UserFacingError('Set up the current fiscal year before issuing letters.');

  const { template, subject, body, data, today } = await renderForIssue(form, ctx, '');

  // Every placeholder except the chalani number must have a value before issue.
  const probe = renderLetterText(`${subject}\n${body}`, { ...data, letter_number: 'x' });
  if (probe.missing.length) {
    throw new LetterValidationError(
      Object.fromEntries(probe.missing.map((k) => [`inputs.${k}`, 'Required for this template.'])),
    );
  }

  const row = await repo.issueLetterTx({
    employeeId: form.employeeId,
    templateId: template.id,
    kind: template.code,
    fiscalYearId: fy.id,
    language: form.language,
    render: (seq) => {
      const letterNumber = formatLetterNumber(seq, fy.label);
      const full = { ...data, letter_number: letterNumber };
      return {
        letterNumber,
        subject: renderLetterText(subject, full).text.slice(0, 200),
        body: renderLetterText(body, full).text,
        mergeData: full,
      };
    },
    issuedDateBs: adToBSString(today),
    issuedDateAd: toIsoDate(today),
    issuedBy: ctx.userId,
  });

  const detail = await repo.findLetterById(row.id);
  const templates = await repo.findTemplates();
  return toDetail(detail!, templates);
}

export async function voidIssuedLetter(id: string, reason: string, ctx: LetterCtx): Promise<LetterDetail> {
  const reasonError = validateVoidReason(reason);
  if (reasonError) throw new LetterValidationError({ reason: reasonError });

  const existing = await repo.findLetterById(id, buildEmployeeScopeCondition(ctx.scope));
  if (!existing) throw new UserFacingError('Not found: this letter is not in your scope.');
  if (existing.status !== 'issued') throw new UserFacingError('This letter is already voided.');

  // S26: nobody voids a letter about their own record either.
  if (isOwnRecord(ctx.actorEmployeeId, existing.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'DELETE', module: 'HR_LETTERS', recordId: id, result: DENIED_SELF });
    throw new UserFacingError('A letter about your own record must be voided by someone else.');
  }

  const row = await repo.voidLetter(id, reason.trim(), ctx.userId);
  if (!row) throw new UserFacingError('This letter is already voided.');
  const detail = await repo.findLetterById(id);
  const templates = await repo.findTemplates();
  return toDetail(detail!, templates);
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

export interface LetterPrintData {
  letter: LetterDetail;
  letterhead: LetterheadData;
}

export async function getLetterForPrint(id: string, scope: ScopeFilter): Promise<LetterPrintData | null> {
  const [row, templates, head] = await Promise.all([
    repo.findLetterById(id, buildEmployeeScopeCondition(scope)),
    repo.findTemplates(),
    letterhead(),
  ]);
  if (!row) return null;
  return { letter: toDetail(row, templates), letterhead: head };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function saveTemplate(id: string | null, raw: unknown, ctx: LetterCtx): Promise<LetterTemplateRow> {
  const form = normalizeTemplateForm((raw && typeof raw === 'object' ? raw : {}) as Record<string, never>);
  const errors = validateTemplateForm(form);
  if (Object.keys(errors).length) throw new LetterValidationError(errors);

  if (id) {
    const updated = await repo.updateTemplate(id, form, ctx.userId);
    if (!updated) throw new UserFacingError('Not found: this template no longer exists.');
    return updated;
  }
  try {
    return await repo.insertTemplate(form, ctx.userId);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      throw new LetterValidationError({ code: 'A template with this code already exists.' });
    }
    throw error;
  }
}

export async function removeTemplate(id: string): Promise<void> {
  const result = await repo.deleteTemplate(id);
  if (result === 'is_system') throw new UserFacingError('System templates cannot be deleted; deactivate instead.');
  if (result === 'in_use') throw new UserFacingError('This template has issued letters; deactivate it instead.');
  if (result === 'missing') throw new UserFacingError('Not found: this template no longer exists.');
}

// ---------------------------------------------------------------------------
// Joining pack
// ---------------------------------------------------------------------------

export interface PackKindPlan {
  code: string;
  name: string;
  nameNp: string;
  /** False when the company has no active template of this kind. */
  available: boolean;
  hasNepali: boolean;
}

export interface PackPlan {
  employee: { fullName: string; employeeCode: string; designation: string; branch: string };
  kinds: PackKindPlan[];
  /** The details the chosen letters ask the issuer for. */
  inputFields: LetterMergeField[];
  /** Values known from the employee's record (salary, probation, notice, duties), to prefill the window. */
  defaults: Record<string, string>;
  /** Input fields still empty across the chosen letters. */
  missingInputs: string[];
  /** Employee or company facts the letters need that the record does not have (fix the record first). */
  missingRecord: string[];
  /** Chosen kind+language versions that cannot be issued (no Nepali text). */
  unavailable: string[];
}

interface PackEntry {
  kind: string;
  language: LetterLanguage;
  templateId: string;
  subject: string;
  body: string;
}

async function packBase(form: JoiningPackForm, ctx: LetterCtx) {
  const formErrors = validatePackForm(form);
  if (Object.keys(formErrors).length) throw new LetterValidationError(formErrors);
  const employee = await repo.findEmployeeForLetter(form.employeeId, buildEmployeeScopeCondition(ctx.scope));
  if (!employee) throw new LetterValidationError({ employeeId: 'Choose an employee (within your scope).' });
  const [templates, head, facts, types] = await Promise.all([repo.findTemplates(), letterhead(), repo.findPackFacts(form.employeeId), findAllEmploymentTypes()]);
  const today = nepalToday();

  const defaults: Record<string, string> = {};
  const type = types.find((t) => t.name.toLowerCase() === (facts?.category ?? '').toLowerCase() || t.code.toLowerCase() === (facts?.category ?? '').toLowerCase());
  const joinBs = employeeMergeData(employee).join_date_bs;
  if (joinBs) defaults.effective_date = joinBs;
  if (facts?.basicSalary) defaults.basic_salary = formatAmount(facts.basicSalary);
  if (type && type.probationMonths > 0) defaults.probation_months = String(type.probationMonths);
  if (type && type.noticePeriodDays > 0) defaults.notice_days = String(type.noticePeriodDays);
  if (employee.designationDescription.trim()) defaults.duties = employee.designationDescription.trim();

  const data: Record<string, string> = {
    ...employeeMergeData(employee),
    ...companyMergeData(head),
    issue_date_bs: adToBSString(today),
    issue_date_ad: toIsoDate(today),
    letter_number: 'x',
    ...defaults,
    ...form.inputs,
  };

  const entries: PackEntry[] = [];
  const unavailable: string[] = [];
  const kinds: PackKindPlan[] = [];
  for (const code of JOINING_PACK) {
    const t = templates.find((x) => x.code === code && x.isActive);
    kinds.push({ code, name: t?.name ?? LETTER_KINDS.find((k) => k.code === code)?.name ?? code, nameNp: t?.nameNp ?? '', available: !!t, hasNepali: !!t && !!t.bodyNp && !!t.subjectNp });
    if (!t || !form.kinds.includes(code)) continue;
    for (const language of packLanguages(form.language)) {
      const text = templateText(t, language);
      if (!text.body || !text.subject) {
        unavailable.push(`${t.name} (${language === 'np' ? 'Nepali' : 'English'})`);
        continue;
      }
      entries.push({ kind: code, language, templateId: t.id, subject: text.subject, body: text.body });
    }
  }
  return { employee, kinds, entries, unavailable, data, defaults, form };
}

export async function planPack(rawForm: unknown, ctx: LetterCtx): Promise<PackPlan> {
  const { employee, kinds, entries, unavailable, data, defaults } = await packBase(normalizePackForm(rawForm), ctx);
  const inputKeys = new Set(LETTER_MERGE_FIELDS.filter((f) => f.source === 'input').map((f) => f.key));
  const inputFields = new Map<string, LetterMergeField>();
  const missing = new Set<string>();
  for (const e of entries) {
    for (const f of inputFieldsFor(e.body, e.subject)) inputFields.set(f.key, f);
    for (const k of renderLetterText(`${e.subject}\n${e.body}`, data).missing) missing.add(k);
  }
  const label = (k: string) => LETTER_MERGE_FIELDS.find((f) => f.key === k)?.label ?? k;
  return {
    employee: { fullName: employee.fullName, employeeCode: employee.employeeCode, designation: employee.designation, branch: employee.branch },
    kinds,
    inputFields: [...inputFields.values()],
    defaults,
    missingInputs: [...missing].filter((k) => inputKeys.has(k)),
    missingRecord: [...missing].filter((k) => !inputKeys.has(k)).map(label),
    unavailable,
  };
}

export interface PackResult {
  issued: LetterDetail[];
  failed: { kind: string; language: LetterLanguage; error: string }[];
}

/**
 * Issues the chosen letters for a new employee, each under its own chalani
 * number. Everything is checked first (no letter is issued if any detail is
 * missing); after that, one letter failing does not undo the ones issued.
 */
export async function issuePack(rawForm: unknown, ctx: LetterCtx): Promise<PackResult> {
  const form = normalizePackForm(rawForm);
  if (isOwnRecord(ctx.actorEmployeeId, form.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'HR_LETTERS', recordId: form.employeeId, result: DENIED_SELF });
    throw new UserFacingError('Letters about your own record must be issued by someone else.');
  }
  const { entries, unavailable, data, defaults } = await packBase(form, ctx);
  if (unavailable.length) throw new LetterValidationError({ language: `No text for: ${unavailable.join(', ')}.` });
  const errors: Record<string, string> = {};
  for (const e of entries) {
    for (const k of renderLetterText(`${e.subject}\n${e.body}`, data).missing) {
      const isInput = LETTER_MERGE_FIELDS.some((f) => f.key === k && f.source === 'input');
      if (isInput) errors[`inputs.${k}`] = 'Required for the chosen letters.';
      else errors.employeeId = "The employee's record lacks details these letters need; complete the record first.";
    }
  }
  if (Object.keys(errors).length) throw new LetterValidationError(errors);

  const result: PackResult = { issued: [], failed: [] };
  const inputs = { ...defaults, ...form.inputs };
  for (const e of entries) {
    try {
      result.issued.push(await issueLetter({ employeeId: form.employeeId, templateId: e.templateId, language: e.language, inputs }, ctx));
    } catch (error: unknown) {
      result.failed.push({ kind: e.kind, language: e.language, error: error instanceof Error ? error.message : 'Could not issue this letter.' });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Self-service: the signed-in employee's own letters (scope SELF, issued only)
// ---------------------------------------------------------------------------

export async function listMyLetters(scope: ScopeFilter): Promise<LetterListRow[]> {
  const [rows, templates] = await Promise.all([repo.listLetters({ status: 'issued' }, buildEmployeeScopeCondition(scope)), repo.findTemplates()]);
  return rows.map((r) => toListRow(r, templates));
}

/** One own letter for reading and printing; a voided letter is not shown to the employee. */
export async function getMyLetter(id: string, scope: ScopeFilter): Promise<LetterPrintData | null> {
  const data = await getLetterForPrint(id, scope);
  return data && data.letter.status === 'issued' ? data : null;
}

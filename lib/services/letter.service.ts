import * as repo from '@/lib/repositories/letter.repository';
import { getCompanyProfileSetup } from '@/lib/repositories/company-setup.repository';
import { addressLine } from '@/lib/constants/nepal-locations';
import { DEFAULT_LETTER_TEMPLATES } from '@/lib/constants/letter-templates';
import {
  LETTER_KINDS,
  formatLetterNumber,
  inputFieldsFor,
  normalizeIssueForm,
  normalizeTemplateForm,
  renderLetterText,
  templateText,
  validateIssueForm,
  validateTemplateForm,
  validateVoidReason,
  type IssueLetterForm,
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

/** Seeds the six system templates once per company (first read). */
export async function ensureDefaultTemplates(): Promise<void> {
  if ((await repo.countTemplates()) > 0) return;
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
  const [letters, templates, employees, fiscalYears] = await Promise.all([
    repo.listLetters(filter, scopeCondition),
    repo.findTemplates(),
    repo.findEmployeeOptions(scopeCondition),
    repo.findFiscalYearsForLetters(),
  ]);
  return {
    letters: letters.map((r) => toListRow(r, templates)),
    templates,
    employees,
    fiscalYears: fiscalYears.map((f) => ({ id: f.id, label: f.label })),
    currentFiscalYearId: currentFiscalYear(fiscalYears)?.id ?? null,
    permissions,
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

async function letterhead(): Promise<LetterheadData> {
  const company = await getCompanyProfileSetup().catch(() => null);
  return {
    name: company?.displayName || company?.legalName || '',
    address: addressLine(company?.headOfficeAddress) ?? '',
    pan: company?.panVatNumber ?? '',
    signatoryName: company?.signatory1Name ?? '',
    signatoryTitle: company?.signatory1Title ?? '',
  };
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

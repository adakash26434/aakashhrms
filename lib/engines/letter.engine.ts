// HR letters (G2, docs/redesign/06-hrms-gap-analysis.md): pure template and
// numbering logic — no database access, unit-tested in tests/letter.test.ts.
//
// A letter is rendered from a bilingual template at issue time by replacing
// {{merge_field}} placeholders. The rendered subject and body are stored and
// never change afterwards; a wrong letter is voided (its chalani number is
// never reused) and a corrected one issued.

export type LetterLanguage = 'en' | 'np';

export const LETTER_LANGUAGES: readonly LetterLanguage[] = ['en', 'np'];

/** The system templates seeded for every company (editable, never deletable). */
export const LETTER_KINDS = [
  { code: 'appointment', name: 'Appointment letter', nameNp: 'नियुक्ति पत्र' },
  { code: 'confirmation', name: 'Confirmation letter', nameNp: 'स्थायी नियुक्ति पत्र' },
  { code: 'promotion', name: 'Promotion letter', nameNp: 'बढुवा पत्र' },
  { code: 'transfer', name: 'Transfer letter', nameNp: 'सरुवा पत्र' },
  { code: 'experience', name: 'Experience letter', nameNp: 'कार्य अनुभव पत्र' },
  { code: 'noc', name: 'No objection letter', nameNp: 'सहमति पत्र' },
  { code: 'kyc', name: 'KYC declaration', nameNp: 'केवाईसी घोषणा' },
  { code: 'dhanjamani', name: 'Guarantee (dhanjamani)', nameNp: 'धनजमानी' },
  { code: 'job_description', name: 'Job description', nameNp: 'कार्यविवरण' },
  { code: 'agreement', name: 'Employment agreement', nameNp: 'रोजगार सम्झौता' },
] as const;

/** The letters a new employee is given at joining, in this order (the "joining pack"). */
export const JOINING_PACK = ['appointment', 'job_description', 'agreement', 'kyc', 'dhanjamani'] as const;

export type LetterKindCode = (typeof LETTER_KINDS)[number]['code'];

/** Where a merge field's value comes from when a letter is issued. */
export type MergeFieldSource = 'employee' | 'company' | 'letter' | 'input';

export interface LetterMergeField {
  key: string;
  label: string;
  /** employee / company / letter fields fill themselves; input fields are typed in the Issue window. */
  source: MergeFieldSource;
}

export const LETTER_MERGE_FIELDS: readonly LetterMergeField[] = [
  { key: 'employee_name', label: 'Employee name', source: 'employee' },
  { key: 'employee_code', label: 'Employee code', source: 'employee' },
  { key: 'designation', label: 'Designation', source: 'employee' },
  { key: 'department', label: 'Department', source: 'employee' },
  { key: 'branch', label: 'Branch', source: 'employee' },
  { key: 'join_date_bs', label: 'Joining date (BS)', source: 'employee' },
  { key: 'join_date_ad', label: 'Joining date (AD)', source: 'employee' },
  { key: 'father_name', label: 'Father\'s name', source: 'employee' },
  { key: 'grandfather_name', label: 'Grandfather\'s name', source: 'employee' },
  { key: 'citizenship_no', label: 'Citizenship no.', source: 'employee' },
  { key: 'employee_address', label: 'Permanent address', source: 'employee' },
  { key: 'employee_mobile', label: 'Mobile no.', source: 'employee' },
  { key: 'company_name', label: 'Company name', source: 'company' },
  { key: 'company_address', label: 'Company address', source: 'company' },
  { key: 'company_pan', label: 'Company PAN / VAT', source: 'company' },
  { key: 'signatory_name', label: 'Signatory name', source: 'company' },
  { key: 'signatory_title', label: 'Signatory title', source: 'company' },
  { key: 'letter_number', label: 'Letter (chalani) number', source: 'letter' },
  { key: 'issue_date_bs', label: 'Issue date (BS)', source: 'letter' },
  { key: 'issue_date_ad', label: 'Issue date (AD)', source: 'letter' },
  { key: 'effective_date', label: 'Effective date', source: 'input' },
  { key: 'new_designation', label: 'New designation', source: 'input' },
  { key: 'previous_designation', label: 'Previous designation', source: 'input' },
  { key: 'new_branch', label: 'New branch', source: 'input' },
  { key: 'previous_branch', label: 'Previous branch', source: 'input' },
  { key: 'new_grade', label: 'New grade / level', source: 'input' },
  { key: 'basic_salary', label: 'Basic salary (monthly)', source: 'input' },
  { key: 'total_salary', label: 'Total salary (monthly)', source: 'input' },
  { key: 'probation_months', label: 'Probation (months)', source: 'input' },
  { key: 'last_working_day', label: 'Last working day', source: 'input' },
  { key: 'purpose', label: 'Purpose (NOC)', source: 'input' },
  { key: 'remarks', label: 'Remarks', source: 'input' },
  { key: 'duties', label: 'Duties and responsibilities', source: 'input' },
  { key: 'reports_to', label: 'Reports to', source: 'input' },
  { key: 'working_hours', label: 'Working hours', source: 'input' },
  { key: 'agreement_term', label: 'Agreement term', source: 'input' },
  { key: 'notice_days', label: 'Notice period (days)', source: 'input' },
  { key: 'guarantor_name', label: 'Guarantor name', source: 'input' },
  { key: 'guarantor_father', label: 'Guarantor\'s father', source: 'input' },
  { key: 'guarantor_relation', label: 'Guarantor\'s relation', source: 'input' },
  { key: 'guarantor_address', label: 'Guarantor address', source: 'input' },
  { key: 'guarantor_citizenship', label: 'Guarantor citizenship no.', source: 'input' },
  { key: 'guarantee_amount', label: 'Guarantee amount (NPR)', source: 'input' },
];

/** Input fields that may run to several lines (everything else is one short line). */
export const LONG_INPUT_FIELDS: ReadonlySet<string> = new Set(['duties', 'remarks']);
const INPUT_MAX = 200;
const LONG_INPUT_MAX = 3000;

const KNOWN_KEYS = new Set(LETTER_MERGE_FIELDS.map((f) => f.key));

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

// Condition blocks: {{#if key}}…{{/if}} keeps its text only when `key` has a
// value (so a clause such as the probation sentence appears only when the
// issuer filled that field). Blocks do not nest.
const CONDITION = /\{\{#if\s+([a-z][a-z0-9_]*)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g;

/**
 * Applies {{#if key}}…{{/if}} blocks: the block's text stays when the key has
 * a non-empty value, otherwise it is removed (with any space it leaves
 * behind). Placeholders inside a removed block are not required.
 */
export function applyConditions(body: string, data: Record<string, string>): string {
  return body
    .replace(CONDITION, (_whole, key: string, inner: string) => ((data[key] ?? '').trim() ? inner : ''))
    .replace(/[ \t]+([.,;।])/g, '$1') // a removed mid-sentence block leaves no space before punctuation
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Unbalanced or nested {{#if}} / {{/if}} tags, reported at template save. */
export function conditionErrors(body: string): string | null {
  const tokens = body.match(/\{\{#if\s+[a-z][a-z0-9_]*\s*\}\}|\{\{\/if\}\}/g) ?? [];
  let open = 0;
  for (const t of tokens) {
    if (t.startsWith('{{#if')) {
      open += 1;
      if (open > 1) return 'Condition blocks ({{#if …}}) cannot be nested.';
    } else {
      open -= 1;
      if (open < 0) return 'A {{/if}} has no matching {{#if …}}.';
    }
  }
  if (open > 0) return 'A {{#if …}} block is never closed with {{/if}}.';
  const badIf = body.match(/\{\{#(?!if\s+[a-z][a-z0-9_]*\s*\}\})[^}]*\}\}/);
  if (badIf) return `Unknown block: ${badIf[0]}.`;
  return null;
}

/** Every distinct {{placeholder}} key in a template body, in order of first use (condition keys included). */
export function extractPlaceholders(body: string): string[] {
  const keys: string[] = [];
  for (const match of body.matchAll(/\{\{#if\s+([a-z][a-z0-9_]*)\s*\}\}/g)) {
    if (!keys.includes(match[1])) keys.push(match[1]);
  }
  for (const match of body.replace(/\{\{#if\s+[a-z][a-z0-9_]*\s*\}\}|\{\{\/if\}\}/g, '').matchAll(PLACEHOLDER)) {
    if (!keys.includes(match[1])) keys.push(match[1]);
  }
  return keys;
}

/** The input-source fields a template actually uses — what the Issue window asks for. */
export function inputFieldsFor(body: string, subject: string): LetterMergeField[] {
  const used = new Set([...extractPlaceholders(body), ...extractPlaceholders(subject)]);
  return LETTER_MERGE_FIELDS.filter((f) => f.source === 'input' && used.has(f.key));
}

export interface RenderedLetter {
  text: string;
  /** Placeholder keys with no (non-empty) value — issuing is refused while any remain. */
  missing: string[];
  /** Placeholder keys that are not known merge fields (typo guard, reported at save and issue). */
  unknown: string[];
}

/**
 * Renders a template: condition blocks first ({{#if key}} clauses survive only
 * with a value, and their inner fields are only required then), then {{key}}
 * replacement; empty or absent values stay as readable gaps and are reported.
 */
export function renderLetterText(body: string, data: Record<string, string>): RenderedLetter {
  const missing: string[] = [];
  const unknown: string[] = [];
  const text = applyConditions(body, data).replace(PLACEHOLDER, (_whole, key: string) => {
    const value = (data[key] ?? '').trim();
    if (!KNOWN_KEYS.has(key) && !unknown.includes(key)) unknown.push(key);
    if (value) return value;
    if (!missing.includes(key)) missing.push(key);
    return `⟨${key}⟩`;
  });
  return { text, missing, unknown };
}

/**
 * The chalani (dispatch) number shown on the letter: `<seq>/<fiscal year>`,
 * e.g. seq 12 in "FY 2082/83" → "12/2082-83". The sequence restarts each
 * fiscal year; the stored (fiscalYearId, seq) pair is unique, so a voided
 * letter's number is never reused.
 */
export function formatLetterNumber(seq: number, fiscalYearLabel: string): string {
  const m = fiscalYearLabel.match(/(\d{4})\s*[/-]\s*(\d{2,4})/);
  const fy = m ? `${m[1]}-${m[2]}` : fiscalYearLabel.replace(/^FY\s*/i, '').trim();
  return `${seq}/${fy}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface LetterTemplateForm {
  code: string;
  name: string;
  nameNp: string;
  subjectEn: string;
  subjectNp: string;
  bodyEn: string;
  bodyNp: string;
  isActive: boolean;
}

/** Cleans a template form: trims everything, lower-cases the code. */
export function normalizeTemplateForm(raw: Partial<LetterTemplateForm>): LetterTemplateForm {
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return {
    code: s(raw.code, 30).toLowerCase(),
    name: s(raw.name, 100),
    nameNp: s(raw.nameNp, 100),
    subjectEn: s(raw.subjectEn, 200),
    subjectNp: s(raw.subjectNp, 200),
    bodyEn: typeof raw.bodyEn === 'string' ? raw.bodyEn.trim().slice(0, 20000) : '',
    bodyNp: typeof raw.bodyNp === 'string' ? raw.bodyNp.trim().slice(0, 20000) : '',
    isActive: raw.isActive !== false,
  };
}

export function validateTemplateForm(form: LetterTemplateForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[a-z0-9][a-z0-9_-]{1,29}$/.test(form.code)) errors.code = 'Code: 2–30 letters, digits, - or _.';
  if (!form.name) errors.name = 'Name is required.';
  if (!form.subjectEn) errors.subjectEn = 'The English subject is required.';
  if (!form.bodyEn) errors.bodyEn = 'The English body is required.';
  if ((form.bodyNp && !form.subjectNp) || (!form.bodyNp && form.subjectNp)) {
    errors.bodyNp = 'Nepali needs both a subject and a body (or neither).';
  }
  for (const [field, text] of [['bodyEn', form.bodyEn], ['bodyNp', form.bodyNp], ['subjectEn', form.subjectEn], ['subjectNp', form.subjectNp]] as const) {
    const bad = extractPlaceholders(text).filter((k) => !KNOWN_KEYS.has(k));
    if (bad.length) errors[field] = `Unknown merge field${bad.length > 1 ? 's' : ''}: ${bad.map((k) => `{{${k}}}`).join(', ')}.`;
    const condition = conditionErrors(text);
    if (condition && !errors[field]) errors[field] = condition;
  }
  return errors;
}

export interface IssueLetterForm {
  employeeId: string;
  templateId: string;
  language: LetterLanguage;
  /** Values for the template's input-source fields, by key. */
  inputs: Record<string, string>;
}

export function normalizeIssueForm(raw: unknown): IssueLetterForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const inputs: Record<string, string> = {};
  const rawInputs = (r.inputs && typeof r.inputs === 'object' ? r.inputs : {}) as Record<string, unknown>;
  for (const field of LETTER_MERGE_FIELDS) {
    if (field.source !== 'input') continue;
    const v = rawInputs[field.key];
    if (typeof v === 'string' && v.trim()) inputs[field.key] = v.trim().slice(0, LONG_INPUT_FIELDS.has(field.key) ? LONG_INPUT_MAX : INPUT_MAX);
  }
  return {
    employeeId: typeof r.employeeId === 'string' ? r.employeeId : '',
    templateId: typeof r.templateId === 'string' ? r.templateId : '',
    language: r.language === 'np' ? 'np' : 'en',
    inputs,
  };
}

// ---------------------------------------------------------------------------
// Joining pack: the papers a new employee is given together
// ---------------------------------------------------------------------------

export type PackLanguage = LetterLanguage | 'both';

export interface JoiningPackForm {
  employeeId: string;
  language: PackLanguage;
  /** Template codes from JOINING_PACK, in pack order. */
  kinds: string[];
  /** Values for the input fields the chosen letters use, by key (shared by all of them). */
  inputs: Record<string, string>;
}

export function normalizePackForm(raw: unknown): JoiningPackForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const asked = new Set(Array.isArray(r.kinds) ? r.kinds.filter((k): k is string => typeof k === 'string') : []);
  return {
    employeeId: typeof r.employeeId === 'string' ? r.employeeId : '',
    language: r.language === 'np' || r.language === 'both' ? r.language : 'en',
    kinds: JOINING_PACK.filter((k) => asked.has(k)),
    inputs: normalizeIssueForm({ inputs: r.inputs }).inputs,
  };
}

export function validatePackForm(form: JoiningPackForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.employeeId) errors.employeeId = 'Choose an employee.';
  if (form.kinds.length === 0) errors.kinds = 'Choose at least one letter.';
  return errors;
}

/** The language versions a pack issues for each letter. */
export const packLanguages = (language: PackLanguage): LetterLanguage[] => (language === 'both' ? ['en', 'np'] : [language]);

export interface TemplateForIssue {
  subjectEn: string;
  subjectNp: string;
  bodyEn: string;
  bodyNp: string;
  isActive: boolean;
}

/** Form-level checks before rendering (field values come later from the service). */
export function validateIssueForm(form: IssueLetterForm, template: TemplateForIssue | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.employeeId) errors.employeeId = 'Choose an employee.';
  if (!form.templateId || !template) errors.templateId = 'Choose a letter template.';
  else if (!template.isActive) errors.templateId = 'This template is inactive.';
  else if (form.language === 'np' && (!template.bodyNp || !template.subjectNp)) {
    errors.language = 'This template has no Nepali version yet.';
  }
  return errors;
}

/** The subject and body of the chosen language. */
export function templateText(template: TemplateForIssue, language: LetterLanguage): { subject: string; body: string } {
  return language === 'np'
    ? { subject: template.subjectNp, body: template.bodyNp }
    : { subject: template.subjectEn, body: template.bodyEn };
}

export function validateVoidReason(reason: string): string | null {
  const r = reason.trim();
  if (r.length < 5) return 'Give the reason this letter is being voided (at least 5 characters).';
  if (r.length > 500) return 'Keep the reason under 500 characters.';
  return null;
}

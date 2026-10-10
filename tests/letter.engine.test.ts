import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LETTER_TEMPLATES } from '../lib/constants/letter-templates';
import {
  JOINING_PACK,
  LETTER_KINDS,
  applyConditions,
  conditionErrors,
  LETTER_MERGE_FIELDS,
  extractPlaceholders,
  formatLetterNumber,
  inputFieldsFor,
  normalizeIssueForm,
  normalizeTemplateForm,
  renderLetterText,
  templateText,
  validateIssueForm,
  validateTemplateForm,
  validateVoidReason,
} from '../lib/engines/letter.engine';

// HR letters (G2): templates render by replacing {{merge_field}} placeholders;
// the chalani number is one sequence per fiscal year and is never reused.

describe('letter.engine placeholders', () => {
  it('extracts each distinct placeholder once, in order of first use', () => {
    assert.deepEqual(
      extractPlaceholders('Dear {{employee_name}}, {{ designation }} at {{branch}}. Regards, {{employee_name}}'),
      ['employee_name', 'designation', 'branch'],
    );
  });

  it('ignores malformed and uppercase placeholders', () => {
    assert.deepEqual(extractPlaceholders('{{Employee_Name}} {single} {{9bad}} {{ok_1}}'), ['ok_1']);
  });

  it('lists the input-source fields a template uses, for the Issue window', () => {
    const fields = inputFieldsFor('Effective {{effective_date}} as {{new_designation}} for {{employee_name}}', 'Re {{purpose}}');
    assert.deepEqual(fields.map((f) => f.key), ['effective_date', 'new_designation', 'purpose']);
    assert.ok(fields.every((f) => f.source === 'input'));
  });
});

describe('letter.engine render', () => {
  it('replaces placeholders with values', () => {
    const out = renderLetterText('Dear {{employee_name}}, welcome to {{company_name}}.', {
      employee_name: 'Sita Sharma',
      company_name: 'Aakash Sahakari',
    });
    assert.equal(out.text, 'Dear Sita Sharma, welcome to Aakash Sahakari.');
    assert.deepEqual(out.missing, []);
    assert.deepEqual(out.unknown, []);
  });

  it('reports empty and absent values as missing, once each, and leaves a readable gap', () => {
    const out = renderLetterText('{{employee_name}} / {{designation}} / {{designation}}', { employee_name: '  ' });
    assert.deepEqual(out.missing, ['employee_name', 'designation']);
    assert.ok(out.text.includes('⟨designation⟩'));
  });

  it('reports placeholders that are not known merge fields', () => {
    const out = renderLetterText('Hello {{emp_nam}}', { emp_nam: 'typo value' });
    assert.deepEqual(out.unknown, ['emp_nam']);
    assert.equal(out.text, 'Hello typo value');
  });
});

describe('letter.engine chalani number', () => {
  it('formats seq within the fiscal year label', () => {
    assert.equal(formatLetterNumber(12, 'FY 2082/83'), '12/2082-83');
    assert.equal(formatLetterNumber(1, '2081-82'), '1/2081-82');
  });

  it('falls back to the raw label when it has no year pair', () => {
    assert.equal(formatLetterNumber(3, 'FY Special'), '3/Special');
  });
});

describe('letter.engine template form', () => {
  const base = normalizeTemplateForm({
    code: ' Appointment ',
    name: 'Appointment letter',
    subjectEn: 'Appointment',
    bodyEn: 'Dear {{employee_name}}',
  });

  it('normalizes: trims and lower-cases the code', () => {
    assert.equal(base.code, 'appointment');
    assert.equal(base.isActive, true);
  });

  it('accepts a complete English-only template', () => {
    assert.deepEqual(validateTemplateForm(base), {});
  });

  it('requires code, name, English subject and body', () => {
    const errors = validateTemplateForm(normalizeTemplateForm({}));
    for (const key of ['code', 'name', 'subjectEn', 'bodyEn']) assert.ok(errors[key], key);
  });

  it('requires Nepali subject and body together', () => {
    const errors = validateTemplateForm({ ...base, bodyNp: 'प्रिय {{employee_name}}' });
    assert.ok(errors.bodyNp);
    assert.deepEqual(validateTemplateForm({ ...base, bodyNp: 'प्रिय {{employee_name}}', subjectNp: 'नियुक्ति' }), {});
  });

  it('rejects unknown merge fields in any text (typo guard)', () => {
    const errors = validateTemplateForm({ ...base, bodyEn: 'Dear {{emplyee_name}}' });
    assert.match(errors.bodyEn, /\{\{emplyee_name\}\}/);
  });
});

describe('letter.engine issue form', () => {
  const template = { subjectEn: 'S', subjectNp: 'वि', bodyEn: 'B {{remarks}}', bodyNp: 'ब {{remarks}}', isActive: true };

  it('normalizes: keeps only known input-source fields, trimmed', () => {
    const form = normalizeIssueForm({
      employeeId: 'e1',
      templateId: 't1',
      language: 'np',
      inputs: { remarks: '  ok  ', employee_name: 'spoofed', made_up: 'x' },
    });
    assert.deepEqual(form.inputs, { remarks: 'ok' });
    assert.equal(form.language, 'np');
  });

  it('auto-filled fields can never be overridden from the form', () => {
    const form = normalizeIssueForm({ inputs: { company_name: 'Fake Co', letter_number: '999/9999' } });
    assert.deepEqual(form.inputs, {});
  });

  it('requires employee and template', () => {
    const errors = validateIssueForm(normalizeIssueForm({}), null);
    assert.ok(errors.employeeId);
    assert.ok(errors.templateId);
  });

  it('refuses Nepali when the template has no Nepali version', () => {
    const enOnly = { ...template, subjectNp: '', bodyNp: '' };
    const form = normalizeIssueForm({ employeeId: 'e1', templateId: 't1', language: 'np' });
    assert.ok(validateIssueForm(form, enOnly).language);
    assert.deepEqual(validateIssueForm(form, template), {});
  });

  it('refuses an inactive template', () => {
    const form = normalizeIssueForm({ employeeId: 'e1', templateId: 't1' });
    assert.ok(validateIssueForm(form, { ...template, isActive: false }).templateId);
  });

  it('picks the chosen language text', () => {
    assert.equal(templateText(template, 'en').body, 'B {{remarks}}');
    assert.equal(templateText(template, 'np').subject, 'वि');
  });
});

describe('letter.engine void reason', () => {
  it('requires a real reason', () => {
    assert.ok(validateVoidReason('  no '));
    assert.equal(validateVoidReason('Issued to the wrong employee.'), null);
    assert.ok(validateVoidReason('x'.repeat(501)));
  });
});

describe('letter.engine constants', () => {
  it('has the system letter kinds, one default template each', () => {
    assert.deepEqual(
      LETTER_KINDS.map((k) => k.code),
      ['appointment', 'confirmation', 'promotion', 'transfer', 'experience', 'noc', 'kyc', 'dhanjamani', 'job_description', 'agreement'],
    );
    assert.deepEqual(DEFAULT_LETTER_TEMPLATES.map((t) => t.code), LETTER_KINDS.map((k) => k.code));
  });

  it('every default template is valid in both languages and uses only known fields', () => {
    for (const t of DEFAULT_LETTER_TEMPLATES) {
      const errors = validateTemplateForm(normalizeTemplateForm({ ...t, isActive: true }));
      assert.deepEqual(errors, {}, t.code);
      assert.ok(t.bodyNp && t.subjectNp, `${t.code} has a Nepali version`);
      for (const language of ['en', 'np'] as const) {
        const { subject, body } = templateText({ ...t, isActive: true }, language);
        const all: Record<string, string> = Object.fromEntries(LETTER_MERGE_FIELDS.map((f) => [f.key, `<${f.key}>`]));
        const r = renderLetterText(`${subject}\n${body}`, all);
        assert.deepEqual(r.unknown, [], `${t.code}/${language}`);
        assert.deepEqual(r.missing, [], `${t.code}/${language}`);
      }
    }
  });

  it('optional clauses drop out cleanly: no guarantee amount, no father name, no notice period', () => {
    const base: Record<string, string> = Object.fromEntries(LETTER_MERGE_FIELDS.map((f) => [f.key, `<${f.key}>`]));
    const dhan = DEFAULT_LETTER_TEMPLATES.find((t) => t.code === 'dhanjamani')!;
    const text = renderLetterText(dhan.bodyEn, { ...base, guarantee_amount: '' }).text;
    assert.ok(!text.includes('up to NPR'));
    assert.ok(!text.includes('<guarantee_amount>'));
    const np = renderLetterText(dhan.bodyNp, { ...base, guarantee_amount: '', guarantor_father: '' });
    assert.deepEqual(np.missing, []);
    const kyc = renderLetterText(DEFAULT_LETTER_TEMPLATES.find((t) => t.code === 'kyc')!.bodyEn, { ...base, father_name: '', grandfather_name: '' }).text;
    assert.ok(!kyc.includes('son/daughter of'));
  });

  it('the job description keeps one line per fact and drops the unused ones', () => {
    const base: Record<string, string> = Object.fromEntries(LETTER_MERGE_FIELDS.map((f) => [f.key, `<${f.key}>`]));
    const jd = DEFAULT_LETTER_TEMPLATES.find((t) => t.code === 'job_description')!;
    const text = renderLetterText(jd.bodyEn, { ...base, reports_to: '', working_hours: '' }).text;
    assert.ok(!text.includes('Reports to') && !text.includes('Working hours'));
    assert.ok(text.includes('Place of work: <branch> office\n\nDuties and responsibilities'));
  });

  it('long input fields keep several lines; short ones are cut to a line length', () => {
    const form = normalizeIssueForm({ inputs: { duties: 'a\n'.repeat(500), guarantor_name: 'x'.repeat(500) } });
    assert.ok(form.inputs.duties.length > 200 && form.inputs.duties.length <= 3000);
    assert.equal(form.inputs.guarantor_name.length, 200);
  });

  it('the joining pack lists only known kinds', () => {
    for (const code of JOINING_PACK) assert.ok(LETTER_KINDS.some((k) => k.code === code), code);
  });

  it('merge field keys are unique and lowercase', () => {
    const keys = LETTER_MERGE_FIELDS.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.every((k) => /^[a-z][a-z0-9_]*$/.test(k)));
  });
});

describe('letter.engine condition blocks ({{#if}})', () => {

  it('keeps a block only when its key has a value', () => {
    const body = 'Appointed.{{#if probation_months}} Probation of {{probation_months}} months applies.{{/if}} Welcome.';
    assert.equal(
      renderLetterText(body, { probation_months: '6' }).text,
      'Appointed. Probation of 6 months applies. Welcome.',
    );
    const without = renderLetterText(body, {});
    assert.equal(without.text, 'Appointed. Welcome.');
    assert.deepEqual(without.missing, []); // fields inside a removed block are not required
  });

  it('cleans the space a removed mid-sentence block leaves behind', () => {
    assert.equal(applyConditions('Transferred {{#if remarks}}({{remarks}}) {{/if}}today.', {}), 'Transferred today.');
    assert.equal(applyConditions('A {{#if x}}gone {{/if}}, B.', {}), 'A, B.');
  });

  it('collapses blank lines left by a removed paragraph block', () => {
    const body = 'Para one.\n\n{{#if remarks}}{{remarks}}\n\n{{/if}}Para two.';
    assert.equal(applyConditions(body, {}), 'Para one.\n\nPara two.');
  });

  it('reports unbalanced and nested blocks at save time', () => {
    assert.ok(conditionErrors('{{#if remarks}}never closed'));
    assert.ok(conditionErrors('closed never{{/if}}'));
    assert.ok(conditionErrors('{{#if a}}{{#if b}}no nesting{{/if}}{{/if}}'));
    assert.equal(conditionErrors('{{#if remarks}}fine{{/if}} and {{#if purpose}}fine{{/if}}'), null);
    const errors = validateTemplateForm(normalizeTemplateForm({ code: 'x1', name: 'X', subjectEn: 'S', bodyEn: '{{#if remarks}}oops' }));
    assert.ok(errors.bodyEn);
  });

  it('counts condition keys as used fields for the Issue window', () => {
    const fields = inputFieldsFor('{{#if remarks}}{{remarks}}{{/if}}', '');
    assert.deepEqual(fields.map((f) => f.key), ['remarks']);
  });
});

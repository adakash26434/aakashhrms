// Disciplinary & grievance cases (G8, docs/redesign/06-hrms-gap-analysis.md):
// pure rules, no database access, unit-tested in tests/case.engine.test.ts.
//
// One case moves open → investigating → decided → closed (open may go straight
// to decided for a plain finding). A decision needs an outcome from the list
// for its category and a written reason. Terminating someone is NOT an outcome
// here: a serious disciplinary case can only recommend it, and the actual exit
// runs through the exit workflow (G5).

export const CASE_CATEGORIES = [
  { code: 'disciplinary', name: 'Disciplinary', nameNp: 'अनुशासन' },
  { code: 'grievance', name: 'Grievance', nameNp: 'गुनासो' },
] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number]['code'];

export const SEVERITIES = [
  { code: 'minor', name: 'Minor' },
  { code: 'major', name: 'Major' },
  { code: 'serious', name: 'Serious' },
] as const;
export type CaseSeverity = (typeof SEVERITIES)[number]['code'];

export const CASE_STATUSES = ['open', 'investigating', 'decided', 'closed'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const OUTCOMES: Record<CaseCategory, { code: string; name: string; nameNp: string }[]> = {
  disciplinary: [
    { code: 'no_action', name: 'No action', nameNp: 'कारबाही नगर्ने' },
    { code: 'verbal_warning', name: 'Verbal warning', nameNp: 'मौखिक चेतावनी' },
    { code: 'written_warning', name: 'Written warning', nameNp: 'लिखित चेतावनी' },
    { code: 'final_warning', name: 'Final warning', nameNp: 'अन्तिम चेतावनी' },
    { code: 'suspension', name: 'Suspension', nameNp: 'निलम्बन' },
    { code: 'termination_recommended', name: 'Recommend termination', nameNp: 'बर्खास्तीको सिफारिस' },
  ],
  grievance: [
    { code: 'upheld', name: 'Upheld', nameNp: 'गुनासो सदर' },
    { code: 'partly_upheld', name: 'Partly upheld', nameNp: 'आंशिक सदर' },
    { code: 'not_upheld', name: 'Not upheld', nameNp: 'खारेज' },
    { code: 'resolved_informally', name: 'Resolved informally', nameNp: 'आपसी समाधान' },
  ],
};

export const categoryOf = (code: string) => CASE_CATEGORIES.find((c) => c.code === code);
export const outcomeOf = (category: string, code: string) => OUTCOMES[category as CaseCategory]?.find((o) => o.code === code);

/** The statuses a case may move to from `from` (investigate, decide, close). */
export function nextStatuses(from: string): CaseStatus[] {
  switch (from) {
    case 'open':
      return ['investigating', 'decided'];
    case 'investigating':
      return ['decided'];
    case 'decided':
      return ['closed'];
    default:
      return [];
  }
}

export const canMove = (from: string, to: string): boolean => (nextStatuses(from) as string[]).includes(to);

/** Notes and attachments are allowed until the case is closed. */
export const acceptsNotes = (status: string): boolean => status !== 'closed';

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export interface CaseOpenForm {
  category: CaseCategory | '';
  employeeId: string;
  severity: CaseSeverity | '';
  title: string;
  description: string;
}

export function normalizeOpenForm(raw: unknown): CaseOpenForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    category: categoryOf(s(r.category, 20)) ? (s(r.category, 20) as CaseCategory) : '',
    employeeId: s(r.employeeId, 64),
    severity: SEVERITIES.some((x) => x.code === r.severity) ? (r.severity as CaseSeverity) : '',
    title: s(r.title, 200),
    description: s(r.description, 4000),
  };
}

export function validateOpenForm(form: CaseOpenForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.category) errors.category = 'Disciplinary or grievance.';
  if (!form.employeeId) errors.employeeId = form.category === 'grievance' ? 'Choose who raised the grievance.' : 'Choose the employee.';
  if (!form.severity) errors.severity = 'Choose the severity.';
  if (form.title.length < 5) errors.title = 'Give the case a short title (at least 5 characters).';
  if (form.description.length < 10) errors.description = 'Describe what happened (at least 10 characters).';
  return errors;
}

export interface DecisionForm {
  outcome: string;
  note: string;
}

export function normalizeDecisionForm(raw: unknown): DecisionForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { outcome: s(r.outcome, 30), note: s(r.note, 2000) };
}

/**
 * A decision needs an outcome that exists for the category and a written
 * reason. Severity is respected both ways: a minor case cannot recommend
 * termination, and a serious one cannot be closed with "no action" without
 * a fuller reason (30+ characters).
 */
export function validateDecision(category: string, severity: string, form: DecisionForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const outcome = outcomeOf(category, form.outcome);
  if (!outcome) {
    errors.outcome = 'Choose an outcome.';
    return errors;
  }
  if (form.note.length < 10) errors.note = 'Write the reason for the decision (at least 10 characters).';
  if (form.outcome === 'termination_recommended' && severity === 'minor') errors.outcome = 'A minor case cannot recommend termination.';
  if (category === 'disciplinary' && severity === 'serious' && form.outcome === 'no_action' && form.note.length < 30) {
    errors.note = 'A serious case closed with no action needs a fuller reason (at least 30 characters).';
  }
  return errors;
}

export function validateNote(text: string): string | null {
  const t = text.trim();
  if (t.length < 3) return 'Write the note (at least 3 characters).';
  if (t.length > 2000) return 'Keep the note under 2000 characters.';
  return null;
}

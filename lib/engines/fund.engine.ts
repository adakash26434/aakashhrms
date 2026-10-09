// Welfare funds (G9, docs/redesign/06-hrms-gap-analysis.md): pure rules —
// no database access, unit-tested in tests/fund.engine.test.ts.
//
// All arithmetic runs in PAISA (integers) and converts to NPR strings at the
// edge, the kit's no-float-drift discipline. The ledger is append-only:
// contributions positive, payouts negative, mistakes corrected by
// adjustment lines; `ref` makes every posting idempotent.

export const FUND_KINDS = ['contribution', 'opening', 'payout', 'adjustment'] as const;
export type FundLineKind = (typeof FUND_KINDS)[number];

const toPaisa = (npr: number | string): number => Math.round(Number(npr) * 100);
const toNpr = (paisa: number): string => (paisa / 100).toFixed(2);

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

export interface FundRule {
  contributionMode: string; // 'fixed' | 'percent_basic'
  employeeValue: number | string;
  employerValue: number | string;
}

export interface Contribution {
  employeeAmount: string; // NPR, 2 dp
  employerAmount: string;
}

/**
 * One month's contribution for one employee: fixed amounts, or percent of
 * the basic salary (half-up to the paisa). Zero basic with percent mode
 * contributes nothing.
 */
export function monthlyContribution(rule: FundRule, basicSalary: number | string): Contribution {
  if (rule.contributionMode === 'percent_basic') {
    const basic = toPaisa(basicSalary);
    if (!Number.isFinite(basic) || basic <= 0) return { employeeAmount: '0.00', employerAmount: '0.00' };
    return {
      employeeAmount: toNpr(Math.round((basic * Number(rule.employeeValue)) / 100)),
      employerAmount: toNpr(Math.round((basic * Number(rule.employerValue)) / 100)),
    };
  }
  return { employeeAmount: toNpr(toPaisa(rule.employeeValue)), employerAmount: toNpr(toPaisa(rule.employerValue)) };
}

/** The idempotency ref for a BS month's contribution. */
export function contributionRef(fundCode: string, bsYear: number, bsMonth: number): string {
  return `contrib:${fundCode}:${bsYear}-${String(bsMonth).padStart(2, '0')}`;
}

/** The previous BS month (for the BS-day-1 job posting last month). */
export function previousBsMonth(bsYear: number, bsMonth: number): { year: number; month: number } {
  return bsMonth === 1 ? { year: bsYear - 1, month: 12 } : { year: bsYear, month: bsMonth - 1 };
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export interface FundLine {
  employeeAmount: number | string;
  employerAmount: number | string;
}

export interface FundBalance {
  employee: string;
  employer: string;
  total: string;
}

/** Paisa-safe sum of a member's lines. */
export function fundBalance(lines: FundLine[]): FundBalance {
  let employee = 0;
  let employer = 0;
  for (const line of lines) {
    employee += toPaisa(line.employeeAmount);
    employer += toPaisa(line.employerAmount);
  }
  return { employee: toNpr(employee), employer: toNpr(employer), total: toNpr(employee + employer) };
}

// ---------------------------------------------------------------------------
// Forms and postings
// ---------------------------------------------------------------------------

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export interface FundTypeForm {
  code: string;
  name: string;
  nameNp: string;
  contributionMode: 'fixed' | 'percent_basic';
  employeeValue: number;
  employerValue: number;
  note: string;
  isActive: boolean;
}

export function normalizeFundTypeForm(raw: unknown): FundTypeForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    code: s(r.code, 30).toLowerCase(),
    name: s(r.name, 100),
    nameNp: s(r.nameNp, 100),
    contributionMode: r.contributionMode === 'percent_basic' ? 'percent_basic' : 'fixed',
    employeeValue: Number(r.employeeValue),
    employerValue: Number(r.employerValue),
    note: s(r.note, 500),
    isActive: r.isActive !== false,
  };
}

export function validateFundTypeForm(form: FundTypeForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[a-z0-9][a-z0-9_-]{1,29}$/.test(form.code)) errors.code = 'Code: 2–30 letters, digits, - or _.';
  if (!form.name) errors.name = 'Name the fund.';
  const limit = form.contributionMode === 'percent_basic' ? 100 : 1000000;
  for (const [key, value] of [['employeeValue', form.employeeValue], ['employerValue', form.employerValue]] as const) {
    if (!Number.isFinite(value) || value < 0 || value > limit) errors[key] = form.contributionMode === 'percent_basic' ? '0–100 %.' : '0–10,00,000.';
  }
  if (Number.isFinite(form.employeeValue) && Number.isFinite(form.employerValue) && form.employeeValue === 0 && form.employerValue === 0) {
    errors.employeeValue = 'At least one side contributes.';
  }
  return errors;
}

export interface PostingForm {
  fundTypeId: string;
  employeeId: string;
  kind: 'opening' | 'payout' | 'adjustment';
  employeeAmount: number;
  employerAmount: number;
  note: string;
}

export function normalizePostingForm(raw: unknown): PostingForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = r.kind === 'payout' ? 'payout' : r.kind === 'adjustment' ? 'adjustment' : 'opening';
  return {
    fundTypeId: s(r.fundTypeId, 64),
    employeeId: s(r.employeeId, 64),
    kind,
    employeeAmount: Number(r.employeeAmount),
    employerAmount: Number(r.employerAmount),
    note: s(r.note, 500),
  };
}

/**
 * Posting rules: openings are non-negative; payouts are entered positive and
 * stored negative, never more than the balance on either side (a fund never
 * goes below zero); adjustments may go either way but not below zero either,
 * and need a note.
 */
export function validatePosting(form: PostingForm, balance: FundBalance): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.fundTypeId) errors.fundTypeId = 'Choose the fund.';
  if (!form.employeeId) errors.employeeId = 'Choose the employee.';
  for (const [key, value] of [['employeeAmount', form.employeeAmount], ['employerAmount', form.employerAmount]] as const) {
    if (!Number.isFinite(value)) errors[key] = 'A number.';
  }
  if (Object.keys(errors).length) return errors;

  const employee = toPaisa(form.employeeAmount);
  const employer = toPaisa(form.employerAmount);
  if (form.kind === 'opening') {
    if (employee < 0 || employer < 0) errors.employeeAmount = 'Openings are not negative.';
    if (employee === 0 && employer === 0) errors.employeeAmount = 'Nothing to post.';
  }
  if (form.kind === 'payout') {
    if (employee < 0 || employer < 0) errors.employeeAmount = 'Enter the payout as a positive amount.';
    if (employee === 0 && employer === 0) errors.employeeAmount = 'Nothing to pay out.';
    if (employee > toPaisa(balance.employee)) errors.employeeAmount = `At most ${balance.employee} (the employee share).`;
    if (employer > toPaisa(balance.employer)) errors.employerAmount = `At most ${balance.employer} (the employer share).`;
  }
  if (form.kind === 'adjustment') {
    if (employee === 0 && employer === 0) errors.employeeAmount = 'Nothing to adjust.';
    if (form.note.trim().length < 5) errors.note = 'Say what this adjustment corrects.';
    if (toPaisa(balance.employee) + employee < 0) errors.employeeAmount = 'Would take the employee share below zero.';
    if (toPaisa(balance.employer) + employer < 0) errors.employerAmount = 'Would take the employer share below zero.';
  }
  return errors;
}

/** The signed amounts a posting stores. */
export function postingAmounts(form: PostingForm): { employeeAmount: string; employerAmount: string } {
  const sign = form.kind === 'payout' ? -1 : 1;
  return {
    employeeAmount: toNpr(sign * toPaisa(form.employeeAmount)),
    employerAmount: toNpr(sign * toPaisa(form.employerAmount)),
  };
}

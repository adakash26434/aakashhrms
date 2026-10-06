import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY_LINES,
  applyTemplate,
  batchSummary,
  changedLines,
  classifyHead,
  earliestOpenDate,
  finalisedConflicts,
  gradeAmountFor,
  headsFromLines,
  largeChangeWarning,
  latestApproved,
  linesFromHeads,
  matchImport,
  resolveStructureTab,
  revisionInForce,
  structureTotals,
  templateFits,
  validateLines,
  type PayHeadLike,
} from '../lib/engines/salary-structure.engine';
import { DEFAULT_GRADE_POLICY } from '../lib/engines/grade-policy.engine';
import { normalizeBatch } from '../lib/services/salary-structure.service';
import type { StructureLines } from '../lib/types/salary-structure';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

const head = (over: Partial<PayHeadLike>): PayHeadLike => ({
  id: 'h', code: 'H', name: 'Head', type: 'allowance', calcBasis: 'None', calcParameter: 'FixedAmount', calcPercent: 0,
  isFestivalAllowance: false, isAbsentDeduct: false, isOtHead: false, isLeaveHead: false, isTdsHead: false, isPfHead: false,
  isSsfHead: false, isSsfEmployerHead: false, isRemoteAllowance: false, isCitHead: false, ...over,
});

const HEADS = [
  head({ id: 'tran', code: 'TRAN', name: 'Transport' }),
  head({ id: 'dear', code: 'DEAR', name: 'Dearness', calcBasis: 'BasicSalary', calcParameter: 'BasicSalary', calcPercent: 10 }),
  head({ id: 'fest', code: 'FEST', name: 'Festival', isFestivalAllowance: true }),
  head({ id: 'cit', code: 'CIT', name: 'CIT', type: 'deduction', isCitHead: true }),
  head({ id: 'ssf', code: 'SSF', name: 'SSF', type: 'deduction', isSsfHead: true }),
  head({ id: 'ssfer', code: 'SSF-ER', name: 'SSF employer', isSsfEmployerHead: true }),
  head({ id: 'pf', code: 'PF', name: 'PF', type: 'deduction', isPfHead: true }),
  head({ id: 'tds', code: 'TDS', name: 'TDS', type: 'deduction', isTdsHead: true }),
].map(classifyHead);

const lines = (over: Partial<StructureLines> = {}): StructureLines => ({ ...EMPTY_LINES, basic: 30000, gradeCount: 3, gradeAmount: 3000, scheme: 'ssf', ...over });
const settings = { ssfBase: 'BasicPlusGrade' as const, pfPercent: 10 };

describe('Pay heads in a structure', () => {
  it('sorts heads into typed amounts, worked-out, scheme and automatic', () => {
    const kind = Object.fromEntries(HEADS.map((h) => [h.id, h.kind]));
    assert.deepEqual(kind, { tran: 'amount', dear: 'computed', fest: 'computed', cit: 'amount', ssf: 'scheme', ssfer: 'scheme', pf: 'scheme', tds: 'auto' });
    assert.equal(HEADS.find((h) => h.id === 'dear')!.rule, '10% of basic');
    assert.equal(HEADS.find((h) => h.id === 'fest')!.occasional, true);
  });

  it('the onboarding Basic Salary / Grade Amount heads are labels: never offered, but a stored amount still counts', () => {
    const basicHead = classifyHead(head({ id: 'bh', code: 'BASIC', name: 'Basic Salary' }));
    assert.equal(basicHead.labelOnly, true);
    assert.equal(classifyHead(head({ code: 'grade', name: 'Grade Amount' })).labelOnly, true);
    assert.equal(classifyHead(head({ code: 'GRADE-X', name: 'Grade bonus' })).labelOnly, undefined);
    // An amount already stored on one is still counted (payroll pays it) and flagged.
    const l = lines({ amounts: { bh: 3500 } });
    assert.equal(structureTotals(l, [...HEADS, basicHead], settings).gross, 36500);
    assert.ok(validateLines(l, [...HEADS, basicHead]).warnings.bh);
  });

  it('stores amounts, worked-out heads and the scheme heads, and reads them back', () => {
    const l = lines({ amounts: { tran: 2000, cit: 1000 }, computed: ['dear'] });
    const stored = headsFromLines(l, HEADS);
    assert.deepEqual(stored.map((s) => s.payHeadId).sort(), ['cit', 'dear', 'ssf', 'ssfer', 'tran']);
    const back = linesFromHeads({ basic: 30000, gradeCount: 3, gradeAmount: 3000, gradeManual: false }, stored, HEADS);
    assert.deepEqual(back, { ...l, computed: ['dear'] });
  });
});

describe('Monthly totals (same SSF rule as payroll)', () => {
  it('basic + grade + allowances; SSF 11% / 20% on basic + grade; deductions; employer cost', () => {
    const t = structureTotals(lines({ amounts: { tran: 2000, cit: 1000 }, computed: ['dear', 'fest'] }), HEADS, settings);
    // gross = 30,000 + 3,000 + 2,000 + 10% of 30,000 (festival left out: occasional)
    assert.equal(t.gross, 38000);
    assert.equal(t.retirementEmployee, 3630);
    assert.equal(t.retirementEmployer, 6600);
    assert.equal(t.deductions, 1000);
    assert.equal(t.netBeforeTax, 38000 - 1000 - 3630);
    assert.equal(t.employerCost, 38000 + 6600);
  });

  it('PF: 10% of basic + grade each side; none: no contribution', () => {
    assert.equal(structureTotals(lines({ scheme: 'pf' }), HEADS, settings).retirementEmployee, 3300);
    assert.equal(structureTotals(lines({ scheme: 'none' }), HEADS, settings).retirementEmployee, 0);
  });

  it('grade follows the policy unless typed by hand', () => {
    assert.equal(gradeAmountFor(lines({ gradeAmount: 999 }), DEFAULT_GRADE_POLICY), 3000);
    assert.equal(gradeAmountFor(lines({ gradeAmount: 999, gradeManual: true }), DEFAULT_GRADE_POLICY), 999);
    assert.equal(gradeAmountFor(lines(), { ...DEFAULT_GRADE_POLICY, calculationMethod: 'DISABLED_NO_GRADES' }), 0);
  });
});

describe('Validation and changes', () => {
  it('checks basic, grade count and amounts; warns below the level start', () => {
    assert.deepEqual(validateLines(lines(), HEADS).errors, {});
    assert.ok(validateLines(lines({ basic: 0 }), HEADS).errors.basic);
    assert.ok(validateLines(lines({ gradeCount: 1.5 }), HEADS).errors.gradeCount);
    assert.ok(validateLines(lines({ amounts: { tran: -5 } }), HEADS).errors.tran);
    assert.ok(validateLines(lines({ amounts: { nope: 5 } }), HEADS).errors.nope);
    assert.ok(validateLines(lines({ basic: 20000 }), HEADS, 25000).warnings.basic);
  });

  it('flags a basic salary that moves by more than half (a likely typo)', () => {
    assert.match(largeChangeWarning(30000, 120000) ?? '', /rises by 300%/);
    assert.match(largeChangeWarning(30000, 3000) ?? '', /falls by 90%/);
    assert.equal(largeChangeWarning(30000, 33000), null);
    assert.equal(largeChangeWarning(null, 50000), null);
  });

  it('lists what changed, and sums a batch', () => {
    assert.deepEqual(changedLines(lines(), lines({ basic: 32000, amounts: { tran: 500 } })), ['basic', 'tran']);
    assert.deepEqual(changedLines(lines(), lines()), []);
    assert.deepEqual(changedLines(null, lines()), ['new']);
    const t = (gross: number) => ({ ...structureTotals(lines(), HEADS, settings), gross });
    assert.deepEqual(batchSummary([{ before: t(100), after: t(150) }, { before: null, after: t(50) }]), { employeeCount: 2, monthlyChange: 100, before: 100, after: 200 });
  });
});

describe('Revisions in force (payroll picks by month)', () => {
  const revs = [
    { id: 'old', effectiveFrom: '2026-01-01', status: 'approved', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'mid', effectiveFrom: '2026-07-17', status: 'approved', createdAt: '2026-07-01T00:00:00Z' },
    { id: 'fix', effectiveFrom: '2026-07-17', status: 'approved', createdAt: '2026-07-05T00:00:00Z' },
    { id: 'future', effectiveFrom: '2026-10-17', status: 'approved', createdAt: '2026-09-01T00:00:00Z' },
    { id: 'pending', effectiveFrom: '2026-08-01', status: 'pending', createdAt: '2026-08-01T00:00:00Z' },
  ];
  it('the latest approved revision effective by the end of the month; pending ignored', () => {
    assert.equal(revisionInForce(revs, '2026-06-30')?.id, 'old');
    assert.equal(revisionInForce(revs, '2026-08-15')?.id, 'fix'); // same date: the later correction wins
    assert.equal(revisionInForce(revs, '2025-12-31'), null);
  });
  it('the current revision is the latest approved, even if it starts later', () => {
    assert.equal(latestApproved(revs)?.id, 'future');
  });
});

describe('Payroll already approved or locked (no arrears yet)', () => {
  const until = { e1: '2026-09-16', e2: '2026-08-16' };
  it('a change may not reach a month whose payroll is approved or locked', () => {
    assert.deepEqual([...finalisedConflicts('2026-09-16', until, ['e1', 'e2']).keys()], ['e1']);
    assert.deepEqual([...finalisedConflicts('2026-08-01', until, ['e1', 'e2']).keys()], ['e1', 'e2']);
    assert.equal(finalisedConflicts('2026-09-17', until, ['e1', 'e2']).size, 0);
    assert.equal(finalisedConflicts('2020-01-01', until, ['e3']).size, 0);
  });
  it('the first open date is the day after the latest finalised month', () => {
    assert.equal(earliestOpenDate(until, ['e1', 'e2']), '2026-09-17');
    assert.equal(earliestOpenDate(until, ['e3']), null);
  });
});

describe('Templates', () => {
  it('fit by level and designation (empty = everyone)', () => {
    assert.equal(templateFits({ levelCodes: [], designationIds: [] }, { levelCode: 'S6', designationId: 'd1' }), true);
    assert.equal(templateFits({ levelCodes: ['S6'], designationIds: [] }, { levelCode: 'S5', designationId: 'd1' }), false);
  });
  it('fill basic (amount or level start), heads and scheme; grade recalculated, count kept', () => {
    const next = applyTemplate({ basicMode: 'level_start', basicAmount: 0, scheme: 'keep', heads: [{ payHeadId: 'tran', amount: 1500 }, { payHeadId: 'dear', amount: 0 }] }, lines({ gradeCount: 2 }), HEADS, 36000, DEFAULT_GRADE_POLICY);
    assert.equal(next.basic, 36000);
    assert.equal(next.gradeCount, 2);
    assert.equal(next.gradeAmount, 2400);
    assert.deepEqual(next.amounts, { tran: 1500 });
    assert.deepEqual(next.computed, ['dear']);
    assert.equal(next.scheme, 'ssf');
  });
});

describe('CSV import', () => {
  it('matches rows by employee code and columns by header; reports the rest', () => {
    const cols = [
      { id: 'basic', header: 'Basic', kind: 'number' as const },
      { id: 'scheme', header: 'Scheme (SSF/PF/None)', kind: 'scheme' as const },
      { id: 'comp:dear', header: 'Dearness (Yes/No)', kind: 'yesno' as const },
    ];
    const r = matchImport(
      [
        ['Employee code', 'Employee', 'Basic', 'Scheme (SSF/PF/None)', 'Dearness (Yes/No)', 'Bonus'],
        ['EMP-1', 'A', '1,20,000', 'PF', 'Yes', '5'],
        ['EMP-9', 'Z', '1', 'SSF', 'No', ''],
        ['EMP-2', 'B', 'abc', 'maybe', 'x', ''],
      ],
      cols,
      new Set(['EMP-1', 'EMP-2'])
    );
    assert.deepEqual(r.values.get('EMP-1'), { basic: 120000, scheme: 'pf', 'comp:dear': true });
    assert.deepEqual(r.unknownCodes, ['EMP-9']);
    assert.deepEqual(r.unknownColumns, ['Bonus']);
    assert.equal(r.errors.length, 3);
  });
  it('needs an employee code column', () => {
    assert.equal(matchImport([['Name', 'Basic']], [], new Set()).errors.length, 1);
  });
});

describe('Salary structure security (S20)', () => {
  const actions = read('app/actions/salary-structure.actions.ts');
  it('every action checks permission with scope, audits and hides raw errors', () => {
    for (const name of ['submitSalaryChangeAction', 'decideSalaryChangesAction', 'saveSalaryTemplateAction', 'setSalaryTemplateActiveAction', 'saveSalaryApprovalSettingsAction']) {
      const body = actions.slice(actions.indexOf(`export async function ${name}`));
      const end = body.indexOf('\nexport async function', 10);
      const fn = end > 0 ? body.slice(0, end) : body;
      assert.match(fn, /checkPermissionWithScope\(('EDIT'|'APPROVE'|decision === 'withdraw' \? 'EDIT' : 'VIEW'), 'SALARY_MAPPING'\)/, name);
      assert.match(fn, /recordAuditLog\(/, name);
      assert.match(fn, /toActionError\(/, name);
    }
    assert.ok(!/error\.message/.test(actions));
    assert.match(actions, /DENIED_SELF/);
  });

  it('employees outside the user\'s scope are refused and audited DENIED_SCOPE', () => {
    const service = read('lib/services/salary-structure.service.ts');
    assert.equal((service.match(/throw new OutOfScopeError\(/g) ?? []).length, 2); // submit and decide
    assert.match(actions, /'DENIED_SCOPE'/);
    assert.equal((actions.match(/await auditOutOfScope\(/g) ?? []).length, 1); // submit; decisions audit per item
    assert.match(actions, /r\.refusal === 'scope' \? 'DENIED_SCOPE' : DENIED_SELF/);
  });

  it('the page reads only within the user\'s scope; there is no delete', () => {
    assert.match(read('app/(dashboard)/workforce/salary-mapping/page.tsx'), /checkPermissionWithScope\("VIEW", "SALARY_MAPPING"\)/);
    assert.match(read('lib/services/salary-structure.service.ts'), /buildEmployeeScopeCondition\(scope\)/);
    assert.ok(!/delete\(employeeSalaryMap\)/.test(read('lib/repositories/salary-structure.repository.ts')));
  });

  it('payroll uses the revision in force for the month', () => {
    assert.match(read('lib/services/payroll.service.ts'), /findInForceByEmployeeIds\(\s*scopedEmployees\.map\(e => e\.id\),\s*endStr/);
  });

  it('the server reshapes what the browser sends', () => {
    assert.throws(() => normalizeBatch({ kind: 'bulk', effectiveFrom: 'soon', reason: 'x', rows: [{}] }), /date/);
    assert.throws(() => normalizeBatch({ kind: 'bulk', effectiveFrom: '2026-07-17', reason: 'Raise', rows: [{ employeeId: 'a' }, { employeeId: 'a' }] }), /only once/);
    const ok = normalizeBatch({ kind: 'hack', effectiveFrom: '2026-07-17', reason: 'Raise', rows: [{ employeeId: 'a', lines: { basic: '30000', scheme: 'evil', amounts: { x: '5' }, computed: [1, 'y'] } }] });
    assert.equal(ok.kind, 'bulk');
    assert.equal(ok.rows[0].lines.scheme, 'none');
    assert.deepEqual(ok.rows[0].lines.computed, ['y']);
  });

  it('S21: own-salary refusals are audited DENIED_SELF; the settings need a company administrator, never platform support', () => {
    assert.match(actions, /SelfDecisionError && userId[\s\S]*result: DENIED_SELF/); // save and approve
    assert.match(actions, /result: r\.refusal === 'scope' \? 'DENIED_SCOPE' : DENIED_SELF/); // decisions
    const setting = actions.slice(actions.indexOf('export async function saveSalaryApprovalSettingsAction'));
    assert.match(setting, /checkPermissionWithScope\('APPROVE', 'SALARY_MAPPING'\)/);
    assert.match(setting, /scope\.scopeType !== 'GLOBAL'/);
    assert.match(setting, /scope\.isImpersonation/);
    assert.match(actions, /hasPermission\('APPROVE', 'SALARY_MAPPING'\)/);
    assert.match(actions, /slice\(0, MAX_BULK\)/);
  });

  it('the server applies the rules: flow on submit, engine on every decision over all employees, payroll still open', () => {
    const service = read('lib/services/salary-structure.service.ts');
    assert.match(service, /buildFlow\(policy, \{ preparerId: ctx\.userId, preparerEmployeeId: ctx\.scope\.employeeId/);
    assert.match(service, /if \(finalNow && !actor\.isAdministrator\)/);
    assert.match(service, /if \(finalNow && ownSalary\) throw new SelfDecisionError/);
    assert.match(service, /findBatchEmployeeIds\(batchId\)/);
    assert.match(service, /availableActions\(request, actor, \{ approvers, today: nepalDateIso\(\) \}\)/);
    assert.equal((service.match(/await assertPayrollOpen\(/g) ?? []).length, 2); // submit and final approval
    const repo = read('lib/repositories/salary-structure.repository.ts');
    // A decision applies only while the batch is pending at the level the person saw.
    assert.match(repo, /eq\(salaryChangeBatches\.status, "pending"\), eq\(salaryChangeBatches\.currentLevel, params\.expectedLevel\)/);
    assert.match(repo, /inArray\(payrollRuns\.status, \["APPROVED", "LOCKED"\]\)/);
    // Every step goes to the timeline in the same transaction.
    assert.match(repo, /tx\.insert\(approvalActions\)/);
  });

  it('the old tab link (?tab=changes) opens Approvals', () => {
    assert.equal(resolveStructureTab('changes'), 'approvals');
  });

  it('the letter prints its company block (print styles hide <header> elements)', () => {
    assert.ok(!/<header[\s>]/.test(read('components/salary-mapping/salary-structure-letter.tsx')));
  });

  it('opens a known tab', () => {
    assert.equal(resolveStructureTab('bulk'), 'bulk');
    assert.equal(resolveStructureTab('x'), 'structures');
  });
});

describe('approval timeline back-fill (runs on every restart)', () => {
  it('fills only changes that have no steps of their own, so nothing shows twice', () => {
    const sync = readFileSync(join(__dirname, '..', 'lib', 'db', 'tenant-schema-sync.ts'), 'utf8');
    const fills = sync.match(/INSERT INTO "approval_actions"[\s\S]*?ON CONFLICT \("id"\) DO NOTHING/g) ?? [];
    assert.equal(fills.length, 2);
    for (const q of fills) assert.match(q, /NOT EXISTS \(SELECT 1 FROM "approval_actions" a WHERE a\."module" = 'SALARY_MAPPING' AND a\."request_id" = b\."id" AND a\."id" NOT IN/);
  });
});


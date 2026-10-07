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
  estimatePay,
  finalisedConflicts,
  gradeAmountFor,
  headAppliesTo,
  headsFromLines,
  largeChangeWarning,
  latestApproved,
  linesFromHeads,
  matchImport,
  needsSetup,
  needsStructure,
  resolveLevelCode,
  templateCoverage,
  payrollHeadsFor,
  resolveStructureTab,
  revisionInForce,
  setupEffectiveFrom,
  setupLines,
  structureTotals,
  templateFits,
  templatesFor,
  validateLines,
  type PayHeadLike,
} from '../lib/engines/salary-structure.engine';
import { calculatePayslip, type TaxSlabInput } from '../lib/engines/payroll.engine';
import { DEFAULT_GRADE_POLICY } from '../lib/engines/grade-policy.engine';
import { normalizeBatch } from '../lib/services/salary-structure.service';
import type { PayProfile, StructureLines, TaxRules, TemplateRow } from '../lib/types/salary-structure';
import type { SystemControlData } from '../lib/types/system-control';

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
    assert.equal(structureTotals(l, [...HEADS, basicHead], settings).totalSalary, 36500);
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

describe('Monthly breakdown (payslip style, same SSF rule as payroll)', () => {
  it('total salary, SSF employer 20% in earnings, SSF 31% deducted, net payable, cost to company', () => {
    const t = structureTotals(lines({ amounts: { tran: 2000, cit: 1000 }, computed: ['dear', 'fest'] }), HEADS, settings);
    // Total salary = 30,000 + 3,000 + 2,000 + 10% of 30,000 (festival left out: occasional)
    assert.equal(t.totalSalary, 38000);
    assert.equal(t.allowances, 5000);
    assert.equal(t.retirementEmployee, 3630);
    assert.equal(t.retirementEmployer, 6600);
    assert.equal(t.employerInEarnings, 6600);
    assert.equal(t.grossEarnings, 38000 + 6600);
    assert.equal(t.retirementDeduction, 3630 + 6600);
    assert.equal(t.otherDeductions, 1000);
    assert.equal(t.totalDeductions, 1000 + 3630 + 6600);
    // Take-home is the same as "total salary − 11% − deductions".
    assert.equal(t.netPayable, 38000 - 1000 - 3630);
    assert.equal(t.netBeforeTax, 38000 - 1000 - 3630);
    assert.equal(t.costToCompany, 38000 + 6600);
    assert.equal(t.incomeTax, null);
    assert.deepEqual(t.items.map((i) => [i.name, i.amount]), [['Transport', 2000], ['Dearness', 3000], ['CIT', 1000]]);
  });

  it('PF: deducted (employee), not in earnings, employer share in cost to company; none: no contribution', () => {
    const pf = structureTotals(lines({ scheme: 'pf' }), HEADS, settings);
    assert.equal(pf.retirementDeduction, 3300);
    assert.equal(pf.employerInEarnings, 0);
    assert.equal(pf.grossEarnings, 33000);
    assert.equal(pf.costToCompany, 33000 + 3300);
    assert.equal(structureTotals(lines({ scheme: 'none' }), HEADS, settings).retirementDeduction, 0);
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
    // The monthly change is in total salary (basic + grade + allowances), as batches always stored it.
    const t = (totalSalary: number) => ({ ...structureTotals(lines(), HEADS, settings), totalSalary });
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

describe('approval timeline clean-up (migration 0046)', () => {
  const sync = readFileSync(join(__dirname, '..', 'lib', 'db', 'tenant-schema-sync.ts'), 'utf8');
  const migration = readFileSync(join(__dirname, '..', 'lib', 'db', 'migrations', '0046_salary_timeline_cleanup.sql'), 'utf8');
  const deletes = (src: string) => src.match(/DELETE FROM "approval_actions" a[\s\S]*?\n {0,2}\)/g) ?? [];

  it('deletes only back-filled copies, and only where the change has its own matching step', () => {
    for (const src of [sync, migration]) {
      const [submitted, decided] = deletes(src);
      assert.ok(submitted && decided, 'two delete statements');
      // Only the back-filled ids (md5 of the batch), never a step the app wrote itself.
      assert.match(submitted, /a\."id" = md5\(a\."request_id"::text \|\| ':submitted'\)::uuid/);
      assert.match(decided, /a\."id" = md5\(a\."request_id"::text \|\| ':decided'\)::uuid/);
      // Kept unless an own step of the same kind exists.
      assert.match(submitted, /EXISTS[\s\S]*o\."action" = 'submitted'[\s\S]*o\."id" NOT IN/);
      assert.match(decided, /EXISTS[\s\S]*o\."action" <> 'submitted'[\s\S]*o\."id" NOT IN/);
      for (const q of [submitted, decided]) assert.match(q, /a\."module" = 'SALARY_MAPPING'/);
    }
  });

  it('runs after the back-fill in the restart-time sync', () => {
    assert.ok(sync.indexOf(':decided\')::uuid, \'SALARY_MAPPING\'') < sync.indexOf('DELETE FROM "approval_actions" a'));
  });
});

// ---------------------------------------------------------------------------
// 4.4b: the pay estimate is payroll's own calculation
// ---------------------------------------------------------------------------

const SLABS: TaxSlabInput[] = [
  { id: 's1', category: 'Normal Single', amountFrom: '0', amountTo: '500000', ratePercent: '1', fixedDeduction: '0' },
  { id: 's2', category: 'Normal Single', amountFrom: '500000', amountTo: '700000', ratePercent: '10', fixedDeduction: '0' },
  { id: 's3', category: 'Normal Single', amountFrom: '700000', amountTo: null, ratePercent: '20', fixedDeduction: '0' },
  { id: 'm1', category: 'Married', amountFrom: '0', amountTo: '600000', ratePercent: '1', fixedDeduction: '0' },
  { id: 'm2', category: 'Married', amountFrom: '600000', amountTo: '800000', ratePercent: '10', fixedDeduction: '0' },
  { id: 'm3', category: 'Married', amountFrom: '800000', amountTo: null, ratePercent: '20', fixedDeduction: '0' },
];
const TAX: TaxRules = {
  slabs: SLABS,
  limits: { pfMaximumLimitPercent: 30, citLimitNpr: 300000, retirementFundLimitNpr: 500000, companyHasSsf: true, ssfContributionBase: 'BasicPlusGrade' },
  insurance: { medicalInsuranceNpr: 20000, houseInsuranceNpr: 5000, lifeInsuranceNpr: 40000, womenDiscountPercent: 10, handicappedDiscountPercent: 0, remoteAllowanceNpr: 50000 },
};
const PROFILE: PayProfile = { taxStatus: 'Normal Single', isDisabled: false, category: 'Permanent', gender: 'Male', joiningDate: '2024-01-01' };

/** What a pay run would compute for the same lines (the reference). */
const payrollRun = (l: StructureLines, profile: PayProfile = PROFILE) =>
  calculatePayslip({
    employee: { id: 'e', ...profile },
    salaryMap: { basicSalary: String(l.basic), gradePercent: '0', gradeAmount: String(l.gradeAmount) },
    assignedHeads: payrollHeadsFor(l, HEADS),
    attendanceCalc: { leaveDeductionAmount: '0', otEarnedAmount: '0' },
    loanDeduction: '0',
    systemControl: { statutoryDeductionLimits: TAX.limits, insuranceDiscounts: TAX.insurance } as SystemControlData,
    taxSlabs: SLABS,
    isFestivalMonth: false,
    isRemoteMonth: false,
    isYearEnd: false,
  });

describe('Pay estimate = payroll (estimatePay → calculatePayslip)', () => {
  const cases: [string, StructureLines, PayProfile][] = [
    ['SSF', lines({ basic: 60000, gradeAmount: 4000, amounts: { tran: 5000, cit: 2000 }, computed: ['dear'] }), PROFILE],
    ['PF', lines({ basic: 60000, gradeAmount: 4000, scheme: 'pf', amounts: { tran: 5000 } }), PROFILE],
    ['none', lines({ basic: 45000, gradeAmount: 0, scheme: 'none' }), PROFILE],
    ['married', lines({ basic: 80000, gradeAmount: 5000 }), { ...PROFILE, taxStatus: 'Married' }],
    ['contract (15% flat)', lines({ basic: 50000, gradeAmount: 0, scheme: 'none' }), { ...PROFILE, category: 'Contract' }],
    ['trainee (no SSF, no tax)', lines({ basic: 20000, gradeAmount: 0 }), { ...PROFILE, category: 'Trainee' }],
  ];
  for (const [name, l, profile] of cases) {
    it(`${name}: same gross, deductions, tax and net payable as a pay run`, () => {
      const e = estimatePay(l, HEADS, profile, TAX, settings);
      const r = payrollRun(l, profile);
      assert.equal(e.problem, undefined);
      assert.equal(e.grossEarnings, Number(r.grossEarnings));
      assert.equal(e.totalDeductions, Number(r.totalDeductions));
      assert.equal(e.incomeTax, Number(r.tdsThisMonth));
      assert.equal(e.netPayable, Number(r.netPayable));
      // The breakdown adds up.
      assert.equal(e.netPayable, Math.round((e.grossEarnings - e.totalDeductions) * 100) / 100);
      assert.equal(e.totalSalary, e.basic + e.grade + e.allowances);
      assert.equal(e.grossEarnings, Math.round((e.totalSalary + e.employerInEarnings) * 100) / 100);
    });
  }

  it('SSF: the 20% is added to earnings and the 31% deducted; trainees get no SSF; married slabs differ', () => {
    const ssf = estimatePay(lines({ basic: 60000, gradeAmount: 4000 }), HEADS, PROFILE, TAX, settings);
    assert.equal(ssf.employerInEarnings, 12800);
    assert.equal(ssf.retirementDeduction, 7040 + 12800);
    assert.ok((ssf.incomeTax ?? 0) > 0);
    const trainee = estimatePay(lines({ basic: 20000, gradeAmount: 0 }), HEADS, { ...PROFILE, category: 'Trainee' }, TAX, settings);
    assert.equal(trainee.retirementDeduction, 0);
    assert.equal(trainee.incomeTax, 0);
    const single = estimatePay(lines({ basic: 80000, gradeAmount: 5000 }), HEADS, PROFILE, TAX, settings);
    const married = estimatePay(lines({ basic: 80000, gradeAmount: 5000 }), HEADS, { ...PROFILE, taxStatus: 'Married' }, TAX, settings);
    assert.ok((married.incomeTax ?? 0) < (single.incomeTax ?? 0));
  });

  it('PF cost to company adds the employer share; CIT counts as another deduction', () => {
    const pf = estimatePay(lines({ basic: 60000, gradeAmount: 4000, scheme: 'pf', amounts: { cit: 3000 } }), HEADS, PROFILE, TAX, settings);
    assert.equal(pf.employerInEarnings, 0);
    assert.equal(pf.costToCompany, pf.grossEarnings + pf.retirementEmployer);
    assert.equal(pf.otherDeductions, 3000);
  });

  it('deductions above earnings: a problem message, never a crash', () => {
    const e = estimatePay(lines({ basic: 1000, gradeAmount: 0, scheme: 'none', amounts: { cit: 5000 } }), HEADS, PROFILE, TAX, settings);
    assert.match(e.problem ?? '', /Deductions are more than earnings/);
  });

  it('a TDS head is always there for payroll, SSF heads only with SSF', () => {
    const none = payrollHeadsFor(lines({ scheme: 'none' }), HEADS).map((h) => h.id);
    assert.deepEqual(none, ['tds']);
    const ssf = payrollHeadsFor(lines(), HEADS).map((h) => h.id).sort();
    assert.deepEqual(ssf, ['ssf', 'ssfer', 'tds']);
  });

  it('the service works totals out with the employee (estimatePay) and the active fiscal year slabs', () => {
    const src = read('lib/services/salary-structure.service.ts');
    assert.match(src, /estimatePay\(lines, heads, pay\.profile, pay\.tax, settings\)/);
    assert.match(src, /years\.find\(\(y\) => y\.status === "Active"\)/);
  });
});

describe('New hires: basic + grade, then set up in Salary structure', () => {
  const t = (over: Partial<TemplateRow>): TemplateRow => ({ id: 't', code: 'T', name: 'T', levelCodes: [], designationIds: [], basicMode: 'amount', basicAmount: 0, scheme: 'keep', heads: [], isActive: true, ...over });
  const hire = { lines: lines({ scheme: 'none', amounts: {}, computed: [] }) };

  it('only basic + grade from a hire counts as "to set up"', () => {
    assert.equal(needsSetup(hire, 'hire'), true);
    assert.equal(needsSetup(hire, 'single'), false);
    assert.equal(needsSetup({ lines: lines({ scheme: 'none', amounts: { tran: 500 } }) }, 'hire'), false);
    assert.equal(needsSetup({ lines: lines({ scheme: 'ssf' }) }, 'hire'), false);
    assert.equal(needsSetup(null, 'hire'), false);
  });

  it('set-up keeps basic and grade, takes the template heads, and SSF when expected', () => {
    const tpl = t({ basicAmount: 99999, heads: [{ payHeadId: 'tran', amount: 2500 }, { payHeadId: 'dear', amount: 0 }] });
    const l = setupLines(hire.lines, tpl, true, HEADS, DEFAULT_GRADE_POLICY);
    assert.equal(l.basic, 30000);
    assert.equal(l.gradeAmount, 3000);
    assert.deepEqual(l.amounts, { tran: 2500 });
    assert.deepEqual(l.computed, ['dear']);
    assert.equal(l.scheme, 'ssf');
    assert.equal(setupLines(hire.lines, t({ scheme: 'pf' }), true, HEADS, DEFAULT_GRADE_POLICY).scheme, 'pf');
    assert.equal(setupLines(hire.lines, null, false, HEADS, DEFAULT_GRADE_POLICY).scheme, 'none');
  });

  it('with no salary yet, the template basic applies (its amount, or the level start)', () => {
    const none = { ...EMPTY_LINES };
    const tpl = t({ basicAmount: 25000, heads: [{ payHeadId: 'tran', amount: 1000 }] });
    const l = setupLines(none, tpl, true, HEADS, DEFAULT_GRADE_POLICY, { levelStart: 18000 });
    assert.equal(l.basic, 25000);
    assert.deepEqual(l.amounts, { tran: 1000 });
    assert.equal(l.scheme, 'ssf');
    assert.equal(setupLines(none, t({ basicMode: 'level_start' }), false, HEADS, DEFAULT_GRADE_POLICY, { levelStart: 18000 }).basic, 18000);
    // Basic + grade from the employee form are still kept.
    assert.equal(setupLines(hire.lines, tpl, true, HEADS, DEFAULT_GRADE_POLICY).basic, 30000);
  });

  it('a template leaves out pay heads limited to other departments / designations', () => {
    const limited = HEADS.map((h) => (h.id === 'tran' ? { ...h, appliesTo: { departmentIds: ['it'], designationIds: [] } } : h));
    const tpl = t({ basicAmount: 30000, heads: [{ payHeadId: 'tran', amount: 1000 }, { payHeadId: 'cit', amount: 500 }] });
    assert.deepEqual(applyTemplate(tpl, lines(), limited, 0, DEFAULT_GRADE_POLICY, { departmentId: 'hr', designationId: 'x' }).amounts, { cit: 500 });
    assert.deepEqual(applyTemplate(tpl, lines(), limited, 0, DEFAULT_GRADE_POLICY, { departmentId: 'it', designationId: 'x' }).amounts, { tran: 1000, cit: 500 });
    // Without the employee (template previews) nothing is left out.
    assert.deepEqual(applyTemplate(tpl, lines(), limited, 0, DEFAULT_GRADE_POLICY).amounts, { tran: 1000, cit: 500 });
  });

  it('an employee level saved as the code or the level name both match; anything else stays as saved', () => {
    const levels = [{ code: 'S7', name: 'Level 7 (Senior Officer)' }];
    assert.equal(resolveLevelCode('S7', levels), 'S7');
    assert.equal(resolveLevelCode(' level 7 (senior officer) ', levels), 'S7');
    assert.equal(resolveLevelCode('Level 7: Deputy', levels), 'Level 7: Deputy');
  });

  it('template coverage counts who each fits and names overlapping active templates', () => {
    const a = t({ id: 'a', name: 'A', levelCodes: ['S5'] });
    const b = t({ id: 'b', name: 'B' });
    const c = t({ id: 'c', name: 'C', levelCodes: ['S9'], isActive: false });
    const people = [{ levelCode: 'S5', designationId: 'd' }, { levelCode: 'S9', designationId: 'd' }];
    const cov = templateCoverage([a, b, c], people);
    assert.deepEqual(cov.get('a'), { count: 1, overlaps: ['B'] });
    assert.deepEqual(cov.get('b'), { count: 2, overlaps: ['A'] });
    assert.deepEqual(cov.get('c'), { count: 1, overlaps: [] });
  });

  it('deleting a template needs the Delete permission and is audited; salaries are not touched', () => {
    const src = read('app/actions/salary-structure.actions.ts').replace(/\r\n/g, '\n');
    assert.match(src, /export async function deleteSalaryTemplateAction[\s\S]*?checkPermissionWithScope\('DELETE', 'SALARY_MAPPING'\)[\s\S]*?recordAuditLog\(\{[^}]*action: 'DELETE'/);
    const repo = read('lib/repositories/salary-structure.repository.ts').replace(/\r\n/g, '\n');
    const body = repo.match(/export async function deleteTemplate[\s\S]*?\n\}/)![0];
    assert.match(body, /delete\(salaryTemplates\)/);
    assert.doesNotMatch(body, /employeeSalaryMap|salaryChangeBatches/);
  });

  it('templates that fit the level / designation come first; inactive ones are left out', () => {
    const list = [t({ id: 'a', name: 'A', levelCodes: ['S5'] }), t({ id: 'b', name: 'B', levelCodes: ['S9'] }), t({ id: 'c', name: 'C', isActive: false })];
    const { fitting, other } = templatesFor(list, { levelCode: 'S5', designationId: 'd' });
    assert.deepEqual(fitting.map((x) => x.id), ['a']);
    assert.deepEqual(other.map((x) => x.id), ['b']);
  });

  it('the set-up date is the joining date, or the first day payroll is still open', () => {
    assert.equal(setupEffectiveFrom('2026-08-01', 'e', {}), '2026-08-01');
    assert.equal(setupEffectiveFrom('2026-08-01', 'e', { e: '2026-09-16' }), '2026-09-17');
  });

  it('pay heads limited to departments / designations apply only there', () => {
    const h = { appliesTo: { departmentIds: ['it'], designationIds: [] } };
    assert.equal(headAppliesTo(h, { departmentId: 'it', designationId: 'x' }), true);
    assert.equal(headAppliesTo(h, { departmentId: 'hr', designationId: 'x' }), false);
    assert.equal(headAppliesTo({ appliesTo: { departmentIds: [], designationIds: [] } }, { departmentId: 'hr', designationId: 'x' }), true);
  });

  it('a set-up batch is accepted, may be unchanged, and only for new hires to set up', () => {
    const b = normalizeBatch({ kind: 'setup', effectiveFrom: '2026-08-01', reason: 'Salary structure set up', rows: [{ employeeId: 'e', lines: lines() }] });
    assert.equal(b.kind, 'setup');
    const src = read('lib/services/salary-structure.service.ts');
    // No structure at all is accepted too (Add new); a full structure is refused.
    assert.match(src, /if \(input\.kind === "setup"\) \{[\s\S]*?if \(current && !needsSetup\([\s\S]*?already has a salary structure[\s\S]*?\} else if \(current && !changedLines\(current, lines\)\.length\) continue;/);
  });

  it('Add new / Bulk add cover employees with no structure or basic + grade only', () => {
    assert.equal(needsStructure({ status: 'none' }), true);
    assert.equal(needsStructure({ status: 'setup' }), true);
    for (const s of ['current', 'future', 'pending']) assert.equal(needsStructure({ status: s }), false);
  });
});


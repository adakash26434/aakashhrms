import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { preflightFindings } from '../lib/engines/payroll-control.engine';

// Company settings (4.12, S49): fiscal years and tax slabs. Found while migrating: every write
// checked the permission only — no scope — so a branch or department role with Fiscal year or
// Tax rates → Edit could change every branch's settings, and platform support could too; reading
// the slabs needed no permission at all; nothing was audited; raw errors were returned (S9).
// Making a year active turned every other year — closed ones included — back to open and cleared
// their payslip flag; labels were built from the AD years ("FY 2026/27" for FY 2083/84); slabs
// were edited one by one with "+1" chaining, so a ladder could be left with gaps or overlaps.
// Pay runs took whichever year was current, so Asar's run made after the next year was current
// was filed and taxed in the wrong year, and a year without slabs withheld no tax at all.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const fn = (src: string, name: string) => {
  const start = src.search(new RegExp(`(export )?(async )?function ${name}\\b`));
  assert.ok(start >= 0, name);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

const fyActions = read('app/actions/fiscal-year.actions.ts');
const taxActions = read('app/actions/tax-rate.actions.ts');
const fyService = read('lib/services/fiscal-year.service.ts');
const taxService = read('lib/services/tax-rate.service.ts');
const fyRepo = read('lib/repositories/fiscal-year.repository.ts');
const taxRepo = read('lib/repositories/tax-rate.repository.ts');
const checkPermission = read('lib/auth/check-permission.ts');

describe('S49 company settings are changed by a company-wide role only, never platform support', () => {
  it('checkCompanyControl refuses support view and any branch or department role', () => {
    const body = fn(checkPermission, 'checkCompanyControl');
    assert.match(body, /const scope = await checkPermissionWithScope\(action, module\);/);
    assert.match(body, /if \(scope\.isImpersonation\) throw new UserFacingError\(/);
    assert.match(body, /if \(scope\.scopeType !== 'GLOBAL'\) throw new UserFacingError\(/);
  });

  it('every fiscal-year change goes through it, with safe errors', () => {
    assert.match(fyActions, /^'use server';/);
    assert.match(fn(fyActions, 'editor'), /checkCompanyControl\(action, 'FISCAL_YEAR'\)/);
    assert.doesNotMatch(fyActions, /checkPermission\('(ADD|EDIT|LOCK|DELETE)'/, 'no unscoped write check');
    // The role matrix's own actions: Add a year, Edit (make current, delete an unused one), Lock (close, reopen).
    for (const [action, call, permission] of [
      ['createFiscalYearAction', 'createFiscalYear', 'ADD'],
      ['makeFiscalYearCurrentAction', 'makeCurrent', 'EDIT'],
      ['closeFiscalYearAction', 'closeYear', 'LOCK'],
      ['reopenFiscalYearAction', 'reopenYear', 'LOCK'],
      ['deleteFiscalYearAction', 'deleteYear', 'EDIT'],
    ]) {
      const body = fn(fyActions, action);
      assert.match(body, new RegExp(`service\\.${call}\\([^;]*await editor\\('${permission}'\\)\\)`), action);
      assert.match(body, /return toActionError\(error, 'fiscal-year\.[a-z]+'\);/, action);
    }
    assert.match(fn(fyActions, 'fiscalYearsPageAction'), /await checkPermission\('VIEW', 'FISCAL_YEAR'\);/);
    assert.doesNotMatch(fyActions, /error\.message/, 'no raw error text');
    for (const old of ['updateFiscalYearAction', 'setFiscalYearStatusAction', 'unlockFiscalYearAction', 'lockFiscalYearAction']) assert.doesNotMatch(fyActions, new RegExp(old), old);
  });

  it('every tax-slab change goes through it; reading needs Tax rates → View', () => {
    assert.match(taxActions, /^'use server';/);
    const save = fn(taxActions, 'saveTaxLadderAction');
    assert.ok(save.indexOf("checkCompanyControl('EDIT', 'TAX_RATES')") >= 0 && save.indexOf("checkCompanyControl('EDIT', 'TAX_RATES')") < save.indexOf('service.saveLadder('));
    assert.match(save, /return toActionError\(error, 'tax-rate\.save'\);/);
    assert.match(fn(taxActions, 'taxSlabsPageAction'), /await checkPermission\('VIEW', 'TAX_RATES'\);/);
    // Only the ladder's own validation message (a UserFacingError) is passed through as it is.
    const validation = /if \(error instanceof service\.TaxLadderValidationError\) return \{ success: false as const, error: error\.message, validationErrors: error\.errors \};/;
    assert.match(save, validation);
    assert.doesNotMatch(taxActions.replace(validation, ''), /error\.message|checkPermission\('EDIT'/);
    for (const old of ['getTaxRateDataAction', 'createTaxSlabAction', 'updateTaxSlabAction', 'deleteTaxSlabAction']) assert.doesNotMatch(taxActions, new RegExp(old), old);
  });

  it('the pages check View on their own module', () => {
    assert.match(read('app/(dashboard)/setup/fiscal-year/page.tsx'), /await checkPermission\("VIEW", "FISCAL_YEAR"\);/);
    assert.match(read('app/(dashboard)/setup/tax-rates/page.tsx'), /await checkPermission\("VIEW", "TAX_RATES"\);/);
  });
});

describe('S49 every change is audited and claim-first', () => {
  it('fiscal-year moves are audited, after the claim succeeds', () => {
    for (const name of ['createFiscalYear', 'makeCurrent', 'closeYear', 'reopenYear', 'deleteYear']) {
      assert.match(fn(fyService, name), /await audit\(ctx, "(ADD|EDIT|DELETE)", /, name);
    }
    assert.match(fn(fyService, 'reopenYear'), /validateReopenReason\(reason\)[\s\S]*change: "reopened", reason: reason\.trim\(\)/);
    assert.match(fn(fyService, 'makeCurrent'), /if \(!\(await repository\.makeCurrent\(id\)\)\) throw new UserFacingError\(CHANGED\);/);
  });

  it('making a year current never touches a closed year', () => {
    const body = fn(fyRepo, 'makeCurrent');
    assert.match(body, /\.where\(and\(eq\(fiscalYears\.id, id\), isOpen\)\)/, 'claims an open year');
    assert.match(body, /\.where\(and\(eq\(fiscalYears\.status, 'Active'\), ne\(fiscalYears\.id, id\)\)\)/, 'only the current year moves aside');
    assert.doesNotMatch(fyRepo, /payslipsGenerated: false,\s*updatedAt[^}]*\}\)\s*\.where\(ne\(/, 'no blanket reset of other years');
    assert.match(fn(fyRepo, 'moveStatus'), /\.where\(and\(eq\(fiscalYears\.id, id\), from === 'Locked' \? eq\(fiscalYears\.status, 'Locked'\) : isOpen\)\)/);
    assert.match(fn(fyRepo, 'deleteYearWithSlabs'), /\.for\('update'\)[\s\S]*statusOf\(year\.status\) !== 'Inactive'/);
  });

  it('labels and dates come from the opening BS year, never the AD years', () => {
    assert.match(fn(fyService, 'createFiscalYear'), /const dates = fiscalYearDates\(bsYear\);/);
    assert.doesNotMatch(fyRepo + fyService, /getFullYear\(\)\}\/\$\{String\(/);
    // Years the old screen labelled by AD, and stray statuses, are put right once (0075, mirrored).
    for (const src of [read('lib/db/migrations/0075_fiscal_years.sql'), read('lib/db/tenant-schema-sync.ts')]) {
      assert.match(src, /SET "label" = 'FY ' \|\| left\("start_date_bs", 4\) \|\| '\/' \|\| right\(\(left\("start_date_bs", 4\)::int \+ 1\)::text, 2\)/);
      assert.match(src, /UPDATE "fiscal_years" SET "status" = 'Inactive', "updated_at" = now\(\) WHERE "status" NOT IN \('Active', 'Inactive', 'Locked'\)/);
    }
  });

  it('a ladder is checked whole, saved whole under a row lock, audited before and after', () => {
    const save = fn(taxService, 'saveLadder');
    assert.ok(save.indexOf('validateLadder(rows)') < save.indexOf('repository.replaceLadder('));
    assert.match(save, /if \(year\.status === "Locked"\) throw new UserFacingError\(closed\);/);
    assert.match(save, /if \(!\(await repository\.replaceLadder\(fiscalYearId, cat, bands\)\)\) throw new UserFacingError\(closed\);/);
    assert.match(save, /oldValues: \{ bands: plain\(before\) \},\s*newValues: \{ bands: plain\(bands\) \}/);
    const replace = fn(taxRepo, 'replaceLadder');
    assert.match(replace, /\.for\('update'\);\s*if \(!year \|\| year\.status === 'Locked'\) return false;/);
    for (const old of ['createSlab', 'updateSlab', 'deleteSlab']) assert.doesNotMatch(taxRepo, new RegExp(`function ${old}\\b`), old);
  });
});

describe('S49 a pay run belongs to the year its month falls in', () => {
  const payroll = read('lib/services/payroll.service.ts');
  const offCycle = read('lib/services/off-cycle.service.ts');
  const control = read('lib/services/payroll-control.service.ts');

  it('regular and off-cycle runs resolve the month\'s year before anything is replaced', () => {
    for (const [src, name] of [
      [payroll, 'generatePayrollRun'],
      [offCycle, 'generateOffCycleRun'],
    ] as const) {
      const body = fn(src, name);
      const resolve = body.indexOf('fiscalYearService.fiscalYearForPayMonth(payPeriodYear, payPeriodMonth)');
      assert.ok(resolve > 0, name);
      assert.ok(resolve < body.indexOf('findPayrollRunByPeriodAndBranch('), `${name}: before the duplicate check and its replacement`);
    }
    assert.doesNotMatch(payroll + offCycle, /status, ['"]Active['"]\)|status === ['"]Active['"]/, 'never the current year');
  });

  it('pre-flight blocks a month whose year is missing, closed or without tax slabs', () => {
    assert.match(fn(control, 'preflight'), /fiscalYearService\.payMonthFiscalYear\(payload\.payPeriodYear, payload\.payPeriodMonth\)/);
    assert.match(fn(control, 'preflight'), /fiscalYearProblem,\n/);
    const findings = preflightFindings({
      openAttendanceBranches: [],
      employeesWithoutSalary: [],
      employeesNeedingSetup: [],
      pendingLeaveCount: 0,
      employeesWithoutBank: [],
      employeesWithoutPan: [],
      existingRunStatus: null,
      requireClosedAttendance: false,
      fiscalYearProblem: 'FY 2084/85 has no tax slabs yet.',
    });
    assert.deepEqual(findings, [{ code: 'fiscal_year', severity: 'blocker', title: 'FY 2084/85 has no tax slabs yet.', people: [] }]);
  });

  it('the year is taken from the month and must have its Individual ladder', () => {
    const body = fn(fyService, 'payMonthFiscalYear');
    assert.match(body, /repository\.findByOpeningYear\(fiscalOpeningYearOf\(bsYear, bsMonth\)\)/);
    assert.match(body, /repository\.hasIndividualLadder\(fiscalYear\.id\)/);
  });
});

// Rules & controls (4.12b, S50). Found while migrating: saving System control checked the
// permission only (any branch role or platform support), returned raw errors and audited the
// whole settings object as one blob; every save — whatever changed — re-worked every active
// employee's grade and wrote it as an approved salary change with no preparer and no approval,
// the saver's own salary included, on top of changes still waiting for approval; and a separate
// "sync grades" action did the same on demand.
describe('S50 rules & controls: a company-wide role, and a grade policy goes through salary approval', () => {
  const actions = read('app/actions/system-control.actions.ts');
  const service = read('lib/services/system-control.service.ts');
  const salary = read('lib/services/salary-structure.service.ts');

  it('every change needs System control → Edit with a company-wide role; errors are safe', () => {
    assert.match(actions, /^'use server';/);
    assert.match(fn(actions, 'editor'), /const scope = await checkCompanyControl\('EDIT', 'SYSTEM_CONTROL'\);\s*return \{ userId: scope\.userId, scope, canChangeGrades: await hasPermission\('EDIT', 'SALARY_MAPPING'\) \};/);
    for (const [action, call] of [
      ['previewRulesAction', 'previewRules'],
      ['saveRulesAction', 'saveRules'],
      ['applyGradePolicyAction', 'applyGradePolicy'],
    ]) {
      const body = fn(actions, action);
      assert.match(body, new RegExp(`service\\.${call}\\([^;]*await editor\\(\\)\\)`), action);
      assert.match(body, /return toActionError\(error, 'rules\.[a-z]+'\);/, action);
    }
    assert.match(fn(actions, 'rulesPageAction'), /await checkPermission\('VIEW', 'SYSTEM_CONTROL'\);/);
    assert.doesNotMatch(actions, /checkPermission\('EDIT'|syncAllEmployeeGradesAction|saveSystemControlAction/);
  });

  it('a save is checked, needs a change, and is audited field by field with the user', () => {
    const save = fn(service, 'saveRules');
    assert.match(fn(service, 'prepare'), /validateRulesForm\(form\);\s*if \(!rulesAreValid\(errors\)\) throw new RulesValidationError\(errors\);/);
    assert.match(save, /if \(!changes\.length\) throw new UserFacingError\("Nothing changed\."\);/);
    assert.match(save, /recordAuditLog\(\{\s*userId: ctx\.userId,\s*action: "EDIT",\s*module: "SYSTEM_CONTROL"/);
    assert.ok(save.indexOf('if (gradesChange && !ctx.canChangeGrades) throw gradesRefused();') < save.indexOf('repository.updateSettings('), 'refused before anything is saved');
    assert.match(save, /if \(!gradesChange\) return \{ changed: changes, grades: null \};\s*const grades = await applyPolicyGrades\(gradePolicyOf\(form, settings\.gradePolicy\), ctx\);/);
  });

  it('a grade-policy change is a salary change prepared by the user, decided through approval', () => {
    const apply = fn(salary, 'applyPolicyGrades');
    assert.match(fn(salary, 'policyFlow'), /buildFlow\(policy, \{ preparerId: ctx\.userId, preparerEmployeeId: ctx\.scope\.employeeId, subjectEmployeeIds: changedIds, approvers \}\)/);
    assert.match(apply, /preparedBy: ctx\.userId,/);
    assert.match(apply, /approvedRoute: outcome\.approvedAtOnce \? outcome\.route : null,/);
    assert.match(apply, /approvalType: outcome\.approvedAtOnce \? "none" : outcome\.flow\.type,/);
    assert.doesNotMatch(apply, /approvalType: "none",|preparedBy: null|approvedRoute: "policy"/);
    const changes = fn(salary, 'policyGradeChanges');
    assert.match(changes, /if \(pending\.has\(e\.id\)\) continue;/, 'never on top of a waiting change');
    assert.match(changes, /if \(!cur \|\| cur\.gradeManual\) continue;/, 'grades typed by hand stay');
    assert.match(changes, /employeesInScope\(scope\)/);
  });
});

// Pay heads (4.12b, S51). Found while migrating: the page's data action checked no permission at
// all; adding, saving and deleting checked the permission only (any branch role or platform
// support) and returned raw errors; opening the screen rewrote every "everyone" head as a list of
// the departments and designations of the day (so later ones were left out of Salary structure),
// as did the onboarding wizard; codes were random ("PH-4821", could repeat); statutory and feed
// heads could be turned into anything; and a head used by a salary template could be deleted.
describe('S51 pay heads: a company-wide role, system heads keep their role, reads never write', () => {
  const actions = read('app/actions/pay-head.actions.ts');
  const service = read('lib/services/pay-head.service.ts');
  const repo = read('lib/repositories/pay-head.repository.ts');
  const engine = read('lib/engines/pay-head.engine.ts');
  const page = read('app/(dashboard)/setup/pay-heads/page.tsx');

  it('every change needs Pay heads → Add / Edit / Delete with a company-wide role; errors are safe', () => {
    assert.match(actions, /^'use server';/);
    assert.match(fn(actions, 'savePayHeadAction'), /const scope = await checkCompanyControl\(id \? 'EDIT' : 'ADD', 'PAY_HEADS'\);\s*const head = await service\.savePayHead\(id \? String\(id\) : null, input, \{ userId: scope\.userId \}\);/);
    assert.match(fn(actions, 'deletePayHeadAction'), /const scope = await checkCompanyControl\('DELETE', 'PAY_HEADS'\);\s*await service\.deletePayHead\(String\(id\), \{ userId: scope\.userId \}\);/);
    for (const [action, context] of [['savePayHeadAction', 'save'], ['deletePayHeadAction', 'delete'], ['payHeadsPageAction', 'page']]) {
      assert.match(fn(actions, action), new RegExp(`return toActionError\\(error, 'pay-head\\.${context}'\\);`), action);
    }
    // Only the checked form's message goes back as it is.
    assert.equal(actions.match(/error\.message/g)?.length, 1);
    assert.match(actions, /if \(error instanceof service\.PayHeadValidationError\) return \{ success: false as const, error: error\.message, validationErrors: error\.errors \};/);
    assert.doesNotMatch(actions, /checkPermission\('(ADD|EDIT|DELETE)'|getPayHeadDataAction|createPayHeadAction|updatePayHeadAction/);
  });

  it('reading needs Pay heads → View, and never writes', () => {
    assert.match(fn(actions, 'payHeadsPageAction'), /await checkPermission\('VIEW', 'PAY_HEADS'\);/);
    assert.match(page, /await checkPermission\("VIEW", "PAY_HEADS"\);/);
    assert.doesNotMatch(fn(service, 'payHeadsPage'), /insertPayHead|updatePayHead|deletePayHead|recordAuditLog/);
    for (const name of ['findAllPayHeads', 'findPayHeadById', 'usageByHead']) assert.doesNotMatch(fn(repo, name), /\.(insert|update|delete)\(/, name);
  });

  it('a save is checked against the stored head; a system head keeps its role, sums and who it is for', () => {
    const save = fn(service, 'savePayHead');
    assert.match(save, /const errors = validatePayHeadForm\(form, \{\s*otherNames: heads\.filter\(\(h\) => h\.id !== id\)\.map\(\(h\) => h\.name\),\s*current,/);
    assert.match(save, /if \(!payHeadFormIsValid\(errors\)\) throw new PayHeadValidationError\(errors\);\s*const write: PayHeadWrite = payHeadWrite\(form, current\);/);
    assert.match(save, /if \(!changed\.length\) throw new UserFacingError\("Nothing changed\."\);/);
    assert.match(save, /k === "appliesTo" \? !sameChoices\(current, write\)/, 'who it is for is compared by id');
    assert.match(fn(engine, 'validatePayHeadForm'), /if \(system\) \{[\s\S]*if \(!same\) e\.role = `\$\{system\} Only its names can change\.`;/);
    assert.match(fn(engine, 'validatePayHeadForm'), /if \(def && !def\.creatable && \(!ctx\.current \|\| roleOf\(ctx\.current\) !== f\.role\)\)/);
    assert.match(fn(engine, 'payHeadWrite'), /if \(current && systemReason\(current\)\) \{\s*return \{\s*\.\.\.names,\s*type: current\.type,\s*effectOnTax: current\.effectOnTax,/);
  });

  it('every change is audited with the user; codes are given in order, never at random', () => {
    const save = fn(service, 'savePayHead');
    assert.match(save, /recordAuditLog\(\{ userId: ctx\.userId, action: "ADD", module: "PAY_HEADS"/);
    assert.match(save, /recordAuditLog\(\{\s*userId: ctx\.userId,\s*action: "EDIT",\s*module: "PAY_HEADS"/);
    assert.match(fn(service, 'deletePayHead'), /recordAuditLog\(\{ userId: ctx\.userId, action: "DELETE", module: "PAY_HEADS"/);
    assert.match(save, /repository\.insertPayHead\(nextPayHeadCode\(codes\), write\)/);
    assert.doesNotMatch(service + repo, /Math\.random/);
  });

  it('a head stays while a salary structure, payslip or salary template uses it', () => {
    const del = fn(service, 'deletePayHead');
    assert.ok(del.indexOf('cannotDeletePayHead(') < del.indexOf('repository.deletePayHead('), 'checked before deleting');
    assert.match(fn(repo, 'usageByHead'), /from\(employeeSalaryHeads\)[\s\S]*from\(payrollSlipHeads\)[\s\S]*from\(salaryTemplates\)/);
    assert.match(del, /if \(isViolation\(error, "23503"\)\) throw new UserFacingError/);
  });

  it('an empty list is everyone: onboarding stores it so, and 0076 repairs the rewritten lists once', () => {
    const onboarding = fn(read('lib/repositories/onboarding.repository.ts'), 'bootstrapPayHeads');
    assert.match(onboarding, /applicableDepartmentIds: \[\],\s*applicableDesignationIds: \[\],/);
    assert.doesNotMatch(onboarding, /from\(departments\)|from\(designations\)/);
    const migration = read('lib/db/migrations/0076_pay_head_applicability.sql');
    const sync = read('lib/db/tenant-schema-sync.ts');
    for (const [label, src] of [['migration', migration], ['tenant sync', sync]]) {
      assert.match(src, /IF col_description\(to_regclass\('pay_heads'\), [^;]*\) IS NULL THEN/, label);
      assert.match(src, /UPDATE "pay_heads" p SET "applicable_department_ids" = ARRAY\[\]::text\[\]/, label);
      assert.match(src, /UPDATE "pay_heads" p SET "applicable_designation_ids" = ARRAY\[\]::text\[\]/, label);
      assert.match(src, /COMMENT ON COLUMN "pay_heads"\."applicable_department_ids"/, label);
    }
  });
});

// Holiday calendar (4.12c, S52). Found while migrating: adding, saving and deleting holidays
// checked the permission only — no scope — so a branch role with Holidays → Add / Edit / Delete,
// or platform support, could give or take days off for every branch; holidays inside a closed
// attendance month could be added, moved or deleted (changing finalised attendance and pay); raw
// errors were returned and nothing was audited. Also: a name could be used once ever (Dashain
// could not come back next year), and "women only" was guessed from the holiday's name.
describe('S52 holidays: scope, closed months and an audit line for every change', () => {
  const actions = read('app/actions/holiday.actions.ts');
  const service = read('lib/services/holiday.service.ts');
  const engine = read('lib/engines/holiday.engine.ts');
  const page = read('app/(dashboard)/setup/holidays/page.tsx');

  it('every action checks Holidays with the user\'s scope; errors are safe', () => {
    assert.match(actions, /^'use server';/);
    assert.match(fn(actions, 'saveHolidayAction'), /const scope = await checkPermissionWithScope\(id \? 'EDIT' : 'ADD', 'HOLIDAYS'\);\s*const result = await service\.saveHoliday\(id \? String\(id\) : null, input, \{ scope, userId: scope\.userId \}\);/);
    assert.match(fn(actions, 'deleteHolidayAction'), /const scope = await checkPermissionWithScope\('DELETE', 'HOLIDAYS'\);\s*const result = await service\.deleteHoliday\(String\(id\), \{ scope, userId: scope\.userId \}\);/);
    assert.match(fn(actions, 'holidaysPageAction'), /const scope = await checkPermissionWithScope\('VIEW', 'HOLIDAYS'\);/);
    assert.match(page, /const scope = await checkPermissionWithScope\("VIEW", "HOLIDAYS"\);/);
    for (const [action, context] of [['saveHolidayAction', 'save'], ['deleteHolidayAction', 'delete'], ['holidaysPageAction', 'page']]) {
      assert.match(fn(actions, action), new RegExp(`return toActionError\\(error, 'holiday\\.${context}'\\);`), action);
    }
    assert.equal(actions.match(/error\.message/g)?.length, 1, 'only the checked form\'s message');
    assert.doesNotMatch(actions, /checkPermission\(|createHolidayAction|updateHolidayAction/);
  });

  it('a branch role works on its own branches; every branch needs a company-wide role; never support', () => {
    const scope = fn(engine, 'scopeProblem');
    assert.match(scope, /if \(scope\.isImpersonation\) return/);
    assert.match(scope, /if \(scope\.scopeType === "GLOBAL"\) return null;\s*if \(scope\.scopeType !== "BRANCH"\) return/);
    assert.match(scope, /if \(!branchIds\.length\) return "A holiday for every branch needs a company-wide role/);
    assert.match(scope, /if \(branchIds\.some\(\(id\) => !scope\.branchIds\.includes\(id\)\)\) return/);
    const save = fn(service, 'saveHoliday');
    assert.ok(save.indexOf('scopeProblem(ctx.scope, current.branchIds)') < save.indexOf('normalizeHolidayForm(raw)'), 'the holiday as it was, first');
    assert.match(save, /const reach = scopeProblem\(ctx\.scope, form\.branchIds\);/);
    const del = fn(service, 'deleteHoliday');
    assert.ok(del.indexOf('scopeProblem(ctx.scope, current.branchIds)') < del.indexOf('repository.deleteHoliday('));
  });

  it('nothing moves inside a closed attendance month, before or after', () => {
    const save = fn(service, 'saveHoliday');
    assert.match(save, /const touchesDays = !current \|\| write\.startDate !== current\.startDate \|\| write\.endDate !== current\.endDate \|\| write\.appliesTo !== current\.appliesTo \|\| !sameBranches\(write\.branchIds, current\.branchIds\);/);
    assert.match(save, /const problem = \(was \? closedProblem\(was, closed, branchName\) : null\) \?\? closedProblem\(\{ from: form\.from, to: form\.to, branchIds: write\.branchIds \}, closed, branchName\);\s*if \(problem\) throw new UserFacingError\(problem\);/);
    assert.ok(save.indexOf('if (problem) throw') < save.indexOf('repository.insertHoliday('), 'checked before writing');
    const del = fn(service, 'deleteHoliday');
    assert.ok(del.indexOf('closedProblem(') < del.indexOf('repository.deleteHoliday('));
    assert.match(fn(service, 'closedMonths'), /attendanceRepo\.findClosedPeriodsOverlapping\(from, to\)/);
  });

  it('every change is audited with the user', () => {
    const save = fn(service, 'saveHoliday');
    assert.match(save, /recordAuditLog\(\{ userId: ctx\.userId, action: "ADD", module: "HOLIDAYS"/);
    assert.match(save, /recordAuditLog\(\{\s*userId: ctx\.userId,\s*action: "EDIT",\s*module: "HOLIDAYS"/);
    assert.match(save, /if \(!changed\.length\) throw new UserFacingError\("Nothing changed\."\);/);
    assert.match(fn(service, 'deleteHoliday'), /recordAuditLog\(\{ userId: ctx\.userId, action: "DELETE", module: "HOLIDAYS"/);
  });

  it('attendance and leave read who a holiday reaches from one rule, never the name', () => {
    for (const p of ['lib/services/attendance.service.ts', 'lib/services/leave.service.ts']) {
      const src = read(p);
      assert.match(src, /holidays\.find\(\(h\) => holidayApplies\(h, (e|person), date\)\)/, p);
      assert.doesNotMatch(src, /\/women\/i/, p);
    }
    assert.match(fn(engine, 'holidayApplies'), /\(h\.appliesTo !== "women" \|\| person\.gender === "Female"\)/);
    const migration = read('lib/db/migrations/0077_holiday_applies_to.sql');
    const sync = read('lib/db/tenant-schema-sync.ts');
    for (const [label, src] of [['migration', migration], ['tenant sync', sync]]) {
      assert.match(src, /ALTER TABLE "holidays" ADD COLUMN "applies_to" varchar\(10\) DEFAULT 'everyone' NOT NULL;\s*UPDATE "holidays" SET "applies_to" = 'women' WHERE "name" ~\* 'women';/, label);
    }
  });
});

// Company setup (4.12c, S53). Found while migrating: saving the company profile and asking the
// platform to change the legal details checked Organization → Edit without scope (a branch or
// department role, or platform support, changed the signatories every letter and salary sheet
// prints, and filed requests in the company's name); withdrawing a request looked it up by id
// only — any company's waiting request could be withdrawn by its id; nothing was audited; raw
// errors were returned; two unused actions stayed public endpoints (reading the whole setup bundle,
// writing the work schedule keys the default shift owns); a free "logo URL" was stored unchecked.
describe('S53 company setup: a company-wide role, the own company only, every change audited', () => {
  const actions = read('app/actions/company-setup.actions.ts');
  const service = read('lib/services/company-setup.service.ts');
  const platform = read('lib/platform/company-details.ts');
  const repo = read('lib/repositories/company-setup.repository.ts');
  const page = read('app/(dashboard)/setup/company-setup/page.tsx');

  it('changes need Organization → Edit with a company-wide role; reading needs View; errors are safe', () => {
    assert.match(actions, /^'use server';/);
    assert.match(fn(actions, 'saveCompanyProfileAction'), /const scope = await checkCompanyControl\('EDIT', 'ORG_STRUCTURE'\);\s*const result = await service\.saveCompanyProfile\(input, \{ userId: scope\.userId \}\);/);
    for (const [action, call] of [['requestLegalChangeAction', 'requestLegalChange'], ['cancelLegalChangeAction', 'cancelLegalChange']]) {
      assert.match(fn(actions, action), new RegExp(`const scope = await checkCompanyControl\\('EDIT', 'ORG_STRUCTURE'\\);\\s*(const result = )?await service\\.${call}\\(`), action);
    }
    assert.match(fn(actions, 'companySetupPageAction'), /checkPermissionWithScope\('VIEW', 'ORG_STRUCTURE'\)/);
    assert.match(page, /checkPermissionWithScope\("VIEW", "ORG_STRUCTURE"\)/);
    for (const [action, context] of [['saveCompanyProfileAction', 'save'], ['requestLegalChangeAction', 'request'], ['cancelLegalChangeAction', 'cancel'], ['companySetupPageAction', 'page']]) {
      assert.match(fn(actions, action), new RegExp(`return toActionError\\(error, 'company-setup\\.${context}'\\);`), action);
    }
    assert.equal(actions.match(/error\.message/g)?.length, 2, 'only the checked forms\' messages');
    assert.doesNotMatch(actions, /getCompanyMasterSetupAction|saveCompanyWorkScheduleAction|submitCompanyChangeRequestAction|getCompanyChangeRequestStatusAction|checkPermission\('EDIT'/);
  });

  it('requests are for the signed-in user\'s own company, withdrawn only by it', () => {
    assert.match(fn(service, 'contextFor'), /const session = await auth\(\);[\s\S]*resolvePlatformCompanyForTenant\(session\?\.user\?\.tenantSlug \|\| undefined\)/);
    assert.doesNotMatch(actions, /companyId/, 'never from the browser');
    const cancel = fn(platform, 'cancelDetailsRequest');
    assert.match(cancel, /eq\(companyChangeRequests\.id, p\.requestId\),\s*eq\(companyChangeRequests\.companyId, p\.companyId\),\s*eq\(companyChangeRequests\.kind, COMPANY_DETAILS\),\s*eq\(companyChangeRequests\.status, 'PENDING'\)/);
    const create = fn(platform, 'createDetailsRequest');
    assert.ok(create.indexOf(".for('update')") < create.indexOf('.insert(companyChangeRequests)'), 'one waiting request, checked under the company row lock');
  });

  it('every change is audited with the user; only the company\'s own keys are written', () => {
    assert.match(fn(service, 'saveCompanyProfile'), /recordAuditLog\(\{\s*userId: ctx\.userId,\s*action: "EDIT",\s*module: "ORG_STRUCTURE",\s*recordId: "Company profile"/);
    assert.match(fn(service, 'requestLegalChange'), /recordAuditLog\(\{\s*userId: ctx\.userId,\s*action: "ADD",\s*module: "ORG_STRUCTURE"/);
    assert.match(fn(service, 'cancelLegalChange'), /recordAuditLog\(\{ userId: ctx\.userId, action: "EDIT", module: "ORG_STRUCTURE"/);
    const save = fn(repo, 'saveProfileFields');
    assert.doesNotMatch(save, /company_legal_name|company_pan_vat|company_registration_no|company_office_address|company_logo_url/);
    assert.doesNotMatch(repo, /company_logo_url/);
  });
});

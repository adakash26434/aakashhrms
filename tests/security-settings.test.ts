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

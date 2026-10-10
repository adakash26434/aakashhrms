import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertOfficeScope } from '../lib/services/report.service';
import { UserFacingError } from '../lib/errors/action-error';

// Reports (4.11, S48). Found while migrating: the self-service role carries Payslip report and
// Leave report View, and the leave report and pay-head summary actions had no scope — any
// employee could call them for every employee's leave balances, requests and reasons, and the
// company's pay totals; the salary sheet read every branch and any run by id (drafts too); report
// pages sent every employee's name and every run's net total to the browser; three CSV exports
// were neither scoped nor audited; raw errors were returned; and the letterhead could fall back to
// another company's details. Now every report is built on the server within the viewer's scope,
// never for a SELF role, from approved / locked runs (payslips: locked), with exports gated and
// audited and the tenant's own letterhead.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const fn = (src: string, name: string) => {
  const start = src.search(new RegExp(`(export )?(async )?function ${name}\\b`));
  assert.ok(start >= 0, name);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

const actions = read('app/actions/report.actions.ts');
const service = read('lib/services/report.service.ts');
const repo = read('lib/repositories/report.repository.ts');
const REPORTS: [action: string, module: string, service: string, page: string][] = [
  ['salarySheetAction', 'REPORTS_SALARY_SHEET', 'salarySheet', 'salary-sheet'],
  ['payslipReportAction', 'REPORTS_PAYSLIP', 'payslipReport', 'payslip'],
  ['attendanceReportAction', 'REPORTS_ATTENDANCE', 'attendanceReport', 'attendance'],
  ['leaveReportAction', 'REPORTS_LEAVE', 'leaveReport', 'leave'],
  ['loanReportAction', 'REPORTS_LOAN', 'loanReport', 'loan'],
];

describe('S48 every report: its own module, the viewer\'s scope, never a SELF role', () => {
  it('actions check View with scope on the report\'s module and hide errors', () => {
    assert.match(actions, /^'use server';/);
    assert.doesNotMatch(actions, /checkPermission\(/, 'no unscoped permission check');
    assert.match(fn(actions, 'viewer'), /const scope = await checkPermissionWithScope\('VIEW', module\);\s*return \{ userId: scope\.userId, scope, canExport: await hasPermission\('EXPORT', module\) \};/);
    for (const [action, module, call] of REPORTS) {
      const body = fn(actions, action);
      assert.match(body, new RegExp(`const ctx = await viewer\\('${module}'\\);`), action);
      assert.match(body, new RegExp(`reportService\\.${call}\\(ctx, params`), action);
      assert.match(body, /return toActionError\(error, 'report\.[a-z-]+'\);/, action);
    }
    // The old unscoped actions and the server-built CSVs are gone.
    for (const old of ['getLeaveReportAction', 'getPayslipHeadSummaryAction', 'getReportFilterLookupDataAction', 'exportSalarySheetCsvAction', 'exportLeaveBalancesCsvAction', 'exportLoanSummaryCsvAction']) {
      assert.doesNotMatch(actions, new RegExp(old), old);
    }
  });

  it('pages check View with scope and pass the scope to the service', () => {
    for (const [, module, call, page] of REPORTS) {
      const src = read(`app/(dashboard)/reports/${page}/page.tsx`);
      assert.match(src, new RegExp(`const scope = await checkPermissionWithScope\\("VIEW", "${module}"\\);`), page);
      assert.match(src, new RegExp(`${call}\\(\\{ userId: scope\\.userId, scope, canExport`), page);
      assert.doesNotMatch(src, /getReportFilterLookupData|checkPermission\(/, page);
    }
  });

  it('every report refuses a SELF role first', () => {
    for (const [, , call] of REPORTS) assert.match(fn(service, call), /^export async function \w+\(ctx: ReportCtx, raw: unknown[^)]*\)[^{]*\{\s*assertOfficeScope\(ctx\.scope\);/, call);
    const self = { scopeType: 'SELF' as const, branchIds: [], departmentIds: [], employeeId: 'e1', userId: 'u1' };
    assert.throws(() => assertOfficeScope(self), (e: unknown) => e instanceof UserFacingError && /Self-service/.test(e.message));
    assert.doesNotThrow(() => assertOfficeScope({ ...self, scopeType: 'BRANCH', branchIds: ['b1'] }));
  });

  it('queries about employees take the scope as a required argument and use it', () => {
    for (const name of ['employeesInScope', 'runsWithSlipsInScope', 'runSlips', 'loansInScope', 'repaymentsInScope']) {
      const body = fn(repo, name);
      assert.match(body, /\bscope: Scope\b/, `${name} takes the scope`);
      assert.doesNotMatch(body, /scope\?: Scope/, `${name}: scope is not optional`);
      assert.match(body, /\bscope\b(,|\))|\$\{scope\}/, `${name} uses it`);
    }
    // The places offered (branches, departments, people) are those the viewer covers.
    assert.match(fn(service, 'names'), /repo\.employeesInScope\(scopeCondition\(scope\)\)/);
    assert.match(fn(service, 'leaveReport'), /findPeople\(scopeCondition\(ctx\.scope\)\)/);
    assert.match(fn(service, 'attendanceReport'), /await reportMonth\(ctx\.scope, /);
  });
});

describe('S48 what each report may show', () => {
  it('salary sheet: approved or locked runs only; account numbers only in the bank list', () => {
    const sheet = fn(service, 'salarySheet');
    assert.match(sheet, /runChoices\(\["APPROVED", "LOCKED"\], ctx\.scope, n\)/);
    assert.match(sheet, /const runRow = runs\.rows\.find\(\(r\) => r\.id === params\.runId\);\s*if \(!runRow\) return empty;/);
    assert.match(sheet, /bank: view === "bank" \? engine\.bankRows\(items\) : \[\],/);
    assert.doesNotMatch(read('lib/types/report.ts').slice(0, read('lib/types/report.ts').indexOf('export interface BankTransferRow')), /bankAccount|account:/, 'only the bank row type carries an account');
    // The run list carries no company totals.
    assert.doesNotMatch(fn(repo, 'runsWithSlipsInScope'), /totalNetPayable|employeeCount|totalGross/);
  });

  it('payslips: locked runs only (F11), scope and filters passed to the sheets', () => {
    assert.match(fn(service, 'payslipReport'), /runChoices\(\["LOCKED"\], ctx\.scope, n\)/);
    assert.match(read('lib/services/payslip-sheet.service.ts'), /if \(status !== 'LOCKED'\) return \{ status, items: \[\] \};/);
  });

  it('attendance: OT pay and the absence deduction only for viewers of the salary sheet', () => {
    assert.match(fn(actions, 'attendanceReportAction'), /const showAmounts = await hasPermission\('VIEW', 'REPORTS_SALARY_SHEET'\);/);
    assert.match(read('app/(dashboard)/reports/attendance/page.tsx'), /hasPermission\("VIEW", "REPORTS_SALARY_SHEET"\)/);
    assert.match(read('lib/engines/report.engine.ts'), /otPay: showAmounts \? money\(dec\(p\.amounts\.otEarnedAmount\)\) : null,/);
  });

  it('leave: reasons only when asked for; deciders by name, never e-mail', () => {
    const leave = fn(service, 'leaveReport');
    assert.match(leave, /reason: params\.reasons \? r\.reason : null,/);
    assert.match(leave, /findUserNames\(/);
    assert.doesNotMatch(leave, /users\.email/);
  });

  it('the letterhead is the tenant\'s own company profile (no other company\'s details)', () => {
    assert.doesNotMatch(service, /platformDb|@\/lib\/platform\//);
    assert.match(fn(service, 'letterhead'), /await companyLetterhead\(\)/);
  });

  it('exports: Export permission and an audit line before the file is made, from the rows on the page', () => {
    const kit = read('components/kit/report-viewer.tsx');
    assert.match(fn(kit, 'useReportExport'), /const result = await authorizeExportAction\(\{ module, label, rowCount \}\);/);
    assert.match(fn(kit, 'useReportExport'), /if \(!\(await gate\(`\$\{p\.label\} \(Excel\)`, p\.rowCount\)\)\) return;/);
    assert.match(fn(kit, 'useReportExport'), /if \(!\(await gate\(`\$\{p\.label\} \(CSV\)`, p\.rowCount\)\)\) return;/);
    for (const [client, module] of [
      ['salary-sheet-client', 'REPORTS_SALARY_SHEET'],
      ['attendance-report-client', 'REPORTS_ATTENDANCE'],
      ['leave-report-client', 'REPORTS_LEAVE'],
      ['loan-report-client', 'REPORTS_LOAN'],
    ]) {
      const src = read(`components/reports/${client}.tsx`);
      assert.match(src, new RegExp(`useReportExport\\("${module}"`), client);
      assert.match(src, /excel=\{context\.canExport \?/, client);
      assert.doesNotMatch(src, /csv \+=|\.join\(","\)/, `${client}: no hand-built CSV`);
    }
    assert.doesNotMatch(read('lib/engines/report.engine.ts'), /buildSalarySheetCSV|buildLeaveBalancesCSV|escapeCsv/);
  });
});

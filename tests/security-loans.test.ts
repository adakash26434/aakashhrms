import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 4.10 loans (S47): every employee's self-service role carries Loans → View and Add, and the old
// actions checked the permission only — anyone could list every staff loan and disburse a loan to
// anyone, themselves included, with no approval. Now: LOANS with the user's scope everywhere,
// requests decided by someone else through the approval engine (never one's own, never the person
// who asked), claim-first moves, balances changed only by statements that check them, payroll
// deducting recorded loans only (posted in the lock's transaction), and the final settlement
// holding and closing the loans it recovers.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const actions = read('app/actions/loan.actions.ts');
const service = read('lib/services/loan.service.ts');
const payrollLoans = read('lib/services/loan-payroll.service.ts');
const opening = read('lib/services/loan-opening.service.ts');
const repo = read('lib/repositories/loan.repository.ts');
const payroll = read('lib/services/payroll.service.ts');
const settlement = read('lib/services/settlement.service.ts');
const ess = read('lib/services/ess-extras.service.ts');
const fn = (src: string, name: string) => {
  const start = src.search(new RegExp(`(export )?(async )?function ${name}\\b`));
  assert.ok(start >= 0, name);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
};

describe('S47 loans: permission with scope, company controls', () => {
  it('every action checks LOANS with the user\'s scope', () => {
    assert.match(actions, /^'use server';/);
    assert.match(fn(actions, 'ctx'), /const scope = await checkPermissionWithScope\(need, 'LOANS'\);/);
    assert.doesNotMatch(actions, /checkPermission\(/);
    for (const [name, need] of [
      ['loanDetailAction', 'VIEW'],
      ['previewLoanRequestAction', 'ADD'],
      ['requestLoanAction', 'ADD'],
      ['disburseLoanAction', 'ADD'],
      ['recordLoanRepaymentAction', 'EDIT'],
      ['writeOffLoanAction', 'APPROVE'],
      ['removeOpeningLoanAction', 'DELETE'],
      ['previewLoanOpeningImportAction', 'ADD'],
      ['commitLoanOpeningImportAction', 'ADD'],
    ] as const) {
      assert.match(fn(actions, name), new RegExp(`ctx\\('${need}'\\)`), name);
    }
    assert.match(fn(actions, 'decideLoanRequestAction'), /ctx\(decision === 'withdraw' \? 'ADD' : 'APPROVE'\)/);
    assert.match(read('app/(dashboard)/loans/page.tsx'), /checkPermissionWithScope\("VIEW", "LOANS"\)/);
  });

  it('loan types and approval settings: company-wide users, never platform support', () => {
    const company = fn(actions, 'companyCtx');
    assert.match(company, /if \(c\.scope\.isImpersonation\) throw new UserFacingError/);
    assert.match(company, /if \(c\.scope\.scopeType !== 'GLOBAL'\) throw new UserFacingError/);
    assert.match(fn(actions, 'saveLoanTypeAction'), /companyCtx\('EDIT'\)/);
    assert.match(fn(actions, 'deleteLoanTypeAction'), /companyCtx\('DELETE'\)/);
    // 4.12d: the approval setting moved to Setup → Approvals (Loans → Approve, company-wide).
    assert.doesNotMatch(actions, /saveLoanApprovalSettingsAction/);
    assert.match(fn(read('app/actions/approval-settings.actions.ts'), 'saveLoanApprovalPolicyAction'), /await checkCompanyControl\('APPROVE', 'LOANS'\)/);
    // Platform support never changes a loan.
    assert.match(fn(service, 'prepareRequest'), /refuseSupport\(ctx\);/);
    assert.match(fn(service, 'decideRequest'), /refuseSupport\(ctx\);/);
    assert.match(fn(service, 'disburseRequest'), /refuseSupport\(ctx\);/);
    assert.match(fn(service, 'runningLoanInScope'), /refuseSupport\(ctx\);/);
  });

  it('loans and requests are read within the scope', () => {
    const page = fn(service, 'loansPage');
    assert.match(page, /const scopeCondition = buildEmployeeScopeCondition\(ctx\.scope\);/);
    assert.match(page, /repo\.listLoans\(scopeCondition\),\s*repo\.listRequests\(scopeCondition\),\s*repo\.listTypes\(\),\s*findEmployeeOptions\(scopeCondition\)/);
    assert.match(fn(service, 'loanDetail'), /repo\.findLoan\(id, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(fn(service, 'decideRequest'), /repo\.findRequest\(id, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(fn(service, 'disburseRequest'), /repo\.findRequest\(id, scopeCondition\)/);
    assert.match(fn(service, 'runningLoanInScope'), /repo\.findLoan\(id, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(fn(service, 'planRequest'), /repo\.activeEmployeeInScope\(form\.employeeId, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
    assert.match(fn(service, 'countWaitingFor'), /repo\.pendingRequests\(buildEmployeeScopeCondition\(scope\)\)/);
    assert.match(opening, /employeeRepository\.findAll\(\{[^}]*\}, buildEmployeeScopeCondition\(ctx\.scope\)\)/);
  });
});

describe('S47 loans: never one\'s own, never what one asked for', () => {
  it('own-record refusals are audited DENIED_SELF before anything moves', () => {
    const refuse = fn(service, 'refuseOwn');
    assert.match(refuse, /if \(!isOwnRecord\(ctx\.scope\.employeeId, employeeId\)\) return;/);
    assert.match(refuse, /result: DENIED_SELF/);
    for (const [name, write] of [
      ['disburseRequest', 'repo.disburse('],
      ['recordRepayment', 'repo.postPayment('],
      ['writeOffLoan', 'repo.writeOff('],
      ['removeOpeningLoan', 'repo.deleteOpeningLoan('],
    ] as const) {
      const body = fn(service, name);
      assert.ok(body.indexOf('await refuseOwn(ctx,') >= 0 && body.indexOf('await refuseOwn(ctx,') < body.indexOf(write), name);
    }
    assert.match(opening, /if \(isOwnRecord\(ctx\.scope\.employeeId, employee\.id\)\) err\(/);
  });

  it('decisions go through the approval engine; refusals about oneself are audited', () => {
    const decide = fn(service, 'decideRequest');
    assert.match(decide, /const can = availableActions\(request, actor, engine\.loanDecisionCtx\(approvers, checker, today\(\)\)\);/);
    assert.match(decide, /if \(own \|\| row\.preparedBy === ctx\.userId\) await recordAuditLog\(\{[^}]*result: DENIED_SELF/);
    assert.match(decide, /const next = applyDecision\(request, step\);/);
    // The engine's wording and the maker-checker mode (strict: no Final approve of one's own request).
    assert.match(read('lib/engines/loan.engine.ts'), /preparerMayFinalApprove: checker !== "strict"/);
    // A request about the person asking always waits, even with approvals off (buildFlow).
    assert.match(fn(service, 'prepareRequest'), /buildFlow\(policy, \{ preparerId: ctx\.userId, preparerEmployeeId: ctx\.scope\.employeeId \?\? null, subjectEmployeeIds: \[plan\.form\.employeeId\], approvers \}\)/);
    // One's own request is only for the types employees ask for themselves.
    assert.match(fn(service, 'planRequest'), /ownRequest: isOwnRecord\(ctx\.scope\.employeeId, form\.employeeId\)/);
  });

  it('platform support never approves (the actor drops Approve)', () => {
    assert.match(fn(service, 'actorOf'), /const canApprove = ctx\.canApprove && !ctx\.scope\.isImpersonation;/);
    assert.match(fn(service, 'countWaitingFor'), /if \(scope\.isImpersonation\) return 0;/);
  });
});

describe('S47 loans: claim-first moves, balances checked where they change', () => {
  it('a decision applies only while the request waits at the level it was read with', () => {
    assert.match(fn(repo, 'decideRequest'), /\.where\(and\(eq\(loanRequests\.id, id\), eq\(loanRequests\.status, "pending"\), eq\(loanRequests\.currentLevel, expectLevel\)\)\)/);
    assert.match(fn(repo, 'decideRequest'), /await tx\.insert\(approvalActions\)/);
  });

  it('a request is disbursed once: the request moves before the loan is written', () => {
    const disburse = fn(repo, 'disburse');
    assert.ok(disburse.indexOf('eq(loanRequests.status, "approved")') < disburse.indexOf('tx.insert(loans)'));
    assert.match(disburse, /if \(!claimed\.length\) return null;/);
  });

  it('a balance changes only while the loan runs and still owes it; one place writes payments', () => {
    const post = fn(repo, 'postPayment');
    assert.match(post, /eq\(loans\.status, "ACTIVE"\), owes/);
    assert.match(post, /sql`\$\{loans\.remainingAmount\} - \$\{reservedSql\} >= \$\{p\.amount\}::numeric`/);
    assert.match(post, /await tx\.insert\(loanRepayments\)/);
    assert.match(fn(repo, 'writeOff'), /eq\(loans\.status, "ACTIVE"\), sql`\$\{reservedSql\} = 0`/);
    assert.match(fn(repo, 'deleteOpeningLoan'), /eq\(loans\.source, "opening"\)/);
    for (const src of [service, payrollLoans, opening, payroll, settlement]) {
      assert.doesNotMatch(src, /\.update\(loans\)|\.insert\(loanRepayments\)/);
    }
    // A cash repayment leaves what unlocked payslips will deduct.
    assert.match(fn(service, 'recordRepayment'), /keepReserved: true/);
  });
});

describe('S47 loans in payroll', () => {
  it('payroll deducts recorded loans only: no salary-structure fallback, no mirror', () => {
    assert.doesNotMatch(payroll, /loan1Deduction|loan2Deduction|syncActiveLoansToSalaryMapping|from\(loans\)/);
    assert.doesNotMatch(read('lib/services/loan.service.ts'), /employeeSalaryMap|syncActiveLoansToSalaryMapping/);
    // The pre-flight names anyone whose salary structure still carries a loan amount.
    assert.match(read('lib/engines/payroll-control.engine.ts'), /push\('loan_on_structure', 'warning'/);
  });

  it('a payslip\'s loan lines are written with it and posted in the lock\'s transaction', () => {
    const generate = fn(payroll, 'generatePayrollRun');
    assert.match(generate, /const loanLinesByEmployee = await loanPayroll\.loanLinesFor\(empIds, /);
    const runTx = generate.slice(generate.indexOf('const runRecord = await (await getDb()).transaction('));
    assert.match(runTx, /await loanPayroll\.writeSlipLoanLines\(tx, slipId, lines\);/);
    const recalc = fn(payroll, 'recalculateEmployeePayslip');
    assert.match(recalc, /loanPayroll\.loanLinesFor\(\[emp\.id\], \{[^}]*\}, \{ excludeSlipId: slipId \}\)/);
    assert.match(recalc, /await loanPayroll\.writeSlipLoanLines\(tx, slipId, loanLines\);/);
    const override = fn(payroll, 'overridePayslipAllowanceDeduction');
    assert.match(override, /loanPayroll\.spreadTypedDeduction\(slip\.employeeId, slipId, loanDeduction\)/);
    assert.match(override, /await loanPayroll\.writeSlipLoanLines\(tx, slipId, typedLoans\.lines\);/);
    // The status, the sealed payslips and the loan postings are one transaction.
    const transition = fn(payroll, 'transitionPayrollRun');
    const lock = transition.slice(transition.indexOf("if (toStatus === 'LOCKED')"));
    assert.ok(lock.indexOf('repository.updatePayrollRunStatus(runId, toStatus, actionByUserId, notes, run.status, tx)') < lock.indexOf('loanPayroll.postRunLoansTx(tx, runId'));
    assert.match(payrollLoans, /const ok = await repo\.postPayment\(tx, \{[\s\S]*?keepReserved: false,[\s\S]*?\}\);\s*if \(!ok\) throw new UserFacingError/);
  });

  it('net pay never below zero because of loans; an approved settlement stops payroll deductions', () => {
    assert.match(fn(payrollLoans, 'calculateWithLoans'), /if \(!\(error instanceof NegativeNetPayableError\) \|\| !\(Number\(total\) > 0\)\) throw error;/);
    assert.match(fn(payrollLoans, 'loanLinesFor'), /const live = loans\.filter\(\(l\) => !held\.has\(l\.employeeId\)\);/);
    assert.match(fn(payrollLoans, 'spreadTypedDeduction'), /if \(held\.has\(employeeId\) && Number\(amount\) !== 0\) throw new UserFacingError/);
  });
});

describe('S47 loans at exit', () => {
  it('approving a settlement checks the loans; paying it closes them in the same transaction', () => {
    const move = fn(settlement, 'move');
    assert.match(move, /const problem = await loanService\.settlementLoanProblem\(c\.employeeId, recovers\);/);
    assert.match(move, /claimed = await loanService\.inTransaction\(async \(tx\) => \{\s*const paid = await repo\.claim\(row\.id, 'approved', 'paid', ctx\.userId, ref, tx\);\s*if \(paid\) await loanService\.closeLoansBySettlementTx\(tx, /);
    assert.match(fn(service, 'closeLoansBySettlementTx'), /repo\.runningLoansForUpdate\(tx, employeeId\)/);
    // While the settlement is approved, nothing else moves the loans.
    assert.match(fn(service, 'refuseHeld'), /heldBySettlement/);
    assert.match(fn(service, 'recordRepayment'), /await refuseHeld\(loan\);/);
    assert.match(fn(service, 'writeOffLoan'), /await refuseHeld\(loan\);/);
    // Completing the exit needs the loans recovered.
    assert.match(read('lib/services/exit.service.ts'), /activeLoans > 0 \? loanOutstanding : null/);
  });
});

describe('S47 the loan report follows the scope', () => {
  it('page and action read loans and repayments within the viewer\'s scope (4.11 report viewer)', () => {
    const reportActions = read('app/actions/report.actions.ts');
    assert.match(fn(reportActions, 'loanReportAction'), /const ctx = await viewer\('REPORTS_LOAN'\);/);
    assert.match(fn(reportActions, 'viewer'), /const scope = await checkPermissionWithScope\('VIEW', module\);/);
    assert.match(read('app/(dashboard)/reports/loan/page.tsx'), /const scope = await checkPermissionWithScope\("VIEW", "REPORTS_LOAN"\);[\s\S]*loanReport\(\{ userId: scope\.userId, scope, canExport \}/);
    const data = fn(read('lib/services/report.service.ts'), 'loanReport');
    assert.match(data, /const scope = scopeCondition\(ctx\.scope\);/);
    assert.match(data, /repo\.repaymentsInScope\(scope, /);
    assert.match(data, /repo\.loansInScope\(scope, /);
  });
});

describe('S47 loans in self-service and the bell', () => {
  it('the employee is the session\'s, never a parameter; requests are self-service', () => {
    assert.match(fn(ess, 'requestMyLoan'), /const \{ employeeId, userId \} = await getSessionEmployeeId\(\);\s*const form = \{ \.\.\.\(raw && typeof raw === 'object' \? \(raw as Record<string, unknown>\) : \{\}\), employeeId \};/);
    assert.match(fn(ess, 'requestMyLoan'), /\{ selfService: true \}/);
    assert.match(fn(ess, 'withdrawMyLoanRequest'), /getSessionEmployeeId\(\)/);
    assert.match(fn(ess, 'myLoanDetail'), /getSessionEmployeeId\(\)/);
  });

  it('the bell counts requests this person can decide, through the approval engine', () => {
    assert.match(read('lib/services/notification.service.ts'), /loans: decides\('APPROVE', 'LOANS'\),/);
    assert.match(fn(service, 'countWaitingFor'), /rows\.filter\(\(r\) => waitingFor\(engine\.approvalRequestOf\(r\), actor, decision\)\)\.length/);
  });
});

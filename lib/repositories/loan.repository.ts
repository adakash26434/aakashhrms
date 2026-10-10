import { getDb } from "@/lib/db";
import { approvalActions, employees, exitCases, exitSettlements, loanRepayments, loanRequests, loanTypes, loans, payrollRuns, payrollSlipLoans, payrollSlips, users } from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, ne, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Loans (4.10): Drizzle queries only. Rules in lib/engines/loan.engine.ts; orchestration in
// lib/services/loan.service.ts (requests, disbursement, repayment) and loan-payroll.service.ts
// (payslip lines). Loans and requests are read within the caller's employee scope; every status
// move is claim-first, and a balance only changes in one statement that also checks it can.

export type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

export const APPROVAL_MODULE = "LOANS";

/** A user's name, or their email when the name is blank (works on an alias too). */
const userName = (u: { name: AnyColumn; email: AnyColumn }) => sql<string | null>`COALESCE(NULLIF(${u.name}, ''), ${u.email})`;

/** Lines on payslips of runs not yet locked, per loan: what a run will still deduct. */
const reservedSql = sql<string>`COALESCE((
  SELECT sum(psl.amount) FROM payroll_slip_loans psl
  JOIN payroll_slips ps ON ps.id = psl.payroll_slip_id
  JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
  WHERE psl.loan_id = ${loans.id} AND pr.status <> 'LOCKED'), 0)`;

// ---- loan types ---------------------------------------------------------------------------------

export type TypeRow = typeof loanTypes.$inferSelect;
export type TypeWrite = Omit<typeof loanTypes.$inferInsert, "id" | "createdAt" | "updatedAt">;

export async function listTypes(): Promise<(TypeRow & { inUse: number })[]> {
  const db = await getDb();
  const [types, usedByLoans, usedByRequests] = await Promise.all([
    db.select().from(loanTypes).orderBy(asc(loanTypes.name)),
    db.select({ id: loans.loanTypeId, n: sql<number>`count(*)::int` }).from(loans).groupBy(loans.loanTypeId),
    db.select({ id: loanRequests.loanTypeId, n: sql<number>`count(*)::int` }).from(loanRequests).groupBy(loanRequests.loanTypeId),
  ]);
  const counts = new Map<string, number>();
  for (const r of [...usedByLoans, ...usedByRequests]) counts.set(r.id, (counts.get(r.id) ?? 0) + Number(r.n));
  return types.map((t) => ({ ...t, inUse: counts.get(t.id) ?? 0 }));
}

export async function findType(id: string): Promise<TypeRow | null> {
  const [row] = await (await getDb()).select().from(loanTypes).where(eq(loanTypes.id, id)).limit(1);
  return row ?? null;
}

export async function insertType(w: TypeWrite): Promise<TypeRow> {
  const [row] = await (await getDb()).insert(loanTypes).values(w).returning();
  return row;
}

export async function updateType(id: string, w: TypeWrite): Promise<TypeRow | null> {
  const [row] = await (await getDb()).update(loanTypes).set({ ...w, updatedAt: new Date() }).where(eq(loanTypes.id, id)).returning();
  return row ?? null;
}

/** Deletes a type nothing uses (false when it is gone or in use). */
export async function deleteUnusedType(id: string): Promise<boolean> {
  const rows = await (await getDb())
    .delete(loanTypes)
    .where(and(eq(loanTypes.id, id), sql`NOT EXISTS (SELECT 1 FROM loans WHERE loan_type_id = ${id})`, sql`NOT EXISTS (SELECT 1 FROM loan_requests WHERE loan_type_id = ${id})`))
    .returning({ id: loanTypes.id });
  return rows.length > 0;
}

// ---- loans --------------------------------------------------------------------------------------

export type LoanRecord = typeof loans.$inferSelect;

export interface LoanJoined extends LoanRecord {
  employeeName: string;
  employeeCode: string;
  typeName: string;
  typeNameNp: string | null;
  kind: string;
  createdByName: string | null;
  requestId: string | null;
}

const loanCreator = alias(users, "loan_creator");

async function selectLoans(where: SQL<unknown> | undefined, limit: number): Promise<LoanJoined[]> {
  const rows = await (await getDb())
    .select({
      l: loans,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      typeName: loanTypes.name,
      typeNameNp: loanTypes.nameNp,
      kind: loanTypes.kind,
      createdByName: userName(loanCreator),
      requestId: loanRequests.id,
    })
    .from(loans)
    .innerJoin(employees, eq(loans.employeeId, employees.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .leftJoin(loanCreator, eq(loans.createdBy, loanCreator.id))
    .leftJoin(loanRequests, eq(loanRequests.loanId, loans.id))
    .where(where)
    .orderBy(desc(loans.givenDate), desc(loans.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.l, employeeName: r.employeeName, employeeCode: r.employeeCode, typeName: r.typeName, typeNameNp: r.typeNameNp, kind: r.kind, createdByName: r.createdByName, requestId: r.requestId }));
}

export const listLoans = (scopeCondition?: SQL<unknown>) => selectLoans(scopeCondition, 3000);
export const employeeLoans = (employeeId: string) => selectLoans(eq(loans.employeeId, employeeId), 500);

export async function findLoan(id: string, scopeCondition?: SQL<unknown>): Promise<LoanJoined | null> {
  const rows = await selectLoans(and(eq(loans.id, id), scopeCondition), 1);
  return rows[0] ?? null;
}

/** Every loan of one employee, newest first (the employee record, 4.2). */
export async function findLoansByEmployee(employeeId: string) {
  const rows = await (await getDb())
    .select({
      id: loans.id,
      loanTypeName: loanTypes.name,
      givenDate: loans.givenDate,
      amount: loans.loanAmount,
      installment: loans.installmentAmount,
      installments: loans.noOfInstallments,
      returned: loans.totalReturned,
      remaining: loans.remainingAmount,
      status: loans.status,
    })
    .from(loans)
    .innerJoin(loanTypes, eq(loanTypes.id, loans.loanTypeId))
    .where(eq(loans.employeeId, employeeId))
    .orderBy(desc(loans.givenDate));
  return rows.map((r) => ({
    ...r,
    givenDate: String(r.givenDate),
    amount: Number(r.amount),
    installment: Number(r.installment),
    returned: Number(r.returned),
    remaining: Number(r.remaining),
  }));
}

/** A loan of this type still being repaid, or a request for it still open (one at a time). */
export async function openOfType(employeeId: string, loanTypeId: string): Promise<"loan" | "request" | null> {
  const db = await getDb();
  const [loan] = await db.select({ id: loans.id }).from(loans).where(and(eq(loans.employeeId, employeeId), eq(loans.loanTypeId, loanTypeId), eq(loans.status, "ACTIVE"))).limit(1);
  if (loan) return "loan";
  const [request] = await db
    .select({ id: loanRequests.id })
    .from(loanRequests)
    .where(and(eq(loanRequests.employeeId, employeeId), eq(loanRequests.loanTypeId, loanTypeId), inArray(loanRequests.status, ["pending", "approved"])))
    .limit(1);
  return request ? "request" : null;
}

/** What the employee's running loans deduct a month now. */
export async function runningInstallments(employeeId: string): Promise<string> {
  const [row] = await (await getDb())
    .select({ total: sql<string>`COALESCE(sum(LEAST(${loans.installmentAmount}, ${loans.remainingAmount})), 0)::text` })
    .from(loans)
    .where(and(eq(loans.employeeId, employeeId), eq(loans.status, "ACTIVE")));
  return row?.total ?? "0";
}

export interface Reserved {
  amount: string;
  /** The pay months it is on ("2083-07"). */
  months: string[];
}

/** Per loan, what payslips of runs not yet locked will still deduct (optionally leaving one payslip out). */
export async function reservedByLoan(loanIds: string[], excludeSlipId?: string | null): Promise<Map<string, Reserved>> {
  if (!loanIds.length) return new Map();
  const rows = await (await getDb())
    .select({ loanId: payrollSlipLoans.loanId, amount: sql<string>`sum(${payrollSlipLoans.amount})::text`, year: payrollRuns.payPeriodYear, month: payrollRuns.payPeriodMonth })
    .from(payrollSlipLoans)
    .innerJoin(payrollSlips, eq(payrollSlipLoans.payrollSlipId, payrollSlips.id))
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(inArray(payrollSlipLoans.loanId, loanIds), ne(payrollRuns.status, "LOCKED"), excludeSlipId ? ne(payrollSlipLoans.payrollSlipId, excludeSlipId) : undefined))
    .groupBy(payrollSlipLoans.loanId, payrollRuns.payPeriodYear, payrollRuns.payPeriodMonth);
  const out = new Map<string, Reserved>();
  for (const r of rows) {
    const cur = out.get(r.loanId) ?? { amount: "0", months: [] };
    cur.amount = (Number(cur.amount) + Number(r.amount)).toFixed(2);
    cur.months.push(`${r.year}-${String(r.month).padStart(2, "0")}`);
    out.set(r.loanId, cur);
  }
  return out;
}

export interface RepaymentJoined {
  id: string;
  date: string;
  amount: string;
  method: string;
  note: string | null;
  byName: string | null;
  runYear: number | null;
  runMonth: number | null;
}

export async function repaymentsOf(loanId: string): Promise<RepaymentJoined[]> {
  const rows = await (await getDb())
    .select({
      id: loanRepayments.id,
      date: loanRepayments.repaymentDate,
      amount: loanRepayments.amountPaid,
      method: loanRepayments.paymentMethod,
      note: loanRepayments.note,
      byName: userName(users),
      runYear: payrollRuns.payPeriodYear,
      runMonth: payrollRuns.payPeriodMonth,
    })
    .from(loanRepayments)
    .leftJoin(users, eq(loanRepayments.createdBy, users.id))
    .leftJoin(payrollSlips, eq(loanRepayments.payrollSlipId, payrollSlips.id))
    .leftJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(eq(loanRepayments.loanId, loanId))
    .orderBy(desc(loanRepayments.repaymentDate), desc(loanRepayments.createdAt));
  return rows.map((r) => ({ ...r, date: String(r.date).slice(0, 10) }));
}

/** Lines of this loan on payslips of runs not yet locked. */
export async function pendingLinesOf(loanId: string): Promise<{ amount: string; year: number; month: number; status: string }[]> {
  return (await getDb())
    .select({ amount: payrollSlipLoans.amount, year: payrollRuns.payPeriodYear, month: payrollRuns.payPeriodMonth, status: payrollRuns.status })
    .from(payrollSlipLoans)
    .innerJoin(payrollSlips, eq(payrollSlipLoans.payrollSlipId, payrollSlips.id))
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(eq(payrollSlipLoans.loanId, loanId), ne(payrollRuns.status, "LOCKED")));
}

/** Loans with nothing posted yet: no repayment and no payslip line (an opening loan may still be removed). */
export async function untouched(loanIds: string[]): Promise<Set<string>> {
  if (!loanIds.length) return new Set();
  const rows = await (await getDb())
    .select({ id: loans.id })
    .from(loans)
    .where(
      and(
        inArray(loans.id, loanIds),
        sql`NOT EXISTS (SELECT 1 FROM loan_repayments r WHERE r.loan_id = ${loans.id})`,
        sql`NOT EXISTS (SELECT 1 FROM payroll_slip_loans p WHERE p.loan_id = ${loans.id})`
      )
    );
  return new Set(rows.map((r) => r.id));
}

// ---- requests -----------------------------------------------------------------------------------

export type RequestRecord = typeof loanRequests.$inferSelect;
export type RequestWrite = Omit<typeof loanRequests.$inferInsert, "id" | "createdAt" | "updatedAt">;

export interface RequestJoined extends RequestRecord {
  employeeName: string;
  employeeCode: string;
  typeName: string;
  typeNameNp: string | null;
  kind: string;
  preparedByName: string | null;
  decidedByName: string | null;
}

const preparer = alias(users, "request_preparer");
const decider = alias(users, "request_decider");

async function selectRequests(where: SQL<unknown> | undefined, limit: number): Promise<RequestJoined[]> {
  const rows = await (await getDb())
    .select({
      r: loanRequests,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      typeName: loanTypes.name,
      typeNameNp: loanTypes.nameNp,
      kind: loanTypes.kind,
      preparedByName: userName(preparer),
      decidedByName: userName(decider),
    })
    .from(loanRequests)
    .innerJoin(employees, eq(loanRequests.employeeId, employees.id))
    .innerJoin(loanTypes, eq(loanRequests.loanTypeId, loanTypes.id))
    .leftJoin(preparer, eq(loanRequests.preparedBy, preparer.id))
    .leftJoin(decider, eq(loanRequests.decidedBy, decider.id))
    .where(where)
    .orderBy(desc(loanRequests.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.r, employeeName: r.employeeName, employeeCode: r.employeeCode, typeName: r.typeName, typeNameNp: r.typeNameNp, kind: r.kind, preparedByName: r.preparedByName, decidedByName: r.decidedByName }));
}

export const listRequests = (scopeCondition?: SQL<unknown>) => selectRequests(scopeCondition, 2000);
export const employeeRequests = (employeeId: string) => selectRequests(eq(loanRequests.employeeId, employeeId), 200);
export const pendingRequests = (scopeCondition?: SQL<unknown>) => selectRequests(and(eq(loanRequests.status, "pending"), scopeCondition), 1000);

export async function findRequest(id: string, scopeCondition?: SQL<unknown>): Promise<RequestJoined | null> {
  const rows = await selectRequests(and(eq(loanRequests.id, id), scopeCondition), 1);
  return rows[0] ?? null;
}

export interface NewAction {
  level: number;
  actorId: string | null;
  onBehalfOf?: string | null;
  action: string;
  note?: string | null;
}

/** A new request and its first timeline steps, together. */
export async function insertRequest(w: RequestWrite, actions: NewAction[]): Promise<RequestRecord> {
  return (await getDb()).transaction(async (tx) => {
    const [row] = await tx.insert(loanRequests).values(w).returning();
    if (actions.length) {
      await tx.insert(approvalActions).values(actions.map((a) => ({ module: APPROVAL_MODULE, requestId: row.id, level: a.level, actorId: a.actorId, onBehalfOf: a.onBehalfOf ?? null, action: a.action, note: a.note ?? null })));
    }
    return row;
  });
}

/**
 * A decision, claim-first: applies only while the request is still pending at the level it was
 * read with, and its timeline step goes in the same transaction.
 */
export async function decideRequest(
  id: string,
  expectLevel: number,
  next: { status: string; currentLevel: number; route: string | null; decidedBy: string | null; note: string | null },
  action: NewAction
): Promise<boolean> {
  return (await getDb()).transaction(async (tx) => {
    const final = next.status !== "pending";
    const rows = await tx
      .update(loanRequests)
      .set({
        status: next.status,
        currentLevel: next.currentLevel,
        approvalRoute: next.route,
        ...(final ? { decidedBy: next.decidedBy, decidedAt: new Date(), decisionNote: next.note } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(loanRequests.id, id), eq(loanRequests.status, "pending"), eq(loanRequests.currentLevel, expectLevel)))
      .returning({ id: loanRequests.id });
    if (!rows.length) return false;
    await tx.insert(approvalActions).values({ module: APPROVAL_MODULE, requestId: id, level: action.level, actorId: action.actorId, onBehalfOf: action.onBehalfOf ?? null, action: action.action, note: action.note ?? null });
    return true;
  });
}

export async function findActions(requestIds: string[]) {
  if (!requestIds.length) return [];
  return (await getDb())
    .select()
    .from(approvalActions)
    .where(and(eq(approvalActions.module, APPROVAL_MODULE), inArray(approvalActions.requestId, requestIds)))
    .orderBy(asc(approvalActions.createdAt));
}

/** Disburses an approved request into a loan, claim-first: the request moves once, then the loan is written. */
export async function disburse(requestId: string, loan: Omit<typeof loans.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<LoanRecord | null> {
  return (await getDb()).transaction(async (tx) => {
    const claimed = await tx
      .update(loanRequests)
      .set({ status: "disbursed", updatedAt: new Date() })
      .where(and(eq(loanRequests.id, requestId), eq(loanRequests.status, "approved")))
      .returning({ id: loanRequests.id });
    if (!claimed.length) return null;
    const [created] = await tx.insert(loans).values(loan).returning();
    await tx.update(loanRequests).set({ loanId: created.id }).where(eq(loanRequests.id, requestId));
    return created;
  });
}

// ---- balances (claim-first) ---------------------------------------------------------------------

const closingCase = (amount: string, then: SQL, otherwise: SQL = sql`NULL`) => sql`CASE WHEN ${loans.remainingAmount} - ${amount}::numeric <= 0 THEN ${then} ELSE ${otherwise} END`;

/**
 * Takes a payment off a running loan and records it, in one transaction. The balance changes only
 * while the loan is running and still owes the amount; `keepReserved` also leaves what unlocked
 * payslips will deduct (a payment from outside payroll). Closes the loan when nothing is left.
 */
export async function postPayment(
  tx: Tx,
  p: { loanId: string; employeeId: string; amount: string; date: string; method: "CASH" | "SALARY_DEDUCTION" | "SETTLEMENT"; payrollSlipId?: string | null; note?: string | null; userId: string | null; keepReserved: boolean; closedHow: "repaid" | "settlement" }
): Promise<boolean> {
  const owes = p.keepReserved ? sql`${loans.remainingAmount} - ${reservedSql} >= ${p.amount}::numeric` : sql`${loans.remainingAmount} >= ${p.amount}::numeric`;
  const rows = await tx
    .update(loans)
    .set({
      totalReturned: sql`${loans.totalReturned} + ${p.amount}::numeric`,
      remainingAmount: sql`${loans.remainingAmount} - ${p.amount}::numeric`,
      status: closingCase(p.amount, sql`'CLOSED'`, sql`'ACTIVE'`),
      closedAt: closingCase(p.amount, sql`now()`),
      closedHow: closingCase(p.amount, sql`${p.closedHow}`),
      closedBy: closingCase(p.amount, p.userId ? sql`${p.userId}::uuid` : sql`NULL`),
      updatedAt: new Date(),
    })
    .where(and(eq(loans.id, p.loanId), eq(loans.employeeId, p.employeeId), eq(loans.status, "ACTIVE"), owes))
    .returning({ id: loans.id });
  if (!rows.length) return false;
  await tx.insert(loanRepayments).values({
    loanId: p.loanId,
    employeeId: p.employeeId,
    repaymentDate: p.date,
    amountPaid: p.amount,
    paymentMethod: p.method,
    payrollSlipId: p.payrollSlipId ?? null,
    note: p.note ?? null,
    createdBy: p.userId,
  });
  return true;
}

export async function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}

/** Writes a running loan off, claim-first: never while a payslip not yet locked deducts from it. */
export async function writeOff(loanId: string, reason: string, userId: string): Promise<LoanRecord | null> {
  const [row] = await (await getDb())
    .update(loans)
    .set({
      writtenOffAmount: sql`${loans.remainingAmount}`,
      remainingAmount: "0",
      status: "CLOSED",
      closedHow: "written_off",
      closedAt: new Date(),
      closedBy: userId,
      closeNote: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(loans.id, loanId), eq(loans.status, "ACTIVE"), sql`${reservedSql} = 0`))
    .returning();
  return row ?? null;
}

// ---- opening balances (F15) ---------------------------------------------------------------------

/** Keys of loans already recorded (employee, type, date given, amount), to refuse importing one twice. */
export async function loanKeys(employeeIds: string[]): Promise<{ keys: Set<string>; running: Set<string> }> {
  if (!employeeIds.length) return { keys: new Set(), running: new Set() };
  const rows = await (await getDb())
    .select({ employeeId: loans.employeeId, typeId: loans.loanTypeId, givenDate: loans.givenDate, amount: loans.loanAmount, status: loans.status })
    .from(loans)
    .where(inArray(loans.employeeId, employeeIds));
  return {
    keys: new Set(rows.map((r) => openingKey(r.employeeId, r.typeId, String(r.givenDate).slice(0, 10), r.amount))),
    running: new Set(rows.filter((r) => r.status === "ACTIVE").map((r) => `${r.employeeId}|${r.typeId}`)),
  };
}

export const openingKey = (employeeId: string, typeId: string, givenDate: string, amount: string | number) => `${employeeId}|${typeId}|${givenDate}|${Number(amount).toFixed(2)}`;

export async function insertOpeningLoans(rows: Omit<typeof loans.$inferInsert, "id" | "createdAt" | "updatedAt">[]): Promise<LoanRecord[]> {
  if (!rows.length) return [];
  return (await getDb()).transaction(async (tx) => tx.insert(loans).values(rows).returning());
}

/** Removes a carried loan nothing has touched yet (no repayment, no payslip line). */
export async function deleteOpeningLoan(id: string): Promise<LoanRecord | null> {
  const [row] = await (await getDb())
    .delete(loans)
    .where(
      and(
        eq(loans.id, id),
        eq(loans.source, "opening"),
        sql`NOT EXISTS (SELECT 1 FROM loan_repayments r WHERE r.loan_id = ${id})`,
        sql`NOT EXISTS (SELECT 1 FROM payroll_slip_loans p WHERE p.loan_id = ${id})`
      )
    )
    .returning();
  return row ?? null;
}

// ---- payroll ------------------------------------------------------------------------------------

export interface RunningLoanRow {
  id: string;
  employeeId: string;
  loanTypeId: string;
  typeName: string;
  installment: string;
  remaining: string;
  firstDeductionMonth: string | null;
  givenDate: string;
}

/** Running loans of these employees, oldest first (the order payroll deducts them in). */
export async function runningLoansFor(employeeIds: string[], client?: Tx): Promise<RunningLoanRow[]> {
  if (!employeeIds.length) return [];
  const rows = await (client ?? (await getDb()))
    .select({
      id: loans.id,
      employeeId: loans.employeeId,
      loanTypeId: loans.loanTypeId,
      typeName: loanTypes.name,
      installment: loans.installmentAmount,
      remaining: loans.remainingAmount,
      firstDeductionMonth: loans.firstDeductionMonth,
      givenDate: loans.givenDate,
    })
    .from(loans)
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .where(and(inArray(loans.employeeId, employeeIds), eq(loans.status, "ACTIVE"), sql`${loans.remainingAmount} > 0`))
    .orderBy(asc(loans.givenDate), asc(loans.createdAt));
  return rows.map((r) => ({ ...r, givenDate: String(r.givenDate).slice(0, 10) }));
}

/** Employees whose final settlement is approved and not yet paid: it recovers their loans, nothing else may. */
export async function heldBySettlement(employeeIds: string[]): Promise<Set<string>> {
  if (!employeeIds.length) return new Set();
  const rows = await (await getDb())
    .select({ employeeId: exitSettlements.employeeId })
    .from(exitSettlements)
    .where(and(inArray(exitSettlements.employeeId, employeeIds), eq(exitSettlements.status, "approved")));
  return new Set(rows.map((r) => r.employeeId));
}

/** The settlement status of employees whose exit case is open (approved or paid ones no longer take a new loan). */
export async function openCaseSettlements(employeeIds: string[]): Promise<Map<string, string>> {
  if (!employeeIds.length) return new Map();
  const rows = await (await getDb())
    .select({ employeeId: exitSettlements.employeeId, status: exitSettlements.status })
    .from(exitSettlements)
    .innerJoin(exitCases, eq(exitSettlements.exitCaseId, exitCases.id))
    .where(and(inArray(exitSettlements.employeeId, employeeIds), eq(exitCases.status, "open")));
  return new Map(rows.map((r) => [r.employeeId, r.status]));
}

export async function writeSlipLines(tx: Tx, slipId: string, lines: readonly { loanId: string; amount: string }[]): Promise<void> {
  await tx.delete(payrollSlipLoans).where(eq(payrollSlipLoans.payrollSlipId, slipId));
  const rows = lines.filter((l) => Number(l.amount) > 0);
  if (rows.length) await tx.insert(payrollSlipLoans).values(rows.map((l) => ({ payrollSlipId: slipId, loanId: l.loanId, amount: l.amount })));
}

export async function slipLines(slipId: string): Promise<{ loanId: string; amount: string; typeName: string }[]> {
  return (await getDb())
    .select({ loanId: payrollSlipLoans.loanId, amount: payrollSlipLoans.amount, typeName: loanTypes.name })
    .from(payrollSlipLoans)
    .innerJoin(loans, eq(payrollSlipLoans.loanId, loans.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .where(eq(payrollSlipLoans.payrollSlipId, slipId))
    .orderBy(asc(loans.givenDate), asc(loans.createdAt));
}

export interface RunSlipLoans {
  slipId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  loanDeduction: string;
  lines: { loanId: string; amount: string; typeName: string }[];
}

/** Every payslip of a run that deducts a loan, with its lines (read inside the lock transaction). */
export async function runSlipLoans(tx: Tx, runId: string): Promise<RunSlipLoans[]> {
  const slips = await tx
    .select({ slipId: payrollSlips.id, employeeId: payrollSlips.employeeId, employeeName: payrollSlips.employeeName, employeeCode: payrollSlips.employeeCode, loanDeduction: payrollSlips.loanDeduction })
    .from(payrollSlips)
    .where(and(eq(payrollSlips.payrollRunId, runId), sql`(${payrollSlips.loanDeduction} > 0 OR EXISTS (SELECT 1 FROM payroll_slip_loans p WHERE p.payroll_slip_id = ${payrollSlips.id}))`));
  if (!slips.length) return [];
  const lines = await tx
    .select({ slipId: payrollSlipLoans.payrollSlipId, loanId: payrollSlipLoans.loanId, amount: payrollSlipLoans.amount, typeName: loanTypes.name })
    .from(payrollSlipLoans)
    .innerJoin(loans, eq(payrollSlipLoans.loanId, loans.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .where(inArray(payrollSlipLoans.payrollSlipId, slips.map((s) => s.slipId)))
    .orderBy(asc(loans.givenDate), asc(loans.createdAt));
  return slips.map((s) => ({ ...s, loanDeduction: String(s.loanDeduction ?? "0"), lines: lines.filter((l) => l.slipId === s.slipId).map((l) => ({ loanId: l.loanId, amount: l.amount, typeName: l.typeName })) }));
}

// ---- final settlement ---------------------------------------------------------------------------

/** The employee's running loans, locked for the settlement's transaction. */
export async function runningLoansForUpdate(tx: Tx, employeeId: string): Promise<{ id: string; remaining: string }[]> {
  return tx
    .select({ id: loans.id, remaining: loans.remainingAmount })
    .from(loans)
    .where(and(eq(loans.employeeId, employeeId), eq(loans.status, "ACTIVE")))
    .orderBy(asc(loans.givenDate), asc(loans.createdAt))
    .for("update");
}

/** What the employee's running loans still owe, and what unlocked payslips will deduct from them. */
export async function outstandingOf(employeeId: string): Promise<{ outstanding: string; reserved: string; reservedMonths: string[] }> {
  const db = await getDb();
  const [row] = await db
    .select({ outstanding: sql<string>`COALESCE(sum(${loans.remainingAmount}), 0)::text`, reserved: sql<string>`COALESCE(sum(${reservedSql}), 0)::text` })
    .from(loans)
    .where(and(eq(loans.employeeId, employeeId), eq(loans.status, "ACTIVE")));
  const months = await db
    .selectDistinct({ year: payrollRuns.payPeriodYear, month: payrollRuns.payPeriodMonth })
    .from(payrollSlipLoans)
    .innerJoin(loans, eq(payrollSlipLoans.loanId, loans.id))
    .innerJoin(payrollSlips, eq(payrollSlipLoans.payrollSlipId, payrollSlips.id))
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(eq(loans.employeeId, employeeId), eq(loans.status, "ACTIVE"), ne(payrollRuns.status, "LOCKED")));
  return { outstanding: row?.outstanding ?? "0", reserved: row?.reserved ?? "0", reservedMonths: months.map((m) => `${m.year}-${String(m.month).padStart(2, "0")}`) };
}

/** Self-service: the types employees ask for themselves. */
export async function selfServiceTypes(): Promise<TypeRow[]> {
  return (await getDb()).select().from(loanTypes).where(and(eq(loanTypes.selfService, true), eq(loanTypes.isActive, true))).orderBy(asc(loanTypes.name));
}

export async function activeEmployeeInScope(employeeId: string, scopeCondition?: SQL<unknown>): Promise<boolean> {
  const [row] = await (await getDb())
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.status, "Active"), scopeCondition))
    .limit(1);
  return !!row;
}

/** One employee's joining date and status, for eligibility (null when not found). */
export async function employeeFacts(employeeId: string): Promise<{ joiningDate: string; status: string } | null> {
  const [row] = await (await getDb()).select({ joiningDate: employees.joiningDate, status: employees.status }).from(employees).where(eq(employees.id, employeeId)).limit(1);
  return row ? { joiningDate: String(row.joiningDate).slice(0, 10), status: row.status } : null;
}

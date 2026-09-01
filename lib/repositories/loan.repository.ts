// =============================================================================
// PHASE 5: STAFF LOANS MODULE — Repository (Database Access Layer)
// Direct Drizzle queries with mapper functions. No business logic here.
// =============================================================================

import { getDb } from "@/lib/db";
import { loanTypes, loans, loanRepayments, employees } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Decimal from "decimal.js";
import type {
  LoanType,
  Loan,
  LoanRepayment,
  LoanStatus,
  PaymentMethod,
} from "@/lib/types/loan";

// ---------------------------------------------------------------------------
// Mapper Functions (DB row → clean typed object)
// ---------------------------------------------------------------------------

function mapLoanType(row: typeof loanTypes.$inferSelect): LoanType {
  return {
    id: row.id,
    name: row.name,
    maxAmount: Number(row.maxAmount) || 0,
    maxInstallments: row.maxInstallments,
    interestRate: Number(row.interestRate) || 0,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLoan(
  row: typeof loans.$inferSelect,
  employeeName: string,
  employeeCode: string,
  loanTypeName: string,
): Loan {
  return {
    id: row.id,
    employeeId: row.employeeId,
    loanTypeId: row.loanTypeId,
    givenDate: row.givenDate,
    loanAmount: Number(row.loanAmount) || 0,
    installmentAmount: Number(row.installmentAmount) || 0,
    noOfInstallments: row.noOfInstallments,
    totalReturned: Number(row.totalReturned) || 0,
    remainingAmount: Number(row.remainingAmount) || 0,
    status: row.status as LoanStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    employeeName,
    employeeCode,
    loanTypeName,
  };
}

function mapRepayment(row: typeof loanRepayments.$inferSelect): LoanRepayment {
  return {
    id: row.id,
    loanId: row.loanId,
    employeeId: row.employeeId,
    repaymentDate: row.repaymentDate,
    amountPaid: Number(row.amountPaid) || 0,
    paymentMethod: row.paymentMethod as PaymentMethod,
    payrollSlipId: row.payrollSlipId || null,
    createdBy: row.createdBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// LOAN TYPES — CRUD
// ---------------------------------------------------------------------------

export async function findAllLoanTypes(): Promise<LoanType[]> {
  const rows = await getDb()
    .select()
    .from(loanTypes)
    .orderBy(desc(loanTypes.createdAt));
  return rows.map(mapLoanType);
}

export async function findLoanTypeById(id: string): Promise<LoanType | null> {
  const rows = await getDb()
    .select()
    .from(loanTypes)
    .where(eq(loanTypes.id, id));
  return rows.length ? mapLoanType(rows[0]) : null;
}

export async function createLoanType(
  data: Omit<LoanType, "id" | "createdAt" | "updatedAt">,
): Promise<LoanType> {
  const rows = await getDb()
    .insert(loanTypes)
    .values({
      name: data.name,
      maxAmount: data.maxAmount.toString(),
      maxInstallments: data.maxInstallments,
      interestRate: data.interestRate.toString(),
      isActive: data.isActive,
    })
    .returning();
  return mapLoanType(rows[0]);
}

export async function updateLoanType(
  id: string,
  data: Partial<Omit<LoanType, "id" | "createdAt" | "updatedAt">>,
): Promise<LoanType | null> {
  const updateVals: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateVals.name = data.name;
  if (data.maxAmount !== undefined) updateVals.maxAmount = data.maxAmount.toString();
  if (data.maxInstallments !== undefined) updateVals.maxInstallments = data.maxInstallments;
  if (data.interestRate !== undefined) updateVals.interestRate = data.interestRate.toString();
  if (data.isActive !== undefined) updateVals.isActive = data.isActive;

  const rows = await getDb()
    .update(loanTypes)
    .set(updateVals)
    .where(eq(loanTypes.id, id))
    .returning();
  return rows.length ? mapLoanType(rows[0]) : null;
}

export async function deleteLoanType(id: string): Promise<boolean> {
  const res = await getDb()
    .delete(loanTypes)
    .where(eq(loanTypes.id, id))
    .returning({ id: loanTypes.id });
  return res.length > 0;
}

// ---------------------------------------------------------------------------
// LOANS — CRUD (with JOINs for enrichment)
// ---------------------------------------------------------------------------

export async function findAllLoans(): Promise<Loan[]> {
  const rows = await getDb()
    .select({
      loan: loans,
      employee: {
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
      },
      loanType: {
        name: loanTypes.name,
      },
    })
    .from(loans)
    .innerJoin(employees, eq(loans.employeeId, employees.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .orderBy(desc(loans.createdAt));

  return rows.map((row) =>
    mapLoan(
      row.loan,
      `${row.employee.firstName} ${row.employee.lastName}`,
      row.employee.employeeCode,
      row.loanType.name,
    ),
  );
}

export async function findLoanById(id: string): Promise<Loan | null> {
  const rows = await getDb()
    .select({
      loan: loans,
      employee: {
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
      },
      loanType: {
        name: loanTypes.name,
      },
    })
    .from(loans)
    .innerJoin(employees, eq(loans.employeeId, employees.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .where(eq(loans.id, id));

  if (!rows.length) return null;
  const row = rows[0];
  return mapLoan(
    row.loan,
    `${row.employee.firstName} ${row.employee.lastName}`,
    row.employee.employeeCode,
    row.loanType.name,
  );
}

export async function findActiveLoansByEmployee(employeeId: string): Promise<Loan[]> {
  const rows = await getDb()
    .select({
      loan: loans,
      employee: {
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
      },
      loanType: {
        name: loanTypes.name,
      },
    })
    .from(loans)
    .innerJoin(employees, eq(loans.employeeId, employees.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .where(eq(loans.employeeId, employeeId))
    .orderBy(desc(loans.createdAt));

  return rows
    .filter((r) => r.loan.status === "ACTIVE")
    .map((row) =>
      mapLoan(
        row.loan,
        `${row.employee.firstName} ${row.employee.lastName}`,
        row.employee.employeeCode,
        row.loanType.name,
      ),
    );
}

export async function createLoan(data: {
  employeeId: string;
  loanTypeId: string;
  givenDate: string;
  loanAmount: string;
  installmentAmount: string;
  noOfInstallments: number;
  remainingAmount: string;
}): Promise<Loan> {
  const rows = await getDb()
    .insert(loans)
    .values({
      employeeId: data.employeeId,
      loanTypeId: data.loanTypeId,
      givenDate: data.givenDate,
      loanAmount: data.loanAmount,
      installmentAmount: data.installmentAmount,
      noOfInstallments: data.noOfInstallments,
      totalReturned: "0",
      remainingAmount: data.remainingAmount,
      status: "ACTIVE",
    })
    .returning();

  // Re-fetch with JOINs for enrichment
  const enriched = await findLoanById(rows[0].id);
  if (!enriched) throw new Error("Failed to retrieve created loan");
  return enriched;
}

// ---------------------------------------------------------------------------
// REPAYMENTS — Transactional Create + Balance Update
// ---------------------------------------------------------------------------

export async function findRepaymentsByLoan(loanId: string): Promise<LoanRepayment[]> {
  const rows = await getDb()
    .select()
    .from(loanRepayments)
    .where(eq(loanRepayments.loanId, loanId))
    .orderBy(desc(loanRepayments.repaymentDate));
  return rows.map(mapRepayment);
}

export async function recordRepayment(data: any): Promise<{ repayment: LoanRepayment; updatedLoan: Loan }> {
  const targetLoan = await findLoanById(data.loanId);
  if (!targetLoan) throw new Error("Loan not found");

  const amountPaidNum = Number(data.amount || data.amountPaid || 0);
  const newTotalReturned = (Number(targetLoan.totalReturned) + amountPaidNum).toString();
  const newRemainingAmount = Math.max(0, Number(targetLoan.remainingAmount) - amountPaidNum).toString();
  const newStatus = Number(newRemainingAmount) <= 0 ? "CLOSED" : "ACTIVE";

  const repayment = await createRepayment({
    loanId: data.loanId,
    employeeId: targetLoan.employeeId,
    repaymentDate: data.repaymentDate ? new Date(data.repaymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    amountPaid: amountPaidNum.toString(),
    paymentMethod: data.paymentMethod || "CASH",
    createdBy: data.createdBy,
    newTotalReturned,
    newRemainingAmount,
    newStatus,
  });

  const updatedLoan = (await findLoanById(data.loanId))!;
  return { repayment, updatedLoan };
}

export async function createRepayment(data: {
  loanId: string;
  employeeId: string;
  repaymentDate: string;
  amountPaid: string;
  paymentMethod: string;
  createdBy?: string;
  newTotalReturned: string;
  newRemainingAmount: string;
  newStatus: string;
}) {
  return await getDb().transaction(async (tx) => {
    const [repayment] = await tx
      .insert(loanRepayments)
      .values({
        loanId: data.loanId,
        employeeId: data.employeeId,
        repaymentDate: data.repaymentDate,
        amountPaid: data.amountPaid,
        paymentMethod: data.paymentMethod,
        createdBy: data.createdBy || null,
      })
      .returning();

    await tx
      .update(loans)
      .set({
        totalReturned: data.newTotalReturned,
        remainingAmount: data.newRemainingAmount,
        status: data.newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(loans.id, data.loanId));

    return mapRepayment(repayment);
  });
}


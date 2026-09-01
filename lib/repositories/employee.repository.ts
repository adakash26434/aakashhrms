import { getDb } from '@/lib/db';
import { 
  employees, employeePersonal, employeeFamily, employeeBank, employeeTermination, departments, designations,
  users, loans, loanRepayments
} from '@/lib/db/schema';
import { eq, and, ilike, or, SQL, sql } from 'drizzle-orm';
import type { Employee, EmployeeFilter, EmployeeStatus } from '@/lib/types/employee';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EmployeeJoinedRow = {
  employees: typeof employees.$inferSelect;
  employee_personal: typeof employeePersonal.$inferSelect | null;
  employee_family: typeof employeeFamily.$inferSelect | null;
  employee_bank: typeof employeeBank.$inferSelect | null;
  employee_termination: typeof employeeTermination.$inferSelect | null;
};

function toDbDate(d: Date | string | null | undefined): string | null {
  if (!d || d === "") return null;
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().split('T')[0];
}

function toSafeUuid(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  if (val.length !== 36) return null; 
  return val;
}

function mapRowToEmployee(row: EmployeeJoinedRow): Employee {
  return {
    id: row.employees.id,
    employeeCode: row.employees.employeeCode,
    attendanceCode: row.employees.attendanceCode,
    firstName: row.employees.firstName,
    lastName: row.employees.lastName,
    gender: row.employees.gender as Employee["gender"],
    dateOfBirth: new Date(row.employees.dateOfBirth),
    taxStatus: row.employees.taxStatus as Employee["taxStatus"],
    isDisabled: row.employees.isDisabled,
    category: row.employees.category as Employee["category"],
    shreni: row.employees.shreni || '',
    departmentId: row.employees.departmentId,
    designationId: row.employees.designationId,
    branchId: row.employees.branchId,
    supervisorId: row.employees.supervisorId,
    joiningDate: new Date(row.employees.joiningDate),
    confirmationDate: row.employees.confirmationDate ? new Date(row.employees.confirmationDate) : null,
    retirementDateProjected: row.employees.retirementDateProjected ? new Date(row.employees.retirementDateProjected) : null,
    status: row.employees.status as EmployeeStatus,
    
    salaryGrade: row.employees.salaryGrade || '',
    gradePercent: row.employees.gradePercent || 0,
    gradeAmount: Number(row.employees.gradeAmount) || 0,

    citizenshipNo: row.employee_personal?.citizenshipNo || '',
    issuingDistrict: row.employee_personal?.issuingDistrict || '',
    nidNo: row.employee_personal?.nidNo || null,
    nidIssuingDistrict: row.employee_personal?.nidIssuingDistrict || null,
    passportNo: row.employee_personal?.passportNo || null,
    passportIssuingDistrict: row.employee_personal?.passportIssuingDistrict || null,
    votersId: row.employee_personal?.votersId || null,
    voterIdIssuingDistrict: row.employee_personal?.voterIdIssuingDistrict || null,
    panNumber: row.employee_personal?.panNumber || null,
    phoneHome: row.employee_personal?.phoneHome || null,
    mobileNo: row.employee_personal?.mobileNo || '',
    email: row.employee_personal?.companyEmail || row.employee_personal?.email || '',
    companyEmail: row.employee_personal?.companyEmail || row.employee_personal?.email || '',
    personalEmail: row.employee_personal?.personalEmail || null,
    permanentAddress: row.employee_personal?.permanentAddress || '',
    temporaryAddress: row.employee_personal?.temporaryAddress || null,
    address1: row.employee_personal?.permanentAddress || '',
    address2: row.employee_personal?.temporaryAddress || null,

    fatherName: row.employee_family?.fatherName || null,
    motherName: row.employee_family?.motherName || null,
    spouseName: row.employee_family?.spouseName || null,
    grandfatherName: row.employee_family?.grandfatherName || null,

    bankName: row.employee_bank?.bankName || '',
    bankBranch: row.employee_bank?.branchName || '',
    bankAccountNumber: row.employee_bank?.accountNumber || '',

    informedDate: row.employee_termination?.informedDate ? new Date(row.employee_termination.informedDate) : null,
    terminationDate: row.employee_termination?.terminationDate ? new Date(row.employee_termination.terminationDate) : null,
    terminationType: (row.employee_termination?.type as Employee["terminationType"]) || null,
    terminationReason: row.employee_termination?.reason || null,
    terminationPlan: (row.employee_termination?.plan as Employee["terminationPlan"]) || null,
    terminationRemarks: row.employee_termination?.remarks || null,

    createdAt: row.employees.createdAt,
    updatedAt: row.employees.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function findAll(filter: EmployeeFilter, scopeCondition?: SQL<unknown>): Promise<Employee[]> {
  const conditions: SQL<unknown>[] = [];
  
  if (filter.search && filter.search.trim() !== "") {
    const term = `%${filter.search.trim()}%`;
    const searchCondition = or(
      ilike(employees.firstName, term),
      ilike(employees.lastName, term),
      ilike(employees.employeeCode, term),
      ilike(employees.attendanceCode, term)
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }
  if (filter.departmentId !== "all") conditions.push(eq(employees.departmentId, filter.departmentId));
  if (filter.branchId !== "all") conditions.push(eq(employees.branchId, filter.branchId));
  if (filter.category !== "all") conditions.push(eq(employees.category, filter.category));
  if (filter.status !== "all") conditions.push(eq(employees.status, filter.status));
  if (scopeCondition) conditions.push(scopeCondition);

  let rows: any[] = [];
  try {
    rows = await getDb()
      .select()
      .from(employees)
      .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
      .leftJoin(employeeFamily, eq(employeeFamily.employeeId, employees.id))
      .leftJoin(employeeBank, and(eq(employeeBank.employeeId, employees.id), eq(employeeBank.isPrimary, true)))
      .leftJoin(employeeTermination, eq(employeeTermination.employeeId, employees.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);
  } catch (error) {
    console.error('[EMPLOYEE_REPOSITORY] Query failed in findAll:', error);
    return [];
  }

  // Map and deduplicate by employee ID to prevent duplicate records if multiple joins exist
  const uniqueEmpsMap = new Map<string, EmployeeJoinedRow>();
  for (const r of rows) {
    if (!uniqueEmpsMap.has(r.employees.id)) {
      uniqueEmpsMap.set(r.employees.id, r as EmployeeJoinedRow);
    }
  }

  return Array.from(uniqueEmpsMap.values()).map(mapRowToEmployee);
}

export async function findById(id: string): Promise<Employee | undefined> {
  const rows = await getDb()
    .select()
    .from(employees)
    .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
    .leftJoin(employeeFamily, eq(employeeFamily.employeeId, employees.id))
    .leftJoin(employeeBank, and(eq(employeeBank.employeeId, employees.id), eq(employeeBank.isPrimary, true)))
    .leftJoin(employeeTermination, eq(employeeTermination.employeeId, employees.id))
    .where(eq(employees.id, id));

  if (!rows.length) return undefined;
  return mapRowToEmployee(rows[0] as EmployeeJoinedRow);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function create(data: Partial<Employee>): Promise<Employee> {
  return await getDb().transaction(async (tx) => {
    const empInsert = await tx.insert(employees).values({
      employeeCode: data.employeeCode ?? '',
      attendanceCode: data.attendanceCode ?? '',
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      gender: data.gender ?? 'Other',
      dateOfBirth: toDbDate(data.dateOfBirth) ?? new Date().toISOString().split('T')[0],
      taxStatus: data.taxStatus ?? 'Normal Single',
      isDisabled: data.isDisabled ?? false,
      category: data.category ?? 'Permanent',
      shreni: data.shreni,
      departmentId: data.departmentId ?? '',
      designationId: data.designationId ?? '',
      branchId: data.branchId ?? '',
      supervisorId: toSafeUuid(data.supervisorId),
      joiningDate: toDbDate(data.joiningDate) ?? new Date().toISOString().split('T')[0],
      confirmationDate: toDbDate(data.confirmationDate),
      retirementDateProjected: toDbDate(data.retirementDateProjected),
      status: data.status || 'Active',
      salaryGrade: data.salaryGrade,
      gradePercent: data.gradePercent,
      gradeAmount: data.gradeAmount?.toString(),
    }).returning({ id: employees.id });
    
    const newEmpId = empInsert[0].id;

    await tx.insert(employeePersonal).values({
      employeeId: newEmpId,
      citizenshipNo: data.citizenshipNo ?? '',
      issuingDistrict: data.issuingDistrict ?? '',
      nidNo: data.nidNo || null,
      nidIssuingDistrict: data.nidIssuingDistrict || null,
      passportNo: data.passportNo || null,
      passportIssuingDistrict: data.passportIssuingDistrict || null,
      votersId: data.votersId || null,
      voterIdIssuingDistrict: data.voterIdIssuingDistrict || null,
      panNumber: data.panNumber || null,
      phoneHome: data.phoneHome || null,
      mobileNo: data.mobileNo ?? '',
      email: data.companyEmail || data.email || `${newEmpId}@placeholder.com`,
      companyEmail: data.companyEmail || data.email || `${newEmpId}@placeholder.com`,
      personalEmail: data.personalEmail || null,
      permanentAddress: data.permanentAddress ?? data.address1 ?? '',
      temporaryAddress: data.temporaryAddress ?? data.address2 ?? null,
    });

    await tx.insert(employeeFamily).values({
      employeeId: newEmpId,
      fatherName: data.fatherName || null,
      motherName: data.motherName || null,
      spouseName: data.spouseName || null,
      grandfatherName: data.grandfatherName || null,
    });

    if (data.bankName && data.bankAccountNumber) {
      await tx.insert(employeeBank).values({
        employeeId: newEmpId,
        bankName: data.bankName,
        branchName: data.bankBranch ?? '',
        accountNumber: data.bankAccountNumber,
      });
    }

    if (data.status === 'Terminated') {
      await tx.insert(employeeTermination).values({
        employeeId: newEmpId,
        informedDate: toDbDate(data.informedDate),
        terminationDate: toDbDate(data.terminationDate),
        type: data.terminationType || null,
        reason: data.terminationReason || null,
        plan: data.terminationPlan || null,
        remarks: data.terminationRemarks || null,
      });
    }

    if (data.departmentId) {
      await tx.update(departments).set({ employeeCount: sql`${departments.employeeCount} + 1` }).where(eq(departments.id, data.departmentId));
    }
    if (data.designationId) {
      await tx.update(designations).set({ employeeCount: sql`${designations.employeeCount} + 1` }).where(eq(designations.id, data.designationId));
    }

    // Lookup fresh from tx
    const rows = await tx
      .select()
      .from(employees)
      .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
      .leftJoin(employeeFamily, eq(employeeFamily.employeeId, employees.id))
      .leftJoin(employeeBank, eq(employeeBank.employeeId, employees.id))
      .leftJoin(employeeTermination, eq(employeeTermination.employeeId, employees.id))
      .where(eq(employees.id, newEmpId));
      
    if (!rows.length) throw new Error("Transaction failed to retrieve created employee");
    return mapRowToEmployee(rows[0] as EmployeeJoinedRow);
  });
}

export async function update(id: string, data: Partial<Employee>): Promise<Employee> {
  return await getDb().transaction(async (tx) => {
    const oldEmp = await tx.select({ deptId: employees.departmentId, desigId: employees.designationId }).from(employees).where(eq(employees.id, id));
    
    await tx.update(employees).set({
      employeeCode: data.employeeCode,
      attendanceCode: data.attendanceCode,
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth ? toDbDate(data.dateOfBirth) ?? undefined : undefined,
      taxStatus: data.taxStatus,
      isDisabled: data.isDisabled,
      category: data.category,
      shreni: data.shreni,
      departmentId: data.departmentId,
      designationId: data.designationId,
      branchId: data.branchId,
      supervisorId: toSafeUuid(data.supervisorId),
      joiningDate: data.joiningDate ? toDbDate(data.joiningDate) ?? undefined : undefined,
      confirmationDate: toDbDate(data.confirmationDate),
      retirementDateProjected: toDbDate(data.retirementDateProjected),
      status: data.status,
      salaryGrade: data.salaryGrade,
      gradePercent: data.gradePercent,
      gradeAmount: data.gradeAmount?.toString(),
      updatedAt: new Date(),
    }).where(eq(employees.id, id));

    if (oldEmp.length > 0) {
      if (data.departmentId && data.departmentId !== oldEmp[0].deptId) {
        await tx.update(departments).set({ employeeCount: sql`${departments.employeeCount} - 1` }).where(eq(departments.id, oldEmp[0].deptId));
        await tx.update(departments).set({ employeeCount: sql`${departments.employeeCount} + 1` }).where(eq(departments.id, data.departmentId));
      }
      if (data.designationId && data.designationId !== oldEmp[0].desigId) {
        await tx.update(designations).set({ employeeCount: sql`${designations.employeeCount} - 1` }).where(eq(designations.id, oldEmp[0].desigId));
        await tx.update(designations).set({ employeeCount: sql`${designations.employeeCount} + 1` }).where(eq(designations.id, data.designationId));
      }
    }

    await tx.update(employeePersonal).set({
      citizenshipNo: data.citizenshipNo,
      issuingDistrict: data.issuingDistrict,
      nidNo: data.nidNo || null,
      nidIssuingDistrict: data.nidIssuingDistrict || null,
      passportNo: data.passportNo || null,
      passportIssuingDistrict: data.passportIssuingDistrict || null,
      votersId: data.votersId || null,
      voterIdIssuingDistrict: data.voterIdIssuingDistrict || null,
      panNumber: data.panNumber || null,
      phoneHome: data.phoneHome || null,
      mobileNo: data.mobileNo,
      email: data.companyEmail || data.email,
      companyEmail: data.companyEmail || data.email,
      personalEmail: data.personalEmail || null,
      permanentAddress: data.permanentAddress ?? data.address1 ?? '',
      temporaryAddress: data.temporaryAddress ?? data.address2 ?? null,
    }).where(eq(employeePersonal.employeeId, id));

    await tx.update(employeeFamily).set({
      fatherName: data.fatherName || null,
      motherName: data.motherName || null,
      spouseName: data.spouseName || null,
      grandfatherName: data.grandfatherName || null,
    }).where(eq(employeeFamily.employeeId, id));

    if (data.bankName && data.bankAccountNumber) {
       const bankCheck = await tx.select().from(employeeBank).where(eq(employeeBank.employeeId, id));
       if (bankCheck.length > 0) {
         await tx.update(employeeBank).set({
           bankName: data.bankName,
           branchName: data.bankBranch,
           accountNumber: data.bankAccountNumber,
         }).where(eq(employeeBank.employeeId, id));
       } else {
         await tx.insert(employeeBank).values({
           employeeId: id,
           bankName: data.bankName,
           branchName: data.bankBranch ?? '',
           accountNumber: data.bankAccountNumber,
         });
       }
    }

    if (data.status === 'Terminated') {
       const existingTerm = await tx.select().from(employeeTermination).where(eq(employeeTermination.employeeId, id));
       if (existingTerm.length > 0) {
          await tx.update(employeeTermination).set({
            informedDate: toDbDate(data.informedDate),
            terminationDate: toDbDate(data.terminationDate),
            type: data.terminationType || null,
            reason: data.terminationReason || null,
            plan: data.terminationPlan || null,
            remarks: data.terminationRemarks || null,
          }).where(eq(employeeTermination.employeeId, id));
       } else {
          await tx.insert(employeeTermination).values({
            employeeId: id,
            informedDate: toDbDate(data.informedDate),
            terminationDate: toDbDate(data.terminationDate),
            type: data.terminationType || null,
            reason: data.terminationReason || null,
            plan: data.terminationPlan || null,
            remarks: data.terminationRemarks || null,
          });
       }
    }

    const rows = await tx
      .select()
      .from(employees)
      .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
      .leftJoin(employeeFamily, eq(employeeFamily.employeeId, employees.id))
      .leftJoin(employeeBank, eq(employeeBank.employeeId, employees.id))
      .leftJoin(employeeTermination, eq(employeeTermination.employeeId, employees.id))
      .where(eq(employees.id, id));
      
    if (!rows.length) throw new Error("Failed to retrieve updated employee");
    return mapRowToEmployee(rows[0] as EmployeeJoinedRow);
  });
}

export async function remove(id: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const oldEmp = await tx.select({ deptId: employees.departmentId, desigId: employees.designationId }).from(employees).where(eq(employees.id, id));
    if (oldEmp.length > 0) {
      if (oldEmp[0].deptId) {
        await tx.update(departments).set({ employeeCount: sql`${departments.employeeCount} - 1` }).where(eq(departments.id, oldEmp[0].deptId));
      }
      if (oldEmp[0].desigId) {
        await tx.update(designations).set({ employeeCount: sql`${designations.employeeCount} - 1` }).where(eq(designations.id, oldEmp[0].desigId));
      }
    }
    
    // Delete associated login user accounts, loan repayments, and loans to clear RESTRICT constraints
    await tx.delete(users).where(eq(users.employeeId, id));
    await tx.delete(loanRepayments).where(eq(loanRepayments.employeeId, id));
    await tx.delete(loans).where(eq(loans.employeeId, id));
    
    // Finally, remove the employee
    await tx.delete(employees).where(eq(employees.id, id));
  });
}
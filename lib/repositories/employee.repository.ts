import { getDb } from '@/lib/db';
import { 
  employees, employeePersonal, employeeFamily, employeeBank, employeeTermination, departments, designations,
  users
} from '@/lib/db/schema';
import { eq, and, ilike, or, SQL, sql } from 'drizzle-orm';
import type { Employee, EmployeeFilter, EmployeeStatus } from '@/lib/types/employee';
import type { EmployeeDocumentInput } from '@/lib/types/employee-document';
import { employeesNeedingSetup } from './salary-structure.repository';
import { employeesWithIdentityScan, findDocuments, saveDocumentsTx } from './employee-document.repository';
import { findPhotoIdFor, photoIdsByEmployee, savePhotoTx } from './employee-photo.repository';
import { findDossier, saveDossierTx } from './employee-dossier.repository';
import { insertChangeTx, refreshDraftSlipsTx, type NewChange } from './employee-detail.repository';
import type { EmployeeDossierInput } from '@/lib/types/employee-dossier';

/** The documents list and photo to save with the employee (4.2b), and who saves them. */
export interface DocumentsSave {
  rows: EmployeeDocumentInput[];
  /** 4.2c: qualifications, past employment, attachments (undefined = leave as is). */
  dossier?: EmployeeDossierInput;
  /** The photo's id ("" = no photo). */
  photoId: string;
  userId: string;
}

/** Photo ids by employee; empty when the photo table is not there yet (before the restart). */
async function photoIds(): Promise<Map<string, string>> {
  try {
    return await photoIdsByEmployee();
  } catch (error) {
    console.error('[EMPLOYEE_REPOSITORY] photos unavailable:', error instanceof Error ? error.message.slice(0, 120) : error);
    return new Map();
  }
}

/** Who still has only basic + grade from the employee form (4.4b); undefined if it cannot be read. */
async function salarySetups(): Promise<Set<string> | undefined> {
  try {
    return await employeesNeedingSetup();
  } catch (error) {
    console.error('[EMPLOYEE_REPOSITORY] salary set-up check unavailable:', error instanceof Error ? error.message.slice(0, 120) : error);
    return undefined;
  }
}

/** Who has a complete Citizenship / NID; undefined when the documents table is not there yet (before the restart). */
async function identityScans(): Promise<Set<string> | undefined> {
  try {
    return await employeesWithIdentityScan();
  } catch (error) {
    console.error('[EMPLOYEE_REPOSITORY] identity documents unavailable:', error instanceof Error ? error.message.slice(0, 120) : error);
    return undefined;
  }
}

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
    fullName: row.employees.fullName || `${(row.employees as any).firstName || ''} ${(row.employees as any).lastName || ''}`.trim(),
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
    isSupervisor: !!row.employees.isSupervisor,
    joiningDate: new Date(row.employees.joiningDate),
    confirmationDate: row.employees.confirmationDate ? new Date(row.employees.confirmationDate) : null,
    status: (row.employees.status === "Terminated" ? "Inactive" : row.employees.status) as EmployeeStatus,
    basicSalary: Number(row.employees.basicSalary) || 0,
    gradePercent: (row.employees.gradePercent === 100) ? 0 : (row.employees.gradePercent || 0),
    gradeCount: row.employees.gradeCount ?? 0,
    gradeAmount: Number(row.employees.gradeAmount) || 0,
    gradeManual: !!row.employees.gradeManual,

    citizenshipNo: row.employee_personal?.citizenshipNo || '',
    issuingDistrict: row.employee_personal?.issuingDistrict || '',
    nidNo: row.employee_personal?.nidNo || null,
    nidIssuingDistrict: row.employee_personal?.nidIssuingDistrict || null,
    passportNo: row.employee_personal?.passportNo || null,
    passportIssuingDistrict: row.employee_personal?.passportIssuingDistrict || null,
    votersId: row.employee_personal?.votersId || null,
    voterIdIssuingDistrict: row.employee_personal?.voterIdIssuingDistrict || null,
    panNumber: row.employee_personal?.panNumber || null,
    ssfNumber: row.employee_personal?.ssfNumber || null,
    pfNumber: row.employee_personal?.pfNumber || null,
    citNumber: row.employee_personal?.citNumber || null,
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

export interface EmployeeQuickResult {
  id: string;
  fullName: string;
  employeeCode: string;
  status: string;
  departmentName: string | null;
}

/** Escapes LIKE wildcards so user input matches literally. */
function likeTerm(input: string): string {
  return `%${input.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Lightweight lookup for the command palette: name / code / department only,
 * never personal, bank or salary fields. Honours the caller's scope condition.
 */
export async function quickSearch(
  search: string,
  scopeCondition?: SQL<unknown>,
  limit = 8
): Promise<EmployeeQuickResult[]> {
  const term = likeTerm(search.trim());
  const match = or(
    ilike(employees.fullName, term),
    ilike(employees.employeeCode, term),
    ilike(employees.attendanceCode, term)
  );
  const where = scopeCondition && match ? and(match, scopeCondition) : match;
  return (await getDb())
    .select({
      id: employees.id,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      status: employees.status,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(where)
    .orderBy(employees.fullName)
    .limit(limit);
}

export async function findAll(filter: EmployeeFilter, scopeCondition?: SQL<unknown>): Promise<Employee[]> {
  const conditions: SQL<unknown>[] = [];
  
  if (filter.search && filter.search.trim() !== "") {
    const term = likeTerm(filter.search.trim());
    const searchCondition = or(
      ilike(employees.fullName, term),
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
    rows = await (await getDb())
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

  const [scans, photos, setups] = await Promise.all([identityScans(), photoIds(), salarySetups()]);
  return Array.from(uniqueEmpsMap.values()).map((r) => ({
    ...mapRowToEmployee(r),
    identityScanMissing: scans ? !scans.has(r.employees.id) : undefined,
    salarySetupMissing: setups ? setups.has(r.employees.id) : undefined,
    photoId: photos.get(r.employees.id) ?? null,
  }));
}

/**
 * Every employee and attendance code in the company (codes only). Used to
 * suggest the next code and to catch duplicates across branches, which a
 * branch-scoped user cannot otherwise see.
 */
export async function findAllCodes(): Promise<{ id: string; employeeCode: string; attendanceCode: string }[]> {
  return (await getDb())
    .select({ id: employees.id, employeeCode: employees.employeeCode, attendanceCode: employees.attendanceCode })
    .from(employees);
}

/** Ids in register order (by name, then code) within a scope: the record navigator's sequence. */
export async function findOrderedIdsInScope(scopeCondition?: SQL<unknown>): Promise<string[]> {
  const rows = await (await getDb())
    .select({ id: employees.id })
    .from(employees)
    .where(scopeCondition)
    .orderBy(employees.fullName, employees.employeeCode);
  return rows.map((r) => r.id);
}

/**
 * Active employees a pay run covers: its branches, and its departments / designations / categories /
 * named employees when any are given (an empty or null list means all).
 */
export async function findForPayrollScope(scope: {
  branchIds: string[];
  departmentIds?: string[] | null;
  designationIds?: string[] | null;
  employeeCategories?: string[] | null;
  employeeIds?: string[] | null;
}): Promise<Employee[]> {
  const all = await findAll({
    search: '',
    branchId: scope.branchIds.length === 1 ? scope.branchIds[0] : 'all',
    departmentId: scope.departmentIds && scope.departmentIds.length === 1 ? scope.departmentIds[0] : 'all',
    category: 'all',
    status: 'Active',
  });
  const within = (list: string[] | null | undefined, value: string) => !list || list.length === 0 || list.includes(value);
  return all.filter(
    (e) =>
      scope.branchIds.includes(e.branchId) &&
      within(scope.departmentIds, e.departmentId) &&
      within(scope.designationIds, e.designationId) &&
      within(scope.employeeCategories, e.category) &&
      within(scope.employeeIds, e.id),
  );
}

export async function findById(id: string): Promise<Employee | undefined> {
  const rows = await (await getDb())
    .select()
    .from(employees)
    .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
    .leftJoin(employeeFamily, eq(employeeFamily.employeeId, employees.id))
    .leftJoin(employeeBank, and(eq(employeeBank.employeeId, employees.id), eq(employeeBank.isPrimary, true)))
    .leftJoin(employeeTermination, eq(employeeTermination.employeeId, employees.id))
    .where(eq(employees.id, id));

  if (!rows.length) return undefined;
  const setups = await salarySetups();
  const employee = { ...mapRowToEmployee(rows[0] as EmployeeJoinedRow), salarySetupMissing: setups ? setups.has(id) : undefined };
  try {
    const [documents, scans, photoId, dossier] = await Promise.all([findDocuments(id), employeesWithIdentityScan(), findPhotoIdFor(id), findDossier(id)]);
    return { ...employee, documents, identityScanMissing: !scans.has(id), photoId, dossier };
  } catch (error) {
    console.error('[EMPLOYEE_REPOSITORY] identity documents unavailable:', error instanceof Error ? error.message.slice(0, 120) : error);
    return employee;
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function create(data: Partial<Employee>, documents?: DocumentsSave): Promise<Employee> {
  return await (await getDb()).transaction(async (tx) => {
    const empInsert = await tx.insert(employees).values({
      employeeCode: data.employeeCode ?? '',
      attendanceCode: data.attendanceCode ?? '',
      fullName: data.fullName ?? '',
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
      isSupervisor: !!data.isSupervisor,
      joiningDate: toDbDate(data.joiningDate) ?? new Date().toISOString().split('T')[0],
      confirmationDate: toDbDate(data.confirmationDate),
      status: data.status || 'Active',
      basicSalary: data.basicSalary !== undefined ? data.basicSalary.toString() : '0',
      gradePercent: data.gradePercent,
      gradeCount: data.gradeCount ?? 0,
      gradeAmount: data.gradeAmount?.toString(),
      gradeManual: !!data.gradeManual,
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
      ssfNumber: data.ssfNumber || null,
      pfNumber: data.pfNumber || null,
      citNumber: data.citNumber || null,
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

    if (data.status === 'Inactive' || (data.status as any) === 'Terminated') {
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

    if (documents) {
      await saveDocumentsTx(tx, newEmpId, documents.rows, documents.userId);
      await savePhotoTx(tx, newEmpId, documents.photoId, documents.userId);
      if (documents.dossier) await saveDossierTx(tx, newEmpId, documents.dossier, documents.userId);
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

export async function update(id: string, data: Partial<Employee>, documents?: DocumentsSave): Promise<Employee> {
  return (await updateWithDetailChange(id, data, documents, null)).employee;
}

/**
 * The employee save (4.8 / F13): the record, and a change to its sensitive details recorded in
 * the same transaction (a second waiting change for the employee fails the whole save on the
 * one-pending index). When the change applies with the save, the new bank details go onto the
 * employee's draft payslips too.
 */
export async function updateWithDetailChange(
  id: string,
  data: Partial<Employee>,
  documents: DocumentsSave | undefined,
  detail: { change: NewChange; refreshBank: { bankName: string; bankAccountNumber: string } | null } | null,
): Promise<{ employee: Employee; detailChangeId: string | null; draftSlips: number }> {
  return await (await getDb()).transaction(async (tx) => {
    const detailChangeId = detail ? await insertChangeTx(tx, detail.change) : null;
    const oldEmp = await tx.select({ deptId: employees.departmentId, desigId: employees.designationId }).from(employees).where(eq(employees.id, id));
    
    await tx.update(employees).set({
      employeeCode: data.employeeCode,
      attendanceCode: data.attendanceCode,
      fullName: data.fullName,
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
      isSupervisor: data.isSupervisor !== undefined ? !!data.isSupervisor : undefined,
      joiningDate: data.joiningDate ? toDbDate(data.joiningDate) ?? undefined : undefined,
      confirmationDate: toDbDate(data.confirmationDate),
      status: data.status,
      basicSalary: data.basicSalary !== undefined ? data.basicSalary.toString() : undefined,
      gradePercent: data.gradePercent,
      gradeCount: data.gradeCount !== undefined ? data.gradeCount : undefined,
      gradeAmount: data.gradeAmount?.toString(),
      gradeManual: data.gradeManual !== undefined ? !!data.gradeManual : undefined,
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
      ssfNumber: data.ssfNumber || null,
      pfNumber: data.pfNumber || null,
      citNumber: data.citNumber || null,
      phoneHome: data.phoneHome || null,
      mobileNo: data.mobileNo,
      email: data.companyEmail || data.email,
      companyEmail: data.companyEmail || data.email,
      personalEmail: data.personalEmail || null,
      permanentAddress: data.permanentAddress ?? data.address1 ?? '',
      temporaryAddress: data.temporaryAddress ?? data.address2 ?? null,
    }).where(eq(employeePersonal.employeeId, id));

    if (documents) {
      await saveDocumentsTx(tx, id, documents.rows, documents.userId);
      await savePhotoTx(tx, id, documents.photoId, documents.userId);
      if (documents.dossier) await saveDossierTx(tx, id, documents.dossier, documents.userId);
    }

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

    if (data.status === 'Inactive' || (data.status as any) === 'Terminated') {
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

    const draftSlips = detail?.refreshBank ? await refreshDraftSlipsTx(tx, id, detail.refreshBank) : 0;

    const rows = await tx
      .select()
      .from(employees)
      .leftJoin(employeePersonal, eq(employeePersonal.employeeId, employees.id))
      .leftJoin(employeeFamily, eq(employeeFamily.employeeId, employees.id))
      .leftJoin(employeeBank, and(eq(employeeBank.employeeId, employees.id), eq(employeeBank.isPrimary, true)))
      .leftJoin(employeeTermination, eq(employeeTermination.employeeId, employees.id))
      .where(eq(employees.id, id));

    if (!rows.length) throw new Error("Failed to retrieve updated employee");
    return { employee: mapRowToEmployee(rows[0] as EmployeeJoinedRow), detailChangeId, draftSlips };
  });
}

/**
 * Employees are never deleted (4.2): payroll, tax and audit history must stay
 * linked to the person. Leaving is recorded as Inactive with a separation
 * record, and the self-service login is switched off in the same transaction
 * (on again when the employee is reactivated).
 */
export async function setStatus(
  id: string,
  status: EmployeeStatus,
  separation: {
    informedDate: string | null;
    terminationDate: string;
    type: string;
    plan: string | null;
    reason: string;
    remarks: string | null;
  } | null
): Promise<void> {
  await (await getDb()).transaction(async (tx) => {
    await tx.update(employees).set({ status, updatedAt: new Date() }).where(eq(employees.id, id));
    if (status === 'Inactive' && separation) {
      const values = {
        informedDate: separation.informedDate,
        terminationDate: separation.terminationDate,
        type: separation.type,
        plan: separation.plan,
        reason: separation.reason,
        remarks: separation.remarks,
      };
      const existing = await tx.select({ id: employeeTermination.employeeId }).from(employeeTermination).where(eq(employeeTermination.employeeId, id));
      if (existing.length > 0) await tx.update(employeeTermination).set(values).where(eq(employeeTermination.employeeId, id));
      else await tx.insert(employeeTermination).values({ employeeId: id, ...values });
    } else if (status === 'Active') {
      // Rejoining: the old separation no longer applies (the audit log keeps the dates).
      await tx.delete(employeeTermination).where(eq(employeeTermination.employeeId, id));
    }
    await tx.update(users).set({ isActive: status === 'Active', updatedAt: new Date() }).where(eq(users.employeeId, id));
  });
}

/**
 * Dashboard (4.1): employees who joined and who left between two dates
 * (inclusive), within `scopeCondition` (built with buildEmployeeScopeCondition).
 */
export async function countJoinersLeavers(fromDate: string, toDate: string, scopeCondition?: SQL): Promise<{ joiners: number; leavers: number }> {
  const db = await getDb();
  const [joined] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(and(sql`${employees.joiningDate} between ${fromDate} and ${toDate}`, scopeCondition));
  const [left] = await db
    .select({ count: sql<number>`count(distinct ${employeeTermination.employeeId})::int` })
    .from(employeeTermination)
    .innerJoin(employees, eq(employees.id, employeeTermination.employeeId))
    .where(and(sql`${employeeTermination.terminationDate} between ${fromDate} and ${toDate}`, scopeCondition));
  return { joiners: Number(joined?.count) || 0, leavers: Number(left?.count) || 0 };
}


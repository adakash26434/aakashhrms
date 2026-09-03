import * as repository from "@/lib/repositories/employee.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as salaryMappingRepository from "@/lib/repositories/salary-mapping.repository";
import * as loanRepository from "@/lib/repositories/loan.repository";
import * as engine from "@/lib/engines/employee.engine";
import type { Employee, EmployeeFormData, EmployeeFilter, EmployeeKPIs, EmployeeValidationErrors } from "@/lib/types/employee";
import { getDb } from "@/lib/db";
import { employeeSalaryMap, loans, loanTypes, leaveApplications, leaveOtCalculations, payrollSlips, leaveSalaryRuns, systemConfig } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import { calculateProRataLeaveDays } from "@/lib/engines/leave-type.engine";
import { ScopeFilter, buildEmployeeScopeCondition } from "@/lib/auth/scope-filter";

export class EmployeeValidationError extends Error {
  constructor(public errors: EmployeeValidationErrors) {
    super("Employee validation failed");
    this.name = "EmployeeValidationError";
  }
}

export class EmployeeInUseError extends Error {
  constructor(message = "Employee cannot be deleted because they have existing payroll records") {
    super(message);
    this.name = "EmployeeInUseError";
  }
}

export interface EmployeeLookupData {
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string; departmentId: string }[];
}

export async function getEmployeeLookupData(scope?: ScopeFilter) {
  const scopeCondition = scope ? buildEmployeeScopeCondition(scope) : undefined;
  const db = getDb();
  const [branches, departments, designations, allEmployees, industryRow] = await Promise.all([
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    repository.findAll({ search: "", departmentId: "all", branchId: "all", category: "all", status: "all" }, scopeCondition),
    db
      .select({ value: systemConfig.value })
      .from(systemConfig)
      .where(eq(systemConfig.key, "company_industry_type"))
      .limit(1)
      .catch(() => []),
  ]);
  return {
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    designations: designations.map((d) => ({ id: d.id, name: d.name, departmentId: d.departmentId })),
    employees: allEmployees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      employeeCode: e.employeeCode,
      attendanceCode: e.attendanceCode,
    })),
    industryType: industryRow[0]?.value || "General",
  };
}

export async function getEmployees(filter: EmployeeFilter, scope?: ScopeFilter) {
  const scopeCondition = scope ? buildEmployeeScopeCondition(scope) : undefined;
  const [employees, deptCount] = await Promise.all([
    repository.findAll(filter, scopeCondition),
    departmentRepository.countActive(),
  ]);
  const kpis = engine.calculateEmployeeKPIs(employees, deptCount);
  return { employees, kpis };
}

export async function getEmployeeById(id: string) {
  const employee = await repository.findById(id);
  if (!employee) throw new Error("Employee not found");
  return employee;
}

export async function saveEmployee(id: string | null, formData: EmployeeFormData) {
  // 1. Validate using engine
  const errors = engine.validateEmployee(formData);
  if (Object.keys(errors).length > 0) {
    throw new EmployeeValidationError(errors);
  }

  // 2. Transform FormData (strings) -> Employee Entity (Dates)
  const employeeData: Partial<Employee> = {
    attendanceCode: formData.attendanceCode,
    employeeCode: formData.employeeCode,
    firstName: formData.firstName,
    lastName: formData.lastName,
    gender: formData.gender,
    dateOfBirth: new Date(formData.dateOfBirth),
    taxStatus: formData.taxStatus,
    isDisabled: formData.isDisabled,
    category: formData.category,
    shreni: formData.shreni,
    departmentId: formData.departmentId,
    designationId: formData.designationId,
    branchId: formData.branchId,
    supervisorId: formData.supervisorId || null,
    joiningDate: new Date(formData.joiningDate),
    confirmationDate: formData.confirmationDate ? new Date(formData.confirmationDate) : null,
    retirementDateProjected: formData.retirementDateProjected
      ? new Date(formData.retirementDateProjected)
      : null,
    status: formData.status,
    salaryGrade: formData.salaryGrade,
    gradePercent: formData.gradePercent,
    gradeAmount: formData.gradeAmount,
    citizenshipNo: formData.citizenshipNo,
    issuingDistrict: formData.issuingDistrict,
    nidNo: formData.nidNo || null,
    nidIssuingDistrict: formData.nidIssuingDistrict || null,
    passportNo: formData.passportNo || null,
    passportIssuingDistrict: formData.passportIssuingDistrict || null,
    votersId: formData.votersId || null,
    voterIdIssuingDistrict: formData.voterIdIssuingDistrict || null,
    panNumber: formData.panNumber || null,
    phoneHome: formData.phoneHome || null,
    mobileNo: formData.mobileNo,
    email: formData.companyEmail || formData.email,
    companyEmail: formData.companyEmail || formData.email,
    personalEmail: formData.personalEmail || null,
    permanentAddress: formData.permanentAddress || formData.address1 || '',
    temporaryAddress: formData.temporaryAddress || formData.address2 || null,
    address1: formData.permanentAddress || formData.address1 || '',
    address2: formData.temporaryAddress || formData.address2 || null,
    fatherName: formData.fatherName || null,
    motherName: formData.motherName || null,
    spouseName: formData.spouseName || null,
    grandfatherName: formData.grandfatherName || null,
    bankName: formData.bankName,
    bankBranch: formData.bankBranch,
    bankAccountNumber: formData.bankAccountNumber,
    informedDate: formData.informedDate ? new Date(formData.informedDate) : null,
    terminationDate: formData.terminationDate ? new Date(formData.terminationDate) : null,
    terminationType: formData.terminationType || null,
    terminationReason: formData.terminationReason || null,
    terminationPlan: formData.terminationPlan || null,
    terminationRemarks: formData.terminationRemarks || null,
  };

  // 3. Persist via repository
  if (id) {
    return repository.update(id, employeeData);
  } else {
    const employee = await repository.create(employeeData);
    
    // =======================================================================
    // EMPLOYEE-USER SYNC (STAGE A ARCHITECTURE)
    // Automatically generate a self-service login account for new employees
    // =======================================================================
    if (employee.email) {
      const { createSecureUserAccount } = await import("@/lib/services/user.service");
      try {
        await createSecureUserAccount(employee.id, employee.email, "standard_staff");
      } catch (err) {
        console.error(`Failed to generate user account for employee ${employee.id}:`, err);
      }
    }

    // =======================================================================
    // P0 FIX: LEAVE BALANCE INITIALIZATION ON HIRE
    // Allot leave balances for all active leave types in the current FY.
    // Pro-rata calculation for mid-year joiners based on leave type config.
    // =======================================================================
    try {
      const fiscalYears = await fiscalYearRepository.findAllFiscalYears();
      const activeFy = fiscalYears.find(fy => fy.status === 'Active');
      if (activeFy) {
        const leaveTypes = await leaveRepository.findAllLeaveTypes();
        const fyStart = new Date(activeFy.startDateAD);
        const fyEnd = new Date(activeFy.endDateAD);
        const joinDate = employee.joiningDate ? new Date(employee.joiningDate) : fyStart;

        const creationPromises = leaveTypes.map(async (lt) => {
          // Check gender applicability
          if (lt.genderApplicable !== 'All' && lt.genderApplicable !== employee.gender) {
            return;
          }

          const isEventBased = ['MOURNING', 'PATERNITY', 'MATERNITY'].includes(lt.code.toUpperCase()) ||
                               ['MOURNING', 'PATERNITY', 'MATERNITY'].includes(lt.statutoryCode?.toUpperCase() || '');

          let allottedDays = Number(lt.noOfDays);

          // Calculate allotment — pro-rata only if configured, not event-based, and employee joined midway through this FY
          if (!isEventBased && lt.proRataForNewJoinees && joinDate > fyStart) {
            allottedDays = calculateProRataLeaveDays(Number(lt.noOfDays), joinDate, fyStart, fyEnd);
          }

          return leaveRepository.createLeaveBalance({
            employeeId: employee.id,
            leaveTypeId: lt.id,
            fiscalYearId: activeFy.id,
            allotted: allottedDays,
            taken: 0,
            carriedForward: 0,
            balance: allottedDays,
          });
        });
        await Promise.all(creationPromises);
      }
    } catch (err) {
      console.error(`Failed to initialize leave balances for employee ${employee.id}:`, err);
      // Non-blocking — HR can manually allot if this fails
    }
    
    return employee;
  }
}

export async function deleteEmployee(id: string) {
  // Query outstanding tasks/dues from multiple modules to construct a status checklist
  const activeMappings = await getDb()
    .select()
    .from(employeeSalaryMap)
    .where(and(eq(employeeSalaryMap.employeeId, id), eq(employeeSalaryMap.isActive, true)));

  const activeLoans = await getDb()
    .select({
      loan: loans,
      typeName: loanTypes.name,
    })
    .from(loans)
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .where(and(eq(loans.employeeId, id), eq(loans.status, "ACTIVE")));

  const pendingLeaves = await getDb()
    .select()
    .from(leaveApplications)
    .where(and(eq(leaveApplications.employeeId, id), eq(leaveApplications.status, "Pending")));

  const unlockedCalcs = await getDb()
    .select()
    .from(leaveOtCalculations)
    .where(and(eq(leaveOtCalculations.employeeId, id), eq(leaveOtCalculations.isLocked, false)));

  const blockers: string[] = [];
  const cleared: string[] = [];

  // Salary Mappings status check
  if (activeMappings.length > 0) {
    blockers.push("Salary Mapping: ACTIVE (must be deactivated first)");
  } else {
    cleared.push("Salary Mapping: CLEARED");
  }

  // Loan status check
  if (activeLoans.length > 0) {
    activeLoans.forEach((item) => {
      blockers.push(`Loan Dues: ${item.typeName} (NPR ${item.loan.remainingAmount} remaining)`);
    });
  } else {
    cleared.push("Loan Dues: CLEARED");
  }

  // Leave Applications status check
  if (pendingLeaves.length > 0) {
    blockers.push(`Leave Requests: ${pendingLeaves.length} pending application(s) awaiting approval`);
  } else {
    cleared.push("Leave Requests: CLEARED");
  }

  // Attendance/OT Calculations status check
  if (unlockedCalcs.length > 0) {
    const months = unlockedCalcs.map((c) => c.bsMonth).join(", ");
    blockers.push(`Attendance/OT Calculations: Pending for Month(s) [${months}]`);
  } else {
    cleared.push("Attendance/OT Calculations: CLEARED");
  }

  if (blockers.length > 0) {
    const errorMsg = [
      "Cannot delete employee due to outstanding items:",
      ...blockers.map((b) => `❌ ${b}`),
      "",
      "Cleared modules:",
      ...cleared.map((c) => `✅ ${c}`),
    ].join("\n");
    throw new EmployeeInUseError(errorMsg);
  }

  // P1 FIX: Check for existing payroll history (hard delete would destroy financial records)
  const existingSlips = await getDb()
    .select({ id: payrollSlips.id })
    .from(payrollSlips)
    .where(eq(payrollSlips.employeeId, id))
    .limit(1);
  if (existingSlips.length > 0) {
    throw new EmployeeInUseError(
      "Cannot delete employee: Payroll slips exist for this employee. Use Terminate instead to preserve financial history."
    );
  }

  // P1 FIX: Check for leave salary PAID records
  const existingLeaveSalary = await getDb()
    .select({ id: leaveSalaryRuns.id })
    .from(leaveSalaryRuns)
    .where(and(eq(leaveSalaryRuns.employeeId, id), eq(leaveSalaryRuns.status, 'PAID')))
    .limit(1);
  if (existingLeaveSalary.length > 0) {
    throw new EmployeeInUseError(
      "Cannot delete employee: Paid leave salary records exist. Use Terminate instead to preserve financial history."
    );
  }

  return repository.remove(id);
}

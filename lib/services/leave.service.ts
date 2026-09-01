import * as repository from "@/lib/repositories/leave.repository";
import * as engine from "@/lib/engines/leave.engine";
import type { LeaveTypeRecord } from "@/lib/types/leave-type";
import type {
  LeaveType,
  EmployeeLeaveBalance,
  LeaveApplication,
  LeaveApplicationFormData,
  LeaveApplicationValidationErrors,
  LeaveFilter,
  LeaveKPIs,
  LeaveStatus,
} from "@/lib/types/leave";
import { findAll, findById as findEmployeeById } from "@/lib/repositories/employee.repository";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export class LeaveValidationError extends Error {
  constructor(public errors: LeaveApplicationValidationErrors) {
    super("Leave application validation failed");
    this.name = "LeaveValidationError";
  }
}

export interface LeaveLookupData {
  leaveTypes: {
    id: string;
    name: string;
    code: string;
    noOfDays: number;
    genderApplicable: string;
    accumulationCap: number | null;
    requiresDocument: boolean;
    documentThresholdDays: number | null;
  }[];
  employees: { id: string; name: string; code: string; gender: string }[];
}

export async function getLeaveLookupData(): Promise<LeaveLookupData> {
  const [leaveTypes, employees] = await Promise.all([
    repository.findAllLeaveTypes(),
    findAll({ search: "", departmentId: "all", branchId: "all", category: "all", status: "all" }),
  ]);

  return {
    leaveTypes: leaveTypes.map((lt) => ({
      id: lt.id,
      name: lt.name,
      code: lt.code,
      noOfDays: lt.noOfDays,
      genderApplicable: lt.genderApplicable,
      accumulationCap: lt.accumulationCap,
      requiresDocument: lt.requiresDocument,
      documentThresholdDays: lt.documentThresholdDays,
    })),
    employees: employees.map((emp) => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      code: emp.employeeCode,
      gender: emp.gender,
    })),
  };
}

export async function getLeaveApplications(filter: LeaveFilter) {
  const applications = await repository.findAllLeaveApplications(filter);
  const kpis = engine.calculateLeaveKPIs(applications);
  // Fetch employee names to enrich the data
  const employees = await findAll({
    search: "",
    departmentId: "all",
    branchId: "all",
    category: "all",
    status: "all",
  });
  const employeeMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  // Fetch all users to resolve reviewer names (users.id -> users.employeeId -> employees.id)
  const userList = await getDb().select({
    id: users.id,
    employeeId: users.employeeId,
    email: users.email,
  }).from(users);

  const userMap = new Map<string, string>();
  for (const u of userList) {
    if (u.employeeId) {
      const emp = employees.find((e) => e.id === u.employeeId);
      if (emp) {
        userMap.set(u.id, `${emp.firstName} ${emp.lastName}`);
        continue;
      }
    }
    userMap.set(u.id, u.email.split('@')[0] || u.email);
  }

  const enriched = applications.map((app) => ({
    ...app,
    employeeName: employeeMap.get(app.employeeId) || "Unknown",
    reviewerName: app.reviewedById ? userMap.get(app.reviewedById) || "Unknown Reviewer" : null,
  }));

  return { applications: enriched, kpis };
}

export async function getLeaveApplicationById(id: string) {
  const app = await repository.findLeaveApplicationById(id);
  if (!app) throw new Error("Leave application not found");

  const employees = await findAll({
    search: "",
    departmentId: "all",
    branchId: "all",
    category: "all",
    status: "all",
  });
  const employeeMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  // Fetch all users to resolve reviewer names (users.id -> users.employeeId -> employees.id)
  const userList = await getDb().select({
    id: users.id,
    employeeId: users.employeeId,
    email: users.email,
  }).from(users);

  const userMap = new Map<string, string>();
  for (const u of userList) {
    if (u.employeeId) {
      const emp = employees.find((e) => e.id === u.employeeId);
      if (emp) {
        userMap.set(u.id, `${emp.firstName} ${emp.lastName}`);
        continue;
      }
    }
    userMap.set(u.id, u.email.split('@')[0] || u.email);
  }

  return {
    ...app,
    employeeName: employeeMap.get(app.employeeId) || "Unknown",
    reviewerName: app.reviewedById ? userMap.get(app.reviewedById) || "Unknown Reviewer" : null,
  };
}

export async function getLeaveTypes(): Promise<LeaveTypeRecord[]> {
  return repository.findAllLeaveTypes();
}

export async function getEmployeeLeaveBalances(
  employeeId: string,
): Promise<EmployeeLeaveBalance[]> {
  return repository.findLeaveBalancesByEmployee(employeeId);
}

export async function saveLeaveApplication(
  id: string | null,
  formData: LeaveApplicationFormData,
) {
  // 1. Basic validation
  const errors: LeaveApplicationValidationErrors = engine.validateLeaveApplication(formData);
  if (Object.keys(errors).length > 0) {
    throw new LeaveValidationError(errors);
  }

  // 2. Fetch employee & leave type for statutory checks
  const [employee, leaveType] = await Promise.all([
    findEmployeeById(formData.employeeId),
    repository.findLeaveTypeById(formData.leaveTypeId),
  ]);

  if (!employee) {
    throw new LeaveValidationError({ employeeId: "Employee not found." });
  }
  if (!leaveType) {
    throw new LeaveValidationError({ leaveTypeId: "Leave type policy not found." });
  }

  // 3. Gender applicability check (e.g. Maternity = Female only)
  if (leaveType.genderApplicable !== "All" && leaveType.genderApplicable !== employee.gender) {
    throw new LeaveValidationError({
      leaveTypeId: `This leave type is restricted to ${leaveType.genderApplicable} employees. Employee is ${employee.gender}.`,
    });
  }

  // 4. Leave Balance check for Paid leaves
  if (leaveType.leaveType === "Pay") {
    const balances = await repository.findLeaveBalancesByEmployee(formData.employeeId);
    const balanceRec = balances.find((b) => b.leaveTypeId === formData.leaveTypeId);
    // P0 FIX: Require balance row for paid leave types — missing row means
    // balances were never initialized (no allotment), so we must block.
    if (!balanceRec) {
      throw new LeaveValidationError({
        noOfDays: `No leave balance record found for this leave type. Please contact HR to initialize leave balances.`,
      });
    }
    if (formData.noOfDays > balanceRec.balance) {
      throw new LeaveValidationError({
        noOfDays: `Insufficient balance. Available: ${balanceRec.balance} days, requested: ${formData.noOfDays} days.`,
      });
    }
  }

  const applicationData: Partial<LeaveApplication> = {
    employeeId: formData.employeeId,
    leaveTypeId: formData.leaveTypeId,
    effectiveFrom: new Date(formData.effectiveFrom),
    effectiveTo: new Date(formData.effectiveTo),
    duration: formData.duration,
    noOfDays: formData.noOfDays,
    reason: formData.reason,
    remarks: formData.remarks || null,
  };

  if (id) {
    return repository.updateLeaveApplication(id, applicationData);
  } else {
    const created = await repository.createLeaveApplication(applicationData);
    // Update leave balance
    if (created.status === "Approved") {
      const balances = await repository.findLeaveBalancesByEmployee(created.employeeId);
      const balanceRec = balances.find((b) => b.leaveTypeId === created.leaveTypeId);
      if (balanceRec) {
        await repository.updateLeaveBalance(
          balanceRec.id,
          balanceRec.taken + created.noOfDays,
          balanceRec.balance - created.noOfDays,
        );
      }
    }
    return created;
  }
}

export async function updateLeaveApplicationStatus(
  id: string,
  status: LeaveStatus,
  reviewerId: string,
  reviewRemarks?: string,
) {
  const existing = await repository.findLeaveApplicationById(id);
  if (!existing) throw new Error("Leave application not found");

  const updated = await repository.updateLeaveApplication(id, {
    status,
    reviewedById: reviewerId,
    reviewedAt: new Date(),
    reviewRemarks: reviewRemarks || null,
  });

  // If approved, update the balance
  if (status === "Approved" && existing.status !== "Approved") {
    const balances = await repository.findLeaveBalancesByEmployee(existing.employeeId);
    const balanceRec = balances.find((b) => b.leaveTypeId === existing.leaveTypeId);
    if (balanceRec) {
      await repository.updateLeaveBalance(
        balanceRec.id,
        balanceRec.taken + existing.noOfDays,
        balanceRec.balance - existing.noOfDays,
      );
    }
  }

  // P0 FIX: Restore balance when previously approved leave is rejected or cancelled
  if ((status === "Rejected" || status === "Cancelled") && existing.status === "Approved") {
    const balances = await repository.findLeaveBalancesByEmployee(existing.employeeId);
    const balanceRec = balances.find((b) => b.leaveTypeId === existing.leaveTypeId);
    if (balanceRec) {
      await repository.updateLeaveBalance(
        balanceRec.id,
        Math.max(0, balanceRec.taken - existing.noOfDays),
        balanceRec.balance + existing.noOfDays,
      );
    }
  }

  return updated;
}

export async function deleteLeaveApplication(id: string) {
  const existing = await repository.findLeaveApplicationById(id);
  if (!existing) throw new Error("Leave application not found");
  if (existing.status === "Approved") {
    throw new Error("Approved leave applications cannot be deleted");
  }
  return repository.removeLeaveApplication(id);
}
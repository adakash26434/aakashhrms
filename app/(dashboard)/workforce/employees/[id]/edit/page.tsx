export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmployeeForm } from "@/components/employee/employee-form";
import { getEmployeeFormContext, getEmployeeInScope } from "@/lib/services/employee.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Edit employee | AakashHRMS",
  description: "Update an employee record.",
};

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("EDIT", "EMPLOYEES");
  const { id } = await params;
  // Missing, malformed and out-of-scope ids all read as not found (S18).
  const employee = await getEmployeeInScope(id, scope, "EDIT");
  if (!employee) notFound();
  const [canEditPay, canApproveDetails, canManageLogins] = await Promise.all([
    hasPermission("EDIT", "SALARY_MAPPING"),
    hasPermission("APPROVE", "EMPLOYEES"),
    hasPermission("EDIT", "USERS_ROLES"),
  ]);
  // S59: giving logins roles is company-wide (the save checks again).
  const ctx = await getEmployeeFormContext(scope, employee, canEditPay, canApproveDetails, canManageLogins && scope.scopeType === "GLOBAL");
  return <EmployeeForm ctx={ctx} />;
}

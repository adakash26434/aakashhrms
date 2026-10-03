export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { EmployeeForm } from "@/components/employee/employee-form";
import { getEmployeeFormContext } from "@/lib/services/employee.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "New employee | AakashHRMS",
  description: "Add an employee: identification, job and pay, documents, contact, family and bank.",
};

export default async function NewEmployeePage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("ADD", "EMPLOYEES");
  const ctx = await getEmployeeFormContext(scope, null);
  return <EmployeeForm ctx={ctx} />;
}

export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { EmployeeClient } from "@/components/employee/employee-client";
import { getEmployees, getEmployeeLookupData } from "@/lib/services/employee.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Employee Directory | AakashHRMS",
  description: "Manage employee records, personal information, and employment details.",
};

export default async function EmployeePage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");

  const [{ employees, kpis }, lookupData] = await Promise.all([
    getEmployees(
      {
        search: "",
        departmentId: "all",
        branchId: "all",
        category: "all",
        status: "all",
      },
      scope
    ),
    getEmployeeLookupData(scope),
  ]);

  return (
    <EmployeeClient
      initialEmployees={employees}
      initialKpis={kpis}
      initialLookupData={lookupData}
    />
  );
}

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

export default async function EmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  // ?q= pre-fills the search (used by the command palette). Filter text only.
  const { q } = await searchParams;
  const initialSearch = typeof q === "string" ? q.slice(0, 100) : "";

  const [{ employees, kpis }, lookupData] = await Promise.all([
    getEmployees(
      {
        search: initialSearch,
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
      initialSearch={initialSearch}
    />
  );
}

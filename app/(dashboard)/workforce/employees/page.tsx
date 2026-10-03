export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { EmployeeClient } from "@/components/employee/employee-client";
import { getEmployeeRegister } from "@/lib/services/employee.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { EMPLOYEE_CATEGORIES } from "@/lib/types/system-control";

export const metadata: Metadata = {
  title: "Employees | AakashHRMS",
  description: "Employee register: records, placement and payroll readiness.",
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  const [add, edit, remove, exportOk, params] = await Promise.all([
    hasPermission("ADD", "EMPLOYEES"),
    hasPermission("EDIT", "EMPLOYEES"),
    hasPermission("DELETE", "EMPLOYEES"),
    hasPermission("EXPORT", "EMPLOYEES"),
    searchParams,
  ]);
  const data = await getEmployeeRegister(scope, { add, edit, remove, export: exportOk });

  // Filters come from the URL (ids only); anything unknown is dropped.
  const dept = one(params.dept);
  const branch = one(params.branch);
  const category = one(params.category);
  const status = one(params.status);
  const initialFilters = {
    dept: data.departments.some((d) => d.id === dept) ? dept : "",
    branch: data.branches.some((b) => b.id === branch) ? branch : "",
    category: (EMPLOYEE_CATEGORIES as string[]).includes(category) ? category : "",
    status: status === "Active" || status === "Inactive" ? status : "",
  };
  // ?q= pre-fills the search (the command palette uses it). Filter text only.
  const initialSearch = one(params.q).slice(0, 100);

  return <EmployeeClient data={data} initialFilters={initialFilters} initialSearch={initialSearch} />;
}

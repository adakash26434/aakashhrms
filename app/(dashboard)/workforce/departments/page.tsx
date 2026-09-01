export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { DepartmentClient } from "@/components/department/department-client";
import { getDepartmentData } from "@/lib/services/department.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Departments | AakashHRMS",
  description:
    "Configure organisational departments, assign them to branches, and manage the department hierarchy for payroll processing.",
};

/**
 * Server component for the Department Setup page.
 *
 * Fetches the initial dataset through the **service layer**
 * (which in turn calls the repository and the static branch
 * mock). The page itself is server-rendered; the client
 * component takes over from there and owns all subsequent
 * mutations via the same service.
 *
 * This pattern means: when the backend goes live, only the
 * `getDepartmentData()` body changes (it will hit the DB or call a
 * Server Action). The server-component file and its imports stay
 * identical.
 */
export default async function DepartmentsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "ORG_STRUCTURE");

  const data = await getDepartmentData();
  return <DepartmentClient initialData={data} />;
}
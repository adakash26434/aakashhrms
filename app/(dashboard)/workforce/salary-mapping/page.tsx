export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { SalaryMappingClient } from "@/components/salary-mapping/salary-mapping-client";
import { getSalaryMappingData } from "@/lib/services/salary-mapping.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Salary Mapping | AakashHRMS",
  description:
    "Manage employee salary mappings — basic salary, grade %, allowances, deductions, and net pay.",
};

/**
 * Server component for the Salary Mapping page.
 *
 * Fetches the initial dataset through the service layer and passes
 * it to the client component. The client takes over from there and
 * owns all subsequent mutations via the same service.
 *
 * When the backend goes live, only `getSalaryMappingData()` changes
 * (it will hit the DB or call a Server Action). The server component
 * file and its imports stay identical.
 */
export default async function SalaryMappingPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "SALARY_MAPPING");

  const data = await getSalaryMappingData();
  return <SalaryMappingClient initialData={data} />;
}
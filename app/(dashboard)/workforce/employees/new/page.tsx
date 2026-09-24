export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { EmployeeCreateFlow } from "@/components/employee/employee-create-flow";
import { getEmployeeLookupData } from "@/lib/services/employee.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Add Employee | AakashHRMS",
  description: "Create and register a new employee into the workforce.",
};

export default async function NewEmployeePage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("ADD", "EMPLOYEES");
  const lookupData = await getEmployeeLookupData(scope);

  return (
    <EmployeeCreateFlow
      branches={lookupData.branches}
      departments={lookupData.departments}
      designations={lookupData.designations}
      employees={lookupData.employees}
      industryType={lookupData.industryType}
      shreniLevels={lookupData.shreniLevels}
      gradePolicy={lookupData.gradePolicy}
    />
  );
}

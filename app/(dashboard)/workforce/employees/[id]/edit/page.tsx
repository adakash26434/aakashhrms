export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmployeeCreateFlow } from "@/components/employee/employee-create-flow";
import {
  getEmployeeById,
  getEmployeeLookupData,
} from "@/lib/services/employee.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Edit Employee | AakashHRMS",
  description: "Update employee record and workforce details.",
};

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({
  params,
}: EditEmployeePageProps) {
  const { id } = await params;
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("EDIT", "EMPLOYEES");

  let employee = null;
  let lookupData = null;

  try {
    const [emp, lookups] = await Promise.all([
      getEmployeeById(id),
      getEmployeeLookupData(scope),
    ]);
    employee = emp;
    lookupData = lookups;
  } catch {
    notFound();
  }

  if (!employee || !lookupData) {
    notFound();
  }

  return (
    <EmployeeCreateFlow
      editingId={id}
      initialEmployee={employee}
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

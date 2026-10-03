export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmployeeRecord } from "@/components/employee/employee-record";
import { getEmployeeRecord } from "@/lib/services/employee-record.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Employee record | AakashHRMS",
  description: "Employee profile with leave, attendance, payslips, loans and change history.",
};

export default async function EmployeeRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);

  // Each related tab needs its own module permission; the record itself is scoped (S18).
  const [leave, attendance, payslips, payslipReport, loans, history, edit] = await Promise.all([
    hasPermission("VIEW", "LEAVE_APPLICATIONS"),
    hasPermission("VIEW", "ATTENDANCE"),
    hasPermission("VIEW", "PAYROLL_REVIEW"),
    hasPermission("VIEW", "REPORTS_PAYSLIP"),
    hasPermission("VIEW", "LOANS"),
    hasPermission("VIEW", "AUDIT_LOG"),
    hasPermission("EDIT", "EMPLOYEES"),
  ]);

  const record = await getEmployeeRecord(
    id,
    tab,
    scope,
    { leave, attendance, payslips: payslips || payslipReport, loans, history },
    { edit }
  );
  if (!record) notFound();

  return <EmployeeRecord record={record} />;
}

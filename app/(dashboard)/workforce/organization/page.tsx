export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { DepartmentClient } from "@/components/department/department-client";
import { getDepartmentData } from "@/lib/services/department.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";
import type { OrgTab } from "@/components/department/department-tabs";

export const metadata: Metadata = {
  title: "Organization Hub | AakashHRMS",
  description:
    "Task-first organization hub for managing branches, departments, and designations.",
};

interface PageProps {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}

export default async function OrganizationPage({ searchParams }: PageProps) {
  await ensureTenantContext();
  await checkPermission("VIEW", "ORG_STRUCTURE");

  const resolvedParams =
    searchParams instanceof Promise ? await searchParams : searchParams;
  const initialTab = (resolvedParams?.tab as OrgTab) || "branches";

  const data = await getDepartmentData();

  return <DepartmentClient initialData={data} initialTab={initialTab} />;
}

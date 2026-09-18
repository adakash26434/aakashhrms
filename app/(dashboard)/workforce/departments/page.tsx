export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function DepartmentsPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "ORG_STRUCTURE");

  redirect("/setup/company-setup?tab=departments");
}
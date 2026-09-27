export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";

interface PageProps {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}

export default async function PayrollRulesRedirectPage({ searchParams }: PageProps) {
  await ensureTenantContext();
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const tab = resolvedParams.tab;

  if (tab) {
    redirect(`/setup/company-setup?section=payroll_rules&tab=${encodeURIComponent(tab)}`);
  } else {
    redirect("/setup/company-setup?section=payroll_rules");
  }
}


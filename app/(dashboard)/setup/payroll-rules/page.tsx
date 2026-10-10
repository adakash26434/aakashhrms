export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { setupLegacyRoute } from "@/lib/frame/legacy-routes";

interface PageProps {
  searchParams?: Promise<{ tab?: string }>;
}

/** The old Payroll rules page: each of its tabs has its own page under Setup now (4.12). */
export default async function PayrollRulesRedirectPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  redirect(setupLegacyRoute("payroll_rules", params.tab) ?? "/setup/fiscal-year");
}

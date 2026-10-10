export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { setupLegacyRoute } from "@/lib/frame/legacy-routes";
import { companySetupPage, contextFor } from "@/lib/services/company-setup.service";
import { CompanySetupClient } from "@/components/company-setup/company-setup-client";

export const metadata: Metadata = {
  title: "Company setup | AakashHRMS",
  description: "The company's legal registration, contacts, the signatories on printouts and the work schedule.",
};

interface PageProps {
  searchParams?: Promise<{ section?: string; tab?: string }>;
}

export default async function CompanySetupPage({ searchParams }: PageProps) {
  await ensureTenantContext();
  const params = (await searchParams) ?? {};
  // Sections that have their own pages now (4.3, 4.12): old links land there.
  const moved = setupLegacyRoute(params.section, params.tab);
  if (moved) redirect(moved);
  const scope = await checkPermissionWithScope("VIEW", "ORG_STRUCTURE");
  // The button state only: saving re-checks a company-wide role on the server (checkCompanyControl).
  const canEdit = scope.scopeType === "GLOBAL" && !scope.isImpersonation && (await hasPermission("EDIT", "ORG_STRUCTURE"));
  return <CompanySetupClient initial={await companySetupPage(await contextFor(scope.userId, canEdit))} />;
}

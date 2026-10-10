export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { getExitCase } from "@/lib/services/exit.service";
import { getSettlement } from "@/lib/services/settlement.service";
import { getCompanyProfileSetup } from "@/lib/repositories/company-setup.repository";
import { addressLine } from "@/lib/constants/nepal-locations";
import { SettlementPrint } from "@/components/exit/settlement-print";

export const metadata: Metadata = {
  title: "Settlement statement | AakashHRMS",
  description: "Printable full & final settlement.",
};

export default async function SettlementPrintPage({ params }: { params: Promise<{ caseId: string }> }) {
  await ensureTenantContext();
  // EMPLOYEES VIEW and the case in scope; anything else reads as not found.
  const scope = await checkPermissionWithScope("VIEW", "EMPLOYEES");
  const { caseId } = await params;
  const ctx = { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
  const [exit, company] = await Promise.all([getExitCase(caseId, ctx), getCompanyProfileSetup().catch(() => null)]);
  if (!exit) notFound();
  const { settlement } = await getSettlement(caseId, ctx, { prepare: false, approve: false, pay: false, policy: false });
  if (!settlement) notFound();
  return (
    <SettlementPrint
      exit={exit}
      settlement={settlement}
      letterhead={{
        name: company?.displayName || company?.legalName || "",
        address: addressLine(company?.headOfficeAddress) ?? "",
        pan: company?.panVatNumber ?? "",
        signatoryName: company?.signatory1Name ?? "",
        signatoryTitle: company?.signatory1Title ?? "",
      }}
    />
  );
}

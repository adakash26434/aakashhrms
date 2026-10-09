export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { getEvaluation } from "@/lib/services/evaluation.service";
import { getCompanyProfileSetup } from "@/lib/repositories/company-setup.repository";
import { addressLine } from "@/lib/constants/nepal-locations";
import { EvaluationPrint } from "@/components/evaluation/evaluation-print";

export const metadata: Metadata = {
  title: "Evaluation form | AakashHRMS",
  description: "Printable कार्य सम्पादन मूल्याङ्कन form.",
};

export default async function EvaluationPrintPage({ params }: { params: Promise<{ evaluationId: string }> }) {
  await ensureTenantContext();
  // VIEW and the employee in scope; anything else reads as not found.
  const scope = await checkPermissionWithScope("VIEW", "PERFORMANCE");
  const { evaluationId } = await params;
  const ctx = { userId: scope.userId, actorEmployeeId: scope.employeeId, scope };
  const [evaluation, company] = await Promise.all([getEvaluation(evaluationId, ctx), getCompanyProfileSetup().catch(() => null)]);
  if (!evaluation) notFound();
  return (
    <EvaluationPrint
      evaluation={evaluation}
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

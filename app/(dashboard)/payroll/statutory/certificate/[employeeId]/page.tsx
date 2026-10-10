export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { certificate } from "@/lib/services/statutory.service";
import { getCompanyProfileSetup } from "@/lib/repositories/company-setup.repository";
import { addressLine } from "@/lib/constants/nepal-locations";
import { TaxCertificatePrint } from "@/components/payroll/tax-certificate-print";

export const metadata: Metadata = {
  title: "Tax certificate | AakashHRMS",
  description: "Printable पारिश्रमिक कर कट्टी प्रमाणपत्र for one employee and fiscal year.",
};

export default async function TaxCertificatePage({ params, searchParams }: { params: Promise<{ employeeId: string }>; searchParams: Promise<{ fy?: string }> }) {
  await ensureTenantContext();
  // VIEW and the employee in scope; anything else reads as not found.
  const scope = await checkPermissionWithScope("VIEW", "REPORTS_TAX_IRD");
  const [{ employeeId }, { fy }] = await Promise.all([params, searchParams]);
  const [data, company] = await Promise.all([certificate({ userId: scope.userId, scope }, fy, employeeId), getCompanyProfileSetup().catch(() => null)]);
  if (!data) notFound();
  return (
    <TaxCertificatePrint
      certificate={data}
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

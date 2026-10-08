export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalaryStructureLetter } from "@/components/salary-mapping/salary-structure-letter";
import { getLetter } from "@/lib/services/salary-structure.service";
import { getCompanyProfileSetup } from "@/lib/repositories/company-setup.repository";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Salary revision | AakashHRMS",
  description: "Printable salary revision: the monthly breakdown, previous and revised.",
};

export default async function SalaryLetterPage({ params }: { params: Promise<{ revisionId: string }> }) {
  await ensureTenantContext();
  // VIEW and the employee in scope (S20); anything else reads as not found.
  const scope = await checkPermissionWithScope("VIEW", "SALARY_MAPPING");
  const { revisionId } = await params;
  const [letter, company] = await Promise.all([getLetter(revisionId, scope), getCompanyProfileSetup().catch(() => null)]);
  if (!letter) notFound();
  return <SalaryStructureLetter letter={letter} company={company} />;
}

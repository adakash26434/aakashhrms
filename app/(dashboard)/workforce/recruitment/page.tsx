export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { recruitmentPage } from "@/lib/services/recruitment.service";
import { RecruitmentClient } from "@/components/recruitment/recruitment-client";

export const metadata: Metadata = {
  title: "Recruitment | AakashHRMS",
  description: "दरबन्दी (approved positions), vacancies and the applicant merit list.",
};

export default async function RecruitmentPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "RECRUITMENT");
  const manage = await hasPermission("EDIT", "RECRUITMENT");
  const data = await recruitmentPage({ userId: scope.userId, scope }, { manage });
  return <RecruitmentClient data={data} />;
}

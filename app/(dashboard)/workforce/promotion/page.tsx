export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { promotionPage } from "@/lib/services/promotion.service";
import { PromotionClient } from "@/components/promotion/promotion-client";

export const metadata: Metadata = {
  title: "Promotion ranking | AakashHRMS",
  description: "बढुवा composite: evaluation, seniority and training, ranked per designation.",
};

export default async function PromotionPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "PERFORMANCE");
  const [editWeights, recordEvent, exportCsv] = await Promise.all([hasPermission("LOCK", "PERFORMANCE"), hasPermission("EDIT", "EMPLOYEES"), hasPermission("EXPORT", "PERFORMANCE")]);
  const data = await promotionPage(scope, { editWeights, recordEvent, export: exportCsv });
  return <PromotionClient data={data} />;
}

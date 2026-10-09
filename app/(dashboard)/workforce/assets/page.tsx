export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { assetsPage } from "@/lib/services/asset.service";
import { AssetsClient } from "@/components/assets/assets-client";

export const metadata: Metadata = {
  title: "Assets | AakashHRMS",
  description: "Company assets, handovers and returns.",
};

export default async function AssetsPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "ASSETS");
  const [add, manage] = await Promise.all([hasPermission("ADD", "ASSETS"), hasPermission("EDIT", "ASSETS")]);
  const data = await assetsPage({ userId: scope.userId, scope }, { add, manage });
  return <AssetsClient data={data} />;
}

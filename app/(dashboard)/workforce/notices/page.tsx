export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { noticesPage } from "@/lib/services/notice.service";
import { NoticesClient } from "@/components/notices/notices-client";

export const metadata: Metadata = {
  title: "Notice board | AakashHRMS",
  description: "Company, branch, department and individual notices shown on Home.",
};

export default async function NoticesPage() {
  await ensureTenantContext();
  const scope = await checkPermissionWithScope("VIEW", "NOTICE_BOARD");
  const [add, manage, withdraw] = await Promise.all([hasPermission("ADD", "NOTICE_BOARD"), hasPermission("EDIT", "NOTICE_BOARD"), hasPermission("DELETE", "NOTICE_BOARD")]);
  const data = await noticesPage({ userId: scope.userId, scope }, { add, manage, withdraw });
  return <NoticesClient data={data} />;
}

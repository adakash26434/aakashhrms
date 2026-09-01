export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getAuditLogData } from "@/lib/services/audit.service";
import { AuditClient } from "@/components/admin/audit/audit-client";
import { PageHeader } from "@/components/ui/page-header";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export default async function AuditLogPage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "AUDIT_LOG");

  const { logs, totalCount, kpis } = await getAuditLogData();

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <PageHeader
        title="Audit Trail & Security Log"
        description="Tamper-proof system audit logs capturing user actions, record state mutations, and configuration change history."
      />
      <Suspense fallback={<AuditLoadingSkeleton />}>
        <AuditClient
          initialLogs={logs}
          initialTotalCount={totalCount}
          initialKPIs={kpis}
        />
      </Suspense>
    </div>
  );
}

function AuditLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-gray-100" />
    </div>
  );
}

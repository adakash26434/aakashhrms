import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ensureTenantContext } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  getCurrentTenantContext,
  getRequestScopeTenantDb,
  setRequestScopeTenantDb,
  runWithTenantContext,
} from "@/lib/db/tenant-context";
import { getTenantDb } from "@/lib/db/tenant-pool-manager";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { getWorkspaceContext } from "@/lib/services/workspace-context.service";

import { auth } from "@/lib/auth";

// Dashboard pages depend on the database and the logged-in session, so they
// must be rendered on every request instead of being prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Check if a Super Admin is impersonating a company
  const impersonation = await getImpersonationSession();

  // 1. Forced password change redirect (applies to standard authenticated tenant users, not impersonation)
  if (!impersonation && session?.user?.mustChangePassword) {
    redirect("/change-password");
  }

  // 2. SELF-scoped users should never render the admin dashboard shell
  if (session?.user?.scopeType === "SELF") {
    redirect("/self-service");
  }

  if (impersonation) {
    // Impersonation mode: resolve the tenant DB from the impersonation session
    const tenantDb = await getTenantDb(impersonation.companySlug);

    if (tenantDb) {
      // Set the request-scope tenant DB so all downstream getDb() calls use it
      setRequestScopeTenantDb(impersonation.companySlug, tenantDb);

      return runWithTenantContext(
        { tenantSlug: impersonation.companySlug, db: tenantDb },
        async () => {
          const context = await getWorkspaceContext();
          return (
            <>
              <ImpersonationBanner
                actorName={impersonation.actorName}
                companyName={impersonation.companyName}
                companyId={impersonation.companyId}
              />
              <DashboardShell context={context}>{children}</DashboardShell>
            </>
          );
        }
      );
    }
  }

  // Normal tenant flow
  await ensureTenantContext();

  const currentCtx = getCurrentTenantContext();
  const reqScope = getRequestScopeTenantDb();

  const targetSlug = currentCtx?.tenantSlug || reqScope?.slug;
  const targetDb = currentCtx?.db || reqScope?.db;

  if (targetSlug && targetDb) {
    return runWithTenantContext(
      { tenantSlug: targetSlug, db: targetDb },
      async () => {
        const context = await getWorkspaceContext();
        return <DashboardShell context={context}>{children}</DashboardShell>;
      }
    );
  }

  const context = await getWorkspaceContext();
  return <DashboardShell context={context}>{children}</DashboardShell>;
}

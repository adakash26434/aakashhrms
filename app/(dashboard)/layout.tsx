import { AppFrame } from "@/components/frame/app-frame";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DATE_FORMAT_KEY, parseDateFormat } from "@/lib/utils/date-format-pref";
import { getTenantDb } from "@/lib/db/tenant-pool-manager";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { getWorkspaceContext } from "@/lib/services/workspace-context.service";
import { readWorkingPeriod } from "@/lib/utils/working-period.server";

import { auth } from "@/lib/auth";

// Dashboard pages depend on the database and the logged-in session, so they
// must be rendered on every request instead of being prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Super Admin "View company workspace" (verified, signed impersonation token)
  const impersonation = await getImpersonationSession();
  const dateFormat = parseDateFormat((await cookies()).get(DATE_FORMAT_KEY)?.value);

  if (impersonation) {
    const tenantDb = await getTenantDb(impersonation.companySlug);
    if (!tenantDb) {
      redirect("/tenant-not-found");
    }

    const context = await getWorkspaceContext();
    return (
      <AppFrame
        context={context}
        dateFormat={dateFormat}
        impersonation={{
          actorName: impersonation.actorName,
          companyName: impersonation.companyName,
          companyId: impersonation.companyId,
        }}
      >
        {children}
      </AppFrame>
    );
  }

  const session = await auth();

  // No valid impersonation and no session: never render the workspace.
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Forced password change applies to tenant users (not impersonation)
  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  // SELF-scoped users never render the admin dashboard shell
  if (session.user.scopeType === "SELF") {
    redirect("/self-service");
  }

  const [base, working] = await Promise.all([getWorkspaceContext(), readWorkingPeriod()]);
  const context = { ...base, payCalendar: working.calendar, workingPeriod: working.period };
  return (
    <AppFrame context={context} dateFormat={dateFormat}>
      {children}
    </AppFrame>
  );
}

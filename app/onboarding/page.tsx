export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Image from "next/image";
import { auth, signOut } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/services/onboarding.service";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ensureTenantContext } from "@/lib/db";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { getTenantDb } from "@/lib/db/tenant-pool-manager";
import { setRequestScopeTenantDb, runWithTenantContext } from "@/lib/db/tenant-context";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { LogOut, Building2 } from "lucide-react";

export const metadata = {
  title: "Company Setup Wizard | AakashHRMS",
  description: "Guided first-time organization onboarding setup wizard.",
};

export default async function OnboardingPage() {
  const impersonation = await getImpersonationSession();

  if (impersonation) {
    const tenantDb = await getTenantDb(impersonation.companySlug);
    if (tenantDb) {
      setRequestScopeTenantDb(impersonation.companySlug, tenantDb);
      return runWithTenantContext(
        { tenantSlug: impersonation.companySlug, db: tenantDb },
        async () => {
          const status = await getOnboardingStatus(impersonation.companyId, impersonation.companySlug);
          if (status.isCompleted) {
            redirect("/dashboard");
          }
          return (
            <div className="min-h-screen bg-payroll-cream flex flex-col">
              <ImpersonationBanner
                actorName={impersonation.actorName}
                companyName={impersonation.companyName}
                companyId={impersonation.companyId}
              />
              <header className="bg-white border-b border-payroll-light/80 px-6 py-4 flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden border border-payroll-light/60 bg-white shadow-xs">
                    <Image src="/AakashHrmsLogo.jpeg" alt="AakashHRMS" width={36} height={36} className="object-cover h-full w-full" priority unoptimized />
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-payroll-navy">AakashHRMS</h1>
                    <p className="text-[11px] text-gray-500 font-medium">First-Time Setup Wizard</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-payroll-navy bg-payroll-cream px-3 py-1.5 rounded-xl border border-payroll-light">
                  <Building2 className="w-4 h-4 text-payroll-primary" />
                  <span>{status.companyName || impersonation.companyName}</span>
                </div>
              </header>
              <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                <OnboardingWizard initialStatus={status} />
              </main>
            </div>
          );
        }
      );
    }
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await ensureTenantContext();
  const slug = session.user.tenantSlug || undefined;
  const status = await getOnboardingStatus(session.user.id, slug);

  if (status.isCompleted) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-payroll-cream flex flex-col">
      <header className="bg-white border-b border-payroll-light/80 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden border border-payroll-light/60 bg-white shadow-xs">
            <Image src="/AakashHrmsLogo.jpeg" alt="AakashHRMS" width={36} height={36} className="object-cover h-full w-full" priority unoptimized />
          </div>
          <div>
            <h1 className="text-base font-bold text-payroll-navy">AakashHRMS</h1>
            <p className="text-[11px] text-gray-500 font-medium">Organization Initial Setup Wizard</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold text-payroll-navy bg-payroll-cream px-3 py-1.5 rounded-xl border border-payroll-light">
            <Building2 className="w-4 h-4 text-payroll-primary" />
            <span>{status.companyName || "Organization Setup"}</span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="flex items-center space-x-1.5 text-xs font-semibold text-gray-600 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-payroll-light hover:border-rose-200 hover:bg-rose-50 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <OnboardingWizard initialStatus={status} />
      </main>
    </div>
  );
}

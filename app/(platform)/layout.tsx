import React from "react";
import Link from "next/link";
import Image from "next/image";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  FileText,
  Activity,
  Layers,
  ChevronRight,
} from "lucide-react";
import { PlatformLogoutButton } from "@/components/platform/platform-logout-button";
import {
  verifyPlatformSession,
  PLATFORM_COOKIE_NAME,
} from "@/lib/platform/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Super Admin Control Plane | AakashHRMS",
  description: "Super Admin Multi-Tenant SaaS Control Plane for AakashHRMS",
};

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  // Never block or redirect on the platform login page itself
  if (pathname.includes("/platform/login") || pathname.endsWith("/login")) {
    return <>{children}</>;
  }

  // Verify the platform session JWT against the database — not just cookie presence
  const platformUser = await verifyPlatformSession();

  if (!platformUser) {
    // Clear stale/invalid cookie before redirecting
    const cookieStore = await cookies();
    cookieStore.delete(PLATFORM_COOKIE_NAME);
    redirect("/platform/login");
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-payroll-cream text-payroll-navy font-sans">
      {/* Platform Top Header */}
      <header className="h-16 border-b border-white/10 bg-payroll-navy px-6 flex items-center justify-between shrink-0 z-50 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-white overflow-hidden flex items-center justify-center shadow-lg shadow-payroll-primary/30 border border-white/20">
            <Image
              src="/AakashHrmsLogo.jpeg"
              alt="AakashHRMS Control Plane"
              width={40}
              height={40}
              className="object-cover h-full w-full"
              priority
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">
                AakashHRMS
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-payroll-primary text-white border border-white/20 font-semibold shadow-sm">
                Control Plane
              </span>
            </div>
            <p className="text-xs text-emerald-200/80">
              Super Admin Multi-Tenant Console
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs text-emerald-100 bg-payroll-primary/40 px-3 py-1.5 rounded-md border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Platform Online</span>
          </div>

          <div className="h-4 w-px bg-white/10"></div>

          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-payroll-primary text-white font-semibold text-xs flex items-center justify-center border border-white/20 shadow">
              SA
            </div>
            <span className="text-sm font-medium text-white">Super Admin</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 bg-payroll-navy border-r border-white/10 flex flex-col justify-between p-4 shrink-0 text-white h-full overflow-y-auto">
          <div className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold text-emerald-300/60 uppercase tracking-wider">
              Management
            </div>

            <Link
              href="/platform"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-100 hover:text-white hover:bg-payroll-primary transition-all group shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <Activity className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                <span>Overview</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-300/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <Link
              href="/platform/companies"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-100 hover:text-white hover:bg-payroll-primary transition-all group shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <Building2 className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                <span>Tenant Companies</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-300/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <div className="px-3 pt-4 py-2 text-[10px] font-semibold text-emerald-300/60 uppercase tracking-wider">
              Governance
            </div>

            <Link
              href="/platform/policies"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-emerald-100 hover:text-white hover:bg-payroll-primary transition-all group shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <Layers className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                <span>Statutory Policy Packs</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-300/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <Link
              href="/platform/audit"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-emerald-100 hover:text-white hover:bg-payroll-primary transition-all group shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                <span>Platform Audit Logs</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-300/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>

          <div className="pt-4 border-t border-white/10 mt-auto">
            <PlatformLogoutButton />
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 min-w-0 p-8 bg-payroll-cream overflow-y-auto h-full">
          {children}
        </main>
      </div>
    </div>
  );
}

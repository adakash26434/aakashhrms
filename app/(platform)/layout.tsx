import React from "react";
import Image from "next/image";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shield, Sparkles } from "lucide-react";
import { PlatformLogoutButton } from "@/components/platform/platform-logout-button";
import { PlatformNav } from "@/components/platform/platform-nav";
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
    <div className="h-screen flex flex-col overflow-hidden bg-payroll-cream text-payroll-navy font-sans select-none">
      {/* Platform Top Header */}
      <header className="h-15 border-b border-white/10 bg-payroll-navy px-5 sm:px-6 flex items-center justify-between shrink-0 z-40 shadow-payroll-sm">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-white overflow-hidden flex items-center justify-center shadow-2xs border border-white/20">
            <Image
              src="/AakashHrmsLogo.jpeg"
              alt="AakashHRMS Control Plane"
              width={36}
              height={36}
              className="object-cover h-full w-full"
              priority
              unoptimized
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-white">
                AakashHRMS
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-payroll-primary text-white border border-white/20 shadow-2xs">
                Control Plane
              </span>
            </div>
            <p className="text-[11px] text-payroll-light/80 font-medium">
              Super Admin Multi-Tenant Console
            </p>
          </div>
        </div>

        {/* Status Indicators & Super Admin Profile */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 text-xs text-emerald-100 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-[11px]">PostgreSQL Engine Online</span>
          </div>

          <div className="h-4 w-px bg-white/15 hidden sm:block"></div>

          <div className="flex items-center space-x-2.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1">
            <div className="w-7 h-7 rounded-lg bg-payroll-primary text-white font-bold text-xs flex items-center justify-center border border-white/20 shadow-2xs">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div className="hidden md:block text-left">
              <span className="text-xs font-bold text-white block leading-tight">
                {platformUser.name || "Super Admin"}
              </span>
              <span className="text-[10px] text-payroll-light/80 block leading-tight">
                Root Authority
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-65 bg-payroll-navy border-r border-white/10 flex flex-col justify-between p-3.5 shrink-0 text-white h-full overflow-y-auto shadow-payroll-md">
          <PlatformNav />

          <div className="pt-3 border-t border-white/10 mt-auto">
            <PlatformLogoutButton />
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 min-w-0 p-6 sm:p-8 bg-payroll-cream overflow-y-auto h-full">
          {children}
        </main>
      </div>
    </div>
  );
}

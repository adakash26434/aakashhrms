"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, UserCircle, Shield } from "lucide-react";
import { logoutAction } from "@/app/actions/auth.actions";
import { cn } from "@/lib/utils";

interface SelfServiceNavProps {
  userEmail: string;
  scopeType: string;
}

const NAV_ITEMS = [
  { href: "/self-service", label: "Dashboard", exact: true },
  { href: "/self-service/my-profile", label: "My Profile" },
  { href: "/self-service/my-payslips", label: "Payslips" },
  { href: "/self-service/my-leave", label: "Leave" },
  { href: "/self-service/my-attendance", label: "Attendance" },
  { href: "/self-service/my-loans", label: "Loans" },
];

export function SelfServiceNav({ userEmail, scopeType }: SelfServiceNavProps) {
  const pathname = usePathname();
  const isManagerOrAdmin = scopeType !== "SELF";

  return (
    <nav className="sticky top-0 z-40 border-b border-payroll-light/80 bg-white/95 backdrop-blur-md shadow-payroll-xs">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-15 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/self-service"
              className="text-base font-bold text-payroll-navy tracking-tight flex items-center gap-2.5 group"
            >
              <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl overflow-hidden border border-payroll-light/80 bg-white shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                <Image
                  src="/AakashHrmsLogo.jpeg"
                  alt="AakashHRMS"
                  width={34}
                  height={34}
                  className="object-cover h-full w-full"
                  unoptimized
                />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xs font-bold text-payroll-navy">
                  AakashHRMS
                </span>
                <span className="text-[10px] text-payroll-primary font-bold mt-0.5">
                  Self-Service Portal
                </span>
              </div>
            </Link>

            {/* Navigation tabs */}
            <div className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 select-none",
                      isActive
                        ? "bg-payroll-primary text-white shadow-payroll-xs"
                        : "text-gray-600 hover:text-payroll-navy hover:bg-payroll-cream",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* If Admin/Manager is in self-service mode, show button to return to Admin Dashboard */}
            {isManagerOrAdmin && (
              <Link
                href="/dashboard"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-payroll-navy bg-payroll-cream hover:bg-payroll-light/80 rounded-xl border border-payroll-light transition-all shadow-2xs"
              >
                <Shield className="h-3.5 w-3.5 text-payroll-primary" />
                <span>Office Workspace</span>
              </Link>
            )}

            {/* User pill */}
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-payroll-cream px-2.5 py-1.5 rounded-xl border border-payroll-light/80 shadow-2xs">
              <UserCircle className="h-4 w-4 text-payroll-primary" />
              <span
                className="hidden sm:inline-block font-bold text-payroll-navy truncate max-w-36 text-xs"
                title={userEmail}
              >
                {userEmail}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={() => logoutAction()}
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
              title="Sign out of your account"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex sm:hidden overflow-x-auto py-2 gap-1 border-t border-payroll-light/60 scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap px-3 py-1 text-xs font-semibold rounded-lg transition-colors select-none",
                  isActive
                    ? "bg-payroll-primary text-white shadow-payroll-xs"
                    : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

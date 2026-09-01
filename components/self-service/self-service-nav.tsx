"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, UserCircle, Shield, Sparkles } from "lucide-react";
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
    <nav className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-md shadow-xs">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/self-service"
              className="text-base font-bold text-payroll-navy tracking-tight flex items-center gap-2.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-emerald-200/80 bg-white shadow-2xs shrink-0">
                <Image
                  src="/AakashHrmsLogo.jpeg"
                  alt="AakashHRMS"
                  width={32}
                  height={32}
                  className="object-cover h-full w-full"
                  unoptimized
                />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xs font-bold text-payroll-navy">
                  AakashHRMS
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  Self-Service
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
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                      isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs"
                        : "text-gray-600 hover:text-payroll-navy hover:bg-gray-100/70",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* If Admin/Manager is in self-service mode, show button to return to Admin Dashboard */}
            {isManagerOrAdmin && (
              <Link
                href="/dashboard"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-lg border border-emerald-200 transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Admin Workspace</span>
              </Link>
            )}

            {/* User pill */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <UserCircle className="h-4 w-4 text-emerald-600" />
              <span
                className="hidden sm:inline-block font-medium truncate max-w-35"
                title={userEmail}
              >
                {userEmail}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={() => logoutAction()}
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Sign out of your account"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex sm:hidden overflow-x-auto py-2 gap-1 border-t border-gray-100 scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "text-gray-600 hover:bg-gray-100",
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

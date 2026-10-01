"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Banknote, CalendarDays, ChevronDown, Clock3, FileText, Home, LogOut, MoreHorizontal, Shield, UserCircle } from "lucide-react";
import { logoutAction } from "@/app/actions/auth.actions";
import { cn } from "@/lib/utils";

interface SelfServiceNavProps {
  userEmail: string;
  scopeType: string;
}

const NAV_ITEMS = [
  { href: "/self-service", label: "Home", exact: true, icon: Home },
  { href: "/self-service/my-attendance", label: "Attendance", icon: Clock3 },
  { href: "/self-service/my-leave", label: "Leave", icon: CalendarDays },
  { href: "/self-service/my-payslips", label: "Payslips", icon: FileText },
  { href: "/self-service/my-profile", label: "Profile", icon: UserCircle },
  { href: "/self-service/my-loans", label: "Loans", icon: Banknote },
];

const MOBILE_PRIMARY_ITEMS = NAV_ITEMS.slice(0, 4);
const SECONDARY_ITEMS = NAV_ITEMS.slice(4);

export function SelfServiceNav({ userEmail, scopeType }: SelfServiceNavProps) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isManagerOrAdmin = scopeType !== "SELF";

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-payroll-border bg-white sm:flex">
        <div className="flex min-h-16 items-center border-b border-payroll-border px-5">
          <Link href="/self-service" className="flex items-center gap-2.5 text-base font-bold tracking-tight text-payroll-navy">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-payroll-border bg-white shadow-2xs">
              <Image src="/AakashHrmsLogo.jpeg" alt="AakashHRMS" width={36} height={36} className="h-full w-full object-cover" unoptimized />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold">AakashHRMS</span>
              <span className="mt-1 text-[10px] font-bold text-payroll-primary">Self-Service Portal</span>
            </div>
          </Link>
        </div>
        <div className="flex flex-1 flex-col px-3 py-5">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-payroll-text-muted">My workspace</p>
          <div className="mt-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-xs font-semibold transition-colors", isActive ? "bg-payroll-primary-light text-payroll-primary" : "text-payroll-navy/70 hover:bg-payroll-cream hover:text-payroll-navy")}>
                  <Icon className={cn("h-4 w-4", isActive && "stroke-[2.5]")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-auto border-t border-payroll-border pt-4">
            {isManagerOrAdmin && <Link href="/dashboard" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-xs font-semibold text-payroll-navy/70 hover:bg-payroll-cream hover:text-payroll-navy"><Shield className="h-4 w-4 text-payroll-primary" /><span>Office Workspace</span></Link>}
          </div>
        </div>
      </aside>
      <nav className="sticky top-0 z-40 border-b border-payroll-border bg-white/95 backdrop-blur-xs shadow-payroll-xs sm:pl-64">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-15 items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-6">
            <Link
              href="/self-service"
              className="flex items-center gap-2 sm:hidden"
              aria-label="AakashHRMS Self-Service home"
            >
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-payroll-border bg-white shadow-2xs">
                <Image
                  src="/AakashHrmsLogo.jpeg"
                  alt="AakashHRMS"
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </span>
              <span className="text-xs font-bold tracking-tight text-payroll-navy">AakashHRMS</span>
            </Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* If Admin/Manager is in self-service mode, show button to return to Admin Dashboard */}
            {isManagerOrAdmin && (
              <Link
                href="/dashboard"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-payroll-navy bg-payroll-cream hover:bg-payroll-primary-light rounded-xl border border-payroll-border transition-all shadow-2xs"
              >
                <Shield className="h-3.5 w-3.5 text-payroll-primary" />
                <span>Office Workspace</span>
              </Link>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileOpen((open) => !open)}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-payroll-border bg-payroll-cream px-2.5 py-1.5 text-xs font-semibold text-payroll-navy shadow-2xs transition-colors hover:border-payroll-primary/40 hover:bg-payroll-primary-light"
                aria-expanded={isProfileOpen}
                aria-label="Open account menu"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-payroll-primary text-[10px] font-bold text-white">
                  {userEmail.slice(0, 1).toUpperCase()}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-payroll-text-muted transition-transform", isProfileOpen && "rotate-180")} />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-payroll-border bg-white p-1.5 shadow-payroll-md">
                  <div className="border-b border-payroll-border/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-payroll-text-muted">Signed in as</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-payroll-navy" title={userEmail}>{userEmail}</p>
                  </div>
                  <Link href="/self-service/my-profile" onClick={() => setIsProfileOpen(false)} className="mt-1 flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-payroll-navy/80 hover:bg-payroll-cream hover:text-payroll-navy">
                    <UserCircle className="h-4 w-4 text-payroll-primary" />
                    <span>My Profile</span>
                  </Link>
                  <button onClick={() => logoutAction()} type="button" className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile navigation keeps the four most common destinations within thumb reach. */}
        <div className="fixed inset-x-0 bottom-0 z-60 flex h-16 items-stretch border-t border-payroll-light bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(17,24,39,0.08)] backdrop-blur-md sm:hidden">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors select-none",
                  isActive
                    ? "text-payroll-primary"
                    : "text-gray-500 hover:bg-payroll-cream hover:text-payroll-navy",
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "stroke-[2.5]")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="relative flex min-w-0 flex-1">
            {isMoreOpen && (
              <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-2 z-70 w-48 rounded-xl border border-payroll-border bg-white p-1.5 shadow-payroll-md">
                {SECONDARY_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMoreOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold",
                        isActive
                          ? "bg-payroll-primary-light text-payroll-primary"
                          : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsMoreOpen((open) => !open)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors select-none",
                isMoreOpen || SECONDARY_ITEMS.some((item) => pathname.startsWith(item.href))
                  ? "text-payroll-primary"
                  : "text-gray-500 hover:bg-payroll-cream hover:text-payroll-navy",
              )}
              aria-expanded={isMoreOpen}
              aria-label="More self-service options"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span>More</span>
            </button>
          </div>
        </div>
      </div>
      </nav>
    </>
  );
}

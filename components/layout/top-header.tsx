"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  Building2,
  CalendarDays,
  Search,
  ChevronDown,
  LogOut,
  Wallet,
  UserCircle,
  KeyRound,
  Shield,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { DateFormatMenu } from "@/components/ui/date-format-menu";
import { logoutAction } from "@/app/actions/auth.actions";
import { cn } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";

interface TopHeaderProps {
  context?: WorkspaceContext;
}

export function TopHeader({ context }: TopHeaderProps) {
  const companyName = context?.company.name || "Company Workspace";
  const companyCode = context?.company.code || "CMP-ACTIVE";
  const branchName = context?.company.branch || "Head Office";
  const activeFy = context?.activeFiscalYear.name || "FY 2081/82";
  const userName = context?.user.name || "Administrator";
  const userEmail = context?.user.email || "";
  const userRole = context?.user.role || "Office Administrator";
  const userInitials = context?.user.initials || "AD";
  const pendingCount = context?.pendingApprovalsCount || 0;
  const isImpersonating = context?.isImpersonating || false;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  return (
    <header className="flex h-14.5 shrink-0 items-center gap-3 border-b border-payroll-light bg-white px-5 relative z-30">
      {/* Brand / Crumb */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex items-center gap-2.5 text-sm text-payroll-navy">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border border-payroll-light/60 bg-white shadow-2xs shrink-0">
            <Image
              src="/AakashHrmsLogo.jpeg"
              alt="AakashHRMS"
              width={28}
              height={28}
              className="object-cover h-full w-full"
            />
          </div>
          <span className="font-bold text-payroll-navy">AakashHRMS</span>
          <span className="text-gray-300">/</span>
          <span
            className="text-xs font-semibold text-payroll-primary bg-payroll-cream px-2 py-0.5 rounded border border-payroll-light truncate max-w-40"
            title={companyName}
          >
            {companyName}
          </span>
        </div>
      </div>

      {/* Global Quick Search */}
      <div className="mx-auto hidden max-w-md flex-1 lg:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-payroll-primary/50" />
          <input
            type="search"
            placeholder="Search employees, payroll runs, leaves..."
            className="w-full rounded-xl border border-payroll-light bg-payroll-cream py-1.5 pl-9 pr-10 text-xs text-payroll-navy placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all"
          />
        </div>
      </div>

      {/* Dynamic Actions & Live Badges */}
      <div className="ml-auto flex items-center gap-2">
        {/* Global BS | AD date format toggle */}
        <DateFormatMenu size="sm" className="mr-1" />

        {/* Active Fiscal Year Pill */}
        <Link
          href="/setup/fiscal-year"
          title="Active Fiscal Year (Click to manage)"
          className="hidden items-center gap-1.5 rounded-xl border border-payroll-light bg-payroll-cream px-2.5 py-1.5 text-xs font-semibold text-payroll-navy hover:bg-white transition-all sm:flex shadow-2xs"
        >
          <CalendarDays className="h-3.5 w-3.5 text-payroll-primary" />
          <span>{activeFy}</span>
        </Link>

        {/* Active Company Pill */}
        <Link
          href="/setup/company"
          title={`Company Code: ${companyCode}`}
          className="hidden items-center gap-1.5 rounded-xl border border-payroll-light bg-payroll-cream px-2.5 py-1.5 text-xs font-semibold text-payroll-navy hover:bg-white transition-all md:flex shadow-2xs"
        >
          <Building2 className="h-3.5 w-3.5 text-payroll-primary" />
          <span className="truncate max-w-35">{companyName}</span>
        </Link>

        {/* Pending Approvals Notification Bell */}
        <Link
          href="/timeAndLeave/leave/approvals"
          title={
            pendingCount > 0
              ? `${pendingCount} pending leave approval(s)`
              : "No pending approvals"
          }
          className="relative rounded-xl p-2 text-payroll-navy hover:bg-payroll-cream transition-all border border-transparent hover:border-payroll-light"
          aria-label="Pending Approvals"
        >
          <Bell className="h-4.5 w-4.5 text-payroll-primary" />
          {pendingCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs animate-in zoom-in">
              {pendingCount}
            </span>
          )}
        </Link>

        {/* Interactive Authenticated User Profile Dropdown */}
        <div
          className="relative border-l border-payroll-light pl-3"
          ref={dropdownRef}
        >
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl p-1.5 transition-all text-left cursor-pointer select-none",
              isDropdownOpen
                ? "bg-payroll-cream ring-1 ring-payroll-light"
                : "hover:bg-payroll-cream/80",
            )}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
            aria-label="User account menu"
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm transition-transform",
                isImpersonating
                  ? "bg-amber-600 ring-2 ring-amber-300"
                  : "bg-payroll-primary",
                isDropdownOpen && "scale-105",
              )}
              title={userName}
            >
              {userInitials}
            </div>
            <div className="hidden lg:block text-left">
              <div
                className="text-xs font-bold text-payroll-navy leading-tight truncate max-w-35"
                title={userName}
              >
                {userName}
              </div>
              <div className="text-[10px] text-gray-500 leading-tight truncate max-w-35">
                {userRole}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isDropdownOpen && "rotate-180 text-payroll-primary",
              )}
            />
          </button>

          {/* User Profile Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-150 z-50">
              {/* Header: User Summary */}
              <div className="rounded-xl bg-linear-to-br from-gray-50 via-payroll-cream/40 to-emerald-50/20 p-3.5 mb-1.5 border border-payroll-light/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-payroll-primary text-sm font-bold text-white shadow-sm">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-bold text-payroll-navy truncate"
                      title={userName}
                    >
                      {userName}
                    </p>
                    {userEmail && (
                      <p
                        className="text-[11px] text-gray-500 truncate"
                        title={userEmail}
                      >
                        {userEmail}
                      </p>
                    )}
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100/70 text-emerald-800 border border-emerald-200/50">
                      {userRole}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
                  <div
                    className="flex items-center gap-1.5 truncate max-w-50"
                    title={`${companyName} (${companyCode})`}
                  >
                    <Building2 className="h-3 w-3 text-payroll-primary shrink-0" />
                    <span className="truncate">{companyName}</span>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 shrink-0">
                    {branchName}
                  </span>
                </div>
              </div>

              {/* Main Navigation Links */}
              <div className="space-y-0.5 py-1">
                {/* 1. Self-Service Portal */}
                <Link
                  href="/self-service"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs text-gray-700 hover:bg-emerald-50/80 hover:text-emerald-950 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                      <Wallet className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-950">
                        My Self-Service
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Payslips, leaves, attendance & loans
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>

                {/* 2. Personal Profile */}
                <Link
                  href="/self-service/my-profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-gray-700 hover:bg-payroll-cream/80 hover:text-payroll-navy transition-colors group cursor-pointer"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <UserCircle className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">My Profile</p>
                    <p className="text-[10px] text-gray-500">
                      Personal & employment info
                    </p>
                  </div>
                </Link>

                {/* 3. Security & Password */}
              </div>

              {/* Divider */}
              <div className="my-1 border-t border-gray-100" />

              {/* Sign Out Action */}
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  logoutAction();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-rose-600 hover:bg-rose-50/80 hover:text-rose-700 transition-colors cursor-pointer group"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100/60 text-rose-600 group-hover:bg-rose-100 transition-colors">
                  <LogOut className="h-3.5 w-3.5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-rose-700">Sign Out</p>
                  <p className="text-[10px] text-rose-500">
                    End current active session
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

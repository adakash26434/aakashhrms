"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  MoreHorizontal,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { NAV_GROUPS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  context?: WorkspaceContext;
}

function FadeContent({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        collapsed
          ? "max-w-0 -translate-x-px transition-all duration-300 opacity-0"
          : "max-w-50 translate-x-0 transition-all duration-300 opacity-100",
      )}
    >
      {children}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle, context }: SidebarProps) {
  const pathname = usePathname();

  const companyName = context?.company.name || "Company Workspace";
  const companyCode = context?.company.code || "CMP-ACTIVE";
  const branchName = context?.company.branch || "Head Office";
  const isImpersonating = context?.isImpersonating || false;

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col bg-payroll-navy text-white transition-all duration-300 ease-in-out",
        collapsed ? "w-18" : "w-65",
      )}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          "absolute z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-payroll-primary text-white shadow-md transition-all duration-300 ease-in-out hover:scale-105 hover:bg-[#2c5a8c] active:scale-95",
          collapsed ? "right-0.5 top-3 translate-x-1/2" : "-right-3 top-3",
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <div className="relative h-4 w-4">
          <Menu
            className={cn(
              "absolute inset-0 h-4 w-4 transition-all duration-300 ease-in-out",
              collapsed
                ? "rotate-0 opacity-100 scale-100"
                : "rotate-90 opacity-0 scale-75",
            )}
          />
          <X
            className={cn(
              "absolute text-red-500 inset-0 h-4 w-4 transition-all duration-300 ease-in-out",
              collapsed
                ? "-rotate-90 opacity-0 scale-75"
                : "rotate-0 opacity-100 scale-100",
            )}
          />
        </div>
      </button>

      {/* Brand */}
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-5 transition-all duration-300 ease-in-out",
          collapsed ? "justify-center px-2" : "justify-start",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs border border-white/20">
          <Image
            src="/AakashHrmsLogo.jpeg"
            alt="AakashHRMS"
            width={36}
            height={36}
            className="object-cover h-full w-full"
            priority
          />
        </div>
        <FadeContent collapsed={collapsed}>
          <div className="whitespace-nowrap">
            <div className="text-[15px] font-semibold leading-tight text-white">
              AakashHRMS
            </div>
            <div className="text-[11px] text-white/45">HR & Payroll System</div>
          </div>
        </FadeContent>
      </div>

      {/* Workspace card */}
      <div className={cn("px-4 pb-4", collapsed && "px-2")}>
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            collapsed ? "mb-0 max-h-0 opacity-0" : "mb-2 max-h-8 opacity-100",
          )}
        >
          <div className="flex items-center justify-between px-1">
            <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              Active Company
            </p>
            {isImpersonating && (
              <span className="text-[9px] font-bold text-amber-300 uppercase tracking-tight">
                Viewing Mode
              </span>
            )}
          </div>
        </div>
        <div
          className={cn(
            "flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/6 transition-all duration-300 ease-in-out",
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2.5",
          )}
        >
          <div
            className={cn(
              "flex items-center min-w-0",
              collapsed ? "gap-0" : "gap-2.5",
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-payroll-primary/25">
              <Building2 className="h-3.5 w-3.5 text-payroll-light" />
            </div>
            <FadeContent collapsed={collapsed}>
              <div className="min-w-0 whitespace-nowrap text-left">
                <div
                  className="text-[13px] font-medium text-white truncate max-w-40"
                  title={companyName}
                >
                  {companyName}
                </div>
                <div className="text-[11px] text-white/40 truncate max-w-40">
                  {companyCode} · {branchName}
                </div>
              </div>
            </FadeContent>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          // Filter items by user's allowed modules
          const allowedModules = context?.allowedModules || [];
          const isFullAccess = context?.isImpersonating || allowedModules.length === 0;
          
          const visibleItems = group.items.filter((item) => {
            // Items without requiredModule (e.g. Dashboard) are always visible
            if (!item.requiredModule) return true;
            // Full access users (admins, impersonation) see everything
            if (isFullAccess) return true;
            // Check if user has VIEW permission for this module
            return allowedModules.includes(item.requiredModule);
          });

          // Hide entire group if no visible items
          if (visibleItems.length === 0) return null;

          return (
          <div key={group.label} className="mb-5">
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                collapsed
                  ? "mb-0 max-h-0 opacity-0"
                  : "mb-2 max-h-8 opacity-100",
              )}
            >
              <p className="whitespace-nowrap px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                {group.label}
              </p>
            </div>
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95",
                      collapsed
                        ? "justify-center px-0 py-2"
                        : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-payroll-primary text-white shadow-sm"
                        : "text-white/60 hover:bg-white/6 hover:text-white/90",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4.25 w-4.25 shrink-0 transition-colors duration-200",
                        isActive ? "text-white" : "text-white/50",
                      )}
                    />
                    <div
                      className={cn(
                        "flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out",
                        collapsed
                          ? "max-w-0 opacity-0"
                          : "max-w-50 opacity-100",
                      )}
                    >
                      <span className="truncate whitespace-nowrap">
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-white/10 text-white/70",
                          )}
                        >
                          {item.badge.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>
    </aside>
  );
}

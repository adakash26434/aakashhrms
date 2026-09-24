"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  PanelLeftOpen,
  Pin,
  PinOff,
} from "lucide-react";
import { NAV_GROUPS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";

interface SidebarProps {
  collapsed?: boolean;
  isPinned?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  onTogglePin?: () => void;
  context?: WorkspaceContext;
}

export function Sidebar({
  collapsed = false,
  isPinned = true,
  isExpanded: isExpandedProp,
  onToggle,
  onTogglePin,
  context,
}: SidebarProps) {
  const pathname = usePathname();

  // Track open/collapsed state for each navigation section
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    return new Set(NAV_GROUPS.map((g) => g.label));
  });

  // Auto-expand the section containing the active route whenever pathname changes
  useEffect(() => {
    NAV_GROUPS.forEach((group) => {
      const isGroupRoot = group.href && (pathname === group.href || pathname.startsWith(`${group.href}/`));
      const hasActive = group.items.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      );
      if (hasActive || isGroupRoot) {
        setOpenSections((prev) => new Set(prev).add(group.label));
      }
    });
  }, [pathname]);

  const toggleSection = (label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const isExpanded = isExpandedProp !== undefined ? isExpandedProp : !collapsed;
  const isCollapsed = !isExpanded;

  const companyName = context?.company.name || "Company Workspace";
  const companyCode = context?.company.code || "CMP-ACTIVE";
  const branchName = context?.company.branch || "Head Office";
  const isImpersonating = context?.isImpersonating || false;

  const allowedModules = context?.allowedModules || [];
  const isFullAccess = context?.isImpersonating || allowedModules.length === 0;

  return (
    <div
      className={cn(
        "relative flex h-full w-full shrink-0 flex-col bg-white text-gray-900 select-none",
        "transition-[width] duration-200 ease-in-out will-change-[width]",
      )}
      aria-label="Sidebar Navigation"
    >
      {/* Brand Header Row with Pin / Unpin Action */}
      <div className="flex h-14 shrink-0 items-center justify-between px-3.5 border-b border-payroll-border">
        <div
          className={cn(
            "flex items-center gap-2.5 min-w-0 transition-all duration-200",
            isCollapsed ? "justify-center w-full" : "justify-start flex-1",
          )}
        >
          <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-2xs border border-payroll-border">
            <Image
              src="/AakashHrmsLogo.jpeg"
              alt="AakashHRMS"
              width={34}
              height={34}
              className="object-cover h-full w-full"
              priority
              unoptimized
            />
          </div>
          {isExpanded && (
            <div className="overflow-hidden min-w-0">
              <div className="whitespace-nowrap truncate">
                <div className="text-[14px] font-bold tracking-tight leading-tight text-gray-900">
                  AakashHRMS
                </div>
                <div className="text-[10px] text-gray-500 font-medium truncate">
                  HR & Payroll Nepal
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pin / Unpin Button */}
        {isExpanded && (
          <button
            type="button"
            onClick={onTogglePin || onToggle}
            title={isPinned ? "Unpin sidebar (auto-collapse on hover out)" : "Pin sidebar open"}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 ml-1",
              isPinned
                ? "border-payroll-primary/30 bg-payroll-primary-light text-payroll-primary shadow-2xs hover:bg-payroll-primary-light/80"
                : "border-payroll-border bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-900"
            )}
            aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {isPinned ? (
              <Pin className="h-3.5 w-3.5 fill-payroll-primary text-payroll-primary rotate-45" />
            ) : (
              <PinOff className="h-3.5 w-3.5 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Active Workspace Company Pill */}
      <div className={cn("px-3 pt-3 pb-2 transition-all duration-200", isCollapsed && "px-2")}>
        {isExpanded && (
          <div className="mb-1.5 flex items-center justify-between px-1">
            <p className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">
              Active Company
            </p>
            {isImpersonating && (
              <span className="text-[9px] font-bold text-amber-700 uppercase tracking-tight bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Super Admin
              </span>
            )}
          </div>
        )}
        <div
          className={cn(
            "flex w-full items-center rounded-xl border border-payroll-border bg-[#F9FAFB] transition-all duration-200",
            isCollapsed ? "justify-center px-1.5 py-2" : "px-3 py-2",
          )}
          title={`${companyName} (${companyCode}) · ${branchName}`}
        >
          <div
            className={cn(
              "flex items-center min-w-0",
              isCollapsed ? "gap-0" : "gap-2.5",
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-payroll-primary-light text-payroll-primary border border-payroll-primary-border shadow-2xs">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            {isExpanded && (
              <div className="min-w-0 whitespace-nowrap text-left">
                <div className="text-xs font-semibold text-gray-900 truncate max-w-40">
                  {companyName}
                </div>
                <div className="text-[10px] text-gray-500 truncate max-w-40 font-mono">
                  {companyCode} · {branchName}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Groups with Dropdown Accordion Sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-200">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!item.requiredModule && (!item.requiredModules || item.requiredModules.length === 0)) {
              return true;
            }
            if (isFullAccess) return true;
            if (item.requiredModules && item.requiredModules.length > 0) {
              return item.requiredModules.some((m) => allowedModules.includes(m));
            }
            return item.requiredModule ? allowedModules.includes(item.requiredModule) : true;
          });

          if (visibleItems.length === 0) return null;

          const isOverview = group.label === "Overview";
          const isSectionOpen = isOverview || openSections.has(group.label);

          const hasActiveChild = visibleItems.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
          );

          return (
            <div key={group.label} className="space-y-0.5">
              {/* Section Header (when expanded) */}
              {!isOverview && isExpanded && (
                <div className="mb-0.5">
                  {group.href ? (
                    <div
                      className={cn(
                        "flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200 rounded-lg",
                        pathname === group.href
                          ? "bg-payroll-primary-light text-payroll-primary"
                          : hasActiveChild
                            ? "text-gray-900 font-bold hover:bg-gray-50"
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      <Link
                        href={group.href}
                        title={`Open ${group.label} Overview`}
                        className={cn(
                          "truncate flex-1 text-left cursor-pointer transition-colors",
                          pathname === group.href
                            ? "text-payroll-primary font-extrabold"
                            : "hover:text-gray-900",
                        )}
                      >
                        {group.label}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => toggleSection(group.label, e)}
                        title={`Toggle ${group.label} section`}
                        className="p-0.5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer rounded"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                            isSectionOpen && "rotate-180 text-payroll-primary",
                          )}
                        />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => toggleSection(group.label, e)}
                      className={cn(
                        "flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200 rounded-lg cursor-pointer select-none",
                        hasActiveChild
                          ? "text-gray-900 hover:text-black hover:bg-gray-50 font-bold"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      <span className="truncate">{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-gray-400",
                          isSectionOpen && "rotate-180 text-payroll-primary",
                        )}
                      />
                    </button>
                  )}
                </div>
              )}

              {/* Items List */}
              {(isOverview || !isExpanded || isSectionOpen) && (
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
                        title={isCollapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center rounded-xl text-xs font-medium select-none cursor-pointer overflow-hidden",
                          "transition-all duration-150",
                          isCollapsed
                            ? "justify-center h-10 w-full px-0"
                            : "gap-2.5 px-3 py-2",
                          isActive
                            ? "bg-payroll-primary-light text-payroll-primary font-semibold border border-payroll-primary-border shadow-xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-payroll-primary"
                            : "text-gray-600 hover:bg-[#F9FAFB] hover:text-gray-900 active:scale-[0.98]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-all duration-150",
                            isActive
                              ? "text-payroll-primary scale-105"
                              : "text-gray-400 group-hover:text-gray-600 group-hover:scale-110",
                          )}
                        />
                        {isExpanded && (
                          <div className="flex items-center justify-between flex-1 min-w-0 overflow-hidden">
                            <span className="truncate whitespace-nowrap text-xs">
                              {item.label}
                            </span>
                            {item.badge !== undefined && (
                              <span
                                className={cn(
                                  "ml-1.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold font-mono transition-colors",
                                  isActive
                                    ? "bg-white text-payroll-primary border border-payroll-primary-border"
                                    : "bg-payroll-primary-light text-payroll-primary group-hover:bg-payroll-primary-border",
                                )}
                              >
                                {item.badge.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Footer with Expand Button when Collapsed */}
      {isCollapsed && onToggle && (
        <div className="p-2 border-t border-payroll-border flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={onToggle}
            title="Expand sidebar"
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-payroll-border bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all cursor-pointer active:scale-95"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

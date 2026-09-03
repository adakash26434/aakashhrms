"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  Pin,
  PinOff,
} from "lucide-react";
import { NAV_GROUPS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  context?: WorkspaceContext;
}

export function Sidebar({ collapsed: externalCollapsed, onToggle, context }: SidebarProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track open/collapsed state for each navigation section
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    return new Set(NAV_GROUPS.map((g) => g.label));
  });

  // Load pinned state from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    const savedPin = localStorage.getItem("sidebarPinned");
    if (savedPin !== null) {
      setIsPinned(savedPin === "true");
    }
  }, []);

  // Auto-expand the section containing the active route whenever pathname changes
  useEffect(() => {
    NAV_GROUPS.forEach((group) => {
      const hasActive = group.items.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      );
      if (hasActive) {
        setOpenSections((prev) => new Set(prev).add(group.label));
      }
    });
  }, [pathname]);

  const handleTogglePin = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    if (isMounted) {
      localStorage.setItem("sidebarPinned", String(nextPinned));
    }
    if (onToggle) {
      onToggle();
    }
  };

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

  // Smooth hover enter / leave with micro-delay on exit to prevent jitter
  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  // Determine effective expanded state:
  const isExpanded = isPinned || isHovered;
  const isCollapsed = !isExpanded;

  const companyName = context?.company.name || "Company Workspace";
  const companyCode = context?.company.code || "CMP-ACTIVE";
  const branchName = context?.company.branch || "Head Office";
  const isImpersonating = context?.isImpersonating || false;

  const allowedModules = context?.allowedModules || [];
  const isFullAccess = context?.isImpersonating || allowedModules.length === 0;

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative flex h-screen shrink-0 flex-col bg-payroll-navy text-white z-30 select-none",
        "transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]",
        "border-r border-white/10",
        isExpanded
          ? "w-65 shadow-[8px_0_30px_rgba(0,0,0,0.22)]"
          : "w-18 shadow-none",
      )}
    >
      {/* Brand Header Row with integrated Pin Button */}
      <div className="flex h-16 shrink-0 items-center justify-between px-3.5 border-b border-white/10">
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] min-w-0",
            isCollapsed ? "justify-center w-full" : "justify-start flex-1",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-2xs border border-white/20 transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/AakashHrmsLogo.jpeg"
              alt="AakashHRMS"
              width={36}
              height={36}
              className="object-cover h-full w-full"
              priority
              unoptimized
            />
          </div>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isCollapsed
                ? "max-w-0 -translate-x-2 opacity-0 pointer-events-none"
                : "max-w-40 translate-x-0 opacity-100",
            )}
          >
            <div className="whitespace-nowrap min-w-0">
              <div className="text-[14px] font-bold tracking-tight leading-tight text-white">
                AakashHRMS
              </div>
              <div className="text-[10px] text-payroll-light/80 font-medium">HR & Payroll Nepal</div>
            </div>
          </div>
        </div>

        {/* Pin / Unpin button */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0",
            isCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-8 opacity-100",
          )}
        >
          <button
            type="button"
            onClick={handleTogglePin}
            title={isPinned ? "Unpin sidebar (auto-collapses when mouse leaves)" : "Pin sidebar open"}
            className={cn(
              "flex h-7.5 w-7.5 items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer shadow-payroll-xs active:scale-95",
              isPinned
                ? "bg-payroll-primary text-white border-payroll-light/40 shadow-sm"
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border-white/15",
            )}
            aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {isPinned ? (
              <PinOff className="h-3.5 w-3.5" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Active Workspace Company Pill */}
      <div className={cn("px-3 pt-3 pb-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", isCollapsed && "px-2")}>
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isCollapsed ? "mb-0 max-h-0 opacity-0" : "mb-1.5 max-h-6 opacity-100",
          )}
        >
          <div className="flex items-center justify-between px-1">
            <p className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">
              Active Company
            </p>
            {isImpersonating && (
              <span className="text-[9px] font-bold text-amber-300 uppercase tracking-tight bg-amber-400/20 px-1.5 py-0.5 rounded">
                Super Admin
              </span>
            )}
          </div>
        </div>
        <div
          className={cn(
            "flex w-full items-center rounded-xl border border-white/10 bg-white/5 transition-all duration-200",
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
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-payroll-primary/30 border border-white/10 text-payroll-light shadow-2xs">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                isCollapsed
                  ? "max-w-0 -translate-x-2 opacity-0 pointer-events-none"
                  : "max-w-44 translate-x-0 opacity-100",
              )}
            >
              <div className="min-w-0 whitespace-nowrap text-left">
                <div className="text-xs font-bold text-white truncate max-w-40">
                  {companyName}
                </div>
                <div className="text-[10px] text-white/45 truncate max-w-40 font-mono">
                  {companyCode} · {branchName}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Groups with Fluid Dropdown Accordion Sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!item.requiredModule) return true;
            if (isFullAccess) return true;
            return allowedModules.includes(item.requiredModule);
          });

          if (visibleItems.length === 0) return null;

          const isOverview = group.label === "Overview";
          const isSectionOpen = isOverview || openSections.has(group.label);

          const hasActiveChild = visibleItems.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
          );

          return (
            <div key={group.label} className="space-y-0.5">
              {/* Collapsible Section Header with Flowing Arrow Dropdown */}
              {!isOverview && (
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    isCollapsed
                      ? "mb-0 max-h-0 opacity-0 pointer-events-none"
                      : "mb-0.5 max-h-8 opacity-100",
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleSection(group.label, e)}
                    className={cn(
                      "flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200 rounded-lg cursor-pointer select-none",
                      hasActiveChild
                        ? "text-payroll-light/90 hover:text-white hover:bg-white/8"
                        : "text-white/40 hover:text-white/80 hover:bg-white/5",
                    )}
                  >
                    <span className="truncate">{group.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] text-white/50",
                        isSectionOpen && "rotate-180 text-payroll-light",
                      )}
                    />
                  </button>
                </div>
              )}

              {/* Items List (CSS Grid 0fr -> 1fr smooth accordion transition) */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isExpanded && !isSectionOpen
                    ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                    : "grid-rows-[1fr] opacity-100",
                )}
              >
                <div className="overflow-hidden space-y-0.5">
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
                          "group relative flex items-center rounded-xl text-xs font-semibold select-none cursor-pointer overflow-hidden",
                          "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          isCollapsed
                            ? "justify-center h-10 w-full px-0"
                            : "gap-2.5 px-3 py-2 hover:translate-x-1",
                          isActive
                            ? "bg-payroll-primary text-white shadow-payroll-xs before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-payroll-light"
                            : "text-white/70 hover:bg-white/10 hover:text-white active:scale-[0.98]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            isActive
                              ? "text-white scale-105"
                              : "text-white/60 group-hover:text-white group-hover:scale-110",
                          )}
                        />
                        <div
                          className={cn(
                            "flex items-center justify-between flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            isCollapsed
                              ? "max-w-0 -translate-x-2 opacity-0 pointer-events-none"
                              : "max-w-50 translate-x-0 opacity-100",
                          )}
                        >
                          <span className="truncate whitespace-nowrap font-medium text-xs">
                            {item.label}
                          </span>
                          {item.badge !== undefined && (
                            <span
                              className={cn(
                                "ml-1.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono transition-colors",
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white",
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
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

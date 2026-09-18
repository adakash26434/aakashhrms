"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  Layers,
  FileText,
  ChevronRight,
  ChevronDown,
  Palmtree,
  Clock,
  Coins,
  Gift,
  Percent,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubNavItem {
  label: string;
  href: string;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  label: string;
  href: string;
  exact: boolean;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: SubNavItem[];
}

interface NavSection {
  category: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    category: "Management",
    items: [
      {
        label: "Overview",
        href: "/platform",
        exact: true,
        icon: Activity,
      },
      {
        label: "Tenant Companies",
        href: "/platform/companies",
        exact: false,
        icon: Building2,
      },
      {
        label: "Change Requests",
        href: "/platform/change-requests",
        exact: false,
        icon: ShieldAlert,
      },
    ],
  },

  {
    category: "Governance",
    items: [
      {
        label: "Statutory Policy Packs",
        href: "/platform/policies",
        exact: false,
        icon: Layers,
        subItems: [
          {
            label: "Statutory Leaves",
            href: "/platform/policies?tab=leaves",
            tab: "leaves",
            icon: Palmtree,
          },
          {
            label: "Overtime Rules",
            href: "/platform/policies?tab=overtime",
            tab: "overtime",
            icon: Clock,
          },
          {
            label: "SSF & Deductions",
            href: "/platform/policies?tab=deductions",
            tab: "deductions",
            icon: Coins,
          },
          {
            label: "Statutory Bonus",
            href: "/platform/policies?tab=benefits",
            tab: "benefits",
            icon: Gift,
          },
          {
            label: "Tax Slabs Baseline",
            href: "/platform/policies?tab=tax",
            tab: "tax",
            icon: Percent,
          },
        ],
      },
      {
        label: "Platform Audit Logs",
        href: "/platform/audit",
        exact: false,
        icon: FileText,
      },
    ],
  },
];

function PlatformNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get("tab") || "leaves";

  // Auto-expand policies section if currently on policies page
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "/platform/policies": true,
  });

  const toggleExpand = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSections((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  };

  return (
    <nav className="space-y-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.category} className="space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold text-payroll-light/70 uppercase tracking-[0.14em]">
            {section.category}
          </div>

          <div className="space-y-1">
            {section.items.map((item) => {
              const isBaseActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedSections[item.href] ?? isBaseActive;

              return (
                <div key={item.href} className="space-y-1">
                  <div className="relative flex items-center">
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold select-none cursor-pointer overflow-hidden",
                        "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isBaseActive
                          ? "bg-payroll-primary text-white shadow-payroll-xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-payroll-light"
                          : "text-white/70 hover:bg-white/10 hover:text-white hover:translate-x-1 active:scale-[0.98]",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-all duration-200",
                            isBaseActive
                              ? "text-white scale-105"
                              : "text-white/60 group-hover:text-white group-hover:scale-110",
                          )}
                        />
                        <span className="truncate whitespace-nowrap">
                          {item.label}
                        </span>
                      </div>

                      {hasSubItems ? (
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(item.href, e)}
                          className="p-1 -mr-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-white/60",
                              isExpanded && "rotate-180 text-white",
                            )}
                          />
                        </button>
                      ) : (
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-all duration-200",
                            isBaseActive
                              ? "text-payroll-light opacity-100 translate-x-0"
                              : "text-white/30 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
                          )}
                        />
                      )}
                    </Link>
                  </div>

                  {/* Subtabs for Policy Packs */}
                  {hasSubItems && isExpanded && (
                    <div className="ml-4 pl-2.5 border-l border-white/15 space-y-0.5 pt-0.5 pb-1">
                      {item.subItems!.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive =
                          pathname === "/platform/policies" &&
                          currentTab === sub.tab;

                        return (
                          <Link
                            key={sub.tab}
                            href={sub.href}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all select-none cursor-pointer",
                              isSubActive
                                ? "bg-white/20 text-white font-bold shadow-2xs translate-x-0.5"
                                : "text-white/60 hover:text-white hover:bg-white/10 hover:translate-x-0.5",
                            )}
                          >
                            <SubIcon
                              className={cn(
                                "w-3.5 h-3.5 shrink-0",
                                isSubActive ? "text-payroll-cream" : "text-white/50",
                              )}
                            />
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function PlatformNav() {
  return (
    <Suspense
      fallback={
        <nav className="space-y-4">
          <div className="px-3 py-1.5 text-[10px] font-bold text-payroll-light/70 uppercase tracking-[0.14em]">
            Loading Navigation...
          </div>
        </nav>
      }
    >
      <PlatformNavContent />
    </Suspense>
  );
}

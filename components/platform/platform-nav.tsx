"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  Layers,
  FileText,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
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

export function PlatformNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.category} className="space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold text-payroll-light/70 uppercase tracking-[0.14em]">
            {section.category}
          </div>

          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold select-none cursor-pointer overflow-hidden",
                    "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    isActive
                      ? "bg-payroll-primary text-white shadow-payroll-xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-payroll-light"
                      : "text-white/70 hover:bg-white/10 hover:text-white hover:translate-x-1 active:scale-[0.98]",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-all duration-200",
                        isActive
                          ? "text-white scale-105"
                          : "text-white/60 group-hover:text-white group-hover:scale-110",
                      )}
                    />
                    <span className="truncate whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>

                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-all duration-200",
                      isActive
                        ? "text-payroll-light opacity-100 translate-x-0"
                        : "text-white/30 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
                    )}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

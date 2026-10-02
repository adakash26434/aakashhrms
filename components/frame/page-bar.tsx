"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { findActiveLocation } from "@/lib/frame/navigation";
import { CommandToolbar, type ToolbarAction } from "./command-toolbar";

/**
 * Page bar (2.5): breadcrumb (from the navigation model), title, status
 * chips and the command toolbar. Module pages adopt it in Phase 4.
 */
export function PageBar({
  title,
  description,
  status,
  actions,
  crumbs,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  actions?: ToolbarAction[];
  /** Extra trailing crumbs, e.g. a record name. */
  crumbs?: { label: string; href?: string }[];
}) {
  const pathname = usePathname();
  const location = findActiveLocation(pathname);
  const trail = [
    // A lone crumb that only repeats the title (e.g. Home) adds nothing.
    ...(location && location.module.label !== title ? [{ label: location.module.label }] : []),
    ...(location?.section && location.section.label !== title ? [{ label: location.section.label, href: location.section.href }] : []),
    ...(crumbs ?? []),
  ];

  return (
    <div className="mb-4 flex flex-col gap-2 border-b border-line pb-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {trail.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-0.5 flex items-center gap-1 text-2xs text-ink-faint">
            {trail.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-ink hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold text-ink">{title}</h1>
          {status}
        </div>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      {actions && actions.length > 0 && <CommandToolbar actions={actions} />}
    </div>
  );
}

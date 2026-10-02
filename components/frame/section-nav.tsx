"use client";

import Link from "next/link";
import { History } from "lucide-react";
import type { NavModule, NavSection } from "@/lib/frame/navigation";
import { cn } from "@/lib/utils";
import type { RecentPage } from "./use-recent-pages";

/** Section navigator (2.3): the active module's pages, counters and recent pages. */
export function SectionNav({
  module,
  activeSectionId,
  counters,
  recent,
  onNavigate,
}: {
  module: NavModule | null;
  activeSectionId: string | null;
  counters: Partial<Record<NonNullable<NavSection["counter"]>, number>>;
  recent: RecentPage[];
  onNavigate?: () => void;
}) {
  if (!module) return null;
  const ModuleIcon = module.icon;

  return (
    <nav aria-label={`${module.label} sections`} className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-nav">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <ModuleIcon className="h-4 w-4 text-brand" />
        <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wider text-ink">{module.label}</span>
        <kbd className="text-3xs font-medium text-ink-faint">Alt {module.hotkey}</kbd>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-px">
          {module.sections.map((section) => {
            const Icon = section.icon;
            const active = section.id === activeSectionId;
            const count = section.counter ? counters[section.counter] ?? 0 : 0;
            return (
              <li key={section.id}>
                <Link
                  href={section.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-100",
                    active
                      ? "bg-selection font-medium text-brand-strong"
                      : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  )}
                >
                  {active && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand" />}
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-ink-faint")} />
                  <span className="flex-1 truncate">{section.label}</span>
                  {count > 0 && (
                    <span className="rounded-full bg-warning-subtle px-1.5 text-2xs font-semibold text-warning tabular-nums">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {recent.length > 0 && (
          <div className="mt-4">
            <p className="flex items-center gap-1.5 px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
              <History className="h-3 w-3" /> Recent
            </p>
            <ul className="space-y-px">
              {recent.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    onClick={onNavigate}
                    className="flex h-7 items-center gap-2 rounded-md px-2.5 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  >
                    <span className="flex-1 truncate">{page.label}</span>
                    <span className="truncate text-2xs text-ink-faint">{page.module}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}

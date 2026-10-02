"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ModuleId, NavModule } from "@/lib/frame/navigation";
import { cn } from "@/lib/utils";

/** Module rail (2.3): one tile per module, Alt+1…7. */
export function ModuleRail({
  modules,
  activeModuleId,
  navigatorOpen,
  onToggleNavigator,
  onNavigate,
}: {
  modules: NavModule[];
  activeModuleId: ModuleId | null;
  navigatorOpen: boolean;
  onToggleNavigator?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Modules" className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-rail py-2">
      {modules.map((module) => {
        const Icon = module.icon;
        const active = module.id === activeModuleId;
        return (
          <Link
            key={module.id}
            href={module.sections[0].href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={`${module.label} (Alt ${module.hotkey})`}
            className={cn(
              "group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-100",
              active
                ? "bg-white text-brand shadow-xs ring-1 ring-line"
                : "text-ink-muted hover:bg-white/70 hover:text-ink"
            )}
          >
            {active && <span aria-hidden className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r bg-brand" />}
            <Icon className="h-[18px] w-[18px]" />
            {/* Tooltip */}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-2xs font-medium text-white shadow-md group-hover:block group-focus-visible:block"
            >
              {module.label}
              <span className="ml-2 text-white/60">Alt {module.hotkey}</span>
            </span>
          </Link>
        );
      })}

      {onToggleNavigator && (
        <button
          type="button"
          onClick={onToggleNavigator}
          className="mt-auto flex h-9 w-9 items-center justify-center rounded-md text-ink-faint hover:bg-white/70 hover:text-ink cursor-pointer"
          aria-label={navigatorOpen ? "Hide section navigator (Ctrl B)" : "Show section navigator (Ctrl B)"}
          title={navigatorOpen ? "Hide navigator (Ctrl B)" : "Show navigator (Ctrl B)"}
        >
          {navigatorOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      )}
    </nav>
  );
}

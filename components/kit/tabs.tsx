"use client";

import { useId, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Small counter or status (e.g. "3" errors). */
  badge?: ReactNode;
  disabled?: boolean;
}

/**
 * Tabs (3.5) with roving focus: ←/→ (or ↑/↓ when vertical), Home and End move
 * between tabs; only the active tab is in the Tab order (WAI-ARIA tabs).
 */
export function Tabs({
  items,
  value,
  onChange,
  orientation = "horizontal",
  children,
  className,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  orientation?: "horizontal" | "vertical";
  children: ReactNode;
  className?: string;
  /** Accessible name for the tab list. */
  label: string;
}) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const enabled = items.filter((t) => !t.disabled);
  const vertical = orientation === "vertical";

  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = enabled.findIndex((t) => t.id === value);
    const prev = vertical ? "ArrowUp" : "ArrowLeft";
    const next = vertical ? "ArrowDown" : "ArrowRight";
    let target = -1;
    if (e.key === next) target = (index + 1) % enabled.length;
    else if (e.key === prev) target = (index - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = enabled.length - 1;
    if (target < 0) return;
    e.preventDefault();
    const id = enabled[target].id;
    onChange(id);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)?.focus());
  };

  return (
    <div className={cn(vertical ? "flex flex-col gap-4 md:flex-row" : "flex flex-col", className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        aria-orientation={orientation}
        onKeyDown={onKeyDown}
        className={cn(
          vertical
            ? "flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col md:overflow-visible"
            : "flex gap-1 overflow-x-auto border-b border-line",
          "no-scrollbar"
        )}
      >
        {items.map((tab) => {
          const active = tab.id === value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              data-tab-id={tab.id}
              aria-selected={active}
              aria-controls={`${baseId}-panel`}
              tabIndex={active ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 whitespace-nowrap text-sm transition-colors disabled:opacity-40 cursor-pointer",
                vertical
                  ? cn("h-8 rounded-md px-2.5 text-left", active ? "bg-selection font-medium text-brand-strong" : "text-ink-muted hover:bg-surface-sunken hover:text-ink")
                  : cn("-mb-px h-9 border-b-2 px-3", active ? "border-brand font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink")
              )}
            >
              {vertical && active && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 hidden w-[3px] rounded-r bg-brand md:block" />}
              {Icon && <Icon className={cn("h-4 w-4", active ? "text-brand" : "text-ink-faint")} />}
              <span className={cn(vertical && "flex-1")}>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${value}`}
        tabIndex={0}
        className={cn("min-w-0 outline-none", vertical ? "flex-1" : "pt-4")}
      >
        {children}
      </div>
    </div>
  );
}

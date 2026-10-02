"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { isTypingTarget, matchesCombo } from "@/lib/frame/shortcuts";
import { cn } from "@/lib/utils";

export type ToolbarGroup = "create" | "selection" | "output" | "refresh";

export interface ToolbarAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  group: ToolbarGroup;
  onClick?: () => void;
  href?: string;
  /** e.g. "Ctrl+N". Registered while the toolbar is mounted. */
  shortcut?: string;
  primary?: boolean;
  /**
   * Hide actions the user can never perform (compute from server-provided
   * permission flags). Hiding is UX only — the server action re-checks.
   */
  hidden?: boolean;
  disabled?: boolean;
  /** Tooltip explaining why the action is disabled. */
  disabledReason?: string;
}

const ORDER: ToolbarGroup[] = ["create", "selection", "output", "refresh"];

/**
 * Command toolbar (2.5). Fixed order: Create · Act on selection · Output ·
 * Refresh, separated by dividers. Labels collapse to icons below 768px.
 */
export function CommandToolbar({ actions, className }: { actions: ToolbarAction[]; className?: string }) {
  const visible = actions.filter((a) => !a.hidden);

  useEffect(() => {
    const withKeys = visible.filter((a) => a.shortcut && !a.disabled && (a.onClick || a.href));
    if (withKeys.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const action = withKeys.find((a) => matchesCombo(e, a.shortcut!));
      if (!action) return;
      // Bare keys (F2, Delete) must not fire while typing.
      if (!(e.ctrlKey || e.metaKey || e.altKey) && isTypingTarget(e.target as HTMLElement)) return;
      e.preventDefault();
      if (action.onClick) action.onClick();
      else if (action.href) window.location.assign(action.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const groups = ORDER.map((g) => visible.filter((a) => a.group === g)).filter((g) => g.length > 0);

  return (
    <div role="toolbar" aria-label="Page actions" className={cn("flex flex-wrap items-center gap-1", className)}>
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-1">
          {gi > 0 && <span aria-hidden className="mx-1 h-5 w-px bg-line" />}
          {group.map((action) => {
            const Icon = action.icon;
            const title = action.disabled && action.disabledReason
              ? action.disabledReason
              : action.shortcut
                ? `${action.label} (${action.shortcut.replace(/\+/g, " ")})`
                : action.label;
            const classes = cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-100",
              action.primary
                ? "bg-brand text-white hover:bg-brand-hover"
                : "border border-line bg-surface text-ink hover:bg-surface-sunken",
              action.disabled && "pointer-events-none opacity-50"
            );
            const content = (
              <>
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span className={cn(Icon && "sr-only md:not-sr-only")}>{action.label}</span>
              </>
            );
            return action.href && !action.disabled ? (
              <Link key={action.id} href={action.href} className={classes} title={title}>
                {content}
              </Link>
            ) : (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                aria-disabled={action.disabled}
                className={cn(classes, "cursor-pointer")}
                title={title}
              >
                {content}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

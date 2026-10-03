import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatusSegment {
  id: string;
  content: ReactNode;
  /** Takes the remaining width (and truncates), e.g. the current field's hint. */
  grow?: boolean;
  tone?: "default" | "warning" | "success" | "danger";
}

/**
 * Status line in the style of a desktop window's status bar: segments split
 * by thin dividers, the first usually growing. Polite live region, so
 * screen readers hear changes (the current hint, "Unsaved").
 */
export function StatusBar({ segments, className }: { segments: StatusSegment[]; className?: string }) {
  return (
    <div aria-live="polite" className={cn("flex min-w-0 items-stretch text-2xs text-ink-muted", className)}>
      {segments.map((s, i) => (
        <div
          key={s.id}
          className={cn(
            "flex min-w-0 items-center gap-1.5 px-2.5",
            i > 0 && "border-l border-line",
            s.grow ? "flex-1 truncate" : "shrink-0 whitespace-nowrap",
            s.tone === "warning" && "font-medium text-warning",
            s.tone === "success" && "text-success",
            s.tone === "danger" && "font-medium text-danger"
          )}
        >
          {s.content}
        </div>
      ))}
    </div>
  );
}

/** A key cap for shortcut hints ("Ctrl" "S"). */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface px-1 font-sans text-3xs font-medium text-ink-muted">{children}</kbd>;
}

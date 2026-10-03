"use client";

import { cn } from "@/lib/utils";

/**
 * "You have unsaved changes. Discard them?" Shared by Window and full-page
 * editors so leaving with changes always looks and works the same.
 */
export function DiscardBar({
  onKeep,
  onDiscard,
  className,
}: {
  onKeep: () => void;
  onDiscard: () => void;
  className?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Discard changes?"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onKeep();
        }
      }}
      className={cn("flex shrink-0 items-center gap-2 border-t border-warning/30 bg-warning-subtle px-4 py-2.5", className)}
    >
      <p className="flex-1 text-xs font-medium text-warning">You have unsaved changes. Discard them?</p>
      <button
        type="button"
        autoFocus
        onClick={onKeep}
        className="h-8 cursor-pointer rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
      >
        Keep editing
      </button>
      <button type="button" onClick={onDiscard} className="h-8 cursor-pointer rounded-md bg-danger px-3 text-xs font-medium text-white hover:opacity-90">
        Discard
      </button>
    </div>
  );
}

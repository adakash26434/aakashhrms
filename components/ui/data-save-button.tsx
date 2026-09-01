"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Variant of the standard `<Button>` for async "save settings"
 * actions on configuration pages (e.g. System Control, future
 * Pay Heads, future Leave Heads).
 *
 * Why a primitive? Without one, every setup page re-implements:
 *   - a `isSaving` state
 *   - a `Loader2` icon swap during save
 *   - disabling the button to prevent double-clicks
 *   - a label change during save
 * ...and they all do it slightly differently. This primitive
 * enforces consistency and saves ~15 lines per consumer.
 *
 * The button is fully controlled by the parent — the parent owns
 * the `isSaving` state and the actual `onClick` handler. The
 * primitive just renders the right state.
 */
interface DataSaveButtonProps {
  /** Async save handler. The parent should catch its own errors. */
  onClick: () => void;
  /** True while the save is in flight. */
  isSaving: boolean;
  /**
   * Optional override of the button label. Defaults to
   * "Save Changes". During save, the prefix changes to "Saving…".
   */
  label?: string;
  /**
   * Optional override of the saving label. Defaults to
   * `${label.replace(/Changes$/, "")}ing…` — so "Save Changes" →
   * "Saving…" and "Save" → "Saving…".
   */
  savingLabel?: string;
  /**
   * Optional icon override. Defaults to `<Save />` (and
   * `<Loader2 />` while saving, which spins).
   */
  icon?: React.ReactNode;
  /** Forwarded to the underlying button — e.g. for layout flex. */
  className?: string;
}

export function DataSaveButton({
  onClick,
  isSaving,
  label = "Save Changes",
  savingLabel,
  icon,
  className,
}: DataSaveButtonProps) {
  // Derive a sensible "Saving…" label from the resting label.
  const computedSavingLabel =
    savingLabel ??
    (label.endsWith("Changes")
      ? label.replace(/Changes$/, "ing…")
      : `${label.replace(/e?$/, "")}ing…`);

  return (
    <Button
      onClick={onClick}
      size="md"
      disabled={isSaving}
      aria-busy={isSaving}
      className={cn("min-w-32", className)}
    >
      {isSaving ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {computedSavingLabel}
        </>
      ) : (
        <>
          {icon ?? <Save className="h-4 w-4" />}
          {label}
        </>
      )}
    </Button>
  );
}

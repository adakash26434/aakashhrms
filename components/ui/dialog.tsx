"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
} as const;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Optional footer (typically Cancel + action buttons). */
  footer?: React.ReactNode;
  /** Max width preset. Defaults to "md". */
  size?: keyof typeof sizeClasses;
  className?: string;
}

/**
 * Reusable modal dialog primitive.
 *
 * - Renders into a React Portal on `document.body` so it escapes any
 *   `overflow: hidden` / transformed ancestor stacking contexts.
 * - Caps height at 90vh and scrolls the body internally so the
 *   header and footer remain pinned on tall content.
 * - Locks body scroll while open.
 * - Closes on backdrop click and Escape key.
 * - Subtle scale/fade entrance.
 * - Built from scratch (no shadcn dependency) to match the project's
 *   design tokens: navy text, blue primary, light blue borders.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Body scroll lock + Escape handler
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // Focus the dialog for screen readers
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — capped at 90vh, internal column flex so the body can scroll. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex w-full max-h-[90vh] flex-col rounded-xl border border-[#d7e8d0] bg-white shadow-xl outline-none animate-[dialogIn_180ms_ease-out]",
          sizeClasses[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — pinned, non-shrinking */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#d7e8d0]/60 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2
              id="dialog-title"
              className="text-base font-semibold text-[#1b3a1f]"
            >
              {title}
            </h2>
            {description && (
              <p
                id="dialog-description"
                className="mt-1 text-sm text-gray-500"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#f6faf6] hover:text-[#ee3c4b]"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrolls when content exceeds available height */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Footer — pinned, non-shrinking */}
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#d7e8d0]/60 bg-[#f6faf6]/50 px-5 py-3 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

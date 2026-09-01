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
} as const;

const widthClasses = {
  sm: "w-full sm:max-w-sm",
  md: "w-full sm:max-w-md",
  lg: "w-full sm:max-w-lg",
  xl: "w-full sm:max-w-xl",
  "2xl": "w-full sm:max-w-2xl",
} as const;

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  /** Header content (typically a title row with actions). */
  header: React.ReactNode;
  /** Optional small subtitle shown below the header. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Optional footer (typically a "Close" + action button row). */
  footer?: React.ReactNode;
  /** Width preset. Defaults to "md" (max-w-md). */
  size?: keyof typeof sizeClasses;
  className?: string;
}

/**
 * Reusable right-side slide-in panel primitive.
 *
 * - Renders into a React Portal on `document.body` so it escapes
 *   any `overflow: hidden` / transformed ancestor stacking
 *   contexts.
 * - Slides in from the right with a backdrop fade.
 * - Closes on backdrop click and Escape key.
 * - Locks body scroll while open.
 * - Subtle slide+fade entrance animation.
 * - Built from scratch (no shadcn dependency) to match the
 *   project's design tokens: navy text, blue primary, light
 *   blue borders.
 *
 * **Use cases so far:** the Pay Head detail panel (view a
 * single pay head's overview, applicability, and flags). The
 * shape is generic — any "view this row" panel can use it.
 */
export function SidePanel({
  open,
  onClose,
  header,
  subtitle,
  children,
  footer,
  size = "md",
  className,
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Body scroll lock + Escape handler
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // Focus the panel for screen readers
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex h-full flex-col border-l border-[#d7e8d0] bg-white shadow-xl outline-none animate-[panelIn_220ms_ease-out]",
          widthClasses[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — host-provided (typically a row with title + actions) */}
        <div className="flex items-start justify-between gap-3 border-b border-[#d7e8d0]/80 px-5 py-4">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-[#f6faf6] hover:text-[#1b3a1f]"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Optional subtitle */}
        {subtitle && (
          <div className="border-b border-[#d7e8d0]/60 bg-[#f6faf6]/40 px-5 py-2 text-xs text-gray-500">
            {subtitle}
          </div>
        )}

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#d7e8d0]/60 bg-[#f6faf6]/50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

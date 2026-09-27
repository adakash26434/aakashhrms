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
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
} as const;

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof sizeClasses;
  className?: string;
  bodyClassName?: string;
  headerBottom?: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  bodyClassName,
  headerBottom,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-payroll-navy/40 backdrop-blur-xs transition-opacity animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex w-full max-h-[92dvh] flex-col rounded-xl border border-zinc-200/80 bg-white shadow-2xl outline-none overflow-hidden",
          sizeClasses[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 flex-col border-b border-zinc-300/80 bg-white">
          <div className="flex items-start justify-between gap-3 px-6 py-4.5">
            <div className="min-w-0 flex-1">
              <h2
                id="dialog-title"
                className="text-base sm:text-lg font-semibold text-zinc-900 tracking-tight"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="dialog-description"
                  className="mt-1 text-xs text-zinc-500 font-medium leading-relaxed"
                >
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {headerBottom && (
            <div className="px-6 py-2.5 border-t border-zinc-200 bg-zinc-50/50">
              {headerBottom}
            </div>
          )}
        </div>

        {/* Body (Single unified scroll container) */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-6 sm:px-8 py-6",
            bodyClassName,
          )}
        >
          {children}
        </div>

        {/* Footer: Pinned cleanly with zero shadow bleed */}
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-200/80 bg-white px-6 py-4 sticky bottom-0 z-10">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

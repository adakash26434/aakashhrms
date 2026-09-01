"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDateFormat,
  type DateFormat,
} from "@/lib/contexts/date-format-context";

interface DateFormatMenuProps {
  /** Visual size of the segmented control. Defaults to "md". */
  size?: "sm" | "md";
  /** Optional extra class names for the outer wrapper. */
  className?: string;
}

const FORMAT_OPTIONS: { value: DateFormat; label: string; description: string }[] = [
  { value: "bs-long", label: "BS · Long", description: "Baisakh 1, 2081" },
  { value: "bs-numeric", label: "BS · Numeric", description: "2081-04-01" },
  { value: "ad-iso", label: "AD · ISO", description: "2024-07-17" },
  { value: "ad-long", label: "AD · Long", description: "July 17, 2024" },
];

/**
 * Global + local "BS | AD" date format toggle.
 *
 * The segmented control quickly switches calendar (BS ↔ AD), preserving
 * the current presentation variant (long ↔ numeric/iso). The small
 * chevron opens a dropdown of all four format options for fine control.
 *
 * The dropdown is rendered into a React **Portal** attached to
 * `document.body` with `position: fixed`. This is required because
 * the surrounding layout uses `overflow: hidden` (the dashboard
 * shell) and `overflow-y: auto` (the scrollable main area), either of
 * which would otherwise clip the dropdown.
 *
 * Both the global (header) and local (page-level) toggles share the
 * same context, so flipping one updates the other everywhere.
 */
export function DateFormatMenu({
  size = "md",
  className,
}: DateFormatMenuProps) {
  const { format, setFormat, calendar, setCalendar } = useDateFormat();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Position of the dropdown in viewport coordinates.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  // Compute the dropdown position right after it opens, and re-compute
  // on resize so it stays aligned with the trigger.
  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6, // 6px gap (mt-1.5)
        // Align the dropdown's RIGHT edge with the trigger's RIGHT edge.
        left: rect.right,
        // Use the trigger's width as a minimum so the dropdown is
        // never narrower than the segmented control.
        width: Math.max(rect.width, 240),
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const heightClass = size === "sm" ? "h-7" : "h-8";
  const textClass = size === "sm" ? "text-[11px]" : "text-xs";
  const pxClass = size === "sm" ? "px-2.5" : "px-3";

  return (
    <div
      ref={triggerRef}
      className={cn("relative inline-flex items-center", className)}
    >
      <div
        className={cn(
          "inline-flex items-center overflow-hidden rounded-md border border-[#d7e8d0] bg-white",
        )}
        role="group"
        aria-label="Date format"
      >
        <CalendarDays
          className={cn("ml-2 h-3.5 w-3.5 text-gray-400", size === "sm" && "h-3 w-3")}
          aria-hidden="true"
        />
        <SegButton
          active={calendar === "bs"}
          onClick={() => setCalendar("bs")}
          className={cn(heightClass, pxClass, textClass)}
        >
          BS
        </SegButton>
        <SegButton
          active={calendar === "ad"}
          onClick={() => setCalendar("ad")}
          className={cn(heightClass, pxClass, textClass)}
        >
          AD
        </SegButton>
        <button
          type="button"
          aria-label="Choose date format variant"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center justify-center border-l border-[#d7e8d0] text-gray-500 transition-colors hover:bg-[#f6faf6] hover:text-[#1b3a1f]",
            heightClass,
            pxClass,
          )}
        >
          <ChevronDown
            className={cn(
              "transition-transform",
              size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Dropdown — rendered via Portal so it escapes overflow:hidden parents. */}
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              role="listbox"
              aria-label="Date format options"
              style={{
                position: "fixed",
                top: pos.top,
                // Shift left so the right edge of the dropdown aligns with
                // the right edge of the trigger.
                left: pos.left - pos.width,
                minWidth: pos.width,
                zIndex: 9999,
              }}
              className="overflow-hidden rounded-md border border-[#d7e8d0] bg-white shadow-lg animate-[dialogIn_180ms_ease-out]"
            >
              {FORMAT_OPTIONS.map((opt) => {
                const selected = opt.value === format;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setFormat(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
                      selected
                        ? "bg-[#d7e8d0]/40 text-[#1b3a1f]"
                        : "text-gray-700 hover:bg-[#f6faf6]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center",
                      )}
                    >
                      {selected && (
                        <Check className="h-3.5 w-3.5 text-[#2e7d32]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium">
                        {opt.label}
                      </span>
                      <span className="block text-[11px] text-gray-500">
                        {opt.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

interface SegButtonProps {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

function SegButton({ active, onClick, className, children }: SegButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "font-medium uppercase tracking-wide transition-colors",
        active
          ? "bg-[#2e7d32] text-white"
          : "text-gray-500 hover:bg-[#f6faf6] hover:text-[#1b3a1f]",
        className,
      )}
    >
      {children}
    </button>
  );
}

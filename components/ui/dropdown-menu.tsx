"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generic, accessible dropdown menu primitive.
 *
 * The trigger is a styled button; the menu is rendered into a React
 * Portal attached to `document.body` with `position: fixed` so it
 * escapes any `overflow: hidden` parent (the dashboard layout has
 * these on the sidebar and main scroll containers).
 *
 * This primitive is the extracted & generalized version of the
 * dropdown pattern that originally lived inline in
 * `date-format-menu.tsx`. All callers should use this primitive
 * instead of hand-rolling another copy.
 *
 * Features:
 *   - Outside-click + Escape close
 *   - Reposition on resize / scroll
 *   - Keyboard accessible (`aria-haspopup`, `aria-expanded`,
 *     `role="listbox"` / `role="option"`, `aria-selected`)
 *   - Renders a checkmark next to the active option
 *   - Trigger button can be in any state (idle / active / error)
 *     via the `trigger` render prop
 */

export interface DropdownOption<TValue extends string = string> {
  value: TValue;
  /** Primary label (always shown). */
  label: string;
  /** Optional secondary line, shown smaller below the label. */
  description?: string;
  /**
   * Optional adornment rendered on the left of the label (e.g. an
   * icon or a small "locked" badge). Keep it compact.
   */
  adornment?: ReactNode;
  /** Disabled options are rendered greyed-out and unclickable. */
  disabled?: boolean;
}

interface DropdownMenuProps<TValue extends string> {
  /** Currently selected value. Used to draw the checkmark. */
  value: TValue;
  onChange: (value: TValue) => void;
  /** List of options. The order shown is the order passed. */
  options: DropdownOption<TValue>[];
  /** Accessible label for the trigger button. */
  ariaLabel: string;
  /**
   * Render-prop for the trigger button. Receives the current state
   * (open / closed) plus a `ref` to attach to the trigger element.
   * Use this to fully customize the trigger's appearance.
   */
  renderTrigger: (args: {
    open: boolean;
    selected: DropdownOption<TValue> | undefined;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
    toggle: () => void;
  }) => ReactNode;
  /**
   * Alignment of the dropdown relative to the trigger's right
   * edge. Default: right (dropdown right edge = trigger right edge).
   */
  align?: "right" | "left";
  /** Min width of the dropdown in pixels. Defaults to 240. */
  minWidth?: number;
  /** Optional extra class for the dropdown panel. */
  panelClassName?: string;
}

export function DropdownMenu<TValue extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  renderTrigger,
  align = "right",
  minWidth = 240,
  panelClassName,
}: DropdownMenuProps<TValue>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Position of the dropdown in viewport coordinates. Recomputed on
  // open, resize, and scroll.
  const [pos, setPos] = useState<
    { top: number; left: number; width: number } | null
  >(null);

  const selected = options.find((o) => o.value === value);

  // Reposition when opened, and on any resize/scroll while open.
  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6, // 6px gap (mt-1.5)
        left: align === "right" ? rect.right : rect.left,
        width: Math.max(rect.width, minWidth),
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, align, minWidth]);

  // Outside-click + Escape close.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
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

  const toggle = () => setOpen((o) => !o);

  return (
    <>
      {renderTrigger({ open, selected, triggerRef, toggle })}

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              aria-label={ariaLabel}
              style={{
                position: "fixed",
                top: pos.top,
                left: align === "right" ? pos.left - pos.width : pos.left,
                minWidth: pos.width,
                zIndex: 9999,
              }}
              className={cn(
                "overflow-hidden rounded-md border border-[#d7e8d0] bg-white shadow-lg animate-[dialogIn_180ms_ease-out]",
                panelClassName,
              )}
            >
              {options.map((opt) => {
                const isSelected = opt.value === value;
                const isDisabled = opt.disabled ?? false;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
                      isDisabled
                        ? "cursor-not-allowed bg-[#f6faf6] text-gray-400"
                        : isSelected
                          ? "bg-[#d7e8d0]/40 text-[#1b3a1f]"
                          : "text-gray-700 hover:bg-[#f6faf6]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center",
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-[#2e7d32]" />
                      )}
                    </span>
                    {opt.adornment && (
                      <span className="mt-0.5 flex shrink-0 items-center">
                        {opt.adornment}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-xs font-medium",
                          isDisabled && "text-gray-400",
                        )}
                      >
                        {opt.label}
                      </span>
                      {opt.description && (
                        <span className="block text-[11px] text-gray-500">
                          {opt.description}
                        </span>
                      )}
                    </span>
                    {!opt.adornment && <ChevronDown className="hidden" />}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

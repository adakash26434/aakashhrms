"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { FOCUSABLE_SELECTOR, nextTrapIndex } from "@/lib/kit/focus";
import { cn } from "@/lib/utils";
import { DiscardBar } from "./discard-bar";

export type WindowSize = "sm" | "md" | "lg" | "xl" | "full";

/** The window's own close (asks "Discard changes?" when there are unsaved changes), for its footer buttons. */
const WindowCloseContext = createContext<(() => void) | null>(null);

const SIZE: Record<WindowSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[min(96vw,1400px)] h-[92vh]",
};

export interface WindowProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: WindowSize;
  children: ReactNode;
  /** Sticky footer, typically Cancel + primary action (right-aligned). */
  footer?: ReactNode;
  /** Unsaved changes: closing asks "Discard changes?" first. */
  dirty?: boolean;
  /** Element to focus on open (defaults to the first field, else the close button). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Extra controls in the title bar, left of the close button. */
  titleActions?: ReactNode;
}

/**
 * Window (3.4): the dialog for every module. Title bar, scrollable body,
 * sticky footer, focus trap, Esc, focus restore and a dirty-state guard.
 */
export function Window(props: WindowProps) {
  if (!props.open || typeof document === "undefined") return null;
  return createPortal(<WindowSurface {...props} />, document.body);
}

function WindowSurface({ onClose, title, description, size = "md", children, footer, dirty, initialFocusRef, titleActions }: WindowProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [restoreTo] = useState(() => document.activeElement as HTMLElement | null);

  const requestClose = useCallback(() => {
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  // Initial focus + focus restore.
  useEffect(() => {
    const panel = panelRef.current;
    const target =
      initialFocusRef?.current ??
      panel?.querySelector<HTMLElement>("[data-autofocus], input:not([type='hidden']):not([disabled]), select, textarea") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    requestAnimationFrame(() => target?.focus());
    return () => restoreTo?.focus?.();
  }, [initialFocusRef, restoreTo]);

  type KeyLike = Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault" | "stopPropagation">;
  const handleKey = (e: KeyLike) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (confirmingDiscard) setConfirmingDiscard(false);
      else requestClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = nextTrapIndex(items.length, index, e.shiftKey);
    // Only take over at the edges (or when focus escaped); normal Tab inside works natively.
    if (index === -1 || (e.shiftKey && index === 0) || (!e.shiftKey && index === items.length - 1)) {
      e.preventDefault();
      items[next]?.focus();
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => handleKey(e);

  // Focus can fall out of the panel without the user moving it: a focused
  // button that becomes disabled while an action runs drops focus to <body>.
  // Esc and Tab must still reach the topmost window, or the trap leaks.
  const handleKeyRef = useRef(handleKey);
  useEffect(() => {
    handleKeyRef.current = handleKey;
  });
  useEffect(() => {
    const onDocKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return; // the panel's own handler runs
      const modals = document.querySelectorAll('[aria-modal="true"]');
      if (modals[modals.length - 1] !== panel) return; // only the topmost window
      if (e.key === "Escape" || e.key === "Tab") handleKeyRef.current(e);
    };
    document.addEventListener("keydown", onDocKey);
    return () => document.removeEventListener("keydown", onDocKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/30 p-3 animate-[fadeIn_120ms_ease-out] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "flex max-h-[92vh] w-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-[dialogIn_160ms_var(--ease-out-quint)]",
          SIZE[size]
        )}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
              <span className="truncate">{title}</span>
              {dirty && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-subtle px-1.5 py-px text-3xs font-medium text-warning">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
                  Unsaved
                </span>
              )}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-xs text-ink-muted">
                {description}
              </p>
            )}
          </div>
          {titleActions}
          <button
            type="button"
            onClick={requestClose}
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {confirmingDiscard ? (
          <DiscardBar onKeep={() => setConfirmingDiscard(false)} onDiscard={onClose} />
        ) : (
          footer && (
            <WindowCloseContext.Provider value={requestClose}>
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-sunken px-4 py-2.5">{footer}</div>
            </WindowCloseContext.Provider>
          )
        )}
      </div>
    </div>
  );
}

/** Standard footer buttons so every window looks the same. */
export function WindowButton({
  children,
  variant = "default",
  ...props
}: React.ComponentProps<"button"> & { variant?: "default" | "primary" | "danger" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variant === "primary" && "bg-brand text-white hover:bg-brand-hover",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        variant === "default" && "border border-line bg-surface text-ink hover:bg-surface-sunken",
        props.className
      )}
    >
      {children}
    </button>
  );
}

/**
 * The footer's Cancel: closes the window the same way as Esc and the close
 * button, so unsaved changes ask "Discard changes?" first.
 */
export function WindowCancel({ children = "Cancel", disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) {
  const close = useContext(WindowCloseContext);
  return (
    <WindowButton disabled={disabled} onClick={close ?? onClick}>
      {children}
    </WindowButton>
  );
}

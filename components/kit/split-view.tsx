"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

const MIN = 320;
const MAX = 760;
const EVENT = "aakash:split-width";

function clamp(n: number) {
  return Math.round(Math.max(MIN, Math.min(MAX, n)));
}

/**
 * Split view (3.3): register on the left, record detail on the right.
 * ≥1024px the divider can be dragged (or moved with ←/→ when focused) and the
 * width is remembered; below that the detail opens as a full-height panel.
 */
export function SplitView({
  id,
  master,
  detail,
  detailTitle,
  onCloseDetail,
  defaultWidth = 420,
}: {
  id: string;
  master: ReactNode;
  /** The selected record's panel; null hides the pane. */
  detail: ReactNode | null;
  detailTitle?: string;
  onCloseDetail: () => void;
  defaultWidth?: number;
}) {
  const key = `aakash.split.${id}`;
  const stored = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    () => {
      try {
        return Number(localStorage.getItem(key)) || 0;
      } catch {
        return 0;
      }
    },
    () => 0
  );
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = dragWidth ?? (stored ? clamp(stored) : defaultWidth);
  const wide = useMediaQuery("(min-width: 1024px)");
  const containerRef = useRef<HTMLDivElement>(null);

  const persist = (w: number) => {
    try {
      localStorage.setItem(key, String(clamp(w)));
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(EVENT));
  };

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const right = containerRef.current?.getBoundingClientRect().right ?? window.innerWidth;
    const onMove = (ev: PointerEvent) => setDragWidth(clamp(right - ev.clientX));
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      persist(right - ev.clientX);
      setDragWidth(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Esc closes the narrow-screen panel.
  useEffect(() => {
    if (!detail || wide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, wide, onCloseDetail]);

  const header = (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
      {!wide && (
        <button type="button" onClick={onCloseDetail} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken cursor-pointer" aria-label="Back to list">
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{detailTitle}</p>
      {wide && (
        <button type="button" onClick={onCloseDetail} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink cursor-pointer" aria-label="Close detail">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="flex min-h-0 gap-0">
      <div className="min-w-0 flex-1">{master}</div>
      {detail && wide && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize detail pane"
            aria-valuenow={width}
            aria-valuemin={MIN}
            aria-valuemax={MAX}
            tabIndex={0}
            onPointerDown={startDrag}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                persist(width + (e.key === "ArrowLeft" ? 32 : -32));
              }
            }}
            className="group mx-1 flex w-2 shrink-0 cursor-col-resize items-center justify-center touch-none focus-visible:outline-none"
          >
            <span className="h-10 w-0.5 rounded-full bg-line-strong group-hover:bg-brand group-focus-visible:bg-brand" />
          </div>
          <aside
            aria-label={detailTitle ?? "Details"}
            className="sticky top-0 flex max-h-[calc(100vh-150px)] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface"
            style={{ width }}
          >
            {header}
            <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
          </aside>
        </>
      )}
      {detail && !wide && (
        <div role="dialog" aria-modal="true" aria-label={detailTitle ?? "Details"} className={cn("fixed inset-0 z-[70] flex flex-col bg-surface animate-[panelIn_160ms_var(--ease-out-quint)]")}>
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
        </div>
      )}
    </div>
  );
}

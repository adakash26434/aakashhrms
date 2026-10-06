"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

const MIN = 320;
const MAX = 760;
/** The register always keeps at least this much room beside the pane. */
const MASTER_MIN = 520;
const EVENT = "aakash:split-width";

function clamp(n: number) {
  return Math.round(Math.max(MIN, Math.min(MAX, n)));
}

/**
 * Split view (3.3): register on the left, record detail on the right.
 * ≥1024px the divider can be dragged (or moved with ←/→ when focused) and the
 * width is remembered; the register always keeps room for its columns, and
 * Expand shows the record across the whole area (Esc or "Show the list" goes
 * back). Below 1024px the detail opens as a full-height panel.
 */
export function SplitView({
  id,
  master,
  detail,
  detailTitle,
  onCloseDetail,
  defaultWidth,
}: {
  id: string;
  master: ReactNode;
  /** The selected record's panel; null hides the pane. */
  detail: ReactNode | null;
  detailTitle?: string;
  onCloseDetail: () => void;
  /** Width before the user drags the divider (default: a third of the area, 380–560px). */
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
  const [areaWidth, setAreaWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const wide = useMediaQuery("(min-width: 1024px)");
  const containerRef = useRef<HTMLDivElement>(null);

  // The area's width decides the default and how wide the pane may get.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAreaWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fallback = defaultWidth ?? (areaWidth ? Math.max(380, Math.min(560, areaWidth * 0.33)) : 420);
  const wanted = dragWidth ?? (stored ? clamp(stored) : fallback);
  // Never squeeze the register below MASTER_MIN (it would cut its columns); never below MIN either.
  const width = Math.round(areaWidth ? Math.max(MIN, Math.min(wanted, areaWidth - MASTER_MIN)) : wanted);
  const showExpanded = expanded && !!detail && wide;

  // Closing the record ends Expand: the next one opens beside the list again.
  const [hadDetail, setHadDetail] = useState(!!detail);
  if (hadDetail !== !!detail) {
    setHadDetail(!!detail);
    if (!detail) setExpanded(false);
  }

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

  // Esc closes the narrow-screen panel, or shows the list again from Expand.
  useEffect(() => {
    if (!detail || (wide && !expanded)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (wide) setExpanded(false);
      else onCloseDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, wide, expanded, onCloseDetail]);

  const iconButton = "flex h-7 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink cursor-pointer";
  const header = (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-3">
      {!wide && (
        <button type="button" onClick={onCloseDetail} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken cursor-pointer" aria-label="Back to list">
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{detailTitle}</p>
      {wide && (
        <button type="button" onClick={() => setExpanded((x) => !x)} className={cn(iconButton, "text-2xs font-medium")} title={showExpanded ? "Show the list again (Esc)" : "Show this record across the whole area"}>
          {showExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {showExpanded ? "Show the list" : "Expand"}
        </button>
      )}
      {wide && (
        <button type="button" onClick={onCloseDetail} className={cn(iconButton, "w-7 px-0")} aria-label="Close detail">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="flex min-h-0 gap-0">
      {/* Kept mounted while expanded, so the list keeps its sort, page and selection. */}
      <div className={cn("min-w-0 flex-1", showExpanded && "hidden")}>{master}</div>
      {detail && wide && (
        <>
          {!showExpanded && (
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
          )}
          <aside
            aria-label={detailTitle ?? "Details"}
            className={cn("sticky top-0 flex max-h-[calc(100vh-150px)] flex-col overflow-hidden rounded-lg border border-line bg-surface", showExpanded ? "min-w-0 flex-1" : "shrink-0")}
            style={showExpanded ? undefined : { width }}
          >
            {header}
            <div className="@container min-h-0 flex-1 overflow-y-auto">{detail}</div>
          </aside>
        </>
      )}
      {detail && !wide && (
        <div role="dialog" aria-modal="true" aria-label={detailTitle ?? "Details"} className={cn("fixed inset-0 z-[70] flex flex-col bg-surface animate-[panelIn_160ms_var(--ease-out-quint)]")}>
          {header}
          <div className="@container min-h-0 flex-1 overflow-y-auto">{detail}</div>
        </div>
      )}
    </div>
  );
}

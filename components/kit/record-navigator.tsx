"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isTypingTarget } from "@/lib/frame/shortcuts";
import { cn } from "@/lib/utils";

/**
 * Record navigator of desktop card pages: "◀ 2 of 37 ▶" steps to the previous
 * or next record in the register's order. Alt+PageUp / Alt+PageDown do the
 * same from the keyboard (not while typing or with a window open).
 */
export function RecordNavigator({
  position,
  total,
  prevHref,
  nextHref,
  noun = "record",
  className,
}: {
  position: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
  noun?: string;
  className?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "PageUp" && e.key !== "PageDown")) return;
      if (isTypingTarget(e.target as HTMLElement) || document.querySelector('[aria-modal="true"]')) return;
      const href = e.key === "PageUp" ? prevHref : nextHref;
      if (!href) return;
      e.preventDefault();
      router.push(href, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHref, nextHref, router]);

  if (total <= 0 || position <= 0) return null;
  const button = "flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink";
  return (
    <nav aria-label={`${noun} navigator`} className={cn("inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5", className)}>
      {prevHref ? (
        <button type="button" onClick={() => router.push(prevHref, { scroll: false })} className={cn(button, "cursor-pointer")} title={`Previous ${noun} (Alt+PgUp)`} aria-label={`Previous ${noun}`}>
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
      ) : (
        <span aria-hidden className={cn(button, "opacity-30")}>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}
      <span className="px-1.5 text-2xs tabular-nums text-ink-muted">
        {position} of {total}
      </span>
      {nextHref ? (
        <button type="button" onClick={() => router.push(nextHref, { scroll: false })} className={cn(button, "cursor-pointer")} title={`Next ${noun} (Alt+PgDn)`} aria-label={`Next ${noun}`}>
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      ) : (
        <span aria-hidden className={cn(button, "opacity-30")}>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

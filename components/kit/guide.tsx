"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { CircleHelp, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GuideStep {
  title: string;
  text: ReactNode;
}

const storageKey = (id: string) => `guide:${id}:hidden`;

// Hidden guides are a per-browser convenience: read from storage (false if blocked), shared by every guide on the page.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function isHidden(id: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(id)) === "1";
  } catch {
    return false;
  }
}

/**
 * "How this works" (E-help): a few numbered steps in plain words above a
 * screen whose rules aren't obvious (leave years, substitute leave). Shown
 * until the viewer hides it; "How does this work?" brings it back. Whether
 * it is hidden is a per-browser convenience, so a blocked storage just
 * shows it.
 */
export function Guide({ id, title, steps, note, className }: { id: string; title: string; steps: GuideStep[]; note?: ReactNode; className?: string }) {
  // The server render shows it; the browser then applies what this viewer chose.
  const hidden = useSyncExternalStore(subscribe, () => isHidden(id), () => false);
  const [hiddenNow, setHiddenNow] = useState<boolean | null>(null);
  const set = (next: boolean) => {
    setHiddenNow(next);
    try {
      if (next) window.localStorage.setItem(storageKey(id), "1");
      else window.localStorage.removeItem(storageKey(id));
    } catch {
      // Not remembered (storage blocked); this page still follows the click.
    }
    listeners.forEach((l) => l());
  };
  const shut = hiddenNow ?? hidden;

  if (shut) {
    return (
      <button type="button" onClick={() => set(false)} className={cn("inline-flex cursor-pointer items-center gap-1 text-2xs font-medium text-brand-strong hover:underline", className)}>
        <CircleHelp className="h-3.5 w-3.5" /> How does this work?
      </button>
    );
  }
  return (
    <section aria-label={title} className={cn("@container rounded-lg border border-info/25 bg-info-subtle/60 px-3 py-2.5", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <CircleHelp className="h-3.5 w-3.5 text-info" /> {title}
        </h3>
        <button type="button" onClick={() => set(true)} className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium text-ink-muted hover:bg-surface hover:text-ink" aria-label={`Hide: ${title}`}>
          <X className="h-3 w-3" /> Hide
        </button>
      </div>
      <ol className={cn("grid gap-2", steps.length >= 4 ? "@2xl:grid-cols-4 @lg:grid-cols-2" : "@xl:grid-cols-3")}>
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-2 rounded-md bg-surface px-2.5 py-2">
            <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info text-3xs font-bold text-white">
              {i + 1}
            </span>
            <span className="min-w-0 text-2xs leading-relaxed text-ink-muted">
              <span className="block text-xs font-semibold text-ink">{s.title}</span>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
      {note && <p className="mt-2 text-2xs text-ink-muted">{note}</p>}
    </section>
  );
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

// Row density preference (E5). UI preference only, stored per browser.
export type Density = "comfortable" | "compact";

const KEY = "aakash.density";
const EVENT = "aakash:density";

function read(): Density {
  try {
    return localStorage.getItem(KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useDensity(): [Density, (d: Density) => void] {
  const density = useSyncExternalStore(subscribe, read, () => "comfortable" as Density);
  const set = useCallback((d: Density) => {
    try {
      localStorage.setItem(KEY, d);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [density, set];
}

/** Row heights in px: comfortable 32 / compact 28 (design system §3). */
export const ROW_HEIGHT: Record<Density, number> = { comfortable: 32, compact: 28 };

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Unsaved-changes guard for full-page editors (4.2). While `dirty`:
 * - closing or reloading the tab asks the browser's own "Leave site?";
 * - clicking an in-app link holds the navigation and sets `pending`, so the
 *   page can show the DiscardBar;
 * - `guard(action)` does the same for the page's own Cancel / Back buttons.
 * The browser Back button is not intercepted (the App Router owns history).
 */
export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    // Capture phase on the document runs before Next's <Link> handler on the React root.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingAction(() => () => router.push(`${url.pathname}${url.search}${url.hash}`));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, router]);

  const guard = useCallback(
    (action: () => void) => {
      if (dirty) setPendingAction(() => action);
      else action();
    },
    [dirty]
  );

  return {
    /** A navigation is waiting for "Discard" or "Keep editing". */
    pending: pendingAction !== null,
    guard,
    discard: () => {
      const action = pendingAction;
      setPendingAction(null);
      action?.();
    },
    keep: () => setPendingAction(null),
  };
}

"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { placePopup } from "@/lib/kit/popup";

/**
 * Fixed-position style for a pop-up anchored to a field (lib/kit/popup.ts):
 * it is never clipped by a scrolling Window body or grid, opens upwards near
 * the bottom of the screen, and follows the field while anything scrolls.
 * Returns undefined while closed.
 */
export function usePopupPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  popup: { width?: number; height: number; matchWidth?: boolean; gap?: number; maxWidth?: number }
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);
  const { width, height, matchWidth, gap, maxWidth } = popup;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = placePopup(
        { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width },
        { width: window.innerWidth, height: window.innerHeight },
        { width, height, matchWidth, gap, maxWidth }
      );
      setStyle({ position: "fixed", top: p.top, bottom: p.bottom, left: p.left, right: p.right, width: p.width, maxHeight: p.maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, open, width, height, matchWidth, gap, maxWidth]);

  return open ? style : undefined;
}

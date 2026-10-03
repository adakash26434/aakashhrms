// Kit pop-ups (lists, calendar, country picker): where to draw them. They are
// placed on the screen (position: fixed) so a scrolling Window body or grid
// never clips them; they open upwards when there is not enough room below,
// and stay inside the screen sideways.

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}

export interface PopupPlacement {
  /** Distance from the top of the screen (opening downwards)… */
  top?: number;
  /** …or from the bottom (opening upwards, so a short list sits right above the field). */
  bottom?: number;
  /** From the left edge of the screen, or… */
  left?: number;
  /** …from the right edge, when a wide pop-up near the right side lines up with the field's right edge. */
  right?: number;
  /** Set when the pop-up matches the field's width. */
  width?: number;
  maxHeight: number;
  above: boolean;
}

const MARGIN = 8;

export function placePopup(
  anchor: Rect,
  viewport: { width: number; height: number },
  popup: { width?: number; height: number; matchWidth?: boolean; gap?: number; maxWidth?: number }
): PopupPlacement {
  const gap = popup.gap ?? 4;
  const below = viewport.height - anchor.bottom - gap - MARGIN;
  const above = anchor.top - gap - MARGIN;
  // Open upwards when it does not fit below and there is more room above.
  const openAbove = below < popup.height && above > below;
  const maxHeight = Math.max(80, Math.min(popup.height, openAbove ? above : below));
  const width = popup.matchWidth ? Math.max(anchor.width, popup.width ?? 0) : popup.width ?? anchor.width;
  // Start at the field's left edge; when the widest it may grow to would leave the screen,
  // line its right edge up with the field's instead (as desktop drop-downs do).
  const widest = Math.max(width, popup.maxWidth ?? 0);
  const side =
    anchor.left + widest > viewport.width - MARGIN
      ? { right: Math.max(MARGIN, viewport.width - Math.max(anchor.right, Math.min(viewport.width - MARGIN, anchor.left + width))) }
      : { left: Math.max(MARGIN, anchor.left) };
  return {
    ...(openAbove ? { bottom: viewport.height - anchor.top + gap } : { top: anchor.bottom + gap }),
    ...side,
    width: popup.matchWidth ? width : undefined,
    maxHeight,
    above: openAbove,
  };
}

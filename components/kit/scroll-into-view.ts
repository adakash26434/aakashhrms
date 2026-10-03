"use client";

// Element.scrollIntoView also scrolls ancestors with overflow: hidden, which
// pushes the app frame (title bar, status bar) out of view. This scrolls only
// the nearest scrollable container instead.

function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

export function scrollIntoContainer(
  el: HTMLElement,
  { block = "nearest", behavior = "smooth", margin = 96 }: { block?: "nearest" | "start" | "center"; behavior?: ScrollBehavior; margin?: number } = {}
) {
  const container = scrollParent(el);
  if (!container) return;
  const box = container.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  let delta = 0;
  if (block === "start") delta = rect.top - box.top - 16;
  else if (block === "center") delta = rect.top - box.top - (box.height - rect.height) / 2;
  // "nearest" keeps a margin so sticky headers and footers never cover the element.
  else if (rect.top < box.top + margin) delta = rect.top - box.top - margin;
  else if (rect.bottom > box.bottom - margin) delta = rect.bottom - box.bottom + margin;
  if (Math.abs(delta) > 1) container.scrollBy({ top: delta, behavior });
}

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Panel (4.1): a titled group box, the desktop "frame" around a block of
 * related content (Home queues, record side panels). Title bar with an
 * optional count and a "see all" link; body has no padding by default so
 * lists and grids can run edge to edge.
 */
export function Panel({
  title,
  icon,
  count,
  countTone = "neutral",
  meta,
  href,
  hrefLabel = "Open",
  actions,
  footer,
  padded,
  className,
  bodyClassName,
  children,
  id,
  level = 2,
  bodyMaxHeight,
}: {
  title: string;
  icon?: ReactNode;
  /** Shown next to the title, e.g. the number of waiting items. */
  count?: number;
  countTone?: "neutral" | "attention";
  /** Small trailing text in the title bar, e.g. "Kathmandu branch". */
  meta?: ReactNode;
  href?: string;
  hrefLabel?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  id?: string;
  /** Heading level of the title; 3 when the panel sits under a section heading. */
  level?: 2 | 3;
  /**
   * Height cap for the body (a Tailwind class, e.g. "max-h-80"). In a grid
   * row with items-stretch the row takes the tallest card's content up to
   * this cap, shorter cards stretch to match, and longer content scrolls
   * inside the body while the title bar stays put.
   */
  bodyMaxHeight?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  const Heading = level === 3 ? "h3" : "h2";
  return (
    // Outline one step darker than the dividers inside (line-strong vs line), so
    // boxes separate clearly from the canvas while rows inside stay quiet.
    <section id={id} aria-labelledby={headingId} className={cn("flex h-full min-w-0 flex-col rounded-lg border border-line-strong bg-surface shadow-sm", className)}>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
        {icon && <span className="text-ink-faint [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <Heading id={headingId} className="truncate text-sm font-semibold text-ink">
          {title}
        </Heading>
        {count !== undefined && (
          <span
            className={cn(
              "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-3xs font-semibold tabular-nums",
              countTone === "attention" && count > 0 ? "bg-warning text-white" : "bg-surface-sunken text-ink-muted"
            )}
          >
            {count}
          </span>
        )}
        {meta && <span className="hidden truncate text-2xs text-ink-faint sm:inline">{meta}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
          {href && (
            <Link
              href={href}
              className="inline-flex h-7 items-center gap-0.5 rounded-md px-2 text-2xs font-medium text-brand-strong hover:bg-brand-subtle"
            >
              {hrefLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </span>
      </header>
      {bodyMaxHeight ? (
        // Keyboard users can scroll the area too (focusable, labelled region).
        <div
          tabIndex={0}
          role="region"
          aria-label={`${title} list`}
          className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-thin outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus", bodyMaxHeight, padded && "p-4", bodyClassName)}
        >
          {children}
        </div>
      ) : (
        <div className={cn("min-h-0 flex-1", padded && "p-4", bodyClassName)}>{children}</div>
      )}
      {footer && <footer className="border-t border-line px-4 py-2">{footer}</footer>}
    </section>
  );
}

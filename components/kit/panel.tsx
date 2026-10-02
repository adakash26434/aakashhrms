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
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex min-w-0 flex-col rounded-lg border border-line bg-surface", className)}>
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        {icon && <span className="text-ink-faint [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <h2 id={headingId} className="truncate text-xs font-semibold text-ink">
          {title}
        </h2>
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
      <div className={cn("min-h-0 flex-1", padded && "p-3", bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-line px-3 py-2">{footer}</footer>}
    </section>
  );
}

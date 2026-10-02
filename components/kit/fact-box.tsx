import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Fact {
  label: string;
  value: ReactNode;
  /** Draws attention (e.g. negative leave balance, overdue). */
  tone?: "default" | "warning" | "danger" | "success";
  href?: string;
}

export interface FactSection {
  title: string;
  facts: Fact[];
}

const TONE: Record<NonNullable<Fact["tone"]>, string> = {
  default: "text-ink",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

/**
 * FactBox (E2, Business Central style): a compact context panel next to a
 * register or record (YTD gross / TDS / SSF, leave balance, open loans, pending
 * changes) that answers the next question without leaving the page.
 */
export function FactBox({ title, sections, footer, className }: { title?: string; sections: FactSection[]; footer?: ReactNode; className?: string }) {
  return (
    <aside className={cn("rounded-lg border border-line bg-surface", className)} aria-label={title ?? "Details"}>
      {title && <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink">{title}</p>}
      <div className="divide-y divide-line">
        {sections.map((section) => (
          <section key={section.title} className="px-3 py-2.5">
            <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">{section.title}</h3>
            <dl className="space-y-1">
              {section.facts.map((fact) => {
                const value = <span className={cn("text-right font-medium tabular-nums", TONE[fact.tone ?? "default"])}>{fact.value}</span>;
                return (
                  <div key={fact.label} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="text-ink-muted">{fact.label}</dt>
                    <dd>
                      {fact.href ? (
                        <Link href={fact.href} className="inline-flex items-center gap-0.5 hover:underline">
                          {value}
                          <ChevronRight className="h-3 w-3 text-ink-faint" />
                        </Link>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
      {footer && <div className="border-t border-line px-3 py-2">{footer}</div>}
    </aside>
  );
}

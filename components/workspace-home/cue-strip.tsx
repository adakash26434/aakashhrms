import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Cue {
  id: string;
  label: string;
  value: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  /** attention = needs action now; danger = overdue or blocking. */
  tone?: "neutral" | "attention" | "danger" | "good";
}

const EDGE: Record<NonNullable<Cue["tone"]>, string> = {
  neutral: "before:bg-transparent",
  good: "before:bg-success",
  attention: "before:bg-warning",
  danger: "before:bg-danger",
};

const VALUE: Record<NonNullable<Cue["tone"]>, string> = {
  neutral: "text-ink",
  good: "text-ink",
  attention: "text-warning",
  danger: "text-danger",
};

/**
 * Cues (Business Central role centre): one compact tile per work queue. The
 * number is the queue size; the tile links straight to the work. A coloured
 * top edge marks queues that need action, with the hint text saying why
 * (never colour alone).
 */
export function CueStrip({ cues }: { cues: Cue[] }) {
  if (cues.length === 0) return null;
  return (
    <nav aria-label="Work queues" className="mb-4">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {cues.map((cue) => {
          const tone = cue.tone ?? "neutral";
          const Icon = cue.icon;
          return (
            <li key={cue.id} className="min-w-0">
              <Link
                href={cue.href}
                className={cn(
                  "group relative flex h-full min-w-0 flex-col gap-1 overflow-hidden rounded-lg border border-line bg-surface px-3 pb-2.5 pt-3 transition-colors hover:border-line-strong hover:bg-surface-sunken",
                  "before:absolute before:inset-x-0 before:top-0 before:h-[3px]",
                  EDGE[tone]
                )}
              >
                <span className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-faint">
                  <Icon aria-hidden className="h-3.5 w-3.5" />
                  <span className="truncate">{cue.label}</span>
                </span>
                <span className={cn("truncate text-xl font-semibold leading-tight tabular-nums", VALUE[tone])}>{cue.value}</span>
                <span className="truncate text-2xs text-ink-muted group-hover:text-ink">{cue.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

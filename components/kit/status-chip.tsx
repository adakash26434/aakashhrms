import { Ban, Banknote, Check, CircleDashed, Clock, Dot, Eye, Lock, Pause, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { resolveStatus, STATUS_VOCABULARY, type StatusKey, type StatusTone } from "@/lib/kit/status";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "circle-dashed": CircleDashed,
  clock: Clock,
  eye: Eye,
  check: Check,
  lock: Lock,
  banknote: Banknote,
  x: X,
  ban: Ban,
  dot: Dot,
  pause: Pause,
  alert: TriangleAlert,
};

export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-surface-sunken text-ink-muted border-line",
  info: "bg-info-subtle text-info border-info/20",
  warning: "bg-warning-subtle text-warning border-warning/25",
  success: "bg-success-subtle text-success border-success/20",
  danger: "bg-danger-subtle text-danger border-danger/20",
  brand: "bg-brand-subtle text-brand-strong border-brand/20",
};

/**
 * Status chip (3.6). Pass a vocabulary key or any raw status string
 * ("UNDER_REVIEW", "Pending"); unknown values render neutrally with the raw text.
 */
export function StatusChip({
  status,
  label,
  className,
}: {
  status: StatusKey | string | null | undefined;
  /** Override the vocabulary label (e.g. "Locked & disbursed"). */
  label?: string;
  className?: string;
}) {
  const key = (status && status in STATUS_VOCABULARY ? status : resolveStatus(status)) as StatusKey | null;
  const def = key ? STATUS_VOCABULARY[key] : null;
  const Icon = def ? ICONS[def.icon] : Dot;
  const isDot = !def || def.icon === "dot";
  const text = label ?? def?.label ?? (status ? String(status) : "—");
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-2xs font-medium",
        TONE_CLASSES[def?.tone ?? "neutral"],
        className
      )}
    >
      <Icon aria-hidden className={cn("shrink-0", isDot ? "-mx-1.5 h-5 w-5" : "h-3 w-3")} strokeWidth={isDot ? 5 : 2} />
      {text}
    </span>
  );
}

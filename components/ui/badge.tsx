import { cn } from "@/lib/utils";

const variants = {
  default: "bg-zinc-50 text-zinc-700 border-zinc-200/60",
  success: "bg-emerald-50/70 text-emerald-800 border-emerald-200/50",
  warning: "bg-amber-50/70 text-amber-800 border-amber-200/50",
  info: "bg-sky-50/70 text-sky-800 border-sky-200/50",
  danger: "bg-rose-50/70 text-rose-800 border-rose-200/50",
  neutral: "bg-zinc-50 text-zinc-700 border-zinc-200/60",
  critical: "bg-rose-50/80 text-rose-900 border-rose-200/60",
  pending: "bg-amber-50/60 text-amber-800 border-amber-200/50",
  high: "bg-orange-50/70 text-orange-800 border-orange-200/50",
  medium: "bg-amber-50/70 text-amber-800 border-amber-200/50",
  low: "bg-zinc-50 text-zinc-600 border-zinc-200/50",
  "on-track": "bg-emerald-50/70 text-emerald-800 border-emerald-200/50",
  "needs-review": "bg-amber-50/70 text-amber-800 border-amber-200/50",
  draft: "bg-zinc-50 text-zinc-600 border-zinc-200/50",
} as const;

export type BadgeVariant = keyof typeof variants;

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: "sm" | "md";
}

export function Badge({
  children,
  variant = "default",
  className,
  size = "md",
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium border rounded-md select-none transition-colors",
        variants[variant] || variants.default,
        size === "sm" && "px-1.5 py-0.5 text-[11px]",
        size === "md" && "px-2 py-0.5 text-xs",
        className,
      )}
    >
      {children}
    </span>
  );
}

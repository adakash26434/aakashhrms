import { cn } from "@/lib/utils";

const variants = {
  default: "bg-gray-100/80 text-gray-700 border-gray-200/60",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
  warning: "bg-amber-50 text-amber-800 border-amber-200/60",
  info: "bg-payroll-light/70 text-payroll-navy border-payroll-light",
  danger: "bg-rose-50 text-rose-800 border-rose-200/60",
  neutral: "bg-slate-100 text-slate-700 border-slate-200/60",
  critical: "bg-rose-100 text-rose-900 border-rose-300",
  pending: "bg-yellow-50 text-yellow-800 border-yellow-200/60",
  high: "bg-orange-50 text-orange-800 border-orange-200/60",
  medium: "bg-amber-50 text-amber-800 border-amber-200/60",
  low: "bg-gray-100 text-gray-700 border-gray-200/60",
  "on-track": "bg-emerald-50 text-emerald-800 border-emerald-200/60",
  "needs-review": "bg-amber-50 text-amber-800 border-amber-200/60",
  draft: "bg-payroll-cream text-gray-600 border-payroll-light/80",
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
        "inline-flex items-center gap-1 font-semibold border rounded-md leading-none select-none transition-colors",
        variants[variant] || variants.default,
        size === "sm" && "px-1.5 py-0.5 text-[10px]",
        size === "md" && "px-2 py-1 text-xs",
        className,
      )}
    >
      {children}
    </span>
  );
}

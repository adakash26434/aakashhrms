import { cn } from "@/lib/utils";

const variants = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-[#d7e8d0] text-[#2e7d32]",
  danger: "bg-red-50 text-red-700",
  neutral: "bg-violet-50 text-violet-700",
  critical: "bg-red-50 text-red-700",
  pending: "bg-yellow-50 text-yellow-800",
  high: "bg-orange-50 text-orange-700",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-gray-100 text-gray-600",
  "on-track": "bg-[#d7e8d0] text-[#2e7d32]",
  "needs-review": "bg-amber-50 text-amber-800",
  draft: "bg-[#f6faf6] text-gray-600",
} as const;

type BadgeVariant = keyof typeof variants;

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  barClassName?: string;
}

export function Progress({ value, className, barClassName }: ProgressProps) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[#d7e8d0]", className)}>
      <div
        className={cn("h-full rounded-full bg-[#2e7d32] transition-all", barClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

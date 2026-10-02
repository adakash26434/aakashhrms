import { formatAmount, isNegativeAmount, type AmountFormatOptions } from "@/lib/kit/amount";
import { cn } from "@/lib/utils";

/**
 * Money (3.6): lakh grouping, tabular figures, negatives in red with a minus
 * (never colour alone). Right-align it in the cell, not here.
 */
export function Amount({
  value,
  className,
  emphasis,
  ...options
}: AmountFormatOptions & {
  value: number | string | null | undefined;
  className?: string;
  /** Bold, for totals and net pay. */
  emphasis?: boolean;
}) {
  const text = formatAmount(value, options);
  const negative = isNegativeAmount(value);
  return (
    <span
      className={cn("tabular-nums whitespace-nowrap", negative && "text-amount-negative", emphasis && "font-semibold", className)}
      title={options.compact ? formatAmount(value, { prefix: options.prefix }) : undefined}
    >
      {text}
    </span>
  );
}

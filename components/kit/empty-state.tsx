import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Empty state (3.6): says what is missing and what to do next. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-ink-faint">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Error state with a retry action; shows the support reference from toActionError. */
export function ErrorState({ message, reference, onRetry }: { message: string; reference?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-ink">Could not load this data</p>
      <p className="mt-1 max-w-sm text-xs text-ink-muted">{message}</p>
      {reference && <p className="mt-1 text-2xs text-ink-faint">Reference: {reference}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-8 rounded-md border border-line px-3 text-xs font-medium text-ink hover:bg-surface-sunken cursor-pointer"
        >
          Try again
        </button>
      )}
    </div>
  );
}

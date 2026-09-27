import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export interface TableShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  totalCount?: number;
  filteredCount?: number;
  actions?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  emptyState?: ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  isLoading?: boolean;
  loadingState?: ReactNode;
  children: ReactNode;
}

export function TableShell({
  title,
  totalCount,
  filteredCount,
  actions,
  toolbar,
  footer,
  emptyState,
  isEmpty = false,
  emptyTitle = "No records found",
  emptyDescription = "There are no records matching your current filter criteria.",
  emptyAction,
  isLoading = false,
  loadingState,
  children,
  className,
  ...props
}: TableShellProps) {
  const hasHeader = title || totalCount !== undefined || filteredCount !== undefined || actions;

  return (
    <div
      className={cn("flex flex-col w-full", className)}
      {...props}
    >
      {/* Optional title row — tight, left-aligned, no bounding box */}
      {hasHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {title && (
              <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
            )}
            {(totalCount !== undefined || filteredCount !== undefined) && (
              <span className="text-xs text-zinc-400 tabular-nums">
                {filteredCount !== undefined && filteredCount !== totalCount
                  ? `${filteredCount} of ${totalCount}`
                  : `${totalCount} records`}
              </span>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      )}

      {/* Filter / Toolbar slot — sits above the table divider */}
      {toolbar && (
        <div className="pb-2">
          {toolbar}
        </div>
      )}

      {/* Table area — anchored by a strong top hairline, no card box */}
      <div className="border-t border-zinc-200 relative overflow-x-auto">
        {isLoading ? (
          loadingState || (
            <div className="flex h-48 items-center justify-center">
              <div className="flex flex-col items-center gap-2.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
                <span className="text-xs text-zinc-400">Loading...</span>
              </div>
            </div>
          )
        ) : isEmpty ? (
          <div className="py-16">
            {emptyState || (
              <EmptyState
                compact
                title={emptyTitle}
                description={emptyDescription}
                action={emptyAction}
              />
            )}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Footer / Pagination */}
      {footer && (
        <div className="border-t border-zinc-200 pt-3 mt-1">
          {footer}
        </div>
      )}
    </div>
  );
}

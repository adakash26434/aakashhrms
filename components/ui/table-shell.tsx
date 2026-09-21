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
      className={cn(
        "flex flex-col rounded-2xl border border-payroll-light/80 bg-white shadow-payroll-xs overflow-hidden",
        className,
      )}
      {...props}
    >
      {/* Optional Top Title Bar with Counts and Actions */}
      {hasHeader && (
        <div className="flex items-center justify-between border-b border-payroll-light/60 px-5 py-3 bg-gray-50/40">
          <div className="flex items-center gap-3">
            {title && (
              <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
                {title}
              </h4>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(totalCount !== undefined || filteredCount !== undefined) && (
              <div className="text-[11px] font-medium text-gray-500">
                {filteredCount !== undefined && filteredCount !== totalCount ? (
                  <>
                    Showing <span className="font-semibold text-payroll-navy">{filteredCount}</span> of{" "}
                    <span className="font-semibold text-payroll-navy">{totalCount}</span> records
                  </>
                ) : (
                  <>
                    Total: <span className="font-semibold text-payroll-navy">{totalCount}</span> records
                  </>
                )}
              </div>
            )}
            {actions}
          </div>
        </div>
      )}

      {/* Toolbar Slot */}
      {toolbar && (
        <div className="border-b border-payroll-light/60 px-4 py-2.5 bg-white">
          {toolbar}
        </div>
      )}

      {/* Table Body / Loading / Empty State */}
      <div className="relative overflow-x-auto">
        {isLoading ? (
          loadingState || (
            <div className="flex h-48 items-center justify-center p-6">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-payroll-primary border-t-transparent" />
                <span className="text-xs text-gray-500">Loading data...</span>
              </div>
            </div>
          )
        ) : isEmpty ? (
          <div className="p-6">
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

      {/* Footer / Pagination Slot */}
      {footer && (
        <div className="border-t border-payroll-light/60 bg-gray-50/40 px-4 py-2.5">
          {footer}
        </div>
      )}
    </div>
  );
}

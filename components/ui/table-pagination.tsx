"use client";

import React, { useMemo, useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
  showPageSizeSelector?: boolean;
}

/**
 * Reusable table pagination footer with user-configurable rows-per-page limit,
 * dynamic numeric pagination window with ellipses, and responsive layout.
 */
export function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemName = "records",
  className,
  showPageSizeSelector = true,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startRecord = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(safePage * pageSize, totalItems);

  // Generate intelligent pagination window
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (safePage >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      safePage - 1,
      safePage,
      safePage + 1,
      "...",
      totalPages,
    ];
  }, [totalPages, safePage]);

  const handlePageSizeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
    onPageChange(1);
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-payroll-border bg-white text-xs text-gray-500",
        className
      )}
    >
      {/* Left Area: Rows per page selector + Showing items range */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Rows per page:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeSelect}
              className="h-7 rounded-md border border-payroll-border bg-white px-2 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:border-[#1e7e47] focus:outline-none focus:ring-1 focus:ring-[#1e7e47] cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {showPageSizeSelector && onPageSizeChange && (
          <span className="hidden sm:inline-block text-slate-200">|</span>
        )}

        <div>
          Showing{" "}
          <span className="font-semibold text-slate-800">
            {totalItems > 0 ? `${startRecord}–${endRecord}` : "0"}
          </span>{" "}
          of <span className="font-semibold text-slate-800">{totalItems}</span>{" "}
          {itemName}
        </div>
      </div>

      {/* Right Area: Pagination Navigation Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First Page */}
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => onPageChange(1)}
            className="hidden sm:flex h-7 w-7 rounded border border-payroll-border items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="First page"
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className="h-7 w-7 rounded border border-payroll-border flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {/* Page Number Buttons */}
          {pageNumbers.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="h-7 min-w-7 flex items-center justify-center text-xs text-gray-400 select-none"
                >
                  …
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === safePage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  "h-7 min-w-7 px-2 rounded flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer select-none",
                  isActive
                    ? "bg-[#1e7e47] text-white shadow-2xs"
                    : "border border-payroll-border text-gray-700 hover:bg-gray-50 hover:text-slate-900"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next Page */}
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className="h-7 w-7 rounded border border-payroll-border flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => onPageChange(totalPages)}
            className="hidden sm:flex h-7 w-7 rounded border border-payroll-border items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Last page"
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable hook to handle client-side table pagination state and calculations
 * effortlessly across any table in the system.
 */
export function useTablePagination<T>({
  totalItems,
  initialPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  totalItems: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginateList = useCallback(
    (items: T[]): T[] => {
      return items.slice(startIndex, endIndex);
    },
    [startIndex, endIndex]
  );

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  return {
    currentPage: safePage,
    setCurrentPage,
    pageSize,
    setPageSize: handlePageSizeChange,
    totalPages,
    startIndex,
    endIndex,
    paginateList,
    paginationProps: {
      currentPage: safePage,
      totalItems,
      pageSize,
      onPageChange: setCurrentPage,
      onPageSizeChange: handlePageSizeChange,
      pageSizeOptions,
    },
  };
}

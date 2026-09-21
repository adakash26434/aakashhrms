"use client";

import React, { ReactNode } from "react";
import { TableToolbar, TableToolbarProps } from "@/components/ui/table-toolbar";
import { cn } from "@/lib/utils";

export interface FilterBarProps extends TableToolbarProps {
  children?: ReactNode;
}

export function FilterBar({
  children,
  className,
  ...props
}: FilterBarProps) {
  if (children) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 py-1",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return <TableToolbar className={className} {...props} />;
}

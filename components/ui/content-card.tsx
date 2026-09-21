import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ContentCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  children: ReactNode;
}

export function ContentCard({
  title,
  subtitle,
  actions,
  footer,
  padding = "md",
  headerClassName,
  bodyClassName,
  footerClassName,
  className,
  children,
  ...props
}: ContentCardProps) {
  const paddingClasses = {
    none: "p-0",
    sm: "p-3.5",
    md: "p-5",
    lg: "p-6",
  };

  const hasHeader = title || subtitle || actions;

  return (
    <div
      className={cn(
        "rounded-2xl border border-payroll-light/80 bg-white shadow-payroll-xs overflow-hidden",
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-payroll-light/60 px-5 py-3.5",
            headerClassName,
          )}
        >
          <div className="min-w-0">
            {title && (
              <div className="text-sm font-bold text-payroll-navy tracking-tight truncate">
                {title}
              </div>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className={cn(paddingClasses[padding], bodyClassName)}>
        {children}
      </div>

      {footer && (
        <div
          className={cn(
            "border-t border-payroll-light/60 bg-gray-50/50 px-5 py-3 text-xs text-gray-500",
            footerClassName,
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

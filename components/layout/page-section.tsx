import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageSectionProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  variant?: "card" | "flat";
  headerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function PageSection({
  title,
  description,
  badge,
  actions,
  variant = "card",
  headerClassName,
  contentClassName,
  className,
  children,
  ...props
}: PageSectionProps) {
  const hasHeader = title || description || badge || actions;

  const cardClasses =
    variant === "card"
      ? "rounded-2xl border border-payroll-light/80 bg-white p-5 shadow-payroll-xs"
      : "";

  return (
    <section className={cn(cardClasses, className)} {...props}>
      {hasHeader && (
        <div
          className={cn(
            "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
            variant === "card" ? "mb-4 border-b border-payroll-light/60 pb-3" : "mb-3",
            headerClassName,
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {typeof title === "string" ? (
                <h3 className="text-base font-bold text-payroll-navy tracking-tight truncate">
                  {title}
                </h3>
              ) : (
                title
              )}
              {badge && <div>{badge}</div>}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-gray-500 max-w-2xl leading-relaxed">
                {description}
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
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
    </section>
  );
}

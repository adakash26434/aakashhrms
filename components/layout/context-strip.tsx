import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface ContextStripItem {
  label: string;
  value: ReactNode;
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | ReactNode;
  variant?: "default" | "success" | "warning" | "info";
}

export interface ContextStripProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: ContextStripItem[];
  actions?: ReactNode;
  children?: ReactNode;
}

function renderStripIcon(icon: ContextStripItem["icon"]) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === "function") {
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className="h-3.5 w-3.5" />;
  }
  return null;
}

export function ContextStrip({
  items,
  actions,
  children,
  className,
  ...props
}: ContextStripProps) {
  const variantStyles = {
    default: "bg-payroll-cream/70 text-payroll-navy border-payroll-light/80",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-payroll-light/80 bg-white px-3.5 py-2 text-xs shadow-payroll-xs",
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {items?.map((item, index) => {
          const renderedIcon = renderStripIcon(item.icon);

          return (
            <div
              key={index}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                variantStyles[item.variant || "default"],
              )}
            >
              {renderedIcon && (
                <span className="shrink-0 text-payroll-primary">
                  {renderedIcon}
                </span>
              )}
              <span className="text-gray-500 font-normal">{item.label}:</span>
              <span className="font-semibold">{item.value}</span>
            </div>
          );
        })}
        {children}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

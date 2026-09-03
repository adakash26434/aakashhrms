import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  default:
    "bg-payroll-primary text-white hover:bg-payroll-primary-hover shadow-payroll-xs hover:shadow-payroll-sm focus-visible:ring-payroll-primary",
  secondary:
    "bg-payroll-light text-payroll-navy hover:bg-payroll-light/80 shadow-payroll-xs focus-visible:ring-payroll-primary",
  outline:
    "border border-payroll-light bg-white text-payroll-navy hover:bg-payroll-cream hover:border-payroll-light/80 shadow-payroll-xs focus-visible:ring-payroll-primary",
  ghost:
    "text-payroll-primary hover:bg-payroll-light/40 hover:text-payroll-navy focus-visible:ring-payroll-primary",
  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-payroll-xs focus-visible:ring-red-500",
  subtle:
    "bg-payroll-cream text-payroll-navy border border-payroll-light/60 hover:bg-white hover:border-payroll-light focus-visible:ring-payroll-primary",
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export function Button({
  className,
  variant = "default",
  size = "md",
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium cursor-pointer transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variants[variant],
        size === "sm" && "px-3 py-1.5 text-xs min-h-8",
        size === "md" && "px-4 py-2 text-sm min-h-9.5",
        size === "lg" && "px-5 py-2.5 text-sm min-h-11",
        size === "icon" && "h-9 w-9 p-0",
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-current" />
          <span className="opacity-90">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

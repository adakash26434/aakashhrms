import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  default:
    "bg-payroll-primary text-white hover:bg-payroll-primary-hover shadow-2xs focus-visible:ring-payroll-primary",
  secondary:
    "bg-zinc-100 text-zinc-900 hover:bg-zinc-200/80 border border-zinc-200/80 shadow-2xs focus-visible:ring-zinc-950",
  outline:
    "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 shadow-2xs focus-visible:ring-zinc-950",
  ghost:
    "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-zinc-950",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 shadow-2xs focus-visible:ring-rose-500",
  subtle:
    "bg-zinc-50 text-zinc-800 border border-zinc-200/80 hover:bg-zinc-100 focus-visible:ring-zinc-950",
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: "xs" | "sm" | "md" | "lg" | "icon";
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
        "inline-flex items-center justify-center gap-2 rounded-md font-medium cursor-pointer transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        variants[variant],
        size === "xs" && "px-2.5 py-1 text-xs min-h-7 rounded-md",
        size === "sm" && "px-3 py-1.5 text-xs min-h-8 rounded-md",
        size === "md" && "px-4 py-2 text-xs sm:text-sm min-h-9 rounded-md",
        size === "lg" && "px-5 py-2.5 text-sm min-h-10 rounded-md",
        size === "icon" && "h-9 w-9 p-0 rounded-md",
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

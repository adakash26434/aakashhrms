"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <label className={cn(
        "relative inline-flex items-center justify-center",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}>
        <input
          type="checkbox"
          ref={ref}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <div
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors duration-150",
            checked
              ? "border-[#2e7d32] bg-[#2e7d32] text-white"
              : "border-gray-300 hover:border-gray-400 bg-white",
            !disabled && "peer-focus-visible:ring-2 peer-focus-visible:ring-[#2e7d32]/40 peer-focus-visible:ring-offset-1",
            className
          )}
        >
          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
        </div>
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";

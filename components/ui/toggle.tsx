"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className,
}: ToggleProps) {
  const generatedId = useId();
  const inputId = id ?? `toggle-${generatedId}`;

  return (
    <span
      className={cn("inline-flex items-center", className)}
      data-testid="toggle-row"
    >
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d32]/40 focus-visible:ring-offset-1",
          checked ? "bg-[#2e7d32]" : "bg-gray-300",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out",
            checked && "translate-x-5",
          )}
        />
      </button>
      {label && (
        <span className="ml-3 text-sm text-[#1b3a1f]">{label}</span>
      )}
    </span>
  );
}

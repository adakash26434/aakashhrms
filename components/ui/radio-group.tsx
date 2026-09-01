"use client";

import { cn } from "@/lib/utils";

export interface RadioOption<T extends string> {
  label: T;
  value: T;
}

interface RadioGroupProps<T extends string> {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<RadioOption<T>>;
  className?: string;
  optionClassName?: string;
  disabled?: boolean;
}

export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  className,
  optionClassName,
  disabled = false,
}: RadioGroupProps<T>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-5", className)}>
      {options.map((opt) => {
        const id = `${name}-${opt.value}`;
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 text-sm text-[#1b3a1f]",
              disabled && "cursor-not-allowed opacity-60",
              optionClassName,
            )}
          >
            <span className="relative inline-flex h-4 w-4 items-center justify-center">
              <input
                id={id}
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(opt.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "block h-4 w-4 rounded-full border-2 transition-colors duration-150",
                  checked
                    ? "border-[#2e7d32]"
                    : "border-gray-300 hover:border-gray-400",
                  !disabled &&
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-[#2e7d32]/40 peer-focus-visible:ring-offset-1",
                )}
              />
              {checked && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute h-2 w-2 rounded-full bg-[#2e7d32]"
                />
              )}
            </span>
            <span>{opt.value}</span>
          </label>
        );
      })}
    </div>
  );
}

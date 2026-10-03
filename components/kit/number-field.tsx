"use client";

import { useState } from "react";
import { inputClass } from "./property-form";
import { cn } from "@/lib/utils";

export interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  name?: string;
  id?: string;
  /** Decimal places allowed (0 for whole numbers). */
  decimals?: number;
  min?: number;
  disabled?: boolean;
  readOnly?: boolean;
  /** Shown before the number, e.g. "NPR". */
  prefix?: string;
  /** Show 0 instead of an empty box (when 0 is a real answer, not "not set"). */
  showZero?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

function display(value: number, decimals: number, showZero?: boolean): string {
  if (!value) return showZero ? "0" : "";
  return decimals > 0 ? value.toFixed(decimals).replace(/\.?0+$/, "") : String(Math.trunc(value));
}

/**
 * Number entry for amounts and counts (4.2): right-aligned tabular figures,
 * digits and one decimal point only, and partial input ("30000.") kept while
 * typing. Empty means 0.
 */
export function NumberField({ value, onChange, decimals = 2, min = 0, prefix, className, readOnly, showZero, ...rest }: NumberFieldProps) {
  const [text, setText] = useState<string | null>(null); // null = show the stored value
  const pattern = decimals > 0 ? new RegExp(`^\\d*(\\.\\d{0,${decimals}})?$`) : /^\d*$/;

  return (
    <div className={cn("relative w-full max-w-60", className)}>
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-2xs text-ink-faint">{prefix}</span>}
      <input
        type="text"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        autoComplete="off"
        readOnly={readOnly}
        value={text ?? display(value, decimals, readOnly || showZero)}
        onChange={(e) => {
          const next = e.target.value.replace(/,/g, "");
          if (!pattern.test(next)) return;
          setText(next);
          const n = next === "" || next === "." ? 0 : Number(next);
          if (!Number.isNaN(n)) onChange(Math.max(min, n));
        }}
        onBlur={() => setText(null)}
        className={cn(inputClass, "max-w-none text-right tabular-nums", prefix && "pl-11")}
        {...rest}
      />
    </div>
  );
}

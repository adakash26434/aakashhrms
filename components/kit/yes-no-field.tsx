"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { cn } from "@/lib/utils";

export interface YesNoFieldProps {
  value: boolean;
  onChange: (value: boolean) => void;
  name?: string;
  id?: string;
  yesLabel?: string;
  noLabel?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/**
 * Yes / No answer (4.2), in place of a checkbox, as desktop finance forms do.
 * One focus stop: Y or N answers, Space or ←/→ switch, Enter moves to the
 * next field; clicking either half chooses it.
 */
export function YesNoField({ value, onChange, name, id, yesLabel = "Yes", noLabel = "No", disabled, className, ...aria }: YesNoFieldProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "y") onChange(true);
    else if (key === "n") onChange(false);
    else if (key === "arrowleft" || key === "arrowright" || key === " ") onChange(!value);
    else return;
    e.preventDefault();
  };
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    // Which half was clicked decides the answer; a keyboard "click" (detail 0) is ignored here.
    if (e.detail === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onChange(e.clientX < rect.left + rect.width / 2);
  };

  return (
    <button
      id={id}
      name={name}
      type="button"
      role="switch"
      aria-checked={value}
      data-enter-field
      disabled={disabled}
      onKeyDown={onKeyDown}
      onClick={onClick}
      title="Y = yes · N = no · Space switches"
      className={cn(
        "inline-grid h-8 w-28 cursor-pointer grid-cols-2 rounded-md border border-line-input bg-white p-0.5 hover:border-line-input-hover text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...aria}
    >
      <span className={cn("flex items-center justify-center rounded-[5px]", value ? "bg-brand text-white" : "text-ink-muted")}>{yesLabel}</span>
      <span className={cn("flex items-center justify-center rounded-[5px]", !value ? "bg-switch-off text-white" : "text-ink-muted")}>{noLabel}</span>
    </button>
  );
}

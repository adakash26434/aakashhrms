"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { moveHighlight, typeaheadIndex } from "@/lib/kit/combobox";
import { useFormNav } from "./use-enter-navigation";
import { usePopupPosition } from "./use-popup-position";
import { inputClass } from "./property-form";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

export interface SelectFieldProps {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  /** Shown when nothing is chosen; also offered as a "clear" option when `allowEmpty`. */
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  /** Focus this field first when its window opens. */
  "data-autofocus"?: boolean;
}

/**
 * Drop-down list (4.2) that behaves the same with mouse and keyboard, unlike
 * the native <select>, whose open list swallows Enter on Windows.
 * Closed: ↑/↓ change the value, letters jump (type-ahead), Alt+↓ / F4 / Space
 * open, Enter moves to the next field. Open: ↑/↓ move, Enter picks and moves
 * on, Esc closes. Picking with the mouse keeps focus here, so Enter then
 * moves on.
 */
export function SelectField({
  options,
  value,
  onChange,
  name,
  id,
  placeholder = "Select…",
  allowEmpty,
  disabled,
  className,
  ...aria
}: SelectFieldProps) {
  const nav = useFormNav();
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const typed = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const items: SelectOption[] = allowEmpty ? [{ value: "", label: placeholder }, ...options] : [...options];
  const currentIndex = items.findIndex((o) => o.value === value);
  // On the screen, so a scrolling Window or grid never clips the list; at least as wide as the field.
  const placed = usePopupPosition(wrapRef, open, { height: Math.min(256, items.length * 32 + 8), matchWidth: true, maxWidth: 384 });
  const popupStyle = placed && { ...placed, width: undefined, minWidth: placed.width };
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    if (!open || !list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  }, [open, highlight]);

  const show = () => {
    if (disabled) return;
    setHighlight(currentIndex);
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = items[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const key = e.key;
    if (open) {
      if (key === "ArrowDown" || key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => moveHighlight(items.length, h, key === "ArrowDown" ? 1 : -1));
      } else if (key === "Home" || key === "End") {
        e.preventDefault();
        setHighlight(key === "Home" ? 0 : items.length - 1);
      } else if (key === "Enter" && !e.shiftKey) {
        // Handled here: pick, then move on ourselves.
        e.preventDefault();
        choose(highlight >= 0 ? highlight : currentIndex);
        nav?.advanceFrom(buttonRef.current);
      } else if (key === " ") {
        e.preventDefault();
        choose(highlight >= 0 ? highlight : currentIndex);
      } else if (key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      } else if (key === "Tab") {
        setOpen(false);
      } else if (key.length === 1 && /\S/.test(key)) {
        const index = jump(key);
        if (index >= 0) setHighlight(index);
      }
      return;
    }
    if ((key === "ArrowDown" && e.altKey) || key === "F4" || key === " ") {
      e.preventDefault();
      show();
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault();
      const next = moveHighlight(items.length, currentIndex, key === "ArrowDown" ? 1 : -1);
      if (next >= 0) onChange(items[next].value);
    } else if ((key === "Delete" || key === "Backspace") && allowEmpty && value) {
      e.preventDefault();
      onChange("");
    } else if (key.length === 1 && /\S/.test(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const index = jump(key);
      if (index >= 0) onChange(items[index].value);
    }
  };

  /** Letters typed within 700 ms build one search, as in Windows lists. */
  const jump = (key: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at < 700 ? typed.current.text + key : key, at: now };
    return typeaheadIndex(
      items.map((o) => o.label),
      typed.current.text,
      open ? highlight : currentIndex
    );
  };

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <button
        ref={buttonRef}
        id={id}
        name={name}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && highlight >= 0 ? `${listId}-${highlight}` : undefined}
        data-enter-field
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(inputClass, "flex max-w-none cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60")}
        {...aria}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-ink-faint")}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={aria["aria-label"] ?? placeholder}
          style={popupStyle}
          className="fixed z-[90] overflow-y-auto rounded-md border border-line-strong bg-surface py-1 shadow-lg scroll-thin"
        >
          {items.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value || "__empty"}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => {
                  choose(index);
                  buttonRef.current?.focus();
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 whitespace-nowrap px-2.5 py-1.5 text-sm",
                  index === highlight && "bg-brand-subtle",
                  option.value === "" ? "text-ink-faint" : "text-ink"
                )}
              >
                <Check aria-hidden className={cn("h-3.5 w-3.5 shrink-0 text-brand", !isSelected && "invisible")} />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint && <span className="shrink-0 text-2xs text-ink-faint">{option.hint}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { filterOptions, moveHighlight, type ComboOption } from "@/lib/kit/combobox";
import { useFormNav } from "./use-enter-navigation";
import { usePopupPosition } from "./use-popup-position";
import { inputClass } from "./property-form";
import { cn } from "@/lib/utils";

export type { ComboOption };

export interface ComboboxProps {
  options: readonly ComboOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Shows a clear button and lets an emptied field save as "". */
  allowClear?: boolean;
  /** Text when nothing matches. */
  emptyText?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

/**
 * Searchable single-choice field (4.2). Type to filter, ↑/↓ to move, Enter
 * picks and moves to the next field, Esc closes and restores, the mouse works
 * as usual (picking with the mouse does not move focus on).
 */
export function Combobox({
  options,
  value,
  onChange,
  name,
  id,
  placeholder = "Type to search",
  disabled,
  readOnly,
  allowClear,
  emptyText = "No matches",
  className,
  ...aria
}: ComboboxProps) {
  const nav = useFormNav();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null); // null = not typing; show the selected label
  const [highlight, setHighlight] = useState(-1);

  const matches = useMemo(() => filterOptions(options, query ?? ""), [options, query]);
  // On the screen, so a scrolling Window or grid never clips the list (lib/kit/popup.ts).
  const placed = usePopupPosition(inputRef, open, { height: Math.min(256, Math.max(1, matches.length) * 32 + 8), matchWidth: true, maxWidth: 384 });
  // At least as wide as the field, wider for long names (up to 24rem).
  const popupStyle = placed && { ...placed, width: undefined, minWidth: placed.width, maxWidth: "min(24rem, calc(100vw - 1rem))" };
  const text = query ?? selected?.label ?? "";

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!open || highlight < 0) return;
    // Scroll the list only (never the page around it).
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  }, [open, highlight]);

  /**
   * Opening with the mouse highlights only the current value, so a click then
   * Enter never picks an option the user did not choose. Opening with ↑/↓
   * starts the highlight at the first option.
   */
  const openList = (by: "mouse" | "keyboard") => {
    if (disabled || readOnly) return;
    setOpen(true);
    const current = matches.findIndex((o) => o.value === value);
    setHighlight(current >= 0 ? current : by === "keyboard" && matches.length ? 0 : -1);
  };

  const close = () => {
    setOpen(false);
    setQuery(null);
    setHighlight(-1);
  };

  const pick = (option: ComboOption) => {
    if (option.value !== value) onChange(option.value);
    close();
  };

  const commitTyped = () => {
    // An emptied field clears the value when that is allowed; otherwise the old value stays.
    if (query !== null && query.trim() === "" && allowClear && value) onChange("");
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) return openList("keyboard");
        setHighlight((h) => moveHighlight(matches.length, h, e.key === "ArrowDown" ? 1 : -1));
        return;
      }
      case "Enter": {
        if (e.nativeEvent.isComposing || e.shiftKey) return;
        if (open && highlight >= 0 && matches[highlight]) {
          // Handled here: the form must not also move on, so we advance ourselves.
          e.preventDefault();
          pick(matches[highlight]);
          nav?.advanceFrom(inputRef.current);
          return;
        }
        if (open) commitTyped();
        return; // the form checks the field and moves on
      }
      case "Escape": {
        if (!open && query === null) return;
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      case "Tab": {
        if (open && query && highlight >= 0 && matches[highlight]) pick(matches[highlight]);
        else if (open) commitTyped();
        return;
      }
    }
  };

  const activeId = open && highlight >= 0 ? `${listId}-${highlight}` : undefined;

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        disabled={disabled}
        readOnly={readOnly}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(e.target.value.trim() ? 0 : -1);
        }}
        onClick={() => (open ? undefined : openList("mouse"))}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (open || query !== null) commitTyped();
        }}
        className={cn(inputClass, "max-w-none pr-14")}
        {...aria}
      />
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2 text-ink-faint">
        {allowClear && value && !disabled && !readOnly && (
          <button
            type="button"
            tabIndex={-1}
            data-enter-skip
            aria-label="Clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              close();
              inputRef.current?.focus();
            }}
            className="pointer-events-auto flex h-5 w-5 cursor-pointer items-center justify-center rounded hover:bg-surface-sunken hover:text-ink"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown aria-hidden className="h-4 w-4" />
      </span>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={placeholder}
          style={popupStyle}
          className="fixed z-[90] overflow-y-auto rounded-md border border-line-strong bg-surface py-1 shadow-lg scroll-thin"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-ink-faint">{emptyText}</li>
          ) : (
            matches.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => {
                    pick(option);
                    inputRef.current?.focus(); // keep the keyboard here so Enter moves on next
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm text-ink",
                    index === highlight && "bg-brand-subtle"
                  )}
                >
                  <Check aria-hidden className={cn("h-3.5 w-3.5 shrink-0 text-brand", !isSelected && "invisible")} />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint && <span className="shrink-0 text-2xs text-ink-faint">{option.hint}</span>}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

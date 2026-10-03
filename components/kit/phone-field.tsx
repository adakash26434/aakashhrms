"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js/core";
import metadata from "libphonenumber-js/metadata.min.json";
import { ALL_COUNTRIES, COUNTRY_SEARCH_OPTIONS, DEFAULT_PHONE_COUNTRY } from "@/lib/constants/countries";
import { filterOptions, moveHighlight } from "@/lib/kit/combobox";
import { countryOfTyped, joinPhone, splitPhone } from "@/lib/utils/phone";
import { inputClass } from "./property-form";
import { cn } from "@/lib/utils";

export interface PhoneFieldProps {
  /** Stored value: E.164 ("+9779841123456") or "". */
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

/**
 * Phone number with its country (4.2), as the original form had: a country
 * button joined to the number box. The list holds every country (Nepal
 * first) and is searched by name, code or dial code ("977", "india", "IN").
 * Typing "+91 …" in the number switches the country by itself. Enter in the
 * number moves to the next field; the country button is reached with Tab or
 * the mouse and never stops Enter. Stores one E.164 string.
 */
export function PhoneField({ value, onChange, name, id, placeholder, disabled, className, ...aria }: PhoneFieldProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const emitted = useRef(value);
  const [{ country, national }, setParts] = useState(() => splitPhone(value, DEFAULT_PHONE_COUNTRY));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const matches = useMemo(() => filterOptions(COUNTRY_SEARCH_OPTIONS, query, COUNTRY_SEARCH_OPTIONS.length), [query]);

  // A value set from outside (load, "Save & add another") is split again; our own edits are not.
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setParts(splitPhone(value, DEFAULT_PHONE_COUNTRY));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setQuery("");
      setHighlight(-1);
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

  const emit = (next: string) => {
    emitted.current = next;
    if (next !== value) onChange(next);
  };

  const show = () => {
    if (disabled) return;
    setQuery("");
    setHighlight(COUNTRY_SEARCH_OPTIONS.findIndex((o) => o.value === country));
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
  };
  const close = () => {
    setOpen(false);
    setQuery("");
    setHighlight(-1);
  };

  const pickCountry = (code: CountryCode) => {
    setParts({ country: code, national });
    emit(joinPhone(code, national));
    close();
    inputRef.current?.focus({ preventScroll: true });
  };

  const typeNumber = (text: string) => {
    // Digits, spaces and dashes; a "+" only at the start (an international number).
    const cleaned = text.replace(/[^\d\s+-]/g, "").replace(/(?!^)\+/g, "");
    if (cleaned.startsWith("+")) {
      const detected = countryOfTyped(cleaned);
      if (detected) {
        const dial = getCountryCallingCode(detected, metadata);
        const rest = cleaned.slice(1).trimStart().slice(dial.length).replace(/^[\s-]+/, "");
        setParts({ country: detected, national: rest });
        emit(joinPhone(detected, rest));
        return;
      }
      setParts({ country, national: cleaned });
      emit(cleaned.replace(/[\s-]/g, ""));
      return;
    }
    setParts({ country, national: cleaned });
    emit(joinPhone(country, cleaned));
  };

  const onNumberKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "ArrowDown" && e.altKey) || e.key === "F4") {
      e.preventDefault();
      show();
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => moveHighlight(matches.length, h, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      // Picks the country and returns to the number; the form does not move on.
      e.preventDefault();
      const option = matches[highlight] ?? (query.trim() ? matches[0] : undefined);
      if (option) pickCountry(option.value as CountryCode);
      else {
        close();
        inputRef.current?.focus({ preventScroll: true });
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      buttonRef.current?.focus({ preventScroll: true });
    } else if (e.key === "Tab") {
      close();
    }
  };

  const dial = getCountryCallingCode(country, metadata);
  const countryName = ALL_COUNTRIES.find((c) => c.code === country)?.name ?? country;

  return (
    <div ref={wrapRef} className={cn("relative flex w-full max-w-md items-stretch", className)}>
      <button
        ref={buttonRef}
        type="button"
        data-enter-skip
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country: ${countryName} (+${dial}). Change country`}
        title={`${countryName} (+${dial})`}
        onClick={() => (open ? close() : show())}
        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-l-md border border-r-0 border-line-input bg-surface-sunken px-2 font-code text-xs font-medium text-ink transition-colors hover:bg-surface-panel focus:z-10 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-ink-muted">{country}</span>
        <span>+{dial}</span>
        <ChevronDown aria-hidden className="h-3 w-3 text-ink-faint" />
      </button>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        spellCheck={false}
        maxLength={24}
        disabled={disabled}
        placeholder={placeholder}
        value={national}
        onChange={(e) => typeNumber(e.target.value)}
        onKeyDown={onNumberKeyDown}
        className={cn(inputClass, "min-w-0 flex-1 rounded-l-none font-code")}
        {...aria}
      />

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-line-strong bg-surface shadow-lg">
          <div className="relative border-b border-line p-1.5">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
              aria-label="Search country, code or dial code"
              data-enter-skip
              autoComplete="off"
              spellCheck={false}
              placeholder="Country, code or +dial"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(e.target.value.trim() ? 0 : -1);
              }}
              onKeyDown={onSearchKeyDown}
              className={cn(inputClass, "h-7.5 max-w-none pl-7 text-xs")}
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Countries" className="max-h-64 overflow-y-auto py-1 scroll-thin">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-xs text-ink-faint">No country matches</li>
            ) : (
              matches.map((option, index) => {
                const isSelected = option.value === country;
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => pickCountry(option.value as CountryCode)}
                    className={cn("flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm text-ink", index === highlight && "bg-brand-subtle")}
                  >
                    <Check aria-hidden className={cn("h-3.5 w-3.5 shrink-0 text-brand", !isSelected && "invisible")} />
                    <span className="w-6 shrink-0 font-code text-2xs text-ink-muted">{option.value}</span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <span className="shrink-0 font-code text-2xs text-ink-faint">{option.hint}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Bookmark, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  id: string;
  label: string;
  options: FilterOption[];
  /** Label of the "no filter" choice, e.g. "All departments". */
  allLabel?: string;
}

export type FilterValues = Record<string, string>;

interface SavedView {
  name: string;
  values: FilterValues;
}

const VIEWS_EVENT = "aakash:saved-views";
const ALL = "";

function viewsKey(id: string) {
  return `aakash.views.${id}`;
}

function readViewsRaw(id: string): string {
  try {
    return localStorage.getItem(viewsKey(id)) ?? "[]";
  } catch {
    return "[]";
  }
}

/**
 * Filter strip (3.2): inline filters + search, a chip per applied filter, and
 * saved views. Saved views keep only filter choices (ids such as a department),
 * never the search text, so no names or other personal data reach storage.
 */
export function FilterStrip({
  id,
  filters,
  values,
  onChange,
  search,
  className,
}: {
  id: string;
  filters: FilterDef[];
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  className?: string;
}) {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener(VIEWS_EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(VIEWS_EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => readViewsRaw(id),
    () => "[]"
  );
  const views = useMemo<SavedView[]>(() => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v) => v && typeof v.name === "string" && v.values && typeof v.values === "object").slice(0, 12) : [];
    } catch {
      return [];
    }
  }, [raw]);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [viewName, setViewName] = useState("");

  const applied = filters
    .map((f) => ({ f, value: values[f.id] ?? ALL }))
    .filter(({ value }) => value !== ALL)
    .map(({ f, value }) => ({ id: f.id, label: f.label, valueLabel: f.options.find((o) => o.value === value)?.label ?? value }));

  const saveViews = (next: SavedView[]) => {
    try {
      localStorage.setItem(viewsKey(id), JSON.stringify(next));
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(VIEWS_EVENT));
  };

  const set = (filterId: string, value: string) => onChange({ ...values, [filterId]: value });
  const knownIds = new Set(filters.map((f) => f.id));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <label className="relative min-w-48 flex-1 sm:max-w-xs">
            <span className="sr-only">Search</span>
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? "Search"}
              maxLength={100}
              className="h-8 w-full rounded-md border border-line-strong bg-white pl-8 pr-2.5 text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
        )}
        {filters.map((f) => {
          const active = (values[f.id] ?? ALL) !== ALL;
          return (
            <label key={f.id} className="relative">
              <span className="sr-only">{f.label}</span>
              <select
                value={values[f.id] ?? ALL}
                onChange={(e) => set(f.id, e.target.value)}
                className={cn(
                  "h-8 appearance-none rounded-md border bg-white pl-2.5 pr-7 text-sm cursor-pointer",
                  active ? "border-brand/50 bg-brand-subtle font-medium text-brand-strong" : "border-line-strong text-ink"
                )}
              >
                <option value={ALL}>{f.allLabel ?? `All ${f.label.toLowerCase()}`}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            </label>
          );
        })}

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setViewsOpen((v) => !v)}
            aria-expanded={viewsOpen}
            className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer"
          >
            <Bookmark className="h-3.5 w-3.5" /> Views
          </button>
          {viewsOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-line bg-surface p-1.5 shadow-lg">
              {views.length === 0 && <p className="px-2 py-2 text-xs text-ink-faint">No saved views yet.</p>}
              {views.map((v) => (
                <div key={v.name} className="flex items-center gap-1 rounded hover:bg-surface-sunken">
                  <button
                    type="button"
                    onClick={() => {
                      const clean: FilterValues = {};
                      for (const [k, val] of Object.entries(v.values)) if (knownIds.has(k) && typeof val === "string") clean[k] = val;
                      onChange(clean);
                      setViewsOpen(false);
                    }}
                    className="flex-1 truncate px-2 py-1.5 text-left text-sm text-ink cursor-pointer"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveViews(views.filter((x) => x.name !== v.name))}
                    className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:text-danger cursor-pointer"
                    aria-label={`Delete view ${v.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="mt-1 border-t border-line pt-1.5">
                {naming ? (
                  <form
                    className="flex gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = viewName.trim().slice(0, 40);
                      if (!name) return;
                      const onlyFilters: FilterValues = {};
                      for (const f of filters) if ((values[f.id] ?? ALL) !== ALL) onlyFilters[f.id] = values[f.id];
                      saveViews([{ name, values: onlyFilters }, ...views.filter((x) => x.name !== name)].slice(0, 12));
                      setNaming(false);
                      setViewName("");
                    }}
                  >
                    <input
                      autoFocus
                      value={viewName}
                      onChange={(e) => setViewName(e.target.value)}
                      placeholder="View name"
                      maxLength={40}
                      className="h-7 min-w-0 flex-1 rounded-md border border-line-strong px-2 text-xs"
                    />
                    <button type="submit" className="h-7 rounded-md bg-brand px-2 text-xs font-medium text-white cursor-pointer">
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={applied.length === 0}
                    onClick={() => setNaming(true)}
                    className="w-full rounded px-2 py-1.5 text-left text-xs font-medium text-brand hover:bg-surface-sunken disabled:text-ink-faint disabled:hover:bg-transparent cursor-pointer"
                  >
                    Save current filters as a view…
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {applied.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Applied filters">
          {applied.map((a) => (
            <span key={a.id} className="inline-flex h-6 items-center gap-1 rounded-full border border-brand/25 bg-brand-subtle pl-2.5 pr-1 text-2xs text-brand-strong">
              <span className="text-ink-muted">{a.label}:</span> {a.valueLabel}
              <button
                type="button"
                onClick={() => set(a.id, ALL)}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-brand/15 cursor-pointer"
                aria-label={`Remove ${a.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange({})}
            className="h-6 rounded-full px-2 text-2xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

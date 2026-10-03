"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ENTER_FIELD_SELECTOR } from "@/lib/kit/form-nav";
import { cn } from "@/lib/utils";
import { scrollIntoContainer } from "./scroll-into-view";

export interface SectionIndexItem {
  /** The id of the section element on the page. */
  id: string;
  label: string;
  /** complete: every required field filled · error: has errors · todo: required fields missing · optional: nothing required */
  state: "complete" | "error" | "todo" | "optional";
  errors?: number;
  /** Required fields filled / required, shown as "4/6" while not complete. */
  filled?: number;
  required?: number;
}

function jumpTo(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  scrollIntoContainer(section, { block: "start" });
  // Start typing straight away, as in a desktop form.
  const first = Array.from(section.querySelectorAll<HTMLElement>(ENTER_FIELD_SELECTOR)).find(
    (el) => !(el as HTMLInputElement).disabled && !(el as HTMLInputElement).readOnly
  );
  first?.focus({ preventScroll: true });
}

/**
 * Section index for long full-page forms (4.2): a sticky list beside the form
 * that shows where you are, which sections are done and which have errors.
 * Clicking jumps to the section and focuses its first field. Below 1024px it
 * becomes a "Jump to section" select above the form.
 */
export function SectionIndex({ items, label = "Sections", className }: { items: SectionIndexItem[]; label?: string; className?: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const ids = items.map((i) => i.id).join("|");

  // F6 / Shift+F6 jump to the next / previous section (the desktop key for moving between panes).
  useEffect(() => {
    const list = ids.split("|");
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F6" || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[aria-modal="true"]')) return;
      const current = list.findIndex((id) => document.getElementById(id)?.contains(document.activeElement));
      const from = current >= 0 ? current : list.indexOf(active);
      const next = list[(from + (e.shiftKey ? -1 : 1) + list.length) % list.length];
      if (!next) return;
      e.preventDefault();
      setActive(next);
      jumpTo(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids, active]);

  useEffect(() => {
    const sections = ids
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // The band a third of the way down the screen decides which section is "current".
      { rootMargin: "-25% 0px -65% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [ids]);

  return (
    <>
      <label className="mb-3 flex items-center gap-2 lg:hidden">
        <span className="text-xs font-medium text-ink-muted">Jump to section</span>
        <select
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            jumpTo(e.target.value);
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
              {item.errors ? ` (${item.errors} to fix)` : item.state === "complete" ? " ✓" : ""}
            </option>
          ))}
        </select>
      </label>

      <nav aria-label={label} className={cn("hidden lg:block", className)}>
        <p className="mb-2 px-2 text-3xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
        <ol className="space-y-0.5">
          {items.map((item) => {
            const isActive = item.id === active;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => {
                    setActive(item.id);
                    jumpTo(item.id);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                    isActive ? "bg-brand-subtle font-semibold text-brand-strong" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  )}
                >
                  <StateMark state={item.state} errors={item.errors} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.state === "todo" && item.required ? (
                    <span className="shrink-0 text-3xs font-normal tabular-nums text-ink-faint">
                      {item.filled ?? 0}/{item.required}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 px-2 text-3xs leading-relaxed text-ink-faint">
          <kbd className="rounded border border-line bg-surface px-1 font-sans">F6</kbd> next section ·{" "}
          <kbd className="rounded border border-line bg-surface px-1 font-sans">Shift F6</kbd> back
        </p>
      </nav>
    </>
  );
}

function StateMark({ state, errors }: { state: SectionIndexItem["state"]; errors?: number }) {
  if (state === "error") {
    return (
      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-3xs font-semibold text-white" aria-label={`${errors ?? 0} to fix`}>
        {errors ?? "!"}
      </span>
    );
  }
  if (state === "complete") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-label="Complete">
        <Check aria-hidden className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span
      aria-label={state === "todo" ? "Not finished" : "Optional"}
      className={cn("h-4 w-4 shrink-0 rounded-full border-2", state === "todo" ? "border-line-strong" : "border-dashed border-line")}
    />
  );
}

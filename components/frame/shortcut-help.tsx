"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { CONTEXT_SHORTCUTS, GLOBAL_SHORTCUTS } from "@/lib/frame/shortcuts";
import { useFrame } from "./frame-context";
import { Keys } from "./command-palette";

/** "?" overlay (2.7), generated from the same list the key handler uses. */
export function ShortcutHelp() {
  const { helpOpen, setHelpOpen } = useFrame();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (helpOpen) requestAnimationFrame(() => closeRef.current?.focus());
  }, [helpOpen]);

  if (!helpOpen) return null;
  const groups = ["General", "Navigation", "Session"] as const;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/25 p-4 animate-[fadeIn_120ms_ease-out]" onMouseDown={() => setHelpOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Tab") {
            e.preventDefault();
            if (e.key === "Escape") setHelpOpen(false);
          }
        }}
        className="w-full max-w-lg rounded-xl border border-line bg-surface shadow-2xl animate-[dialogIn_160ms_var(--ease-out-quint)]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="shortcut-help-title" className="text-sm font-semibold text-ink">Keyboard shortcuts</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setHelpOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-3">
          {groups.map((group) => (
            <section key={group}>
              <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">{group}</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                {GLOBAL_SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 px-3 py-2">
                    <dt className="text-sm text-ink">{s.label}</dt>
                    <dd><Keys keys={s.keys} /></dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section>
            <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">In menus, windows and the palette</h3>
            <dl className="divide-y divide-line rounded-lg border border-line">
              {CONTEXT_SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-sm text-ink">{s.label}</dt>
                  <dd><Keys keys={s.keys} /></dd>
                </div>
              ))}
            </dl>
          </section>
          <p className="text-2xs text-ink-faint">Register and form shortcuts (New, Save, Export, Print) arrive as each module moves to the new layout.</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Fragment, useMemo } from "react";
import { Lock } from "lucide-react";
import { ACTIONS, ACTION_LABEL, grantKey } from "@/lib/engines/role.engine";
import { MODULE_CATEGORIES, type ActionType, type ModuleType } from "@/lib/types/role";
import { cn } from "@/lib/utils";

// The permission matrix (4.13b): modules down, actions across, grouped by area. View comes with
// any other action on a module (and taking View away takes the module's other actions with it);
// a cell the viewer can't give is greyed with the reason; changed cells are tinted until saved.

export interface MatrixProps {
  /** Ticked now. */
  value: ReadonlySet<string>;
  /** As saved (for the changed-cell tint). */
  baseline: ReadonlySet<string>;
  editable: boolean;
  /** Why this cell can't be given by the viewer (null: it can). */
  blockedReason: (key: string) => string | null;
  onChange: (next: Set<string>) => void;
  search: string;
  onlyTicked: boolean;
}

export function RoleMatrix({ value, baseline, editable, blockedReason, onChange, search, onlyTicked }: MatrixProps) {
  const q = search.trim().toLowerCase();
  const categories = useMemo(
    () =>
      MODULE_CATEGORIES.map((c) => ({
        ...c,
        modules: c.modules.filter(
          (m) =>
            (!q || `${m.label} ${m.description} ${c.name}`.toLowerCase().includes(q)) && (!onlyTicked || m.allowedActions.some((a) => value.has(grantKey(a, m.key))))
        ),
      })).filter((c) => c.modules.length),
    [q, onlyTicked, value]
  );

  const update = (fn: (next: Set<string>) => void) => {
    const next = new Set(value);
    fn(next);
    onChange(next);
  };
  const add = (next: Set<string>, key: string) => {
    if (!blockedReason(key)) next.add(key);
  };

  const toggle = (module: ModuleType, action: ActionType, allowed: readonly ActionType[], on: boolean) =>
    update((next) => {
      const key = grantKey(action, module);
      if (on) {
        add(next, key);
        if (action !== "VIEW" && allowed.includes("VIEW")) add(next, grantKey("VIEW", module));
      } else if (action === "VIEW") {
        for (const a of allowed) next.delete(grantKey(a, module));
      } else next.delete(key);
    });

  const setModule = (module: ModuleType, allowed: readonly ActionType[], mode: "all" | "view" | "none") =>
    update((next) => {
      for (const a of allowed) {
        const key = grantKey(a, module);
        if (mode === "all" || (mode === "view" && a === "VIEW")) add(next, key);
        else next.delete(key);
      }
    });

  const setCategory = (modules: { key: ModuleType; allowedActions: ActionType[] }[], mode: "all" | "view" | "none") =>
    update((next) => {
      for (const m of modules) {
        for (const a of m.allowedActions) {
          const key = grantKey(a, m.key);
          if (mode === "all" || (mode === "view" && a === "VIEW")) add(next, key);
          else next.delete(key);
        }
      }
    });

  if (!categories.length) return <p className="px-1 py-6 text-center text-xs text-ink-faint">No module matches.</p>;

  const quick = "cursor-pointer rounded px-1.5 py-0.5 text-2xs font-medium text-brand-strong hover:bg-brand-subtle";
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[680px] border-collapse text-xs sm:min-w-[760px]">
        <thead className="sticky top-0 z-10 bg-surface-sunken">
          <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-muted">
            <th scope="col" className="sticky left-0 z-10 bg-surface-sunken px-3 py-2 text-left">
              Module
            </th>
            {ACTIONS.map((a) => (
              <th key={a} scope="col" className="w-16 px-1 py-2 text-center">
                {ACTION_LABEL[a]}
              </th>
            ))}
            {editable && <th scope="col" className="w-24 px-2 py-2 text-right"><span className="sr-only">Quick choices</span></th>}
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <Fragment key={c.id}>
              <tr className="border-b border-line bg-surface-panel">
                <th scope="colgroup" colSpan={ACTIONS.length + 1} className="sticky left-0 px-3 py-1.5 text-left font-semibold text-ink">
                  {c.name}
                  <span className="ml-2 hidden font-normal text-ink-faint sm:inline">{c.description}</span>
                </th>
                {editable && (
                  <td className="whitespace-nowrap px-2 py-1 text-right">
                    <button type="button" className={quick} onClick={() => setCategory(c.modules, "all")}>All</button>
                    <button type="button" className={quick} onClick={() => setCategory(c.modules, "view")}>View</button>
                    <button type="button" className={quick} onClick={() => setCategory(c.modules, "none")}>None</button>
                  </td>
                )}
              </tr>
              {c.modules.map((m) => (
                <tr key={m.key} className="border-b border-line last:border-0 hover:bg-surface-sunken/60">
                  <th scope="row" className="sticky left-0 w-36 max-w-36 bg-surface px-3 py-1.5 text-left font-normal sm:w-auto sm:max-w-[360px]">
                    <span className="block font-medium text-ink">{m.label}</span>
                    <span className="hidden truncate text-2xs text-ink-faint sm:block" title={m.description}>
                      {m.description}
                    </span>
                  </th>
                  {ACTIONS.map((a) => {
                    if (!m.allowedActions.includes(a)) {
                      return (
                        <td key={a} className="px-1 py-1.5 text-center text-ink-faint" aria-hidden>
                          –
                        </td>
                      );
                    }
                    const key = grantKey(a, m.key);
                    const on = value.has(key);
                    const was = baseline.has(key);
                    const blocked = !on ? blockedReason(key) : null;
                    const disabled = !editable || !!blocked;
                    return (
                      <td key={a} className={cn("px-1 py-1.5 text-center", on && !was && "bg-success-subtle", !on && was && "bg-danger-subtle")}>
                        <label className={cn("inline-flex h-6 w-6 items-center justify-center rounded", !disabled && "cursor-pointer hover:bg-brand-subtle")} title={blocked ?? (on !== was ? (on ? "Added: not saved yet" : "Taken away: not saved yet") : undefined)}>
                          {blocked && editable ? (
                            <Lock aria-hidden className="h-3 w-3 text-ink-faint" />
                          ) : (
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-brand disabled:cursor-not-allowed"
                              checked={on}
                              disabled={disabled}
                              aria-label={`${m.label}: ${ACTION_LABEL[a]}`}
                              onChange={(e) => toggle(m.key, a, m.allowedActions, e.target.checked)}
                            />
                          )}
                          {blocked && editable && <span className="sr-only">{`${m.label}: ${ACTION_LABEL[a]} — ${blocked}`}</span>}
                        </label>
                      </td>
                    );
                  })}
                  {editable && (
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      <button type="button" className={quick} onClick={() => setModule(m.key, m.allowedActions, "all")} aria-label={`${m.label}: everything`}>All</button>
                      <button type="button" className={quick} onClick={() => setModule(m.key, m.allowedActions, "none")} aria-label={`${m.label}: nothing`}>None</button>
                    </td>
                  )}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

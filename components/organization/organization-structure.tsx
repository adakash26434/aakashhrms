"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { branchDepartmentMatrix, departmentOpenToBranch, headcountBy } from "@/lib/engines/organization.engine";
import type { OrganizationData } from "@/lib/types/organization";
import { cn } from "@/lib/utils";

/**
 * Structure (4.3): who works where, as counts only (no names). A branch ×
 * department matrix of active headcount (each cell opens the employee
 * register filtered to it) and a department → designation tree.
 */
export function OrganizationStructure({ data }: { data: OrganizationData }) {
  const matrix = useMemo(() => branchDepartmentMatrix(data.headcounts), [data.headcounts]);
  const branches = data.branches.filter((b) => b.status === "active" || matrix.rowTotals[b.id]);
  const departments = data.departments.filter((d) => d.status === "active" || matrix.columnTotals[d.id]);
  // People placed in a department that is not open to their branch (only possible for older records).
  const misplaced = data.headcounts.filter((h) => {
    const d = data.departments.find((x) => x.id === h.departmentId);
    return d && !departmentOpenToBranch(d, h.branchId);
  });
  const misplacedCount = misplaced.reduce((n, h) => n + h.count, 0);

  if (!data.branches.length && !data.departments.length) {
    return (
      <div className="p-8 text-center text-sm text-ink-muted">
        No branches or departments yet. Add them on the Branches and Departments tabs.
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="org-matrix" className="min-w-0 self-start rounded-lg border border-line-card bg-surface shadow-sm">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-strong bg-canvas/70 px-3 py-2">
          <h2 id="org-matrix" className="text-sm font-semibold text-ink">
            Headcount by department and branch
          </h2>
          <p className="text-2xs text-ink-muted">Active employees · click a number to open them</p>
        </header>
        {misplacedCount > 0 && (
          <p className="flex items-center gap-1.5 border-b border-line bg-warning-subtle px-3 py-1.5 text-xs text-warning">
            <TriangleAlert aria-hidden className="h-3.5 w-3.5" />
            {misplacedCount} employee{misplacedCount === 1 ? " is" : "s are"} in a department that is not open to their branch (marked below).
          </p>
        )}
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-strong bg-surface-sunken/60 text-left">
                <th scope="col" className="sticky left-0 z-10 bg-surface-sunken px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                  Department
                </th>
                {branches.map((b) => (
                  <th key={b.id} scope="col" className={cn("px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wide", b.status === "active" ? "text-ink-muted" : "text-ink-faint")}>
                    <span className="block max-w-36 truncate" title={b.name}>
                      {b.name}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wide text-ink">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0 hover:bg-brand-subtle/40">
                  <th scope="row" className={cn("sticky left-0 z-10 bg-surface px-3 py-1.5 text-left font-medium", d.status === "active" ? "text-ink" : "text-ink-faint")}>
                    {d.name}
                    {d.branchIds.length > 0 && <span className="ml-1.5 text-3xs font-normal text-ink-faint">{d.branchIds.length} branch{d.branchIds.length === 1 ? "" : "es"}</span>}
                  </th>
                  {branches.map((b) => {
                    const n = matrix.cells[b.id]?.[d.id] ?? 0;
                    const open = departmentOpenToBranch(d, b.id);
                    return (
                      <td key={b.id} className={cn("px-3 py-1.5 text-right tabular-nums", !open && "bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,var(--color-line)_4px,var(--color-line)_5px)]")}>
                        {n > 0 ? (
                          <Link
                            href={`/workforce/employees?dept=${d.id}&branch=${b.id}`}
                            className={cn("font-medium hover:underline", open ? "text-brand-strong" : "text-warning")}
                            title={open ? `${n} in ${d.name}, ${b.name}` : `${n} in ${d.name}, but ${d.name} is not open to ${b.name}`}
                          >
                            {n}
                          </Link>
                        ) : (
                          <span className="text-ink-faint" title={open ? undefined : `${d.name} is not open to ${b.name}`}>
                            {open ? "·" : ""}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{matrix.columnTotals[d.id] ?? 0}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-strong bg-surface-sunken/60">
                <th scope="row" className="sticky left-0 z-10 bg-surface-sunken px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wide text-ink">
                  Total
                </th>
                {branches.map((b) => (
                  <td key={b.id} className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">
                    {matrix.rowTotals[b.id] ?? 0}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-bold tabular-nums text-ink">{matrix.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <DepartmentTree data={data} />
    </div>
  );
}

interface TreeItem {
  id: string;
  level: 1 | 2;
  parent?: string;
  label: string;
  meta: string;
  count: number;
  inactive: boolean;
}

/** Department → designation tree (ARIA tree: ↑/↓ move, → opens, ← closes, Home/End). */
function DepartmentTree({ data }: { data: OrganizationData }) {
  const byDesignation = useMemo(() => headcountBy(data.headcounts, "designationId"), [data.headcounts]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(data.departments.slice(0, 3).map((d) => d.id)));
  const [focusId, setFocusId] = useState<string | null>(data.departments[0]?.id ?? null);
  const refs = useRef(new Map<string, HTMLLIElement>());

  const headName = (id: string | null, typed: string | null) => (id ? data.people?.find((p) => p.id === id)?.fullName : undefined) ?? (typed ? `${typed} (typed)` : "No head set");

  const items: TreeItem[] = [];
  for (const d of data.departments) {
    items.push({ id: d.id, level: 1, label: d.name, meta: headName(d.headEmployeeId, d.headName), count: d.headcount, inactive: d.status === "inactive" });
    if (open.has(d.id)) {
      for (const g of data.designations.filter((x) => x.departmentId === d.id)) {
        items.push({ id: g.id, level: 2, parent: d.id, label: g.name, meta: "", count: byDesignation.get(g.id) ?? 0, inactive: g.status === "inactive" });
      }
    }
  }
  const hasChildren = (id: string) => data.designations.some((g) => g.departmentId === id);

  const focus = (id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    refs.current.get(id)?.focus();
  };
  const toggle = (id: string, to?: boolean) =>
    setOpen((s) => {
      const next = new Set(s);
      if (to ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>, item: TreeItem) => {
    const index = items.findIndex((i) => i.id === item.id);
    switch (e.key) {
      case "ArrowDown":
        focus(items[index + 1]?.id);
        break;
      case "ArrowUp":
        focus(items[index - 1]?.id);
        break;
      case "Home":
        focus(items[0]?.id);
        break;
      case "End":
        focus(items[items.length - 1]?.id);
        break;
      case "ArrowRight":
        if (item.level === 1 && hasChildren(item.id)) {
          if (!open.has(item.id)) toggle(item.id, true);
          else focus(items[index + 1]?.id);
        }
        break;
      case "ArrowLeft":
        if (item.level === 1 && open.has(item.id)) toggle(item.id, false);
        else if (item.parent) focus(item.parent);
        break;
      case "Enter":
      case " ":
        if (item.level === 1) toggle(item.id);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <section aria-labelledby="org-tree" className="self-start rounded-lg border border-line-card bg-surface shadow-sm">
      <header className="flex items-baseline justify-between gap-2 border-b border-line-strong bg-canvas/70 px-3 py-2">
        <h2 id="org-tree" className="text-sm font-semibold text-ink">
          Departments and designations
        </h2>
        <button
          type="button"
          onClick={() => setOpen((s) => (s.size ? new Set() : new Set(data.departments.map((d) => d.id))))}
          className="cursor-pointer text-2xs font-medium text-brand-strong hover:underline"
        >
          {open.size ? "Collapse all" : "Expand all"}
        </button>
      </header>
      {data.departments.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-ink-faint">No departments yet.</p>
      ) : (
        <ul role="tree" aria-labelledby="org-tree" className="max-h-[calc(100vh-320px)] overflow-y-auto py-1 scroll-thin">
          {items.map((item) => {
            const expandable = item.level === 1 && hasChildren(item.id);
            return (
              <li
                key={item.id}
                ref={(el) => {
                  if (el) refs.current.set(item.id, el);
                  else refs.current.delete(item.id);
                }}
                role="treeitem"
                aria-level={item.level}
                aria-expanded={expandable ? open.has(item.id) : undefined}
                aria-selected={focusId === item.id}
                tabIndex={focusId === item.id ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, item)}
                onClick={() => {
                  setFocusId(item.id);
                  if (item.level === 1) toggle(item.id);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 py-1 pr-3 text-sm outline-none hover:bg-surface-sunken focus-visible:bg-brand-subtle focus-visible:shadow-[inset_3px_0_0_var(--color-brand)]",
                  item.level === 1 ? "pl-2 font-medium" : "pl-8 text-ink-muted",
                  item.inactive && "opacity-60"
                )}
              >
                {item.level === 1 && (
                  <ChevronRight aria-hidden className={cn("h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform", open.has(item.id) && "rotate-90", !expandable && "invisible")} />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate", item.level === 1 && "text-ink")}>{item.label}</span>
                  {item.meta && <span className="block truncate text-3xs font-normal text-ink-faint">Head: {item.meta}</span>}
                </span>
                <span className="shrink-0 rounded-full bg-surface-sunken px-1.5 text-2xs font-semibold tabular-nums text-ink-muted" title="Active employees">
                  {item.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

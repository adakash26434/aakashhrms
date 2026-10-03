"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Printer, Search, TriangleAlert } from "lucide-react";
import { inputClass } from "@/components/kit/property-form";
import { WindowButton } from "@/components/kit/window";
import { reportingTree, type ReportingNode } from "@/lib/engines/organization.engine";
import type { OrganizationData } from "@/lib/types/organization";
import { cn } from "@/lib/utils";
import { initials } from "@/components/employee/employee-quick-view";

/**
 * Reporting chart (4.3): who reports to whom, from each employee's "Reports
 * to" (as in Sage HR / Keka). Needs Employees → View and shows only people
 * in the user's scope. Problems (loops, inactive supervisors, people with no
 * supervisor) are listed above the chart.
 */
export function OrganizationReporting({ data }: { data: OrganizationData }) {
  const tree = useMemo(() => (data.people ? reportingTree(data.people) : null), [data.people]);
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());

  if (!data.people || !tree) {
    return (
      <div className="p-8 text-center text-sm text-ink-muted">
        The reporting chart shows people, so it needs the Employees → View permission.
      </div>
    );
  }

  const name = (id: string) => data.people?.find((p) => p.id === id)?.fullName ?? "Unknown";
  const designation = (id: string) => data.designations.find((d) => d.id === id)?.name ?? "";
  const branch = (id: string) => data.branches.find((b) => b.id === id)?.name ?? "";
  const q = query.trim().toLowerCase();
  // When searching, show only the branches of the tree that contain a match.
  const matches = (n: ReportingNode): boolean => !q || n.person.fullName.toLowerCase().includes(q) || n.person.employeeCode.toLowerCase().includes(q) || n.children.some(matches);
  const roots = tree.roots.filter(matches);
  const total = data.people.filter((p) => p.status === "Active").length;
  const warnings = [
    tree.inCycle.length ? { text: `Reporting loop: ${tree.inCycle.map(name).join(" → ")}. Fix one person's "Reports to".`, ids: tree.inCycle } : null,
    tree.inactiveSupervisor.length ? { text: `${tree.inactiveSupervisor.length} report${tree.inactiveSupervisor.length === 1 ? "s" : ""} to someone who has left: ${tree.inactiveSupervisor.map(name).join(", ")}.`, ids: tree.inactiveSupervisor } : null,
    tree.unassigned.length && total > 1 ? { text: `${tree.unassigned.length} with no supervisor and no team: ${tree.unassigned.slice(0, 6).map(name).join(", ")}${tree.unassigned.length > 6 ? "…" : ""}.`, ids: tree.unassigned } : null,
  ].filter(Boolean) as { text: string; ids: string[] }[];

  const toggle = (id: string) =>
    setClosed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: ReportingNode, depth: number) => {
    const p = node.person;
    const isOpen = !!q || !closed.has(p.id);
    const kids = node.children.filter(matches);
    const hit = q && (p.fullName.toLowerCase().includes(q) || p.employeeCode.toLowerCase().includes(q));
    const flagged = tree.inCycle.includes(p.id) || tree.inactiveSupervisor.includes(p.id);
    return (
      <li key={p.id} role="treeitem" aria-level={depth + 1} aria-expanded={kids.length ? isOpen : undefined} aria-selected={false} className="relative">
        <div
          className={cn(
            "group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors",
            hit ? "border-brand bg-brand-subtle" : "border-transparent hover:border-line hover:bg-surface-sunken/60"
          )}
        >
          <button
            type="button"
            aria-label={kids.length ? `${isOpen ? "Collapse" : "Expand"} ${p.fullName}'s team` : undefined}
            disabled={!kids.length}
            onClick={() => toggle(p.id)}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-ink-faint hover:bg-surface-sunken disabled:cursor-default disabled:opacity-0"
          >
            <ChevronRight aria-hidden className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
          </button>
          <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-2xs font-semibold text-brand-strong">
            {initials(p.fullName)}
          </span>
          <span className="min-w-0 flex-1">
            <Link href={`/workforce/employees/${p.id}`} className="block truncate text-sm font-medium text-ink hover:underline">
              {p.fullName}
              {flagged && <TriangleAlert aria-label="Needs attention" className="ml-1 inline h-3.5 w-3.5 text-warning" />}
            </Link>
            <span className="block truncate text-2xs text-ink-muted">
              {[designation(p.designationId), branch(p.branchId)].filter(Boolean).join(" · ")}
              <span className="ml-1.5 font-code text-ink-faint">{p.employeeCode}</span>
            </span>
          </span>
          {node.teamSize > 0 && (
            <span className="shrink-0 rounded-full bg-surface-sunken px-2 text-2xs font-semibold tabular-nums text-ink-muted" title={`${node.teamSize} people below, at any level`}>
              {node.teamSize} below
            </span>
          )}
        </div>
        {kids.length > 0 && isOpen && (
          <ul role="group" className="ml-[1.1rem] border-l border-line-strong pl-4">
            {kids.map((k) => renderNode(k, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative w-full max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            aria-label="Find a person"
            placeholder="Find a person (name or code)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(inputClass, "pl-8")}
          />
        </div>
        <WindowButton onClick={() => setClosed(new Set())}>Expand all</WindowButton>
        <WindowButton onClick={() => setClosed(new Set(data.people?.map((p) => p.id)))}>Collapse all</WindowButton>
        <WindowButton onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </WindowButton>
        <span className="ml-auto text-2xs text-ink-muted">
          {total} active {total === 1 ? "person" : "people"} · built from each employee&apos;s &quot;Reports to&quot;
        </span>
      </div>

      {warnings.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning print:hidden">
          {warnings.map((w) => (
            <li key={w.text} className="flex items-start gap-1.5">
              <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w.text}
            </li>
          ))}
        </ul>
      )}

      {roots.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">{q ? "Nobody matches that search." : "No active employees yet."}</p>
      ) : (
        <ul role="tree" aria-label="Reporting chart" className="space-y-0.5 rounded-lg border border-line-card bg-surface p-2 shadow-sm">
          {roots.map((n) => renderNode(n, 0))}
        </ul>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { CircleCheck, Pencil, TriangleAlert } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { FactBox, type FactSection } from "@/components/kit/fact-box";
import { WindowButton } from "@/components/kit/window";
import { addressLine } from "@/lib/constants/nepal-locations";
import { REMOTE_CATEGORIES, deleteBlockers, typeEligibility as eligibility } from "@/lib/engines/organization.engine";
import type { OrgKind, OrganizationData, OrgPerson, OrgUsage } from "@/lib/types/organization";
import { formatPhoneNumber } from "@/lib/utils/phone";

const PEOPLE_SHOWN = 10;

/** People in a list, linked to their records (only when the user may see employees). */
function PeopleList({ people, total, href }: { people: OrgPerson[]; total: number; href: string }) {
  if (!people.length) return null;
  return (
    <section className="border-t border-line px-3 py-2.5">
      <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">People</h3>
      <ul className="space-y-1">
        {people.slice(0, PEOPLE_SHOWN).map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-2 text-xs">
            <Link href={`/workforce/employees/${p.id}`} className="truncate font-medium text-ink hover:underline">
              {p.fullName}
            </Link>
            <span className="shrink-0 font-code text-3xs text-ink-faint">{p.employeeCode}</span>
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-2 inline-block text-2xs font-medium text-brand-strong hover:underline">
        {total > PEOPLE_SHOWN ? `All ${total} in Employees` : "Open in Employees"}
      </Link>
    </section>
  );
}

function usageSection(usage: OrgUsage, activeHref?: string, active?: number): FactSection {
  const facts: FactSection["facts"] = [];
  if (active !== undefined) facts.push({ label: "Active employees", value: active, href: activeHref });
  facts.push({ label: "All employees (any status)", value: usage.employees });
  if (usage.designations !== undefined) facts.push({ label: "Designations", value: usage.designations });
  if (usage.departments !== undefined) facts.push({ label: "Departments limited to it", value: usage.departments });
  if (usage.users !== undefined) facts.push({ label: "User logins' access", value: usage.users });
  if (usage.holidays !== undefined) facts.push({ label: "Branch holidays", value: usage.holidays });
  if (usage.payrollRuns !== undefined) facts.push({ label: "Payroll runs", value: usage.payrollRuns });
  return { title: "Used by", facts };
}

/** Whether it can be deleted, in words. */
function DeleteHint({ usage, headOffice }: { usage: OrgUsage; headOffice?: boolean }) {
  const blockers = deleteBlockers(usage);
  if (headOffice) return <p className="text-2xs text-ink-muted">The head office stays active and cannot be deleted.</p>;
  return blockers.length ? (
    <p className="flex items-start gap-1.5 text-2xs text-ink-muted">
      <TriangleAlert aria-hidden className="mt-px h-3 w-3 shrink-0 text-warning" />
      In use, so it is kept for the records. Make it inactive to stop new use.
    </p>
  ) : (
    <p className="flex items-start gap-1.5 text-2xs text-ink-muted">
      <CircleCheck aria-hidden className="mt-px h-3 w-3 shrink-0 text-success" />
      Not used anywhere yet, so it can be deleted.
    </p>
  );
}

/** Detail pane beside a register (Business Central FactBox style). */
export function OrganizationDetail({ kind, id, data, onEdit }: { kind: OrgKind; id: string; data: OrganizationData; onEdit?: (kind: OrgKind, id: string) => void }) {
  const people = (data.people ?? []).filter((p) => p.status === "Active");
  const edit = onEdit ? (
    <WindowButton onClick={() => onEdit(kind, id)}>
      <Pencil className="h-3.5 w-3.5" /> Edit
    </WindowButton>
  ) : null;
  const footer = (usage: OrgUsage, headOffice?: boolean) => (
    <div className="space-y-2">
      <DeleteHint usage={usage} headOffice={headOffice} />
      {edit}
    </div>
  );

  switch (kind) {
    case "branch": {
      const b = data.branches.find((x) => x.id === id);
      if (!b) return null;
      const href = `/workforce/employees?branch=${b.id}`;
      return (
        <div>
          <FactBox
            title={b.name}
            sections={[
              {
                title: "Branch",
                facts: [
                  { label: "Code", value: <span className="font-code">{b.code}</span> },
                  { label: "Head office", value: b.isHeadOffice ? "Yes" : "No" },
                  { label: "Location", value: addressLine(b.location) ?? "—" },
                  { label: "Phone", value: b.phone ? formatPhoneNumber(b.phone) : "—" },
                  { label: "Email", value: b.email || "—" },
                  { label: "Remote area", value: REMOTE_CATEGORIES.find((c) => c.value === b.remoteCategory)?.label ?? b.remoteCategory },
                ],
              },
              usageSection(b.usage, href, b.headcount),
            ]}
            footer={footer(b.usage, b.isHeadOffice)}
          />
          {data.people && <PeopleList people={people.filter((p) => p.branchId === b.id)} total={b.headcount} href={href} />}
        </div>
      );
    }
    case "department": {
      const d = data.departments.find((x) => x.id === id);
      if (!d) return null;
      const head = d.headEmployeeId ? data.people?.find((p) => p.id === d.headEmployeeId) : undefined;
      const href = `/workforce/employees?dept=${d.id}`;
      const designations = data.designations.filter((x) => x.departmentId === d.id);
      return (
        <div>
          <FactBox
            title={d.name}
            sections={[
              {
                title: "Department",
                facts: [
                  { label: "Code", value: <span className="font-code">{d.code}</span> },
                  {
                    label: "Head",
                    value: head ? head.fullName : d.headName ? `${d.headName} (typed)` : "—",
                    href: head ? `/workforce/employees/${head.id}` : undefined,
                    tone: !head && d.headName ? "warning" : "default",
                  },
                  { label: "Branches", value: d.branchIds.length ? d.branchIds.map((bid) => data.branches.find((b) => b.id === bid)?.name).filter(Boolean).join(", ") : "All branches" },
                ],
              },
              ...(designations.length
                ? [{ title: "Designations", facts: designations.slice(0, 8).map((x) => ({ label: x.name, value: x.headcount })) }]
                : []),
              usageSection(d.usage, href, d.headcount),
            ]}
            footer={footer(d.usage)}
          />
          {d.description && <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">{d.description}</p>}
          {data.people && <PeopleList people={people.filter((p) => p.departmentId === d.id)} total={d.headcount} href={href} />}
        </div>
      );
    }
    case "designation": {
      const g = data.designations.find((x) => x.id === id);
      if (!g) return null;
      const dept = data.departments.find((d) => d.id === g.departmentId);
      const href = `/workforce/employees?dept=${g.departmentId}`;
      return (
        <div>
          <FactBox
            title={g.name}
            sections={[
              { title: "Designation", facts: [{ label: "Department", value: dept?.name ?? "—" }] },
              usageSection(g.usage, href, g.headcount),
            ]}
            footer={footer(g.usage)}
          />
          {g.description && <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">{g.description}</p>}
          {data.people && <PeopleList people={people.filter((p) => p.designationId === g.id)} total={g.headcount} href={href} />}
        </div>
      );
    }
    case "level": {
      const l = data.levels.find((x) => x.id === id);
      if (!l) return null;
      return (
        <FactBox
          title={l.name}
          sections={[
            {
              title: "Grade level",
              facts: [
                { label: "Code", value: <span className="font-code">{l.code}</span> },
                { label: "Level number", value: l.levelNumber },
                { label: "Nepali label", value: l.labelNepali || "—" },
                { label: "Starting salary", value: <Amount value={l.minSalary} prefix="NPR" /> },
                { label: "Maximum salary", value: l.maxSalary ? <Amount value={l.maxSalary} prefix="NPR" /> : "Not set" },
              ],
            },
            usageSection(l.usage),
          ]}
          footer={footer(l.usage)}
        />
      );
    }
    case "type": {
      const t = data.types.find((x) => x.id === id);
      if (!t) return null;
      return (
        <FactBox
          title={t.name}
          sections={[
            {
              title: "Employment type",
              facts: [
                { label: "Code", value: <span className="font-code">{t.code}</span> },
                { label: "Nepali name", value: t.nameNepali || "—" },
                { label: "Eligible for", value: eligibility(t) || "None" },
                { label: "Notice period", value: `${t.noticePeriodDays} days` },
                { label: "Probation", value: t.probationMonths ? `${t.probationMonths} months` : "None" },
              ],
            },
            usageSection(t.usage),
          ]}
          footer={footer(t.usage)}
        />
      );
    }
  }
}

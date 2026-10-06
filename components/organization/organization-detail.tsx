"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, Pencil, TriangleAlert } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { PaneActions, PaneFields, PaneSection, type PaneField } from "@/components/kit/pane";
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
    <PaneSection title="People" count={total}>
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
    </PaneSection>
  );
}

function usageFields(usage: OrgUsage, activeHref?: string, active?: number): PaneField[] {
  const rows: PaneField[] = [];
  if (active !== undefined) rows.push({ label: "Active employees", value: active, href: activeHref });
  rows.push({ label: "All employees (any status)", value: usage.employees });
  if (usage.designations !== undefined) rows.push({ label: "Designations", value: usage.designations });
  if (usage.departments !== undefined) rows.push({ label: "Departments limited to it", value: usage.departments });
  if (usage.users !== undefined) rows.push({ label: "User logins' access", value: usage.users });
  if (usage.holidays !== undefined) rows.push({ label: "Branch holidays", value: usage.holidays });
  if (usage.payrollRuns !== undefined) rows.push({ label: "Payroll runs", value: usage.payrollRuns });
  return rows;
}

/** Whether it can be deleted, in words (under the Edit button). */
function deleteHint(usage: OrgUsage, headOffice?: boolean): ReactNode {
  if (headOffice) return "The head office stays active and cannot be deleted.";
  return deleteBlockers(usage).length ? (
    <span className="inline-flex items-start gap-1.5">
      <TriangleAlert aria-hidden className="mt-px h-3 w-3 shrink-0 text-warning" />
      In use, so it is kept for the records. Make it inactive to stop new use.
    </span>
  ) : (
    <span className="inline-flex items-start gap-1.5">
      <CircleCheck aria-hidden className="mt-px h-3 w-3 shrink-0 text-success" />
      Not used anywhere yet, so it can be deleted.
    </span>
  );
}

/** The pane: Edit (and whether it can be deleted) on top, what it is, what uses it, and its people. */
function Pane({
  edit,
  usage,
  headOffice,
  title,
  fields,
  extra,
  activeHref,
  active,
  description,
  people,
}: {
  edit: ReactNode;
  usage: OrgUsage;
  headOffice?: boolean;
  title: string;
  fields: PaneField[];
  extra?: ReactNode;
  activeHref?: string;
  active?: number;
  description?: string | null;
  people?: ReactNode;
}) {
  return (
    <div className="text-xs">
      <PaneActions hint={deleteHint(usage, headOffice)}>{edit}</PaneActions>
      <PaneSection title={title}>
        <PaneFields rows={fields} />
        {description && <p className="mt-2 text-ink-muted">{description}</p>}
      </PaneSection>
      {extra}
      <PaneSection title="Used by">
        <PaneFields layout="figures" rows={usageFields(usage, activeHref, active)} />
      </PaneSection>
      {people}
    </div>
  );
}

/** Detail pane beside a register. */
export function OrganizationDetail({ kind, id, data, onEdit }: { kind: OrgKind; id: string; data: OrganizationData; onEdit?: (kind: OrgKind, id: string) => void }) {
  const people = (data.people ?? []).filter((p) => p.status === "Active");
  const edit = onEdit ? (
    <WindowButton variant="primary" onClick={() => onEdit(kind, id)}>
      <Pencil className="h-3.5 w-3.5" /> Edit
    </WindowButton>
  ) : null;

  switch (kind) {
    case "branch": {
      const b = data.branches.find((x) => x.id === id);
      if (!b) return null;
      const href = `/workforce/employees?branch=${b.id}`;
      return (
        <Pane
          edit={edit}
          usage={b.usage}
          headOffice={b.isHeadOffice}
          title="Branch"
          fields={[
            { label: "Code", value: <span className="font-code">{b.code}</span> },
            { label: "Head office", value: b.isHeadOffice ? "Yes" : "No" },
            { label: "Location", value: addressLine(b.location) ?? "—" },
            { label: "Phone", value: b.phone ? formatPhoneNumber(b.phone) : "—" },
            { label: "Email", value: b.email || "—" },
            { label: "Remote area", value: REMOTE_CATEGORIES.find((c) => c.value === b.remoteCategory)?.label ?? b.remoteCategory },
          ]}
          activeHref={href}
          active={b.headcount}
          people={data.people && <PeopleList people={people.filter((p) => p.branchId === b.id)} total={b.headcount} href={href} />}
        />
      );
    }
    case "department": {
      const d = data.departments.find((x) => x.id === id);
      if (!d) return null;
      const head = d.headEmployeeId ? data.people?.find((p) => p.id === d.headEmployeeId) : undefined;
      const href = `/workforce/employees?dept=${d.id}`;
      const designations = data.designations.filter((x) => x.departmentId === d.id);
      return (
        <Pane
          edit={edit}
          usage={d.usage}
          title="Department"
          fields={[
            { label: "Code", value: <span className="font-code">{d.code}</span> },
            {
              label: "Head",
              value: head ? head.fullName : d.headName ? `${d.headName} (typed)` : "—",
              href: head ? `/workforce/employees/${head.id}` : undefined,
              tone: !head && d.headName ? "warning" : "default",
            },
            { label: "Branches", value: d.branchIds.length ? d.branchIds.map((bid) => data.branches.find((b) => b.id === bid)?.name).filter(Boolean).join(", ") : "All branches" },
          ]}
          description={d.description}
          extra={
            designations.length > 0 && (
              <PaneSection title="Designations" count={designations.length}>
                <PaneFields layout="figures" rows={designations.slice(0, 8).map((x) => ({ label: x.name, value: x.headcount }))} />
              </PaneSection>
            )
          }
          activeHref={href}
          active={d.headcount}
          people={data.people && <PeopleList people={people.filter((p) => p.departmentId === d.id)} total={d.headcount} href={href} />}
        />
      );
    }
    case "designation": {
      const g = data.designations.find((x) => x.id === id);
      if (!g) return null;
      const dept = data.departments.find((d) => d.id === g.departmentId);
      const href = `/workforce/employees?dept=${g.departmentId}`;
      return (
        <Pane
          edit={edit}
          usage={g.usage}
          title="Designation"
          fields={[{ label: "Department", value: dept?.name ?? "—" }]}
          description={g.description}
          activeHref={href}
          active={g.headcount}
          people={data.people && <PeopleList people={people.filter((p) => p.designationId === g.id)} total={g.headcount} href={href} />}
        />
      );
    }
    case "level": {
      const l = data.levels.find((x) => x.id === id);
      if (!l) return null;
      return (
        <Pane
          edit={edit}
          usage={l.usage}
          title="Grade level"
          fields={[
            { label: "Code", value: <span className="font-code">{l.code}</span> },
            { label: "Level number", value: l.levelNumber },
            { label: "Starting salary", value: <Amount value={l.minSalary} prefix="NPR" /> },
            { label: "Maximum salary", value: l.maxSalary ? <Amount value={l.maxSalary} prefix="NPR" /> : "Not set" },
          ]}
        />
      );
    }
    case "type": {
      const t = data.types.find((x) => x.id === id);
      if (!t) return null;
      return (
        <Pane
          edit={edit}
          usage={t.usage}
          title="Employment type"
          fields={[
            { label: "Code", value: <span className="font-code">{t.code}</span> },
            { label: "Eligible for", value: eligibility(t) || "None" },
            { label: "Notice period", value: `${t.noticePeriodDays} days` },
            { label: "Probation", value: t.probationMonths ? `${t.probationMonths} months` : "None" },
          ]}
        />
      );
    }
  }
}

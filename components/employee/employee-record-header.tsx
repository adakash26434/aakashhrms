"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DateCell } from "@/components/kit/date-cell";
import { RecordNavigator } from "@/components/kit/record-navigator";
import { tenureLabel } from "@/lib/engines/employee.engine";
import { nepalToday } from "@/lib/utils/nepal-time";
import type { EmployeeProfile, EmployeeRecordData } from "@/lib/types/employee";
import { initials } from "./employee-quick-view";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-3xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="truncate text-xs text-ink">{children}</dd>
    </div>
  );
}

/**
 * Key facts under the page bar (the name and status are in the page bar
 * itself, so they are not repeated): placement, service, supervisor and
 * contact, plus the record navigator to step through the register.
 */
export function EmployeeRecordHeader({ profile, navigator }: { profile: EmployeeProfile; navigator: EmployeeRecordData["navigator"] }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const tenure = tenureLabel(profile.joiningDate, nepalToday());
  // Stay on the same tab while stepping through records.
  const hrefFor = (id: string | null) => (id ? `${pathname.replace(/[^/]+$/, id)}${tab ? `?tab=${tab}` : ""}` : null);

  return (
    <section aria-label="Employee summary" className="flex flex-col gap-4 rounded-lg border border-line-card bg-surface px-4 py-3 shadow-sm md:flex-row md:items-center">
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-base font-semibold text-brand-strong">
        {initials(profile.fullName)}
      </span>
      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Fact label="Designation">{profile.designationName || "—"}</Fact>
        <Fact label="Department">{profile.departmentName || "—"}</Fact>
        <Fact label="Branch">{profile.branchName || "—"}</Fact>
        <Fact label="Category · level">{[profile.category, profile.shreni].filter(Boolean).join(" · ") || "—"}</Fact>
        <Fact label="Joined">
          <DateCell value={profile.joiningDate} />
          {tenure && <span className="text-ink-faint"> · {tenure}</span>}
        </Fact>
        <Fact label="Supervisor">
          {profile.supervisor ? (
            <Link href={`/workforce/employees/${profile.supervisor.id}`} className="text-brand-strong hover:underline">
              {profile.supervisor.name}
            </Link>
          ) : (
            "—"
          )}
        </Fact>
        <Fact label="Mobile">
          <span className="font-code">{profile.mobileNo || "—"}</span>
        </Fact>
        <Fact label="Company email">{profile.companyEmail || "—"}</Fact>
      </dl>
      <RecordNavigator
        noun="employee"
        position={navigator.position}
        total={navigator.total}
        prevHref={hrefFor(navigator.prevId)}
        nextHref={hrefFor(navigator.nextId)}
        className="self-start md:self-center"
      />
    </section>
  );
}

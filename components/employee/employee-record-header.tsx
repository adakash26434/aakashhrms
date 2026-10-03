import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { DateCell } from "@/components/kit/date-cell";
import { RECORD_GAP_LABEL, tenureLabel } from "@/lib/engines/employee.engine";
import { nepalToday } from "@/lib/utils/nepal-time";
import type { EmployeeProfile } from "@/lib/types/employee";
import { initials } from "./employee-quick-view";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-3xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="truncate text-xs text-ink">{children}</dd>
    </div>
  );
}

/** The strip under the page bar: who this is and where they sit, at a glance. */
export function EmployeeRecordHeader({ profile, canEdit }: { profile: EmployeeProfile; canEdit: boolean }) {
  const tenure = tenureLabel(profile.joiningDate, nepalToday());
  return (
    <section aria-label="Employee summary" className="rounded-lg border border-line-card bg-surface shadow-sm">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-3 md:w-72 md:shrink-0">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-base font-semibold text-brand-strong">
            {initials(profile.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{profile.fullName}</p>
            <p className="truncate font-code text-xs text-ink-muted">
              {profile.employeeCode} · Att. {profile.attendanceCode}
            </p>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
          <Fact label="Designation">{profile.designationName || "—"}</Fact>
          <Fact label="Department">{profile.departmentName || "—"}</Fact>
          <Fact label="Branch">{profile.branchName || "—"}</Fact>
          <Fact label="Category">{profile.category || "—"}</Fact>
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
        </dl>
      </div>
      {profile.gaps.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-b-lg border-t border-warning/30 bg-warning-subtle px-4 py-2 text-xs text-warning">
          <TriangleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Records to fix before payroll:</span>
          <span>{profile.gaps.map((g) => RECORD_GAP_LABEL[g]).join(" · ")}</span>
          {canEdit && (
            <Link href={`/workforce/employees/${profile.id}/edit`} className="ml-auto font-medium underline underline-offset-2">
              Fix now
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

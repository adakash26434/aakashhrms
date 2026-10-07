"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Mail, Phone, Receipt, TriangleAlert, UserRound } from "lucide-react";
import { DateCell } from "@/components/kit/date-cell";
import { CopyButton, DescriptionList } from "@/components/kit/description-list";
import { RecordNavigator } from "@/components/kit/record-navigator";
import { StatusChip } from "@/components/kit/status-chip";
import { RECORD_GAP_LABEL, RECORD_GAP_SECTION, tenureLabel } from "@/lib/engines/employee.engine";
import { nepalToday } from "@/lib/utils/nepal-time";
import type { EmployeeProfile, EmployeeRecordData } from "@/lib/types/employee";
import { Avatar } from "@/components/kit/avatar";
import { photoUrl } from "@/lib/engines/employee-document.engine";
import { formatPhoneNumber } from "@/lib/utils/phone";

function ContactLine({ icon: Icon, value, href, label, mono }: { icon: typeof Phone; value: string; href: string; label: string; mono?: boolean }) {
  return (
    <div className="group flex min-w-0 items-center rounded-md hover:bg-surface-sunken">
      <a href={href} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-xs text-ink">
        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-brand" />
        <span className={`min-w-0 truncate ${mono ? "font-code" : ""}`}>{value}</span>
      </a>
      <span className="pr-1">
        <CopyButton text={value} label={label} />
      </span>
    </div>
  );
}

/**
 * The identity column of the record page (as in BambooHR / greytHR): who this
 * is, how to reach them and where they sit, always visible beside the tabs,
 * with the record navigator at the foot.
 */
export function EmployeeRecordIdentity({
  profile,
  navigator,
  canEdit,
}: {
  profile: EmployeeProfile;
  navigator: EmployeeRecordData["navigator"];
  canEdit: boolean;
}) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const tenure = tenureLabel(profile.joiningDate, nepalToday());
  const hrefFor = (id: string | null) => (id ? `${pathname.replace(/[^/]+$/, id)}${tab ? `?tab=${tab}` : ""}` : null);

  return (
    <aside aria-label="Employee identity" className="overflow-hidden rounded-lg border border-line-card bg-surface shadow-sm">
      {/* Identity band */}
      <div className="flex flex-col items-center gap-2 border-b border-line bg-gradient-to-b from-brand-subtle to-surface px-4 pb-4 pt-5 text-center">
        <Avatar name={profile.fullName} src={photoUrl(profile.photoId)} size="xl" tone="solid" className="shadow-sm ring-4 ring-white" />
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight text-ink">{profile.fullName}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{profile.designationName || "No designation"}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <StatusChip status={profile.status} />
          <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-code text-2xs text-ink">{profile.employeeCode}</span>
          <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-code text-2xs text-ink-muted" title="Attendance code">
            {profile.attendanceCode}
          </span>
        </div>
      </div>

      {/* Contact */}
      <div className="border-b border-line px-2 py-2">
        {profile.mobileNo && <ContactLine icon={Phone} label="Mobile" value={formatPhoneNumber(profile.mobileNo)} href={`tel:${profile.mobileNo}`} mono />}
        {profile.companyEmail && <ContactLine icon={Mail} label="Email" value={profile.companyEmail} href={`mailto:${profile.companyEmail}`} />}
        {!profile.mobileNo && !profile.companyEmail && <p className="px-2 py-1.5 text-xs text-ink-faint">No contact details</p>}
      </div>

      {/* Key facts */}
      <div className="space-y-3 border-b border-line px-4 py-3">
        <DescriptionList
          columns={1}
          items={[
            {
              label: "Reports to",
              value: profile.supervisor ? (
                <Link href={`/workforce/employees/${profile.supervisor.id}`} className="text-brand-strong hover:underline">
                  {profile.supervisor.name}
                </Link>
              ) : null,
            },
            {
              label: "Joined",
              value: (
                <span>
                  <DateCell value={profile.joiningDate} />
                  {tenure && <span className="ml-1.5 text-2xs font-normal text-ink-muted">({tenure})</span>}
                </span>
              ),
            },
            { label: "Department · branch", value: [profile.departmentName, profile.branchName].filter(Boolean).join(" · ") },
            { label: "Category · level", value: [profile.category, profile.shreni].filter(Boolean).join(" · ") },
          ]}
        />
        <p className="flex items-center gap-3 text-3xs text-ink-faint">
          <span className="inline-flex items-center gap-1">
            <UserRound aria-hidden className="h-3 w-3" /> {profile.gender}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays aria-hidden className="h-3 w-3" /> Born <DateCell value={profile.dateOfBirth} />
          </span>
          <span className="inline-flex items-center gap-1">
            <Receipt aria-hidden className="h-3 w-3" /> {profile.taxStatus}
          </span>
        </p>
      </div>

      {/* Records to fix */}
      {profile.gaps.length > 0 && (
        <div className="border-b border-warning/30 bg-warning-subtle px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
            <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> Records to fix
          </p>
          <ul className="space-y-0.5 pl-5 text-2xs text-warning">
            {profile.gaps.map((g) => (
              <li key={g} className="list-disc">
                {RECORD_GAP_LABEL[g]}
              </li>
            ))}
          </ul>
          {canEdit && (
            <Link href={`/workforce/employees/${profile.id}/edit#section-${RECORD_GAP_SECTION[profile.gaps[0]]}`} className="mt-2 inline-block text-2xs font-medium text-warning underline underline-offset-2">
              Fix now
            </Link>
          )}
        </div>
      )}

      {/* Record navigator */}
      <div className="flex items-center justify-center bg-surface-sunken/60 px-4 py-2.5">
        <RecordNavigator noun="employee" position={navigator.position} total={navigator.total} prevHref={hrefFor(navigator.prevId)} nextHref={hrefFor(navigator.nextId)} />
      </div>
    </aside>
  );
}

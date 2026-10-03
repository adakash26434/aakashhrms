"use client";

import { BriefcaseBusiness, CalendarCheck, CircleCheck, Contact, FileText, KeyRound, Landmark, Plane, TriangleAlert, Wallet } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { DescriptionList, InfoCard, StatTile } from "@/components/kit/description-list";
import { formatStructuredAddress, findProvinceByDistrict, parseStructuredAddress } from "@/lib/constants/nepal-locations";
import { RECORD_GAP_LABEL } from "@/lib/engines/employee.engine";
import type { EmployeeFacts, EmployeeProfile, EmployeeRecordTab } from "@/lib/types/employee";
import { cn } from "@/lib/utils";

export function addressText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const a = parseStructuredAddress(raw);
  return formatStructuredAddress({ ...a, province: a.province || findProvinceByDistrict(a.district)?.id || "" }) || null;
}

/**
 * Overview tab (as in Zoho Payroll's employee overview): the headline figures
 * for this person, then the cards people look at most: job, contact, this
 * month's attendance and anything that needs fixing.
 */
export function EmployeeRecordOverview({
  profile: p,
  facts,
  canEdit,
  onOpenTab,
}: {
  profile: EmployeeProfile;
  facts: EmployeeFacts;
  canEdit: boolean;
  onOpenTab: (tab: EmployeeRecordTab) => void;
}) {
  const base = (Number(p.basicSalary) || 0) + (Number(p.gradeAmount) || 0);
  const editHref = (section: string) => (canEdit ? { label: "Edit", href: `/workforce/employees/${p.id}/edit#section-${section}` } : undefined);
  const { attendance, leave, lastPayslip, loans } = facts;

  return (
    <div className="space-y-4">
      {/* Headline figures */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <StatTile label="Monthly base pay" icon={Wallet} value={<Amount value={base} prefix="NPR" />} sub={`Basic ${Number(p.basicSalary || 0).toLocaleString("en-IN")} + grade ${Number(p.gradeAmount || 0).toLocaleString("en-IN")}`} tone={base > 0 ? undefined : "warning"} />
        {lastPayslip !== undefined && (
          <StatTile
            label="Last net pay"
            icon={FileText}
            value={lastPayslip ? <Amount value={lastPayslip.net} prefix="NPR" /> : "—"}
            sub={lastPayslip ? `${lastPayslip.periodLabel} · gross ${lastPayslip.gross.toLocaleString("en-IN")}` : "No payslip yet"}
            onClick={() => onOpenTab("payslips")}
          />
        )}
        {leave !== undefined && (
          <StatTile
            label="Leave left"
            icon={Plane}
            value={leave ? `${leave.balance} days` : "—"}
            sub={leave?.fiscalYearLabel ?? "No balances yet"}
            onClick={() => onOpenTab("leave")}
          />
        )}
        {loans !== undefined && (
          <StatTile
            label="Loans outstanding"
            icon={Landmark}
            value={loans && loans.active ? <Amount value={loans.outstanding} prefix="NPR" /> : "None"}
            sub={loans && loans.active ? `${loans.active} open loan${loans.active === 1 ? "" : "s"}` : "No open loans"}
            onClick={() => onOpenTab("loans")}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="Job" icon={BriefcaseBusiness} action={editHref("job")}>
          <DescriptionList
            items={[
              { label: "Designation", value: p.designationName },
              { label: "Department", value: p.departmentName },
              { label: "Branch", value: p.branchName },
              { label: "Shreni (level)", value: p.shreni },
              { label: "Category", value: p.category },
              { label: "Reports to", value: p.supervisor?.name },
              { label: "Joined", value: p.joiningDate ? <DateCell value={p.joiningDate} /> : null, mono: true },
              { label: "Confirmed", value: p.confirmationDate ? <DateCell value={p.confirmationDate} /> : null, mono: true },
            ]}
          />
        </InfoCard>

        <InfoCard title="Contact" icon={Contact} action={editHref("contact")}>
          <DescriptionList
            items={[
              { label: "Mobile", value: p.mobileNo, mono: true, copy: p.mobileNo || undefined },
              { label: "Home phone", value: p.phoneHome, mono: true },
              { label: "Company email", value: p.companyEmail, copy: p.companyEmail || undefined },
              { label: "Personal email", value: p.personalEmail },
              { label: "Permanent address", value: addressText(p.permanentAddress), wide: true },
            ]}
          />
        </InfoCard>

        {attendance !== undefined && (
          <InfoCard
            title={attendance ? `Attendance · ${attendance.monthLabel}` : "Attendance"}
            icon={CalendarCheck}
            action={
              <button type="button" onClick={() => onOpenTab("attendance")} className="cursor-pointer text-2xs font-medium text-brand-strong hover:underline">
                Open
              </button>
            }
          >
            {attendance ? (
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Present", value: attendance.present, tone: "text-success" },
                  { label: "On leave", value: attendance.leave, tone: "text-info" },
                  { label: "Absent", value: attendance.absent, tone: attendance.absent ? "text-danger" : "text-ink" },
                  { label: "No entry", value: attendance.notRecorded, tone: "text-ink-faint" },
                ].map((c) => (
                  <div key={c.label} className="rounded-md border border-line bg-surface-sunken/50 px-1 py-2">
                    <p className={cn("text-lg font-semibold tabular-nums", c.tone)}>{c.value}</p>
                    <p className="text-3xs font-medium uppercase tracking-wide text-ink-muted">{c.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-faint">Nothing recorded this month.</p>
            )}
          </InfoCard>
        )}

        <InfoCard title="Records & login" icon={p.gaps.length ? TriangleAlert : CircleCheck} action={p.gaps.length ? editHref("general") : undefined}>
          {p.gaps.length ? (
            <ul className="mb-3 space-y-1">
              {p.gaps.map((g) => (
                <li key={g} className="flex items-center gap-1.5 text-xs font-medium text-warning">
                  <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> {RECORD_GAP_LABEL[g]}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <CircleCheck aria-hidden className="h-3.5 w-3.5" /> PAN, bank account and basic salary are all in place
            </p>
          )}
          <DescriptionList
            items={[
              {
                label: "Self-service login",
                value: p.access ? { active: "Active", pending: "Not signed in yet", disabled: "Switched off" }[p.access.state] : "No login",
                tone: !p.access ? "muted" : p.access.state === "active" ? "success" : "warning",
              },
              { label: "Last sign-in", value: p.access?.lastLoginAt ? <DateCell value={p.access.lastLoginAt} /> : p.access ? "Never" : null },
            ]}
          />
          <p className="mt-2 flex items-center gap-1 text-3xs text-ink-faint">
            <KeyRound aria-hidden className="h-3 w-3" /> {p.access?.email ?? "Create a login from Edit → Self-service access."}
          </p>
        </InfoCard>
      </div>
    </div>
  );
}

"use client";

import { BriefcaseBusiness, Contact, IdCard, Landmark, LogOut, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { DescriptionList, InfoCard } from "@/components/kit/description-list";
import { calculateAgeInYears } from "@/lib/engines/employee.engine";
import { nepalToday } from "@/lib/utils/nepal-time";
import type { EmployeeProfile } from "@/lib/types/employee";
import { addressText } from "./employee-record-overview";
import { formatPhoneNumber } from "@/lib/utils/phone";

const TAX_STATUS: Record<string, string> = { "Normal Single": "Single", Married: "Married (couple slab)", Widow: "Widow / widower" };
const date = (v: Date | string | null | undefined) => (v ? <DateCell value={v} /> : null);

/**
 * Profile tab (as on Keka / greytHR profile pages): every detail of the
 * employee in topic cards, small labels above bold values. Each card's "Edit"
 * opens the editor at the same section.
 */
export function EmployeeRecordProfile({ profile: p, canEdit }: { profile: EmployeeProfile; canEdit: boolean }) {
  const today = nepalToday();
  const dob = p.dateOfBirth ? new Date(p.dateOfBirth) : null;
  const age = dob && !isNaN(dob.getTime()) ? calculateAgeInYears(dob, today) : null;
  const basic = Number(p.basicSalary) || 0;
  const grade = Number(p.gradeAmount) || 0;
  const edit = (section: string) => (canEdit ? { label: "Edit", href: `/workforce/employees/${p.id}/edit#section-${section}` } : undefined);
  const separated = p.status !== "Active" || !!p.terminationDate;
  const sameAddress = !p.temporaryAddress || p.temporaryAddress === p.permanentAddress;
  const doc = (no: string | null | undefined, district: string | null | undefined) =>
    no ? (
      <span>
        <span className="font-code">{no}</span>
        {district && <span className="ml-1.5 font-sans text-xs font-normal text-ink-muted">· {district}</span>}
      </span>
    ) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InfoCard title="Primary details" icon={UserRound} action={edit("general")}>
        <DescriptionList
          items={[
            { label: "Full name", value: p.fullName, wide: true },
            { label: "Employee code", value: p.employeeCode, mono: true, copy: p.employeeCode },
            { label: "Attendance code", value: p.attendanceCode, mono: true },
            { label: "Date of birth", value: p.dateOfBirth ? <span>{date(p.dateOfBirth)}{age !== null && <span className="ml-1.5 font-sans text-xs font-normal text-ink-muted">({age} yrs)</span>}</span> : null, mono: true },
            { label: "Gender", value: p.gender },
            { label: "Tax status", value: TAX_STATUS[p.taxStatus] ?? p.taxStatus },
            { label: "Disability relief", value: p.isDisabled ? "Yes" : "No", tone: p.isDisabled ? undefined : "muted" },
          ]}
        />
      </InfoCard>

      <InfoCard title="Job & placement" icon={BriefcaseBusiness} action={edit("job")}>
        <DescriptionList
          items={[
            { label: "Department", value: p.departmentName },
            { label: "Designation", value: p.designationName },
            { label: "Branch", value: p.branchName },
            { label: "Category", value: p.category },
            { label: "Shreni (level)", value: p.shreni, wide: true },
            { label: "Reports to", value: p.supervisor?.name },
            { label: "Supervisor", value: p.isSupervisor ? "Yes" : "No", tone: p.isSupervisor ? undefined : "muted" },
            { label: "Joining date", value: date(p.joiningDate), mono: true },
            { label: "Confirmation date", value: date(p.confirmationDate), mono: true },
          ]}
        />
      </InfoCard>

      <InfoCard title="Pay" icon={Wallet} action={edit("pay")}>
        <DescriptionList
          items={[
            { label: "Basic salary", value: <Amount value={basic} prefix="NPR" />, tone: basic > 0 ? undefined : "warning" },
            { label: "Grade", value: <span>{p.gradeCount ?? 0} grade{(p.gradeCount ?? 0) === 1 ? "" : "s"} · <Amount value={grade} prefix="NPR" /></span> },
            { label: "Grade worked out", value: p.gradeBasis, tone: p.gradeManual ? undefined : "muted" },
            { label: "Total base pay", value: <Amount value={basic + grade} prefix="NPR" emphasis />, wide: true },
          ]}
        />
        <p className="mt-3 text-3xs text-ink-faint">Allowances and deductions are set in Salary mapping.</p>
      </InfoCard>

      <InfoCard title="Bank" icon={Landmark} action={edit("bank")}>
        <DescriptionList
          items={[
            { label: "Bank", value: p.bankName, wide: true, tone: p.bankName ? undefined : "warning" },
            { label: "Branch", value: p.bankBranch },
            { label: "Account number", value: p.bankAccountMasked || "Missing", mono: true, tone: p.bankAccountMasked ? undefined : "warning" },
          ]}
        />
        <p className="mt-3 text-3xs text-ink-faint">The full account number shows only when editing.</p>
      </InfoCard>

      <InfoCard title="Identity documents" icon={IdCard} action={edit("documents")}>
        <DescriptionList
          items={[
            { label: "Citizenship no.", value: doc(p.citizenshipNo, p.issuingDistrict), wide: true },
            { label: "PAN", value: p.panNumber, mono: true, tone: p.gaps.includes("pan") ? "warning" : undefined, copy: p.panNumber || undefined },
            { label: "National ID (NID)", value: doc(p.nidNo, p.nidIssuingDistrict) },
            { label: "Passport no.", value: doc(p.passportNo, p.passportIssuingDistrict) },
            { label: "Voter ID", value: doc(p.votersId, p.voterIdIssuingDistrict) },
          ]}
        />
      </InfoCard>

      <InfoCard title="Contact & addresses" icon={Contact} action={edit("contact")}>
        <DescriptionList
          items={[
            { label: "Mobile", value: p.mobileNo ? formatPhoneNumber(p.mobileNo) : null, mono: true, copy: p.mobileNo || undefined },
            { label: "Home phone", value: p.phoneHome ? formatPhoneNumber(p.phoneHome) : null, mono: true },
            { label: "Company email", value: p.companyEmail, copy: p.companyEmail || undefined },
            { label: "Personal email", value: p.personalEmail },
            { label: "Permanent address", value: addressText(p.permanentAddress), wide: true },
            { label: "Temporary address", value: sameAddress ? "Same as permanent" : addressText(p.temporaryAddress), wide: true, tone: sameAddress ? "muted" : undefined },
          ]}
        />
      </InfoCard>

      <InfoCard title="Family" icon={Users} action={edit("family")}>
        <DescriptionList
          items={[
            { label: "Father", value: p.fatherName },
            { label: "Mother", value: p.motherName },
            { label: "Grandfather", value: p.grandfatherName },
            { label: "Spouse", value: p.spouseName },
          ]}
        />
      </InfoCard>

      <InfoCard title="Self-service access" icon={ShieldCheck} action={edit("access")}>
        <DescriptionList
          items={
            p.access
              ? [
                  { label: "Sign-in email", value: p.access.email, wide: true },
                  { label: "Role", value: p.access.roleName },
                  {
                    label: "Status",
                    value: { active: "Active", pending: "Waiting for first sign-in", disabled: "Switched off" }[p.access.state],
                    tone: p.access.state === "active" ? "success" : "warning",
                  },
                ]
              : [{ label: "Login", value: "No self-service login", tone: "muted", wide: true }]
          }
        />
      </InfoCard>

      {separated && (
        <InfoCard title="Separation" icon={LogOut} action={edit("separation")} className="lg:col-span-2">
          <DescriptionList
            columns={3}
            items={[
              { label: "Notice given", value: date(p.informedDate), mono: true },
              { label: "Last working day", value: date(p.terminationDate), mono: true },
              { label: "Separation type", value: p.terminationType },
              { label: "Retirement benefit", value: p.terminationPlan },
              { label: "Reason", value: p.terminationReason, wide: true },
              { label: "Remarks", value: p.terminationRemarks, wide: true },
            ]}
          />
        </InfoCard>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Contact, IdCard, Landmark, LogOut, Paperclip, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { DescriptionList, InfoCard } from "@/components/kit/description-list";
import { calculateAgeInYears } from "@/lib/engines/employee.engine";
import { nepalToday } from "@/lib/utils/nepal-time";
import type { EmployeeProfile } from "@/lib/types/employee";
import { addressText } from "./employee-record-overview";
import { formatPhoneNumber } from "@/lib/utils/phone";
import { DOCUMENT_TYPE_LABEL, type EmployeeDocument } from "@/lib/types/employee-document";
import { DocumentViewer } from "./employee-document-viewer";

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
  const [viewing, setViewing] = useState<EmployeeDocument | null>(null);
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
            { label: "Basic + grade", value: <Amount value={basic + grade} prefix="NPR" emphasis />, wide: true },
          ]}
        />
        <p className="mt-3 text-3xs text-ink-faint">
          The full salary (allowances, SSF / PF, deductions, net payable) and pay changes are in{" "}
          <Link href={`/workforce/salary-mapping?employee=${p.id}`} className="font-medium text-brand-strong hover:underline">
            Salary structure
          </Link>
          .
        </p>
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
            ...(p.documents ?? []).map((d) => ({ label: DOCUMENT_TYPE_LABEL[d.type], value: <DocumentValue doc={d} onView={() => setViewing(d)} />, wide: true })),
            ...((p.documents ?? []).length === 0 ? [{ label: "Citizenship or National ID", value: "Not added", tone: "warning" as const, wide: true }] : []),
            { label: "PAN", value: p.panNumber, mono: true, tone: p.gaps.includes("pan") ? "warning" : undefined, copy: p.panNumber || undefined },
          ]}
        />
        {p.gaps.includes("documents") && <p className="mt-3 text-3xs text-warning">Add the issued date and a scan of the citizenship certificate or the National ID.</p>}
        {viewing && <DocumentViewer open title={DOCUMENT_TYPE_LABEL[viewing.type]} file={viewing.file} onClose={() => setViewing(null)} />}
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

/** One document: number · district · issued date, the issuing office, then its scan (opens the viewer). */
function DocumentValue({ doc, onView }: { doc: EmployeeDocument; onView: () => void }) {
  return (
    <span className="block">
      <span className="font-code">{doc.number}</span>
      {doc.district && <span className="ml-1.5 font-sans text-xs font-normal text-ink-muted">· {doc.district}</span>}
      <span className="ml-1.5 font-sans text-xs font-normal text-ink-muted">· {doc.issuedDate ? <>Issued <DateCell value={doc.issuedDate} /></> : <span className="text-warning">issued date missing</span>}</span>
      {doc.office && <span className="block font-sans text-xs font-normal text-ink-muted">{doc.office}</span>}
      <span className="mt-1 flex flex-wrap gap-1.5 font-sans text-xs font-normal">
        {doc.file ? (
          <button type="button" onClick={onView} className="inline-flex cursor-pointer items-center gap-1 rounded border border-line px-1.5 py-0.5 text-2xs font-medium text-brand hover:bg-brand-subtle">
            <Paperclip aria-hidden className="h-3 w-3" /> View scan
          </button>
        ) : (
          <span className="text-ink-faint">No scan</span>
        )}
      </span>
    </span>
  );
}

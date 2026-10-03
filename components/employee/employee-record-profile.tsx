import type { ReactNode } from "react";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { Panel } from "@/components/kit/panel";
import { formatStructuredAddress, parseStructuredAddress } from "@/lib/constants/nepal-locations";
import { cn } from "@/lib/utils";
import type { EmployeeProfile } from "@/lib/types/employee";

type Row = [label: string, value: ReactNode, tone?: "warning"];

/** A read-only property sheet: label left, value right, like the editor. */
function Sheet({ title, rows, className }: { title: string; rows: Row[]; className?: string }) {
  return (
    <Panel level={3} title={title} className={className}>
      <dl className="divide-y divide-line">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 px-4 py-2 text-xs">
            <dt className="text-ink-muted">{label}</dt>
            <dd className={cn("min-w-0 break-words text-ink", tone === "warning" && "font-medium text-warning")}>{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

const text = (v: string | null | undefined) => (v && v.trim() ? v : "—");
const date = (v: Date | string | null | undefined) => (v ? <DateCell value={v} /> : "—");
const code = (v: string | null | undefined) => (v && v.trim() ? <span className="font-code">{v}</span> : "—");
const withDistrict = (no: string | null | undefined, district: string | null | undefined) =>
  no && no.trim() ? (
    <>
      <span className="font-code">{no}</span>
      {district && <span className="text-ink-faint"> · {district}</span>}
    </>
  ) : (
    "—"
  );
const address = (raw: string | null | undefined) => {
  const formatted = raw ? formatStructuredAddress(parseStructuredAddress(raw)) : "";
  return formatted || "—";
};

/** The Profile tab: everything on the employee record, read-only, grouped like the form. */
export function EmployeeRecordProfile({ profile: p }: { profile: EmployeeProfile }) {
  const separated = p.status !== "Active" || !!p.terminationDate;
  const accessState = p.access ? { active: "Active", pending: "Waiting for first sign-in", disabled: "Disabled" }[p.access.state] : null;

  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-2">
      <Sheet
        title="Personal"
        rows={[
          ["Full name", p.fullName],
          ["Date of birth", date(p.dateOfBirth)],
          ["Gender", text(p.gender)],
          ["Tax status", text(p.taxStatus)],
          ["Person with disability", p.isDisabled ? "Yes (disability tax relief)" : "No"],
        ]}
      />
      <Sheet
        title="Job & placement"
        rows={[
          ["Department", text(p.departmentName)],
          ["Designation", text(p.designationName)],
          ["Branch", text(p.branchName)],
          ["Shreni (level)", text(p.shreni)],
          ["Category", text(p.category)],
          ["Supervisor", p.supervisor?.name ?? "—"],
          ["Approves for a team", p.isSupervisor ? "Yes" : "No"],
          ["Joining date", date(p.joiningDate)],
          ["Confirmation date", date(p.confirmationDate)],
        ]}
      />
      <Sheet
        title="Pay"
        rows={[
          ["Basic salary", <Amount key="b" value={Number(p.basicSalary) || 0} />, Number(p.basicSalary) > 0 ? undefined : "warning"],
          ["Grade count", String(p.gradeCount ?? 0)],
          ["Grade amount", <Amount key="g" value={Number(p.gradeAmount) || 0} />],
          ["Total base", <Amount key="t" value={(Number(p.basicSalary) || 0) + (Number(p.gradeAmount) || 0)} emphasis />],
        ]}
      />
      <Sheet
        title="Bank"
        rows={[
          ["Bank", text(p.bankName), p.bankName ? undefined : "warning"],
          ["Branch", text(p.bankBranch)],
          ["Account number", p.bankAccountMasked ? <span className="font-code">{p.bankAccountMasked}</span> : "Missing", p.bankAccountMasked ? undefined : "warning"],
        ]}
      />
      <Sheet
        title="Identity documents"
        rows={[
          ["Citizenship no.", withDistrict(p.citizenshipNo, p.issuingDistrict)],
          ["National ID (NID)", withDistrict(p.nidNo, p.nidIssuingDistrict)],
          ["Passport no.", withDistrict(p.passportNo, p.passportIssuingDistrict)],
          ["Voter ID", withDistrict(p.votersId, p.voterIdIssuingDistrict)],
          ["PAN", p.panNumber ? code(p.panNumber) : "Missing", p.gaps.includes("pan") ? "warning" : undefined],
        ]}
      />
      <Sheet
        title="Contact & address"
        rows={[
          ["Mobile", code(p.mobileNo)],
          ["Home phone", code(p.phoneHome)],
          ["Company email", text(p.companyEmail)],
          ["Personal email", text(p.personalEmail)],
          ["Permanent address", address(p.permanentAddress)],
          ["Temporary address", address(p.temporaryAddress)],
        ]}
      />
      <Sheet
        title="Family"
        rows={[
          ["Father", text(p.fatherName)],
          ["Mother", text(p.motherName)],
          ["Grandfather", text(p.grandfatherName)],
          ["Spouse", text(p.spouseName)],
        ]}
      />
      <Sheet
        title="Self-service access"
        rows={
          p.access
            ? [
                ["Sign-in email", p.access.email],
                ["Role", text(p.access.roleName)],
                ["Status", accessState, p.access.state === "active" ? undefined : "warning"],
                ["Last sign-in", p.access.lastLoginAt ? date(p.access.lastLoginAt) : "Never"],
              ]
            : [["Login", "No self-service login. Add one from Edit → Self-service access."]]
        }
      />
      {separated && (
        <Sheet
          title="Separation"
          className="xl:col-span-2"
          rows={[
            ["Notice date", date(p.informedDate)],
            ["Last working day", date(p.terminationDate)],
            ["Separation type", text(p.terminationType)],
            ["Retirement benefit", text(p.terminationPlan)],
            ["Reason", text(p.terminationReason)],
            ["Remarks", text(p.terminationRemarks)],
          ]}
        />
      )}
    </div>
  );
}

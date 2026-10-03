import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { FormGroup, ViewField } from "@/components/kit/form-grid";
import { calculateAgeInYears, tenureLabel } from "@/lib/engines/employee.engine";
import { findProvinceByDistrict, formatStructuredAddress, parseStructuredAddress } from "@/lib/constants/nepal-locations";
import { nepalToday } from "@/lib/utils/nepal-time";
import type { EmployeeProfile } from "@/lib/types/employee";

const TAX_STATUS: Record<string, string> = { "Normal Single": "Single", Married: "Married (couple slab)", Widow: "Widow / widower" };
const ACCESS_STATE = { active: "Active", pending: "Waiting for first sign-in", disabled: "Switched off" } as const;

const date = (v: Date | string | null | undefined) => (v ? <DateCell value={v} /> : null);
const yesNo = (v: boolean) => (v ? "Yes" : "No");

function address(raw: string | null | undefined) {
  if (!raw) return null;
  const a = parseStructuredAddress(raw);
  const formatted = formatStructuredAddress({ ...a, province: a.province || findProvinceByDistrict(a.district)?.id || "" });
  return formatted || null;
}

/**
 * The Profile tab in view mode: the same numbered sections, columns and field
 * widths as the editor, with values in read-only boxes, so a record looks
 * the same whether it is being read or edited (as desktop card pages do).
 */
export function EmployeeRecordProfile({ profile: p }: { profile: EmployeeProfile }) {
  const today = nepalToday();
  const dob = p.dateOfBirth ? new Date(p.dateOfBirth) : null;
  const age = dob && !isNaN(dob.getTime()) ? calculateAgeInYears(dob, today) : null;
  const tenure = tenureLabel(p.joiningDate, today);
  const basic = Number(p.basicSalary) || 0;
  const grade = Number(p.gradeAmount) || 0;
  const separated = p.status !== "Active" || !!p.terminationDate;
  const documents: [string, string | null, string | null][] = [
    ["Citizenship no.", p.citizenshipNo, p.issuingDistrict],
    ["National ID (NID)", p.nidNo, p.nidIssuingDistrict],
    ["Passport no.", p.passportNo, p.passportIssuingDistrict],
    ["Voter ID", p.votersId, p.voterIdIssuingDistrict],
  ];
  let n = 0;

  return (
    <div className="space-y-4">
      <FormGroup index={++n} title="General">
        <ViewField label="Full name" value={p.fullName} size="lg" span={2} />
        <ViewField label="Gender" value={p.gender} size="code" />
        <ViewField label="Employee code" value={p.employeeCode} size="code" mono />
        <ViewField label="Attendance code" value={p.attendanceCode} size="code" mono />
        <ViewField label="Date of birth" value={date(p.dateOfBirth)} size="date" mono suffix={age !== null ? `Age ${age}` : undefined} />
        <ViewField label="Tax status" value={TAX_STATUS[p.taxStatus] ?? p.taxStatus} />
        <ViewField label="Disability relief" value={yesNo(p.isDisabled)} size="code" />
      </FormGroup>

      <FormGroup index={++n} title="Job & placement">
        <ViewField label="Department" value={p.departmentName} />
        <ViewField label="Designation" value={p.designationName} />
        <ViewField label="Branch" value={p.branchName} />
        <ViewField label="Shreni (level)" value={p.shreni} />
        <ViewField label="Category" value={p.category} />
        <ViewField label="Supervisor" value={p.supervisor?.name} />
        <ViewField label="Joining date" value={date(p.joiningDate)} size="date" mono suffix={tenure || undefined} />
        <ViewField label="Confirmation date" value={date(p.confirmationDate)} size="date" mono />
        <ViewField label="Approves leave" value={yesNo(p.isSupervisor)} size="code" />
      </FormGroup>

      <FormGroup
        index={++n}
        title="Pay"
        description="Monthly, in NPR. Allowances and deductions are in Salary mapping."
        aside={
          <p className="text-xs text-ink-muted">
            Total base <Amount value={basic + grade} prefix="NPR" emphasis className="ml-1 text-ink" />
          </p>
        }
      >
        <ViewField label="Basic salary" value={<Amount value={basic} />} size="amount" tone={basic > 0 ? undefined : "warning"} />
        <ViewField label="Grade count" value={String(p.gradeCount ?? 0)} size="xs" mono />
        <ViewField label="Grade amount" value={<Amount value={grade} />} size="amount" />
      </FormGroup>

      <FormGroup index={++n} title="Identity documents">
        <div className="overflow-x-auto md:col-span-2 xl:col-span-3">
          <table className="w-full min-w-[30rem] max-w-3xl border-separate border-spacing-y-1 text-xs">
            <thead>
              <tr className="text-left text-3xs uppercase tracking-wide text-ink-faint">
                <th className="w-34 pr-3 text-right font-medium">Document</th>
                <th className="w-56 pr-3 font-medium">Number</th>
                <th className="w-60 font-medium">Issuing district</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(([label, no, district]) => (
                <tr key={label}>
                  <th scope="row" className="pr-3 text-right font-normal text-ink-muted">
                    {label}
                  </th>
                  <td className="pr-3">
                    <span className={`flex h-7 items-center rounded-md border border-line bg-surface-sunken/60 px-2 font-code text-sm ${no ? "text-ink" : "text-ink-faint"}`}>{no || "—"}</span>
                  </td>
                  <td>
                    <span className={`flex h-7 items-center rounded-md border border-line bg-surface-sunken/60 px-2 text-sm ${district ? "text-ink" : "text-ink-faint"}`}>{district || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ViewField label="PAN" value={p.panNumber} size="code" mono tone={p.gaps.includes("pan") ? "warning" : undefined} />
      </FormGroup>

      <FormGroup index={++n} title="Contact & address">
        <ViewField label="Mobile" value={p.mobileNo} size="code" mono />
        <ViewField label="Home phone" value={p.phoneHome} size="code" mono />
        <ViewField label="Company email" value={p.companyEmail} size="lg" />
        <ViewField label="Personal email" value={p.personalEmail} size="lg" />
        <ViewField label="Permanent address" value={address(p.permanentAddress)} size="full" span={3} />
        <ViewField
          label="Temporary address"
          value={!p.temporaryAddress || p.temporaryAddress === p.permanentAddress ? "Same as permanent" : address(p.temporaryAddress)}
          size="full"
          span={3}
        />
      </FormGroup>

      <FormGroup index={++n} title="Family">
        <ViewField label="Father's name" value={p.fatherName} size="lg" />
        <ViewField label="Mother's name" value={p.motherName} size="lg" />
        <ViewField label="Grandfather's name" value={p.grandfatherName} size="lg" />
        <ViewField label="Spouse's name" value={p.spouseName} size="lg" />
      </FormGroup>

      <FormGroup index={++n} title="Bank" description="Salary is paid to this account. The full number shows only when editing.">
        <ViewField label="Bank" value={p.bankName} size="lg" tone={p.bankName ? undefined : "warning"} />
        <ViewField label="Bank branch" value={p.bankBranch} />
        <ViewField label="Account number" value={p.bankAccountMasked || "Missing"} mono tone={p.bankAccountMasked ? undefined : "warning"} />
      </FormGroup>

      <FormGroup index={++n} title="Self-service access">
        {p.access ? (
          <>
            <ViewField label="Sign-in email" value={p.access.email} size="lg" />
            <ViewField label="Role" value={p.access.roleName} />
            <ViewField label="Login" value={ACCESS_STATE[p.access.state]} tone={p.access.state === "active" ? "success" : "warning"} />
          </>
        ) : (
          <ViewField label="Login" value="No self-service login" size="lg" />
        )}
      </FormGroup>

      {separated && (
        <FormGroup index={++n} title="Separation">
          <ViewField label="Notice date" value={date(p.informedDate)} size="date" mono />
          <ViewField label="Last working day" value={date(p.terminationDate)} size="date" mono />
          <ViewField label="Separation type" value={p.terminationType} />
          <ViewField label="Retirement benefit" value={p.terminationPlan} />
          <ViewField label="Reason" value={p.terminationReason} size="full" span={2} />
          <ViewField label="Remarks" value={p.terminationRemarks} size="full" span={3} />
        </FormGroup>
      )}
    </div>
  );
}

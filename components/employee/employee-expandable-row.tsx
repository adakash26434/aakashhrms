import {
  resolveBranchName,
  resolveDepartmentName,
  resolveEmployeeName,
  type EmployeeLookups,
} from "@/lib/constants/employee-lookups";
import { Employee } from "@/lib/types/employee";
import { BSDateDisplay } from "@/components/ui/nepali-date";

interface EmployeeExpandableRowProps {
  employee: Employee;
  lookups: EmployeeLookups;
}

function DetailCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[#d7e8d0]/80 bg-white p-3 shadow-sm ${className ?? ""}`}
    >
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-right font-medium text-[#1b3a1f]">{value}</span>
    </div>
  );
}

export function EmployeeExpandableRow({
  employee,
  lookups,
}: EmployeeExpandableRowProps) {
  const departmentName = resolveDepartmentName(
    employee.departmentId,
    lookups.departmentNameById,
  );
  const branchName = resolveBranchName(employee.branchId, lookups.branchNameById);
  const supervisorName = resolveEmployeeName(
    employee.supervisorId,
    lookups.employeeNameById,
  );

  return (
    <div className="border-b border-[#d7e8d0] bg-[#f6faf6]/70 px-4 py-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <DetailCard title="Identity">
          <div className="space-y-1.5">
            <DetailRow label="Citizenship" value={employee.citizenshipNo} />
            <DetailRow label="NID Card" value={employee.nidNo || "—"} />
            <DetailRow label="Passport" value={employee.passportNo || "—"} />
            <DetailRow label="Voter's ID" value={employee.votersId || "—"} />
            <DetailRow label="District" value={employee.issuingDistrict || employee.nidIssuingDistrict || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Employment">
          <div className="space-y-1.5">
            <DetailRow label="Category" value={employee.category} />
            <DetailRow label="Shreni" value={employee.shreni} />
            <DetailRow label="Supervisor" value={supervisorName} />
            <DetailRow
              label="Confirmed"
              value={
                employee.confirmationDate ? (
                  <BSDateDisplay date={employee.confirmationDate} />
                ) : (
                  "—"
                )
              }
            />
          </div>
        </DetailCard>

        <DetailCard title="Contact">
          <div className="space-y-1.5">
            <DetailRow label="Mobile" value={employee.mobileNo} />
            <DetailRow label="Company Email" value={employee.companyEmail || employee.email} />
            <DetailRow label="Personal Email" value={employee.personalEmail || "—"} />
            <DetailRow label="Phone" value={employee.phoneHome || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Family">
          <div className="space-y-1.5">
            <DetailRow label="Father" value={employee.fatherName || "—"} />
            <DetailRow label="Mother" value={employee.motherName || "—"} />
            <DetailRow label="Spouse" value={employee.spouseName || "—"} />
            <DetailRow label="Grandfather" value={employee.grandfatherName || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Bank">
          <div className="space-y-1.5">
            <DetailRow label="Bank" value={employee.bankName} />
            <DetailRow label="Account" value={employee.bankAccountNumber} />
            <DetailRow label="Branch" value={employee.bankBranch} />
            <DetailRow label="Grade Amt" value={`Rs. ${employee.gradeAmount.toLocaleString()}`} />
          </div>
        </DetailCard>
      </div>
    </div>
  );
}
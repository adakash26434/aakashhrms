"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  HeartHandshake,
  IdCard,
  MapPin,
  Pencil,
  Phone,
  User,
  Users,
} from "lucide-react";
import { SidePanel } from "@/components/ui/side-panel";
import { Employee } from "@/lib/types/employee";
import { BSDateDisplay } from "@/components/ui/nepali-date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  resolveBranchName,
  resolveDesignationName,
  resolveDepartmentName,
  resolveEmployeeName,
  type EmployeeLookups,
} from "@/lib/constants/employee-lookups";
import {
  formatStructuredAddress,
  parseStructuredAddress,
} from "@/lib/constants/nepal-locations";
import { cn } from "@/lib/utils";
import { getEmployeeByIdAction } from "@/app/actions/employee.actions";

interface EmployeeDetailPanelProps {
  open: boolean;
  employeeId: string | null;
  lookups: EmployeeLookups;
  onClose: () => void;
  onEdit: (id: string) => void;
}

export function EmployeeDetailPanel({
  open,
  employeeId,
  lookups,
  onClose,
  onEdit,
}: EmployeeDetailPanelProps) {
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    async function load() {
      if (!employeeId) {
        setEmployee(null);
        return;
      }
      const result = await getEmployeeByIdAction(employeeId);
      if (result.success && result.data) {
        setEmployee(result.data);
      } else {
        setEmployee(null);
      }
    }
    if (open) {
      load();
    }
  }, [employeeId, open]);

  const departmentName = employee
    ? resolveDepartmentName(employee.departmentId, lookups.departmentNameById)
    : "—";
  const designationName = employee
    ? resolveDesignationName(employee.designationId, lookups.designationNameById)
    : "—";
  const branchName = employee
    ? resolveBranchName(employee.branchId, lookups.branchNameById)
    : "—";
  const supervisorName = employee
    ? resolveEmployeeName(employee.supervisorId, lookups.employeeNameById)
    : "—";

  const statusVariant = useMemo(() => {
    if (!employee) return "default" as const;
    if (employee.status === "Active") return "info" as const;
    if (employee.status === "Terminated") return "danger" as const;
    return "warning" as const;
  }, [employee]);

  const permFormatted = employee
    ? formatStructuredAddress(
        parseStructuredAddress(employee.permanentAddress || employee.address1)
      ) || "—"
    : "—";

  const tempFormatted = employee
    ? formatStructuredAddress(
        parseStructuredAddress(employee.temporaryAddress || employee.address2)
      ) || "—"
    : "—";

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="2xl"
      header={
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-payroll-navy">
            Employee Details
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Complete employee record and official details
          </p>
        </div>
      }
      footer={
        <>
          <div className="mr-auto text-xs text-gray-500">
            {employee ? (
              <>
                Joined <BSDateDisplay date={new Date(employee.joiningDate)} />
              </>
            ) : null}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => employee && onEdit(employee.id)}
            disabled={!employee}
          >
            <Pencil className="h-4 w-4" />
            Edit Employee
          </Button>
        </>
      }
    >
      {employee && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-payroll-light/80 bg-payroll-cream/50 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-payroll-primary text-base font-bold text-white">
              {employee.firstName[0]}
              {employee.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-payroll-navy">
                {employee.firstName} {employee.lastName}
              </h3>
              <p className="font-mono text-xs text-gray-500">
                {employee.employeeCode}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant}>{employee.status}</Badge>
                <Badge variant="info">{employee.category}</Badge>
                <Badge variant="default">{employee.salaryGrade}</Badge>
              </div>
            </div>
          </div>

          <DetailSection title="General Information" icon={User}>
            <FieldGrid>
              <Field label="Attendance Code" value={employee.attendanceCode} />
              <Field label="Employee Code" value={employee.employeeCode} />
              <Field
                label="Full Name"
                value={`${employee.firstName} ${employee.lastName}`}
              />
              <Field label="Gender" value={employee.gender} />
              <Field
                label="Date of Birth"
                value={<BSDateDisplay date={new Date(employee.dateOfBirth)} />}
              />
              <Field label="Tax Status" value={employee.taxStatus} />
              <Field
                label="Disabled Status"
                value={employee.isDisabled ? "Yes (Tax Exempted)" : "No"}
              />
            </FieldGrid>
          </DetailSection>

          <DetailSection title="Office Information" icon={Building2}>
            <FieldGrid>
              <Field label="Category" value={employee.category} />
              <Field label="Department" value={departmentName} />
              <Field label="Designation" value={designationName} />
              <Field label="Shreni" value={employee.shreni || "—"} />
              <Field label="Branch" value={branchName} />
              <Field label="Supervisor" value={supervisorName} />
              <Field
                label="Joining Date"
                value={<BSDateDisplay date={new Date(employee.joiningDate)} />}
              />
              <Field
                label="Confirmation Date"
                value={
                  employee.confirmationDate ? (
                    <BSDateDisplay date={new Date(employee.confirmationDate)} />
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Retirement Date (Projected)"
                value={
                  employee.retirementDateProjected ? (
                    <BSDateDisplay date={new Date(employee.retirementDateProjected)} />
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Salary Grade" value={employee.salaryGrade} />
              <Field
                label="Grade Amount"
                value={`NPR ${employee.gradeAmount.toLocaleString()}`}
              />
            </FieldGrid>
          </DetailSection>

          <DetailSection title="Personal Information & Documents" icon={IdCard}>
            <FieldGrid>
              <Field label="Citizenship No" value={employee.citizenshipNo} />
              <Field label="Citizenship District" value={employee.issuingDistrict || "—"} />
              <Field label="NID Card No (10 Digits)" value={employee.nidNo || "—"} />
              <Field label="NID District" value={employee.nidIssuingDistrict || "—"} />
              <Field label="Passport No" value={employee.passportNo || "—"} />
              <Field label="Passport District" value={employee.passportIssuingDistrict || "—"} />
              <Field label="Voters ID" value={employee.votersId || "—"} />
              <Field label="Voter ID District" value={employee.voterIdIssuingDistrict || "—"} />
              <Field label="PAN Number" value={employee.panNumber || "—"} className="sm:col-span-2" />
            </FieldGrid>
          </DetailSection>

          <DetailSection title="Contact & Addresses" icon={MapPin}>
            <FieldGrid>
              <Field label="Company Email" value={employee.companyEmail || employee.email} />
              <Field label="Personal Email" value={employee.personalEmail || "—"} />
              <Field label="Mobile Number" value={employee.mobileNo} />
              <Field label="Phone (Home)" value={employee.phoneHome || "—"} />
              <Field
                label="Permanent Address (स्थायी ठेगाना)"
                value={permFormatted}
                className="sm:col-span-2"
              />
              <Field
                label="Temporary Address (अस्थायी ठेगाना)"
                value={tempFormatted}
                className="sm:col-span-2"
              />
            </FieldGrid>
          </DetailSection>

          <DetailSection title="Family Information (Lineage)" icon={Users}>
            <FieldGrid>
              <Field label="Father's Name" value={employee.fatherName || "—"} />
              <Field label="Mother's Name" value={employee.motherName || "—"} />
              <Field label="Grandfather's Name" value={employee.grandfatherName || "—"} />
              <Field label="Spouse's Name" value={employee.spouseName || "—"} />
            </FieldGrid>
          </DetailSection>

          <DetailSection title="Bank Details" icon={CreditCard}>
            <FieldGrid>
              <Field label="Bank Name" value={employee.bankName || "—"} />
              <Field label="Bank Branch" value={employee.bankBranch || "—"} />
              <Field label="Account Number" value={employee.bankAccountNumber || "—"} className="sm:col-span-2" />
            </FieldGrid>
          </DetailSection>

          {(employee.status === "Terminated" || employee.terminationDate || employee.terminationType) && (
            <DetailSection title="Termination / Retirement Information" icon={AlertTriangle}>
              <FieldGrid>
                <Field
                  label="Informed / Notice Date"
                  value={
                    employee.informedDate ? (
                      <BSDateDisplay date={new Date(employee.informedDate)} />
                    ) : (
                      "—"
                    )
                  }
                />
                <Field
                  label="Termination / Retirement Date"
                  value={
                    employee.terminationDate ? (
                      <BSDateDisplay date={new Date(employee.terminationDate)} />
                    ) : (
                      "—"
                    )
                  }
                />
                <Field label="Type" value={employee.terminationType || "—"} />
                <Field label="Plan" value={employee.terminationPlan || "—"} />
                <Field label="Reason" value={employee.terminationReason || "—"} className="sm:col-span-2" />
                <Field label="Remarks" value={employee.terminationRemarks || "—"} className="sm:col-span-2" />
              </FieldGrid>
            </DetailSection>
          )}
        </div>
      )}
    </SidePanel>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-payroll-light/70 pb-2">
        <Icon className="h-4 w-4 text-payroll-primary" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <div className="text-sm font-semibold text-payroll-navy">{value}</div>
    </div>
  );
}
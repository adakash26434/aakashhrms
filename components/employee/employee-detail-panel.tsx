"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  IdCard,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  ShieldCheck,
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
  resolveShreniName,
  type EmployeeLookups,
} from "@/lib/constants/employee-lookups";
import {
  formatStructuredAddress,
  parseStructuredAddress,
} from "@/lib/constants/nepal-locations";
import { cn } from "@/lib/utils";
import {
  getEmployeeByIdAction,
  getEmployeeAccessAction,
  resendEmployeeCredentialsAction,
} from "@/app/actions/employee.actions";

interface EmployeeDetailPanelProps {
  open: boolean;
  employeeId: string | null;
  lookups: EmployeeLookups;
  onClose: () => void;
  onEdit: (id: string) => void;
}

interface LinkedEmployeeAccess {
  userId: string;
  email: string;
  name: string | null;
  isActive: boolean;
  roleId: string | null;
  roleName: string | null;
  roleSlug: string | null;
  roleScopeType: "GLOBAL" | "BRANCH" | "DEPARTMENT" | "SELF" | null;
  mustChangePassword?: boolean;
  lastLoginAt?: Date | null;
  updatedAt?: Date;
  createdAt?: Date;
}

export function EmployeeDetailPanel({
  open,
  employeeId,
  lookups,
  onClose,
  onEdit,
}: EmployeeDetailPanelProps) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [access, setAccess] = useState<LinkedEmployeeAccess | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);
  // S2: a temporary password exists only in the response that issued it.
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      if (!employeeId) {
        setEmployee(null);
        setAccess(null);
        return;
      }
      setLoadingAccess(true);
      setFeedback(null);
      setIssuedPassword(null);

      const [empRes, accessRes] = await Promise.all([
        getEmployeeByIdAction(employeeId),
        getEmployeeAccessAction(employeeId),
      ]);

      if (empRes.success && empRes.data) {
        setEmployee(empRes.data);
      } else {
        setEmployee(null);
      }

      if (accessRes.success && accessRes.data?.access) {
        setAccess(accessRes.data.access);
      } else {
        setAccess(null);
      }
      setLoadingAccess(false);
    }

    if (open) {
      load();
    }
  }, [employeeId, open]);

  const handleCopyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleResendCredentials = async () => {
    if (!employeeId) return;
    setIsResending(true);
    setFeedback(null);
    try {
      const res = await resendEmployeeCredentialsAction(employeeId);
      if (res.success) {
        setIssuedPassword(res.tempPassword ?? null);
        setFeedback({
          type: "success",
          text: `A new temporary password was issued and emailed to ${res.email}. The previous one no longer works.`,
        });
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Failed to resend credentials email.",
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error sending email.",
      });
    } finally {
      setIsResending(false);
    }
  };

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
    return "neutral" as const;
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
          <h2 className="text-base font-semibold text-zinc-900">
            Employee Details
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Complete employee record, official details, and portal access credentials
          </p>
        </div>
      }
      footer={
        <>
          <div className="mr-auto text-xs text-zinc-500">
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
            className="bg-emerald-950 text-white hover:bg-emerald-900"
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
          {/* Header Badge Card */}
          <div className="flex items-center gap-3.5 rounded-md border border-zinc-200 bg-zinc-50/60 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-base font-semibold text-white shadow-2xs">
              {employee.fullName ? employee.fullName.slice(0, 2).toUpperCase() : "EM"}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-zinc-900">
                {employee.fullName}
              </h3>
              <p className="font-mono text-xs text-zinc-500">
                {employee.employeeCode}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant}>{employee.status}</Badge>
                <Badge variant="info">{employee.category}</Badge>
                {employee.isSupervisor && (
                  <Badge variant="success">Supervisor</Badge>
                )}
              </div>
            </div>
          </div>

          {/* General Information */}
          <DetailSection title="General Information" icon={User}>
            <FieldGrid>
              <Field label="Attendance Code" value={employee.attendanceCode} />
              <Field label="Employee Code" value={employee.employeeCode} />
              <Field
                label="Full Name"
                value={employee.fullName}
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

          {/* Office Information */}
          <DetailSection title="Office Information" icon={Building2}>
            <FieldGrid>
              <Field label="Category" value={employee.category} />
              <Field label="Department" value={departmentName} />
              <Field label="Designation" value={designationName} />
              <Field label="Level / Shreni" value={resolveShreniName(employee.shreni, lookups.shreniNameByCode)} />
              <Field label="Branch" value={branchName} />
              <Field label="Is Supervisor" value={employee.isSupervisor ? "Yes" : "No"} />
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
                label="Basic Salary"
                value={
                  employee.basicSalary
                    ? `NPR ${Number(employee.basicSalary).toLocaleString("en-IN")}`
                    : "NPR 0"
                }
              />
              <Field
                label="Grade Progression"
                value={`${employee.gradeCount ?? 0} Grade(s)`}
              />
              <Field
                label="Grade Amount"
                value={employee.gradeAmount ? `NPR ${Number(employee.gradeAmount).toLocaleString("en-IN")}` : "NPR 0"}
              />
              <Field
                label="Total Base Remuneration"
                value={`NPR ${(Number(employee.basicSalary || 0) + Number(employee.gradeAmount || 0)).toLocaleString("en-IN")}`}
              />
            </FieldGrid>
          </DetailSection>

          {/* Personal Information & Documents */}
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

          {/* Contact & Addresses */}
          <DetailSection title="Contact & Addresses" icon={MapPin}>
            <FieldGrid>
              <Field
                label="Company Email (Login Username)"
                value={
                  <div className="font-mono text-xs font-semibold text-zinc-900">
                    {employee.companyEmail || employee.email}
                  </div>
                }
              />
              <Field label="Personal Email" value={employee.personalEmail || "—"} />
              <Field label="Mobile Number" value={employee.mobileNo} />
              <Field label="Phone (Home)" value={employee.phoneHome || "—"} />
              <Field
                label="Permanent Address"
                value={permFormatted}
                className="sm:col-span-2"
              />
              <Field
                label="Temporary Address"
                value={tempFormatted}
                className="sm:col-span-2"
              />
            </FieldGrid>
          </DetailSection>

          {/* System Access & Self-Service Credentials */}
          <DetailSection title="System Access & Self-Service Credentials" icon={KeyRound}>
            {loadingAccess ? (
              <div className="flex items-center gap-2 py-4 text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-800" />
                <span>Loading system access details...</span>
              </div>
            ) : !access ? (
              <div className="rounded-md border border-dashed border-zinc-200 p-4 text-center">
                <p className="text-xs font-medium text-zinc-600">
                  No self-service account linked to this employee.
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  An account is created automatically when saving an employee with an email, or can be assigned from Admin → Users.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedback && (
                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-md p-3 text-xs",
                      feedback.type === "success"
                        ? "border border-emerald-200 bg-emerald-50/70 text-emerald-800"
                        : "border border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {feedback.type === "success" ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                    )}
                    <span className="flex-1">{feedback.text}</span>
                  </div>
                )}

                <FieldGrid>
                  <Field
                    label="Portal Account Status"
                    value={
                      <div className="flex items-center gap-2">
                        {access.mustChangePassword ? (
                          <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Pending First Login
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
                            Active & Password Secured
                          </span>
                        )}
                        {!access.isActive && (
                          <Badge variant="neutral">Deactivated</Badge>
                        )}
                      </div>
                    }
                  />

                  <Field
                    label="Assigned System Role"
                    value={
                      <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-800" />
                        {access.roleName || "Employee Self-Service"}
                      </span>
                    }
                  />

                  <Field
                    label="Login Username / Destination Email"
                    value={
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-zinc-900 truncate">
                          {access.email}
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {employee.companyEmail
                            ? "Company email account"
                            : "Personal email (corporate fallback)"}
                        </span>
                      </div>
                    }
                  />

                  {access.mustChangePassword ? (
                    <Field
                      label="Temporary Login Password"
                      value={
                        issuedPassword ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block rounded border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-zinc-900">
                                {issuedPassword}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-900"
                                onClick={() => handleCopyPassword(issuedPassword)}
                                title="Copy temporary password"
                              >
                                {copiedPassword ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                            <p className="text-[10px] text-amber-700">
                              Shown once. It is not stored and cannot be viewed again after you close this panel.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-amber-800">
                              Pending first sign-in
                            </div>
                            <p className="text-[10px] text-zinc-500">
                              The temporary password was emailed to the employee and is not stored. Issue a new one if it was lost.
                            </p>
                          </div>
                        )
                      }
                    />
                  ) : (
                    <Field
                      label="Account Password"
                      value={
                        <div className="space-y-1">
                          <div className="font-mono text-xs font-semibold text-zinc-700">
                            •••••••••••• (Encrypted Hash)
                          </div>
                          <p className="text-[10px] text-zinc-400">
                            Secured with bcrypt. Zero-knowledge compliance prevents plaintext viewing.
                          </p>
                        </div>
                      }
                    />
                  )}

                  {!access.mustChangePassword && (
                    <>
                      <Field
                        label="Password Last Changed"
                        value={
                          access.updatedAt ? (
                            <span className="text-xs text-zinc-700">
                              {new Date(access.updatedAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          ) : (
                            "—"
                          )
                        }
                      />
                      <Field
                        label="Last Active Login"
                        value={
                          access.lastLoginAt ? (
                            <span className="text-xs text-zinc-700">
                              {new Date(access.lastLoginAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">
                              Never logged in
                            </span>
                          )
                        }
                      />
                    </>
                  )}
                </FieldGrid>

                {/* Actions & Navigation Footer */}
                {access.mustChangePassword && (
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      onClick={handleResendCredentials}
                      disabled={isResending}
                    >
                      {isResending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 mr-1.5 text-emerald-800" />
                      )}
                      Issue New Password &amp; Email
                    </Button>
                  </div>
                )}

                {!access.mustChangePassword && (
                  <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 text-xs text-zinc-500">
                    <span>To issue an administrative reset or update security roles:</span>
                    <Link
                      href="/admin/users"
                      className="inline-flex items-center gap-1 font-medium text-emerald-800 hover:text-emerald-950 hover:underline"
                    >
                      Manage in Admin → Users
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </DetailSection>

          {/* Family Information */}
          <DetailSection title="Family Information (Lineage)" icon={Users}>
            <FieldGrid>
              <Field label="Father's Name" value={employee.fatherName || "—"} />
              <Field label="Mother's Name" value={employee.motherName || "—"} />
              <Field label="Grandfather's Name" value={employee.grandfatherName || "—"} />
              <Field label="Spouse's Name" value={employee.spouseName || "—"} />
            </FieldGrid>
          </DetailSection>

          {/* Bank Details */}
          <DetailSection title="Bank Details" icon={CreditCard}>
            <FieldGrid>
              <Field label="Bank Name" value={employee.bankName || "—"} />
              <Field label="Bank Branch" value={employee.bankBranch || "—"} />
              <Field label="Account Number" value={employee.bankAccountNumber || "—"} className="sm:col-span-2" />
            </FieldGrid>
          </DetailSection>

          {/* Termination / Retirement Details (Conditional) */}
          {(employee.status === "Inactive" || employee.terminationDate || employee.terminationType) && (
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
      <div className="flex items-center gap-2 border-b border-zinc-300 pb-2">
        <Icon className="h-4 w-4 text-emerald-800" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <div className="text-sm font-medium text-zinc-900">{value}</div>
    </div>
  );
}
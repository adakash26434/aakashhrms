"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Clock,
  User,
  Building2,
  IdCard,
  Users,
  CreditCard,
  FileCheck2,
  ChevronRight,
  Save,
  RotateCcw,
  Copy,
  KeyRound,
} from "lucide-react";

import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type {
  Employee,
  EmployeeFormData,
  EmployeeValidationErrors,
} from "@/lib/types/employee";
import type { ShreniLevelItem } from "@/lib/constants/industry-types";
import type { EmploymentType } from "@/lib/types/company-setup";
import {
  validateEmployeeTab,
  validateEmployee,
  getNextEmployeeCode,
  getNextAttendanceCode,
} from "@/lib/engines/employee.engine";
import {
  saveEmployeeAction,
  getEmployeeByIdAction,
  getEmployeeLookupDataAction,
  getEmployeeAccessAction,
} from "@/app/actions/employee.actions";
import type { EmployeeAccessOptions } from "@/lib/services/employee.service";
import { getShreniLevelsAction } from "@/app/actions/shreni.actions";
import { getEmploymentTypesAction } from "@/app/actions/company-setup.actions";
import type { GradePolicySettings } from "@/lib/types/system-control";
import { EmployeeFormTabs } from "./employee-form-tabs";

interface EmployeeCreateFlowProps {
  editingId?: string | null;
  initialEmployee?: Employee | null;
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string; departmentId: string }[];
  employees: {
    id: string;
    name: string;
    employeeCode?: string;
    attendanceCode?: string;
    isSupervisor?: boolean;
  }[];
  industryType?: string;
  shreniLevels?: ShreniLevelItem[];
  gradePolicy?: GradePolicySettings;
}

const EMPTY_FORM: EmployeeFormData = {
  attendanceCode: "",
  employeeCode: "",
  fullName: "",
  gender: "Male",
  dateOfBirth: "",
  taxStatus: "Normal Single",
  isDisabled: false,
  category: "Permanent",
  shreni: "",
  departmentId: "",
  designationId: "",
  branchId: "",
  isSupervisor: false,
  supervisorId: "",
  joiningDate: "",
  confirmationDate: "",
  status: "Active",
  basicSalary: 0,
  gradePercent: 0,
  gradeCount: 0,
  gradeAmount: 0,
  citizenshipNo: "",
  issuingDistrict: "",
  nidNo: "",
  nidIssuingDistrict: "",
  passportNo: "",
  passportIssuingDistrict: "",
  votersId: "",
  voterIdIssuingDistrict: "",
  panNumber: "",
  phoneHome: "",
  mobileNo: "",
  email: "",
  companyEmail: "",
  personalEmail: "",
  permanentAddress: "",
  temporaryAddress: "",
  address1: "",
  address2: "",
  fatherName: "",
  motherName: "",
  spouseName: "",
  grandfatherName: "",
  bankName: "",
  bankBranch: "",
  bankAccountNumber: "",
  informedDate: "",
  terminationDate: "",
  terminationType: "",
  terminationReason: "",
  terminationPlan: "",
  terminationRemarks: "",
};

const STEPS = [
  {
    index: 0,
    title: "General Information",
    subtitle: "Name, codes, gender, DOB & tax classification",
    icon: User,
  },
  {
    index: 1,
    title: "Office Information",
    subtitle: "Role, department, branch, supervisor & dates",
    icon: Building2,
  },
  {
    index: 2,
    title: "Personal & Identity",
    subtitle: "PAN, citizenship, NID, contact & addresses",
    icon: IdCard,
  },
  {
    index: 3,
    title: "Family Information",
    subtitle: "Lineage, parents & marital details",
    icon: Users,
  },
  {
    index: 4,
    title: "Bank & Review",
    subtitle: "Bank account details & profile confirmation",
    icon: CreditCard,
  },
];

function toDateInputValue(d: string | Date | undefined | null): string {
  if (!d) return "";
  if (typeof d === "string") {
    if (d.includes("T")) return d.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return "";
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildFormFromEmployee(emp: Employee): EmployeeFormData {
  return {
    attendanceCode: emp.attendanceCode,
    employeeCode: emp.employeeCode,
    fullName: emp.fullName,
    gender: emp.gender,
    dateOfBirth: toDateInputValue(emp.dateOfBirth),
    taxStatus: emp.taxStatus,
    isDisabled: emp.isDisabled,
    category: emp.category,
    shreni: emp.shreni,
    departmentId: emp.departmentId,
    designationId: emp.designationId,
    branchId: emp.branchId,
    isSupervisor: emp.isSupervisor || false,
    supervisorId: emp.supervisorId || "",
    joiningDate: toDateInputValue(emp.joiningDate),
    confirmationDate: toDateInputValue(emp.confirmationDate),
    status: emp.status,
    basicSalary: emp.basicSalary ?? 0,
    gradePercent: emp.gradePercent,
    gradeCount: emp.gradeCount ?? 0,
    gradeAmount: emp.gradeAmount,
    citizenshipNo: emp.citizenshipNo,
    issuingDistrict: emp.issuingDistrict,
    nidNo: emp.nidNo || "",
    nidIssuingDistrict: emp.nidIssuingDistrict || "",
    passportNo: emp.passportNo || "",
    passportIssuingDistrict: emp.passportIssuingDistrict || "",
    votersId: emp.votersId || "",
    voterIdIssuingDistrict: emp.voterIdIssuingDistrict || "",
    panNumber: emp.panNumber || "",
    phoneHome: emp.phoneHome || "",
    mobileNo: emp.mobileNo,
    email: emp.companyEmail || emp.email || "",
    companyEmail: emp.companyEmail || emp.email || "",
    personalEmail: emp.personalEmail || "",
    permanentAddress: emp.permanentAddress || emp.address1 || "",
    temporaryAddress: emp.temporaryAddress || emp.address2 || "",
    address1: emp.permanentAddress || emp.address1 || "",
    address2: emp.temporaryAddress || emp.address2 || "",
    fatherName: emp.fatherName || "",
    motherName: emp.motherName || "",
    spouseName: emp.spouseName || "",
    grandfatherName: emp.grandfatherName || "",
    bankName: emp.bankName,
    bankBranch: emp.bankBranch,
    bankAccountNumber: emp.bankAccountNumber,
    informedDate: toDateInputValue(emp.informedDate),
    terminationDate: toDateInputValue(emp.terminationDate),
    terminationType: emp.terminationType || "",
    terminationReason: emp.terminationReason || "",
    terminationPlan: emp.terminationPlan || "",
    terminationRemarks: emp.terminationRemarks || "",
  };
}

export function EmployeeCreateFlow({
  editingId,
  initialEmployee,
  branches,
  departments,
  designations,
  employees,
  industryType,
  shreniLevels: initialShreniLevels,
  gradePolicy: initialGradePolicy,
}: EmployeeCreateFlowProps) {
  const router = useRouter();
  const toast = useToast();

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<EmployeeFormData>(() => {
    if (initialEmployee) {
      return buildFormFromEmployee(initialEmployee);
    }
    if (typeof window !== "undefined" && !editingId) {
      const savedDraft = sessionStorage.getItem("payroll_employee_new_draft");
      if (savedDraft) {
        try {
          return JSON.parse(savedDraft);
        } catch {
          sessionStorage.removeItem("payroll_employee_new_draft");
        }
      }
    }
    const existingEmpCodes = employees
      .map((e) => e.employeeCode || "")
      .filter(Boolean);
    const existingAtdCodes = employees
      .map((e) => e.attendanceCode || "")
      .filter(Boolean);
    return {
      ...EMPTY_FORM,
      employeeCode: getNextEmployeeCode(existingEmpCodes),
      attendanceCode: getNextAttendanceCode(existingAtdCodes, "ATD-"),
    };
  });

  const [errors, setErrors] = useState<EmployeeValidationErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(() => {
    if (typeof window !== "undefined" && !editingId) {
      return !!sessionStorage.getItem("payroll_employee_new_draft");
    }
    return false;
  });
  const [shreniLevels, setShreniLevels] = useState<ShreniLevelItem[]>(initialShreniLevels || []);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [gradePolicy, setGradePolicy] = useState<GradePolicySettings | undefined>(initialGradePolicy);
  const [credentials, setCredentials] = useState<{
    email: string;
    tempPassword: string;
    userName?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [accessInfo, setAccessInfo] = useState<any>(null);
  const [accessOptions, setAccessOptions] = useState<EmployeeAccessOptions>({
    createLogin: true,
    roleSlug: "employee",
  });

  // Load employee access and available roles
  useEffect(() => {
    let active = true;
    getEmployeeAccessAction(editingId || null).then((res) => {
      if (active && res.success && res.data) {
        setRoles(res.data.roles);
        setAccessInfo(res.data.access);
        if (res.data.access) {
          setAccessOptions({
            createLogin: res.data.access.isActive,
            roleSlug: res.data.access.roleSlug || "employee",
            roleId: res.data.access.roleId || undefined,
          });
        } else {
          const empRole = res.data.roles.find((r: any) => r.slug === "employee");
          if (empRole) {
            setAccessOptions((prev) => ({
              ...prev,
              roleSlug: "employee",
              roleId: empRole.id,
            }));
          }
        }
      }
    });
    return () => {
      active = false;
    };
  }, [editingId]);

  // Load organizational custom levels and employment types
  useEffect(() => {
    async function loadOrgMetadata() {
      try {
        const promises: Promise<any>[] = [getEmploymentTypesAction()];
        if (!initialShreniLevels || initialShreniLevels.length === 0) {
          promises.push(getShreniLevelsAction());
        }
        if (!initialGradePolicy) {
          promises.push(getEmployeeLookupDataAction());
        }
        const results = await Promise.all(promises);
        const typRes = results[0];
        if (typRes?.success && typRes.data) setEmploymentTypes(typRes.data);

        results.forEach((res) => {
          if (res?.success && res.data) {
            if (Array.isArray(res.data) && res.data.length > 0 && "levelNumber" in res.data[0]) {
              setShreniLevels(res.data);
            } else if ("gradePolicy" in res.data && res.data.gradePolicy) {
              setGradePolicy(res.data.gradePolicy);
              if (res.data.shreniLevels?.length) {
                setShreniLevels(res.data.shreniLevels);
              }
            }
          }
        });
      } catch {}
    }
    loadOrgMetadata();
  }, [initialShreniLevels, initialGradePolicy]);

  // Async load employee record when editing without preloaded initialEmployee
  useEffect(() => {
    if (editingId && !initialEmployee) {
      let active = true;
      getEmployeeByIdAction(editingId).then((res) => {
        if (active && res.success && res.data) {
          setFormData(buildFormFromEmployee(res.data));
        }
      });
      return () => {
        active = false;
      };
    }
  }, [editingId, initialEmployee]);

  // Auto-save draft to sessionStorage
  useEffect(() => {
    if (editingId) return;
    const hasData = !!(
      formData.fullName?.trim() ||
      formData.mobileNo?.trim() ||
      formData.citizenshipNo?.trim() ||
      formData.departmentId ||
      formData.designationId ||
      formData.branchId ||
      formData.joiningDate
    );
    if (typeof window !== "undefined") {
      if (hasData) {
        sessionStorage.setItem(
          "payroll_employee_new_draft",
          JSON.stringify(formData),
        );
      }
    }
  }, [formData, editingId]);

  const handleDiscardDraft = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("payroll_employee_new_draft");
    }
    const existingEmpCodes = employees
      .map((e) => e.employeeCode || "")
      .filter(Boolean);
    const existingAtdCodes = employees
      .map((e) => e.attendanceCode || "")
      .filter(Boolean);
    setFormData({
      ...EMPTY_FORM,
      employeeCode: getNextEmployeeCode(existingEmpCodes),
      attendanceCode: getNextAttendanceCode(existingAtdCodes, "ATD-"),
    });
    setErrors({});
    setActiveStep(0);
    setHasDraft(false);
    toast.info("In-progress draft cleared");
  };

  const validateCurrentStep = (stepIdx: number): boolean => {
    const stepErrors = validateEmployeeTab(formData, stepIdx);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      const firstMsg = Object.values(stepErrors)[0];
      toast.error(firstMsg || "Please fix required fields in this step");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    // Validate current step before advancing, but allow user to stay or review
    const isValid = validateCurrentStep(activeStep);
    if (!isValid) return;

    if (activeStep < STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSave = async () => {
    const allErrors = validateEmployee(formData);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      // Auto-jump to the earliest step with an error
      for (let i = 0; i < STEPS.length; i++) {
        const stepErrors = validateEmployeeTab(formData, i);
        if (Object.keys(stepErrors).some((k) => k in allErrors)) {
          setActiveStep(i);
          const firstMsg =
            allErrors[Object.keys(stepErrors)[0] as keyof EmployeeValidationErrors];
          toast.error(firstMsg || `Please resolve errors in ${STEPS[i].title}`);
          return;
        }
      }
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveEmployeeAction(editingId ?? null, formData, accessOptions);
      if (!res.success) {
        if (res.validationErrors && Object.keys(res.validationErrors).length > 0) {
          setErrors(res.validationErrors);
          for (let i = 0; i < STEPS.length; i++) {
            const stepErrors = validateEmployeeTab(formData, i);
            if (Object.keys(stepErrors).some((k) => k in res.validationErrors!)) {
              setActiveStep(i);
              break;
            }
          }
        }
        toast.error(res.error || "Failed to save employee profile");
        setIsSaving(false);
        return;
      }

      // Successful save
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("payroll_employee_new_draft");
      }

      const saved = res.data as
        | {
            provisionedAccess?: { email: string; tempPassword: string; userName?: string };
            accessWarning?: string;
          }
        | undefined;

      // Surface any access-provisioning warning (e.g. email already in use)
      if (saved?.accessWarning) {
        toast.error(saved.accessWarning);
      }

      // If a self-service login was provisioned, show the credentials
      // instead of navigating away immediately.
      if (saved?.provisionedAccess) {
        setCredentials(saved.provisionedAccess);
        setIsSaving(false);
        return;
      }

      toast.success(
        editingId
          ? "Employee updated successfully!"
          : "Employee registered successfully!",
      );
      router.push("/workforce/employees");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save employee";
      toast.error(msg);
      setIsSaving(false);
    }
  };

  // Desktop ERP keyboard shortcuts: Ctrl+S (Save), Alt+1..5 (Step switch)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S -> Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
      // Alt+1 to Alt+5 -> Direct tab jump
      if (e.altKey && ["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        const targetStep = parseInt(e.key, 10) - 1;
        setActiveStep(targetStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formData, activeStep, isSaving]);

  const totalMissingRequired = useMemo(() => {
    return Object.keys(validateEmployee(formData)).length;
  }, [formData]);

  const currentStepDef = STEPS[activeStep];

  return (
    <PageFrame size="wide" spacing="default">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Link
            href="/workforce/employees"
            className="inline-flex items-center gap-1.5 font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Employee Directory</span>
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="font-semibold text-zinc-900">
            {editingId ? `Edit Employee: ${formData.fullName || "Record"}` : "Add Employee"}
          </span>
          {totalMissingRequired === 0 ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-2xs font-semibold text-emerald-800">
              <Check className="h-3 w-3" />
              Ready to Save
            </span>
          ) : (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-2xs font-semibold text-amber-800">
              <AlertCircle className="h-3 w-3" />
              {totalMissingRequired} required {totalMissingRequired === 1 ? "field" : "fields"} remaining
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasDraft && !editingId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscardDraft}
              className="h-9 gap-1.5 rounded-md border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-none cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Discard Draft</span>
            </Button>
          )}

          {!editingId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("payroll_employee_new_draft", JSON.stringify(formData));
                  setHasDraft(true);
                  toast.success("Draft saved successfully");
                }
              }}
              className="h-9 gap-1.5 rounded-md border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-none cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save as Draft</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/workforce/employees")}
            className="h-9 rounded-md border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-none cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Two-Column Guided Workflow Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Step Rail */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="sticky top-20 space-y-4">
            {/* Stepper Card */}
            <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
              {/* Profile Avatar & Header */}
              <div className="flex items-center gap-3 pb-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-800">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-zinc-900 truncate">
                    {editingId ? "Edit Profile" : "New Employee"}
                  </h3>
                  <p className="text-2xs text-zinc-500 truncate">
                    Complete all 5 sections
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="pb-4 pt-1 border-t border-zinc-200">
                <div className="flex items-center justify-between text-2xs font-bold tracking-wider text-zinc-400 uppercase mb-1.5">
                  <span>Progress</span>
                  <span className="text-emerald-700 font-mono text-2xs">
                    {Math.round(((activeStep + 1) / STEPS.length) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-payroll-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(((activeStep + 1) / STEPS.length) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Stepper Navigation List */}
              <nav className="space-y-1.5 pt-1">
                {STEPS.map((step) => {
                  const isActive = step.index === activeStep;
                  const isCompleted = step.index < activeStep;
                  const stepErrors = validateEmployeeTab(formData, step.index);
                  const hasErrors = Object.keys(stepErrors).length > 0;

                  return (
                    <button
                      key={step.index}
                      type="button"
                      onClick={() => {
                        setActiveStep(step.index);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all cursor-pointer select-none",
                        isActive
                          ? "bg-payroll-primary-light border border-payroll-border text-payroll-navy font-semibold shadow-none"
                          : "bg-white hover:bg-zinc-50 border border-transparent text-zinc-600",
                      )}
                    >
                      {/* Step Number Circle */}
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                          isActive
                            ? "bg-payroll-primary text-white shadow-none"
                            : isCompleted && !hasErrors
                            ? "bg-payroll-primary-light text-payroll-primary"
                            : hasErrors
                            ? "bg-red-100 text-red-700"
                            : "bg-zinc-100 text-zinc-400",
                        )}
                      >
                        {isCompleted && !hasErrors ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : hasErrors ? (
                          <AlertCircle className="h-3.5 w-3.5" />
                        ) : (
                          step.index + 1
                        )}
                      </div>

                      {/* Step Title */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-xs truncate",
                              isActive
                                ? "font-semibold text-emerald-950"
                                : isCompleted
                                ? "font-medium text-zinc-800"
                                : "text-zinc-500",
                            )}
                          >
                            {step.title}
                          </span>
                          {hasErrors && (
                            <span className="text-2xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              {Object.keys(stepErrors).length}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Key Parameters Card */}
            <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
              <span className="text-2xs font-bold uppercase tracking-wider text-zinc-400">
                Assigned Identifiers
              </span>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Employee Code:</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {formData.employeeCode || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Attendance Code:</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {formData.attendanceCode || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Status:</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 text-2xs border border-emerald-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    {formData.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Category:</span>
                  <span className="font-semibold text-zinc-700">
                    {formData.category || "—"}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-200 flex items-center justify-between text-2xs text-zinc-400">
                <span>Quick save:</span>
                <kbd className="rounded bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 font-mono text-2xs text-zinc-600">
                  Ctrl+S
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Right Active Form Step Workspace */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="rounded-xl border border-zinc-200/80 bg-white p-6 sm:p-8">
            {/* Active Step Header inside Canvas */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-5 mb-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-800">
                  {React.createElement(currentStepDef.icon, { className: "h-5 w-5" })}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900">
                    {currentStepDef.title}
                  </h2>
                </div>
              </div>

              <div className="shrink-0">
                <span className="inline-flex items-center rounded-md bg-zinc-100 border border-zinc-200/60 px-3 py-1 text-xs font-semibold text-zinc-600">
                  Step {activeStep + 1} / {STEPS.length}
                </span>
              </div>
            </div>

            {/* Preserved Form Tabs Content */}
            <EmployeeFormTabs
              tabIndex={activeStep}
              formData={formData}
              setFormData={setFormData}
              branches={branches}
              departments={departments}
              designations={designations}
              employees={employees}
              industryType={industryType}
              shreniLevels={shreniLevels}
              employmentTypes={employmentTypes}
              gradePolicy={gradePolicy}
              errors={errors}
              setErrors={setErrors}
              editingId={editingId}
              roles={roles}
              accessInfo={accessInfo}
              accessOptions={accessOptions}
              setAccessOptions={setAccessOptions}
            />

            {/* In-Step Review Card on Step 4 (Bank & Review) */}
            {activeStep === 4 && (
              <div className="mt-8 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-5">
                <div className="flex items-center gap-2 text-emerald-950 font-semibold text-sm mb-4">
                  <FileCheck2 className="h-4 w-4 text-emerald-700" />
                  <span>Profile Readiness Summary</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-md bg-white p-3 border border-zinc-200">
                    <span className="text-2xs text-zinc-400 uppercase font-semibold">Full Name</span>
                    <div className="font-semibold text-zinc-900 truncate mt-0.5">
                      {formData.fullName || "—"}
                    </div>
                  </div>
                  <div className="rounded-md bg-white p-3 border border-zinc-200">
                    <span className="text-2xs text-zinc-400 uppercase font-semibold">Contact</span>
                    <div className="font-mono text-zinc-900 truncate mt-0.5">
                      {formData.mobileNo || "—"}
                    </div>
                  </div>
                  <div className="rounded-md bg-white p-3 border border-zinc-200">
                    <span className="text-2xs text-zinc-400 uppercase font-semibold">PAN Number</span>
                    <div className="font-mono text-zinc-900 truncate mt-0.5">
                      {formData.panNumber || "—"}
                    </div>
                  </div>
                  <div className="rounded-md bg-white p-3 border border-zinc-200">
                    <span className="text-2xs text-zinc-400 uppercase font-semibold">Citizenship</span>
                    <div className="font-mono text-zinc-900 truncate mt-0.5">
                      {formData.citizenshipNo || "—"}
                    </div>
                  </div>
                  <div className="rounded-md bg-white p-3 border border-zinc-200">
                    <span className="text-2xs text-zinc-400 uppercase font-semibold">Bank</span>
                    <div className="text-zinc-900 truncate mt-0.5">
                      {formData.bankName || "—"}
                    </div>
                  </div>
                  <div className="rounded-md bg-white p-3 border border-zinc-200">
                    <span className="text-2xs text-zinc-400 uppercase font-semibold">Account No</span>
                    <div className="font-mono text-zinc-900 truncate mt-0.5">
                      {formData.bankAccountNumber || "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Action Bar inside Canvas */}
            <div className="border-t border-zinc-200 pt-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrevStep}
                disabled={activeStep === 0}
                className="h-10 px-4 gap-1.5 rounded-md border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 shadow-none cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>

              <div className="flex items-center gap-1.5">
                {STEPS.map((s) => (
                  <button
                    key={s.index}
                    type="button"
                    onClick={() => setActiveStep(s.index)}
                    className={cn(
                      "h-2 rounded-full transition-all cursor-pointer",
                      s.index === activeStep
                        ? "w-6 bg-payroll-primary"
                        : s.index < activeStep
                        ? "w-2 bg-payroll-primary/60"
                        : "w-2 bg-zinc-200",
                    )}
                    aria-label={`Go to ${s.title}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {activeStep < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNextStep}
                    className="h-10 px-5 gap-1.5 rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-xs font-semibold text-white shadow-none transition-colors cursor-pointer"
                  >
                    <span>Save & Continue</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-10 px-6 gap-1.5 rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-xs font-semibold text-white shadow-none transition-colors cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSaving ? "Saving..." : editingId ? "Save Changes" : "Submit & Register Employee"}</span>
                    <kbd className="hidden sm:inline-block ml-1 rounded bg-black/20 px-1 text-2xs font-mono font-normal">
                      Ctrl+S
                    </kbd>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Self-Service Credentials Dialog */}
      <Dialog
        open={!!credentials}
        onClose={() => {
          setCredentials(null);
          router.push("/workforce/employees");
        }}
        title="Self-Service Login Created"
        description="A login account was created for this employee. Share the temporary password securely."
        size="lg"
        footer={
          <Button
            onClick={() => {
              setCredentials(null);
              router.push("/workforce/employees");
            }}
            className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-semibold"
          >
            Done
          </Button>
        }
      >
        {credentials && (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm mb-3">
                <KeyRound className="h-4 w-4" />
                <span>Temporary Credentials</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500 shrink-0">Name</span>
                  <span className="font-semibold text-zinc-900 truncate">
                    {credentials.userName || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500 shrink-0">Email</span>
                  <span className="font-mono font-semibold text-zinc-900 truncate">
                    {credentials.email}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500 shrink-0">Temporary Password</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono bg-emerald-100 px-2 py-0.5 rounded font-bold text-emerald-950">
                      {credentials.tempPassword}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(credentials.tempPassword);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="gap-1 bg-white"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-gray-500" />
                      )}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              The employee will be asked to change this password on first login.
            </p>
          </div>
        )}
      </Dialog>
    </PageFrame>
  );
}

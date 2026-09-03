"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  IdCard,
  User,
  Users,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
import { Employee, EmployeeFormData, EmployeeValidationErrors } from "@/lib/types/employee";
import { EmployeeFormTabs } from "./employee-form-tabs";
import { getEmployeeByIdAction } from "@/app/actions/employee.actions";
import {
  validateEmployeeTab,
  validateEmployee,
  getNextEmployeeCode,
  getNextAttendanceCode,
} from "@/lib/engines/employee.engine";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  onSave: (formData: EmployeeFormData) => Promise<void>;
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: { id: string; name: string; departmentId: string }[];
  employees: { id: string; name: string; employeeCode?: string; attendanceCode?: string }[];
  industryType?: string;
}

const EMPTY_FORM: EmployeeFormData = {
  attendanceCode: "",
  employeeCode: "",
  firstName: "",
  lastName: "",
  gender: "Male",
  dateOfBirth: "",
  taxStatus: "Normal Single",
  isDisabled: false,
  category: "Permanent",
  shreni: "",
  departmentId: "",
  designationId: "",
  branchId: "",
  supervisorId: "",
  joiningDate: "",
  confirmationDate: "",
  retirementDateProjected: "",
  status: "Active",
  salaryGrade: "",
  gradePercent: 100,
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

const TABS = [
  { label: "General Info", icon: User },
  { label: "Office Info", icon: Building2 },
  { label: "Personal Info", icon: IdCard },
  { label: "Family Info", icon: Users },
  { label: "Bank & Termination", icon: CreditCard },
] as const;

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
    firstName: emp.firstName,
    lastName: emp.lastName,
    gender: emp.gender,
    dateOfBirth: toDateInputValue(emp.dateOfBirth),
    taxStatus: emp.taxStatus,
    isDisabled: emp.isDisabled,
    category: emp.category,
    shreni: emp.shreni,
    departmentId: emp.departmentId,
    designationId: emp.designationId,
    branchId: emp.branchId,
    supervisorId: emp.supervisorId || "",
    joiningDate: toDateInputValue(emp.joiningDate),
    confirmationDate: toDateInputValue(emp.confirmationDate),
    retirementDateProjected: toDateInputValue(emp.retirementDateProjected),
    status: emp.status,
    salaryGrade: emp.salaryGrade,
    gradePercent: emp.gradePercent,
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

export function EmployeeFormModal({
  open,
  onClose,
  editingId,
  onSave,
  branches,
  departments,
  designations,
  employees,
  industryType,
}: EmployeeFormModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [formData, setFormData] = useState<EmployeeFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<EmployeeValidationErrors>({});
  const toast = useToast();

  const dialogKey = editingId ? `edit-${editingId}` : "new";

  useEffect(() => {
    if (!open) return;

    if (editingId) {
      async function loadEmp() {
        const result = await getEmployeeByIdAction(editingId!);
        if (result.success && result.data) {
          setEditingName(`${result.data.firstName} ${result.data.lastName}`);
          setFormData(buildFormFromEmployee(result.data));
        }
      }
      loadEmp();
      setErrors({});
    } else {
      const existingEmpCodes = employees.map((e) => e.employeeCode || "").filter(Boolean);
      const existingAtdCodes = employees.map((e) => e.attendanceCode || "").filter(Boolean);
      const nextEmpCode = getNextEmployeeCode(existingEmpCodes);
      const nextAtdCode = getNextAttendanceCode(existingAtdCodes, "ATD-");

      setFormData({
        ...EMPTY_FORM,
        employeeCode: nextEmpCode,
        attendanceCode: nextAtdCode,
      });
      setEditingName("");
      setActiveTab(0);
      setErrors({});
    }
  }, [open, editingId, employees]);

  const validateCurrentTab = (tabIdx: number): boolean => {
    const tabErrors = validateEmployeeTab(formData, tabIdx);
    if (Object.keys(tabErrors).length > 0) {
      setErrors(tabErrors);
      const firstErrMsg = Object.values(tabErrors)[0];
      toast.error(firstErrMsg || `Please complete all required fields in ${TABS[tabIdx].label}`);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleTabClick = (targetIdx: number) => {
    if (targetIdx === activeTab) return;
    
    // Going backward is always permitted
    if (targetIdx < activeTab) {
      setErrors({});
      setActiveTab(targetIdx);
      return;
    }

    // If jumping forward, validate each intermediate tab
    for (let i = activeTab; i < targetIdx; i++) {
      const tErrors = validateEmployeeTab(formData, i);
      if (Object.keys(tErrors).length > 0) {
        setErrors(tErrors);
        setActiveTab(i);
        const firstErrMsg = Object.values(tErrors)[0];
        toast.error(firstErrMsg || `Please complete the required fields in ${TABS[i].label} before proceeding.`);
        return;
      }
    }

    setErrors({});
    setActiveTab(targetIdx);
  };

  const handleNext = () => {
    if (validateCurrentTab(activeTab)) {
      setActiveTab((prev) => prev + 1);
      setErrors({});
    }
  };

  const handleBack = () => {
    if (activeTab > 0) {
      setActiveTab((prev) => prev - 1);
      setErrors({});
    }
  };

  const handleSave = async () => {
    // Validate across all tabs
    const allErrors = validateEmployee(formData);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      // Auto-switch to the first tab that has an error
      for (let i = 0; i < TABS.length; i++) {
        const tErrors = validateEmployeeTab(formData, i);
        if (Object.keys(tErrors).length > 0) {
          setActiveTab(i);
          const firstMsg = Object.values(tErrors)[0];
          toast.error(firstMsg || `Please resolve errors in ${TABS[i].label}`);
          return;
        }
      }
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save employee";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate per-tab validation and completion status (E1 & E2)
  const tabStatus = TABS.map((_, idx) => {
    const tabErrs = validateEmployeeTab(formData, idx);
    const errCount = Object.keys(tabErrs).length;
    
    // Check if required fields for tab are filled
    let isFilled = false;
    if (idx === 0) {
      isFilled = !!(formData.firstName?.trim() && formData.lastName?.trim() && formData.attendanceCode?.trim() && formData.employeeCode?.trim() && formData.dateOfBirth);
    } else if (idx === 1) {
      isFilled = !!(formData.departmentId && formData.designationId && formData.branchId && formData.joiningDate);
    } else if (idx === 2) {
      isFilled = !!(formData.citizenshipNo?.trim() && formData.issuingDistrict?.trim() && formData.mobileNo?.trim());
    } else if (idx === 3) {
      isFilled = true; // Family info is optional
    } else if (idx === 4) {
      isFilled = !!(formData.bankName?.trim() && formData.bankAccountNumber?.trim());
    }

    const isComplete = errCount === 0 && isFilled;
    const hasError = errCount > 0 && isFilled; // only show error if user attempted to fill

    return { errCount, isComplete, hasError };
  });

  const completedCount = tabStatus.filter(t => t.isComplete).length;
  const progressPercent = Math.round((completedCount / TABS.length) * 100);

  return (
    <Dialog
      key={dialogKey}
      open={open}
      onClose={onClose}
      title={editingId ? "Edit Employee" : "Add New Employee"}
      description={
        editingId
          ? `Editing ${editingName}`
          : "Complete each section to add the employee record"
      }
      size="3xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-payroll-primary font-semibold tracking-wide">
            Section {activeTab + 1} of {TABS.length} · {TABS[activeTab].label}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            {activeTab > 0 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}

            {!editingId ? (
              activeTab < 4 ? (
                <Button type="button" onClick={handleNext}>
                  Next Section
                </Button>
              ) : (
                <DataSaveButton
                  onClick={handleSave}
                  isSaving={isSaving}
                  label="Add Employee"
                />
              )
            ) : (
              <div className="flex items-center gap-2">
                {activeTab < 4 && (
                  <Button type="button" variant="outline" onClick={handleNext}>
                    Next Section
                  </Button>
                )}
                <DataSaveButton
                  onClick={handleSave}
                  isSaving={isSaving}
                  label="Save Changes"
                />
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Section Completion Status Pill & Progress Bar (E2) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">Form Completion</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
              <span>{completedCount} of {TABS.length} sections complete</span>
              <span>({progressPercent}%)</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Tab Navigation with Error & Completion Badges (E1 & E2) */}
        <div className="flex gap-0 border-b border-payroll-light overflow-x-auto scrollbar-none">
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === idx;
            const status = tabStatus[idx];

            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleTabClick(idx)}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-all whitespace-nowrap cursor-pointer relative",
                  isActive
                    ? "border-payroll-primary text-payroll-primary font-semibold bg-emerald-50/40"
                    : "border-transparent text-gray-500 hover:text-payroll-navy hover:bg-gray-50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>

                {/* Persistent Error Badge (E1) */}
                {status.hasError && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 shadow-sm animate-pulse">
                    {status.errCount}
                  </span>
                )}

                {/* Section Complete Checkmark (E2) */}
                {!status.hasError && status.isComplete && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <EmployeeFormTabs
          tabIndex={activeTab}
          formData={formData}
          setFormData={setFormData}
          branches={branches}
          departments={departments}
          designations={designations}
          employees={employees}
          industryType={industryType}
          errors={errors}
        />
      </div>
    </Dialog>
  );
}
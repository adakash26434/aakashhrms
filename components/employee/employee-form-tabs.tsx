"use client";

import React, { useMemo, useEffect } from "react";
import {
  EmployeeFormData,
  EmployeeValidationErrors,
} from "@/lib/types/employee";
import { NepaliDatePicker } from "@/components/ui/nepali-date";
import { NumberInput } from "@/components/ui/number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { BankCombobox } from "@/components/ui/bank-combobox";
import { ShreniCombobox } from "@/components/ui/shreni-combobox";
import { DistrictCombobox } from "@/components/ui/district-combobox";
import { NepalAddressPicker } from "@/components/ui/nepal-address-picker";
import { useSidebar } from "@/lib/contexts/sidebar-context";
import {
  parseLocalDateParts,
  getNextEmployeeCode,
  getNextAttendanceCode,
} from "@/lib/engines/employee.engine";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Check,
  Link as LinkIcon,
  Calculator,
  Lock,
  Unlock,
  AlertCircle,
} from "lucide-react";
import type { ShreniLevelItem } from "@/lib/constants/industry-types";
import type { EmploymentType } from "@/lib/types/company-setup";
import type { GradePolicySettings } from "@/lib/types/system-control";
import {
  DEFAULT_GRADE_POLICY,
  calculateGradeRate,
  calculateTotalGradeAmount,
} from "@/lib/engines/grade-policy.engine";

const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

interface EmployeeFormTabsProps {
  tabIndex: number;
  formData: EmployeeFormData;
  setFormData: React.Dispatch<React.SetStateAction<EmployeeFormData>>;
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
  employmentTypes?: EmploymentType[];
  gradePolicy?: GradePolicySettings;
  errors?: EmployeeValidationErrors;
  setErrors?: React.Dispatch<React.SetStateAction<EmployeeValidationErrors>>;
  editingId?: string | null;
}

/**
 * Modern un-boxed form section with clean typography and hairline separator
 */
function FormSection({
  title,
  description,
  badge,
  children,
  isFirst = false,
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div className={cn("space-y-4", !isFirst && "pt-7 mt-7 border-t border-slate-100")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-slate-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
        {badge}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function EmployeeFormTabs({
  tabIndex,
  formData,
  setFormData,
  branches,
  departments,
  designations,
  employees,
  industryType,
  shreniLevels,
  employmentTypes,
  gradePolicy,
  errors,
  setErrors,
  editingId,
}: EmployeeFormTabsProps) {
  const { isPinned } = useSidebar();

  // Dynamic grid re-flow: 2 columns when sidebar is open (pinned), 3 columns when sidebar is closed (collapsed)
  const gridClass = isPinned
    ? "grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4.5"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4.5";

  const update = (
    field: keyof EmployeeFormData,
    val: string | number | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (errors && errors[field as keyof EmployeeValidationErrors] && setErrors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof EmployeeValidationErrors];
        return next;
      });
    }
  };

  // Grade increment calculations & policy
  const activeGradePolicy = useMemo(() => gradePolicy || DEFAULT_GRADE_POLICY, [gradePolicy]);

  const selectedLevel = useMemo(() => {
    if (!formData.shreni) return undefined;
    return (shreniLevels || []).find(
      (l) => l.code === formData.shreni || l.name === formData.shreni
    );
  }, [formData.shreni, shreniLevels]);

  const levelStartingScale = selectedLevel?.minSalary || 0;

  // The base salary used for grade increment calculation is the employee's actual basic salary,
  // defaulting to the Shreni's starting scale if not explicitly set.
  const effectiveBasicSalary = (formData.basicSalary && formData.basicSalary > 0)
    ? formData.basicSalary
    : levelStartingScale;

  const [isManualGradeOverride, setIsManualGradeOverride] = React.useState(() => {
    if (formData.gradeAmount > 0 && (!formData.gradeCount || formData.gradeCount === 0)) {
      return true;
    }
    return false;
  });

  const gradeRate = useMemo(() => {
    if (!effectiveBasicSalary || effectiveBasicSalary <= 0) return 0;
    return calculateGradeRate(effectiveBasicSalary, activeGradePolicy);
  }, [effectiveBasicSalary, activeGradePolicy]);

  const autoTotalGradeAmount = useMemo(() => {
    if (!effectiveBasicSalary || effectiveBasicSalary <= 0) return 0;
    return calculateTotalGradeAmount(
      effectiveBasicSalary,
      formData.gradeCount || 0,
      activeGradePolicy
    );
  }, [effectiveBasicSalary, formData.gradeCount, activeGradePolicy]);

  // Automatically sync formData.gradeAmount with the active policy whenever Auto-calc is active
  useEffect(() => {
    if (!isManualGradeOverride && effectiveBasicSalary > 0 && (formData.gradeCount ?? 0) >= 0) {
      if (Math.abs((formData.gradeAmount ?? 0) - autoTotalGradeAmount) > 0.001) {
        setFormData((prev) => ({
          ...prev,
          gradeAmount: autoTotalGradeAmount,
        }));
      }
    }
  }, [isManualGradeOverride, effectiveBasicSalary, autoTotalGradeAmount, formData.gradeAmount, setFormData]);

  const levelDisplayName = useMemo(() => {
    if (!formData.shreni) return null;
    if (!selectedLevel?.name) return formData.shreni;
    const cleanedName = selectedLevel.name
      .replace(new RegExp(`^${formData.shreni}\\s*[-–:]?\\s*`, "i"), "")
      .trim();
    return cleanedName ? `${formData.shreni} — ${cleanedName}` : formData.shreni;
  }, [formData.shreni, selectedLevel]);

  const policyMethodDisplay = useMemo(() => {
    switch (activeGradePolicy.calculationMethod) {
      case "STATUTORY_DAILY_RATE":
        return {
          badge: `Statutory Daily Rate (Basic / ${activeGradePolicy.daysInMonthForDailyRate || 30})`,
          formula:
            effectiveBasicSalary > 0
              ? `Basic NPR ${effectiveBasicSalary.toLocaleString()} ÷ ${activeGradePolicy.daysInMonthForDailyRate || 30} days`
              : "Basic ÷ 30 days",
        };
      case "PERCENTAGE_OF_BASIC":
        return {
          badge: `Percentage of Basic (${activeGradePolicy.fixedGradePercent || 3.33}%)`,
          formula:
            effectiveBasicSalary > 0
              ? `${activeGradePolicy.fixedGradePercent || 3.33}% of NPR ${effectiveBasicSalary.toLocaleString()}`
              : `${activeGradePolicy.fixedGradePercent || 3.33}% of Basic`,
        };
      case "FIXED_AMOUNT_PER_GRADE":
        return {
          badge: "Fixed Step Scale",
          formula: `NPR ${(activeGradePolicy.fixedAmountPerGrade || 0).toLocaleString()} per grade`,
        };
      case "MANUAL_INPUT":
        return {
          badge: "Manual Input",
          formula: "Specified manually",
        };
      case "DISABLED_NO_GRADES":
        return {
          badge: "No Grade Increments",
          formula: "Grades disabled",
        };
      default:
        return {
          badge: "Standard Policy",
          formula: "Basic ÷ 30 days",
        };
    }
  }, [activeGradePolicy, effectiveBasicSalary]);

  const handleShreniChange = (shreniVal: string) => {
    const newLvl = (shreniLevels || []).find(
      (l) => l.code === shreniVal || l.name === shreniVal
    );
    const newScale = newLvl?.minSalary || 0;
    const currentBasic = formData.basicSalary || 0;
    // If no custom basic salary set yet or matches previous starting scale, default to new level's starting scale
    const newBasic = (currentBasic === 0 || currentBasic === levelStartingScale)
      ? newScale
      : currentBasic;

    if (!isManualGradeOverride && newBasic > 0) {
      const newAmt = calculateTotalGradeAmount(
        newBasic,
        formData.gradeCount || 0,
        activeGradePolicy
      );
      setFormData((prev) => ({
        ...prev,
        shreni: shreniVal,
        basicSalary: newBasic,
        gradeAmount: newAmt,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        shreni: shreniVal,
        basicSalary: newBasic,
      }));
    }
  };

  const handleBasicSalaryChange = (newBasic: number) => {
    const validBasic = Math.max(0, newBasic || 0);
    if (!isManualGradeOverride && validBasic > 0) {
      const newAmt = calculateTotalGradeAmount(
        validBasic,
        formData.gradeCount || 0,
        activeGradePolicy
      );
      setFormData((prev) => ({
        ...prev,
        basicSalary: validBasic,
        gradeAmount: newAmt,
      }));
    } else {
      update("basicSalary", validBasic);
    }
  };

  const handleGradeCountChange = (count: number) => {
    const validCount = Math.max(0, Math.floor(count || 0));
    if (!isManualGradeOverride && effectiveBasicSalary > 0) {
      const newAmt = calculateTotalGradeAmount(
        effectiveBasicSalary,
        validCount,
        activeGradePolicy
      );
      setFormData((prev) => ({
        ...prev,
        gradeCount: validCount,
        gradeAmount: newAmt,
      }));
    } else {
      update("gradeCount", validCount);
    }
  };

  const handleToggleManualOverride = (override: boolean) => {
    setIsManualGradeOverride(override);
    if (!override && effectiveBasicSalary > 0) {
      const recalc = calculateTotalGradeAmount(
        effectiveBasicSalary,
        formData.gradeCount || 0,
        activeGradePolicy
      );
      update("gradeAmount", recalc);
    }
  };

  // Modern input styles: h-10, rounded-lg, subtle border matching reference form
  const inputClass =
    "h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-xs sm:text-sm text-slate-900 shadow-2xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-[#1e7e47] focus:outline-none focus:ring-1 focus:ring-[#1e7e47]";

  const selectClass =
    "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 shadow-2xs transition-colors hover:border-slate-400 focus:border-[#1e7e47] focus:outline-none focus:ring-1 focus:ring-[#1e7e47] cursor-pointer";

  const labelClass = (hasError: boolean) =>
    cn(
      "block text-[11px] font-semibold uppercase tracking-wider transition-colors mb-1.5",
      hasError ? "text-red-600 font-semibold" : "text-slate-600",
    );

  const fieldInputClass = (hasError: boolean) =>
    cn(
      inputClass,
      hasError &&
        "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-500",
    );

  const fieldSelectClass = (hasError: boolean) =>
    cn(
      selectClass,
      hasError &&
        "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-500",
    );

  // ==========================================
  // TAB 0: GENERAL INFORMATION
  // ==========================================
  if (tabIndex === 0) {
    const existingEmpCodes = employees
      .map((e) => e.employeeCode || "")
      .filter(Boolean);
    const existingAtdCodes = employees
      .map((e) => e.attendanceCode || "")
      .filter(Boolean);

    const handleAutoGenerateEmp = () => {
      const nextCode = getNextEmployeeCode(existingEmpCodes);
      update("employeeCode", nextCode);
    };

    const handleMatchEmpCode = () => {
      if (!formData.employeeCode) return;
      const digits = (formData.employeeCode || "")
        .replace(/^EMP-/i, "")
        .replace(/\D/g, "");
      if (digits) {
        update("attendanceCode", `ATD-${digits}`);
      } else {
        update("attendanceCode", formData.employeeCode);
      }
    };

    const handleAutoGenerateAtd = () => {
      const nextCode = getNextAttendanceCode(existingAtdCodes, "ATD-");
      update("attendanceCode", nextCode);
    };

    const empDigits = (formData.employeeCode || "")
      .replace(/^EMP-/i, "")
      .replace(/\D/g, "");

    const atdDigits = (formData.attendanceCode || "")
      .replace(/^ATD-/i, "")
      .replace(/\D/g, "");

    const handleEmpDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      update("employeeCode", digits ? `EMP-${digits}` : "");
    };

    const handleAtdDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      update("attendanceCode", digits ? `ATD-${digits}` : "");
    };

    const duplicateEmp = formData.employeeCode?.trim()
      ? employees.find(
          (e) =>
            (!editingId || e.id !== editingId) &&
            e.employeeCode?.toLowerCase() ===
              formData.employeeCode.trim().toLowerCase(),
        )
      : null;

    const duplicateAtd = formData.attendanceCode?.trim()
      ? employees.find(
          (e) =>
            (!editingId || e.id !== editingId) &&
            e.attendanceCode?.toLowerCase() ===
              formData.attendanceCode.trim().toLowerCase(),
        )
      : null;

    return (
      <div className="space-y-6 animate-[fadeIn_150ms_ease-out]">
        {/* Section 1: Identification */}
        <FormSection title="Identification" isFirst>
          <div className={gridClass}>
            {/* Employee Code */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClass(!!errors?.employeeCode)}>
                  Employee Code <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateEmp}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-payroll-primary hover:underline cursor-pointer"
                  title="Generate next sequential code"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Auto</span>
                </button>
              </div>
              <div
                className={cn(
                  "flex h-10 w-full rounded-lg border border-slate-200 bg-white shadow-2xs transition-colors overflow-hidden hover:border-slate-300 focus-within:border-[#1e7e47] focus-within:ring-1 focus-within:ring-[#1e7e47]",
                  (!!errors?.employeeCode || !!duplicateEmp) &&
                    "border-red-500 bg-red-50/20 focus-within:border-red-500 focus-within:ring-red-500",
                )}
              >
                <span className="flex items-center px-3 bg-slate-50 border-r border-slate-200 text-xs sm:text-sm font-mono font-semibold text-slate-500 select-none shrink-0">
                  EMP-
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={empDigits}
                  onChange={handleEmpDigitsChange}
                  className="h-full w-full bg-transparent px-3 text-xs sm:text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none"
                  placeholder="001"
                />
              </div>
              {duplicateEmp && (
                <span className="text-[11px] font-semibold text-amber-600">
                  ⚠️ In use
                </span>
              )}
              {errors?.employeeCode && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.employeeCode}
                </p>
              )}
            </div>

            {/* Attendance Code */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClass(!!errors?.attendanceCode)}>
                  Attendance Code <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleMatchEmpCode}
                    className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-500 hover:text-payroll-primary cursor-pointer"
                    title="Copy number from Employee Code"
                  >
                    <LinkIcon className="h-2.5 w-2.5" />
                    <span>Copy</span>
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleAutoGenerateAtd}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-payroll-primary hover:underline cursor-pointer"
                    title="Next Attendance Code"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    <span>Next</span>
                  </button>
                </div>
              </div>
              <div
                className={cn(
                  "flex h-10 w-full rounded-lg border border-slate-200 bg-white shadow-2xs transition-colors overflow-hidden hover:border-slate-300 focus-within:border-[#1e7e47] focus-within:ring-1 focus-within:ring-[#1e7e47]",
                  (!!errors?.attendanceCode || !!duplicateAtd) &&
                    "border-red-500 bg-red-50/20 focus-within:border-red-500 focus-within:ring-red-500",
                )}
              >
                <span className="flex items-center px-3 bg-slate-50 border-r border-slate-200 text-xs sm:text-sm font-mono font-semibold text-slate-500 select-none shrink-0">
                  ATD-
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={atdDigits}
                  onChange={handleAtdDigitsChange}
                  className="h-full w-full bg-transparent px-3 text-xs sm:text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none"
                  placeholder="001"
                />
              </div>
              {duplicateAtd && (
                <span className="text-[11px] font-semibold text-amber-600">
                  ⚠️ In use
                </span>
              )}
              {errors?.attendanceCode && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.attendanceCode}
                </p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Section 2: Name & Personal */}
        <FormSection title="Name & Personal">
          <div className={gridClass}>
            {/* Full Name */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.fullName)}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                className={fieldInputClass(!!errors?.fullName)}
                placeholder="e.g. Pratima Shrestha"
              />
              {errors?.fullName && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.dateOfBirth)}>
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <NepaliDatePicker
                value={parseLocalDateParts(formData.dateOfBirth)}
                onChange={(d) => update("dateOfBirth", formatLocalDate(d))}
                label=""
                className={
                  errors?.dateOfBirth ? "border-red-500 focus:ring-red-500" : ""
                }
              />
              {errors?.dateOfBirth && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.dateOfBirth}
                </p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <label className={labelClass(false)}>
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  update("gender", e.target.value as "Male" | "Female" | "Other")
                }
                className={selectClass}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Tax Status */}
            <div className="space-y-1">
              <label className={labelClass(false)}>
                Tax Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.taxStatus}
                onChange={(e) => update("taxStatus", e.target.value)}
                className={selectClass}
              >
                <option value="Normal Single">Single (1% SST)</option>
                <option value="Married">Married (Couple)</option>
                <option value="Widow">Widow / Widower</option>
              </select>
            </div>

            {/* Disability Exemption */}
            <div className="space-y-1">
              <label className={labelClass(false)}>
                Tax Exemption
              </label>
              <div className="h-10 flex items-center">
                <label
                  htmlFor="disabled-emp"
                  className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700 hover:text-slate-900"
                >
                  <input
                    type="checkbox"
                    id="disabled-emp"
                    checked={formData.isDisabled}
                    onChange={(e) => update("isDisabled", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#1e7e47] focus:ring-[#1e7e47] cursor-pointer"
                  />
                  <span>Physical Disability Tax Exemption</span>
                </label>
              </div>
            </div>
          </div>
        </FormSection>
      </div>
    );
  }

  // ==========================================
  // TAB 1: OFFICE INFORMATION
  // ==========================================
  if (tabIndex === 1) {
    return (
      <div className="space-y-6 animate-[fadeIn_150ms_ease-out]">
        {/* Section 1: Organizational Placement */}
        {/* Section 1: Organizational Placement */}
        <FormSection title="Organizational Placement" isFirst>
          <div className={gridClass}>
            {/* Department */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.departmentId)}>
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.departmentId}
                onChange={(e) => update("departmentId", e.target.value)}
                className={fieldSelectClass(!!errors?.departmentId)}
              >
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors?.departmentId && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.departmentId}
                </p>
              )}
            </div>

            {/* Designation */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.designationId)}>
                Designation <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.designationId}
                onChange={(e) => update("designationId", e.target.value)}
                className={fieldSelectClass(!!errors?.designationId)}
              >
                <option value="">-- Select Designation --</option>
                {designations
                  .filter(
                    (d) =>
                      !formData.departmentId ||
                      d.departmentId === formData.departmentId,
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              {errors?.designationId && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.designationId}
                </p>
              )}
            </div>

            {/* Branch */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.branchId)}>
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.branchId}
                onChange={(e) => update("branchId", e.target.value)}
                className={fieldSelectClass(!!errors?.branchId)}
              >
                <option value="">-- Select Branch --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {errors?.branchId && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.branchId}
                </p>
              )}
            </div>

            {/* Shreni / Level */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClass(!!errors?.shreni)}>
                  Shreni / Level <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  {shreniLevels && shreniLevels.length > 0
                    ? `${shreniLevels[0]?.code} – ${shreniLevels[shreniLevels.length - 1]?.code}`
                    : "S1–S15"}
                </span>
              </div>
              <ShreniCombobox
                value={formData.shreni}
                onChange={handleShreniChange}
                industryType={industryType}
                levels={shreniLevels}
                hasError={!!errors?.shreni}
                placeholder="Select Level (e.g. S1, S2, S3...)"
              />
              {errors?.shreni && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.shreni}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className={labelClass(false)}>
                Employment Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => update("category", e.target.value)}
                className={selectClass}
              >
                {employmentTypes && employmentTypes.length > 0 ? (
                  employmentTypes.map((et) => (
                    <option key={et.id || et.code} value={et.name}>
                      {et.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Permanent">Permanent</option>
                    <option value="Temporary">Temporary</option>
                    <option value="OutSource">OutSource</option>
                    <option value="Consultant">Consultant</option>
                    <option value="Trainee">Trainee</option>
                    <option value="Volunteer">Volunteer</option>
                    <option value="Contract">Contract</option>
                  </>
                )}
              </select>
            </div>

            {/* Supervisor Dropdown */}
            <div className="space-y-1">
              <label className={labelClass(false)}>
                Direct Supervisor
              </label>
              <select
                value={formData.supervisorId || ""}
                onChange={(e) => update("supervisorId", e.target.value)}
                className={selectClass}
              >
                <option value="">-- No Supervisor Assigned --</option>
                {(employees || [])
                  .filter(
                    (emp) =>
                      (!editingId || emp.id !== editingId) &&
                      (emp.isSupervisor || emp.id === formData.supervisorId),
                  )
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.employeeCode ? `(${emp.employeeCode})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </FormSection>

        {/* Section 2: Hierarchy & Authorization */}
        <FormSection title="Hierarchy & Authorization">
          <div className="flex items-center">
            <label
              htmlFor="isSupervisorCheckbox"
              className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              <input
                type="checkbox"
                id="isSupervisorCheckbox"
                checked={formData.isSupervisor}
                onChange={(e) => update("isSupervisor", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#1e7e47] focus:ring-[#1e7e47] cursor-pointer"
              />
              <span>Mark as Supervisor / Line Manager</span>
            </label>
          </div>
        </FormSection>

        {/* Section 3: Tenure, Status & Compensation */}
        <FormSection title="Tenure & Compensation">
          <div className={gridClass}>
            {/* Joining Date */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.joiningDate)}>
                Joining Date <span className="text-red-500">*</span>
              </label>
              <NepaliDatePicker
                value={parseLocalDateParts(formData.joiningDate)}
                onChange={(d) => update("joiningDate", formatLocalDate(d))}
                label=""
                className={
                  errors?.joiningDate ? "border-red-500 focus:ring-red-500" : ""
                }
              />
              {errors?.joiningDate && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.joiningDate}
                </p>
              )}
            </div>

            {/* Confirmation Date */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.confirmationDate)}>
                Confirmation Date
              </label>
              <NepaliDatePicker
                value={parseLocalDateParts(formData.confirmationDate)}
                onChange={(d) => update("confirmationDate", formatLocalDate(d))}
                label=""
                className={
                  errors?.confirmationDate
                    ? "border-red-500 focus:ring-red-500"
                    : ""
                }
              />
              {errors?.confirmationDate && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.confirmationDate}
                </p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className={labelClass(false)}>
                Employment Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  update("status", e.target.value as "Active" | "Inactive")
                }
                className={selectClass}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Basic Salary */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClass(false)}>
                  Basic Salary (NPR)
                </label>
                {levelStartingScale > 0 && formData.basicSalary === levelStartingScale && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                    Scale Default
                  </span>
                )}
                {levelStartingScale > 0 && formData.basicSalary !== undefined && formData.basicSalary !== 0 && formData.basicSalary !== levelStartingScale && (
                  <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/60">
                    Custom Base
                  </span>
                )}
              </div>
              <NumberInput
                min={0}
                value={formData.basicSalary ?? 0}
                onChange={handleBasicSalaryChange}
                className={fieldInputClass(false)}
                placeholder={levelStartingScale > 0 ? `Scale: ${levelStartingScale.toLocaleString()}` : "e.g. 35,000"}
              />
              <p className="text-[10px] text-slate-500">
                {levelStartingScale > 0
                  ? `Starting scale: NPR ${levelStartingScale.toLocaleString()}. Can be adjusted per employee contract.`
                  : "Enter employee monthly basic salary to auto-calculate 1 grade rate."}
              </p>
            </div>

            {/* Grade Count */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClass(!!errors?.gradeCount)}>
                  Grade Count <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] font-medium text-slate-500">
                  0 = Starting Scale
                </span>
              </div>
              <NumberInput
                min={0}
                max={50}
                step={1}
                value={formData.gradeCount ?? 0}
                onChange={handleGradeCountChange}
                className={fieldInputClass(!!errors?.gradeCount)}
                placeholder="e.g. 2"
              />
              {errors?.gradeCount && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.gradeCount}
                </p>
              )}
            </div>

            {/* Grade Amount */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClass(!!errors?.gradeAmount)}>
                  Grade Amount (NPR) <span className="text-red-500">*</span>
                </label>
                {!isManualGradeOverride ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                    <Lock className="h-2.5 w-2.5" />
                    Auto-calc
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                    <Unlock className="h-2.5 w-2.5" />
                    Manual
                  </span>
                )}
              </div>
              <NumberInput
                min={0}
                step="0.01"
                value={formData.gradeAmount}
                disabled={!isManualGradeOverride && effectiveBasicSalary > 0}
                onChange={(val) => update("gradeAmount", val)}
                className={cn(
                  fieldInputClass(!!errors?.gradeAmount),
                  !isManualGradeOverride && effectiveBasicSalary > 0 && "bg-slate-50 text-slate-700 cursor-not-allowed"
                )}
                placeholder="e.g. 1,500"
              />
              {errors?.gradeAmount && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.gradeAmount}
                </p>
              )}
            </div>
          </div>

          {/* Grade Increment & Base Pay Summary Card */}
          <div className="mt-5 rounded-2xl border border-emerald-900/10 bg-linear-to-b from-emerald-50/25 via-slate-50/40 to-white p-4 sm:p-5 shadow-xs transition-all">
            {/* Header with Title, Policy Pill & Manual Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200/70">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                  <Calculator className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 tracking-tight">
                  Grade Increment Breakdown
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-100/70 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                  {policyMethodDisplay.badge}
                </span>
              </div>

              {/* Styled Manual Override Toggle */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={isManualGradeOverride}
                  onChange={(e) => handleToggleManualOverride(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                />
                <span>Manual Override</span>
              </label>
            </div>

            {/* 3 Metric Blocks */}
            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Metric 1: Shreni Level & Scale */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Selected Level &amp; Scale
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-900 truncate" title={levelDisplayName || "No level selected"}>
                  {formData.shreni ? (
                    levelDisplayName
                  ) : (
                    <span className="text-slate-400 italic">No level selected</span>
                  )}
                </div>
                <div className="mt-1 text-[11px] font-mono text-slate-500">
                  {levelStartingScale > 0
                    ? `Starting Scale: NPR ${levelStartingScale.toLocaleString()}`
                    : "No starting scale configured"}
                </div>
              </div>

              {/* Metric 2: Per Grade Rate */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  1 Grade Rate
                </div>
                <div className="mt-1 text-xs font-semibold font-mono text-slate-900">
                  {gradeRate > 0 ? (
                    <>
                      <span>NPR {gradeRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-slate-400 font-normal"> / mo</span>
                    </>
                  ) : (
                    <span className="text-slate-400">NPR 0.00</span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {policyMethodDisplay.formula}
                </div>
              </div>

              {/* Metric 3: Total Monthly Base & Grade */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 shadow-2xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                  Total Monthly Base Pay
                </div>
                <div className="mt-1 text-sm font-bold font-mono text-emerald-950">
                  NPR {(effectiveBasicSalary + (formData.gradeAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="mt-1 text-[11px] text-emerald-800">
                  {isManualGradeOverride ? (
                    <span className="text-amber-700 font-medium">Custom Grade Amount Applied</span>
                  ) : (
                    <span>
                      NPR {effectiveBasicSalary.toLocaleString()} Basic + NPR {(formData.gradeAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Grade ({formData.gradeCount || 0} earned)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {effectiveBasicSalary === 0 && (
              <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/90 border border-amber-200 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Please select a Shreni level with a starting scale or specify an employee Basic Salary above to enable automatic Grade calculations.
                </span>
              </div>
            )}
          </div>
        </FormSection>
      </div>
    );
  }

  // ==========================================
  // TAB 2: PERSONAL INFORMATION & IDENTIFICATION
  // ==========================================
  if (tabIndex === 2) {
    const handleSyncDistricts = () => {
      const baseDistrict =
        formData.issuingDistrict ||
        formData.nidIssuingDistrict ||
        formData.passportIssuingDistrict ||
        formData.voterIdIssuingDistrict;
      if (!baseDistrict) return;
      setFormData((prev) => ({
        ...prev,
        issuingDistrict: baseDistrict,
        nidIssuingDistrict: baseDistrict,
        passportIssuingDistrict: baseDistrict,
        voterIdIssuingDistrict: baseDistrict,
      }));
    };

    const allDistrictsSame = Boolean(
      formData.issuingDistrict &&
        formData.issuingDistrict === formData.nidIssuingDistrict &&
        formData.issuingDistrict === formData.passportIssuingDistrict &&
        formData.issuingDistrict === formData.voterIdIssuingDistrict,
    );

    return (
      <div className="space-y-6 animate-[fadeIn_150ms_ease-out]">
        {/* Section 1: Statutory Identity Documents & Districts */}
        {/* Section 1: Statutory Identity Documents & Districts */}
        <FormSection
          title="National Identity & Statutory IDs"
          isFirst
          badge={
            <button
              type="button"
              onClick={handleSyncDistricts}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-payroll-primary hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
              title="Copy Citizenship district to all document district fields"
            >
              {allDistrictsSame ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span>
                {allDistrictsSame ? "Districts Matched" : "Sync District to All"}
              </span>
            </button>
          }
        >
          {/* Pair 2 related fields per row: Citizenship, NID, Passport, Voter ID, PAN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 max-w-3xl">
            {/* Pair 1: Citizenship */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.citizenshipNo)}>
                Citizenship Number <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.citizenshipNo}
                onChange={(e) => update("citizenshipNo", e.target.value)}
                className={fieldInputClass(!!errors?.citizenshipNo)}
                placeholder="e.g. 27-01-75-01234"
              />
              {errors?.citizenshipNo && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.citizenshipNo}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass(!!errors?.issuingDistrict)}>
                Citizenship Issuing District <span className="text-red-500">*</span>
              </label>
              <DistrictCombobox
                value={formData.issuingDistrict}
                onChange={(val) => update("issuingDistrict", val)}
                hasError={!!errors?.issuingDistrict}
                placeholder="Select District (e.g. Kathmandu...)"
              />
              {errors?.issuingDistrict && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.issuingDistrict}
                </p>
              )}
            </div>

            {/* Pair 2: National ID Card (NID) */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.nidNo)}>
                National ID Card (NID - 10 Digits)
              </label>
              <input
                value={formData.nidNo}
                onChange={(e) => update("nidNo", e.target.value)}
                className={fieldInputClass(!!errors?.nidNo)}
                placeholder="e.g. 123-456-7890"
              />
              {errors?.nidNo && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.nidNo}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass(!!errors?.nidIssuingDistrict)}>
                NID Issuing District
              </label>
              <DistrictCombobox
                value={formData.nidIssuingDistrict}
                onChange={(val) => update("nidIssuingDistrict", val)}
                hasError={!!errors?.nidIssuingDistrict}
                placeholder="Search NID District..."
              />
              {errors?.nidIssuingDistrict && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.nidIssuingDistrict}
                </p>
              )}
            </div>

            {/* Pair 3: Passport */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.passportNo)}>
                Passport Number
              </label>
              <input
                value={formData.passportNo}
                onChange={(e) =>
                  update("passportNo", e.target.value.toUpperCase())
                }
                className={fieldInputClass(!!errors?.passportNo)}
                placeholder="e.g. PA1234567"
              />
              {errors?.passportNo && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.passportNo}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass(!!errors?.passportIssuingDistrict)}>
                Passport Issuing District
              </label>
              <DistrictCombobox
                value={formData.passportIssuingDistrict}
                onChange={(val) => update("passportIssuingDistrict", val)}
                hasError={!!errors?.passportIssuingDistrict}
                placeholder="Search Passport District..."
              />
              {errors?.passportIssuingDistrict && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.passportIssuingDistrict}
                </p>
              )}
            </div>

            {/* Pair 4: Voter ID */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.votersId)}>
                Voter ID Number
              </label>
              <input
                value={formData.votersId}
                onChange={(e) => update("votersId", e.target.value)}
                className={fieldInputClass(!!errors?.votersId)}
                placeholder="e.g. 12345678"
              />
              {errors?.votersId && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.votersId}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass(!!errors?.voterIdIssuingDistrict)}>
                Voter ID Issuing District
              </label>
              <DistrictCombobox
                value={formData.voterIdIssuingDistrict}
                onChange={(val) => update("voterIdIssuingDistrict", val)}
                hasError={!!errors?.voterIdIssuingDistrict}
                placeholder="Search Voter District..."
              />
              {errors?.voterIdIssuingDistrict && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.voterIdIssuingDistrict}
                </p>
              )}
            </div>

            {/* Pair 5: PAN Number */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.panNumber)}>
                PAN (Permanent Account Number)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={formData.panNumber || ""}
                onChange={(e) =>
                  update("panNumber", e.target.value.replace(/\D/g, ""))
                }
                className={cn(fieldInputClass(!!errors?.panNumber), "font-mono")}
                placeholder="e.g. 123456789"
              />
              {errors?.panNumber && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.panNumber}
                </p>
              )}
            </div>

            {/* Empty column placeholder to preserve balanced 2-column layout */}
            <div className="hidden sm:block" />
          </div>
        </FormSection>

        {/* Section 2: Contact Information */}
        <FormSection title="Contact & Email">
          <div className="space-y-4">
            {/* Row 1: Email Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 max-w-3xl">
              {/* Company Email */}
              <div className="space-y-1">
                <label
                  className={labelClass(
                    !!errors?.companyEmail || !!errors?.email,
                  )}
                >
                  Company Official Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.companyEmail || formData.email}
                  onChange={(e) => {
                    update("companyEmail", e.target.value);
                    update("email", e.target.value);
                  }}
                  className={fieldInputClass(
                    !!errors?.companyEmail || !!errors?.email,
                  )}
                  placeholder="name@company.com"
                />
                {(errors?.companyEmail || errors?.email) && (
                  <p className="text-[11px] font-medium text-red-500">
                    {errors?.companyEmail || errors?.email}
                  </p>
                )}
              </div>

              {/* Personal Email */}
              <div className="space-y-1">
                <label className={labelClass(!!errors?.personalEmail)}>
                  Personal Email (Backup)
                </label>
                <input
                  type="email"
                  value={formData.personalEmail || ""}
                  onChange={(e) => update("personalEmail", e.target.value)}
                  className={fieldInputClass(!!errors?.personalEmail)}
                  placeholder="personal@gmail.com"
                />
                {errors?.personalEmail && (
                  <p className="text-[11px] font-medium text-red-500">
                    {errors.personalEmail}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Phone Number Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 max-w-3xl">
              {/* Mobile Number */}
              <div className="space-y-1">
                <label className={labelClass(!!errors?.mobileNo)}>
                  Mobile Number (Nepal +977) <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  value={formData.mobileNo}
                  onChange={(val) => update("mobileNo", val)}
                  hasError={!!errors?.mobileNo}
                  placeholder="9841123456"
                />
                {errors?.mobileNo && (
                  <p className="text-[11px] font-medium text-red-500">
                    {errors.mobileNo}
                  </p>
                )}
              </div>

              {/* Home Phone */}
              <div className="space-y-1">
                <label className={labelClass(!!errors?.phoneHome)}>
                  Phone (Landline / Home)
                </label>
                <PhoneInput
                  value={formData.phoneHome || ""}
                  onChange={(val) => update("phoneHome", val)}
                  hasError={!!errors?.phoneHome}
                  placeholder="015551234"
                />
                {errors?.phoneHome && (
                  <p className="text-[11px] font-medium text-red-500">
                    {errors.phoneHome}
                  </p>
                )}
              </div>
            </div>
          </div>
        </FormSection>

        {/* Section 3: Structured Nepal Addresses */}
        <FormSection title="Residential Addresses">
          <NepalAddressPicker
            permanentAddress={
              formData.permanentAddress || formData.address1 || ""
            }
            temporaryAddress={
              formData.temporaryAddress || formData.address2 || ""
            }
            onChangePermanent={(val) => {
              update("permanentAddress", val);
              update("address1", val);
            }}
            onChangeTemporary={(val) => {
              update("temporaryAddress", val);
              update("address2", val);
            }}
            errors={errors}
          />
        </FormSection>
      </div>
    );
  }

  // ==========================================
  // TAB 3: FAMILY INFORMATION
  // ==========================================
  if (tabIndex === 3) {
    const isMarried = formData.taxStatus === "Married";

    return (
      <div className="space-y-6 animate-[fadeIn_150ms_ease-out]">
        <FormSection title="Family Information" isFirst>
          <div className={gridClass}>
            {/* Father's Name */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.fatherName)}>
                Father&apos;s Full Name <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.fatherName}
                onChange={(e) => update("fatherName", e.target.value)}
                className={fieldInputClass(!!errors?.fatherName)}
                placeholder="e.g. Krishna Prasad Shrestha"
              />
              {errors?.fatherName && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.fatherName}
                </p>
              )}
            </div>

            {/* Mother's Name */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.motherName)}>
                Mother&apos;s Full Name <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.motherName}
                onChange={(e) => update("motherName", e.target.value)}
                className={fieldInputClass(!!errors?.motherName)}
                placeholder="e.g. Shanti Shrestha"
              />
              {errors?.motherName && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.motherName}
                </p>
              )}
            </div>

            {/* Grandfather's Name */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.grandfatherName)}>
                Grandfather&apos;s Full Name <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.grandfatherName}
                onChange={(e) => update("grandfatherName", e.target.value)}
                className={fieldInputClass(!!errors?.grandfatherName)}
                placeholder="e.g. Gopal Prasad Shrestha"
              />
              {errors?.grandfatherName && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.grandfatherName}
                </p>
              )}
            </div>

            {/* Spouse's Name */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.spouseName)}>
                Spouse&apos;s Full Name{" "}
                {isMarried ? (
                  <span className="text-red-500">* (Required for Married)</span>
                ) : (
                  <span className="text-gray-400 font-normal">
                    (Optional if single)
                  </span>
                )}
              </label>
              <input
                value={formData.spouseName}
                onChange={(e) => update("spouseName", e.target.value)}
                className={fieldInputClass(!!errors?.spouseName)}
                placeholder="e.g. Rajendra Shrestha"
              />
              {errors?.spouseName && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.spouseName}
                </p>
              )}
            </div>
          </div>
        </FormSection>
      </div>
    );
  }

  // ==========================================
  // TAB 4: BANK & TERMINATION
  // ==========================================
  if (tabIndex === 4) {
    const isTerminated = formData.status === "Inactive";

    return (
      <div className="space-y-6 animate-[fadeIn_150ms_ease-out]">
        {/* Section 1: Bank Account Details */}
        <FormSection title="Bank Account Details" isFirst>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
            {/* Bank Name */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.bankName)}>
                Bank Name <span className="text-red-500">*</span>
              </label>
              <BankCombobox
                value={formData.bankName}
                onChange={(val) => update("bankName", val)}
                hasError={!!errors?.bankName}
                placeholder="Select Bank..."
              />
              {errors?.bankName && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.bankName}
                </p>
              )}
            </div>

            {/* Bank Branch */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.bankBranch)}>
                Bank Branch <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.bankBranch}
                onChange={(e) => update("bankBranch", e.target.value)}
                className={fieldInputClass(!!errors?.bankBranch)}
                placeholder="e.g. Patan Branch"
              />
              {errors?.bankBranch && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.bankBranch}
                </p>
              )}
            </div>

            {/* Bank Account Number */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.bankAccountNumber)}>
                Bank Account Number <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.bankAccountNumber}
                onChange={(e) => update("bankAccountNumber", e.target.value)}
                className={cn(fieldInputClass(!!errors?.bankAccountNumber), "font-mono")}
                placeholder="e.g. 012345678901"
              />
              {errors?.bankAccountNumber && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.bankAccountNumber}
                </p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Section 2: Termination / Separation Information */}
        <FormSection
          title="Separation & Exit (Optional)"
          badge={
            isTerminated && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-800">
                Marked Inactive / Terminated
              </span>
            )
          }
        >
          <div className={gridClass}>
            {/* Informed Date */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.informedDate)}>
                Informed / Notice Date
              </label>
              <NepaliDatePicker
                value={parseLocalDateParts(formData.informedDate)}
                onChange={(d) => update("informedDate", formatLocalDate(d))}
                label=""
                className={
                  errors?.informedDate
                    ? "border-red-500 focus:ring-red-500"
                    : ""
                }
              />
              {errors?.informedDate && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.informedDate}
                </p>
              )}
            </div>

            {/* Termination Date */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.terminationDate)}>
                Retirement / Last Working Date{" "}
                {isTerminated && <span className="text-red-500">*</span>}
              </label>
              <NepaliDatePicker
                value={parseLocalDateParts(formData.terminationDate)}
                onChange={(d) => update("terminationDate", formatLocalDate(d))}
                label=""
                className={
                  errors?.terminationDate
                    ? "border-red-500 focus:ring-red-500"
                    : ""
                }
              />
              {errors?.terminationDate && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.terminationDate}
                </p>
              )}
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.terminationType)}>
                Separation Type{" "}
                {isTerminated && <span className="text-red-500">*</span>}
              </label>
              <select
                value={formData.terminationType}
                onChange={(e) => update("terminationType", e.target.value)}
                className={fieldSelectClass(!!errors?.terminationType)}
              >
                <option value="">-- Select Type --</option>
                <option value="Retirement">Retirement</option>
                <option value="Resignation">Resignation</option>
                <option value="Termination">Termination</option>
                <option value="Contract End">Contract End</option>
              </select>
              {errors?.terminationType && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.terminationType}
                </p>
              )}
            </div>

            {/* Plan */}
            <div className="space-y-1">
              <label className={labelClass(false)}>
                Settlement Plan
              </label>
              <select
                value={formData.terminationPlan}
                onChange={(e) => update("terminationPlan", e.target.value)}
                className={selectClass}
              >
                <option value="">-- Select Plan --</option>
                <option value="Upadan">Upadan</option>
                <option value="Gratuity">Gratuity</option>
                <option value="Pension">Pension</option>
                <option value="None">None</option>
              </select>
            </div>

            {/* Reason */}
            <div className="space-y-1 col-span-full">
              <label className={labelClass(!!errors?.terminationReason)}>
                Separation Reason{" "}
                {isTerminated && <span className="text-red-500">*</span>}
              </label>
              <input
                value={formData.terminationReason}
                onChange={(e) => update("terminationReason", e.target.value)}
                className={fieldInputClass(!!errors?.terminationReason)}
                placeholder="e.g. Mandatory age retirement / Career transition"
              />
              {errors?.terminationReason && (
                <p className="text-[11px] font-medium text-red-500">
                  {errors.terminationReason}
                </p>
              )}
            </div>

            {/* Remarks */}
            <div className="space-y-1 col-span-full">
              <label className={labelClass(false)}>
                Clearance Remarks
              </label>
              <textarea
                value={formData.terminationRemarks}
                onChange={(e) => update("terminationRemarks", e.target.value)}
                className={cn(inputClass, "h-20 py-2.5 resize-none")}
                placeholder="Handover completed and clearance verified..."
              />
            </div>
          </div>
        </FormSection>
      </div>
    );
  }

  return null;
}

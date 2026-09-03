"use client";

import React, { useMemo } from "react";
import { EmployeeFormData, EmployeeValidationErrors } from "@/lib/types/employee";
import { NepaliDatePicker } from "@/components/ui/nepali-date";
import { RadioGroup } from "@/components/ui/radio-group";
import { NumberInput } from "@/components/ui/number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { BankCombobox } from "@/components/ui/bank-combobox";
import { ShreniCombobox } from "@/components/ui/shreni-combobox";
import { DistrictCombobox } from "@/components/ui/district-combobox";
import { NepalAddressPicker } from "@/components/ui/nepal-address-picker";
import { getAllDistricts } from "@/lib/constants/nepal-locations";
import {
  parseLocalDateParts,
  getNextEmployeeCode,
  getNextAttendanceCode,
} from "@/lib/engines/employee.engine";
import { cn } from "@/lib/utils";
import { Sparkles, Check, Info, Link as LinkIcon, RefreshCw } from "lucide-react";

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
  employees: { id: string; name: string; employeeCode?: string; attendanceCode?: string }[];
  industryType?: string;
  errors?: EmployeeValidationErrors;
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
  errors,
}: EmployeeFormTabsProps) {
  const update = (field: keyof EmployeeFormData, val: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const allDistricts = useMemo(() => getAllDistricts(), []);

  const inputClass =
    "w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]";

  const labelClass = (hasError: boolean) =>
    cn("text-xs font-medium transition-colors", hasError ? "text-red-500 font-semibold" : "text-gray-600");

  const fieldInputClass = (hasError: boolean) =>
    cn(inputClass, hasError && "border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/20");

  // TAB 0: GENERAL INFORMATION
  if (tabIndex === 0) {
    const existingEmpCodes = employees.map((e) => e.employeeCode || "").filter(Boolean);
    const existingAtdCodes = employees.map((e) => e.attendanceCode || "").filter(Boolean);

    const handleAutoGenerateEmp = () => {
      const nextCode = getNextEmployeeCode(existingEmpCodes);
      update("employeeCode", nextCode);
    };

    const handleEmpCodeChange = (val: string) => {
      update("employeeCode", val);
    };

    const handleMatchEmpCode = () => {
      if (!formData.employeeCode) return;
      update("attendanceCode", formData.employeeCode);
    };

    const handleAutoGenerateAtd = () => {
      const nextCode = getNextAttendanceCode(existingAtdCodes);
      update("attendanceCode", nextCode);
    };

    // Duplicate detection
    const duplicateEmp = formData.employeeCode?.trim()
      ? employees.find(
          (e) => e.employeeCode?.toLowerCase() === formData.employeeCode.trim().toLowerCase()
        )
      : null;

    const duplicateAtd = formData.attendanceCode?.trim()
      ? employees.find(
          (e) => e.attendanceCode?.toLowerCase() === formData.attendanceCode.trim().toLowerCase()
        )
      : null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 animate-[fadeIn_150ms_ease-out]">
        {/* Employee Code (Primary) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className={labelClass(!!errors?.employeeCode)}>Employee Code *</label>
            <button
              type="button"
              onClick={handleAutoGenerateEmp}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-payroll-primary hover:text-payroll-navy hover:underline transition-all cursor-pointer"
              title="Calculate and auto-fill next sequential Employee Code"
            >
              <Sparkles className="h-3 w-3" />
              <span>Auto-Generate</span>
            </button>
          </div>
          <div className="relative">
            <input
              value={formData.employeeCode}
              onChange={(e) => handleEmpCodeChange(e.target.value)}
              className={fieldInputClass(!!errors?.employeeCode || !!duplicateEmp)}
              placeholder="e.g. EMP-001"
            />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400">System & payroll identifier</span>
            {duplicateEmp && (
              <span className="font-medium text-amber-600">
                ⚠️ Already in use ({duplicateEmp.name})
              </span>
            )}
          </div>
          {errors?.employeeCode && (
            <p className="text-[11px] font-medium text-red-500">{errors.employeeCode}</p>
          )}
        </div>

        {/* Attendance Code */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className={labelClass(!!errors?.attendanceCode)}>Attendance Code *</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMatchEmpCode}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-payroll-primary transition-all cursor-pointer"
                title="Set Attendance Code equal to Employee Code"
              >
                <LinkIcon className="h-3 w-3" />
                <span>Same as Emp Code</span>
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleAutoGenerateAtd}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-payroll-primary hover:text-payroll-navy hover:underline transition-all cursor-pointer"
                title="Auto-generate next attendance code"
              >
                <Sparkles className="h-3 w-3" />
                <span>Next Code</span>
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              value={formData.attendanceCode}
              onChange={(e) => update("attendanceCode", e.target.value)}
              className={fieldInputClass(!!errors?.attendanceCode || !!duplicateAtd)}
              placeholder="e.g. ATD-001 or 101"
            />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Biometric machine & device ID</span>
            {duplicateAtd && (
              <span className="font-medium text-amber-600">
                ⚠️ In use ({duplicateAtd.name})
              </span>
            )}
          </div>
          {errors?.attendanceCode && (
            <p className="text-[11px] font-medium text-red-500">{errors.attendanceCode}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.firstName)}>First Name *</label>
          <input
            value={formData.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            className={fieldInputClass(!!errors?.firstName)}
            placeholder="e.g. Pratima"
          />
          {errors?.firstName && (
            <p className="text-[11px] font-medium text-red-500">{errors.firstName}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.lastName)}>Last Name *</label>
          <input
            value={formData.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            className={fieldInputClass(!!errors?.lastName)}
            placeholder="e.g. Shrestha"
          />
          {errors?.lastName && (
            <p className="text-[11px] font-medium text-red-500">{errors.lastName}</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600">Gender</label>
          <RadioGroup
            name="gender"
            value={formData.gender}
            onChange={(v) => update("gender", v)}
            options={[
              { label: "Male", value: "Male" },
              { label: "Female", value: "Female" },
              { label: "Other", value: "Other" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.dateOfBirth)}>Date of Birth * (Minimum 18 Years)</label>
          <NepaliDatePicker
            value={parseLocalDateParts(formData.dateOfBirth)}
            onChange={(d) => update("dateOfBirth", formatLocalDate(d))}
            label=""
            className={errors?.dateOfBirth ? "border-red-500 focus:border-red-500" : ""}
          />
          {errors?.dateOfBirth && (
            <p className="text-[11px] font-medium text-red-500">{errors.dateOfBirth}</p>
          )}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-gray-600">Tax Status</label>
          <select
            value={formData.taxStatus}
            onChange={(e) => update("taxStatus", e.target.value)}
            className={inputClass}
          >
            <option value="Normal Single">Normal / Single</option>
            <option value="Married">Married (Requires Spouse Details)</option>
            <option value="Widow">Widow / Widower</option>
          </select>
        </div>
        <div className="flex items-center gap-3 pt-4 md:col-span-2">
          <input
            type="checkbox"
            id="disabled-emp"
            checked={formData.isDisabled}
            onChange={(e) => update("isDisabled", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-payroll-primary focus:ring-payroll-primary"
          />
          <label htmlFor="disabled-emp" className="text-sm text-gray-600 cursor-pointer select-none">
            Check if disabled employee (Eligible for special tax exemptions)
          </label>
        </div>
      </div>
    );
  }

  // TAB 1: OFFICE INFORMATION
  if (tabIndex === 1) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 animate-[fadeIn_150ms_ease-out]">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Category</label>
          <select
            value={formData.category}
            onChange={(e) => update("category", e.target.value)}
            className={inputClass}
          >
            <option value="Permanent">Permanent</option>
            <option value="Temporary">Temporary</option>
            <option value="OutSource">OutSource</option>
            <option value="Consultant">Consultant</option>
            <option value="Trainee">Trainee</option>
            <option value="Volunteer">Volunteer</option>
            <option value="Contract">Contract</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.shreni)}>Shreni (श्रेणी / Class / Level) *</label>
          <ShreniCombobox
            value={formData.shreni}
            onChange={(val) => update("shreni", val)}
            industryType={industryType}
            hasError={!!errors?.shreni}
            placeholder="Select or type Shreni / Level (e.g. Level 6, अधिकृत, Shreni 2)..."
          />
          {errors?.shreni && (
            <p className="text-[11px] font-medium text-red-500">{errors.shreni}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.departmentId)}>Department *</label>
          <select
            value={formData.departmentId}
            onChange={(e) => update("departmentId", e.target.value)}
            className={fieldInputClass(!!errors?.departmentId)}
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {errors?.departmentId && (
            <p className="text-[11px] font-medium text-red-500">{errors.departmentId}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.designationId)}>Designation *</label>
          <select
            value={formData.designationId}
            onChange={(e) => update("designationId", e.target.value)}
            className={fieldInputClass(!!errors?.designationId)}
          >
            <option value="">Select designation</option>
            {designations
              .filter((d) => !formData.departmentId || d.departmentId === formData.departmentId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
          {errors?.designationId && (
            <p className="text-[11px] font-medium text-red-500">{errors.designationId}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.branchId)}>Branch *</label>
          <select
            value={formData.branchId}
            onChange={(e) => update("branchId", e.target.value)}
            className={fieldInputClass(!!errors?.branchId)}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {errors?.branchId && (
            <p className="text-[11px] font-medium text-red-500">{errors.branchId}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Supervisor</label>
          <select
            value={formData.supervisorId || ""}
            onChange={(e) => update("supervisorId", e.target.value)}
            className="h-9 w-full rounded-lg border border-payroll-light bg-white px-3 text-sm text-payroll-navy focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
          >
            <option value="">-- No Supervisor --</option>
            {(employees || []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelClass(!!errors?.joiningDate)}>Joining Date *</label>
          <NepaliDatePicker
            value={parseLocalDateParts(formData.joiningDate)}
            onChange={(d) => update("joiningDate", formatLocalDate(d))}
            label=""
            className={errors?.joiningDate ? "border-red-500 focus:border-red-500" : ""}
          />
          {errors?.joiningDate && (
            <p className="text-[11px] font-medium text-red-500">{errors.joiningDate}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.confirmationDate)}>Confirmation Date</label>
          <NepaliDatePicker
            value={parseLocalDateParts(formData.confirmationDate)}
            onChange={(d) => update("confirmationDate", formatLocalDate(d))}
            label=""
            className={errors?.confirmationDate ? "border-red-500 focus:border-red-500" : ""}
          />
          {errors?.confirmationDate && (
            <p className="text-[11px] font-medium text-red-500">{errors.confirmationDate}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.retirementDateProjected)}>Retirement Date (Projected)</label>
          <NepaliDatePicker
            value={parseLocalDateParts(formData.retirementDateProjected)}
            onChange={(d) => update("retirementDateProjected", formatLocalDate(d))}
            label=""
            className={errors?.retirementDateProjected ? "border-red-500 focus:border-red-500" : ""}
          />
          {errors?.retirementDateProjected && (
            <p className="text-[11px] font-medium text-red-500">{errors.retirementDateProjected}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Status</label>
          <select
            value={formData.status}
            onChange={(e) => update("status", e.target.value)}
            className={inputClass}
          >
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.salaryGrade)}>Salary Grade *</label>
          <select
            value={formData.salaryGrade}
            onChange={(e) => update("salaryGrade", e.target.value)}
            className={fieldInputClass(!!errors?.salaryGrade)}
          >
            <option value="">Select grade</option>
            <option value="G0">Grade 0 (Starting / Base Step)</option>
            <option value="G1">Grade 1 (1 Year Increment)</option>
            <option value="G2">Grade 2 (2 Years Increment)</option>
            <option value="G3">Grade 3 (3 Years Increment)</option>
            <option value="G4">Grade 4 (4 Years Increment)</option>
            <option value="G5">Grade 5 (5 Years Increment)</option>
            <option value="G6">Grade 6 (6 Years Increment)</option>
            <option value="G7">Grade 7 (7 Years Increment)</option>
            <option value="G8">Grade 8 (8 Years Increment)</option>
            <option value="G9">Grade 9 (9 Years Increment)</option>
            <option value="G10">Grade 10 (10 Years Increment)</option>
            <option value="G11">Grade 11 (11 Years Increment)</option>
            <option value="G12">Grade 12 (12 Years Increment)</option>
            <option value="G13">Grade 13 (13 Years Increment)</option>
            <option value="G14">Grade 14 (14 Years Increment)</option>
            <option value="G15">Grade 15 (15 Years Maximum)</option>
            {formData.salaryGrade && !Array.from({ length: 16 }, (_, i) => `G${i}`).includes(formData.salaryGrade) && (
              <option value={formData.salaryGrade}>{formData.salaryGrade}</option>
            )}
          </select>
          {errors?.salaryGrade && (
            <p className="text-[11px] font-medium text-red-500">{errors.salaryGrade}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={labelClass(!!errors?.gradeAmount)}>Grade Amount (NPR) *</label>
          <NumberInput
            min={0}
            value={formData.gradeAmount}
            onChange={(val) => update("gradeAmount", val)}
            className={fieldInputClass(!!errors?.gradeAmount)}
            placeholder="e.g. 1,500"
          />
          {errors?.gradeAmount && (
            <p className="text-[11px] font-medium text-red-500">{errors.gradeAmount}</p>
          )}
        </div>
      </div>
    );
  }

  // TAB 2: PERSONAL INFORMATION
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
        formData.issuingDistrict === formData.voterIdIssuingDistrict
    );

    return (
      <div className="space-y-6 animate-[fadeIn_150ms_ease-out]">
        {/* Document & Issuing District Section */}
        <div className="rounded-xl border border-payroll-light/80 bg-payroll-cream/60 p-4 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-payroll-light">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
                Identity Documents & Issuing Districts
              </h4>
              <p className="text-[11px] text-gray-500">
                Specify NID (10 digits), Citizenship (with dashes/slashes), Passport, and Voter ID numbers with issuing districts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncDistricts}
              className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-primary bg-white px-3 py-1.5 text-xs font-semibold text-payroll-primary hover:bg-payroll-primary hover:text-white transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Copy main district to all document district fields"
            >
              {allDistrictsSame ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{allDistrictsSame ? "All Districts Matched" : "Copy District to All"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Citizenship */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.citizenshipNo)}>Citizenship Number *</label>
              <input
                value={formData.citizenshipNo}
                onChange={(e) => update("citizenshipNo", e.target.value)}
                className={fieldInputClass(!!errors?.citizenshipNo)}
                placeholder="e.g. 27-01-75-01234"
              />
              {errors?.citizenshipNo && (
                <p className="text-[11px] font-medium text-red-500">{errors.citizenshipNo}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelClass(!!errors?.issuingDistrict)}>Citizenship Issuing District *</label>
              <DistrictCombobox
                value={formData.issuingDistrict}
                onChange={(val) => update("issuingDistrict", val)}
                hasError={!!errors?.issuingDistrict}
                placeholder="Search Citizenship District (e.g. Kathmandu, Kaski...)"
              />
              {errors?.issuingDistrict && (
                <p className="text-[11px] font-medium text-red-500">{errors.issuingDistrict}</p>
              )}
            </div>

            {/* NID */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.nidNo)}>NID (National Identity Card No - 10 Digits)</label>
              <input
                value={formData.nidNo}
                onChange={(e) => update("nidNo", e.target.value)}
                className={fieldInputClass(!!errors?.nidNo)}
                placeholder="e.g. 123-456-7890 or 1234567890"
              />
              {errors?.nidNo && (
                <p className="text-[11px] font-medium text-red-500">{errors.nidNo}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelClass(!!errors?.nidIssuingDistrict)}>NID Issuing District</label>
              <DistrictCombobox
                value={formData.nidIssuingDistrict}
                onChange={(val) => update("nidIssuingDistrict", val)}
                hasError={!!errors?.nidIssuingDistrict}
                placeholder="Search NID District..."
              />
              {errors?.nidIssuingDistrict && (
                <p className="text-[11px] font-medium text-red-500">{errors.nidIssuingDistrict}</p>
              )}
            </div>

            {/* Passport */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.passportNo)}>Passport Number</label>
              <input
                value={formData.passportNo}
                onChange={(e) => update("passportNo", e.target.value.toUpperCase())}
                className={fieldInputClass(!!errors?.passportNo)}
                placeholder="e.g. PA1234567"
              />
              {errors?.passportNo && (
                <p className="text-[11px] font-medium text-red-500">{errors.passportNo}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelClass(!!errors?.passportIssuingDistrict)}>Passport Issuing District</label>
              <DistrictCombobox
                value={formData.passportIssuingDistrict}
                onChange={(val) => update("passportIssuingDistrict", val)}
                hasError={!!errors?.passportIssuingDistrict}
                placeholder="Search Passport District..."
              />
              {errors?.passportIssuingDistrict && (
                <p className="text-[11px] font-medium text-red-500">{errors.passportIssuingDistrict}</p>
              )}
            </div>

            {/* Voter ID */}
            <div className="space-y-1">
              <label className={labelClass(!!errors?.votersId)}>Voter ID</label>
              <input
                value={formData.votersId}
                onChange={(e) => update("votersId", e.target.value)}
                className={fieldInputClass(!!errors?.votersId)}
                placeholder="e.g. 12345678"
              />
              {errors?.votersId && (
                <p className="text-[11px] font-medium text-red-500">{errors.votersId}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelClass(!!errors?.voterIdIssuingDistrict)}>Voter ID Issuing District</label>
              <DistrictCombobox
                value={formData.voterIdIssuingDistrict}
                onChange={(val) => update("voterIdIssuingDistrict", val)}
                hasError={!!errors?.voterIdIssuingDistrict}
                placeholder="Search Voter ID District..."
              />
              {errors?.voterIdIssuingDistrict && (
                <p className="text-[11px] font-medium text-red-500">{errors.voterIdIssuingDistrict}</p>
              )}
            </div>

            {/* PAN Number */}
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass(!!errors?.panNumber)}>
                PAN Number (Permanent Account Number - 9 digits)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={formData.panNumber || ""}
                onChange={(e) => update("panNumber", e.target.value.replace(/\D/g, ""))}
                className={fieldInputClass(!!errors?.panNumber)}
                placeholder="e.g. 123456789"
              />
              {errors?.panNumber && (
                <p className="text-[11px] font-medium text-red-500">{errors.panNumber}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact & Email Section */}
        <div className="rounded-xl border border-payroll-light/80 bg-white p-4 space-y-4 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy pb-2 border-b border-payroll-light">
            Contact & Email Addresses
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-1">
              <label className={labelClass(!!errors?.companyEmail || !!errors?.email)}>Company Email *</label>
              <input
                value={formData.companyEmail || formData.email}
                onChange={(e) => {
                  update("companyEmail", e.target.value);
                  update("email", e.target.value);
                }}
                className={fieldInputClass(!!errors?.companyEmail || !!errors?.email)}
                placeholder="e.g. name@company.com"
              />
              {(errors?.companyEmail || errors?.email) && (
                <p className="text-[11px] font-medium text-red-500">{errors?.companyEmail || errors?.email}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass(!!errors?.personalEmail)}>Personal Email (Optional)</label>
              <input
                value={formData.personalEmail || ""}
                onChange={(e) => update("personalEmail", e.target.value)}
                className={fieldInputClass(!!errors?.personalEmail)}
                placeholder="e.g. personal@gmail.com"
              />
              {errors?.personalEmail && (
                <p className="text-[11px] font-medium text-red-500">{errors.personalEmail}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass(!!errors?.mobileNo)}>Mobile Number (Default Nepal +977) *</label>
              <PhoneInput
                value={formData.mobileNo}
                onChange={(val) => update("mobileNo", val)}
                hasError={!!errors?.mobileNo}
                placeholder="9841123456"
              />
              {errors?.mobileNo && (
                <p className="text-[11px] font-medium text-red-500">{errors.mobileNo}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass(!!errors?.phoneHome)}>Phone (Home)</label>
              <PhoneInput
                value={formData.phoneHome || ""}
                onChange={(val) => update("phoneHome", val)}
                hasError={!!errors?.phoneHome}
                placeholder="015551234"
              />
              {errors?.phoneHome && (
                <p className="text-[11px] font-medium text-red-500">{errors.phoneHome}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Nepal Structured Address Picker */}
        <NepalAddressPicker
          permanentAddress={formData.permanentAddress || formData.address1 || ""}
          temporaryAddress={formData.temporaryAddress || formData.address2 || ""}
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
      </div>
    );
  }

  // TAB 3: FAMILY INFORMATION
  if (tabIndex === 3) {
    const isMarried = formData.taxStatus === "Married";

    return (
      <div className="space-y-6 animate-[fadeIn_150ms_ease-out]">
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-payroll-navy">
          <Info className="h-4 w-4 shrink-0 text-payroll-primary mt-0.5" />
          <div>
            <span className="font-semibold">Nepal Official Lineage Standard: </span>
            Father, Mother, and Grandfather names are mandatory for all official employee records and tax filings.
            Spouse name is required for Married tax status.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div className="space-y-1">
            <label className={labelClass(!!errors?.fatherName)}>Father&apos;s Name *</label>
            <input
              value={formData.fatherName}
              onChange={(e) => update("fatherName", e.target.value)}
              className={fieldInputClass(!!errors?.fatherName)}
              placeholder="e.g. Krishna Prasad Shrestha"
            />
            {errors?.fatherName && (
              <p className="text-[11px] font-medium text-red-500">{errors.fatherName}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className={labelClass(!!errors?.motherName)}>Mother&apos;s Name *</label>
            <input
              value={formData.motherName}
              onChange={(e) => update("motherName", e.target.value)}
              className={fieldInputClass(!!errors?.motherName)}
              placeholder="e.g. Shanti Shrestha"
            />
            {errors?.motherName && (
              <p className="text-[11px] font-medium text-red-500">{errors.motherName}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className={labelClass(!!errors?.grandfatherName)}>Grandfather&apos;s Name *</label>
            <input
              value={formData.grandfatherName}
              onChange={(e) => update("grandfatherName", e.target.value)}
              className={fieldInputClass(!!errors?.grandfatherName)}
              placeholder="e.g. Gopal Prasad Shrestha"
            />
            {errors?.grandfatherName && (
              <p className="text-[11px] font-medium text-red-500">{errors.grandfatherName}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className={labelClass(!!errors?.spouseName)}>
              Spouse&apos;s Name {isMarried ? "*" : "(Optional if unmarried)"}
            </label>
            <input
              value={formData.spouseName}
              onChange={(e) => update("spouseName", e.target.value)}
              className={fieldInputClass(!!errors?.spouseName)}
              placeholder="e.g. Rajendra Shrestha"
            />
            {errors?.spouseName && (
              <p className="text-[11px] font-medium text-red-500">{errors.spouseName}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // TAB 4: BANK & TERMINATION
  if (tabIndex === 4) {
    const isTerminated = formData.status === "Terminated";

    return (
      <div className="space-y-8 animate-[fadeIn_150ms_ease-out]">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-payroll-light pb-2">
            <h3 className="text-sm font-semibold text-payroll-navy">Bank Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="space-y-1">
              <label className={labelClass(!!errors?.bankName)}>Bank Name (Nepal Banks) *</label>
              <BankCombobox
                value={formData.bankName}
                onChange={(val) => update("bankName", val)}
                hasError={!!errors?.bankName}
                placeholder="Search or select bank in Nepal..."
              />
              {errors?.bankName && (
                <p className="text-[11px] font-medium text-red-500">{errors.bankName}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelClass(!!errors?.bankBranch)}>Bank Branch *</label>
              <input
                value={formData.bankBranch}
                onChange={(e) => update("bankBranch", e.target.value)}
                className={fieldInputClass(!!errors?.bankBranch)}
                placeholder="e.g. Patan Branch"
              />
              {errors?.bankBranch && (
                <p className="text-[11px] font-medium text-red-500">{errors.bankBranch}</p>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass(!!errors?.bankAccountNumber)}>Bank Account Number *</label>
              <input
                value={formData.bankAccountNumber}
                onChange={(e) => update("bankAccountNumber", e.target.value)}
                className={fieldInputClass(!!errors?.bankAccountNumber)}
                placeholder="e.g. 012345678901"
              />
              {errors?.bankAccountNumber && (
                <p className="text-[11px] font-medium text-red-500">{errors.bankAccountNumber}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-payroll-light pb-2">
            <h3 className="text-sm font-semibold text-payroll-navy">Termination / Retirement Information</h3>
            {isTerminated && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                Employee is marked Terminated
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="space-y-1">
              <label className={labelClass(!!errors?.informedDate)}>Informed / Notice Date</label>
              <NepaliDatePicker
                value={parseLocalDateParts(formData.informedDate)}
                onChange={(d) => update("informedDate", formatLocalDate(d))}
                label=""
                className={errors?.informedDate ? "border-red-500 focus:border-red-500" : ""}
              />
              {errors?.informedDate && (
                <p className="text-[11px] font-medium text-red-500">{errors.informedDate}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelClass(!!errors?.terminationDate)}>
                Date of Retirement / Termination {isTerminated ? "*" : ""}
              </label>
              <NepaliDatePicker
                value={parseLocalDateParts(formData.terminationDate)}
                onChange={(d) => update("terminationDate", formatLocalDate(d))}
                label=""
                className={errors?.terminationDate ? "border-red-500 focus:border-red-500" : ""}
              />
              {errors?.terminationDate && (
                <p className="text-[11px] font-medium text-red-500">{errors.terminationDate}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelClass(!!errors?.terminationType)}>
                Type {isTerminated ? "*" : ""}
              </label>
              <select
                value={formData.terminationType}
                onChange={(e) => update("terminationType", e.target.value)}
                className={fieldInputClass(!!errors?.terminationType)}
              >
                <option value="">Select Type</option>
                <option value="Retirement">Retirement</option>
                <option value="Resignation">Resignation</option>
                <option value="Termination">Termination</option>
                <option value="Contract End">Contract End</option>
              </select>
              {errors?.terminationType && (
                <p className="text-[11px] font-medium text-red-500">{errors.terminationType}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Plan</label>
              <select
                value={formData.terminationPlan}
                onChange={(e) => update("terminationPlan", e.target.value)}
                className={inputClass}
              >
                <option value="">Select Plan</option>
                <option value="Upadan">Upadan</option>
                <option value="Gratuity">Gratuity</option>
                <option value="Pension">Pension</option>
                <option value="None">None</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass(!!errors?.terminationReason)}>
                Reason {isTerminated ? "*" : ""}
              </label>
              <input
                value={formData.terminationReason}
                onChange={(e) => update("terminationReason", e.target.value)}
                className={fieldInputClass(!!errors?.terminationReason)}
                placeholder="e.g. Mandatory age retirement / Career transition"
              />
              {errors?.terminationReason && (
                <p className="text-[11px] font-medium text-red-500">{errors.terminationReason}</p>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-gray-600">Remarks</label>
              <textarea
                value={formData.terminationRemarks}
                onChange={(e) => update("terminationRemarks", e.target.value)}
                className={cn(inputClass, "h-20 resize-none")}
                placeholder="e.g. Handover completed and all clearances verified"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

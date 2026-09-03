"use client";

import { useState } from "react";
import {
  OnboardingStep3OrgInput,
  DepartmentPreset,
} from "@/lib/types/onboarding";
import {
  Building2,
  MapPin,
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  Briefcase,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";

interface Step3Props {
  data: OnboardingStep3OrgInput;
  onChange: (data: OnboardingStep3OrgInput) => void;
}

export function Step3OrgStructure({ data, onChange }: Step3Props) {
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");

  const updateBranch = (
    field: keyof OnboardingStep3OrgInput,
    value: string,
  ) => {
    onChange({ ...data, [field]: value });
  };

  const handleAddDept = () => {
    if (!newDeptName.trim()) return;
    const code =
      newDeptCode.trim() || newDeptName.trim().substring(0, 3).toUpperCase();
    const newDept: DepartmentPreset = {
      name: newDeptName.trim(),
      code,
      description: `${newDeptName.trim()} department`,
      headName: "Department Lead",
    };
    onChange({
      ...data,
      departments: [...data.departments, newDept],
    });
    setNewDeptName("");
    setNewDeptCode("");
  };

  const handleRemoveDept = (index: number) => {
    if (data.departments.length <= 1) return;
    const updated = data.departments.filter((_, i) => i !== index);
    onChange({ ...data, departments: updated });
  };

  return (
    <div className="space-y-6">
      {/* ── Section A: Primary Branch / Head Office (Flexible Location) ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Building2 className="h-4 w-4 text-payroll-primary" />
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Primary Head Office / Central Branch
            </h4>
            <p className="text-[11px] text-gray-500">
              Customize the name, location, and contact information for your
              organization's primary operating office.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-gray-700">
              Head Office Branch Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={data.branchName}
              onChange={(e) => updateBranch("branchName", e.target.value)}
              placeholder="e.g. Kathmandu Head Office, Pokhara Central Office"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Branch Code
            </label>
            <input
              type="text"
              value={data.branchCode}
              onChange={(e) => updateBranch("branchCode", e.target.value)}
              placeholder="e.g. HO-01, PKR-01"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-xs font-semibold text-gray-700">
              Operating City / Location <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                value={data.branchLocation}
                onChange={(e) => updateBranch("branchLocation", e.target.value)}
                placeholder="e.g. Lakeside, Pokhara / New Baneshwor, Kathmandu / Biratnagar Main Road"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
              />
            </div>
          </div>
        </div>

        {/* Contact details in balanced 2-column grid ensuring full width for PhoneInput */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Branch Phone
            </label>
            <PhoneInput
              value={data.branchPhone || ""}
              onChange={(val) => updateBranch("branchPhone", val)}
              placeholder="01-4XXXXXX / 9800000000"
              containerClassName="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Branch Email
            </label>
            <div className="relative">
              <Mail className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={data.branchEmail || ""}
                onChange={(e) => updateBranch("branchEmail", e.target.value)}
                placeholder="e.g. info@company.com / headoffice@company.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section B: Core Initial Departments ── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-payroll-primary" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Departments ({data.departments.length})
            </h4>
          </div>
          <span className="text-[11px] text-gray-500">
            You can add more departments anytime later
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {data.departments.map((dept, idx) => (
            <div
              key={idx}
              className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between gap-2 shadow-2xs hover:border-gray-300"
            >
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-1 text-[10px] font-bold bg-payroll-cream text-payroll-primary border border-payroll-light rounded-lg">
                  {dept.code}
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    {dept.name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {dept.description}
                  </span>
                </div>
              </div>

              {data.departments.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveDept(idx)}
                  className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                  title="Remove department"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add custom department inline */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder="New department name..."
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-payroll-primary"
          />
          <input
            type="text"
            placeholder="Code (e.g. LOG)"
            value={newDeptCode}
            onChange={(e) => setNewDeptCode(e.target.value)}
            className="w-24 px-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-payroll-primary"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddDept}
            disabled={!newDeptName.trim()}
            className="bg-payroll-primary hover:bg-[#256629] text-white text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* ── Section C: Designations Preview ── */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <Briefcase className="h-4 w-4 text-payroll-primary" />
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Standard Job Designations ({data.designations.length})
          </h4>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {data.designations.map((d, i) => (
            <span
              key={i}
              className="text-[11px] font-medium px-2.5 py-1 bg-gray-100/80 text-gray-700 rounded-lg border border-gray-200/80"
            >
              {d.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

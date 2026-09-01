"use client";

import { useMemo } from "react";
import { OnboardingStep2CompanyInput } from "@/lib/types/onboarding";
import {
  Building,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  Landmark,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  getAvailableFiscalYearPresets,
  FiscalYearPresetOption,
} from "@/lib/utils/fiscal-year-presets";

interface Step2Props {
  data: OnboardingStep2CompanyInput;
  onChange: (data: OnboardingStep2CompanyInput) => void;
}

export function Step2CompanyProfile({ data, onChange }: Step2Props) {
  const { options: fyPresets } = useMemo(
    () => getAvailableFiscalYearPresets(),
    []
  );

  const update = (field: keyof OnboardingStep2CompanyInput, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleSelectFiscalYear = (preset: FiscalYearPresetOption) => {
    onChange({
      ...data,
      fiscalYearLabel: preset.label,
      fiscalYearSlug: preset.slug,
      startDateBS: preset.startDateBS,
      endDateBS: preset.endDateBS,
      startDateAD: preset.startDateAD,
      endDateAD: preset.endDateAD,
    });
  };

  // Format Gregorian date for display
  const formatIsoForDisplay = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toISOString().split("T")[0];
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Section A: Company Information ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Building className="h-4 w-4 text-payroll-primary" />
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Company Master Details
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-gray-700">
              Legal Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={data.legalName}
              onChange={(e) => update("legalName", e.target.value)}
              placeholder="e.g. Acme Nepal Pvt. Ltd."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              PAN / VAT Number
            </label>
            <div className="relative">
              <FileText className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={data.panVatNumber || ""}
                onChange={(e) => update("panVatNumber", e.target.value)}
                placeholder="e.g. 601234567"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Company Registration No.
            </label>
            <div className="relative">
              <Landmark className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={data.registrationNumber || ""}
                onChange={(e) => update("registrationNumber", e.target.value)}
                placeholder="e.g. 123456/080/081"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Official Contact Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                value={data.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                placeholder="hr@acmenepal.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Official Phone
            </label>
            <div className="relative">
              <Phone className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={data.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                placeholder="+977-1-4XXXXXX"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-gray-700">
              Registered Office Address
            </label>
            <div className="relative">
              <MapPin className="h-3.5 w-3.5 absolute left-3.5 top-3 text-gray-400" />
              <textarea
                rows={2}
                value={data.officeAddress}
                onChange={(e) => update("officeAddress", e.target.value)}
                placeholder="e.g. Ward No. 4, Lakeside, Pokhara, Kaski"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section B: Dynamic Fiscal Year Selection (Nepal Bikram Sambat) ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-payroll-primary" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Active Bikram Sambat (BS) Fiscal Year
            </h4>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-payroll-primary font-semibold">
            <Sparkles className="h-3 w-3" />
            <span>Auto-Calculated</span>
          </span>
        </div>

        {/* Fiscal Year Options Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fyPresets.map((preset) => {
            const isSelected = data.fiscalYearSlug === preset.slug;
            return (
              <button
                key={preset.slug}
                type="button"
                onClick={() => handleSelectFiscalYear(preset)}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? "border-payroll-primary bg-[#f0f7ef] shadow-sm ring-1 ring-payroll-primary"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">
                    {preset.label}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-payroll-primary" />
                  )}
                </div>
                {preset.tag && (
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      preset.isCurrent
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {preset.tag}
                  </span>
                )}
                <p className="text-[11px] text-gray-500 mt-2 font-mono">
                  {preset.startDateBS} ~ {preset.endDateBS}
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Fiscal Year Details Card */}
        <div className="p-4 bg-payroll-cream rounded-2xl border border-payroll-light flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">
                {data.fiscalYearLabel}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-payroll-primary text-white rounded-full">
                Active Cycle
              </span>
            </div>
            <p className="text-xs text-gray-600">
              BS Period:{" "}
              <strong className="text-gray-900">{data.startDateBS}</strong> to{" "}
              <strong className="text-gray-900">{data.endDateBS}</strong>{" "}
              (Shrawan to Asar)
            </p>
            <p className="text-[11px] text-gray-500">
              Gregorian equivalent:{" "}
              <span className="font-medium text-gray-700">
                {formatIsoForDisplay(data.startDateAD)} to{" "}
                {formatIsoForDisplay(data.endDateAD)}
              </span>
            </p>
          </div>

          <div className="shrink-0 text-left sm:text-right">
            <span className="text-xs font-bold text-gray-700 block">
              Currency Standard
            </span>
            <span className="text-xs font-bold text-payroll-primary bg-white px-3 py-1 rounded-lg border border-gray-200 inline-block mt-1">
              Nepalese Rupee (NPR - रु)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

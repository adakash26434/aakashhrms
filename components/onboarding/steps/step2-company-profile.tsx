"use client";

import { useMemo } from "react";
import { OnboardingStep2CompanyInput } from "@/lib/types/onboarding";
import {
  INDUSTRY_SECTORS,
  IndustrySectorKey,
  getRecommendedShreniPresets,
} from "@/lib/constants/industry-types";
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
  Lock,
  Layers,
  Building2,
  Briefcase,
  Hospital,
  GraduationCap,
  Factory,
  Hotel,
  Globe2,
  ShieldCheck,
} from "lucide-react";
import {
  getAvailableFiscalYearPresets,
  FiscalYearPresetOption,
} from "@/lib/utils/fiscal-year-presets";

const SECTOR_ICONS: Record<IndustrySectorKey, any> = {
  BFIs: Landmark,
  Cooperatives: Building2,
  Corporate: Briefcase,
  Healthcare: Hospital,
  Education: GraduationCap,
  Manufacturing: Factory,
  Hospitality: Hotel,
  NGO_INGO: Globe2,
  Government: ShieldCheck,
  General: Layers,
};

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
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700">
                Company Admin Contact Email <span className="text-red-500">*</span>
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
                <Lock className="w-2.5 h-2.5" /> Super Admin Managed
              </span>
            </div>
            <div className="relative">
              <Mail className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                readOnly
                disabled
                value={data.contactEmail}
                placeholder="hr@acmenepal.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-100/80 text-gray-600 font-medium cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Provisioned by Super Admin. Editable only from the Super Admin Control Plane.
            </p>
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

      {/* ── Section B: Organization Industry Type & Shreni Hierarchy (Locked by Super Admin) ── */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-payroll-primary" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Organization Industry Classification (संस्थाको प्रकृति / क्षेत्र)
            </h4>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold shadow-2xs">
            <Lock className="h-3 w-3 text-amber-600 shrink-0" />
            <span>Locked by Super Admin (सुपर एडमिनद्वारा निर्धारित)</span>
          </span>
        </div>

        {(() => {
          const selectedKey = (data.industryType || "General") as IndustrySectorKey;
          const selectedSector = INDUSTRY_SECTORS[selectedKey] || INDUSTRY_SECTORS.General;
          const Icon = SECTOR_ICONS[selectedKey] || Layers;
          const previewPresets = getRecommendedShreniPresets(selectedKey);

          return (
            <div className="rounded-2xl border border-payroll-light bg-payroll-cream/40 p-4 text-xs space-y-3">
              {/* Primary Sector Display */}
              <div className="flex items-start justify-between gap-3 bg-white p-3.5 rounded-xl border border-payroll-light shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-payroll-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-payroll-navy">
                        {selectedSector.label}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-payroll-cream border border-payroll-light text-payroll-primary font-bold">
                        {selectedSector.shortLabel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      {selectedSector.labelNepali}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Active Classification</span>
                  </span>
                </div>
              </div>

              {/* Sector Description & Hierarchy Rules */}
              <div className="space-y-1.5 px-1">
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  {selectedSector.description}
                </p>
              </div>

              {/* Live Preview of Unlocked Shreni Tiers */}
              <div className="bg-white/80 p-3 rounded-xl border border-payroll-light/80 space-y-2">
                <div className="flex items-center gap-1.5 text-payroll-navy font-bold text-[11px]">
                  <Sparkles className="h-3.5 w-3.5 text-payroll-primary shrink-0" />
                  <span>Configured Employee Shreni / Level Hierarchy Tiers:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {previewPresets.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[10px] font-semibold text-payroll-navy shadow-2xs"
                    >
                      {p.name.split("(")[0].trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Super Admin Notice */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                <ShieldCheck className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <p>
                  This organization classification was established by the platform Super Administrator during company registration. To maintain enterprise consistency and statutory compliance, it cannot be changed from the tenant console. Contact your Super Admin if an industry sector reclassification is required.
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Section C: Dynamic Fiscal Year Selection (Nepal Bikram Sambat) ── */}
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

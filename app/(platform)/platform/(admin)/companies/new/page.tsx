"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { StatutoryPolicyPackPayload } from "@/lib/platform/policy-pack-data";
import {
  INDUSTRY_SECTORS,
  IndustrySectorKey,
} from "@/lib/constants/industry-types";
import {
  Mail,
  Phone,
  Database,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Building2,
  MapPin,
  FileText,
  Hash,
  Calendar,
  CalendarDays,
  Palmtree,
  Coins,
  Percent,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Info,
  GitBranch,
  Pencil,
  Plus,
} from "lucide-react";
import { validatePhoneNumber } from "@/lib/utils/phone";
import { slugifyCompanyName } from "@/lib/platform/company-code";
import { PhoneInput } from "@/components/ui/phone-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getAvailableFiscalYearPresets } from "@/lib/utils/fiscal-year-presets";
import { FiscalYearFormModal } from "@/components/fiscal-year/fiscal-year-form-modal";
import type { FiscalYear, FiscalYearFormData, FiscalYearStatus } from "@/lib/types/fiscal-year";
import {
  formatADDate,
  adToBSString,
  BS_MONTHS_EN,
  type BSMonthNumber,
} from "@/lib/utils/bs-calendar";
import {
  DEFAULT_NEPAL_LEAVE_TYPES,
  DEFAULT_PAY_HEADS,
  LeaveTypePreset,
  PayHeadPreset,
} from "@/lib/types/onboarding";

const DEFAULT_TAX_SLABS = [
  // Normal Single Individual (FY 2083/84)
  {
    category: "Normal Single",
    amountFrom: "0",
    amountTo: "1000000",
    ratePercent: "1.00",
    fixedDeduction: "0",
  },
  {
    category: "Normal Single",
    amountFrom: "1000001",
    amountTo: "1500000",
    ratePercent: "10.00",
    fixedDeduction: "0",
  },
  {
    category: "Normal Single",
    amountFrom: "1500001",
    amountTo: "2500000",
    ratePercent: "20.00",
    fixedDeduction: "0",
  },
  {
    category: "Normal Single",
    amountFrom: "2500001",
    amountTo: "4000000",
    ratePercent: "27.00",
    fixedDeduction: "0",
  },
  {
    category: "Normal Single",
    amountFrom: "4000001",
    amountTo: null,
    ratePercent: "29.00",
    fixedDeduction: "0",
  },

  // Married Couple (FY 2083/84)
  {
    category: "Married",
    amountFrom: "0",
    amountTo: "1000000",
    ratePercent: "1.00",
    fixedDeduction: "0",
  },
  {
    category: "Married",
    amountFrom: "1000001",
    amountTo: "1500000",
    ratePercent: "10.00",
    fixedDeduction: "0",
  },
  {
    category: "Married",
    amountFrom: "1500001",
    amountTo: "2500000",
    ratePercent: "20.00",
    fixedDeduction: "0",
  },
  {
    category: "Married",
    amountFrom: "2500001",
    amountTo: "4000000",
    ratePercent: "27.00",
    fixedDeduction: "0",
  },
  {
    category: "Married",
    amountFrom: "4000001",
    amountTo: null,
    ratePercent: "29.00",
    fixedDeduction: "0",
  },

  // Handicapped (FY 2083/84)
  {
    category: "Handicapped",
    amountFrom: "0",
    amountTo: "1500000",
    ratePercent: "1.00",
    fixedDeduction: "0",
  },
  {
    category: "Handicapped",
    amountFrom: "1500001",
    amountTo: "2000000",
    ratePercent: "10.00",
    fixedDeduction: "0",
  },
  {
    category: "Handicapped",
    amountFrom: "2000001",
    amountTo: "3000000",
    ratePercent: "20.00",
    fixedDeduction: "0",
  },
  {
    category: "Handicapped",
    amountFrom: "3000001",
    amountTo: "4500000",
    ratePercent: "27.00",
    fixedDeduction: "0",
  },
  {
    category: "Handicapped",
    amountFrom: "4500001",
    amountTo: null,
    ratePercent: "29.00",
    fixedDeduction: "0",
  },
];

export default function RegisterCompanyPage() {
  const router = useRouter();
  const toast = useToast();

  // 1. Company Profile Fields
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [panVatNumber, setPanVatNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [headOfficeAddress, setHeadOfficeAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [industryType, setIndustryType] =
    useState<IndustrySectorKey>("General");
  const [notes, setNotes] = useState("");

  // 2. Head Office Branch Fields (Address & Code)
  const [headOfficeBranchCode, setHeadOfficeBranchCode] = useState("HO-01");
  const [headOfficeBranchAddress, setHeadOfficeBranchAddress] = useState("");
  const [isBranchAddressCustomized, setIsBranchAddressCustomized] =
    useState(false);

  // 3. Fiscal Year Setup
  const [configuredFY, setConfiguredFY] = useState<{
    label: string;
    slug: string;
    fromMonth: BSMonthNumber;
    toMonth: BSMonthNumber;
    startDateAD: Date;
    endDateAD: Date;
    startDateBS: string;
    endDateBS: string;
    status: FiscalYearStatus;
  }>(() => {
    const { current: defaultFY } = getAvailableFiscalYearPresets();
    return {
      label: defaultFY.label,
      slug: defaultFY.slug,
      fromMonth: 4,
      toMonth: 3,
      startDateAD: new Date(defaultFY.startDateAD),
      endDateAD: new Date(defaultFY.endDateAD),
      startDateBS: defaultFY.startDateBS,
      endDateBS: defaultFY.endDateBS,
      status: "Active",
    };
  });

  const [isFYModalOpen, setIsFYModalOpen] = useState(false);
  const [fyModalMode, setFyModalMode] = useState<"edit" | "add">("edit");

  const handleSaveFYFromModal = (formData: FiscalYearFormData) => {
    const startBS = adToBSString(formData.startDateAD);
    const endBS = adToBSString(formData.endDateAD);
    setConfiguredFY({
      label: formData.label.trim(),
      slug: formData.slug.trim(),
      fromMonth: formData.fromMonth,
      toMonth: formData.toMonth,
      startDateAD: formData.startDateAD,
      endDateAD: formData.endDateAD,
      startDateBS: startBS,
      endDateBS: endBS,
      status: formData.status || "Active",
    });
    setIsFYModalOpen(false);
  };

  const fyModalInitialValue: FiscalYear | null = useMemo(() => {
    if (fyModalMode === "add") return null;
    return {
      id: "initial-active-fy",
      label: configuredFY.label,
      slug: configuredFY.slug,
      fromMonth: configuredFY.fromMonth,
      toMonth: configuredFY.toMonth,
      startDateAD: configuredFY.startDateAD,
      endDateAD: configuredFY.endDateAD,
      startDateBS: configuredFY.startDateBS,
      endDateBS: configuredFY.endDateBS,
      status: configuredFY.status,
      payslipsGenerated: false,
    };
  }, [fyModalMode, configuredFY]);

  // 4. Statutory Leaves & Overtime
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypePreset[]>(
    DEFAULT_NEPAL_LEAVE_TYPES,
  );
  const [otHourlyMultiplier, setOtHourlyMultiplier] = useState<number>(1.5);

  // 5. Pay Heads
  const [payHeads, setPayHeads] = useState<PayHeadPreset[]>(DEFAULT_PAY_HEADS);

  // 6. Tax Slabs
  const [taxSlabs, setTaxSlabs] = useState(DEFAULT_TAX_SLABS);

  // Dynamically load & sync from active Statutory Policy Pack configured in Super Admin control plane
  useEffect(() => {
    let isMounted = true;
    async function loadActivePolicyPack() {
      try {
        const res = await fetch("/api/platform/policies");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && data.activePack?.payload) {
          const pack: StatutoryPolicyPackPayload = data.activePack.payload;

          // 1. Sync Tax Slabs baseline
          if (pack.taxSlabsBaseline && pack.taxSlabsBaseline.length > 0) {
            setTaxSlabs(
              pack.taxSlabsBaseline.map((s) => ({
                category: s.category,
                amountFrom: String(s.amountFrom),
                amountTo:
                  s.amountTo !== null &&
                  s.amountTo !== undefined &&
                  s.amountTo !== ""
                    ? String(s.amountTo)
                    : null,
                ratePercent: String(s.ratePercent),
                fixedDeduction: String(s.fixedDeduction || "0"),
              }))
            );
          }

          // 2. Sync Overtime Multiplier
          if (pack.otRules && pack.otRules.length > 0) {
            const standardOt =
              pack.otRules.find((r) => r.ruleType === "Hourly") || pack.otRules[0];
            if (standardOt?.rateOfficeDay) {
              const parsed = Number(standardOt.rateOfficeDay);
              if (!isNaN(parsed) && parsed > 0) {
                setOtHourlyMultiplier(parsed);
              }
            }
          }

          // 3. Sync Statutory Leave Rules
          if (pack.leaveRules && pack.leaveRules.length > 0) {
            setLeaveTypes(
              pack.leaveRules.map((lr) => ({
                name: lr.name,
                code: lr.code,
                category: lr.statutoryCode || lr.code || "STATUTORY",
                daysPerYear: lr.daysPerYear,
                isPaid: lr.leaveType === "Pay",
                maxAccumulation: lr.maxAccumulation,
                genderSpecific: lr.genderApplicable || "All",
                isEncashable: lr.isEncashable,
              }))
            );
          }
        }
      } catch (err) {
        console.warn("Using default statutory baseline:", err);
      }
    }
    loadActivePolicyPack();
    return () => {
      isMounted = false;
    };
  }, []);

  // Form handling state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-sync slug from names
  const handleLegalNameChange = (val: string) => {
    setLegalName(val);
    if (!isSlugCustomized && !displayName) {
      setSlug(slugifyCompanyName(val));
    }
  };

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (!isSlugCustomized) {
      setSlug(slugifyCompanyName(val || legalName));
    }
  };

  const handleSlugChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(clean);
    setIsSlugCustomized(true);
  };

  const handleResetSlug = () => {
    setIsSlugCustomized(false);
    setSlug(slugifyCompanyName(displayName || legalName));
  };

  // Auto-sync branch address from head office address
  const handleHeadOfficeAddressChange = (val: string) => {
    setHeadOfficeAddress(val);
    if (!isBranchAddressCustomized) {
      setHeadOfficeBranchAddress(val);
    }
  };

  const handleBranchAddressChange = (val: string) => {
    setHeadOfficeBranchAddress(val);
    setIsBranchAddressCustomized(true);
  };

  const handleResetBranchAddress = () => {
    setIsBranchAddressCustomized(false);
    setHeadOfficeBranchAddress(headOfficeAddress);
  };

  const handlePhoneChange = (val: string) => {
    setContactPhone(val);
    if (!val.trim()) {
      setPhoneError(null);
      return;
    }
    const result = validatePhoneNumber(val);
    if (!result.isValid) {
      setPhoneError("Invalid phone format (e.g. 9800000000 / 01-4XXXXXX)");
    } else {
      setPhoneError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate phone if provided
    if (contactPhone && contactPhone.trim()) {
      const result = validatePhoneNumber(contactPhone, true);
      if (!result.isValid) {
        setError(
          "Please provide a valid contact phone number before proceeding.",
        );
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        legalName: legalName.trim(),
        displayName: (displayName || legalName).trim(),
        slug,
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone.trim() || null,
        industryType,
        panVatNumber: panVatNumber.trim() || null,
        registrationNumber: registrationNumber.trim() || null,
        headOfficeAddress: headOfficeAddress.trim() || null,
        headOfficeBranchCode: (headOfficeBranchCode || "HO-01").trim(),
        headOfficeBranchAddress: (
          headOfficeBranchAddress ||
          headOfficeAddress ||
          "Head Office"
        ).trim(),
        initialSetupPayload: {
          fiscalYear: {
            label: configuredFY.label,
            slug: configuredFY.slug,
            fromMonth: configuredFY.fromMonth,
            toMonth: configuredFY.toMonth,
            startDateBS: configuredFY.startDateBS,
            endDateBS: configuredFY.endDateBS,
            startDateAD:
              configuredFY.startDateAD instanceof Date
                ? configuredFY.startDateAD.toISOString()
                : new Date(configuredFY.startDateAD).toISOString(),
            endDateAD:
              configuredFY.endDateAD instanceof Date
                ? configuredFY.endDateAD.toISOString()
                : new Date(configuredFY.endDateAD).toISOString(),
            status: configuredFY.status || "Active",
          },
          leaveTypes,
          otHourlyMultiplier,
          payHeads,
          taxSlabs,
        },
        notes: notes.trim() || null,
      };

      const res = await fetch("/api/platform/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          res.status === 401
            ? "Your session expired. Please log in again."
            : `Server returned HTTP ${res.status}. Please try again.`,
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to register company.");
      }

      toast.success(
        `Company registered successfully! Code: ${data.company.companyCode}`,
      );
      router.push("/platform/companies");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Registration failed.");
      toast.error(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const earnings = payHeads.filter((p) => p.type === "EARNING");
  const deductions = payHeads.filter((p) => p.type === "DEDUCTION");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* ── Top Header Bar ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/platform/companies"
          className="p-2 rounded-xl border border-payroll-light/80 bg-white hover:bg-payroll-cream text-payroll-navy transition-all shadow-payroll-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            Register Tenant Company & Complete Setup
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Register organization details, head office branch, active fiscal
            year, statutory leaves, pay heads, and progressive tax slabs for
            direct workspace access.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 font-semibold">
          <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1: COMPANY LEGAL & REGISTRATION PROFILE
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="border-payroll-light/80 shadow-payroll-sm bg-white overflow-hidden">
          <div className="bg-linear-to-r from-payroll-cream/50 to-white px-6 py-3.5 border-b border-payroll-light/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-payroll-primary/10 text-payroll-primary flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <h2 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Company Legal & Registration Profile
                </h2>
                <p className="text-[11px] text-gray-500">
                  Official identity, registration numbers, and administrative
                  contact
                </p>
              </div>
            </div>
            <Building2 className="w-4 h-4 text-payroll-primary/60" />
          </div>

          <CardContent className="p-6 space-y-5">
            {/* Legal Entity & Display Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Legal Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => handleLegalNameChange(e.target.value)}
                  placeholder="e.g. Himalayan Solutions Pvt. Ltd."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Display Brand Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  placeholder="e.g. Himalayan Tech"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs"
                />
              </div>
            </div>

            {/* PAN/VAT Number & Registration Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-payroll-primary" />
                  <span>PAN / VAT Number</span>
                </label>
                <input
                  type="text"
                  value={panVatNumber}
                  onChange={(e) =>
                    setPanVatNumber(
                      e.target.value.replace(/\D/g, "").slice(0, 9),
                    )
                  }
                  placeholder="e.g. 601234567 (9 digits)"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs font-mono"
                />
                <p className="text-[10px] text-gray-500">
                  Official 9-digit Permanent Account Number (PAN) / VAT in Nepal
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-payroll-primary" />
                  <span>Company Registration Number</span>
                </label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. 123456/080/081"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs"
                />
                <p className="text-[10px] text-gray-500">
                  Office of Company Registrar (OCR) registration number
                </p>
              </div>
            </div>

            {/* Head Office Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-payroll-primary" />
                <span>
                  Company Head Office Address{" "}
                  <span className="text-rose-500">*</span>
                </span>
              </label>
              <input
                type="text"
                required
                value={headOfficeAddress}
                onChange={(e) => handleHeadOfficeAddressChange(e.target.value)}
                placeholder="e.g. Putalisadak-28, Kathmandu, Bagmati Province, Nepal"
                className="w-full px-3.5 py-2 text-xs rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs"
              />
            </div>

            {/* Database Slug Identifier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Database Slug Identifier{" "}
                  <span className="text-rose-500">*</span>
                </label>
                {isSlugCustomized ? (
                  <button
                    type="button"
                    onClick={handleResetSlug}
                    className="text-[11px] font-semibold text-payroll-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-sync from Brand Name</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-syncing from name</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Database className="w-4 h-4 text-payroll-primary" />
                </div>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="himalayan-tech"
                  className="w-full pl-10 pr-4 py-2 text-xs font-mono rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Isolated PostgreSQL database:{" "}
                <code className="text-payroll-primary font-mono font-bold">
                  pay_t_{slug || "slug"}
                </code>
              </p>
            </div>

            {/* Contact Email & Contact Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Contact Email (Initial Administrator){" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="admin@himalayan.com"
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Contact Phone
                  </label>
                  {!phoneError && contactPhone && (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Valid</span>
                    </span>
                  )}
                </div>
                <PhoneInput
                  value={contactPhone}
                  onChange={handlePhoneChange}
                  hasError={Boolean(phoneError)}
                  placeholder="9800000000 / 01-4XXXXXX"
                />
                {phoneError && (
                  <p className="text-[11px] text-rose-600 font-semibold">
                    {phoneError}
                  </p>
                )}
              </div>
            </div>

            {/* Industry / Organization Sector */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Organization Industry Sector{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-gray-500">
                  Defines company industry classification
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.keys(INDUSTRY_SECTORS) as IndustrySectorKey[]).map(
                  (key) => {
                    const sector = INDUSTRY_SECTORS[key];
                    const isSelected = industryType === key;

                    return (
                      <div
                        key={key}
                        onClick={() => setIndustryType(key)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "border-payroll-primary bg-payroll-primary/5 ring-1 ring-payroll-primary/20 shadow-payroll-xs"
                            : "border-payroll-light/80 bg-white hover:border-gray-300 hover:bg-gray-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-payroll-navy truncate">
                              {sector.label}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">
                              {sector.labelNepali}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-payroll-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2: FIRST HEAD OFFICE BRANCH SETUP
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="border-payroll-light/80 shadow-payroll-sm bg-white overflow-hidden">
          <div className="bg-linear-to-r from-payroll-cream/50 to-white px-6 py-3.5 border-b border-payroll-light/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-payroll-primary/10 text-payroll-primary flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <h2 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  First Head Office Branch Setup
                </h2>
                <p className="text-[11px] text-gray-500">
                  Primary corporate branch code and location (distinguished by
                  location address)
                </p>
              </div>
            </div>
            <GitBranch className="w-4 h-4 text-payroll-primary/60" />
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Branch Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={headOfficeBranchCode}
                  onChange={(e) =>
                    setHeadOfficeBranchCode(e.target.value.toUpperCase())
                  }
                  placeholder="HO-01"
                  className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs"
                />
                <p className="text-[10px] text-gray-500">
                  Unique identifier for the primary corporate branch
                </p>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Branch Address / Location{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  {isBranchAddressCustomized ? (
                    <button
                      type="button"
                      onClick={handleResetBranchAddress}
                      className="text-[11px] font-semibold text-payroll-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Sync with Head Office Address</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-synced from Head Office</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <MapPin className="w-4 h-4 text-payroll-primary" />
                  </div>
                  <input
                    type="text"
                    required
                    value={headOfficeBranchAddress}
                    onChange={(e) => handleBranchAddressChange(e.target.value)}
                    placeholder="Putalisadak, Kathmandu"
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all shadow-payroll-xs"
                  />
                </div>
                <p className="text-[10px] text-gray-500">
                  Branch is automatically named &ldquo;Head Office&rdquo; under
                  the organization umbrella.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 3: INITIAL ACTIVE FISCAL YEAR
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="border-payroll-light/80 shadow-payroll-sm bg-white overflow-hidden">
          <div className="bg-linear-to-r from-payroll-cream/50 to-white px-6 py-3.5 border-b border-payroll-light/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-payroll-primary/10 text-payroll-primary flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div>
                <h2 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Initial Active Fiscal Year
                </h2>
                <p className="text-[11px] text-gray-500">
                  Super Admin establishes the primary active cycle; subsequent
                  years can be created by company admin
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setFyModalMode("add");
                  setIsFYModalOpen(true);
                }}
                className="border-payroll-light text-payroll-navy hover:bg-payroll-cream text-xs h-7.5 px-2.5 font-medium flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-payroll-primary" />
                <span>Add Fiscal Year</span>
              </Button>
              <Button
                type="button"
                size="xs"
                onClick={() => {
                  setFyModalMode("edit");
                  setIsFYModalOpen(true);
                }}
                className="bg-payroll-primary hover:bg-payroll-primary/90 text-white text-xs h-7.5 px-2.5 font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Fiscal Year</span>
              </Button>
            </div>
          </div>

          <CardContent className="p-6 space-y-4">
            {/* Active Fiscal Year Primary Display Card */}
            <div className="p-5 rounded-2xl border border-payroll-primary/30 bg-linear-to-br from-payroll-primary/5 via-white to-payroll-cream/30 shadow-payroll-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-payroll-light/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-payroll-primary/10 border border-payroll-primary/20 flex items-center justify-center text-payroll-primary shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-payroll-navy">
                        {configuredFY.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Operating Cycle
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                      Database Slug: <span className="text-payroll-primary font-semibold">{configuredFY.slug}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 Detail Blocks: BS Range, AD Equivalent, Operational Months */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                <div className="p-3 bg-white rounded-xl border border-payroll-light/70 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Bikram Sambat (BS) Range
                  </span>
                  <span className="text-xs font-mono font-bold text-payroll-navy mt-1 block">
                    {configuredFY.startDateBS} ~ {configuredFY.endDateBS}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Bikram Sambat calendar
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-payroll-light/70 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Gregorian (AD) Equivalent
                  </span>
                  <span className="text-xs font-mono font-bold text-payroll-navy mt-1 block">
                    {formatADDate(configuredFY.startDateAD, "short")} to {formatADDate(configuredFY.endDateAD, "short")}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Stored in tenant DB as AD timestamp
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-payroll-light/70 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Operational Month Range
                  </span>
                  <span className="text-xs font-bold text-payroll-navy mt-1 block">
                    {BS_MONTHS_EN[configuredFY.fromMonth]} to {BS_MONTHS_EN[configuredFY.toMonth]}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Month {configuredFY.fromMonth} through Month {configuredFY.toMonth} (12 Mo.)
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-payroll-cream/50 rounded-xl border border-payroll-light/70 text-xs text-payroll-navy flex items-start gap-2.5">
              <Info className="w-4 h-4 text-payroll-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-payroll-navy">
                  Active Cycle: <strong>{configuredFY.label}</strong> ({BS_MONTHS_EN[configuredFY.fromMonth]} to {BS_MONTHS_EN[configuredFY.toMonth]})
                </p>
                <p className="text-[11px] text-gray-600">
                  Configured with the canonical Bikram Sambat calendar system. After this initial fiscal year is established, the company administrator can manage future fiscal cycles directly from <strong>Setup → Fiscal Year</strong>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal for adding or editing the Fiscal Year */}
        {isFYModalOpen && (
          <FiscalYearFormModal
            key={fyModalMode === "edit" ? `edit-${configuredFY.slug}` : "add-new"}
            open={isFYModalOpen}
            onClose={() => setIsFYModalOpen(false)}
            initialValue={fyModalInitialValue}
            onSubmit={handleSaveFYFromModal}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 4: STATUTORY LEAVES & OVERTIME ALLOTMENTS
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="border-payroll-light/80 shadow-payroll-sm bg-white overflow-hidden">
          <div className="bg-linear-to-r from-payroll-cream/50 to-white px-6 py-3.5 border-b border-payroll-light/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-payroll-primary/10 text-payroll-primary flex items-center justify-center font-bold text-xs">
                4
              </div>
              <div>
                <h2 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Statutory Leaves & Overtime Allotments
                </h2>
                <p className="text-[11px] text-gray-500">
                  Mandatory Nepal Labour Act 2074 leave allotments and overtime
                  multiplier
                </p>
              </div>
            </div>
            <Palmtree className="w-4 h-4 text-payroll-primary/60" />
          </div>

          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {leaveTypes.map((lt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-payroll-cream/20 rounded-xl border border-payroll-light/80 shadow-2xs flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-payroll-navy block">
                        {lt.name}
                      </span>
                      <span className="text-[10px] text-gray-500 block mt-0.5">
                        Code: <strong>{lt.code}</strong> • {lt.category}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-payroll-primary bg-payroll-cream px-2 py-0.5 rounded-lg border border-payroll-light shrink-0">
                      {lt.daysPerYear}d / yr
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-payroll-light/60 text-[10px] text-gray-500 flex-wrap">
                    {lt.isEncashable ? (
                      <span className="text-emerald-700 font-medium">
                        ✓ Encashable (cap: {lt.maxAccumulation}d)
                      </span>
                    ) : (
                      <span>Non-encashable</span>
                    )}
                    <span>•</span>
                    <span>{lt.isPaid ? "Fully Paid" : "Unpaid"}</span>
                    {lt.genderSpecific && lt.genderSpecific !== "All" && (
                      <>
                        <span>•</span>
                        <span className="text-purple-700 font-medium">
                          {lt.genderSpecific} Only
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Overtime Rate */}
            <div className="pt-2 border-t border-payroll-light/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-payroll-primary" />
                <div>
                  <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Statutory Overtime Calculation Rate
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Labour Act Section 31 standard overtime rate (default 1.5x
                    basic wage)
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 bg-payroll-cream px-3 py-1.5 rounded-xl border border-payroll-light text-xs font-bold text-payroll-navy">
                <span>Multiplier:</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="3"
                  value={otHourlyMultiplier}
                  onChange={(e) =>
                    setOtHourlyMultiplier(parseFloat(e.target.value) || 1.5)
                  }
                  className="w-16 px-2 py-0.5 text-xs text-center font-mono font-bold bg-white border border-payroll-light rounded-lg text-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                />
                <span>x</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 5: STANDARD PAY HEADS & SALARY COMPONENTS
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="border-payroll-light/80 shadow-payroll-sm bg-white overflow-hidden">
          <div className="bg-linear-to-r from-payroll-cream/50 to-white px-6 py-3.5 border-b border-payroll-light/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-payroll-primary/10 text-payroll-primary flex items-center justify-center font-bold text-xs">
                5
              </div>
              <div>
                <h2 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Standard Pay Heads & Salary Components
                </h2>
                <p className="text-[11px] text-gray-500">
                  Pre-configured earnings and statutory deductions (SSF, EPF,
                  CIT, TDS)
                </p>
              </div>
            </div>
            <Coins className="w-4 h-4 text-payroll-primary/60" />
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Earnings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-payroll-light/60">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Standard Earnings ({earnings.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {earnings.map((ph, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-xl border border-payroll-light/80 shadow-2xs flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-payroll-navy block">
                          {ph.name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {ph.code} • Basic Salary Component
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                        Taxable
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-payroll-light/60">
                  <ArrowDownRight className="h-4 w-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Statutory Deductions ({deductions.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {deductions.map((ph, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-xl border border-payroll-light/80 shadow-2xs flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-payroll-navy block">
                          {ph.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {ph.code} •{" "}
                          {ph.isSsfHead
                            ? "SSF Scheme (11% + 20%)"
                            : ph.isPfHead
                              ? "Provident Fund (10% + 10%)"
                              : ph.isCitHead
                                ? "Citizen Investment Trust"
                                : ph.isTdsHead
                                  ? "Inland Revenue TDS"
                                  : "Deduction"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                        Pre-Tax
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 6: NEPAL IRD PROGRESSIVE INCOME TAX SLABS
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="border-payroll-light/80 shadow-payroll-sm bg-white overflow-hidden">
          <div className="bg-linear-to-r from-payroll-cream/50 to-white px-6 py-3.5 border-b border-payroll-light/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-payroll-primary/10 text-payroll-primary flex items-center justify-center font-bold text-xs">
                6
              </div>
              <div>
                <h2 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Nepal IRD Progressive Income Tax Slabs ({configuredFY.label})
                </h2>
                <p className="text-[11px] text-gray-500">
                  Statutory progressive brackets under Nepal Income Tax Act 2058
                  / Finance Act
                </p>
              </div>
            </div>
            <Percent className="w-4 h-4 text-payroll-primary/60" />
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Normal Single Slabs */}
              <div className="p-4 bg-payroll-cream/30 rounded-2xl border border-payroll-light/80 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-payroll-navy">
                    Normal Single Individual
                  </h5>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                    Standard
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-gray-600">
                  {taxSlabs
                    .filter((s) => s.category === "Normal Single")
                    .map((slab, i) => (
                      <li key={i} className="flex justify-between py-1 border-b border-payroll-light/50 last:border-0">
                        <span>
                          {Number(slab.amountFrom).toLocaleString()} ~{" "}
                          {slab.amountTo ? Number(slab.amountTo).toLocaleString() : "Above"}
                        </span>
                        <strong className="text-payroll-navy">
                          {slab.ratePercent}%{i === 0 && " (SST)"}
                        </strong>
                      </li>
                    ))}
                </ul>
              </div>

              {/* Married Slabs */}
              <div className="p-4 bg-payroll-cream/30 rounded-2xl border border-payroll-light/80 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-payroll-navy">
                    Married Couple
                  </h5>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                    Joint
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-gray-600">
                  {taxSlabs
                    .filter((s) => s.category === "Married")
                    .map((slab, i) => (
                      <li key={i} className="flex justify-between py-1 border-b border-payroll-light/50 last:border-0">
                        <span>
                          {Number(slab.amountFrom).toLocaleString()} ~{" "}
                          {slab.amountTo ? Number(slab.amountTo).toLocaleString() : "Above"}
                        </span>
                        <strong className="text-payroll-navy">
                          {slab.ratePercent}%{i === 0 && " (SST)"}
                        </strong>
                      </li>
                    ))}
                </ul>
              </div>

              {/* Handicapped Slabs */}
              <div className="p-4 bg-payroll-cream/30 rounded-2xl border border-payroll-light/80 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-payroll-navy">
                    Handicapped
                  </h5>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                    Concessional
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-gray-600">
                  {taxSlabs
                    .filter((s) => s.category === "Handicapped")
                    .map((slab, i) => (
                      <li key={i} className="flex justify-between py-1 border-b border-payroll-light/50 last:border-0">
                        <span>
                          {Number(slab.amountFrom).toLocaleString()} ~{" "}
                          {slab.amountTo ? Number(slab.amountTo).toLocaleString() : "Above"}
                        </span>
                        <strong className="text-payroll-navy">
                          {slab.ratePercent}%{i === 0 && " (SST)"}
                        </strong>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            <p className="text-[11px] text-gray-500">
              All three tax slab categories (<strong>Normal Single</strong>,{" "}
              <strong>Married</strong>, and <strong>Handicapped</strong>) are
              automatically seeded with their statutory thresholds for this
              fiscal year.
            </p>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 7: ADMINISTRATIVE NOTES & SUBMIT
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="border-payroll-light/80 shadow-payroll-sm bg-white">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Internal Administrative Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enterprise client plan details, custom contract requirements, SLA notes..."
                className="w-full p-3 text-xs rounded-xl border bg-white payroll-input focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-all resize-none shadow-payroll-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-payroll-light/60 flex items-center justify-end gap-2.5">
              <Link href="/platform/companies">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold"
                >
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                size="sm"
                isLoading={loading}
                disabled={loading || Boolean(phoneError)}
                className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm"
              >
                <Building2 className="w-4 h-4 mr-1.5" />
                <span>Register Tenant Company</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

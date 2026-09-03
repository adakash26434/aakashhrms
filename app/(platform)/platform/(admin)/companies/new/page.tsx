"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Shield,
  Layers,
} from "lucide-react";
import { validatePhoneNumber } from "@/lib/utils/phone";
import { slugifyCompanyName } from "@/lib/platform/company-code";
import { PhoneInput } from "@/components/ui/phone-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export default function RegisterCompanyPage() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [industryType, setIndustryType] = useState<IndustrySectorKey>("General");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

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
        setError("Please provide a valid contact phone number before proceeding.");
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch("/api/platform/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName,
          displayName: displayName || legalName,
          slug,
          contactEmail,
          contactPhone,
          industryType,
          notes,
        }),
      });

      let data: any;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          res.status === 401
            ? "Your session expired. Please log in again."
            : `Server returned HTTP ${res.status}. Please try again.`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to register company.");
      }

      toast.success(`Company registered successfully! Code: ${data.company.companyCode}`);
      router.push("/platform/companies");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Registration failed.");
      toast.error(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
            Onboard New SaaS Tenant Company
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Register organization details to generate a unique Company Code and isolated database pipeline.
          </p>
        </div>
      </div>

      <Card className="border-payroll-light/80 shadow-payroll-md bg-white">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 font-semibold">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary transition-all placeholder:text-gray-400 shadow-payroll-xs"
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
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary transition-all placeholder:text-gray-400 shadow-payroll-xs"
                />
              </div>
            </div>

            {/* Database Slug Identifier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Database Slug Identifier <span className="text-rose-500">*</span>
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
                  className="w-full pl-10 pr-4 py-2 text-xs font-mono rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary transition-all placeholder:text-gray-400 shadow-payroll-xs"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Unique internal slug used for isolated PostgreSQL database naming: <code className="text-payroll-primary font-mono font-bold">pay_t_{slug || "slug"}</code>
              </p>
            </div>

            {/* Contact Email & Contact Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Contact Email (Initial Administrator) <span className="text-rose-500">*</span>
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
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary transition-all placeholder:text-gray-400 shadow-payroll-xs"
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
                  <p className="text-[11px] text-rose-600 font-semibold">{phoneError}</p>
                )}
              </div>
            </div>

            {/* Industry / Organization Sector */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Organization Industry Sector <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-gray-500">
                  Pre-configures tenant Shreni / Hierarchy tiers
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.keys(INDUSTRY_SECTORS) as IndustrySectorKey[]).map((key) => {
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
                })}
              </div>
            </div>

            {/* Internal Onboarding Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Internal Onboarding Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enterprise client plan details, custom requirements, contract SLA notes..."
                className="w-full p-3 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary transition-all placeholder:text-gray-400 resize-none shadow-payroll-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-payroll-light/60 flex items-center justify-end gap-2.5">
              <Link href="/platform/companies">
                <Button variant="outline" size="sm" className="text-xs font-semibold">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

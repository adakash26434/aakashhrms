"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Save,
  FileText,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Shield,
  Lock,
  Clock,
  AlertCircle,
  XCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  X,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { INDUSTRY_SECTORS, type IndustrySectorKey } from "@/lib/constants/industry-types";
import type { CompanyProfileSetupData } from "@/lib/types/company-setup";
import type { Tier1CompanyValues } from "@/lib/platform/company-resolver";
import {
  saveCompanyProfileAction,
  submitCompanyChangeRequestAction,
  cancelCompanyChangeRequestAction,
  getCompanyChangeRequestStatusAction,
} from "@/app/actions/company-setup.actions";

interface CompanyProfileTabProps {
  profile: CompanyProfileSetupData;
  onProfileChange: (profile: CompanyProfileSetupData) => void;
}

export function CompanyProfileTab({ profile, onProfileChange }: CompanyProfileTabProps) {
  const toast = useToast();
  const [formData, setFormData] = useState<CompanyProfileSetupData>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Change request state
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);

  // Modal form state
  const [proposedValues, setProposedValues] = useState<Tier1CompanyValues>({
    legalName: profile.legalName || "",
    panVatNumber: profile.panVatNumber || "",
    registrationNumber: profile.registrationNumber || "",
    industryType: profile.industryType || "General",
    headOfficeAddress: profile.headOfficeAddress || "",
  });
  const [requestReason, setRequestReason] = useState("");
  const [documentReference, setDocumentReference] = useState("");

  // Load active change request status on mount
  useEffect(() => {
    async function loadStatus() {
      setIsLoadingRequest(true);
      try {
        const res = await getCompanyChangeRequestStatusAction();
        if (res.success && res.data) {
          setActiveRequest(res.data);
        } else {
          setActiveRequest(null);
        }
      } catch (err) {
        console.warn("Failed to check change request status:", err);
      } finally {
        setIsLoadingRequest(false);
      }
    }
    loadStatus();
  }, []);

  // Save Tier 2 self-service changes
  async function handleSaveTier2(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await saveCompanyProfileAction(formData);
      if (res.success) {
        onProfileChange(formData);
        toast.success("Company profile information updated successfully.");
        setHasChanges(false);
      } else {
        toast.error(res.error || "Failed to update profile.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving profile";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  // Submit Tier 1 verification request
  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!proposedValues.legalName.trim()) {
      toast.error("Legal Name is required.");
      return;
    }
    if (!requestReason.trim() || requestReason.trim().length < 8) {
      toast.error("Please provide a descriptive reason for this change (at least 8 characters).");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const res = await submitCompanyChangeRequestAction({
        proposedValues,
        reason: requestReason,
        documentReference,
      });

      if (res.success && res.data) {
        setActiveRequest(res.data);
        toast.success("Verification request submitted successfully to Super Admin.");
        setIsModalOpen(false);
        setRequestReason("");
        setDocumentReference("");
      } else {
        toast.error(res.error || "Failed to submit change request.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error submitting request";
      toast.error(msg);
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  // Cancel pending request
  async function handleCancelRequest() {
    if (!activeRequest?.id) return;
    if (!confirm("Are you sure you want to cancel this pending verification request?")) return;

    setIsCancellingRequest(true);
    try {
      const res = await cancelCompanyChangeRequestAction(activeRequest.id);
      if (res.success) {
        toast.success("Change request cancelled.");
        setActiveRequest(null);
      } else {
        toast.error(res.error || "Failed to cancel request.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cancelling request";
      toast.error(msg);
    } finally {
      setIsCancellingRequest(false);
    }
  }

  return (
    <div className="space-y-6 animate-[fadeIn_200ms_ease-out]">
      {/* ── Pending Request Notification Banner ── */}
      {activeRequest && activeRequest.status === "PENDING" && (
        <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 via-amber-50/70 to-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <Clock className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-amber-950">
                    Statutory Data Change Request Pending Verification
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    Awaiting Super Admin Review
                  </span>
                </div>
                <p className="mt-1 text-xs text-amber-900/80 max-w-2xl">
                  A verification request was submitted by{" "}
                  <strong className="text-amber-950 font-semibold">{activeRequest.requestedByUserEmail}</strong> on{" "}
                  {new Date(activeRequest.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  . To protect tax filings and regulatory records, current legal values remain active until reviewed.
                </p>
                <div className="mt-2 text-xs text-amber-800/90 font-medium">
                  <strong>Reason:</strong> {activeRequest.reason}
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCancellingRequest}
              onClick={handleCancelRequest}
              className="text-xs font-semibold border-amber-300 text-amber-900 hover:bg-amber-100/60 cursor-pointer self-start sm:self-center"
            >
              {isCancellingRequest ? "Cancelling..." : "Cancel Request"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Rejection Notice Banner ── */}
      {activeRequest && activeRequest.status === "REJECTED" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
              <XCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-rose-950">
                  Previous Change Request Was Not Approved
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveRequest(null)}
                  className="text-rose-500 hover:text-rose-700 text-xs font-medium cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <p className="mt-1 text-xs text-rose-900/90 max-w-2xl">
                {activeRequest.rejectionReason || "The submitted documentation or changes could not be verified by the platform Super Administrator."}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProposedValues({
                      legalName: profile.legalName || "",
                      panVatNumber: profile.panVatNumber || "",
                      registrationNumber: profile.registrationNumber || "",
                      industryType: profile.industryType || "General",
                      headOfficeAddress: profile.headOfficeAddress || "",
                    });
                    setIsModalOpen(true);
                  }}
                  className="text-xs font-semibold border-rose-300 text-rose-800 hover:bg-rose-100"
                >
                  Submit Revised Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Header Banner ── */}
      <div className="rounded-2xl border border-teal-100 bg-linear-to-r from-teal-50/80 via-white to-teal-50/40 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Company Profile & Organizational Identity (संस्थाको विवरण)
              </h3>
              <p className="mt-1 text-xs text-slate-600 max-w-2xl">
                Maintain legal registration details, PAN/VAT identifiers, corporate contact points, and authorized report signatories.
                Statutory legal credentials require Super Admin verification, while operational trade details are self-service.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSaveTier2}
            disabled={isSaving || !hasChanges}
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white cursor-pointer shadow-sm text-xs font-semibold self-start sm:self-center"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Save Profile Details"}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Tier 1: Core Legal Registration (Locked / Requires Verification) ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Legal & Statutory Identifiers
              </h4>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              <Lock className="w-2.5 h-2.5 text-slate-500" />
              Verified / Locked
            </span>
          </div>

          <div className="rounded-lg bg-slate-50/80 border border-slate-200/60 p-3 text-[11px] text-slate-600 leading-relaxed">
            These statutory credentials appear on official IRD tax certificates, payslips, and compliance reports.
            Direct changes are locked to prevent record mismatches.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Legal Registered Name (कानूनी दर्ता नाम)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.legalName}
                readOnly
                disabled
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100/70 px-3 text-xs font-semibold text-slate-800 cursor-not-allowed"
              />
              <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PAN / VAT Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.panVatNumber || "Not Specified"}
                  readOnly
                  disabled
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100/70 px-3 font-mono text-xs text-slate-800 cursor-not-allowed"
                />
                <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registration No.
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.registrationNumber || "Not Specified"}
                  readOnly
                  disabled
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100/70 px-3 font-mono text-xs text-slate-800 cursor-not-allowed"
                />
                <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Industry Sector Classification
            </label>
            <div className="relative">
              <input
                type="text"
                value={
                  INDUSTRY_SECTORS[formData.industryType as IndustrySectorKey]
                    ? `${INDUSTRY_SECTORS[formData.industryType as IndustrySectorKey].label} (${INDUSTRY_SECTORS[formData.industryType as IndustrySectorKey].labelNepali})`
                    : formData.industryType || "General"
                }
                readOnly
                disabled
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100/70 px-3 text-xs text-slate-800 cursor-not-allowed"
              />
              <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registered Head Office Address
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.headOfficeAddress || "Not Specified"}
                readOnly
                disabled
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100/70 px-3 text-xs text-slate-800 cursor-not-allowed"
              />
              <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProposedValues({
                  legalName: formData.legalName || "",
                  panVatNumber: formData.panVatNumber || "",
                  registrationNumber: formData.registrationNumber || "",
                  industryType: formData.industryType || "General",
                  headOfficeAddress: formData.headOfficeAddress || "",
                });
                setIsModalOpen(true);
              }}
              disabled={activeRequest?.status === "PENDING"}
              className="w-full gap-2 text-xs font-semibold border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800 cursor-pointer shadow-2xs"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>
                {activeRequest?.status === "PENDING"
                  ? "Change Request In Progress"
                  : "Request Legal Data Update"}
              </span>
            </Button>
          </div>
        </div>

        {/* ── Tier 2: Official Contact & Trade Identity (Self-Service) ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-teal-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Trade Identity & Contacts (Self-Service)
              </h4>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
              Directly Editable
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Display / Brand Name (ट्रेड वा ब्राण्ड नाम)
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => {
                setFormData({ ...formData, displayName: e.target.value });
                setHasChanges(true);
              }}
              placeholder="e.g. Acme Tech Solutions"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Contact Email
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => {
                  setFormData({ ...formData, contactEmail: e.target.value });
                  setHasChanges(true);
                }}
                placeholder="info@company.com"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Contact Phone
              </label>
              <input
                type="text"
                value={formData.contactPhone}
                onChange={(e) => {
                  setFormData({ ...formData, contactPhone: e.target.value });
                  setHasChanges(true);
                }}
                placeholder="+977-1-4XXXXXX"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Signatory 1 (Prepared / Checked)
              </label>
              <input
                type="text"
                placeholder="Full Name"
                value={formData.signatory1Name || ""}
                onChange={(e) => {
                  setFormData({ ...formData, signatory1Name: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
              <input
                type="text"
                placeholder="Designation / Title (e.g. HR Officer)"
                value={formData.signatory1Title || ""}
                onChange={(e) => {
                  setFormData({ ...formData, signatory1Title: e.target.value });
                  setHasChanges(true);
                }}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Signatory 2 (Approved By)
              </label>
              <input
                type="text"
                placeholder="Full Name"
                value={formData.signatory2Name || ""}
                onChange={(e) => {
                  setFormData({ ...formData, signatory2Name: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
              <input
                type="text"
                placeholder="Designation / Title (e.g. Finance Director)"
                value={formData.signatory2Title || ""}
                onChange={(e) => {
                  setFormData({ ...formData, signatory2Title: e.target.value });
                  setHasChanges(true);
                }}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Request Legal Data Update Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-[fadeIn_150ms_ease-out]">
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Request Statutory Data Amendment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    A formal verification request will be sent to the platform Super Administrator.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                Please verify that the proposed values match your government registration certificates (e.g., Office of the Company Registrar, IRD PAN certificate).
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proposed Legal Registered Name *
                </label>
                <input
                  type="text"
                  value={proposedValues.legalName}
                  onChange={(e) =>
                    setProposedValues({ ...proposedValues, legalName: e.target.value })
                  }
                  required
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proposed PAN / VAT Number
                  </label>
                  <input
                    type="text"
                    value={proposedValues.panVatNumber}
                    onChange={(e) =>
                      setProposedValues({ ...proposedValues, panVatNumber: e.target.value })
                    }
                    placeholder="9-digit PAN"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proposed Registration Number
                  </label>
                  <input
                    type="text"
                    value={proposedValues.registrationNumber}
                    onChange={(e) =>
                      setProposedValues({ ...proposedValues, registrationNumber: e.target.value })
                    }
                    placeholder="e.g. 12345/080/081"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proposed Industry Classification
                </label>
                <select
                  value={proposedValues.industryType}
                  onChange={(e) =>
                    setProposedValues({ ...proposedValues, industryType: e.target.value })
                  }
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                >
                  {Object.keys(INDUSTRY_SECTORS).map((key) => {
                    const sec = INDUSTRY_SECTORS[key as IndustrySectorKey];
                    return (
                      <option key={key} value={key}>
                        {sec.label} ({sec.labelNepali})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proposed Registered Office Address
                </label>
                <input
                  type="text"
                  value={proposedValues.headOfficeAddress}
                  onChange={(e) =>
                    setProposedValues({ ...proposedValues, headOfficeAddress: e.target.value })
                  }
                  placeholder="e.g. Ward 4, Baluwatar, Kathmandu"
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Amendment (संशोधनको कारण) *
                </label>
                <textarea
                  rows={3}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="e.g. Legal company name amendment registered at Company Registrar Office on 2081-05-12..."
                  required
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Required. Explain why this statutory information is being amended.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supporting Document Reference / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={documentReference}
                  onChange={(e) => setDocumentReference(e.target.value)}
                  placeholder="e.g. OCR Document Ref # 99214 or IRD verification code"
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingRequest}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSubmittingRequest ? "Submitting..." : "Submit Verification Request"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

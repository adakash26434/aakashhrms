"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  CheckCircle2,
  Lock,
  Clock,
  XCircle,
  X,
  FileCheck,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { INDUSTRY_SECTORS, type IndustrySectorKey } from "@/lib/constants/industry-types";
import type { CompanyProfileSetupData } from "@/lib/types/company-setup";
import type { Tier1CompanyValues } from "@/lib/platform/company-resolver";
import {
  saveCompanyProfileAction,
  submitCompanyChangeRequestAction,
  cancelCompanyChangeRequestAction,
  getCompanyChangeRequestStatusAction,
} from "@/app/actions/company-setup.actions";

interface CompanyChangeRequestRecord {
  id: string;
  companyId: string;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string;
  status: string;
  currentValues?: unknown;
  proposedValues?: unknown;
  reason?: string;
  documentReference?: string | null;
  reviewedByPlatformUserId?: string | null;
  reviewedAt?: Date | string | null;
  rejectionReason?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

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
  const [activeRequest, setActiveRequest] = useState<CompanyChangeRequestRecord | null>(null);
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
      try {
        const res = await getCompanyChangeRequestStatusAction();
        if (res.success && res.data) {
          setActiveRequest(res.data);
        } else {
          setActiveRequest(null);
        }
      } catch (err) {
        console.warn("Failed to check change request status:", err);
      }
    }
    loadStatus();
  }, []);

  // Save Tier 2 self-service changes
  async function handleSaveTier2() {
    setIsSaving(true);
    try {
      const res = await saveCompanyProfileAction(formData);

      if (res.success) {
        onProfileChange(formData);
        toast.success("Profile changes saved.");
        setHasChanges(false);
      } else {
        toast.error(res.error || "Failed to save profile.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving profile";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  // Submit formal statutory change request
  async function handleSubmitRequest(e?: React.FormEvent) {
    if (e?.preventDefault) e.preventDefault();
    if (!requestReason.trim()) {
      toast.error("Please provide a business justification for this change request.");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const res = await submitCompanyChangeRequestAction({
        proposedValues,
        reason: requestReason.trim(),
        documentReference: documentReference.trim() || undefined,
      });

      if (res.success && res.data) {
        setActiveRequest(res.data);
        toast.success("Change request submitted for verification.");
        setIsModalOpen(false);
      } else {
        toast.error(res.error || "Failed to submit request.");
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
    if (!activeRequest) return;
    setIsCancellingRequest(true);
    try {
      const res = await cancelCompanyChangeRequestAction(activeRequest.id);
      if (res.success) {
        setActiveRequest(null);
        toast.success("Change request cancelled.");
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
    <div className="space-y-8 animate-[fadeIn_150ms_ease-out]">
      {/* Pending Request Banner */}
      {activeRequest && activeRequest.status === "PENDING" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-amber-800 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-amber-950">
                    Statutory change request pending verification
                  </h4>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-amber-100 text-amber-900">
                    Awaiting Super Admin review
                  </span>
                </div>
                <p className="text-xs text-amber-900/80 leading-relaxed max-w-2xl">
                  Submitted by {activeRequest.requestedByUserEmail} on{" "}
                  {activeRequest.createdAt
                    ? new Date(activeRequest.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Recently"}
                  . Current legal credentials remain active until reviewed.
                </p>
                {activeRequest.reason && (
                  <p className="text-xs text-amber-900 font-medium pt-0.5">
                    Reason: {activeRequest.reason}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCancellingRequest}
              onClick={handleCancelRequest}
              className="text-xs font-medium border-amber-300 bg-white text-amber-900 hover:bg-amber-100/60 cursor-pointer self-start sm:self-center shrink-0"
            >
              {isCancellingRequest ? "Cancelling..." : "Cancel request"}
            </Button>
          </div>
        </div>
      )}

      {/* Rejection Notice Banner */}
      {activeRequest && activeRequest.status === "REJECTED" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-4 w-4 text-rose-800 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-rose-950">
                  Previous statutory change request was not approved
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveRequest(null)}
                  className="text-rose-600 hover:text-rose-950 text-xs font-medium cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-xs text-rose-900/90 leading-relaxed max-w-2xl">
                {activeRequest.rejectionReason ||
                  "The submitted documentation or corporate certificates could not be verified by platform administration."}
              </p>
              <div>
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
                  className="text-xs font-medium border-rose-300 bg-white text-rose-900 hover:bg-rose-100"
                >
                  Submit revised request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header & Save Action */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-5 border-b border-slate-200/80">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Company profile
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
            Statutory credentials, operating contact information, and authorized report signatories.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSaveTier2}
          disabled={isSaving || !hasChanges}
          className="bg-payroll-primary hover:bg-payroll-primary-hover text-white cursor-pointer shadow-xs text-xs font-medium h-9 px-4 rounded-lg self-start sm:self-auto shrink-0 transition-colors"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          <span>{isSaving ? "Saving..." : "Save changes"}</span>
        </Button>
      </div>

      {/* Section 1: Statutory & Legal Identity (Locked) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Legal registration
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Statutory credentials tied to official IRD tax certificates and regulatory payslips.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <Lock className="w-3 h-3 text-slate-400" />
              Statutory record • Locked
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              className="text-xs font-medium border-slate-300 text-slate-700 hover:bg-slate-50 h-7.5 px-2.5"
            >
              Request update
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          <div className="sm:col-span-2 space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Legal registered name
            </label>
            <input
              type="text"
              value={formData.legalName}
              readOnly
              disabled
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Industry classification
            </label>
            <input
              type="text"
              value={
                INDUSTRY_SECTORS[formData.industryType as IndustrySectorKey]
                  ? INDUSTRY_SECTORS[formData.industryType as IndustrySectorKey].label
                  : formData.industryType || "General"
              }
              readOnly
              disabled
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              PAN / VAT number
            </label>
            <input
              type="text"
              value={formData.panVatNumber || "Not Specified"}
              readOnly
              disabled
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Registration number
            </label>
            <input
              type="text"
              value={formData.registrationNumber || "Not Specified"}
              readOnly
              disabled
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900 cursor-not-allowed"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-1 space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Registered head office
            </label>
            <input
              type="text"
              value={formData.headOfficeAddress || "Not Specified"}
              readOnly
              disabled
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 cursor-not-allowed"
            />
          </div>
        </div>
      </section>

      {/* Structural Divider */}
      <hr className="border-slate-200/80" />

      {/* Section 2: Operational & Trade Identity (Self-Service) */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Operational identity
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Public trade name, corporate communication points, and primary liaison details.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Display or trade name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => {
                setFormData({ ...formData, displayName: e.target.value });
                setHasChanges(true);
              }}
              placeholder="e.g. Acme Tech Solutions"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Official contact email
            </label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => {
                setFormData({ ...formData, contactEmail: e.target.value });
                setHasChanges(true);
              }}
              placeholder="info@company.com"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Official contact phone
            </label>
            <input
              type="tel"
              value={formData.contactPhone}
              onChange={(e) => {
                setFormData({ ...formData, contactPhone: e.target.value });
                setHasChanges(true);
              }}
              placeholder="+977-1-4XXXXXX"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Company logo URL (Optional)
            </label>
            <input
              type="url"
              value={formData.logoUrl || ""}
              onChange={(e) => {
                setFormData({ ...formData, logoUrl: e.target.value });
                setHasChanges(true);
              }}
              placeholder="https://example.com/logo.png"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
            />
          </div>
        </div>
      </section>

      {/* Structural Divider */}
      <hr className="border-slate-200/80" />

      {/* Section 3: Official Report Signatories */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Report signatories
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Names and designations displayed on generated salary sheets, tax schedules, and statutory exports.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <FileCheck className="h-4 w-4 text-emerald-800" />
              <span>Primary signatory (Prepared / Verified by)</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Full name
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Shrestha"
                value={formData.signatory1Name || ""}
                onChange={(e) => {
                  setFormData({ ...formData, signatory1Name: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Designation or title
              </label>
              <input
                type="text"
                placeholder="e.g. Senior Payroll Accountant"
                value={formData.signatory1Title || ""}
                onChange={(e) => {
                  setFormData({ ...formData, signatory1Title: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-payroll-primary" />
              <span>Secondary signatory (Authorized / Approved by)</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Full name
              </label>
              <input
                type="text"
                placeholder="e.g. Sita Sharma"
                value={formData.signatory2Name || ""}
                onChange={(e) => {
                  setFormData({ ...formData, signatory2Name: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Designation or title
              </label>
              <input
                type="text"
                placeholder="e.g. Chief Executive Officer"
                value={formData.signatory2Title || ""}
                onChange={(e) => {
                  setFormData({ ...formData, signatory2Title: e.target.value });
                  setHasChanges(true);
                }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Request Statutory Data Update Modal */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Request Statutory Data Amendment"
        description="Formal update review submitted to platform administration for verification."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-xs font-medium rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleSubmitRequest()}
              disabled={isSubmittingRequest}
              className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-xs shadow-none cursor-pointer"
            >
              {isSubmittingRequest ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 leading-relaxed font-medium">
            Ensure proposed values match official documents registered with the Office of the Company Registrar (OCR) and Inland Revenue Department (IRD).
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">
              Proposed Legal Registered Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={proposedValues.legalName}
              onChange={(e) =>
                setProposedValues({ ...proposedValues, legalName: e.target.value })
              }
              required
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Proposed PAN / VAT
              </label>
              <input
                type="text"
                value={proposedValues.panVatNumber}
                onChange={(e) =>
                  setProposedValues({ ...proposedValues, panVatNumber: e.target.value })
                }
                className="w-full rounded-md border border-zinc-200 bg-white font-mono px-3 py-2 text-xs text-zinc-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Proposed Registration No.
              </label>
              <input
                type="text"
                value={proposedValues.registrationNumber}
                onChange={(e) =>
                  setProposedValues({ ...proposedValues, registrationNumber: e.target.value })
                }
                className="w-full rounded-md border border-zinc-200 bg-white font-mono px-3 py-2 text-xs text-zinc-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">
              Proposed Industry Classification
            </label>
            <select
              value={proposedValues.industryType}
              onChange={(e) =>
                setProposedValues({ ...proposedValues, industryType: e.target.value })
              }
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-none"
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

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">
              Proposed Registered Address
            </label>
            <input
              type="text"
              value={proposedValues.headOfficeAddress}
              onChange={(e) =>
                setProposedValues({ ...proposedValues, headOfficeAddress: e.target.value })
              }
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">
              Reason for Amendment <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Explain why this statutory information is changing (e.g. Legal renaming approved by Company Registrar, PAN address transfer)."
              required
              className="w-full rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-none resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">
              Supporting Document Reference
            </label>
            <input
              type="text"
              value={documentReference}
              onChange={(e) => setDocumentReference(e.target.value)}
              placeholder="e.g. OCR Certificate Dispatch No. 2081/82-014"
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-none"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

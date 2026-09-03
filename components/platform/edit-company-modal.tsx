"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Mail,
  Building,
  Phone,
  AlertCircle,
  CheckCircle2,
  Shield,
} from "lucide-react";
import {
  INDUSTRY_SECTORS,
  IndustrySectorKey,
} from "@/lib/constants/industry-types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface EditCompanyModalProps {
  company: {
    id: string;
    companyCode: string;
    displayName: string;
    legalName: string;
    contactEmail: string;
    contactPhone?: string | null;
    industryType?: string | null;
    notes?: string | null;
  };
}

export function EditCompanyModal({ company }: EditCompanyModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(company.displayName);
  const [legalName, setLegalName] = useState(company.legalName);
  const [contactEmail, setContactEmail] = useState(company.contactEmail);
  const [contactPhone, setContactPhone] = useState(company.contactPhone || "");
  const [industryType, setIndustryType] = useState<IndustrySectorKey>(
    (company.industryType as IndustrySectorKey) || "General"
  );
  const [notes, setNotes] = useState(company.notes || "");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const handleOpen = () => {
    setDisplayName(company.displayName);
    setLegalName(company.legalName);
    setContactEmail(company.contactEmail);
    setContactPhone(company.contactPhone || "");
    setIndustryType((company.industryType as IndustrySectorKey) || "General");
    setNotes(company.notes || "");
    setError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSaving) return;
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!contactEmail.trim()) {
      setError("Contact Email (Company Admin email) is required.");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch(`/api/platform/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          legalName: legalName.trim(),
          contactEmail: contactEmail.trim().toLowerCase(),
          contactPhone: contactPhone.trim() || null,
          industryType,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update company details.");
      }

      toast.success("Company details and admin credentials updated successfully!");
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="text-xs font-bold shadow-payroll-xs"
      >
        <Edit3 className="w-3.5 h-3.5 mr-1.5 text-payroll-primary" />
        <span>Edit Company Details</span>
      </Button>

      <Dialog
        open={isOpen}
        onClose={handleClose}
        title="Edit Company Details"
        description={`Update registry metadata and administrator contact for ${company.companyCode}.`}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isSaving}
              disabled={isSaving}
              className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm"
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Company Admin Email - Super Admin Controlled */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Company Admin Email <span className="text-rose-500">*</span>
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <Shield className="w-2.5 h-2.5" /> Super Admin Authority
              </span>
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="admin@company.com"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary text-payroll-navy font-medium shadow-payroll-xs"
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Changing this email updates both the Platform Registry and the tenant&apos;s primary Administrator account.
            </p>
          </div>

          {/* Display Name & Legal Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Display Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary text-payroll-navy shadow-payroll-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Legal Entity Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Acme Corporation Pvt. Ltd."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary text-payroll-navy shadow-payroll-xs"
              />
            </div>
          </div>

          {/* Contact Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+977-1-4XXXXXX"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary text-payroll-navy shadow-payroll-xs"
              />
            </div>
          </div>

          {/* Organization Industry Sector (Super Admin exclusive) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Organization Industry Sector (संस्थाको क्षेत्र)
              </label>
              <span className="text-[10px] text-payroll-primary font-semibold">
                Super Admin Exclusive
              </span>
            </div>
            <select
              value={industryType}
              onChange={(e) => setIndustryType(e.target.value as IndustrySectorKey)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary text-payroll-navy shadow-payroll-xs"
            >
              {(Object.keys(INDUSTRY_SECTORS) as IndustrySectorKey[]).map((key) => {
                const sec = INDUSTRY_SECTORS[key];
                return (
                  <option key={key} value={key}>
                    {sec.label} — {sec.labelNepali}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-gray-500">
              Changes the active Shreni / Hierarchy level structure across the tenant workspace.
            </p>
          </div>

          {/* Super Admin Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Super Admin Notes (Internal)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional internal notes about this company..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary text-payroll-navy resize-none shadow-payroll-xs"
            />
          </div>
        </form>
      </Dialog>
    </>
  );
}

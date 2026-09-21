"use client";

import { useEffect, useRef } from "react";
import { Printer, Download, X, FileText, CheckCircle2, Users, User } from "lucide-react";
import { useWorkspaceContext } from "@/lib/contexts/workspace-context";
import type { CompanyReportInfo } from "@/lib/types/report";

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  onPrint: () => void;
  onExport: () => void;
  isExporting?: boolean;
  isSingleEmployee?: boolean;
  onPrintSummary?: () => void;
  onPrintIndividualSlips?: () => void;
  metaDetails?: { label: string; value: string }[];
  company?: CompanyReportInfo;
  children: React.ReactNode;
}

export function ReportPreviewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  onPrint,
  onExport,
  isExporting = false,
  isSingleEmployee = false,
  onPrintSummary,
  onPrintIndividualSlips,
  metaDetails = [],
  company,
  children,
}: ReportPreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const workspaceCtx = useWorkspaceContext();

  const activeCompany = company || workspaceCtx?.company;
  const companyLegalName =
    activeCompany?.legalName ||
    activeCompany?.displayName ||
    activeCompany?.name ||
    "COMPANY WORKSPACE";

  const companySubline = [
    activeCompany?.headOfficeAddress,
    activeCompany?.panVatNumber ? `Tax Reg / PAN: ${activeCompany.panVatNumber}` : null,
    activeCompany?.contactPhone ? `Phone: ${activeCompany.contactPhone}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrintModal = () => {
    if (onPrintSummary) {
      onPrintSummary();
    } else {
      onPrint();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-payroll-navy/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-fadeIn print:p-0 print:bg-white print:static">
      <div
        ref={modalRef}
        className="relative flex flex-col w-full max-w-6xl max-h-[92vh] bg-white rounded-2xl shadow-payroll-md border border-payroll-light overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none"
      >
        {/* Modal Top Control Bar (Hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-payroll-light bg-payroll-cream px-6 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-payroll-primary text-white shadow-payroll-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-payroll-navy">{title} — Document Preview</h2>
                {isSingleEmployee ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-payroll-primary">
                    <User className="h-3 w-3" /> Single Employee Mode
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-payroll-light/60 border border-payroll-light px-2.5 py-0.5 text-[10px] font-bold text-payroll-navy">
                    <Users className="h-3 w-3" /> Multi-Employee Batch Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{subtitle || "Official Enterprise Report Document View"}</p>
            </div>
          </div>

          {/* Action Buttons inside Preview */}
          <div className="flex flex-wrap items-center gap-2">
            {isSingleEmployee ? (
              <button
                type="button"
                onClick={handlePrintModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-payroll-navy"
                title="Print this single employee report"
              >
                <Printer className="h-4 w-4" />
                Print Employee Report
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePrintModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-payroll-navy"
                  title="Print summary sheet combining all shown employees"
                >
                  <Printer className="h-4 w-4" />
                  Print Summary Sheet (All)
                </button>

                {onPrintIndividualSlips && (
                  <button
                    type="button"
                    onClick={onPrintIndividualSlips}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-800"
                    title="Print detailed report/slip for each employee page-by-page"
                  >
                    <User className="h-4 w-4" />
                    Print Individual Slips (One by One)
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-light bg-white px-3.5 py-2 text-xs font-bold text-payroll-navy shadow-xs transition-all hover:bg-payroll-light/30 disabled:opacity-50"
              title="Export report CSV data"
            >
              <Download className="h-4 w-4 text-payroll-primary" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>

            <div className="h-5 w-px bg-payroll-light mx-1" />

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-payroll-light bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
              title="Cancel and close preview"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>

        {/* Modal Scrollable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-white print:p-0 print:overflow-visible">
          {/* Corporate Header Letterhead */}
          <div className="border-b-2 border-payroll-navy pb-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-black tracking-tight text-payroll-navy uppercase">
                  {companyLegalName}
                </h1>
                <p className="text-xs font-semibold text-payroll-primary">
                  Government of Nepal IRD & Labour Act Compliant Reporting
                </p>
                {companySubline ? (
                  <p className="text-[11px] text-gray-500">
                    {companySubline}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    Nepal Labour Act 2074 & IRD Standard Statement
                  </p>
                )}
              </div>

              <div className="text-right text-xs space-y-0.5">
                <div className="font-extrabold text-payroll-navy uppercase text-sm">{title}</div>
                <div className="text-gray-500 text-[11px]">
                  Generated: <span className="font-semibold text-gray-700">{new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> OFFICIAL VERIFIED STATEMENT
                </div>
              </div>
            </div>

            {/* Filter / Scope Metadata */}
            {metaDetails.length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-payroll-cream p-2.5 border border-payroll-light text-xs text-gray-600 print:bg-gray-50">
                {metaDetails.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-500">{m.label}:</span>
                    <span className="font-bold text-payroll-navy">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actual Report Document Content */}
          <div className="space-y-6">
            {children}
          </div>

          {/* Formal Footer & Signatures Block */}
          <div className="pt-8 border-t border-payroll-light mt-10 space-y-8">
            <div className="grid grid-cols-3 gap-8 text-center text-xs">
              <div className="space-y-12">
                <div className="h-10 border-b border-dashed border-gray-400" />
                <div>
                  <p className="font-bold text-payroll-navy">Prepared By</p>
                  <p className="text-[10px] text-gray-500">Payroll / HR Officer</p>
                </div>
              </div>

              <div className="space-y-12">
                <div className="h-10 border-b border-dashed border-gray-400" />
                <div>
                  <p className="font-bold text-payroll-navy">Verified & Checked By</p>
                  <p className="text-[10px] text-gray-500">Finance Auditor</p>
                </div>
              </div>

              <div className="space-y-12">
                <div className="h-10 border-b border-dashed border-gray-400" />
                <div>
                  <p className="font-bold text-payroll-navy">Approved & Authorized By</p>
                  <p className="text-[10px] text-gray-500">Head of Finance / Admin (Seal)</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-3">
              <span>Confidential — Internal Company Record</span>
              <span>Page 1 of 1</span>
              <span>Generated for {companyLegalName}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Hidden when printing) */}
        <div className="flex items-center justify-between border-t border-payroll-light bg-payroll-cream px-6 py-3 text-xs text-gray-500 print:hidden">
          <span>Press ESC or click Cancel to close preview</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-payroll-light bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel / Close
            </button>
            <button
              type="button"
              onClick={handlePrintModal}
              className="rounded-lg bg-payroll-primary px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-payroll-navy"
            >
              Print Document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

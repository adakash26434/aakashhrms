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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-fadeIn print:p-0 print:bg-white print:static">
      <div
        ref={modalRef}
        className="relative flex flex-col w-full max-w-6xl max-h-[92vh] bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none"
      >
        {/* Modal Top Control Bar (Hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-300 bg-white px-6 py-3.5 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-zinc-100 text-zinc-700">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">{title} — Document preview</h2>
                {isSingleEmployee ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-2xs font-medium text-zinc-700">
                    <User className="h-3 w-3 text-zinc-500" /> Single employee mode
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-2xs font-medium text-zinc-700">
                    <Users className="h-3 w-3 text-zinc-500" /> Multi-employee batch mode
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">{subtitle || "Official Enterprise Report Document View"}</p>
            </div>
          </div>

          {/* Action Buttons inside Preview */}
          <div className="flex flex-wrap items-center gap-2">
            {isSingleEmployee ? (
              <button
                type="button"
                onClick={handlePrintModal}
                className="inline-flex items-center gap-1.5 rounded-md bg-payroll-primary hover:bg-payroll-primary-hover px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-payroll-primary/10 transition-colors"
                title="Print this single employee report"
              >
                <Printer className="h-3.5 w-3.5" />
                Print employee report
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePrintModal}
                  className="inline-flex items-center gap-1.5 rounded-md bg-payroll-primary hover:bg-payroll-primary-hover px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-payroll-primary/10 transition-colors"
                  title="Print summary sheet combining all shown employees"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print summary sheet
                </button>

                {onPrintIndividualSlips && (
                  <button
                    type="button"
                    onClick={onPrintIndividualSlips}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs transition-colors hover:bg-zinc-50"
                    title="Print detailed report/slip for each employee page-by-page"
                  >
                    <User className="h-3.5 w-3.5 text-zinc-500" />
                    Print individual slips
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs transition-colors hover:bg-zinc-50 disabled:opacity-50"
              title="Export report CSV data"
            >
              <Download className="h-3.5 w-3.5 text-zinc-500" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>

            <div className="h-4 w-px bg-zinc-200 mx-1" />

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              title="Cancel and close preview"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>

        {/* Modal Scrollable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-white print:p-0 print:overflow-visible">
          {/* Corporate Header Letterhead — hidden when printing individual slips */}
          <div className="border-b border-zinc-300 pb-5 space-y-3 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-950">
                  {companyLegalName}
                </h1>
                <p className="text-xs font-medium text-emerald-800 mt-0.5">
                  Government of Nepal IRD & Labour Act Compliant Reporting
                </p>
                {companySubline ? (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {companySubline}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Nepal Labour Act 2074 & IRD Standard Statement
                  </p>
                )}
              </div>

              <div className="text-right text-xs space-y-0.5">
                <div className="font-semibold text-zinc-900 text-sm">{title}</div>
                <div className="text-zinc-500 text-xs">
                  Generated: <span className="font-medium text-zinc-700">{new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <div className="inline-flex items-center gap-1 text-2xs text-zinc-600 font-medium pt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> Official verified statement
                </div>
              </div>
            </div>

            {/* Filter / Scope Metadata: Clean Flat Layout */}
            {metaDetails.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-6 py-3 border-t border-b border-zinc-100 text-xs text-zinc-600">
                {metaDetails.map((m, idx) => (
                  <div key={idx}>
                    <span className="text-xs text-zinc-500 block">{m.label}</span>
                    <span className="text-xs font-medium text-zinc-900 block mt-0.5">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actual Report Document Content */}
          <div className="space-y-6 print:space-y-0">
            {children}
          </div>

          {/* Formal Footer & Signatures Block — hidden when printing individual slips */}
          <div className="pt-8 border-t border-zinc-200 mt-10 space-y-8 print:hidden">
            <div className="grid grid-cols-3 gap-8 text-center text-xs">
              <div className="space-y-12">
                <div className="h-10 border-b border-dashed border-zinc-300" />
                <div>
                  <p className="font-semibold text-zinc-900">Prepared By</p>
                  <p className="text-2xs text-zinc-500">Payroll / HR Officer</p>
                </div>
              </div>

              <div className="space-y-12">
                <div className="h-10 border-b border-dashed border-zinc-300" />
                <div>
                  <p className="font-semibold text-zinc-900">Verified & Checked By</p>
                  <p className="text-2xs text-zinc-500">Finance Auditor</p>
                </div>
              </div>

              <div className="space-y-12">
                <div className="h-10 border-b border-dashed border-zinc-300" />
                <div>
                  <p className="font-semibold text-zinc-900">Approved & Authorized By</p>
                  <p className="text-2xs text-zinc-500">Head of Finance / Admin (Seal)</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-2xs text-zinc-400 border-t border-zinc-200 pt-3">
              <span>Confidential — Internal Company Record</span>
              <span>Page 1 of 1</span>
              <span>Generated for {companyLegalName}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Hidden when printing) */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/75 px-6 py-3 text-xs text-zinc-500 print:hidden">
          <span>Press ESC or click Cancel to close preview</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
            >
              Cancel / close
            </button>
            <button
              type="button"
              onClick={handlePrintModal}
              className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-payroll-primary/10 transition-colors"
            >
              Print document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

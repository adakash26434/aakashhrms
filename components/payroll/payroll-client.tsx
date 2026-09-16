"use client";

import { useState } from "react";
import { Plus, List, FileText, ArrowLeft, RefreshCw, AlertCircle, Trash2, AlertTriangle, ClipboardList } from "lucide-react";
import type { PayrollRun, PayrollSlip, PayrollRunSetupPayload, PayrollRunStatus } from "@/lib/types/payroll";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { PayrollTable } from "./payroll-table";
import { PayrollSetupForm } from "./payroll-setup-form";
import { PayrollSummaryCard } from "./payroll-summary-card";
import { PayrollRunPipeline } from "./payroll-run-pipeline";
import { PayrollReviewGrid } from "./payroll-review-grid";
import { BankExportButton } from "./bank-export-button";
import { 
  generatePayrollRunAction, 
  transitionPayrollRunAction, 
  getPayrollRunDetailsAction,
  deletePayrollRunAction
} from "@/app/actions/payroll.actions";
import { useToast } from "@/components/ui/toast";

interface PayrollClientProps {
  initialRuns: PayrollRun[];
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string; employeeCode: string; branchId: string; departmentId: string; designationId: string; category: string }>;
  occasionalAllowances: Array<{ id: string; name: string; isFestivalAllowance: boolean; isRemoteAllowance: boolean }>;
  allPayHeads?: Array<{ id: string; name: string; code: string; type: 'allowance' | 'deduction' }>;
  userRole: string;
}

export default function PayrollClient({
  initialRuns,
  branches,
  departments,
  designations,
  employees,
  occasionalAllowances,
  allPayHeads,
  userRole
}: PayrollClientProps) {
  const toast = useToast();
  const [runs, setRuns] = useState<PayrollRun[]>(initialRuns);
  const [activeTab, setActiveTab] = useState<"list" | "generate">("list");
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [selectedSlips, setSelectedSlips] = useState<PayrollSlip[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscardRun, setConfirmDiscardRun] = useState<PayrollRun | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const handleSelectRun = async (run: PayrollRun) => {
    setError(null);
    setIsLoadingDetails(true);
    try {
      const res = await getPayrollRunDetailsAction(run.id);
      if (!res.success || !res.data) {
        const msg = res.error || "Failed to load payroll run details.";
        setError(msg);
        toast.error(msg);
        return;
      }
      setSelectedRun(res.data.payrollRun);
      setSelectedSlips(res.data.slips);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch payroll slips.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleBackToList = () => {
    setSelectedRun(null);
    setSelectedSlips([]);
    setError(null);
  };

  const handleDeleteRun = async (run: PayrollRun) => {
    setError(null);
    try {
      setIsDiscarding(true);
      const res = await deletePayrollRunAction(run.id);
      if (!res.success) {
        toast.error(res.error || "Failed to cancel payroll run.");
        return;
      }
      toast.success("Payroll run cancelled and reverted to initial state.");
      setRuns(runs.filter(r => r.id !== run.id));
      if (selectedRun?.id === run.id) {
        setSelectedRun(null);
        setSelectedSlips([]);
      }
      setConfirmDiscardRun(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error cancelling run.");
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleRefreshCurrentRun = async () => {
    if (!selectedRun) return;
    try {
      const res = await getPayrollRunDetailsAction(selectedRun.id);
      if (res.success && res.data) {
        setSelectedRun(res.data.payrollRun);
        setSelectedSlips(res.data.slips);
        setRuns(runs.map(r => r.id === selectedRun.id ? res.data!.payrollRun : r));
      }
    } catch (err) {
      console.error("Failed to refresh run details", err);
    }
  };

  const handleGenerateRun = async (payload: PayrollRunSetupPayload) => {
    setError(null);
    setIsGenerating(true);
    try {
      const res = await generatePayrollRunAction(payload);
      if (!res.success || !res.data) {
        const msg = res.error || "Failed to generate payroll run.";
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Payroll run generated successfully!");
      // If recreateIfExists, remove old run with same period and prepend new
      const filtered = runs.filter(
        r => !(r.payPeriodMonth === res.data!.payPeriodMonth && r.payPeriodYear === res.data!.payPeriodYear)
      );
      setRuns([res.data, ...filtered]);
      await handleSelectRun(res.data);
      setActiveTab("list");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Calculation generation error.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStatusChange = async (toStatus: PayrollRunStatus, notes?: string) => {
    if (!selectedRun) return;
    setError(null);

    const res = await transitionPayrollRunAction(selectedRun.id, toStatus, notes);
    if (!res.success || !res.data) {
      const msg = res.error || "Failed to change payroll status.";
      toast.error(msg);
      throw new Error(msg);
    }

    toast.success(`Payroll run transitioned to ${toStatus}.`);
    // Refresh run detail state
    setSelectedRun(res.data);
    
    // Update in history list
    setRuns(runs.map(r => r.id === selectedRun.id ? res.data! : r));
  };

  const getBSMonthName = (m: number) => {
    return BS_MONTHS_EN[m] ?? "Unknown";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-payroll-light pb-4">
        <div>
          <h1 className="text-xl font-bold text-payroll-navy tracking-tight">Monthly Payroll Processing</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Process base salaries, calculate slab-based progressive taxes, apply employee loans and finalize bank payments.
          </p>
        </div>

        {selectedRun ? (
          <div className="flex items-center gap-2">
            {selectedRun.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => handleStatusChange('UNDER_REVIEW')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-payroll-navy transition-all"
              >
                <ClipboardList className="h-4 w-4" />
                Submit for Review
              </button>
            )}
            {selectedRun.status === 'LOCKED' && (
              <BankExportButton 
                runId={selectedRun.id} 
                filename={`Bank_Transfer_${getBSMonthName(selectedRun.payPeriodMonth)}_${selectedRun.payPeriodYear}.csv`} 
              />
            )}
            {selectedRun.status !== 'LOCKED' && (
              <button
                type="button"
                onClick={() => setConfirmDiscardRun(selectedRun)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-red-600 shadow-sm hover:bg-red-100 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                Discard Batch
              </button>
            )}
            <button
              onClick={handleBackToList}
              className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-light bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-payroll-navy shadow-sm hover:bg-payroll-light/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to List
            </button>
          </div>
        ) : (
          <div className="flex rounded-lg border border-payroll-light bg-white p-0.5 shadow-sm">
            <button
              onClick={() => { setActiveTab("list"); setError(null); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "list"
                  ? "bg-payroll-primary text-white shadow-sm"
                  : "text-gray-600 hover:bg-payroll-light/20"
              }`}
            >
              <List className="h-4 w-4" />
              Payroll History
            </button>
            <button
              onClick={() => { setActiveTab("generate"); setError(null); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "generate"
                  ? "bg-payroll-primary text-white shadow-sm"
                  : "text-gray-600 hover:bg-payroll-light/20"
              }`}
            >
              <Plus className="h-4 w-4" />
              Generate Payroll
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {selectedRun ? (
        // Detailed Payroll Batch Review View
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border border-payroll-light bg-white rounded-xl p-5 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-payroll-navy">
                Payroll Batch Details: {getBSMonthName(selectedRun.payPeriodMonth)} {selectedRun.payPeriodYear}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Range: {selectedRun.payPeriodStartDate} to {selectedRun.payPeriodEndDate}
              </p>
            </div>
            <div className="mt-2 md:mt-0 rounded-lg bg-payroll-cream px-3.5 py-1.5 border border-payroll-light text-xs font-semibold text-gray-600">
              Active Role: <span className="text-payroll-primary">{userRole}</span>
            </div>
          </div>

          {/* Run Statistics Summary */}
          <PayrollSummaryCard run={selectedRun} />

          {/* Workflow progress line */}
          <PayrollRunPipeline run={selectedRun} />

          {/* Editable slips table */}
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin text-payroll-primary" />
              <p className="text-xs text-gray-500 mt-2 font-medium">Loading payslips data...</p>
            </div>
          ) : (
            <PayrollReviewGrid
              run={selectedRun}
              initialSlips={selectedSlips}
              onStatusChange={handleStatusChange}
              onDeleteRun={() => handleDeleteRun(selectedRun)}
              onRunUpdated={handleRefreshCurrentRun}
              allPayHeads={allPayHeads}
              userRole={userRole}
            />
          )}
        </div>
      ) : activeTab === "list" ? (
        // Past Runs History
        <PayrollTable 
          runs={runs} 
          onSelect={handleSelectRun} 
          onDelete={handleDeleteRun}
        />
      ) : (
        // Run Calculation Creator Form
        <PayrollSetupForm
          branches={branches}
          departments={departments}
          designations={designations}
          employees={employees}
          occasionalAllowances={occasionalAllowances}
          onSubmit={handleGenerateRun}
          isLoading={isGenerating}
        />
      )}

      {/* Discard Batch Confirmation Modal */}
      {confirmDiscardRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-payroll-light bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-payroll-navy">
                  Discard Entire Payroll Batch?
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Are you sure you want to cancel and delete the payroll batch for{" "}
                  <span className="font-semibold text-gray-800">
                    {getBSMonthName(confirmDiscardRun.payPeriodMonth)} {confirmDiscardRun.payPeriodYear}
                  </span>
                  ?
                </p>
                <div className="mt-2.5 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">
                  This will delete all generated payslips and fallback to the initial un-generated state, allowing you to generate payslips again for this month.
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDiscardRun(null)}
                disabled={isDiscarding}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Batch
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRun(confirmDiscardRun)}
                disabled={isDiscarding}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isDiscarding ? "Discarding..." : "Yes, Discard Batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

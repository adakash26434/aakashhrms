"use client";

import { useState } from "react";
import { Plus, List, FileText, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import type { PayrollRun, PayrollSlip, PayrollRunSetupPayload, PayrollRunStatus } from "@/lib/types/payroll";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { PayrollTable } from "./payroll-table";
import { PayrollSetupForm } from "./payroll-setup-form";
import { PayrollSummaryCard } from "./payroll-summary-card";
import { PayrollRunPipeline } from "./payroll-run-pipeline";
import { PayrollReviewGrid } from "./payroll-review-grid";
import { BankExportButton } from "./bank-export-button";
import { generatePayrollRunAction, transitionPayrollRunAction, getPayrollRunDetailsAction } from "@/app/actions/payroll.actions";
import { useToast } from "@/components/ui/toast";

interface PayrollClientProps {
  initialRuns: PayrollRun[];
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string; employeeCode: string; branchId: string; departmentId: string; designationId: string; category: string }>;
  occasionalAllowances: Array<{ id: string; name: string; isFestivalAllowance: boolean; isRemoteAllowance: boolean }>;
  userRole: string;
}

export default function PayrollClient({
  initialRuns,
  branches,
  departments,
  designations,
  employees,
  occasionalAllowances,
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
      // Add to list and select it
      setRuns([res.data, ...runs]);
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
      <div className="flex items-center justify-between border-b border-[#d7e8d0] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#1b3a1f] tracking-tight">Monthly Payroll Processing</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Process base salaries, calculate slab-based progressive taxes, apply employee loans and finalize bank payments.
          </p>
        </div>

        {selectedRun ? (
          <div className="flex gap-2">
            {selectedRun.status === 'LOCKED' && (
              <BankExportButton 
                runId={selectedRun.id} 
                filename={`Bank_Transfer_${getBSMonthName(selectedRun.payPeriodMonth)}_${selectedRun.payPeriodYear}.csv`} 
              />
            )}
            <button
              onClick={handleBackToList}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d7e8d0] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1b3a1f] shadow-sm hover:bg-[#d7e8d0]/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to List
            </button>
          </div>
        ) : (
          <div className="flex rounded-lg border border-[#d7e8d0] bg-white p-0.5 shadow-sm">
            <button
              onClick={() => { setActiveTab("list"); setError(null); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "list"
                  ? "bg-[#2e7d32] text-white shadow-sm"
                  : "text-gray-600 hover:bg-[#d7e8d0]/20"
              }`}
            >
              <List className="h-4 w-4" />
              Payroll History
            </button>
            <button
              onClick={() => { setActiveTab("generate"); setError(null); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "generate"
                  ? "bg-[#2e7d32] text-white shadow-sm"
                  : "text-gray-600 hover:bg-[#d7e8d0]/20"
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
          <div className="flex flex-col md:flex-row md:items-center justify-between border border-[#d7e8d0] bg-white rounded-xl p-5 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-[#1b3a1f]">
                Payroll Batch Details: {getBSMonthName(selectedRun.payPeriodMonth)} {selectedRun.payPeriodYear}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Range: {selectedRun.payPeriodStartDate} to {selectedRun.payPeriodEndDate}
              </p>
            </div>
            <div className="mt-2 md:mt-0 rounded-lg bg-[#f6faf6] px-3.5 py-1.5 border border-[#d7e8d0] text-xs font-semibold text-gray-600">
              Active Role: <span className="text-[#2e7d32]">{userRole}</span>
            </div>
          </div>

          {/* Run Statistics Summary */}
          <PayrollSummaryCard run={selectedRun} />

          {/* Workflow progress line */}
          <PayrollRunPipeline run={selectedRun} />

          {/* Editable slips table */}
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin text-[#2e7d32]" />
              <p className="text-xs text-gray-500 mt-2 font-medium">Loading payslips data...</p>
            </div>
          ) : (
            <PayrollReviewGrid
              run={selectedRun}
              initialSlips={selectedSlips}
              onStatusChange={handleStatusChange}
              userRole={userRole}
            />
          )}
        </div>
      ) : activeTab === "list" ? (
        // Past Runs History
        <PayrollTable runs={runs} onSelect={handleSelectRun} />
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
    </div>
  );
}

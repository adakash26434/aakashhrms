"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  List,
  ArrowLeft,
  RefreshCw,
  Trash2,
  AlertTriangle,
  ClipboardList,
  Calendar,
  Layers,
  Lock,
  DollarSign,
} from "lucide-react";
import type {
  PayrollRun,
  PayrollSlip,
  PayrollRunSetupPayload,
  PayrollRunStatus,
} from "@/lib/types/payroll";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { PayrollTable } from "./payroll-table";
import { PayrollSetupForm } from "./payroll-setup-form";
import { PayrollSummaryCard } from "./payroll-summary-card";
import { PayrollRunPipeline } from "./payroll-run-pipeline";
import { PayrollReviewGrid } from "./payroll-review-grid";
import { PayrollExceptionsCard } from "./payroll-exceptions-card";
import { BankExportButton } from "./bank-export-button";
import {
  generatePayrollRunAction,
  transitionPayrollRunAction,
  getPayrollRunDetailsAction,
  deletePayrollRunAction,
} from "@/app/actions/payroll.actions";
import { useToast } from "@/components/ui/toast";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStrip, type KpiMetric } from "@/components/layout/kpi-strip";
import { ContentCard } from "@/components/ui/content-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PayrollClientProps {
  initialRuns: PayrollRun[];
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string }>;
  employees: Array<{
    id: string;
    name: string;
    employeeCode: string;
    branchId: string;
    departmentId: string;
    designationId: string;
    category: string;
    hasBank?: boolean;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    panNumber?: string | null;
  }>;
  occasionalAllowances: Array<{
    id: string;
    name: string;
    isFestivalAllowance: boolean;
    isRemoteAllowance: boolean;
  }>;
  allPayHeads?: Array<{
    id: string;
    name: string;
    code: string;
    type: "allowance" | "deduction";
  }>;
  userRole: string;
  initialMode?: "generate" | "review" | "list";
  initialRunId?: string | null;
  canGenerate?: boolean;
  canReview?: boolean;
}

export default function PayrollClient({
  initialRuns,
  branches,
  departments,
  designations,
  employees,
  occasionalAllowances,
  allPayHeads,
  userRole,
  initialMode = "list",
  initialRunId = null,
  canGenerate = true,
  canReview = true,
}: PayrollClientProps) {
  const toast = useToast();
  const [runs, setRuns] = useState<PayrollRun[]>(initialRuns);
  const [activeTab, setActiveTab] = useState<"list" | "generate">(() => {
    if (initialMode === "generate" && canGenerate) return "generate";
    if (initialRuns.length === 0 && canGenerate) return "generate";
    return "list";
  });
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [selectedSlips, setSelectedSlips] = useState<PayrollSlip[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscardRun, setConfirmDiscardRun] = useState<PayrollRun | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const getBSMonthName = (m: number) => {
    return BS_MONTHS_EN[m] ?? "Unknown";
  };

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

  // Auto-select initialRunId if provided
  useEffect(() => {
    if (!initialRunId) return;
    let isMounted = true;
    const target = runs.find((r) => r.id === initialRunId);
    if (target) {
      getPayrollRunDetailsAction(target.id).then((res) => {
        if (isMounted && res.success && res.data) {
          setSelectedRun(res.data.payrollRun);
          setSelectedSlips(res.data.slips);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [initialRunId, runs]);

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
      setRuns((prev) => prev.filter((r) => r.id !== run.id));
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
        setRuns((prev) =>
          prev.map((r) => (r.id === selectedRun.id ? res.data!.payrollRun : r))
        );
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
      const filtered = runs.filter(
        (r) =>
          !(
            r.payPeriodMonth === res.data!.payPeriodMonth &&
            r.payPeriodYear === res.data!.payPeriodYear
          )
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

    toast.success(`Payroll run transitioned to ${toStatus.replace("_", " ")}.`);
    setSelectedRun(res.data);
    setRuns((prev) =>
      prev.map((r) => (r.id === selectedRun.id ? res.data! : r))
    );
  };

  // High-level Registry KPI metrics
  const overviewKpis: KpiMetric[] = useMemo(() => {
    const totalRuns = runs.length;
    const inReview = runs.filter(
      (r) => r.status === "DRAFT" || r.status === "UNDER_REVIEW"
    ).length;
    const locked = runs.filter((r) => r.status === "LOCKED").length;
    const latestRun = runs[0];
    const latestNet = latestRun ? Number(latestRun.totalNetPayable) : 0;

    return [
      {
        title: "Batches Tracked",
        value: totalRuns,
        subtext: "Fiscal year runs recorded",
        icon: Calendar,
      },
      {
        title: "In Review / Draft",
        value: inReview,
        subtext: "Pending audit verification",
        icon: Layers,
        badge: inReview > 0 ? "Action Required" : undefined,
      },
      {
        title: "Locked & Amortized",
        value: locked,
        subtext: "Finalized bank disbursements",
        icon: Lock,
      },
      {
        title: "Latest Net Disbursed",
        value: `Rs. ${latestNet.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        subtext: latestRun
          ? `${getBSMonthName(latestRun.payPeriodMonth)} ${latestRun.payPeriodYear}`
          : "No run yet",
        icon: DollarSign,
      },
    ];
  }, [runs]);

  return (
    <PageFrame size="wide" spacing="default">
      {/* Top Header */}
      {selectedRun ? (
        <PageHeader
          title={`Payroll Batch: ${getBSMonthName(selectedRun.payPeriodMonth)} ${selectedRun.payPeriodYear}`}
          description={`BS Period: ${getBSMonthName(selectedRun.payPeriodMonth)} ${selectedRun.payPeriodYear} (${selectedRun.payPeriodStartDate} to ${selectedRun.payPeriodEndDate}) · Active Role: ${userRole}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {selectedRun.status === "DRAFT" && (
              <Button
                type="button"
                onClick={() => handleStatusChange("UNDER_REVIEW")}
                className="bg-payroll-primary text-white hover:bg-payroll-navy cursor-pointer font-semibold shadow-payroll-xs"
                size="sm"
              >
                <ClipboardList className="h-4 w-4 mr-1.5" />
                Submit for Review
              </Button>
            )}
            {selectedRun.status === "LOCKED" && (
              <BankExportButton
                runId={selectedRun.id}
                filename={`Bank_Transfer_${getBSMonthName(selectedRun.payPeriodMonth)}_${selectedRun.payPeriodYear}.csv`}
              />
            )}
            {selectedRun.status !== "LOCKED" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDiscardRun(selectedRun)}
                className="border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 hover:text-red-800 cursor-pointer text-xs"
                size="sm"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Discard Batch
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToList}
              className="border-payroll-light/80 bg-white text-payroll-navy hover:bg-payroll-cream cursor-pointer text-xs"
              size="sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              All Batches
            </Button>
          </div>
        </PageHeader>
      ) : (
        <PageHeader
          title="Payroll Workspace"
          description="Unified control center to generate draft calculations, audit payslips, review exceptions, and lock monthly disbursements."
        >
          {/* Segmented Mode Switcher */}
          <div className="inline-flex items-center rounded-xl border border-payroll-light/80 bg-payroll-cream/50 p-1 shadow-payroll-xs">
            {canReview && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("list");
                  setError(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none",
                  activeTab === "list"
                    ? "bg-payroll-primary text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy hover:bg-white/60"
                )}
              >
                <List className="h-3.5 w-3.5" />
                Review & Batches
              </button>
            )}
            {canGenerate && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("generate");
                  setError(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none",
                  activeTab === "generate"
                    ? "bg-payroll-primary text-white shadow-payroll-xs"
                    : "text-gray-600 hover:text-payroll-navy hover:bg-white/60"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Generate Draft
              </button>
            )}
          </div>
        </PageHeader>
      )}

      {/* Global Error Banner */}
      {error && <ErrorBanner message={error} />}

      {/* Workspace Body */}
      {selectedRun ? (
        // Selected Run Workspace: Details, KPIs, Pipeline, Exceptions & Grid
        <div className="space-y-6">
          {/* Run Statistics Summary Strip */}
          <PayrollSummaryCard run={selectedRun} />

          {/* Workflow Pipeline */}
          <PayrollRunPipeline run={selectedRun} />

          {/* Pre-Lock Audit Exceptions Card */}
          <PayrollExceptionsCard
            slips={selectedSlips}
            onSelectSlip={() => {
              // Smooth scroll to table
            }}
          />

          {/* Payslips Review Grid */}
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-payroll-light/80 bg-white">
              <RefreshCw className="h-8 w-8 animate-spin text-payroll-primary" />
              <p className="text-xs text-gray-500 mt-2.5 font-medium">
                Loading batch payslips & line-item heads...
              </p>
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
        // Run Registry View with KPIs and TableShell
        <div className="space-y-6">
          <KpiStrip metrics={overviewKpis} columns={4} />
          <PayrollTable
            runs={runs}
            onSelect={handleSelectRun}
            onDelete={handleDeleteRun}
          />
        </div>
      ) : (
        // Generate Draft View inside ContentCard
        <ContentCard
          title="Generate Monthly Payroll Batch"
          subtitle="Define pay period scope, select participating employees, apply festival/remote allowances, and compute automated draft payslips."
        >
          <PayrollSetupForm
            branches={branches}
            departments={departments}
            designations={designations}
            employees={employees}
            occasionalAllowances={occasionalAllowances}
            onSubmit={handleGenerateRun}
            isLoading={isGenerating}
          />
        </ContentCard>
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
                    {getBSMonthName(confirmDiscardRun.payPeriodMonth)}{" "}
                    {confirmDiscardRun.payPeriodYear}
                  </span>
                  ?
                </p>
                <div className="mt-2.5 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">
                  This will delete all generated payslips and fallback to the initial
                  un-generated state, allowing you to generate payslips again for this month.
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDiscardRun(null)}
                disabled={isDiscarding}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Keep Batch
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRun(confirmDiscardRun)}
                disabled={isDiscarding}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {isDiscarding ? "Discarding..." : "Yes, Discard Batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
}

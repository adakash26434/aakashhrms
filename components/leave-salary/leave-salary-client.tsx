"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  List,
  AlertCircle,
  FileText,
  Clock,
  DollarSign,
  CalendarDays,
  Search,
} from "lucide-react";
import type {
  LeaveSalaryRun,
  LeaveSalarySetupPayload,
  PaymentMethod,
  EncashmentType,
} from "@/lib/types/payroll";
import { LeaveSalaryTable } from "./leave-salary-table";
import { LeaveSalarySetupForm } from "./leave-salary-setup-form";
import {
  createLeaveSalaryAction,
  payLeaveSalaryAction,
  deleteLeaveSalaryAction,
  updateLeaveSalaryDraftAction,
} from "@/app/actions/leave-salary.actions";
import { useToast } from "@/components/ui/toast";

interface LeaveSalaryClientProps {
  initialRuns: LeaveSalaryRun[];
  employees: Array<{ id: string; name: string }>;
  leaveTypes: Array<{ id: string; name: string }>;
  fiscalYears?: Array<{ id: string; label: string; status: string }>;
  permissions?: {
    canView: boolean;
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canApprove: boolean;
  };
}

export default function LeaveSalaryClient({
  initialRuns,
  employees,
  leaveTypes,
  fiscalYears = [],
  permissions = {
    canView: false,
    canAdd: false,
    canEdit: false,
    canDelete: false,
    canApprove: false,
  },
}: LeaveSalaryClientProps) {
  const [runs, setRuns] = useState<LeaveSalaryRun[]>(initialRuns);
  const [activeTab, setActiveTab] = useState<"list" | "generate">("list");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters (E4/E5)
  const [statusFilter, setStatusFilter] = useState<"all" | "DRAFT" | "PAID">(
    "all",
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      // Status filter
      if (statusFilter !== "all" && run.status !== statusFilter) return false;

      // Search filter (by employee name)
      if (searchTerm.trim()) {
        const empName =
          employees.find((e) => e.id === run.employeeId)?.name || "";
        if (!empName.toLowerCase().includes(searchTerm.toLowerCase()))
          return false;
      }

      return true;
    });
  }, [runs, statusFilter, searchTerm, employees]);

  // KPI calculations (E1)
  const kpis = useMemo(() => {
    const totalRecords = runs.length;
    const draftRecords = runs.filter((r) => r.status === "DRAFT").length;
    const paidRuns = runs.filter((r) => r.status === "PAID");
    const totalPaid = paidRuns.reduce(
      (sum, r) => sum + Number(r.totalAmount),
      0,
    );
    const totalDaysEncashed = paidRuns.reduce(
      (sum, r) => sum + Number(r.leaveDays),
      0,
    );

    return { totalRecords, draftRecords, totalPaid, totalDaysEncashed };
  }, [runs]);

  const toast = useToast();

  const handleGenerate = async (payload: LeaveSalarySetupPayload) => {
    setError(null);
    setIsGenerating(true);
    try {
      const res = await createLeaveSalaryAction(payload);
      if (!res.success || !res.data) {
        const msg = res.error || "Failed to generate leave salary.";
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Leave salary draft generated successfully!");
      setRuns([res.data, ...runs]);
      setActiveTab("list");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to generate leave salary.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async (
    id: string,
    payload: {
      leaveDays: number;
      paymentPeriod: string;
      paymentMethod: PaymentMethod;
      encashmentType: EncashmentType;
    },
  ) => {
    setError(null);
    try {
      const res = await updateLeaveSalaryDraftAction(id, payload);
      if (!res.success || !res.data) {
        const msg = res.error || "Failed to update draft.";
        toast.error(msg);
        throw new Error(msg);
      }
      toast.success("Leave salary draft updated.");
      setRuns(runs.map((r) => (r.id === id ? res.data! : r)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update draft.";
      toast.error(msg);
      throw err;
    }
  };

  const handlePay = async (id: string) => {
    setError(null);
    try {
      const res = await payLeaveSalaryAction(id);
      if (!res.success || !res.data) {
        const msg = res.error || "Failed to mark leave salary as paid.";
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Leave salary marked as paid!");
      // Update in local state
      setRuns(runs.map((r) => (r.id === id ? res.data! : r)));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Action failed.";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await deleteLeaveSalaryAction(id);
      if (!res.success) {
        const msg = res.error || "Failed to delete leave salary record.";
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Leave salary record deleted.");
      // Remove from local state
      setRuns(runs.filter((r) => r.id !== id));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Delete failed.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#d7e8d0] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#1b3a1f] tracking-tight">
            Leave Salary Encashment
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Encash unutilized accumulated leave balance using base daily rate
            calculations.
          </p>
        </div>

        <div className="flex rounded-lg border border-[#d7e8d0] bg-white p-0.5 shadow-sm">
          <button
            onClick={() => {
              setActiveTab("list");
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === "list"
                ? "bg-[#2e7d32] text-white shadow-sm"
                : "text-gray-600 hover:bg-[#d7e8d0]/20"
            }`}
          >
            <List className="h-4 w-4" />
            Encashment Records
          </button>
          {permissions.canAdd && (
            <button
              onClick={() => {
                setActiveTab("generate");
                setError(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "generate"
                  ? "bg-[#2e7d32] text-white shadow-sm"
                  : "text-gray-600 hover:bg-[#d7e8d0]/20"
              }`}
            >
              <Plus className="h-4 w-4" />
              Encash Leave
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards (FEAT-4 / E1) - Shown only on Records List tab */}
      {activeTab === "list" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#d7e8d0] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2e7d32]/10">
                <FileText className="h-4 w-4 text-[#2e7d32]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Total Records
                </p>
                <p className="text-lg font-bold text-[#1b3a1f]">
                  {kpis.totalRecords}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8d0] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Draft Pending
                </p>
                <p className="text-lg font-bold text-amber-600">
                  {kpis.draftRecords}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8d0] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Total Paid
                </p>
                <p className="text-lg font-bold text-emerald-600">
                  Rs.{" "}
                  {kpis.totalPaid.toLocaleString("en-IN", {
                    minimumFractionDigits: 0,
                  })}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e8d0] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                <CalendarDays className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Days Encashed
                </p>
                <p className="text-lg font-bold text-purple-600">
                  {kpis.totalDaysEncashed}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === "list" ? (
        <>
          {/* Filters (E4/E5) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-50 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by employee name..."
                className="w-full rounded-lg border border-[#d7e8d0] bg-white pl-9 pr-3.5 py-2 text-sm text-[#1b3a1f] outline-none transition-all focus:border-[#2e7d32] placeholder:text-gray-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "DRAFT" | "PAID")
              }
              className="rounded-lg border border-[#d7e8d0] bg-white px-3.5 py-2 text-sm text-[#1b3a1f] outline-none transition-all focus:border-[#2e7d32]"
            >
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft Only</option>
              <option value="PAID">Paid Only</option>
            </select>
            {(statusFilter !== "all" || searchTerm.trim()) && (
              <span className="text-xs text-gray-500">
                Showing {filteredRuns.length} of {runs.length} records
              </span>
            )}
          </div>

          <LeaveSalaryTable
            runs={filteredRuns}
            employees={employees}
            leaveTypes={leaveTypes}
            fiscalYears={fiscalYears}
            permissions={permissions}
            onPay={handlePay}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        </>
      ) : (
        <LeaveSalarySetupForm
          employees={employees}
          leaveTypes={leaveTypes}
          fiscalYears={fiscalYears}
          onSubmit={handleGenerate}
          isLoading={isGenerating}
        />
      )}
    </div>
  );
}

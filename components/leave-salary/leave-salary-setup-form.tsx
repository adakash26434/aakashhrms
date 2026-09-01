"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, RefreshCw, Info } from "lucide-react";
import type {
  LeaveSalarySetupPayload,
  EncashmentType,
  PaymentMethod,
} from "@/lib/types/payroll";
import { getEmployeeLeaveBalanceForEncashmentAction } from "@/app/actions/leave-salary.actions";
import { BS_MONTHS_LIST as BS_MONTHS } from "@/lib/utils/bs-calendar";

interface LeaveSalarySetupFormProps {
  employees: Array<{ id: string; name: string }>;
  leaveTypes: Array<{ id: string; name: string }>;
  fiscalYears?: Array<{ id: string; label: string; status: string }>;
  onSubmit: (payload: LeaveSalarySetupPayload) => Promise<void>;
  isLoading: boolean;
}

interface BalancePreview {
  allotted: number;
  taken: number;
  balance: number;
  carriedForward: number;
  accumulationCap: number | null;
  maxPaidDays: number | null;
  isEncashable: boolean;
}

export function LeaveSalarySetupForm({
  employees,
  leaveTypes,
  fiscalYears = [],
  onSubmit,
  isLoading,
}: LeaveSalarySetupFormProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveDays, setLeaveDays] = useState<number>(0);

  // Payment Period dropdown states
  const activeFY =
    fiscalYears.find((f: { status: string; label: string }) => f.status === "Active") || fiscalYears[0];
  const [selectedFYLabel, setSelectedFYLabel] = useState(
    activeFY?.label || "FY 2081/82",
  );
  const [selectedMonth, setSelectedMonth] = useState("Asar");

  const [encashmentType, setEncashmentType] =
    useState<EncashmentType>("VOLUNTARY");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("BANK_TRANSFER");
  const [error, setError] = useState<string | null>(null);

  // Balance preview state
  const [balancePreview, setBalancePreview] = useState<BalancePreview | null>(
    null,
  );
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Fetch balance when employee + leave type are both selected
  const fetchBalance = useCallback(async (empId: string, ltId: string) => {
    if (!empId || !ltId) {
      setBalancePreview(null);
      return;
    }
    setLoadingBalance(true);
    try {
      const res = await getEmployeeLeaveBalanceForEncashmentAction(empId, ltId);
      if (res.success && res.data) {
        setBalancePreview(res.data);
      } else {
        setBalancePreview(null);
      }
    } catch {
      setBalancePreview(null);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance(employeeId, leaveTypeId);
  }, [employeeId, leaveTypeId, fetchBalance]);

  const maxEncashable = balancePreview
    ? Math.min(
        balancePreview.balance,
        ...(balancePreview.accumulationCap !== null
          ? [balancePreview.accumulationCap]
          : []),
        ...(balancePreview.maxPaidDays !== null
          ? [balancePreview.maxPaidDays]
          : []),
      )
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!employeeId) {
      setError("Please select an employee.");
      return;
    }
    if (!leaveTypeId) {
      setError("Please select a leave type.");
      return;
    }
    if (leaveDays <= 0) {
      setError(
        "Invalid encashment days: Requested days must be greater than 0.",
      );
      return;
    }

    if (balancePreview) {
      if (leaveDays > balancePreview.balance) {
        setError(
          `Insufficient Balance: Cannot encash ${leaveDays} days. Available balance is ${balancePreview.balance} days.`,
        );
        return;
      }
      if (maxEncashable !== null && leaveDays > maxEncashable) {
        setError(
          `Exceeds Limit: Cannot encash ${leaveDays} days. Maximum encashable limit for this leave type is ${maxEncashable} days.`,
        );
        return;
      }
    }

    const constructedPeriod = `${selectedMonth} (${selectedFYLabel})`;

    try {
      await onSubmit({
        employeeId,
        leaveTypeId,
        leaveDays,
        paymentPeriod: constructedPeriod,
        encashmentType,
        paymentMethod,
      });
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to process leave salary.",
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-[#d7e8d0] bg-white p-6 shadow-sm"
    >
      <div className="border-b border-[#d7e8d0] pb-4">
        <h2 className="text-base font-bold text-[#1b3a1f]">
          Encash Leave / Generate Leave Salary
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Select target employee, leave type, days to encash, payment period,
          and payment method to generate record.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Employee */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Employee
          </label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3.5 py-2.5 text-sm text-[#1b3a1f] shadow-sm outline-none transition-all focus:border-[#2e7d32]"
          >
            <option value="">Select Employee</option>
            {employees.map((emp: { id: string; name: string }) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Leave Type */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Leave Type (Encashable Only)
          </label>
          <select
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3.5 py-2.5 text-sm text-[#1b3a1f] shadow-sm outline-none transition-all focus:border-[#2e7d32]"
          >
            <option value="">Select Leave Type</option>
            {leaveTypes.map((t: { id: string; name: string }) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Balance Preview Widget */}
      {(loadingBalance || balancePreview) && (
        <div className="rounded-lg border border-green-100 bg-green-50/50 px-4 py-3 transition-all animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-3.5 w-3.5 text-green-600" />
            <span className="text-[11px] font-bold text-[#1b3a1f] uppercase tracking-wider">
              Leave Balance Preview
            </span>
          </div>
          {loadingBalance ? (
            <div className="flex items-center gap-2 text-xs text-green-600 py-0.5">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Loading balance...
            </div>
          ) : balancePreview ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="rounded-md bg-white p-2 text-center border border-green-100 shadow-2xs">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                  Allotted
                </p>
                <p className="text-sm font-bold text-[#1b3a1f] mt-0.5">
                  {balancePreview.allotted}
                </p>
              </div>
              <div className="rounded-md bg-white p-2 text-center border border-green-100 shadow-2xs">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                  Taken
                </p>
                <p className="text-sm font-bold text-amber-600 mt-0.5">
                  {balancePreview.taken}
                </p>
              </div>
              <div className="rounded-md bg-white p-2 text-center border border-green-100 shadow-2xs">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                  Available
                </p>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">
                  {balancePreview.balance}
                </p>
              </div>
              <div className="rounded-md bg-white p-2 text-center border border-green-100 shadow-2xs">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                  Max Encashable
                </p>
                <p className="text-sm font-bold text-[#2e7d32] mt-0.5">
                  {maxEncashable !== null
                    ? maxEncashable
                    : balancePreview.balance}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Days */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Days to Encash
          </label>
          <input
            type="number"
            value={leaveDays || ""}
            onChange={(e) => setLeaveDays(Number(e.target.value))}
            max={maxEncashable ?? undefined}
            className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3.5 py-2 text-sm text-[#1b3a1f] shadow-sm outline-none transition-all focus:border-[#2e7d32]"
            placeholder="e.g. 10"
          />
          {balancePreview &&
            leaveDays > 0 &&
            leaveDays > balancePreview.balance && (
              <p className="mt-1 text-[11px] text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Exceeds available balance ({balancePreview.balance} days
                available)
              </p>
            )}
          {balancePreview &&
            maxEncashable !== null &&
            leaveDays > maxEncashable &&
            leaveDays <= balancePreview.balance && (
              <p className="mt-1 text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Exceeds maximum encashable limit ({maxEncashable} days limit)
              </p>
            )}
        </div>

        {/* Payment Period: Linked Fiscal Year + Month Dropdowns */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            Payment Period
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedFYLabel}
              onChange={(e) => setSelectedFYLabel(e.target.value)}
              className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] shadow-sm outline-none transition-all focus:border-[#2e7d32]"
            >
              {fiscalYears.length > 0 ? (
                fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.label}>
                    {fy.label} {fy.status === "Active" ? "(Active)" : ""}
                  </option>
                ))
              ) : (
                <option value="FY 2081/82">FY 2081/82</option>
              )}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] shadow-sm outline-none transition-all focus:border-[#2e7d32]"
            >
              {BS_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[10px] text-gray-400">
            Selected period:{" "}
            <span className="font-semibold text-[#1b3a1f]">
              {selectedMonth} ({selectedFYLabel})
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Payment Method */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { value: "BANK_TRANSFER" as PaymentMethod, label: "Bank Transfer" },
              { value: "CHEQUE" as PaymentMethod, label: "Cheque" },
              { value: "CASH" as PaymentMethod, label: "Cash" },
            ].map((pm) => (
              <label
                key={pm.value}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs transition-all ${
                  paymentMethod === pm.value
                    ? "border-[#2e7d32] bg-[#2e7d32]/5 ring-1 ring-[#2e7d32]/20"
                    : "border-[#d7e8d0] bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={pm.value}
                  checked={paymentMethod === pm.value}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="sr-only"
                />
                <div
                  className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    paymentMethod === pm.value
                      ? "border-[#2e7d32]"
                      : "border-gray-300"
                  }`}
                >
                  {paymentMethod === pm.value && (
                    <div className="h-1.5 w-1.5 rounded-full bg-[#2e7d32]" />
                  )}
                </div>
                <span className="font-semibold text-[#1b3a1f] text-xs truncate">
                  {pm.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Encashment Type */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Encashment Type
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { value: "VOLUNTARY" as EncashmentType, label: "Voluntary" },
              {
                value: "ANNUAL_EXCESS" as EncashmentType,
                label: "Annual Excess",
              },
              { value: "TERMINATION" as EncashmentType, label: "Termination" },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs transition-all ${
                  encashmentType === opt.value
                    ? "border-[#2e7d32] bg-[#2e7d32]/5 ring-1 ring-[#2e7d32]/20"
                    : "border-[#d7e8d0] bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="encashmentType"
                  value={opt.value}
                  checked={encashmentType === opt.value}
                  onChange={(e) =>
                    setEncashmentType(e.target.value as EncashmentType)
                  }
                  className="sr-only"
                />
                <div
                  className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    encashmentType === opt.value
                      ? "border-[#2e7d32]"
                      : "border-gray-300"
                  }`}
                >
                  {encashmentType === opt.value && (
                    <div className="h-1.5 w-1.5 rounded-full bg-[#2e7d32]" />
                  )}
                </div>
                <span className="font-semibold text-[#1b3a1f] text-xs truncate">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-[#d7e8d0]/60">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2e7d32] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#1b3a1f] disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Calculating rate and totals...
            </>
          ) : (
            "Encash Leave & Generate Draft"
          )}
        </button>
      </div>
    </form>
  );
}

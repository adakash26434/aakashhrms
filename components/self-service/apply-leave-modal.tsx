"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Calendar, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { applyForLeaveAction } from "@/app/actions/self-service.actions";

interface LeaveBalanceOption {
  id: string;
  leaveTypeId?: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  balance: number | string;
}

interface ApplyLeaveModalProps {
  balances: LeaveBalanceOption[];
}

export function ApplyLeaveModal({ balances }: ApplyLeaveModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState(balances[0]?.id || "");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [duration, setDuration] = useState<"Full Day" | "Half Day">("Full Day");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const toast = useToast();

  const selectedBalance = balances.find(
    (b) => b.id === leaveTypeId || b.leaveTypeId === leaveTypeId,
  );

  // Calculate calendar days difference
  const calculateDays = () => {
    if (!effectiveFrom || !effectiveTo) return 0;
    const start = new Date(effectiveFrom);
    const end = new Date(effectiveTo);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return duration === "Half Day" ? diffDays * 0.5 : diffDays;
  };

  const calculatedDays = calculateDays();
  const remainingBalance = Number(selectedBalance?.balance ?? 0);
  const isBalanceExceeded = calculatedDays > remainingBalance;

  const handleOpen = () => {
    setError(null);
    setReason("");
    setEffectiveFrom("");
    setEffectiveTo("");
    setDuration("Full Day");
    if (balances.length > 0) {
      setLeaveTypeId(balances[0].id);
    }
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!leaveTypeId) {
      setError("Please select a leave category.");
      return;
    }
    if (!effectiveFrom || !effectiveTo) {
      setError("Please select both start and end dates.");
      return;
    }
    if (new Date(effectiveTo) < new Date(effectiveFrom)) {
      setError("End date cannot be earlier than start date.");
      return;
    }
    if (calculatedDays <= 0) {
      setError("Invalid duration selected.");
      return;
    }
    if (isBalanceExceeded) {
      setError(
        `Requested duration (${calculatedDays} days) exceeds available balance (${remainingBalance} days).`,
      );
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for your leave request.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await applyForLeaveAction({
          leaveTypeId: selectedBalance?.leaveTypeId || leaveTypeId,
          effectiveFrom,
          effectiveTo,
          duration,
          noOfDays: calculatedDays,
          reason: reason.trim(),
        });

        if (!res.success) {
          setError(res.error || "Failed to submit leave request.");
          toast.error(res.error || "Failed to submit leave request.");
          return;
        }

        toast.success("Leave request submitted successfully for supervisor approval.");
        setIsOpen(false);
        router.refresh();
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        <span>Apply for Leave</span>
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => !isPending && setIsOpen(false)}
        title="Submit Leave Application"
        description="Request time off. Your supervisor will be notified for review."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isPending}
              disabled={isPending || isBalanceExceeded || calculatedDays === 0}
              className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm"
            >
              Submit Application
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Leave Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider block">
              Leave Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary font-medium shadow-payroll-xs"
            >
              {balances.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.leaveTypeName} ({b.leaveTypeCode}) — Balance: {b.balance} days
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From & To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider block">
                From Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-payroll-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider block">
                To Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={effectiveTo}
                min={effectiveFrom}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-payroll-xs"
              />
            </div>
          </div>

          {/* Duration Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider block">
              Daily Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDuration("Full Day")}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  duration === "Full Day"
                    ? "bg-payroll-primary text-white border-payroll-primary shadow-payroll-xs"
                    : "bg-white text-gray-700 border-payroll-light hover:bg-payroll-cream"
                }`}
              >
                Full Day
              </button>
              <button
                type="button"
                onClick={() => setDuration("Half Day")}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  duration === "Half Day"
                    ? "bg-payroll-primary text-white border-payroll-primary shadow-payroll-xs"
                    : "bg-white text-gray-700 border-payroll-light hover:bg-payroll-cream"
                }`}
              >
                Half Day (0.5x)
              </button>
            </div>
          </div>

          {/* Duration Preview Banner */}
          {effectiveFrom && effectiveTo && (
            <div className="p-3 bg-payroll-cream rounded-xl border border-payroll-light flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-500 block text-[11px]">Calculated Leave Duration:</span>
                <span className="font-extrabold text-payroll-navy text-sm">
                  {calculatedDays} day(s)
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px] text-right">Available Balance:</span>
                <span
                  className={`font-bold block text-right text-xs ${
                    isBalanceExceeded ? "text-rose-600" : "text-emerald-700"
                  }`}
                >
                  {remainingBalance} days remaining
                </span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider block">
              Reason / Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide details for your leave request..."
              className="w-full p-3 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-payroll-xs resize-none"
            />
          </div>
        </form>
      </Dialog>
    </>
  );
}

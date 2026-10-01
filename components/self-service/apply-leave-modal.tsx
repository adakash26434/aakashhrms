"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { applyForLeaveAction } from "@/app/actions/self-service.actions";
import { cn } from "@/lib/utils";

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
        className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-xs shadow-none cursor-pointer flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Apply for Leave</span>
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => !isPending && setIsOpen(false)}
        title="Submit Leave Application"
        description="Request time off. Your supervisor will be notified for review."
        size="2xl"
        footer={
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">
              {calculatedDays > 0 ? `${calculatedDays} day(s) requested` : "Select dates to calculate balance impact"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                isLoading={isPending}
                disabled={isPending || isBalanceExceeded || calculatedDays === 0}
                className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium shadow-none cursor-pointer px-4 py-2 text-sm"
              >
                Submit Application
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Leave Category & Quota */}
          <FormSection
            title="Leave Category"
            description="Choose the applicable policy scheme and view current quota availability."
            isFirst
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                >
                  {balances.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.leaveTypeName} ({b.leaveTypeCode}) — Balance: {b.balance} days
                    </option>
                  ))}
                </select>
              </div>

              {selectedBalance && (
                <div className="rounded-md border border-zinc-200/80 bg-zinc-50/60 p-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Available entitlement quota:</span>
                  <span className="font-semibold text-emerald-950 font-mono">
                    {selectedBalance.balance} days
                  </span>
                </div>
              )}
            </div>
          </FormSection>

          {/* Section 2: Schedule & Duration */}
          <FormSection
            title="Schedule & Duration"
            description="Specify absence calendar dates and single-day or half-day basis."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    From Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    To Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={effectiveTo}
                    min={effectiveFrom}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Daily Duration Basis
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDuration("Full Day")}
                    className={cn(
                      "flex-1 py-2 px-3 text-xs font-medium rounded-md border transition-colors cursor-pointer",
                      duration === "Full Day"
                        ? "border-payroll-primary bg-payroll-primary-light text-payroll-navy font-semibold"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    Full Day (1.0x)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration("Half Day")}
                    className={cn(
                      "flex-1 py-2 px-3 text-xs font-medium rounded-md border transition-colors cursor-pointer",
                      duration === "Half Day"
                        ? "border-payroll-primary bg-payroll-primary-light text-payroll-navy font-semibold"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    Half Day (0.5x)
                  </button>
                </div>
              </div>

              {/* Duration Preview Banner */}
              {effectiveFrom && effectiveTo && (
                <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Calculated Leave Duration:</span>
                    <span className="font-semibold text-zinc-900 text-sm font-mono">
                      {calculatedDays} day(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px] text-right">Available Balance:</span>
                    <span
                      className={cn(
                        "font-semibold block text-right text-xs font-mono",
                        isBalanceExceeded ? "text-red-600" : "text-emerald-800"
                      )}
                    >
                      {remainingBalance} days remaining
                    </span>
                  </div>
                </div>
              )}
            </div>
          </FormSection>

          {/* Section 3: Reason */}
          <FormSection
            title="Reason & Details"
            description="Provide context for absence for supervisor review."
          >
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Reason / Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please provide details for your leave request..."
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary resize-y"
              />
            </div>
          </FormSection>
        </form>
      </Dialog>
    </>
  );
}

function FormSection({
  title,
  description,
  children,
  isFirst = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div className={cn("space-y-3", !isFirst && "pt-5 border-t border-zinc-200")}>
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 tracking-tight">{title}</h4>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

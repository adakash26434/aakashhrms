"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Archive,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Props {
  companyId: string;
  companyCode: string;
  legalName: string;
  slug: string;
  status: string;
  archivedAt?: string | null;
  suspendedAt?: string | null;
}

export function CompanyLifecycleCard({
  companyId,
  companyCode,
  legalName,
  slug,
  status,
  archivedAt,
  suspendedAt,
}: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isProcessing, setIsProcessing] = useState(false);

  // Danger Zone / Purge Modal state
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [confirmCodeInput, setConfirmCodeInput] = useState("");
  const [purgeDatabase, setPurgeDatabase] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const toast = useToast();

  const handleLifecycleAction = async (
    action: "SUSPEND" | "REACTIVATE" | "ARCHIVE" | "RESTORE",
  ) => {
    let confirmPrompt = "";
    if (action === "SUSPEND") {
      confirmPrompt = `Are you sure you want to SUSPEND ${legalName} (${companyCode})? All employee and company admin logins will be immediately blocked.`;
    } else if (action === "ARCHIVE") {
      confirmPrompt = `Are you sure you want to ARCHIVE ${legalName}? It will be hidden from the active directory. You can restore it anytime.`;
    } else if (action === "REACTIVATE" || action === "RESTORE") {
      confirmPrompt = `Are you sure you want to restore and activate ${legalName}?`;
    }

    if (!confirm(confirmPrompt)) return;

    try {
      setIsProcessing(true);

      const res = await fetch(`/api/platform/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentStatus(data.company.status);
        toast.success(data.message || `Status updated to ${data.company.status}`);
        router.refresh();
      } else {
        toast.error(data.error || "Failed to execute lifecycle action.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentPurge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmCodeInput.trim().toUpperCase() !== companyCode.toUpperCase()) {
      setPurgeError(`Confirmation code does not match ${companyCode}.`);
      return;
    }

    try {
      setIsPurging(true);
      setPurgeError(null);

      const res = await fetch(`/api/platform/companies/${companyId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmCode: confirmCodeInput.trim(),
          purgeDatabase,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Company ${companyCode} and database pay_t_${slug} permanently deleted.`);
        router.push("/platform/companies");
      } else {
        setPurgeError(data.error || "Failed to permanently purge company.");
      }
    } catch (err: any) {
      setPurgeError(err.message || "Network error during purge.");
    } finally {
      setIsPurging(false);
    }
  };

  const isCodeMatch =
    confirmCodeInput.trim().toUpperCase() === companyCode.toUpperCase();

  return (
    <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-payroll-light/60">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4.5 h-4.5 text-payroll-primary" />
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Tenant Lifecycle & Decommissioning
            </h3>
          </div>

          <Badge
            variant={
              currentStatus === "ACTIVE"
                ? "success"
                : currentStatus === "SUSPENDED"
                ? "warning"
                : "neutral"
            }
            size="sm"
            className="font-bold"
          >
            STATUS: {currentStatus}
          </Badge>
        </div>

        {/* Lifecycle Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Suspend / Reactivate */}
          <div className="p-4 rounded-xl border border-payroll-light bg-payroll-cream/60 space-y-3 shadow-payroll-xs flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-payroll-navy flex items-center gap-1.5">
                {currentStatus === "SUSPENDED" ? (
                  <>
                    <PlayCircle className="w-4 h-4 text-emerald-600" />
                    <span>Reactivate Company</span>
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-4 h-4 text-amber-600" />
                    <span>Suspend Company Access</span>
                  </>
                )}
              </h4>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                {currentStatus === "SUSPENDED"
                  ? "Re-enable employee logins and active database connection pools."
                  : "Instantly block all user logins while keeping the database intact."}
              </p>
            </div>

            <Button
              size="sm"
              disabled={isProcessing}
              onClick={() =>
                handleLifecycleAction(
                  currentStatus === "SUSPENDED" ? "REACTIVATE" : "SUSPEND",
                )
              }
              className={cn(
                "w-full text-xs font-bold shadow-payroll-xs",
                currentStatus === "SUSPENDED"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300",
              )}
            >
              {isProcessing
                ? "Processing..."
                : currentStatus === "SUSPENDED"
                ? "Reactivate Access"
                : "Suspend Access"}
            </Button>
          </div>

          {/* Archive / Restore */}
          <div className="p-4 rounded-xl border border-payroll-light bg-payroll-cream/60 space-y-3 shadow-payroll-xs flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-payroll-navy flex items-center gap-1.5">
                {currentStatus === "ARCHIVED" ? (
                  <>
                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                    <span>Restore from Archive</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 text-purple-600" />
                    <span>Soft Delete & Archive</span>
                  </>
                )}
              </h4>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                {currentStatus === "ARCHIVED"
                  ? "Restore this company back to the active directory."
                  : "Hide from active directory with a 30-day recovery grace period."}
              </p>
            </div>

            <Button
              size="sm"
              disabled={isProcessing}
              onClick={() =>
                handleLifecycleAction(
                  currentStatus === "ARCHIVED" ? "RESTORE" : "ARCHIVE",
                )
              }
              className={cn(
                "w-full text-xs font-bold shadow-payroll-xs",
                currentStatus === "ARCHIVED"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200",
              )}
            >
              {isProcessing
                ? "Processing..."
                : currentStatus === "ARCHIVED"
                ? "Restore to Active"
                : "Archive Company"}
            </Button>
          </div>
        </div>

        {/* Danger Zone: Permanent Purge */}
        <div className="pt-4 border-t border-rose-100">
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5 uppercase">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Danger Zone: Permanent Delete & Purge</span>
                </h4>
                <p className="text-[11px] text-rose-700">
                  Permanently deletes all company records and drops the physical PostgreSQL database <code className="font-mono font-bold">pay_t_{slug}</code>.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  setConfirmCodeInput("");
                  setPurgeError(null);
                  setIsPurgeModalOpen(true);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-payroll-xs shrink-0"
              >
                Permanent Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Permanent Purge Modal */}
        <Dialog
          open={isPurgeModalOpen}
          onClose={() => setIsPurgeModalOpen(false)}
          title="Confirm Permanent Purge"
          description="Irrevocable destruction of tenant organization and isolated database."
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button
                variant="outline"
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={isPurging}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePermanentPurge}
                isLoading={isPurging}
                disabled={!isCodeMatch || isPurging}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-payroll-sm"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                <span>Permanently Purge</span>
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
              <p>
                You are about to permanently delete <strong>{legalName}</strong>.
              </p>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-rose-800">
                <li>Database <strong>pay_t_{slug}</strong> will be dropped from PostgreSQL.</li>
                <li>All employee records, payroll runs, and tax history will be destroyed.</li>
                <li>Both PostgreSQL and Platform Control Plane will be purged.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Type the Company Code <span className="font-mono text-rose-600 font-extrabold">{companyCode}</span> to confirm:
              </label>
              <input
                type="text"
                required
                placeholder={companyCode}
                value={confirmCodeInput}
                onChange={(e) => setConfirmCodeInput(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:outline-none uppercase"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="purgeDatabaseCheckbox"
                checked={purgeDatabase}
                onChange={(e) => setPurgeDatabase(e.target.checked)}
                className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
              />
              <label htmlFor="purgeDatabaseCheckbox" className="text-xs text-gray-700 cursor-pointer">
                Drop physical PostgreSQL database (<code className="font-mono">pay_t_{slug}</code>)
              </label>
            </div>

            {purgeError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                {purgeError}
              </div>
            )}
          </div>
        </Dialog>
      </CardContent>
    </Card>
  );
}

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
} from "lucide-react";

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
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Danger Zone / Purge Modal state
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [confirmCodeInput, setConfirmCodeInput] = useState("");
  const [purgeDatabase, setPurgeDatabase] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const handleLifecycleAction = async (
    action: "SUSPEND" | "REACTIVATE" | "ARCHIVE" | "RESTORE"
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
      setFeedback(null);

      const res = await fetch(`/api/platform/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentStatus(data.company.status);
        setFeedback({
          type: "success",
          message: data.message || `Status updated to ${data.company.status}`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to execute lifecycle action.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Network error.",
      });
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
        alert(`Company ${companyCode} and database pay_t_${slug} permanently deleted.`);
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
    <div className="bg-white border border-payroll-light rounded-2xl p-6 space-y-6 shadow-payroll-sm">
      <div className="flex items-center justify-between pb-3 border-b border-payroll-light/60">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-payroll-primary" />
          <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
            Tenant Lifecycle & Decommissioning
          </h3>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            currentStatus === "ACTIVE"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : currentStatus === "SUSPENDED"
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : currentStatus === "ARCHIVED"
              ? "bg-purple-50 text-purple-700 border border-purple-200"
              : "bg-gray-50 text-gray-700 border border-gray-200"
          }`}
        >
          STATUS: {currentStatus}
        </span>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Lifecycle Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Suspend / Reactivate */}
        <div className="p-4 rounded-xl border border-payroll-light bg-payroll-cream space-y-3">
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
            <p className="text-[11px] text-gray-500 mt-1">
              {currentStatus === "SUSPENDED"
                ? "Re-enable employee logins and active connection pools."
                : "Instantly block all user logins while keeping the database intact."}
            </p>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() =>
              handleLifecycleAction(
                currentStatus === "SUSPENDED" ? "REACTIVATE" : "SUSPEND"
              )
            }
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              currentStatus === "SUSPENDED"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
            }`}
          >
            {isProcessing
              ? "Processing..."
              : currentStatus === "SUSPENDED"
              ? "Reactivate Access"
              : "Suspend Access"}
          </button>
        </div>

        {/* Archive / Restore */}
        <div className="p-4 rounded-xl border border-payroll-light bg-payroll-cream space-y-3">
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
            <p className="text-[11px] text-gray-500 mt-1">
              {currentStatus === "ARCHIVED"
                ? "Restore this company back to the active directory."
                : "Hide from active directory with a 30-day recovery grace period."}
            </p>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() =>
              handleLifecycleAction(
                currentStatus === "ARCHIVED" ? "RESTORE" : "ARCHIVE"
              )
            }
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              currentStatus === "ARCHIVED"
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300"
            }`}
          >
            {isProcessing
              ? "Processing..."
              : currentStatus === "ARCHIVED"
              ? "Restore to Active"
              : "Archive Company"}
          </button>
        </div>
      </div>

      {/* Danger Zone: Permanent Purge */}
      <div className="pt-4 border-t border-rose-100">
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5 uppercase">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Danger Zone: Permanent Delete & Purge</span>
              </h4>
              <p className="text-[11px] text-rose-700">
                Permanently deletes all company records and drops the physical PostgreSQL database <code className="font-mono font-bold">pay_t_{slug}</code>. This cannot be undone.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmCodeInput("");
                setPurgeError(null);
                setIsPurgeModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm shrink-0"
            >
              Permanent Delete
            </button>
          </div>
        </div>
      </div>

      {/* Permanent Purge Modal */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Confirm Permanent Purge
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Irrevocable destruction of tenant database
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
              <p>
                You are about to permanently delete <strong>{legalName}</strong>.
              </p>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-rose-800">
                <li>Database <strong>pay_t_{slug}</strong> will be dropped from PostgreSQL.</li>
                <li>All employee records, payroll runs, and tax history will be destroyed.</li>
                <li>Both PostgreSQL and Platform Control Plane will be purged.</li>
              </ul>
            </div>

            <form onSubmit={handlePermanentPurge} className="space-y-4">
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
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:outline-none uppercase"
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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPurgeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isCodeMatch || isPurging}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isPurging ? (
                    <span>Purging Database...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Purge</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

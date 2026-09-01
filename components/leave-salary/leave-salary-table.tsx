"use client";

import { useState } from "react";
import { CreditCard, FileText, Trash2, Edit, AlertTriangle, CheckCircle, Clock, Eye, X } from "lucide-react";
import type { LeaveSalaryRun, EncashmentType, PaymentMethod } from "@/lib/types/payroll";

interface LeaveSalaryTableProps {
  runs: LeaveSalaryRun[];
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
  onPay: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit?: (id: string, payload: { leaveDays: number; paymentPeriod: string; paymentMethod: PaymentMethod; encashmentType: EncashmentType }) => Promise<void>;
}

const ENCASHMENT_TYPE_LABELS: Record<EncashmentType, string> = {
  VOLUNTARY: "Voluntary",
  ANNUAL_EXCESS: "Annual Excess",
  TERMINATION: "Termination",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  CASH: "Cash",
};

import { BS_MONTHS_LIST as BS_MONTHS } from "@/lib/utils/bs-calendar";

export function LeaveSalaryTable({
  runs,
  employees,
  leaveTypes,
  fiscalYears = [],
  permissions = { canView: false, canAdd: false, canEdit: false, canDelete: false, canApprove: false },
  onPay,
  onDelete,
  onEdit,
}: LeaveSalaryTableProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View Details Modal State
  const [viewingRun, setViewingRun] = useState<LeaveSalaryRun | null>(null);

  // Edit Modal State
  const [editingRun, setEditingRun] = useState<LeaveSalaryRun | null>(null);
  const [editDays, setEditDays] = useState<number>(0);
  const [editFY, setEditFY] = useState<string>("FY 2081/82");
  const [editMonth, setEditMonth] = useState<string>("Asar");
  const [editMethod, setEditMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [editType, setEditType] = useState<EncashmentType>("VOLUNTARY");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">No leave salary runs generated yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Go to the &quot;Encash Leave&quot; tab to calculate your first leave salary.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700"><Clock className="h-3 w-3" />Draft</span>;
      case "PAID":
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle className="h-3 w-3" />Paid</span>;
      default:
        return null;
    }
  };

  const getEncashmentTypeBadge = (type: EncashmentType) => {
    const colors: Record<EncashmentType, string> = {
      VOLUNTARY: "bg-green-50 text-green-700 border-green-200",
      ANNUAL_EXCESS: "bg-amber-50 text-amber-700 border-amber-200",
      TERMINATION: "bg-purple-50 text-purple-700 border-purple-200",
    };
    return (
      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${colors[type]}`}>
        {ENCASHMENT_TYPE_LABELS[type] || type}
      </span>
    );
  };

  const getPaymentMethodBadge = (method: PaymentMethod) => {
    const styles: Record<PaymentMethod, string> = {
      BANK_TRANSFER: "bg-sky-50 text-sky-700 border-sky-200",
      CHEQUE: "bg-green-50 text-green-700 border-green-200",
      CASH: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    return (
      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${styles[method] || "bg-gray-50 text-gray-700"}`}>
        {PAYMENT_METHOD_LABELS[method] || method}
      </span>
    );
  };

  const handleDeleteConfirm = async (id: string) => {
    setDeleting(true);
    await onDelete(id);
    setDeleteConfirmId(null);
    setDeleting(false);
  };

  const openEditModal = (run: LeaveSalaryRun) => {
    setEditingRun(run);
    setEditDays(Number(run.leaveDays));
    setEditMethod(run.paymentMethod || "BANK_TRANSFER");
    setEditType(run.encashmentType || "VOLUNTARY");
    setEditError(null);

    // Parse payment period e.g. "Asar (FY 2081/82)" or keep existing
    if (run.paymentPeriod.includes("(") && run.paymentPeriod.includes(")")) {
      const parts = run.paymentPeriod.split(" (");
      setEditMonth(parts[0] || "Asar");
      setEditFY(parts[1].replace(")", "") || "FY 2081/82");
    } else {
      setEditMonth("Asar");
      setEditFY("FY 2081/82");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRun || !onEdit) return;
    if (editDays <= 0) {
      setEditError("Leave days must be greater than 0.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);

    const periodStr = `${editMonth} (${editFY})`;
    try {
      await onEdit(editingRun.id, {
        leaveDays: editDays,
        paymentPeriod: periodStr,
        paymentMethod: editMethod,
        encashmentType: editType,
      });
      setEditingRun(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update draft.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-[#d7e8d0] bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6] text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3.5">Employee</th>
              <th className="px-4 py-3.5">Leave Type</th>
              <th className="px-4 py-3.5">Type</th>
              <th className="px-4 py-3.5 text-center">Days</th>
              <th className="px-4 py-3.5 text-right font-medium">Per Day Rate</th>
              <th className="px-4 py-3.5 text-right font-bold">Total Amount</th>
              <th className="px-4 py-3.5">Payment Method</th>
              <th className="px-4 py-3.5">Period</th>
              <th className="px-4 py-3.5">Approved By</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const empName = employees.find((e) => e.id === run.employeeId)?.name || "Unknown";
              const ltName = leaveTypes.find((t) => t.id === run.leaveTypeId)?.name || "Unknown";
              const approver = run.approvedByName || (run.status === "PAID" ? "System Admin" : "-");

              return (
                <tr
                  key={run.id}
                  className="border-b border-[#d7e8d0]/60 transition-colors hover:bg-[#f6faf6]/30"
                >
                  <td className="px-4 py-3.5 font-semibold text-[#1b3a1f]">
                    {empName}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">
                    {ltName}
                  </td>
                  <td className="px-4 py-3.5">
                    {getEncashmentTypeBadge(run.encashmentType)}
                  </td>
                  <td className="px-4 py-3.5 text-center tabular-nums font-semibold text-[#1b3a1f]">
                    {run.leaveDays}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-gray-600">
                    Rs. {Number(run.perDayRate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold tabular-nums text-emerald-600">
                    Rs. {Number(run.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5">
                    {getPaymentMethodBadge(run.paymentMethod)}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-medium text-gray-600">
                    {run.paymentPeriod}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">
                    {run.status === "PAID" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                        {approver}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Pending Approval</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {getStatusBadge(run.status)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {run.status === "DRAFT" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        {permissions.canApprove && (
                          <button
                            onClick={() => onPay(run.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Approve & Pay"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Pay
                          </button>
                        )}
                        {permissions.canEdit && onEdit && (
                          <button
                            onClick={() => openEditModal(run)}
                            className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
                            title="Edit draft record"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {permissions.canDelete && (
                          <button
                            onClick={() => setDeleteConfirmId(run.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                            title="Delete draft record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRun(run)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#d7e8d0] bg-white px-2.5 py-1 text-xs font-semibold text-[#1b3a1f] hover:bg-[#f6faf6] hover:border-[#2e7d32] transition-all shadow-sm"
                          title="View Record Details"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#2e7d32]" />
                          View
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* View Record Details Modal */}
      {viewingRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#d7e8d0] bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#d7e8d0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1b3a1f]">Leave Salary Encashment Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">Read-only view of paid leave salary encashment record</p>
              </div>
              <button
                onClick={() => setViewingRun(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Employee</p>
                <p className="font-bold text-[#1b3a1f] text-sm mt-0.5">
                  {employees.find(e => e.id === viewingRun.employeeId)?.name || 'Unknown'}
                </p>
              </div>
              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Leave Type</p>
                <p className="font-bold text-[#1b3a1f] text-sm mt-0.5">
                  {leaveTypes.find(t => t.id === viewingRun.leaveTypeId)?.name || 'Unknown'}
                </p>
              </div>

              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Encashment Type</p>
                <div className="mt-1">{getEncashmentTypeBadge(viewingRun.encashmentType)}</div>
              </div>
              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Payment Method</p>
                <div className="mt-1">{getPaymentMethodBadge(viewingRun.paymentMethod)}</div>
              </div>

              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Days Encashed</p>
                <p className="font-bold text-[#1b3a1f] text-sm mt-0.5">{viewingRun.leaveDays} days</p>
              </div>
              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Payment Period</p>
                <p className="font-bold text-[#1b3a1f] text-sm mt-0.5">{viewingRun.paymentPeriod}</p>
              </div>

              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Daily Base Rate</p>
                <p className="font-bold text-gray-700 text-sm mt-0.5">
                  Rs. {Number(viewingRun.perDayRate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50/70 p-3 border border-emerald-200">
                <p className="text-[10px] font-semibold uppercase text-emerald-800">Total Paid Amount</p>
                <p className="font-bold text-emerald-700 text-base mt-0.5">
                  Rs. {Number(viewingRun.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Status</p>
                <div className="mt-1">{getStatusBadge(viewingRun.status)}</div>
              </div>
              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Approved / Paid By</p>
                <p className="font-semibold text-gray-700 text-xs mt-0.5">
                  {viewingRun.approvedByName || (viewingRun.status === "PAID" ? "System Administrator" : "Pending Approval")}
                </p>
              </div>

              <div className="rounded-lg bg-[#f6faf6] p-3 border border-[#d7e8d0]/60 col-span-2">
                <p className="text-[10px] font-semibold uppercase text-gray-400">Approved Date</p>
                <p className="font-semibold text-gray-700 text-xs mt-0.5">
                  {viewingRun.status === "PAID"
                    ? new Date(viewingRun.updatedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    : "Pending Approval"}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#d7e8d0]">
              <button
                onClick={() => setViewingRun(null)}
                className="rounded-lg bg-[#2e7d32] px-4 py-2 text-xs font-bold text-white hover:bg-[#1b3a1f] transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Draft Modal */}
      {editingRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[#d7e8d0] bg-white p-6 shadow-2xl space-y-4">
            <div className="border-b border-[#d7e8d0] pb-3">
              <h3 className="text-base font-bold text-[#1b3a1f]">Edit Draft Encashment Record</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Update parameters for {employees.find(e => e.id === editingRun.employeeId)?.name || 'Employee'}.
              </p>
            </div>

            {editError && (
              <div className="rounded-md bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Days to Encash</label>
                <input
                  type="number"
                  value={editDays}
                  onChange={(e) => setEditDays(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Payment Period</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editFY}
                    onChange={(e) => setEditFY(e.target.value)}
                    className="w-full rounded-lg border border-[#d7e8d0] bg-white px-2.5 py-2 text-xs text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
                  >
                    {fiscalYears.length > 0 ? (
                      fiscalYears.map(f => (
                        <option key={f.id} value={f.label}>{f.label}</option>
                      ))
                    ) : (
                      <option value="FY 2081/82">FY 2081/82</option>
                    )}
                  </select>

                  <select
                    value={editMonth}
                    onChange={(e) => setEditMonth(e.target.value)}
                    className="w-full rounded-lg border border-[#d7e8d0] bg-white px-2.5 py-2 text-xs text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
                  >
                    {BS_MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Payment Method</label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-xs text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Encashment Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as EncashmentType)}
                  className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-xs text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
                >
                  <option value="VOLUNTARY">Voluntary</option>
                  <option value="ANNUAL_EXCESS">Annual Excess</option>
                  <option value="TERMINATION">Termination</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#d7e8d0]">
              <button
                type="button"
                onClick={() => setEditingRun(null)}
                disabled={savingEdit}
                className="rounded-lg border border-[#d7e8d0] px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="rounded-lg bg-[#2e7d32] px-4 py-2 text-xs font-bold text-white hover:bg-[#1b3a1f] transition-colors disabled:opacity-50"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-[#d7e8d0] bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1b3a1f]">Delete Draft Record</h3>
                <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-5">
              Are you sure you want to permanently delete this draft leave salary record?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="rounded-lg border border-[#d7e8d0] px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(deleteConfirmId)}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  ExternalLink,
  RefreshCw,
  Eye,
  Check,
  X,
  ArrowRight,
  FileText,
  AlertTriangle,
  Send,
  User,
  Hash,
  MapPin,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { INDUSTRY_SECTORS, type IndustrySectorKey } from "@/lib/constants/industry-types";

interface ChangeRequestItem {
  id: string;
  companyId: string;
  companyCode: string;
  companyDisplayName: string;
  companyLegalName: string;
  companySlug: string;
  requestedByUserId?: string;
  requestedByUserEmail: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  currentValues: {
    legalName: string;
    panVatNumber?: string;
    registrationNumber?: string;
    industryType?: string;
    headOfficeAddress?: string;
  };
  proposedValues: {
    legalName: string;
    panVatNumber?: string;
    registrationNumber?: string;
    industryType?: string;
    headOfficeAddress?: string;
  };
  reason: string;
  documentReference?: string;
  reviewedByPlatformUserId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PlatformChangeRequestsPage() {
  const toast = useToast();
  const [requests, setRequests] = useState<ChangeRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");

  // Selected request for modal review
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequestItem | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/change-requests");
      const data = await res.json();
      if (data.success) {
        setRequests(data.data || []);
      } else {
        toast.error(data.error || "Failed to fetch change requests.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error fetching change requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus = statusFilter === "ALL" ? true : r.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.companyLegalName?.toLowerCase().includes(q) ||
        r.companyDisplayName?.toLowerCase().includes(q) ||
        r.companyCode?.toLowerCase().includes(q) ||
        r.requestedByUserEmail?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, search]);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
    };
  }, [requests]);

  // Handle Approve
  async function handleApprove(reqId: string) {
    setIsReviewing(true);
    try {
      const res = await fetch(`/api/platform/change-requests/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Change request approved and dual-database synced successfully.");
        setSelectedRequest(null);
        fetchRequests();
      } else {
        toast.error(data.error || "Failed to approve request.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error processing approval.");
    } finally {
      setIsReviewing(false);
    }
  }

  // Handle Reject
  async function handleReject(reqId: string) {
    if (!rejectionReasonInput.trim() || rejectionReasonInput.trim().length < 5) {
      toast.error("Please provide a descriptive reason for rejecting this request.");
      return;
    }

    setIsRejecting(true);
    try {
      const res = await fetch(`/api/platform/change-requests/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          rejectionReason: rejectionReasonInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Change request has been rejected.");
        setSelectedRequest(null);
        setShowRejectBox(false);
        setRejectionReasonInput("");
        fetchRequests();
      } else {
        toast.error(data.error || "Failed to reject request.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error processing rejection.");
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            Company Data Change Requests
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Review and verify statutory company credential amendments requested by tenant administrators.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchRequests}
          disabled={loading}
          className="gap-1.5 text-xs font-semibold self-start sm:self-center"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* ── Metrics Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Pending Verification
              </span>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats.pending}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Approved & Synced
              </span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.approved}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Rejected
              </span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">{stats.rejected}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Total Requests
              </span>
              <div className="text-2xl font-extrabold text-payroll-navy mt-1">{stats.total}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters & Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
              statusFilter === "PENDING"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Pending ({stats.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("APPROVED")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
              statusFilter === "APPROVED"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Approved ({stats.approved})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("REJECTED")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
              statusFilter === "REJECTED"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Rejected ({stats.rejected})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
              statusFilter === "ALL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            All ({stats.total})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search company, code, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>
      </div>

      {/* ── Request List ── */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
          Loading company change requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Change Requests Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {statusFilter === "PENDING"
              ? "There are currently no pending statutory amendment requests awaiting Super Admin verification."
              : "No requests matching the selected filter criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const hasLegalNameChange =
              req.proposedValues?.legalName && req.proposedValues.legalName !== req.currentValues?.legalName;
            const hasPanChange =
              req.proposedValues?.panVatNumber &&
              req.proposedValues.panVatNumber !== req.currentValues?.panVatNumber;
            const hasRegChange =
              req.proposedValues?.registrationNumber &&
              req.proposedValues.registrationNumber !== req.currentValues?.registrationNumber;

            return (
              <div
                key={req.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-teal-200 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                        {req.companyCode}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {req.companyLegalName}
                      </h3>
                      {req.companyDisplayName && req.companyDisplayName !== req.companyLegalName && (
                        <span className="text-xs text-slate-500">
                          ({req.companyDisplayName})
                        </span>
                      )}

                      {req.status === "PENDING" && (
                        <Badge variant="warning" size="sm" className="gap-1">
                          <Clock className="w-3 h-3" /> Pending Review
                        </Badge>
                      )}
                      {req.status === "APPROVED" && (
                        <Badge variant="success" size="sm" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Approved & Synced
                        </Badge>
                      )}
                      {req.status === "REJECTED" && (
                        <Badge variant="danger" size="sm" className="gap-1">
                          <XCircle className="w-3 h-3" /> Rejected
                        </Badge>
                      )}
                      {req.status === "CANCELLED" && (
                        <Badge variant="neutral" size="sm">
                          Cancelled
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Requested by: <strong>{req.requestedByUserEmail}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(req.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Change Highlights */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="text-slate-500 font-medium">Proposed Changes:</span>
                      {hasLegalNameChange && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-medium">
                          Legal Name: {req.proposedValues.legalName}
                        </span>
                      )}
                      {hasPanChange && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-medium">
                          PAN/VAT: {req.proposedValues.panVatNumber}
                        </span>
                      )}
                      {hasRegChange && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                          Reg No: {req.proposedValues.registrationNumber}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-w-3xl">
                      <strong>Reason:</strong> {req.reason}
                    </div>

                    {req.status === "REJECTED" && req.rejectionReason && (
                      <div className="text-xs text-rose-800 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        <strong>Rejection Reason:</strong> {req.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                    <Link
                      href={`/platform/companies/${req.companyId}`}
                      className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>View Company</span>
                    </Link>

                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(req);
                        setShowRejectBox(false);
                        setRejectionReasonInput("");
                      }}
                      className="gap-1.5 text-xs font-semibold bg-payroll-primary hover:bg-payroll-primary-hover text-white"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{req.status === "PENDING" ? "Review & Verify" : "View Details"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Review & Verification Modal ── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-[fadeIn_150ms_ease-out]">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Statutory Change Request Review
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Company: <strong className="text-slate-800">{selectedRequest.companyLegalName}</strong> ({selectedRequest.companyCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Diff Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-3 w-1/4">Credential Field</th>
                      <th className="py-2.5 px-3 w-3/8">Current Active Value</th>
                      <th className="py-2.5 px-3 w-3/8">Proposed Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Legal Name */}
                    <tr className={cn(selectedRequest.proposedValues.legalName !== selectedRequest.currentValues.legalName && "bg-amber-50/40")}>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">Legal Registered Name</td>
                      <td className="py-2.5 px-3 text-slate-600">{selectedRequest.currentValues.legalName || "—"}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {selectedRequest.proposedValues.legalName}
                        {selectedRequest.proposedValues.legalName !== selectedRequest.currentValues.legalName && (
                          <span className="ml-1.5 text-[10px] text-amber-700 font-normal bg-amber-100 px-1.5 py-0.5 rounded">Changed</span>
                        )}
                      </td>
                    </tr>

                    {/* PAN / VAT */}
                    <tr className={cn(selectedRequest.proposedValues.panVatNumber !== selectedRequest.currentValues.panVatNumber && "bg-amber-50/40")}>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">PAN / VAT Number</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{selectedRequest.currentValues.panVatNumber || "—"}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {selectedRequest.proposedValues.panVatNumber || "—"}
                        {selectedRequest.proposedValues.panVatNumber !== selectedRequest.currentValues.panVatNumber && (
                          <span className="ml-1.5 text-[10px] text-amber-700 font-normal bg-amber-100 px-1.5 py-0.5 rounded font-sans">Changed</span>
                        )}
                      </td>
                    </tr>

                    {/* Reg Number */}
                    <tr className={cn(selectedRequest.proposedValues.registrationNumber !== selectedRequest.currentValues.registrationNumber && "bg-amber-50/40")}>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">Registration Number</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{selectedRequest.currentValues.registrationNumber || "—"}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {selectedRequest.proposedValues.registrationNumber || "—"}
                        {selectedRequest.proposedValues.registrationNumber !== selectedRequest.currentValues.registrationNumber && (
                          <span className="ml-1.5 text-[10px] text-amber-700 font-normal bg-amber-100 px-1.5 py-0.5 rounded font-sans">Changed</span>
                        )}
                      </td>
                    </tr>

                    {/* Industry Sector */}
                    <tr className={cn(selectedRequest.proposedValues.industryType !== selectedRequest.currentValues.industryType && "bg-amber-50/40")}>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">Industry Sector</td>
                      <td className="py-2.5 px-3 text-slate-600">{selectedRequest.currentValues.industryType || "General"}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {selectedRequest.proposedValues.industryType || "General"}
                        {selectedRequest.proposedValues.industryType !== selectedRequest.currentValues.industryType && (
                          <span className="ml-1.5 text-[10px] text-amber-700 font-normal bg-amber-100 px-1.5 py-0.5 rounded">Changed</span>
                        )}
                      </td>
                    </tr>

                    {/* Address */}
                    <tr className={cn(selectedRequest.proposedValues.headOfficeAddress !== selectedRequest.currentValues.headOfficeAddress && "bg-amber-50/40")}>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">Head Office Address</td>
                      <td className="py-2.5 px-3 text-slate-600">{selectedRequest.currentValues.headOfficeAddress || "—"}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {selectedRequest.proposedValues.headOfficeAddress || "—"}
                        {selectedRequest.proposedValues.headOfficeAddress !== selectedRequest.currentValues.headOfficeAddress && (
                          <span className="ml-1.5 text-[10px] text-amber-700 font-normal bg-amber-100 px-1.5 py-0.5 rounded">Changed</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Justification Note */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Requester Justification:</span>
                  <span className="text-slate-500 text-[11px]">
                    Submitted by {selectedRequest.requestedByUserEmail}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed italic bg-white p-3 rounded-lg border border-slate-200/80">
                  "{selectedRequest.reason}"
                </p>
                {selectedRequest.documentReference && (
                  <div className="pt-1 text-[11px] text-slate-600">
                    <strong>Document Reference:</strong> {selectedRequest.documentReference}
                  </div>
                )}
              </div>

              {/* Review History if already processed */}
              {selectedRequest.status !== "PENDING" && (
                <div className="rounded-xl border border-slate-200 p-4 text-xs space-y-1 bg-slate-50">
                  <div className="font-bold text-slate-800">Review Outcome:</div>
                  <div className="text-slate-600">
                    Status: <strong>{selectedRequest.status}</strong>
                    {selectedRequest.reviewerName && ` by ${selectedRequest.reviewerName}`}
                    {selectedRequest.reviewedAt && ` on ${new Date(selectedRequest.reviewedAt).toLocaleString()}`}
                  </div>
                  {selectedRequest.rejectionReason && (
                    <div className="text-rose-700 mt-1">
                      <strong>Rejection Note:</strong> {selectedRequest.rejectionReason}
                    </div>
                  )}
                </div>
              )}

              {/* Rejection input box */}
              {showRejectBox && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3 animate-[fadeIn_150ms_ease-out]">
                  <h4 className="text-xs font-bold text-rose-900">
                    Reason for Rejection (required):
                  </h4>
                  <textarea
                    rows={3}
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="e.g. Uploaded PAN number does not match IRD registry or official company seal is missing..."
                    className="w-full rounded-lg border border-rose-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectBox(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isRejecting}
                      onClick={() => handleReject(selectedRequest.id)}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                    >
                      {isRejecting ? "Rejecting..." : "Confirm Rejection"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRequest(null)}
                className="text-xs"
              >
                Close
              </Button>

              {selectedRequest.status === "PENDING" && !showRejectBox && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRejectBox(true)}
                    className="text-xs font-semibold border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Reject
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={isReviewing}
                    onClick={() => handleApprove(selectedRequest.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isReviewing ? "Applying Changes..." : "Approve & Sync Databases"}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

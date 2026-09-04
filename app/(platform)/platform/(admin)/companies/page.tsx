"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  PauseCircle,
  Archive,
  HardDrive,
  AlertTriangle,
  Wrench,
  Trash2,
  Loader2,
  Layers,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Company {
  id: string;
  companyCode: string;
  legalName: string;
  displayName: string;
  slug: string;
  status: "PENDING" | "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "REJECTED";
  contactEmail: string;
  contactPhone?: string;
  registeredAt: string;
  provisionedAt?: string;
}

interface ReconcileReport {
  hasDesync: boolean;
  totalTenantStorageFormatted: string;
  summary: Array<{
    companyId: string;
    companyCode: string;
    displayName: string;
    slug: string;
    dbName: string;
    physicallyExists: boolean;
    status: string;
    sizeFormatted: string;
  }>;
  unlinkedDatabases: Array<{
    dbName: string;
    sizeFormatted: string;
  }>;
}

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "SUSPENDED" | "ARCHIVED">("ALL");
  const [provisioningId, setProvisioningId] = useState<string | null>(null);

  // Reconciler state
  const [reconcileReport, setReconcileReport] = useState<ReconcileReport | null>(null);
  const [reconcileActionId, setReconcileActionId] = useState<string | null>(null);

  const toast = useToast();

  const fetchCompaniesAndHealth = async () => {
    try {
      setLoading(true);
      const [compRes, recRes] = await Promise.all([
        fetch("/api/platform/companies"),
        fetch("/api/platform/health/reconcile"),
      ]);

      const compData = await compRes.json();
      const recData = await recRes.json();

      if (compData.success) {
        setCompanies(compData.companies || []);
      }
      if (recData.success) {
        setReconcileReport(recData);
      }
    } catch (err) {
      console.error("Failed to fetch companies and health data:", err);
      toast.error("Failed to load tenant companies data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompaniesAndHealth();
  }, []);

  const handleProvision = async (companyId: string) => {
    try {
      setProvisioningId(companyId);
      const res = await fetch(`/api/platform/companies/${companyId}/provision`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        const dbName = data.dbName || data.result?.dbName || "Provisioned";
        const code = data.companyCode || data.result?.companyCode || "";
        const tempPassword = data.tempPasswordPlain || data.result?.tempPasswordPlain;
        toast.success(
          `Company provisioned! DB: ${dbName}${code ? ` (${code})` : ""}${
            tempPassword ? ` | Default Password: ${tempPassword}` : ""
          }`
        );
        fetchCompaniesAndHealth();
      } else {
        toast.error(`Provisioning error: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Provisioning failed: ${err.message}`);
    } finally {
      setProvisioningId(null);
    }
  };

  // 1-Click Reconciliation Action
  const handleReconcileAction = async (action: string, companyId?: string, dbName?: string) => {
    try {
      setReconcileActionId(companyId || dbName || "action");
      const res = await fetch("/api/platform/health/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, companyId, dbName }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Reconciliation completed.");
        fetchCompaniesAndHealth();
      } else {
        toast.error(`Reconciliation error: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Action failed: ${err.message}`);
    } finally {
      setReconcileActionId(null);
    }
  };

  // Filter by status and search
  const filtered = companies.filter((c) => {
    const matchesSearch =
      (c.legalName || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.displayName || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.companyCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.slug || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = companies.filter((c) => c.status === "ACTIVE").length;
  const pendingCount = companies.filter((c) => c.status === "PENDING").length;
  const suspendedCount = companies.filter((c) => c.status === "SUSPENDED").length;
  const archivedCount = companies.filter((c) => c.status === "ARCHIVED").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            Tenant Companies Directory
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Manage registered SaaS organizations, isolated PostgreSQL databases, and lifecycle states.
          </p>
        </div>

        <Link href="/platform/companies/new">
          <Button className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Register New Company</span>
          </Button>
        </Link>
      </div>

      {/* ── PostgreSQL Health & Storage Summary Banner ── */}
      {reconcileReport && (
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-payroll-cream text-payroll-primary flex items-center justify-center border border-payroll-light shrink-0 shadow-2xs">
                <HardDrive className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-payroll-navy">
                    Total Isolated Tenant Storage:
                  </span>
                  <Badge variant="info" size="sm" className="font-mono font-bold">
                    {reconcileReport.totalTenantStorageFormatted}
                  </Badge>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {reconcileReport.hasDesync
                    ? "⚠️ Database desynchronization detected between PostgreSQL server and Control Plane."
                    : "✓ All registered tenant databases are 100% synchronized with the PostgreSQL cluster."}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchCompaniesAndHealth}
              disabled={loading}
              className="text-xs font-semibold shrink-0"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5 text-payroll-primary", loading && "animate-spin")} />
              <span>Sync Status</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Desync Warning & 1-Click Remediation Panel ── */}
      {reconcileReport && reconcileReport.hasDesync && (
        <Card className="bg-amber-50/70 border-amber-200 shadow-payroll-xs animate-[fadeIn_150ms_ease-out]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Database Reconciliation & Self-Healing Required
              </h4>
            </div>

            {/* Missing in Postgres */}
            {(reconcileReport.summary || [])
              .filter((s) => s.status === "ORPHANED_METADATA")
              .map((orphan) => (
                <div
                  key={orphan.companyId}
                  className="p-3.5 bg-white rounded-xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-payroll-xs"
                >
                  <div>
                    <span className="font-bold text-payroll-navy block">
                      {orphan.displayName} ({orphan.companyCode})
                    </span>
                    <p className="text-[11px] text-rose-600 mt-0.5">
                      Database <code className="font-mono font-bold">{orphan.dbName}</code> is missing from PostgreSQL server (likely dropped externally).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() =>
                        handleReconcileAction("REPROVISION_MISSING_DB", orphan.companyId)
                      }
                      disabled={reconcileActionId === orphan.companyId}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      <Wrench className="w-3.5 h-3.5 mr-1" />
                      <span>Re-provision DB</span>
                    </Button>
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() =>
                        handleReconcileAction("CLEANUP_ORPHANED_METADATA", orphan.companyId)
                      }
                      disabled={reconcileActionId === orphan.companyId}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      <span>Clean Record</span>
                    </Button>
                  </div>
                </div>
              ))}

            {/* Unlinked Databases in Postgres */}
            {(reconcileReport.unlinkedDatabases || []).map((unlinked) => (
              <div
                key={unlinked.dbName}
                className="p-3.5 bg-white rounded-xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-payroll-xs"
              >
                <div>
                  <span className="font-bold text-payroll-navy block">
                    Unlinked Database: <code className="font-mono text-purple-700 font-bold">{unlinked.dbName}</code>
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Storage: {unlinked.sizeFormatted} (Exists in PostgreSQL but has no registered platform company).
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() =>
                    handleReconcileAction("DROP_UNLINKED_DB", undefined, unlinked.dbName)
                  }
                  disabled={reconcileActionId === unlinked.dbName}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  <span>Drop Database</span>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Filter and Search Toolbar ── */}
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="p-4 space-y-3.5">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-payroll-light/60">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
                statusFilter === "ALL"
                  ? "bg-payroll-primary text-white shadow-payroll-xs"
                  : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
              )}
            >
              All Companies ({companies.length})
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
                statusFilter === "ACTIVE"
                  ? "bg-payroll-primary text-white shadow-payroll-xs"
                  : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
              )}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter("PENDING")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
                statusFilter === "PENDING"
                  ? "bg-payroll-primary text-white shadow-payroll-xs"
                  : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
              )}
            >
              Pending Provision ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter("SUSPENDED")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
                statusFilter === "SUSPENDED"
                  ? "bg-payroll-primary text-white shadow-payroll-xs"
                  : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
              )}
            >
              Suspended ({suspendedCount})
            </button>
            <button
              onClick={() => setStatusFilter("ARCHIVED")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
                statusFilter === "ARCHIVED"
                  ? "bg-payroll-primary text-white shadow-payroll-xs"
                  : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
              )}
            >
              Archived ({archivedCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search by legal name, company code (e.g. CMP-1111AF), or database slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-payroll-light bg-white text-payroll-navy text-xs focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary transition-all placeholder:text-gray-400 shadow-payroll-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Directory Table ── */}
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white overflow-hidden">
        {loading ? (
          <CardContent className="py-16 text-center text-gray-500 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-payroll-primary mx-auto mb-2" />
            <span>Loading tenant companies directory...</span>
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="py-12">
            <EmptyState
              icon={<Building2 className="w-6 h-6 text-payroll-primary" />}
              title="No tenant companies found"
              description="No tenant companies match your active search query or status filter. Try clearing filters or register a new company."
            />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-payroll-cream/70 text-payroll-navy font-bold uppercase tracking-wider border-b border-payroll-light text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Company Details</th>
                  <th className="px-4 py-3.5">Company Code</th>
                  <th className="px-4 py-3.5">Database Identifier</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-payroll-light/50 bg-white">
                {filtered.map((company) => (
                  <tr key={company.id} className="hover:bg-payroll-cream/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-payroll-navy text-xs">{company.displayName}</div>
                      <div className="text-[11px] text-gray-500">{company.legalName}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{company.contactEmail}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-payroll-cream text-payroll-primary border border-payroll-light font-mono text-xs font-bold">
                        {company.companyCode}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-xs font-mono font-bold text-gray-700">pay_t_{company.slug}</div>
                      <div className="text-[10px] text-gray-400">Slug: {company.slug}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      {company.status === "ACTIVE" && (
                        <Badge variant="success" size="sm">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> ACTIVE
                        </Badge>
                      )}
                      {company.status === "PENDING" && (
                        <Badge variant="warning" size="sm">
                          <Clock className="w-3 h-3 mr-1" /> PENDING
                        </Badge>
                      )}
                      {company.status === "SUSPENDED" && (
                        <Badge variant="warning" size="sm">
                          <PauseCircle className="w-3 h-3 mr-1" /> SUSPENDED
                        </Badge>
                      )}
                      {company.status === "ARCHIVED" && (
                        <Badge variant="neutral" size="sm">
                          <Archive className="w-3 h-3 mr-1" /> ARCHIVED
                        </Badge>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-2">
                      {company.status === "PENDING" && (
                        <Button
                          size="sm"
                          onClick={() => handleProvision(company.id)}
                          isLoading={provisioningId === company.id}
                          disabled={provisioningId === company.id}
                          className="bg-payroll-primary hover:bg-payroll-primary-hover text-white text-xs font-bold shadow-payroll-xs"
                        >
                          Approve & Provision
                        </Button>
                      )}
                      <Link href={`/platform/companies/${company.id}`}>
                        <Button variant="outline" size="sm" className="text-xs font-bold">
                          <span>Manage</span>
                          <ExternalLink className="w-3 h-3 ml-1 text-payroll-primary" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

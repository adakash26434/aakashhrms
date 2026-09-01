'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';

interface Company {
  id: string;
  companyCode: string;
  legalName: string;
  displayName: string;
  slug: string;
  status: 'PENDING' | 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'REJECTED';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'ARCHIVED'>('ALL');
  const [provisioningId, setProvisioningId] = useState<string | null>(null);

  // Reconciler state
  const [reconcileReport, setReconcileReport] = useState<ReconcileReport | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileActionId, setReconcileActionId] = useState<string | null>(null);

  const fetchCompaniesAndHealth = async () => {
    try {
      setLoading(true);
      const [compRes, recRes] = await Promise.all([
        fetch('/api/platform/companies'),
        fetch('/api/platform/health/reconcile'),
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
      console.error('Failed to fetch companies and health data:', err);
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
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        const dbName = data.dbName || data.result?.dbName || 'Provisioned';
        const code = data.companyCode || data.result?.companyCode || '';
        alert(`Company provisioned successfully!\nDatabase: ${dbName}${code ? `\nCode: ${code}` : ''}`);
        fetchCompaniesAndHealth();
      } else {
        alert(`Provisioning error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Provisioning failed: ${err.message}`);
    } finally {
      setProvisioningId(null);
    }
  };

  // 1-Click Reconciliation Action
  const handleReconcileAction = async (action: string, companyId?: string, dbName?: string) => {
    try {
      setReconcileActionId(companyId || dbName || 'action');
      const res = await fetch('/api/platform/health/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, companyId, dbName }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchCompaniesAndHealth();
      } else {
        alert(`Reconciliation error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setReconcileActionId(null);
    }
  };

  // Filter by status and search
  const filtered = companies.filter((c) => {
    const matchesSearch =
      c.legalName.toLowerCase().includes(search.toLowerCase()) ||
      c.displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.companyCode.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = companies.filter((c) => c.status === 'ACTIVE').length;
  const pendingCount = companies.filter((c) => c.status === 'PENDING').length;
  const suspendedCount = companies.filter((c) => c.status === 'SUSPENDED').length;
  const archivedCount = companies.filter((c) => c.status === 'ARCHIVED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-payroll-navy tracking-tight">
            Tenant Companies Directory
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage registered SaaS companies, isolated databases, storage metrics, and lifecycle states.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/platform/companies/new"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-sm transition-all shadow-md shadow-payroll-primary/20 border border-payroll-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Company</span>
          </Link>
        </div>
      </div>

      {/* PostgreSQL Health & Storage Summary Banner */}
      {reconcileReport && (
        <div className="bg-white border border-payroll-light rounded-2xl p-4 shadow-payroll-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-payroll-cream text-payroll-primary flex items-center justify-center border border-payroll-light">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-payroll-navy">
                  Total Isolated Tenant Storage:
                </span>
                <span className="text-xs font-mono font-bold text-payroll-primary bg-payroll-cream px-2 py-0.5 rounded border border-payroll-light">
                  {reconcileReport.totalTenantStorageFormatted}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {reconcileReport.hasDesync
                  ? "⚠️ Database desynchronization detected between PostgreSQL and Control Plane."
                  : "✓ All registered tenant databases are 100% synchronized with PostgreSQL."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCompaniesAndHealth}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-payroll-light bg-payroll-cream hover:bg-white text-payroll-navy text-xs font-semibold transition-all shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sync Status</span>
            </button>
          </div>
        </div>
      )}

      {/* Desync Warning & 1-Click Remediation Panel */}
      {reconcileReport && reconcileReport.hasDesync && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-payroll-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <h4 className="text-xs font-bold text-amber-900 uppercase">
              Database Reconciliation Required
            </h4>
          </div>

          {/* Missing in Postgres */}
          {reconcileReport.summary
            .filter((s) => s.status === "ORPHANED_METADATA")
            .map((orphan) => (
              <div
                key={orphan.companyId}
                className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-gray-900">
                    {orphan.displayName} ({orphan.companyCode})
                  </span>
                  <p className="text-[11px] text-rose-600 mt-0.5">
                    Database <code className="font-mono">{orphan.dbName}</code> is missing from PostgreSQL server (likely dropped in pgAdmin).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleReconcileAction("REPROVISION_MISSING_DB", orphan.companyId)
                    }
                    disabled={reconcileActionId === orphan.companyId}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Re-provision DB</span>
                  </button>
                  <button
                    onClick={() =>
                      handleReconcileAction("CLEANUP_ORPHANED_METADATA", orphan.companyId)
                    }
                    disabled={reconcileActionId === orphan.companyId}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clean Record</span>
                  </button>
                </div>
              </div>
            ))}

          {/* Unlinked Databases in Postgres */}
          {reconcileReport.unlinkedDatabases.map((unlinked) => (
            <div
              key={unlinked.dbName}
              className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-bold text-gray-900">
                  Unlinked Database: <code className="font-mono text-purple-700">{unlinked.dbName}</code>
                </span>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Size: {unlinked.sizeFormatted} (Exists in PostgreSQL but has no registered company record).
                </p>
              </div>

              <button
                onClick={() =>
                  handleReconcileAction("DROP_UNLINKED_DB", undefined, unlinked.dbName)
                }
                disabled={reconcileActionId === unlinked.dbName}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Drop Database</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="bg-white border border-payroll-light rounded-2xl p-4 shadow-payroll-sm space-y-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 pb-2 border-b border-payroll-light/60">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-payroll-navy text-white shadow-sm'
                : 'text-gray-600 hover:bg-payroll-cream'
            }`}
          >
            All Companies ({companies.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
            }`}
          >
            Pending Provision ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('SUSPENDED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'SUSPENDED'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
            }`}
          >
            Suspended ({suspendedCount})
          </button>
          <button
            onClick={() => setStatusFilter('ARCHIVED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ARCHIVED'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            Archived ({archivedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by legal name, company code (e.g. CMP-1111AF), or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-payroll-light bg-payroll-cream text-payroll-navy text-sm focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-payroll-light rounded-2xl shadow-payroll-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Loading tenant companies directory...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-gray-400 mx-auto" />
            <p className="text-gray-600 font-medium text-sm">No tenant companies match your filter.</p>
            <p className="text-gray-400 text-xs">Try selecting a different status filter tab or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-payroll-navy">
              <thead className="bg-payroll-cream text-xs font-semibold text-payroll-navy uppercase tracking-wider border-b border-payroll-light">
                <tr>
                  <th className="px-6 py-4">Company Details</th>
                  <th className="px-6 py-4">Company Code</th>
                  <th className="px-6 py-4">Database Identifier</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-payroll-light/60">
                {filtered.map((company) => (
                  <tr key={company.id} className="hover:bg-payroll-cream/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-payroll-navy">{company.displayName}</div>
                      <div className="text-xs text-gray-500">{company.legalName}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{company.contactEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-payroll-cream text-payroll-primary border border-payroll-light font-mono text-xs font-bold">
                        {company.companyCode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-mono font-semibold text-gray-700">pay_t_{company.slug}</div>
                      <div className="text-[11px] text-gray-400">Slug: {company.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      {company.status === 'ACTIVE' && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ACTIVE</span>
                        </span>
                      )}
                      {company.status === 'PENDING' && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>PENDING</span>
                        </span>
                      )}
                      {company.status === 'SUSPENDED' && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold">
                          <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
                          <span>SUSPENDED</span>
                        </span>
                      )}
                      {company.status === 'ARCHIVED' && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                          <Archive className="w-3.5 h-3.5 text-purple-600" />
                          <span>ARCHIVED</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {company.status === 'PENDING' && (
                        <button
                          onClick={() => handleProvision(company.id)}
                          disabled={provisioningId === company.id}
                          className="px-3 py-1.5 rounded-lg bg-payroll-primary hover:bg-payroll-primary-hover text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                        >
                          {provisioningId === company.id ? 'Provisioning...' : 'Approve & Provision'}
                        </button>
                      )}
                      <Link
                        href={`/platform/companies/${company.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-payroll-light bg-payroll-cream hover:bg-white text-payroll-navy text-xs font-semibold transition-all shadow-sm"
                      >
                        <span>Manage</span>
                        <ExternalLink className="w-3 h-3 text-payroll-primary" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

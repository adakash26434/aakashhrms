export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  ArrowRight,
  Database,
  Layers,
  ExternalLink,
} from "lucide-react";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { companies, tenantDatabases, platformPolicyPacks } from "@/lib/platform/schema";
import { desc, eq } from "drizzle-orm";

export default async function PlatformDashboardPage() {
  await ensurePlatformTablesExist();

  const [allCompanies, allDatabases, policyPacks] = await Promise.all([
    platformDb.select().from(companies).orderBy(desc(companies.createdAt)),
    platformDb.select().from(tenantDatabases),
    platformDb.select().from(platformPolicyPacks).where(eq(platformPolicyPacks.isPublished, true)).limit(1),
  ]);

  const activePolicyPack = policyPacks[0];
  const totalCompanies = allCompanies.length;
  const activeTenants = allCompanies.filter((c) => c.status === "ACTIVE").length;
  const pendingTenants = allCompanies.filter((c) => c.status === "PENDING").length;
  const recentCompanies = allCompanies.slice(0, 5);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-payroll-navy tracking-tight">
            Platform Control Dashboard
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage multi-tenant SaaS companies, database provisioning pipelines, and statutory policy packs.
          </p>
        </div>
        <Link
          href="/platform/companies/new"
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-sm transition-all shadow-md shadow-payroll-primary/20 border border-payroll-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Company</span>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm hover:shadow-payroll-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-payroll-navy/70 uppercase tracking-wider">
              Total Companies
            </span>
            <div className="p-2.5 rounded-xl bg-payroll-cream text-payroll-primary border border-payroll-light">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-payroll-navy">{totalCompanies}</span>
            <span className="text-xs text-payroll-primary font-semibold">
              Registered
            </span>
          </div>
        </div>

        <div className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm hover:shadow-payroll-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-payroll-navy/70 uppercase tracking-wider">
              Active Tenants
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-payroll-navy">{activeTenants}</span>
            <span className="text-xs text-emerald-700 font-semibold">
              Live Databases
            </span>
          </div>
        </div>

        <div className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm hover:shadow-payroll-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-payroll-navy/70 uppercase tracking-wider">
              Pending Provision
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-payroll-navy">{pendingTenants}</span>
            <span className="text-xs text-amber-700 font-semibold">
              Awaiting Pipeline
            </span>
          </div>
        </div>

        <div className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm hover:shadow-payroll-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-payroll-navy/70 uppercase tracking-wider">
              Statutory Pack
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-payroll-navy">
              v{activePolicyPack?.version || "1.0"}
            </span>
            <span className="text-xs text-purple-700 font-semibold">
              Labour Act 2074
            </span>
          </div>
        </div>
      </div>

      {/* Action Banners & Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-linear-to-br from-payroll-navy to-payroll-primary border border-payroll-navy rounded-2xl p-6 relative overflow-hidden text-white shadow-payroll-md">
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium border border-white/30">
              <Database className="w-3.5 h-3.5" />
              <span>Database-per-Tenant Engine</span>
            </div>
            <h2 className="text-xl font-bold text-white">
              Auto-Provisioning Engine Ready
            </h2>
            <p className="text-emerald-100 text-sm leading-relaxed">
              When you register and approve a company, the system creates an isolated database (
              <code className="text-white bg-black/20 px-1.5 py-0.5 rounded border border-white/20 font-mono">
                pay_t_slug
              </code>
              ), executes Drizzle migrations, and seeds standard statutory leave & OT rules.
            </p>
            <div className="pt-2">
              <Link
                href="/platform/companies/new"
                className="inline-flex items-center space-x-2 text-sm font-semibold text-white hover:text-emerald-200 transition-colors"
              >
                <span>Register a new tenant</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white border border-payroll-light rounded-2xl p-6 space-y-4 shadow-payroll-sm">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-payroll-cream text-payroll-primary text-xs font-medium border border-payroll-light">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Platform Lock Control</span>
          </div>
          <h2 className="text-xl font-bold text-payroll-navy">
            Statutory Rules Protection
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Statutory leave types (Home, Sick, Maternity, Paternity, Mourning, Public) and OT multipliers are managed via central Policy Packs. Tenant Office Admins cannot alter statutory parameters.
          </p>
          <div className="pt-2">
            <Link
              href="/platform/policies"
              className="inline-flex items-center space-x-2 text-sm font-semibold text-payroll-primary hover:text-payroll-primary-hover transition-colors"
            >
              <span>View Nepal Labour Act Policy Pack</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Live Companies Directory Section */}
      <div className="bg-white border border-payroll-light rounded-2xl p-6 shadow-payroll-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-payroll-navy">
              Recent Tenant Companies ({allCompanies.length})
            </h3>
            <p className="text-xs text-gray-500">
              Live sync from platform control database.
            </p>
          </div>
          <Link
            href="/platform/companies"
            className="text-xs font-semibold text-payroll-primary hover:text-payroll-primary-hover"
          >
            View all companies →
          </Link>
        </div>

        {recentCompanies.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-payroll-light rounded-xl bg-payroll-cream space-y-3">
            <div className="w-12 h-12 rounded-full bg-white border border-payroll-light flex items-center justify-center mx-auto text-payroll-primary shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <p className="text-gray-600 text-sm">
              No companies registered on the platform yet.
            </p>
            <div>
              <Link
                href="/platform/companies/new"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-xs transition-all shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register First Company</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-payroll-cream text-payroll-navy font-bold border-b border-payroll-light">
                <tr>
                  <th className="p-3">Company Code</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Database Identifier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentCompanies.map((comp) => {
                  const dbRecord = allDatabases.find((d) => d.companyId === comp.id);
                  const isLive = comp.status === "ACTIVE";

                  return (
                    <tr key={comp.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-payroll-primary">
                        {comp.companyCode}
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        {comp.displayName || comp.legalName}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-gray-700">
                        {dbRecord ? dbRecord.dbName : `pay_t_${comp.slug}`}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {comp.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/platform/companies/${comp.id}`}
                          className="font-bold text-payroll-primary hover:underline"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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
  Activity,
  Server,
  FileText,
} from "lucide-react";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { companies, tenantDatabases, platformPolicyPacks } from "@/lib/platform/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header Section ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            Platform Control Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Manage multi-tenant SaaS companies, database provisioning pipelines, and statutory policy packs.
          </p>
        </div>

        <Link href="/platform/companies/new">
          <Button className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Register New Company</span>
          </Button>
        </Link>
      </div>

      {/* ── Top Summary Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/60 py-2">
        {/* Total Companies */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Total registered companies</p>
              <Building2 className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {totalCompanies}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-100 text-xs text-zinc-400">
            Registered tenant organizations
          </div>
        </div>

        {/* Active Tenants */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Active live tenants</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {activeTenants}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-100 text-xs text-zinc-400">
            Provisioned isolated databases
          </div>
        </div>

        {/* Pending Provision */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Pending provision</p>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {pendingTenants}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-100 text-xs text-zinc-400">
            Awaiting pipeline deployment
          </div>
        </div>

        {/* Statutory Policy Pack */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Statutory policy pack</p>
              <Layers className="h-4 w-4 text-zinc-600" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                v{activePolicyPack?.version || "1.0"}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-100 text-xs text-zinc-400">
            Labour Act 2074 standards
          </div>
        </div>
      </div>

      {/* ── Architecture Hero Banners ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="border-payroll-navy bg-linear-to-br from-payroll-navy via-payroll-navy to-payroll-primary/90 text-white shadow-payroll-md overflow-hidden relative">
          <CardContent className="p-6 relative z-10 space-y-3.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-white text-xs font-semibold border border-white/20">
              <Database className="w-3.5 h-3.5 text-emerald-300" />
              <span>Database-per-Tenant Engine</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Auto-Provisioning Engine Ready
            </h2>
            <p className="text-emerald-100/90 text-xs leading-relaxed">
              When you register and approve a company, the system provisions an isolated PostgreSQL database (
              <code className="text-white bg-black/30 px-1.5 py-0.5 rounded border border-white/20 font-mono text-2xs">
                pay_t_slug
              </code>
              ), executes Drizzle migrations, and seeds statutory rules.
            </p>
            <div className="pt-1">
              <Link
                href="/platform/companies/new"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-emerald-200 transition-colors"
              >
                <span>Register a new tenant company</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-payroll-light/80 bg-white shadow-payroll-xs">
          <CardContent className="p-6 space-y-3.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-payroll-cream text-payroll-primary text-xs font-bold border border-payroll-light">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Statutory Compliance Protection</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-payroll-navy tracking-tight">
              Nepal Labour Act 2074 Enforcement
            </h2>
            <p className="text-gray-600 text-xs leading-relaxed">
              Statutory leave heads (Home, Sick, Maternity, Paternity, Mourning, Public) and overtime multipliers are governed centrally. Tenant Office Admins cannot tamper with statutory minimums.
            </p>
            <div className="pt-1">
              <Link
                href="/platform/policies"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-payroll-primary hover:text-payroll-primary-hover transition-colors"
              >
                <span>View statutory policy pack rules</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Live Companies Directory Section ── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Recent Tenant Companies ({allCompanies.length})
            </h3>
            <p className="text-2xs text-zinc-500 mt-0.5">
              Live sync from platform control database.
            </p>
          </div>
          <Link
            href="/platform/companies"
            className="text-xs font-semibold text-zinc-900 hover:text-emerald-700 transition-colors"
          >
            View all companies →
          </Link>
        </div>

        {recentCompanies.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-600 shadow-2xs">
              <Building2 className="w-6 h-6" />
            </div>
            <p className="text-zinc-900 font-semibold text-sm">
              No companies registered on the platform yet.
            </p>
            <p className="text-zinc-500 text-xs">
              Get started by registering your first SaaS client organization.
            </p>
            <div>
              <Link href="/platform/companies/new">
                <Button size="sm" className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-2xs mt-2">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Register First Company</span>
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-transparent text-2xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Company Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Database Identifier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {recentCompanies.map((comp) => {
                  const dbRecord = allDatabases.find((d) => d.companyId === comp.id);
                  const isLive = comp.status === "ACTIVE";

                  return (
                    <tr key={comp.id} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 font-mono text-xs font-medium">
                          {comp.companyCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-zinc-900">
                        {comp.displayName || comp.legalName}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-2xs text-zinc-500">
                        {dbRecord ? dbRecord.dbName : `pay_t_${comp.slug}`}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant={
                            isLive
                              ? "success"
                              : comp.status === "PENDING"
                              ? "warning"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {comp.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/platform/companies/${comp.id}`}
                          className="font-medium text-emerald-800 hover:text-emerald-900 hover:underline text-xs"
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

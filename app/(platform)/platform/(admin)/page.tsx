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

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Companies */}
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Total Companies
              </span>
              <div className="p-2.5 rounded-xl bg-payroll-cream text-payroll-primary border border-payroll-light shadow-2xs">
                <Building2 className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-payroll-navy">
                {totalCompanies}
              </span>
              <Badge variant="neutral" size="sm">
                Registered
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active Tenants */}
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Active Tenants
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-payroll-navy">
                {activeTenants}
              </span>
              <Badge variant="success" size="sm">
                Live DBs
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Pending Provision */}
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Pending Provision
              </span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                <Clock className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-payroll-navy">
                {pendingTenants}
              </span>
              <Badge variant="warning" size="sm">
                Awaiting Pipeline
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Statutory Policy Pack */}
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Statutory Pack
              </span>
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                <Layers className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-payroll-navy">
                v{activePolicyPack?.version || "1.0"}
              </span>
              <Badge variant="info" size="sm">
                Labour Act 2074
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Architecture Hero Banners ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="border-payroll-navy bg-gradient-to-br from-payroll-navy via-payroll-navy to-payroll-primary/90 text-white shadow-payroll-md overflow-hidden relative">
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
              <code className="text-white bg-black/30 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[11px]">
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
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-payroll-light/60 flex items-center justify-between bg-payroll-cream/40">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-payroll-navy">
              Recent Tenant Companies ({allCompanies.length})
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Live sync from platform control database.
            </p>
          </div>
          <Link
            href="/platform/companies"
            className="text-xs font-bold text-payroll-primary hover:underline"
          >
            View all companies →
          </Link>
        </div>

        {recentCompanies.length === 0 ? (
          <CardContent className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-payroll-cream border border-payroll-light flex items-center justify-center mx-auto text-payroll-primary shadow-2xs">
              <Building2 className="w-6 h-6" />
            </div>
            <p className="text-payroll-navy font-bold text-sm">
              No companies registered on the platform yet.
            </p>
            <p className="text-gray-500 text-xs">
              Get started by registering your first SaaS client organization.
            </p>
            <div>
              <Link href="/platform/companies/new">
                <Button size="sm" className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-xs mt-2">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Register First Company</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-payroll-cream/70 text-payroll-navy font-bold border-b border-payroll-light text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Company Code</th>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Database Identifier</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-payroll-light/50 bg-white">
                {recentCompanies.map((comp) => {
                  const dbRecord = allDatabases.find((d) => d.companyId === comp.id);
                  const isLive = comp.status === "ACTIVE";

                  return (
                    <tr key={comp.id} className="hover:bg-payroll-cream/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-payroll-primary">
                        {comp.companyCode}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-payroll-navy">
                        {comp.displayName || comp.legalName}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-gray-600">
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
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/platform/companies/${comp.id}`}
                          className="font-bold text-payroll-primary hover:underline text-xs"
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
      </Card>
    </div>
  );
}

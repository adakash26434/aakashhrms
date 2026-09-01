import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { companies, tenantDatabases } from "@/lib/platform/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft, Database, CheckCircle2 } from "lucide-react";
import { ViewCompanyActions } from "@/components/platform/view-company-actions";
import { DatabaseCredentialsCard } from "@/components/platform/database-credentials-card";
import { CompanyLifecycleCard } from "@/components/platform/company-lifecycle-card";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePlatformTablesExist();
  const { id } = await params;

  const [company] = await platformDb
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);

  if (!company) {
    notFound();
  }

  const [tenantDbRecord] = await platformDb
    .select()
    .from(tenantDatabases)
    .where(eq(tenantDatabases.companyId, id))
    .limit(1);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center space-x-3">
        <Link
          href="/platform/companies"
          className="p-2 rounded-xl bg-white border border-payroll-light text-payroll-navy hover:bg-payroll-cream transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-payroll-navy tracking-tight">
              {company.displayName}
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-payroll-cream border border-payroll-light text-payroll-primary font-mono text-xs font-bold shadow-sm">
              {company.companyCode}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{company.legalName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Profile Card */}
          <div className="bg-white border border-payroll-light rounded-2xl p-6 space-y-6 shadow-payroll-sm">
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider border-b border-payroll-light/60 pb-3 flex items-center justify-between">
              <span>Company Information</span>
              {company.status === "ACTIVE" && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active SaaS Tenant</span>
                </span>
              )}
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-gray-500 block">
                  Database Identifier
                </span>
                <span className="text-payroll-navy font-mono font-semibold mt-1 block">
                  pay_t_{company.slug}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">
                  Contact Email (Office Admin)
                </span>
                <span className="text-payroll-navy font-medium mt-1 block">
                  {company.contactEmail}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">
                  Registered Date
                </span>
                <span className="text-payroll-navy font-medium mt-1 block">
                  {company.registeredAt}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">
                  Contact Phone
                </span>
                <span className="text-payroll-navy font-medium mt-1 block">
                  {company.contactPhone || "—"}
                </span>
              </div>
            </div>

            {company.notes && (
              <div className="pt-3 border-t border-payroll-light/60">
                <span className="text-xs text-gray-500 block mb-1">
                  Super Admin Notes
                </span>
                <p className="text-xs text-gray-700 bg-payroll-cream p-3 rounded-xl border border-payroll-light">
                  {company.notes}
                </p>
              </div>
            )}
          </div>

          {/* Database Credentials & Connection Tooling Card */}
          <DatabaseCredentialsCard
            companyId={company.id}
            companySlug={company.slug}
            companyCode={company.companyCode}
            initialDbName={tenantDbRecord?.dbName}
          />

          {/* Tenant Lifecycle & Decommissioning / Purge Card */}
          <CompanyLifecycleCard
            companyId={company.id}
            companyCode={company.companyCode}
            legalName={company.legalName}
            slug={company.slug}
            status={company.status}
            archivedAt={
              company.archivedAt
                ? new Date(company.archivedAt).toISOString()
                : null
            }
            suspendedAt={
              company.suspendedAt
                ? new Date(company.suspendedAt).toISOString()
                : null
            }
          />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-payroll-light rounded-2xl p-6 space-y-4 shadow-payroll-sm">
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider border-b border-payroll-light/60 pb-2">
              Status Summary
            </h3>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-gray-500 block">
                  Registration Status
                </span>
                <span className="text-sm font-bold text-payroll-navy mt-0.5 block">
                  {company.status}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">
                  Policy Pack Version
                </span>
                <span className="text-xs text-purple-700 font-mono font-bold mt-0.5 block">
                  v{company.policyPackVersion} (Nepal Labour Act)
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">
                  Provisioned Timestamp
                </span>
                <span className="text-xs text-gray-700 mt-0.5 block">
                  {company.provisionedAt
                    ? new Date(company.provisionedAt).toLocaleString()
                    : "Not yet provisioned"}
                </span>
              </div>
            </div>
          </div>

          {/* View Company Data Actions */}
          {company.status === "ACTIVE" && (
            <ViewCompanyActions
              companyId={company.id}
              companyName={company.displayName}
            />
          )}
        </div>
      </div>
    </div>
  );
}

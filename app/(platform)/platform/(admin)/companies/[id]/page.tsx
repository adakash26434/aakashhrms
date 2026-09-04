import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { companies, tenantDatabases } from "@/lib/platform/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft, Database, CheckCircle2, Building2, Calendar, Mail, Phone, Layers } from "lucide-react";
import { ViewCompanyActions } from "@/components/platform/view-company-actions";
import { DatabaseCredentialsCard } from "@/components/platform/database-credentials-card";
import { CompanyLifecycleCard } from "@/components/platform/company-lifecycle-card";
import { EditCompanyModal } from "@/components/platform/edit-company-modal";
import { AdminPasswordResetCard } from "@/components/platform/admin-password-reset-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDUSTRY_SECTORS, IndustrySectorKey } from "@/lib/constants/industry-types";

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
      {/* ── Top Header Bar ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/platform/companies"
          className="p-2 rounded-xl bg-white border border-payroll-light/80 text-payroll-navy hover:bg-payroll-cream transition-all shadow-payroll-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
                {company.displayName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg bg-payroll-cream border border-payroll-light text-payroll-primary font-mono text-xs font-bold shadow-2xs">
                {company.companyCode}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{company.legalName}</p>
          </div>

          <EditCompanyModal
            company={{
              id: company.id,
              companyCode: company.companyCode,
              displayName: company.displayName,
              legalName: company.legalName,
              contactEmail: company.contactEmail,
              contactPhone: company.contactPhone,
              industryType: company.industryType,
              notes: company.notes,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left / Main Column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Profile Card */}
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4.5 h-4.5 text-payroll-primary" />
                  <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Company Information
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {company.status === "ACTIVE" && (
                    <Badge variant="success" size="sm" className="font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      <span>Active SaaS Tenant</span>
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Database Identifier
                  </span>
                  <span className="text-payroll-navy font-mono font-bold mt-1 block">
                    pay_t_{company.slug}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Contact Email (Office Admin)
                  </span>
                  <span className="text-payroll-navy font-semibold mt-1 block truncate">
                    {company.contactEmail}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Registered Date
                  </span>
                  <span className="text-payroll-navy font-semibold mt-1 block">
                    {company.registeredAt}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Contact Phone
                  </span>
                  <span className="text-payroll-navy font-semibold mt-1 block">
                    {company.contactPhone || "—"}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60 sm:col-span-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Organization Industry Sector (श्रेणी / Shreni Scale)
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-payroll-primary font-bold text-xs">
                      {INDUSTRY_SECTORS[company.industryType as IndustrySectorKey]?.label || company.industryType || "General"}
                    </span>
                    <span className="text-gray-500 text-xs">
                      ({INDUSTRY_SECTORS[company.industryType as IndustrySectorKey]?.labelNepali || "सामान्य"})
                    </span>
                    <Badge variant="info" size="sm" className="ml-auto text-[10px] font-semibold text-payroll-primary border-payroll-primary/30">
                      Super Admin Managed
                    </Badge>
                  </div>
                </div>
              </div>

              {company.notes && (
                <div className="pt-3 border-t border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                    Super Admin Notes
                  </span>
                  <p className="text-xs text-gray-700 bg-payroll-cream/60 p-3 rounded-xl border border-payroll-light leading-relaxed">
                    {company.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

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

        {/* ── Right Sidebar Column ── */}
        <div className="space-y-6">
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-payroll-light/60 pb-2.5">
                <Layers className="w-4 h-4 text-payroll-primary" />
                <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                  Status & Compliance
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Registration Status
                  </span>
                  <Badge
                    variant={
                      company.status === "ACTIVE"
                        ? "success"
                        : company.status === "PENDING"
                        ? "warning"
                        : "neutral"
                    }
                    size="sm"
                    className="mt-1 font-bold"
                  >
                    {company.status}
                  </Badge>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Policy Pack Version
                  </span>
                  <span className="text-xs text-purple-700 font-mono font-bold mt-0.5 block">
                    v{company.policyPackVersion} (Nepal Labour Act)
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Provisioned Timestamp
                  </span>
                  <span className="text-xs text-gray-700 mt-0.5 block">
                    {company.provisionedAt
                      ? new Date(company.provisionedAt).toLocaleString()
                      : "Not yet provisioned"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Company Data Actions */}
          {company.status === "ACTIVE" && (
            <>
              <ViewCompanyActions
                companyId={company.id}
                companyName={company.displayName}
              />
              <AdminPasswordResetCard
                companyId={company.id}
                companyName={company.displayName}
                currentEmail={company.contactEmail}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

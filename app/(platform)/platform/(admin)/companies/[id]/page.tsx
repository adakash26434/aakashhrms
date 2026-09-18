import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { companies, tenantDatabases, companyChangeRequests } from "@/lib/platform/schema";
import { taxRateSlabs } from "@/lib/db/schema";
import { getTenantDb } from "@/lib/db/tenant-pool-manager";
import { DEFAULT_NEPAL_POLICY_PACK_V1 } from "@/lib/platform/policy-pack-data";
import { eq, desc } from "drizzle-orm";
import {
  ArrowLeft,
  CheckCircle2,
  Building2,
  Calendar,
  Layers,
  GitBranch,
  Palmtree,
  Coins,
  Percent,
  Clock,
  MapPin,
  Hash,
  FileText,
  Shield,
  ShieldAlert,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { ViewCompanyActions } from "@/components/platform/view-company-actions";
import { DatabaseCredentialsCard } from "@/components/platform/database-credentials-card";
import { CompanyLifecycleCard } from "@/components/platform/company-lifecycle-card";
import { EditCompanyModal } from "@/components/platform/edit-company-modal";
import { AdminPasswordResetCard } from "@/components/platform/admin-password-reset-card";
import { Card, CardContent } from "@/components/ui/card";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const initialSetup = (company.initialSetupPayload as any) || {};
  const activeFY = initialSetup.fiscalYear;
  const leaveTypes = initialSetup.leaveTypes || [];
  const otMultiplier = initialSetup.otHourlyMultiplier ?? 1.5;
  const payHeads = initialSetup.payHeads || [];

  // Tax slabs resolution: live tenant DB > initialSetupPayload > statutory policy pack baseline
  let liveTaxSlabs: Array<{
    category: string;
    amountFrom: string;
    amountTo: string | null;
    ratePercent: string;
    fixedDeduction: string;
  }> =
    initialSetup.taxSlabs && initialSetup.taxSlabs.length > 0
      ? initialSetup.taxSlabs
      : [];

  if (company.slug) {
    try {
      const tenantDb = await getTenantDb(company.slug);
      if (tenantDb) {
        const dbSlabs = await tenantDb
          .select()
          .from(taxRateSlabs)
          .orderBy(taxRateSlabs.category, taxRateSlabs.amountFrom);
        if (dbSlabs && dbSlabs.length > 0) {
          liveTaxSlabs = dbSlabs.map((s) => ({
            category: s.category,
            amountFrom: String(s.amountFrom),
            amountTo:
              s.amountTo !== null && s.amountTo !== undefined && s.amountTo !== ""
                ? String(s.amountTo)
                : null,
            ratePercent: String(s.ratePercent),
            fixedDeduction: String(s.fixedDeduction || "0"),
          }));
        }
      }
    } catch (err) {
      console.warn("[CompanyDetailPage] Failed to fetch live tax slabs from tenant DB:", err);
    }
  }

  if (!liveTaxSlabs || liveTaxSlabs.length === 0) {
    liveTaxSlabs = (DEFAULT_NEPAL_POLICY_PACK_V1.taxSlabsBaseline || []).map(
      (s) => ({
        category: s.category,
        amountFrom: String(s.amountFrom),
        amountTo:
          s.amountTo !== null && s.amountTo !== undefined && s.amountTo !== ""
            ? String(s.amountTo)
            : null,
        ratePercent: String(s.ratePercent),
        fixedDeduction: String(s.fixedDeduction || "0"),
      })
    );
  }

  const earnings = payHeads.filter((p: any) => p.type === "EARNING");
  const deductions = payHeads.filter((p: any) => p.type === "DEDUCTION");

  const companyModalProps = {
    id: company.id,
    companyCode: company.companyCode,
    displayName: company.displayName,
    legalName: company.legalName,
    slug: company.slug,
    status: company.status,
    contactEmail: company.contactEmail,
    contactPhone: company.contactPhone,
    industryType: company.industryType,
    panVatNumber: company.panVatNumber,
    registrationNumber: company.registrationNumber,
    headOfficeAddress: company.headOfficeAddress,
    headOfficeBranchCode: company.headOfficeBranchCode,
    headOfficeBranchAddress: company.headOfficeBranchAddress,
    notes: company.notes,
    initialSetupPayload: {
      ...initialSetup,
      taxSlabs: liveTaxSlabs,
    },
  };

  const changeRequests = await platformDb
    .select()
    .from(companyChangeRequests)
    .where(eq(companyChangeRequests.companyId, id))
    .orderBy(desc(companyChangeRequests.createdAt))
    .limit(5);

  const pendingRequest = changeRequests.find((r) => r.status === "PENDING");

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

          <div className="flex items-center gap-2">
            <EditCompanyModal
              company={companyModalProps}
              buttonLabel="Edit Company Configuration"
              buttonVariant="primary"
            />
          </div>
        </div>
      </div>

      {/* ── Pending Verification Alert Banner ── */}
      {pendingRequest && (
        <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 via-amber-50/70 to-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-950">
                  Pending Statutory Data Change Request
                </h4>
                <Badge variant="warning" size="sm">
                  Awaiting Super Admin Review
                </Badge>
              </div>
              <p className="text-xs text-amber-900/80 mt-0.5">
                Submitted by <strong>{pendingRequest.requestedByUserEmail}</strong> on{" "}
                {new Date(pendingRequest.createdAt).toLocaleDateString()}.
              </p>
              <div className="text-xs text-amber-900/90 font-medium mt-1">
                <strong>Reason:</strong> {pendingRequest.reason}
              </div>
            </div>
          </div>

          <Link href="/platform/change-requests">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1 shrink-0 shadow-xs"
            >
              <span>Review in Change Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left / Main Column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1: Company Profile Card */}
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4.5 h-4.5 text-payroll-primary" />
                  <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    1. Company Legal Profile
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {company.status === "ACTIVE" && (
                    <Badge variant="success" size="sm" className="font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      <span>Active SaaS Tenant</span>
                    </Badge>
                  )}
                  <EditCompanyModal
                    company={companyModalProps}
                    initialTab="profile"
                    buttonLabel="Edit Profile"
                    buttonVariant="outline"
                    buttonSize="xs"
                  />
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
                    PAN / VAT Number
                  </span>
                  <span className="text-payroll-navy font-mono font-bold mt-1 block">
                    {company.panVatNumber || "—"}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    OCR Registration Number
                  </span>
                  <span className="text-payroll-navy font-semibold mt-1 block">
                    {company.registrationNumber || "—"}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Company Head Office Address
                  </span>
                  <span className="text-payroll-navy font-semibold mt-1 block">
                    {company.headOfficeAddress || "—"}
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
                    Organization Industry Sector (संस्थाको क्षेत्र / प्रकृति)
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

          {/* SECTION 2: Head Office Branch Setup */}
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4.5 h-4.5 text-payroll-primary" />
                  <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    2. Primary Head Office Branch
                  </h3>
                </div>
                <EditCompanyModal
                  company={companyModalProps}
                  initialTab="branch"
                  buttonLabel="Edit Branch"
                  buttonVariant="outline"
                  buttonSize="xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Branch Code
                  </span>
                  <span className="text-payroll-navy font-mono font-bold text-sm mt-1 block">
                    {company.headOfficeBranchCode || "HO-01"}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Branch Address / Location
                  </span>
                  <span className="text-payroll-navy font-semibold mt-1 block">
                    {company.headOfficeBranchAddress || company.headOfficeAddress || "Head Office Location"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3: Active Fiscal Year Setup */}
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4.5 h-4.5 text-payroll-primary" />
                  <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    3. Active Fiscal Year Setup
                  </h3>
                </div>
                <EditCompanyModal
                  company={companyModalProps}
                  initialTab="fiscal-year"
                  buttonLabel="Edit Fiscal Year"
                  buttonVariant="outline"
                  buttonSize="xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Fiscal Cycle
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-payroll-navy font-bold text-sm">
                      {activeFY?.label || "2081/82"}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </div>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Bikram Sambat (BS) Range
                  </span>
                  <span className="text-payroll-navy font-mono font-bold mt-1 block">
                    {activeFY?.startDateBS || "2081-04-01"} ~ {activeFY?.endDateBS || "2082-03-31"}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Gregorian (AD) Range
                  </span>
                  <span className="text-payroll-navy font-mono font-medium mt-1 block">
                    {activeFY?.startDateAD ? String(activeFY.startDateAD).slice(0, 10) : "2024-07-16"} ~{" "}
                    {activeFY?.endDateAD ? String(activeFY.endDateAD).slice(0, 10) : "2025-07-15"}
                  </span>
                </div>

                <div className="bg-payroll-cream/40 p-3 rounded-xl border border-payroll-light/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Cycle Months
                  </span>
                  <span className="text-payroll-navy font-bold mt-1 block">
                    {activeFY?.fromMonth && activeFY?.toMonth
                      ? `${BS_MONTHS_EN[activeFY.fromMonth]} to ${BS_MONTHS_EN[activeFY.toMonth]}`
                      : "Shrawan to Asar"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 4: Statutory Leaves & Overtime */}
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3">
                <div className="flex items-center gap-2">
                  <Palmtree className="w-4.5 h-4.5 text-payroll-primary" />
                  <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    4. Statutory Leaves & Overtime ({leaveTypes.length} Policies)
                  </h3>
                </div>
                <EditCompanyModal
                  company={companyModalProps}
                  initialTab="leaves"
                  buttonLabel="Edit Leaves & OT"
                  buttonVariant="outline"
                  buttonSize="xs"
                />
              </div>

              {/* Overtime multiplier banner */}
              <div className="p-3 bg-payroll-cream/30 rounded-xl border border-payroll-light/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-payroll-primary" />
                  <span className="font-semibold text-payroll-navy">
                    Overtime Multiplier Rate:
                  </span>
                </div>
                <span className="font-mono font-bold text-payroll-primary bg-white px-2.5 py-0.5 rounded-md border border-payroll-light shadow-2xs">
                  {otMultiplier}x Basic Hourly Wage
                </span>
              </div>

              {/* Leave chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {leaveTypes.map((lt: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white rounded-xl border border-payroll-light/80 shadow-2xs flex items-center justify-between gap-1"
                  >
                    <div>
                      <span className="font-bold text-payroll-navy block truncate">
                        {lt.name}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {lt.isPaid ? "Paid" : "Unpaid"} • {lt.isEncashable ? "Encashable" : "No-encash"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-payroll-primary font-mono shrink-0">
                      {lt.daysPerYear}d
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SECTION 5: Standard Pay Heads */}
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-4.5 h-4.5 text-payroll-primary" />
                  <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    5. Standard Pay Heads ({earnings.length} Earnings, {deductions.length} Deductions)
                  </h3>
                </div>
                <EditCompanyModal
                  company={companyModalProps}
                  initialTab="pay-heads"
                  buttonLabel="Edit Pay Heads"
                  buttonVariant="outline"
                  buttonSize="xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Earnings List */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-payroll-light/60">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-bold text-payroll-navy uppercase text-[10px]">
                      Earnings
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {earnings.map((ph: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 bg-payroll-cream/20 rounded-lg border border-payroll-light flex items-center justify-between"
                      >
                        <span className="font-medium text-payroll-navy">{ph.name}</span>
                        <span className="font-mono text-[10px] font-bold text-gray-500">{ph.code}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deductions List */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-payroll-light/60">
                    <ArrowDownRight className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-bold text-payroll-navy uppercase text-[10px]">
                      Deductions
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {deductions.map((ph: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 bg-payroll-cream/20 rounded-lg border border-payroll-light flex items-center justify-between"
                      >
                        <span className="font-medium text-payroll-navy">{ph.name}</span>
                        <span className="font-mono text-[10px] font-bold text-gray-500">{ph.code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 6: Nepal IRD Tax Slabs */}
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-payroll-light/60 pb-3">
                <div className="flex items-center gap-2">
                  <Percent className="w-4.5 h-4.5 text-payroll-primary" />
                  <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    6. Nepal IRD Progressive Income Tax Slabs{" "}
                    {activeFY?.label ? `(${activeFY.label})` : ""}
                  </h3>
                </div>
                <EditCompanyModal
                  company={companyModalProps}
                  initialTab="tax-slabs"
                  buttonLabel="Edit Tax Slabs"
                  buttonVariant="outline"
                  buttonSize="xs"
                />
              </div>

              {/* Dynamic Slabs Cards */}
              {(() => {
                const preferredCategories = [
                  "Normal Single",
                  "Married",
                  "Handicapped",
                ];
                const presentCategories = Array.from(
                  new Set(liveTaxSlabs.map((s) => s.category))
                );
                const orderedCategories = [
                  ...preferredCategories.filter((cat) =>
                    presentCategories.includes(cat)
                  ),
                  ...presentCategories.filter(
                    (cat) => !preferredCategories.includes(cat)
                  ),
                ];

                const categoryMetadata: Record<
                  string,
                  { label: string; badge: string; badgeClass: string }
                > = {
                  "Normal Single": {
                    label: "Normal Single Individual",
                    badge: "Standard",
                    badgeClass:
                      "bg-emerald-50 text-emerald-800 border-emerald-200",
                  },
                  Married: {
                    label: "Married Couple",
                    badge: "Joint",
                    badgeClass:
                      "bg-blue-50 text-blue-800 border-blue-200",
                  },
                  Handicapped: {
                    label: "Handicapped",
                    badge: "Concessional",
                    badgeClass:
                      "bg-amber-50 text-amber-800 border-amber-200",
                  },
                };

                return (
                  <div
                    className={`grid grid-cols-1 ${
                      orderedCategories.length >= 3
                        ? "sm:grid-cols-3"
                        : "sm:grid-cols-2"
                    } gap-3 text-xs`}
                  >
                    {orderedCategories.map((cat) => {
                      const meta = categoryMetadata[cat] || {
                        label: cat,
                        badge: "Custom",
                        badgeClass:
                          "bg-gray-50 text-gray-700 border-gray-200",
                      };
                      const slabs = liveTaxSlabs
                        .filter((s) => s.category === cat)
                        .sort(
                          (a, b) =>
                            Number(a.amountFrom) - Number(b.amountFrom)
                        );

                      return (
                        <div
                          key={cat}
                          className="p-3.5 bg-payroll-cream/30 rounded-xl border border-payroll-light/80 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <h5 className="font-bold text-payroll-navy text-xs">
                                {meta.label}
                              </h5>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${meta.badgeClass}`}
                              >
                                {meta.badge}
                              </span>
                            </div>
                            <ul className="space-y-1 text-[11px] text-gray-600">
                              {slabs.map((slab, i) => {
                                const fromNum = Number(slab.amountFrom);
                                const fromStr = isNaN(fromNum)
                                  ? String(slab.amountFrom)
                                  : fromNum.toLocaleString();
                                const toNum =
                                  slab.amountTo !== null &&
                                  slab.amountTo !== undefined
                                    ? Number(slab.amountTo)
                                    : null;
                                const toStr =
                                  toNum !== null && !isNaN(toNum)
                                    ? toNum.toLocaleString()
                                    : null;
                                const rangeLabel = toStr
                                  ? `${fromStr} - ${toStr}`
                                  : `Above ${fromStr}`;
                                const isSst =
                                  i === 0 && Number(slab.ratePercent) <= 1;

                                return (
                                  <li
                                    key={i}
                                    className="flex justify-between items-center py-1 border-b border-payroll-light/50 last:border-0"
                                  >
                                    <span className="font-mono text-[10.5px]">
                                      {rangeLabel}
                                    </span>
                                    <strong className="text-payroll-navy font-bold">
                                      {Number(slab.ratePercent)}%
                                      {isSst && " (SST)"}
                                    </strong>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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

          {/* Statutory Verification Requests Card */}
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-payroll-light/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-payroll-primary" />
                  <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Statutory Change Requests
                  </h3>
                </div>
                <Link
                  href="/platform/change-requests"
                  className="text-[11px] font-semibold text-payroll-primary hover:underline flex items-center gap-0.5"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {changeRequests.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-2">
                  No statutory change requests recorded for this company.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {changeRequests.map((cr) => (
                    <div
                      key={cr.id}
                      className="p-2.5 rounded-xl border border-payroll-light/80 bg-payroll-cream/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-payroll-navy">
                          {cr.status === "PENDING"
                            ? "Pending Review"
                            : cr.status === "APPROVED"
                            ? "Approved & Synced"
                            : cr.status === "REJECTED"
                            ? "Rejected"
                            : "Cancelled"}
                        </span>
                        <Badge
                          variant={
                            cr.status === "APPROVED"
                              ? "success"
                              : cr.status === "PENDING"
                              ? "warning"
                              : cr.status === "REJECTED"
                              ? "danger"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {cr.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-gray-600 truncate">
                        {cr.reason}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {new Date(cr.createdAt).toLocaleDateString()} by {cr.requestedByUserEmail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

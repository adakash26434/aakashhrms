"use client";

import React, { useState } from "react";
import {
  Layers,
  CheckCircle2,
  Lock,
  RefreshCw,
  Edit3,
  ShieldCheck,
  Palmtree,
  Clock,
  Coins,
  Gift,
  Percent,
  Building2,
  AlertCircle,
  X,
  FileText,
  HelpCircle,
  Loader2,
} from "lucide-react";
import {
  StatutoryPolicyPackPayload,
  StatutoryLeaveRule,
  StatutoryOtRule,
  StatutoryDeductionRule,
  StatutoryBenefitRule,
} from "@/lib/platform/policy-pack-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Props {
  initialPack: {
    id: string;
    version: number;
    name: string;
    payload: StatutoryPolicyPackPayload;
    isPublished: boolean;
    publishedAt: string;
  };
  activeTenantsCount: number;
}

export function PolicyPackManager({ initialPack, activeTenantsCount }: Props) {
  const [pack, setPack] = useState<StatutoryPolicyPackPayload>(
    initialPack.payload,
  );
  const [activeTab, setActiveTab] = useState<
    "leaves" | "overtime" | "deductions" | "benefits" | "tax"
  >("leaves");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    syncedCount?: number;
    syncedCompanies?: Array<{ name: string; slug: string }>;
  } | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPack, setEditingPack] =
    useState<StatutoryPolicyPackPayload>(pack);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  // Sync to all tenant databases
  const handleSyncToTenants = async () => {
    if (
      !confirm(
        `Are you sure you want to broadcast and synchronize Policy Pack v${pack.version} to all ${activeTenantsCount} active tenant databases? This will enforce statutory parameters across all client companies.`,
      )
    ) {
      return;
    }

    try {
      setIsSyncing(true);
      setSyncResult(null);

      const res = await fetch("/api/platform/policies/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: pack.version }),
      });
      const data = await res.json();

      if (data.success) {
        setSyncResult({
          success: true,
          message: data.message,
          syncedCount: data.syncedCount,
          syncedCompanies: data.syncedCompanies,
        });
        toast.success(`Broadcast complete: synchronized with ${data.syncedCount || 0} tenant databases.`);
      } else {
        setSyncResult({
          success: false,
          message: data.error || "Failed to sync policy pack.",
        });
        toast.error(data.error || "Failed to broadcast policy pack.");
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || "Network error while syncing.",
      });
      toast.error(err.message || "Network error while syncing.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Save updated policy pack
  const handleSavePack = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      const res = await fetch("/api/platform/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: editingPack.version,
          name: editingPack.name,
          payload: editingPack,
          isPublished: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPack(editingPack);
        toast.success("Statutory policy pack updated successfully!");
        setIsEditModalOpen(false);
      } else {
        toast.error(`Error saving policy pack: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
              Statutory Policy Packs & Compliance Engine
            </h1>
            <Badge variant="success" size="sm" className="font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>ACTIVE PLATFORM PACK</span>
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Central statutory compliance parameters enforced across all tenant company databases (Nepal Labour Act 2074 & SSF Act).
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingPack(JSON.parse(JSON.stringify(pack)));
              setIsEditModalOpen(true);
            }}
            className="text-xs font-bold shadow-payroll-xs"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1.5 text-payroll-primary" />
            <span>Edit Policy Rules</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSyncToTenants}
            isLoading={isSyncing}
            disabled={isSyncing}
            className="bg-payroll-primary hover:bg-payroll-primary-hover text-white text-xs font-bold shadow-payroll-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isSyncing && "animate-spin")} />
            <span>{isSyncing ? "Broadcasting..." : "Sync to All Active Tenants"}</span>
          </Button>
        </div>
      </div>

      {/* ── Sync Notification Banner ── */}
      {syncResult && (
        <Card
          className={cn(
            "border shadow-payroll-xs animate-[fadeIn_150ms_ease-out]",
            syncResult.success
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              : "bg-rose-50/70 border-rose-200 text-rose-900",
          )}
        >
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {syncResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-bold">{syncResult.message}</p>
                {syncResult.syncedCompanies && syncResult.syncedCompanies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {syncResult.syncedCompanies.map((c, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-[11px] font-mono text-emerald-800 font-semibold shadow-2xs"
                      >
                        {c.name} ({c.slug})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* ── Compliance Status Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Active Policy Pack
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-payroll-navy">
                v{pack.version}.0
              </span>
              <Badge variant="info" size="sm" className="font-bold">
                Nepal Labour Act
              </Badge>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 truncate">{pack.name}</p>
          </CardContent>
        </Card>

        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Statutory Rules Count
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-payroll-navy">
                {(pack.leaveRules?.length || 0) +
                  (pack.otRules?.length || 0) +
                  (pack.statutoryDeductions?.length || 0) +
                  (pack.statutoryBenefits?.length || 0)}
              </span>
              <Badge variant="success" size="sm" className="font-bold">
                Complete Set
              </Badge>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Leaves, OT, SSF, Bonus</p>
          </CardContent>
        </Card>

        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Active Tenants Governed
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-payroll-navy">
                {activeTenantsCount}
              </span>
              <Badge variant="neutral" size="sm" className="font-bold">
                Live Databases
              </Badge>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Directly synchronized</p>
          </CardContent>
        </Card>

        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Platform Protection
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-payroll-primary">
                100% LOCKED
              </span>
              <Lock className="w-4.5 h-4.5 text-payroll-primary" />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Immutable by tenant admins</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Category Navigation Tabs ── */}
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="p-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTab("leaves")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
              activeTab === "leaves"
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
            )}
          >
            <Palmtree className="w-4 h-4" />
            <span>Statutory Leaves ({pack.leaveRules?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("overtime")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
              activeTab === "overtime"
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
            )}
          >
            <Clock className="w-4 h-4" />
            <span>Overtime Rules ({pack.otRules?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("deductions")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
              activeTab === "deductions"
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
            )}
          >
            <Coins className="w-4 h-4" />
            <span>SSF & Deductions ({pack.statutoryDeductions?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("benefits")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
              activeTab === "benefits"
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
            )}
          >
            <Gift className="w-4 h-4" />
            <span>Statutory Bonus ({pack.statutoryBenefits?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("tax")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
              activeTab === "tax"
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
            )}
          >
            <Percent className="w-4 h-4" />
            <span>Tax Slabs Baseline</span>
          </button>
        </CardContent>
      </Card>

      {/* ── Tab Content: Statutory Leaves ── */}
      {activeTab === "leaves" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Mandatory Leave Types (Nepal Labour Act 2074 Section 40–45)
            </h3>
            <span className="text-xs text-gray-500">
              Enforced on all tenant company leave modules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pack.leaveRules?.map((rule, idx) => (
              <Card
                key={idx}
                className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-payroll-navy">
                          {rule.name}
                        </h4>
                        <span className="text-xs text-payroll-primary font-bold">
                          {rule.nepaliName}
                        </span>
                      </div>
                      <Badge variant="neutral" size="sm" className="font-mono font-bold shrink-0 bg-payroll-cream text-payroll-primary border border-payroll-light">
                        <Lock className="w-3 h-3 mr-1" />
                        <span>LOCKED</span>
                      </Badge>
                    </div>

                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      {rule.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-payroll-light/60 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-gray-500 block">Annual Days:</span>
                        <strong className="text-payroll-navy font-bold">{rule.daysPerYear} Days</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Max Accumulation:</span>
                        <strong className="text-payroll-navy font-bold">
                          {rule.maxAccumulation > 0 ? `${rule.maxAccumulation} Days` : "No Accumulation"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Pay Status:</span>
                        <strong className="text-payroll-navy font-bold">{rule.leaveType}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Encashable:</span>
                        <strong className="text-payroll-navy font-bold">
                          {rule.isEncashable ? "Yes (Basic Salary)" : "No"}
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-payroll-primary bg-payroll-cream/70 p-2 rounded-lg border border-payroll-light">
                      <span>Code: {rule.code}</span>
                      <span className="text-[10px] text-gray-500">{rule.legalSection}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Content: Overtime Rules ── */}
      {activeTab === "overtime" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Statutory Overtime Calculation Rules (Nepal Labour Act 2074 Section 31)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pack.otRules?.map((rule, idx) => (
              <Card
                key={idx}
                className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-payroll-navy">
                        {rule.name}
                      </h4>
                      <span className="text-xs font-mono text-payroll-primary font-bold">
                        {rule.code}
                      </span>
                    </div>
                    <Badge variant="neutral" size="sm" className="font-mono font-bold bg-payroll-cream text-payroll-primary border border-payroll-light">
                      <Lock className="w-3 h-3 mr-1" />
                      <span>LOCKED</span>
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    {rule.description}
                  </p>

                  <div className="grid grid-cols-3 gap-3 p-3 bg-payroll-cream/70 rounded-xl border border-payroll-light text-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 block">Office Day Rate</span>
                      <strong className="text-sm font-bold text-payroll-navy">{rule.rateOfficeDay}x</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">Off-Day / Holiday</span>
                      <strong className="text-sm font-bold text-payroll-navy">{rule.rateOffDay}x</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">Max Weekly Limit</span>
                      <strong className="text-sm font-bold text-payroll-navy">{rule.maxWeeklyHours} Hours</strong>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                    <span>Basis: Hourly Basic Salary</span>
                    <span className="font-bold text-payroll-primary">{rule.legalSection}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Content: Social Security & Deductions ── */}
      {activeTab === "deductions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Statutory Deductions & Retirement Funds (SSF Act 2074 & EPF)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pack.statutoryDeductions?.map((rule, idx) => (
              <Card
                key={idx}
                className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-4">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-payroll-navy">
                          {rule.name}
                        </h4>
                        <span className="text-xs text-payroll-primary font-bold">
                          {rule.nepaliName}
                        </span>
                      </div>
                      <Badge variant="neutral" size="sm" className="font-mono font-bold bg-payroll-cream text-payroll-primary border border-payroll-light">
                        <Lock className="w-3 h-3 mr-1" />
                        <span>LOCKED</span>
                      </Badge>
                    </div>

                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      {rule.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-payroll-light/60">
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-payroll-cream/70 rounded-xl border border-payroll-light text-xs text-center">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Employee Deduction</span>
                        <strong className="text-sm font-bold text-payroll-navy">
                          {rule.employeePercent > 0 ? `${rule.employeePercent}%` : "Voluntary"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Employer Contribution</span>
                        <strong className="text-sm font-bold text-payroll-primary">
                          {rule.employerPercent > 0 ? `${rule.employerPercent}%` : "—"}
                        </strong>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 text-right font-bold">
                      {rule.legalSection}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Content: Statutory Benefits & Dashain Bonus ── */}
      {activeTab === "benefits" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Statutory Festival Allowance & Mandatory Benefits (Nepal Labour Act 2074 s.37)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pack.statutoryBenefits?.map((rule, idx) => (
              <Card
                key={idx}
                className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-payroll-navy">
                        {rule.name}
                      </h4>
                      <span className="text-xs font-bold text-payroll-primary">
                        {rule.nepaliName}
                      </span>
                    </div>
                    <Badge variant="neutral" size="sm" className="font-mono font-bold bg-payroll-cream text-payroll-primary border border-payroll-light">
                      <Lock className="w-3 h-3 mr-1" />
                      <span>LOCKED</span>
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    {rule.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-payroll-cream/70 rounded-xl border border-payroll-light text-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 block">Entitlement Amount</span>
                      <strong className="text-sm font-bold text-payroll-navy">
                        1 Month Basic Salary
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">Eligibility Threshold</span>
                      <strong className="text-sm font-bold text-payroll-navy">
                        {rule.serviceEligibilityMonths} Months (Pro-Rata)
                      </strong>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                    <span>Disbursement: Before Dashain / Festival</span>
                    <span className="font-bold text-payroll-primary">{rule.legalSection}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Content: Income Tax TDS Reference ── */}
      {activeTab === "tax" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Statutory Personal Income Tax Brackets (Nepal Income Tax Act 2058 / Annex-10)
            </h3>
            <span className="text-xs text-gray-500">
              Configured per fiscal year under tenant Setup → Tax Rates
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Single */}
            <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-payroll-light/60">
                  <h4 className="text-sm font-bold text-payroll-navy">
                    Unmarried (Single) Individual Slabs
                  </h4>
                  <Badge variant="success" size="sm" className="font-bold">
                    Standard Ladder
                  </Badge>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex justify-between py-1 border-b border-gray-100">
                    <span>First NPR 500,000</span>
                    <strong className="text-payroll-navy font-bold">1% (Social Security Tax)</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-gray-100">
                    <span>Next NPR 200,000 (500K - 700K)</span>
                    <strong className="text-payroll-navy font-bold">10%</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-gray-100">
                    <span>Next NPR 300,000 (700K - 1M)</span>
                    <strong className="text-payroll-navy font-bold">20%</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-gray-100">
                    <span>Next NPR 1,000,000 (1M - 2M)</span>
                    <strong className="text-payroll-navy font-bold">30%</strong>
                  </li>
                  <li className="flex justify-between py-1">
                    <span>Above NPR 2,000,000</span>
                    <strong className="text-payroll-navy font-bold">36%</strong>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Married */}
            <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-payroll-light/60">
                  <h4 className="text-sm font-bold text-payroll-navy">
                    Married Couple (Joint Assessment) Slabs
                  </h4>
                  <Badge variant="info" size="sm" className="font-bold">
                    Joint Ladder
                  </Badge>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex justify-between py-1 border-b border-gray-100">
                    <span>First NPR 600,000</span>
                    <strong className="text-payroll-navy font-bold">1% (Social Security Tax)</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-gray-100">
                    <span>Next NPR 200,000 (600K - 800K)</span>
                    <strong className="text-payroll-navy font-bold">10%</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-gray-100">
                    <span>Next NPR 300,000 (800K - 1.1M)</span>
                    <strong className="text-payroll-navy font-bold">20%</strong>
                  </li>
                  <li className="flex justify-between py-1 border-b border-gray-100">
                    <span>Next NPR 900,000 (1.1M - 2M)</span>
                    <strong className="text-payroll-navy font-bold">30%</strong>
                  </li>
                  <li className="flex justify-between py-1">
                    <span>Above NPR 2,000,000</span>
                    <strong className="text-payroll-navy font-bold">36%</strong>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Edit Policy Pack Modal ── */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Statutory Policy Pack (v${editingPack.version}.0)`}
        description="Adjust default statutory parameters governed by the platform control plane."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePack}
              isLoading={isSaving}
              disabled={isSaving}
              className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm"
            >
              Save Policy Pack
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSavePack} className="space-y-4 py-1 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Policy Pack Name
            </label>
            <input
              type="text"
              required
              value={editingPack.name}
              onChange={(e) =>
                setEditingPack({ ...editingPack, name: e.target.value })
              }
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary shadow-payroll-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Legal Description
            </label>
            <textarea
              rows={2}
              value={editingPack.description}
              onChange={(e) =>
                setEditingPack({
                  ...editingPack,
                  description: e.target.value,
                })
              }
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary shadow-payroll-xs resize-none"
            />
          </div>

          {/* Edit Statutory Leaves */}
          <div className="space-y-3 pt-2 border-t border-payroll-light/60">
            <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Leave Rules Parameters
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {editingPack.leaveRules?.map((lr, i) => (
                <div
                  key={i}
                  className="p-3 bg-payroll-cream/50 rounded-xl border border-payroll-light grid grid-cols-3 gap-3 items-center text-xs"
                >
                  <span className="font-bold text-payroll-navy col-span-1">
                    {lr.name}
                  </span>
                  <div>
                    <label className="text-[10px] text-gray-500 block">
                      Days/Year
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={lr.daysPerYear}
                      onChange={(e) => {
                        const updated = [...editingPack.leaveRules];
                        updated[i].daysPerYear = Number(e.target.value);
                        setEditingPack({
                          ...editingPack,
                          leaveRules: updated,
                        });
                      }}
                      className="w-full px-2 py-1 text-xs rounded-lg border border-payroll-light bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">
                      Accumulation Cap
                    </label>
                    <input
                      type="number"
                      value={lr.maxAccumulation}
                      onChange={(e) => {
                        const updated = [...editingPack.leaveRules];
                        updated[i].maxAccumulation = Number(e.target.value);
                        setEditingPack({
                          ...editingPack,
                          leaveRules: updated,
                        });
                      }}
                      className="w-full px-2 py-1 text-xs rounded-lg border border-payroll-light bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Overtime */}
          <div className="space-y-3 pt-2 border-t border-payroll-light/60">
            <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Overtime Rules Parameters
            </h4>
            {editingPack.otRules?.map((ot, i) => (
              <div
                key={i}
                className="p-3 bg-payroll-cream/50 rounded-xl border border-payroll-light grid grid-cols-2 gap-3 text-xs"
              >
                <div>
                  <label className="text-[10px] text-gray-500 block">
                    Office Day Rate Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ot.rateOfficeDay}
                    onChange={(e) => {
                      const updated = [...editingPack.otRules];
                      updated[i].rateOfficeDay = Number(e.target.value);
                      setEditingPack({
                        ...editingPack,
                        otRules: updated,
                      });
                    }}
                    className="w-full px-2 py-1 text-xs rounded-lg border border-payroll-light bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block">
                    Off-Day / Holiday Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ot.rateOffDay}
                    onChange={(e) => {
                      const updated = [...editingPack.otRules];
                      updated[i].rateOffDay = Number(e.target.value);
                      setEditingPack({
                        ...editingPack,
                        otRules: updated,
                      });
                    }}
                    className="w-full px-2 py-1 text-xs rounded-lg border border-payroll-light bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </form>
      </Dialog>
    </div>
  );
}

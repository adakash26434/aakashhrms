"use client";

import React, { useState } from "react";
import {
  Layers,
  CheckCircle2,
  Lock,
  RefreshCw,
  Edit3,
  Plus,
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
} from "lucide-react";
import {
  StatutoryPolicyPackPayload,
  StatutoryLeaveRule,
  StatutoryOtRule,
  StatutoryDeductionRule,
  StatutoryBenefitRule,
} from "@/lib/platform/policy-pack-data";

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
    initialPack.payload
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Sync to all tenant databases
  const handleSyncToTenants = async () => {
    if (
      !confirm(
        `Are you sure you want to broadcast and synchronize Policy Pack v${pack.version} to all ${activeTenantsCount} active tenant databases? This will enforce statutory parameters across all client companies.`
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
      } else {
        setSyncResult({
          success: false,
          message: data.error || "Failed to sync policy pack.",
        });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || "Network error while syncing.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Save updated policy pack
  const handleSavePack = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSaveMessage(null);

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
        setSaveMessage("Policy pack updated successfully!");
        setTimeout(() => {
          setIsEditModalOpen(false);
          setSaveMessage(null);
        }, 1200);
      } else {
        alert(`Error saving policy pack: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-payroll-navy tracking-tight">
              Statutory Policy Packs & Compliance Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ACTIVE PLATFORM PACK</span>
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Central statutory compliance parameters enforced across all tenant company databases (Nepal Labour Act 2074 & SSF Act).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setEditingPack(JSON.parse(JSON.stringify(pack)));
              setIsEditModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-payroll-light bg-white hover:bg-payroll-cream text-payroll-navy text-xs font-semibold transition-all shadow-sm"
          >
            <Edit3 className="w-4 h-4 text-payroll-primary" />
            <span>Edit Policy Rules</span>
          </button>

          <button
            onClick={handleSyncToTenants}
            disabled={isSyncing}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white text-xs font-semibold transition-all shadow-md shadow-payroll-primary/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Broadcasting to Tenants..." : "Sync to All Active Tenants"}</span>
          </button>
        </div>
      </div>

      {/* ── Sync Notification Banner ── */}
      {syncResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 animate-in fade-in ${
            syncResult.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
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
                      className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-[11px] font-mono text-emerald-800 font-semibold"
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
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Compliance Status Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-payroll-light rounded-2xl p-4 shadow-payroll-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Active Policy Pack
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-payroll-navy">
              v{pack.version}.0
            </span>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Nepal Labour Act
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1 truncate">{pack.name}</p>
        </div>

        <div className="bg-white border border-payroll-light rounded-2xl p-4 shadow-payroll-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Statutory Rules Count
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-payroll-navy">
              {(pack.leaveRules?.length || 0) +
                (pack.otRules?.length || 0) +
                (pack.statutoryDeductions?.length || 0) +
                (pack.statutoryBenefits?.length || 0)}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Complete Set
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Leaves, OT, SSF, Bonus</p>
        </div>

        <div className="bg-white border border-payroll-light rounded-2xl p-4 shadow-payroll-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Active Tenants Governed
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-payroll-navy">
              {activeTenantsCount}
            </span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Live Databases
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Directly synchronized</p>
        </div>

        <div className="bg-white border border-payroll-light rounded-2xl p-4 shadow-payroll-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Platform Protection
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-payroll-primary">
              100% LOCKED
            </span>
            <Lock className="w-5 h-5 text-payroll-primary" />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Immutable by tenant admins</p>
        </div>
      </div>

      {/* ── Category Navigation Tabs ── */}
      <div className="bg-white border border-payroll-light rounded-2xl p-2 shadow-payroll-sm flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("leaves")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "leaves"
              ? "bg-payroll-primary text-white shadow-sm"
              : "text-gray-600 hover:bg-payroll-cream"
          }`}
        >
          <Palmtree className="w-4 h-4" />
          <span>Statutory Leaves ({pack.leaveRules?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("overtime")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "overtime"
              ? "bg-payroll-primary text-white shadow-sm"
              : "text-gray-600 hover:bg-payroll-cream"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Overtime Rules ({pack.otRules?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("deductions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "deductions"
              ? "bg-payroll-primary text-white shadow-sm"
              : "text-gray-600 hover:bg-payroll-cream"
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>SSF & Deductions ({pack.statutoryDeductions?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("benefits")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "benefits"
              ? "bg-payroll-primary text-white shadow-sm"
              : "text-gray-600 hover:bg-payroll-cream"
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Statutory Bonus ({pack.statutoryBenefits?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("tax")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "tax"
              ? "bg-payroll-primary text-white shadow-sm"
              : "text-gray-600 hover:bg-payroll-cream"
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Tax Slabs Baseline</span>
        </button>
      </div>

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
              <div
                key={idx}
                className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm space-y-3 hover:shadow-payroll-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-payroll-navy">
                        {rule.name}
                      </h4>
                      <span className="text-xs text-payroll-primary font-semibold">
                        {rule.nepaliName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-payroll-primary text-white flex items-center gap-1 shrink-0">
                      <Lock className="w-3 h-3" />
                      <span>LOCKED</span>
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                    {rule.description}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-payroll-light/60 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500 block">Annual Days:</span>
                      <strong className="text-gray-900">{rule.daysPerYear} Days</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Max Accumulation:</span>
                      <strong className="text-gray-900">
                        {rule.maxAccumulation > 0 ? `${rule.maxAccumulation} Days` : "No Accumulation"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Pay Status:</span>
                      <strong className="text-gray-900">{rule.leaveType}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Encashable:</span>
                      <strong className="text-gray-900">
                        {rule.isEncashable ? "Yes (Basic Salary)" : "No"}
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-payroll-primary bg-payroll-cream p-2 rounded-lg border border-payroll-light">
                    <span>Code: {rule.code}</span>
                    <span className="text-[10px] text-gray-500">{rule.legalSection}</span>
                  </div>
                </div>
              </div>
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
              <div
                key={idx}
                className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-payroll-navy">
                      {rule.name}
                    </h4>
                    <span className="text-xs font-mono text-payroll-primary font-semibold">
                      {rule.code}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-payroll-primary text-white flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>LOCKED</span>
                  </span>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  {rule.description}
                </p>

                <div className="grid grid-cols-3 gap-3 p-3 bg-payroll-cream rounded-xl border border-payroll-light text-center text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Office Day Multiplier</span>
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

                <div className="text-[11px] text-gray-500 flex items-center justify-between">
                  <span>Calculation Basis: Hourly Basic Salary</span>
                  <span className="font-semibold text-payroll-primary">{rule.legalSection}</span>
                </div>
              </div>
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
              <div
                key={idx}
                className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-payroll-navy">
                        {rule.name}
                      </h4>
                      <span className="text-xs text-payroll-primary font-semibold">
                        {rule.nepaliName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-payroll-primary text-white flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>LOCKED</span>
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                    {rule.description}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-payroll-light/60">
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-payroll-cream rounded-xl border border-payroll-light text-xs text-center">
                    <div>
                      <span className="text-[10px] text-gray-500 block">Employee Deduction</span>
                      <strong className="text-sm font-bold text-gray-900">
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
                  <div className="text-[10px] text-gray-500 text-right font-semibold">
                    {rule.legalSection}
                  </div>
                </div>
              </div>
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
              <div
                key={idx}
                className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-payroll-navy">
                      {rule.name}
                    </h4>
                    <span className="text-xs font-semibold text-payroll-primary">
                      {rule.nepaliName}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-payroll-primary text-white flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>LOCKED</span>
                  </span>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  {rule.description}
                </p>

                <div className="grid grid-cols-2 gap-3 p-3 bg-payroll-cream rounded-xl border border-payroll-light text-center text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Entitlement Amount</span>
                    <strong className="text-sm font-bold text-payroll-navy">
                      1 Month Basic Salary
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Eligibility Threshold</span>
                    <strong className="text-sm font-bold text-payroll-navy">
                      {rule.serviceEligibilityMonths} Months (Pro-Rata Allowed)
                    </strong>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 flex items-center justify-between">
                  <span>Disbursement: Before Dashain / Major Festival</span>
                  <span className="font-semibold text-payroll-primary">{rule.legalSection}</span>
                </div>
              </div>
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
            <div className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h4 className="text-sm font-bold text-payroll-navy">
                  Unmarried (Single) Individual Slabs
                </h4>
                <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Standard Ladder
                </span>
              </div>
              <ul className="space-y-2 text-xs text-gray-700">
                <li className="flex justify-between py-1 border-b border-gray-100">
                  <span>First NPR 500,000</span>
                  <strong className="text-gray-900">1% (Social Security Tax)</strong>
                </li>
                <li className="flex justify-between py-1 border-b border-gray-100">
                  <span>Next NPR 200,000 (500K - 700K)</span>
                  <strong className="text-gray-900">10%</strong>
                </li>
                <li className="flex justify-between py-1 border-b border-gray-100">
                  <span>Next NPR 300,000 (700K - 1M)</span>
                  <strong className="text-gray-900">20%</strong>
                </li>
                <li className="flex justify-between py-1 border-b border-gray-100">
                  <span>Next NPR 1,000,000 (1M - 2M)</span>
                  <strong className="text-gray-900">30%</strong>
                </li>
                <li className="flex justify-between py-1">
                  <span>Above NPR 2,000,000</span>
                  <strong className="text-gray-900">36%</strong>
                </li>
              </ul>
            </div>

            {/* Married */}
            <div className="bg-white border border-payroll-light rounded-2xl p-5 shadow-payroll-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h4 className="text-sm font-bold text-payroll-navy">
                  Married Couple (Joint Assessment) Slabs
                </h4>
                <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Joint Ladder
                </span>
              </div>
              <ul className="space-y-2 text-xs text-gray-700">
                <li className="flex justify-between py-1 border-b border-gray-100">
                  <span>First NPR 600,000</span>
                  <strong className="text-gray-900">1% (Social Security Tax)</strong>
                </li>
                <li className="flex justify-between py-1 border-b border-gray-100">
                  <span>Next NPR 200,000 (600K - 800K)</span>
                  <strong className="text-gray-900">10%</strong>
                </li>
                <li className="flex justify-between py-1 border-b border-gray-100">
                  <span>Next NPR 300,000 (800K - 1.1M)</span>
                  <strong className="text-gray-900">20%</strong>
                </li>
                <li className="flex justify-between py-1 border-b border-gray-100">
                  <span>Next NPR 900,000 (1.1M - 2M)</span>
                  <strong className="text-gray-900">30%</strong>
                </li>
                <li className="flex justify-between py-1">
                  <span>Above NPR 2,000,000</span>
                  <strong className="text-gray-900">36%</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Policy Pack Modal ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-payroll-navy">
                  Edit Statutory Policy Pack (v{editingPack.version}.0)
                </h3>
                <p className="text-xs text-gray-500">
                  Adjust default parameters governed by the platform control plane.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePack} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">
                  Policy Pack Name
                </label>
                <input
                  type="text"
                  required
                  value={editingPack.name}
                  onChange={(e) =>
                    setEditingPack({ ...editingPack, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:ring-2 focus:ring-payroll-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">
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
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:ring-2 focus:ring-payroll-primary focus:outline-none"
                />
              </div>

              {/* Edit Statutory Leaves */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <h4 className="text-xs font-bold text-payroll-navy uppercase">
                  Leave Rules Parameters
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {editingPack.leaveRules?.map((lr, i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-3 gap-3 items-center text-xs"
                    >
                      <span className="font-bold text-gray-900 col-span-1">
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
                          className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 bg-white"
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
                          className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Edit Overtime */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <h4 className="text-xs font-bold text-payroll-navy uppercase">
                  Overtime Rules Parameters
                </h4>
                {editingPack.otRules?.map((ot, i) => (
                  <div
                    key={i}
                    className="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 gap-3 text-xs"
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
                        className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 bg-white"
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
                        className="w-full px-2 py-1 text-xs rounded-lg border border-gray-300 bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {saveMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
                  {saveMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white text-xs font-bold transition-all shadow disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Policy Pack"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

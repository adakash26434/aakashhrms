"use client";

import React, { useState, useEffect, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Layers,
  CheckCircle2,
  Lock,
  RefreshCw,
  Edit3,
  Palmtree,
  Clock,
  Coins,
  Gift,
  Percent,
  AlertCircle,
  X,
  Shield,
  Plus,
  Trash2,
  RotateCcw,
  FileText,
  Sliders,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
} from "lucide-react";
import {
  StatutoryPolicyPackPayload,
  StatutoryLeaveRule,
  StatutoryOtRule,
  StatutoryDeductionRule,
  StatutoryBenefitRule,
  StatutoryTaxSlabRule,
  DEFAULT_NEPAL_POLICY_PACK_V1,
} from "@/lib/platform/policy-pack-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type PolicyTabKey = "leaves" | "overtime" | "deductions" | "benefits" | "tax";

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

function PolicyPackManagerInner({ initialPack, activeTenantsCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") as PolicyTabKey | null;

  const [pack, setPack] = useState<StatutoryPolicyPackPayload>({
    ...initialPack.payload,
    taxSlabsBaseline:
      initialPack.payload.taxSlabsBaseline &&
      initialPack.payload.taxSlabsBaseline.length > 0
        ? initialPack.payload.taxSlabsBaseline
        : DEFAULT_NEPAL_POLICY_PACK_V1.taxSlabsBaseline || [],
  });

  const [activeTab, setActiveTab] = useState<PolicyTabKey>(
    tabParam &&
      ["leaves", "overtime", "deductions", "benefits", "tax"].includes(tabParam)
      ? tabParam
      : "leaves",
  );

  // Synchronize when query param changes from sidebar navigation
  useEffect(() => {
    if (
      tabParam &&
      ["leaves", "overtime", "deductions", "benefits", "tax"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: PolicyTabKey) => {
    setActiveTab(newTab);
    router.replace(`/platform/policies?tab=${newTab}`, { scroll: false });
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    syncedCount?: number;
    syncedCompanies?: Array<{ name: string; slug: string }>;
  } | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<
    "leaves" | "overtime" | "deductions" | "benefits" | "tax" | "meta"
  >("leaves");
  const [editingPack, setEditingPack] =
    useState<StatutoryPolicyPackPayload>(pack);
  const [selectedTaxCategory, setSelectedTaxCategory] =
    useState("Normal Single");
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const handleOpenEditModal = (targetTab?: PolicyTabKey) => {
    setEditingPack(JSON.parse(JSON.stringify(pack)));
    setModalTab(targetTab || activeTab);
    setIsEditModalOpen(true);
  };

  // Sync to all tenant databases
  const handleSyncToTenants = async () => {
    if (
      !confirm(
        `Are you sure you want to broadcast and synchronize Statutory Policy Pack v${pack.version} to all ${activeTenantsCount} active tenant databases? This will update leave policies, overtime multipliers, statutory deduction rates, and statutory tax slab baselines across all client companies.`,
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
        toast.success(
          `Broadcast complete: synchronized with ${data.syncedCount || 0} tenant databases.`,
        );
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

  // Filtered baseline tax slabs for modal & view
  const activeTaxSlabs =
    pack.taxSlabsBaseline ||
    DEFAULT_NEPAL_POLICY_PACK_V1.taxSlabsBaseline ||
    [];
  const modalTaxSlabs =
    editingPack.taxSlabsBaseline ||
    DEFAULT_NEPAL_POLICY_PACK_V1.taxSlabsBaseline ||
    [];
  const filteredModalTaxSlabs = modalTaxSlabs.filter(
    (s) => s.category === selectedTaxCategory,
  );

  const handleUpdateModalTaxSlab = (
    indexInFiltered: number,
    field: keyof StatutoryTaxSlabRule,
    value: string | null,
  ) => {
    const target = filteredModalTaxSlabs[indexInFiltered];
    if (!target) return;

    setEditingPack((prev) => {
      const updatedSlabs = (prev.taxSlabsBaseline || []).map((slab) => {
        if (slab === target) {
          return { ...slab, [field]: value };
        }
        return slab;
      });
      return { ...prev, taxSlabsBaseline: updatedSlabs };
    });
  };

  const handleResetModalTaxSlabs = () => {
    setEditingPack((prev) => ({
      ...prev,
      taxSlabsBaseline: DEFAULT_NEPAL_POLICY_PACK_V1.taxSlabsBaseline,
    }));
    toast.info("Tax slabs reset to standard Nepal IRD guidelines.");
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
            Central statutory compliance parameters enforced across all tenant
            company databases (Nepal Labour Act 2074 & SSF Act).
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEditModal()}
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
            <RefreshCw
              className={cn("w-3.5 h-3.5 mr-1.5", isSyncing && "animate-spin")}
            />
            <span>
              {isSyncing ? "Broadcasting..." : "Sync to All Active Tenants"}
            </span>
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
                {syncResult.syncedCompanies &&
                  syncResult.syncedCompanies.length > 0 && (
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
            <p className="text-[11px] text-gray-500 mt-1 truncate">
              {pack.name}
            </p>
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
            <p className="text-[11px] text-gray-500 mt-1">
              Leaves, OT, SSF, Bonus
            </p>
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
            <p className="text-[11px] text-gray-500 mt-1">
              Directly synchronized
            </p>
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
            <p className="text-[11px] text-gray-500 mt-1">
              Immutable by tenant admins
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Category Navigation Tabs ── */}
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="p-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => handleTabChange("leaves")}
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
            onClick={() => handleTabChange("overtime")}
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
            onClick={() => handleTabChange("deductions")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
              activeTab === "deductions"
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-gray-600 hover:bg-payroll-cream hover:text-payroll-navy",
            )}
          >
            <Coins className="w-4 h-4" />
            <span>
              SSF & Deductions ({pack.statutoryDeductions?.length || 0})
            </span>
          </button>

          <button
            onClick={() => handleTabChange("benefits")}
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
            onClick={() => handleTabChange("tax")}
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

      {/* ── TAB 1: Statutory Leaves ── */}
      {activeTab === "leaves" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Mandatory Leave Types (Nepal Labour Act 2074 Section 40–45)
              </h3>
              <p className="text-[11px] text-gray-500">
                Enforced across all tenant company databases under platform
                policy lock
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleOpenEditModal("leaves")}
              className="text-xs font-bold"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1 text-payroll-primary" />
              <span>Edit Leaves</span>
            </Button>
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
                      <Badge
                        variant="neutral"
                        size="sm"
                        className="font-mono font-bold shrink-0 bg-payroll-cream text-payroll-primary border border-payroll-light"
                      >
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
                        <span className="text-gray-500 block">
                          Annual Days:
                        </span>
                        <strong className="text-payroll-navy font-bold">
                          {rule.daysPerYear} Days
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">
                          Max Accumulation:
                        </span>
                        <strong className="text-payroll-navy font-bold">
                          {rule.maxAccumulation > 0
                            ? `${rule.maxAccumulation} Days`
                            : "No Accumulation"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Pay Status:</span>
                        <strong className="text-payroll-navy font-bold">
                          {rule.leaveType}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Encashable:</span>
                        <strong className="text-payroll-navy font-bold">
                          {rule.isEncashable
                            ? "Yes (Basic Remuneration)"
                            : "No"}
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-payroll-primary bg-payroll-cream/70 p-2 rounded-lg border border-payroll-light">
                      <span>Code: {rule.code}</span>
                      <span className="text-[10px] text-gray-500">
                        {rule.legalSection}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: Overtime Rules ── */}
      {activeTab === "overtime" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Statutory Overtime Parameters (Nepal Labour Act 2074 Section 31)
              </h3>
              <p className="text-[11px] text-gray-500">
                Hourly rate calculations and maximum weekly overtime caps
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleOpenEditModal("overtime")}
              className="text-xs font-bold"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1 text-payroll-primary" />
              <span>Edit Overtime</span>
            </Button>
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
                      <h4 className="text-base font-bold text-payroll-navy">
                        {rule.name}
                      </h4>
                      <span className="text-xs font-mono font-semibold text-gray-500">
                        Rule Code: {rule.code}
                      </span>
                    </div>
                    <Badge
                      variant="neutral"
                      size="sm"
                      className="font-mono font-bold bg-payroll-cream text-payroll-primary border border-payroll-light"
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      <span>LOCKED</span>
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    {rule.description}
                  </p>

                  <div className="grid grid-cols-3 gap-3 p-3 bg-payroll-cream/70 rounded-xl border border-payroll-light text-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 block">
                        Office Day Multiplier
                      </span>
                      <strong className="text-sm font-bold text-payroll-navy">
                        {rule.rateOfficeDay}x
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">
                        Holiday Multiplier
                      </span>
                      <strong className="text-sm font-bold text-payroll-navy">
                        {rule.rateOffDay}x
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">
                        Max Weekly Limit
                      </span>
                      <strong className="text-sm font-bold text-payroll-navy">
                        {rule.maxWeeklyHours} Hours
                      </strong>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                    <span>Basis: Basic Remuneration / Working Hours</span>
                    <span className="font-bold text-payroll-primary">
                      {rule.legalSection}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: Social Security & Deductions ── */}
      {activeTab === "deductions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Statutory Deductions & Retirement Funds (SSF Act 2074, EPF &
                CIT)
              </h3>
              <p className="text-[11px] text-gray-500">
                Governed contribution rates for social security and retirement
                funds
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleOpenEditModal("deductions")}
              className="text-xs font-bold"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1 text-payroll-primary" />
              <span>Edit Deductions</span>
            </Button>
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
                      <Badge
                        variant="neutral"
                        size="sm"
                        className="font-mono font-bold bg-payroll-cream text-payroll-primary border border-payroll-light"
                      >
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
                        <span className="text-[10px] text-gray-500 block">
                          Employee Deduction
                        </span>
                        <strong className="text-sm font-bold text-payroll-navy">
                          {rule.employeePercent > 0
                            ? `${rule.employeePercent}%`
                            : "Voluntary"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">
                          Employer Contribution
                        </span>
                        <strong className="text-sm font-bold text-payroll-primary">
                          {rule.employerPercent > 0
                            ? `${rule.employerPercent}%`
                            : "—"}
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

      {/* ── TAB 4: Statutory Benefits & Dashain Bonus ── */}
      {activeTab === "benefits" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Statutory Festival Allowance & Mandatory Benefits (Nepal Labour
                Act 2074 s.37)
              </h3>
              <p className="text-[11px] text-gray-500">
                Dashain festival bonus and statutory profit bonus frameworks
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleOpenEditModal("benefits")}
              className="text-xs font-bold"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1 text-payroll-primary" />
              <span>Edit Benefits</span>
            </Button>
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
                    <Badge
                      variant="neutral"
                      size="sm"
                      className="font-mono font-bold bg-payroll-cream text-payroll-primary border border-payroll-light"
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      <span>LOCKED</span>
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    {rule.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-payroll-cream/70 rounded-xl border border-payroll-light text-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 block">
                        Entitlement Amount
                      </span>
                      <strong className="text-sm font-bold text-payroll-navy">
                        {rule.amountMultiplier} Month Basic Salary
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">
                        Eligibility Threshold
                      </span>
                      <strong className="text-sm font-bold text-payroll-navy">
                        {rule.serviceEligibilityMonths} Months{" "}
                        {rule.proRataAllowed ? "(Pro-Rata)" : ""}
                      </strong>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                    <span>Disbursement: Before Dashain / Annual Festival</span>
                    <span className="font-bold text-payroll-primary">
                      {rule.legalSection}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: Income Tax Baseline ── */}
      {activeTab === "tax" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Statutory Personal Income Tax Brackets (Nepal Income Tax Act
                2058 / Annex-10)
              </h3>
              <p className="text-[11px] text-gray-500">
                Baseline statutory tax brackets automatically seeded during new
                tenant onboarding
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleOpenEditModal("tax")}
              className="text-xs font-bold"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1 text-payroll-primary" />
              <span>Edit Tax Slabs</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Single Individual */}
            <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-payroll-light/60">
                  <h4 className="text-sm font-bold text-payroll-navy">
                    Normal Single Individual Slabs
                  </h4>
                  <Badge variant="success" size="sm" className="font-bold">
                    Standard Ladder
                  </Badge>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  {activeTaxSlabs
                    .filter((s) => s.category === "Normal Single")
                    .map((slab, i) => (
                      <li
                        key={i}
                        className="flex justify-between py-1 border-b border-gray-100 last:border-0"
                      >
                        <span>
                          {Number(slab.amountFrom).toLocaleString()} ~{" "}
                          {slab.amountTo
                            ? Number(slab.amountTo).toLocaleString()
                            : "Above"}
                        </span>
                        <strong className="text-payroll-navy font-bold">
                          {slab.ratePercent}% {i === 0 && "(SST)"}
                        </strong>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>

            {/* Married Couple */}
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
                  {activeTaxSlabs
                    .filter((s) => s.category === "Married")
                    .map((slab, i) => (
                      <li
                        key={i}
                        className="flex justify-between py-1 border-b border-gray-100 last:border-0"
                      >
                        <span>
                          {Number(slab.amountFrom).toLocaleString()} ~{" "}
                          {slab.amountTo
                            ? Number(slab.amountTo).toLocaleString()
                            : "Above"}
                        </span>
                        <strong className="text-payroll-navy font-bold">
                          {slab.ratePercent}% {i === 0 && "(SST)"}
                        </strong>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>

            {/* Handicapped */}
            <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-payroll-light/60">
                  <h4 className="text-sm font-bold text-payroll-navy">
                    Handicapped Individual Slabs
                  </h4>
                  <Badge variant="warning" size="sm" className="font-bold">
                    Concessional Ladder
                  </Badge>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  {activeTaxSlabs
                    .filter((s) => s.category === "Handicapped")
                    .map((slab, i) => (
                      <li
                        key={i}
                        className="flex justify-between py-1 border-b border-gray-100 last:border-0"
                      >
                        <span>
                          {Number(slab.amountFrom).toLocaleString()} ~{" "}
                          {slab.amountTo
                            ? Number(slab.amountTo).toLocaleString()
                            : "Above"}
                        </span>
                        <strong className="text-payroll-navy font-bold">
                          {slab.ratePercent}% {i === 0 && "(SST)"}
                        </strong>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          COMPREHENSIVE MULTI-TABBED EDIT POLICY RULES MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Statutory Policy Rules (v${editingPack.version}.0)`}
        description="Configure central compliance parameters governed across all tenant company databases."
        size="4xl"
        headerBottom={
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setModalTab("leaves")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                modalTab === "leaves"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Palmtree className="w-3.5 h-3.5" />
              <span>1. Leaves</span>
            </button>

            <button
              type="button"
              onClick={() => setModalTab("overtime")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                modalTab === "overtime"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>2. Overtime</span>
            </button>

            <button
              type="button"
              onClick={() => setModalTab("deductions")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                modalTab === "deductions"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>3. SSF & Deductions</span>
            </button>

            <button
              type="button"
              onClick={() => setModalTab("benefits")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                modalTab === "benefits"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>4. Statutory Bonus</span>
            </button>

            <button
              type="button"
              onClick={() => setModalTab("tax")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                modalTab === "tax"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>5. Tax Slabs</span>
            </button>

            <button
              type="button"
              onClick={() => setModalTab("meta")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                modalTab === "meta"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>6. Pack Metadata</span>
            </button>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Platform Policy Lock • Broadcastable to all tenant databases
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
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
          </div>
        }
      >
        <div className="space-y-4">
            {/* ── SUBTAB 1: LEAVES ── */}
            {modalTab === "leaves" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Statutory Leave Types Parameters (
                    {editingPack.leaveRules?.length || 0})
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Nepal Labour Act 2074 s.40–45
                  </span>
                </div>

                <div className="space-y-2.5">
                  {editingPack.leaveRules?.map((rule, idx) => (
                    <div
                      key={rule.code}
                      className="p-3.5 bg-white rounded-xl border border-payroll-light shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-payroll-navy">
                              {rule.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-payroll-cream text-payroll-primary border border-payroll-light rounded">
                              {rule.code}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-500 block mt-0.5">
                            {rule.legalSection}
                          </span>
                        </div>
                        <Badge
                          variant="neutral"
                          size="sm"
                          className="font-mono text-[10px]"
                        >
                          {rule.leaveType}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Days / Year
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={rule.daysPerYear}
                            onChange={(e) => {
                              const updated = [...editingPack.leaveRules];
                              updated[idx].daysPerYear = Number(e.target.value);
                              setEditingPack({
                                ...editingPack,
                                leaveRules: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Accumulation Cap
                          </label>
                          <input
                            type="number"
                            value={rule.maxAccumulation}
                            onChange={(e) => {
                              const updated = [...editingPack.leaveRules];
                              updated[idx].maxAccumulation = Number(
                                e.target.value,
                              );
                              setEditingPack({
                                ...editingPack,
                                leaveRules: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Pay Status
                          </label>
                          <select
                            value={rule.leaveType}
                            onChange={(e) => {
                              const updated = [...editingPack.leaveRules];
                              updated[idx].leaveType = e.target.value as any;
                              setEditingPack({
                                ...editingPack,
                                leaveRules: updated,
                              });
                            }}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-payroll-light bg-white text-payroll-navy"
                          >
                            <option value="Pay">Full Pay</option>
                            <option value="Partial-Pay">Partial Pay</option>
                            <option value="Non-Pay">Unpaid</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2 pt-4">
                          <label className="inline-flex items-center gap-1.5 text-xs text-payroll-navy cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.isEncashable}
                              onChange={(e) => {
                                const updated = [...editingPack.leaveRules];
                                updated[idx].isEncashable = e.target.checked;
                                setEditingPack({
                                  ...editingPack,
                                  leaveRules: updated,
                                });
                              }}
                              className="rounded text-payroll-primary focus:ring-payroll-primary"
                            />
                            <span className="font-semibold text-[11px]">
                              Encashable
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SUBTAB 2: OVERTIME ── */}
            {modalTab === "overtime" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Statutory Overtime Parameters
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Nepal Labour Act 2074 s.31
                  </span>
                </div>

                <div className="space-y-3">
                  {editingPack.otRules?.map((rule, idx) => (
                    <div
                      key={rule.code}
                      className="p-4 bg-white rounded-xl border border-payroll-light shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-payroll-navy">
                            {rule.name}
                          </h4>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {rule.code} • {rule.legalSection}
                          </span>
                        </div>
                        <Badge variant="neutral" size="sm">
                          {rule.ruleType}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Office Day Multiplier
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={rule.rateOfficeDay}
                            onChange={(e) => {
                              const updated = [...editingPack.otRules];
                              updated[idx].rateOfficeDay = Number(
                                e.target.value,
                              );
                              setEditingPack({
                                ...editingPack,
                                otRules: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Holiday Multiplier
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={rule.rateOffDay}
                            onChange={(e) => {
                              const updated = [...editingPack.otRules];
                              updated[idx].rateOffDay = Number(e.target.value);
                              setEditingPack({
                                ...editingPack,
                                otRules: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Max Weekly Overtime Hours
                          </label>
                          <input
                            type="number"
                            value={rule.maxWeeklyHours}
                            onChange={(e) => {
                              const updated = [...editingPack.otRules];
                              updated[idx].maxWeeklyHours = Number(
                                e.target.value,
                              );
                              setEditingPack({
                                ...editingPack,
                                otRules: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SUBTAB 3: SSF & DEDUCTIONS ── */}
            {modalTab === "deductions" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Statutory Deduction Rules (
                    {editingPack.statutoryDeductions?.length || 0})
                  </span>
                  <span className="text-[11px] text-gray-500">
                    SSF Act 2074 & EPF Act
                  </span>
                </div>

                <div className="space-y-3">
                  {editingPack.statutoryDeductions?.map((rule, idx) => (
                    <div
                      key={rule.code}
                      className="p-4 bg-white rounded-xl border border-payroll-light shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-payroll-navy">
                            {rule.name}
                          </h4>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {rule.code} • {rule.nepaliName}
                          </span>
                        </div>
                        <span className="text-[10px] text-payroll-primary font-bold">
                          {rule.legalSection}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Employee Deduction (%)
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={rule.employeePercent}
                            onChange={(e) => {
                              const updated = [
                                ...editingPack.statutoryDeductions,
                              ];
                              updated[idx].employeePercent = Number(
                                e.target.value,
                              );
                              setEditingPack({
                                ...editingPack,
                                statutoryDeductions: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Employer Contribution (%)
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={rule.employerPercent}
                            onChange={(e) => {
                              const updated = [
                                ...editingPack.statutoryDeductions,
                              ];
                              updated[idx].employerPercent = Number(
                                e.target.value,
                              );
                              setEditingPack({
                                ...editingPack,
                                statutoryDeductions: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-4">
                          <label className="inline-flex items-center gap-1.5 text-xs text-payroll-navy cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.isPreTax}
                              onChange={(e) => {
                                const updated = [
                                  ...editingPack.statutoryDeductions,
                                ];
                                updated[idx].isPreTax = e.target.checked;
                                setEditingPack({
                                  ...editingPack,
                                  statutoryDeductions: updated,
                                });
                              }}
                              className="rounded text-payroll-primary focus:ring-payroll-primary"
                            />
                            <span className="font-semibold text-[11px]">
                              Pre-Tax Deduction
                            </span>
                          </label>
                        </div>
                      </div>

                      {rule.code?.includes("SSF") && (
                        <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <span className="text-emerald-900 font-medium">
                            Pass-Through Remittance:{" "}
                            <strong>
                              {Number(rule.employeePercent || 0) +
                                Number(rule.employerPercent || 0)}
                              % Total
                            </strong>{" "}
                            (EE {rule.employeePercent}% + ER{" "}
                            {rule.employerPercent}%)
                          </span>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded self-start sm:self-auto">
                            Net Take-Home: -{rule.employeePercent}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SUBTAB 4: STATUTORY BONUS ── */}
            {modalTab === "benefits" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Statutory Benefit & Festival Allowance Rules (
                    {editingPack.statutoryBenefits?.length || 0})
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Nepal Labour Act 2074 s.37
                  </span>
                </div>

                <div className="space-y-3">
                  {editingPack.statutoryBenefits?.map((rule, idx) => (
                    <div
                      key={rule.code}
                      className="p-4 bg-white rounded-xl border border-payroll-light shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-payroll-navy">
                            {rule.name}
                          </h4>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {rule.code} • {rule.nepaliName}
                          </span>
                        </div>
                        <span className="text-[10px] text-payroll-primary font-bold">
                          {rule.legalSection}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Entitlement Multiplier (Months Basic)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={rule.amountMultiplier}
                            onChange={(e) => {
                              const updated = [
                                ...editingPack.statutoryBenefits,
                              ];
                              updated[idx].amountMultiplier = Number(
                                e.target.value,
                              );
                              setEditingPack({
                                ...editingPack,
                                statutoryBenefits: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Eligibility Threshold (Months)
                          </label>
                          <input
                            type="number"
                            value={rule.serviceEligibilityMonths}
                            onChange={(e) => {
                              const updated = [
                                ...editingPack.statutoryBenefits,
                              ];
                              updated[idx].serviceEligibilityMonths = Number(
                                e.target.value,
                              );
                              setEditingPack({
                                ...editingPack,
                                statutoryBenefits: updated,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-4">
                          <label className="inline-flex items-center gap-1.5 text-xs text-payroll-navy cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.proRataAllowed}
                              onChange={(e) => {
                                const updated = [
                                  ...editingPack.statutoryBenefits,
                                ];
                                updated[idx].proRataAllowed = e.target.checked;
                                setEditingPack({
                                  ...editingPack,
                                  statutoryBenefits: updated,
                                });
                              }}
                              className="rounded text-payroll-primary focus:ring-payroll-primary"
                            />
                            <span className="font-semibold text-[11px]">
                              Pro-Rata for Mid-Year Service
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SUBTAB 5: TAX SLABS BASELINE ── */}
            {modalTab === "tax" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <span className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Baseline Progressive Tax Brackets (Nepal Income Tax Act
                      2058)
                    </span>
                    <p className="text-[11px] text-gray-500">
                      Standard brackets automatically seeded for new tenant
                      companies
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleResetModalTaxSlabs}
                    className="text-[11px] font-semibold text-payroll-primary"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    <span>Reset to IRD Guidelines</span>
                  </Button>
                </div>

                {/* Category Switcher */}
                <div className="flex items-center gap-1.5 bg-payroll-cream/50 p-1 rounded-xl border border-payroll-light">
                  {["Normal Single", "Married", "Handicapped"].map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedTaxCategory(cat)}
                        className={cn(
                          "flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                          selectedTaxCategory === cat
                            ? "bg-white text-payroll-navy shadow-2xs border border-payroll-light"
                            : "text-gray-500 hover:text-payroll-navy",
                        )}
                      >
                        {cat}
                      </button>
                    ),
                  )}
                </div>

                {/* Brackets Grid */}
                <div className="bg-white rounded-xl border border-payroll-light overflow-hidden shadow-2xs">
                  <div className="grid grid-cols-12 gap-2 bg-payroll-cream/40 p-2.5 text-[10px] font-bold text-payroll-navy uppercase tracking-wider border-b border-payroll-light">
                    <span className="col-span-4">Bracket From (NPR)</span>
                    <span className="col-span-3">Upper Limit</span>
                    <span className="col-span-2 text-center">Rate (%)</span>
                    <span className="col-span-3 text-right">
                      Fixed Deduction
                    </span>
                  </div>

                  <div className="divide-y divide-payroll-light/60 p-1">
                    {filteredModalTaxSlabs.map((slab, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center p-2 text-xs"
                      >
                        <div className="col-span-4">
                          <input
                            type="number"
                            value={slab.amountFrom}
                            onChange={(e) =>
                              handleUpdateModalTaxSlab(
                                idx,
                                "amountFrom",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 text-xs font-mono rounded border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div className="col-span-3 text-payroll-navy">
                          <input
                            type="number"
                            value={slab.amountTo || ""}
                            onChange={(e) =>
                              handleUpdateModalTaxSlab(
                                idx,
                                "amountTo",
                                e.target.value ? e.target.value : null,
                              )
                            }
                            placeholder="And above"
                            className="w-full px-2 py-1 text-xs font-mono rounded border border-payroll-light bg-payroll-cream/20 placeholder-gray-400"
                          />
                        </div>

                        <div className="col-span-2 text-center">
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              step="0.01"
                              value={slab.ratePercent}
                              onChange={(e) =>
                                handleUpdateModalTaxSlab(
                                  idx,
                                  "ratePercent",
                                  e.target.value,
                                )
                              }
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold rounded border border-payroll-light bg-payroll-cream/20 text-payroll-primary"
                            />
                            <span className="text-[10px] text-gray-500">%</span>
                          </div>
                        </div>

                        <div className="col-span-3 text-right">
                          <input
                            type="number"
                            value={slab.fixedDeduction || "0"}
                            onChange={(e) =>
                              handleUpdateModalTaxSlab(
                                idx,
                                "fixedDeduction",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 text-xs font-mono text-right rounded border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── SUBTAB 6: PACK METADATA ── */}
            {modalTab === "meta" && (
              <div className="space-y-3">
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
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-payroll-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Legal Framework
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPack.legalFramework}
                    onChange={(e) =>
                      setEditingPack({
                        ...editingPack,
                        legalFramework: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-payroll-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Legal Description & Compliance Scope
                  </label>
                  <textarea
                    rows={3}
                    value={editingPack.description}
                    onChange={(e) =>
                      setEditingPack({
                        ...editingPack,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white text-payroll-navy focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-payroll-xs resize-none"
                  />
                </div>
              </div>
            )}
        </div>
      </Dialog>
    </div>
  );
}

export function PolicyPackManager(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm font-semibold text-gray-500">
          Loading Policy Pack Manager...
        </div>
      }
    >
      <PolicyPackManagerInner {...props} />
    </Suspense>
  );
}

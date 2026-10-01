"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Clock, FileBadge2, Save, Loader2 } from "lucide-react";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ManualAttendanceCard } from "./manual-attendance-card";
import { StatutoryDeductionLimitsCard } from "./statutory-deduction-limits-card";
import { InsuranceDiscountsCard } from "./insurance-discounts-card";
import { GradePolicyCard } from "./grade-policy-card";
import { Banner, type BannerTone } from "@/components/ui/banner";
import type { SystemControlData } from "@/lib/types/system-control";
import { saveSystemControlAction } from "@/app/actions/system-control.actions";
import { useToast } from "@/components/ui/toast";

interface SystemControlClientProps {
  initialData: SystemControlData;
  isSuperAdmin?: boolean;
  embedded?: boolean;
}

export function SystemControlClient({
  initialData,
  isSuperAdmin = false,
  embedded = false,
}: SystemControlClientProps) {
  const [data, setData] = useState<SystemControlData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const toast = useToast();
  const [banner, setBanner] = useState<{
    visible: boolean;
    message: string;
    tone: BannerTone;
  }>({ visible: false, message: "", tone: "success" });

  function showBanner(message: string, tone: BannerTone = "success") {
    setBanner({ visible: true, message, tone });
    if (tone === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }

  function dismissBanner() {
    setBanner((b) => ({ ...b, visible: false }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const result = await saveSystemControlAction(data);
      if (!result.success) {
        showBanner(
          `Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`,
          "info",
        );
      } else {
        setHasChanges(false);
        showBanner("System configuration updated successfully.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${msg}`, "info");
    } finally {
      setIsSaving(false);
    }
  }

  const saveButton = (
    <Button
      type="button"
      onClick={handleSave}
      disabled={isSaving || !hasChanges}
      className="bg-payroll-primary hover:bg-payroll-primary-hover text-white cursor-pointer shadow-xs text-xs font-medium h-9 px-4 rounded-lg transition-colors inline-flex items-center gap-1.5"
    >
      {isSaving ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Saving...</span>
        </>
      ) : (
        <>
          <Save className="h-3.5 w-3.5" />
          <span>Save changes</span>
        </>
      )}
    </Button>
  );

  const content = (
    <div className="space-y-8 animate-[fadeIn_150ms_ease-out]">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={dismissBanner}
      />

      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                Rules &amp; statutory defaults
              </h2>
              {hasChanges && (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                  Unsaved changes
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
              Global statutory deduction ceilings, insurance rebate thresholds, grade increment policies, and manual attendance controls.
            </p>
          </div>
          <div className="shrink-0">{saveButton}</div>
        </div>
      ) : (
        <PageHeader
          title="System control"
          description="Configure global statutory deduction limits, insurance rebate thresholds, and manual attendance controls across the payroll system."
        >
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                Unsaved changes
              </span>
            )}
            {saveButton}
          </div>
        </PageHeader>
      )}

      {/* Standalone cross-reference bar (only rendered on standalone page) */}
      {!embedded && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 mt-0.5">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Organization timing &amp; classifications master
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Weekly operating schedule, office shift hours, winter timing, and statutory employment classifications are unified in Company Setup.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/setup/company-setup?tab=work_schedule"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
              >
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>Work schedule</span>
              </Link>
              <Link
                href="/setup/company-setup?tab=employment_types"
                className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-payroll-primary-hover transition-colors"
              >
                <FileBadge2 className="h-3.5 w-3.5" />
                <span>Employment types</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Statutory Deduction Limits */}
      <section className="space-y-4">
        <StatutoryDeductionLimitsCard
          value={data.statutoryDeductionLimits}
          onChange={(statutoryDeductionLimits) => {
            setData((d) => ({ ...d, statutoryDeductionLimits }));
            setHasChanges(true);
          }}
        />
      </section>

      {/* Section 2: Insurance Deductions & Tax Rebates */}
      <section className="space-y-4">
        <InsuranceDiscountsCard
          value={data.insuranceDiscounts}
          isSuperAdmin={isSuperAdmin}
          onChange={(insuranceDiscounts) => {
            setData((d) => ({ ...d, insuranceDiscounts }));
            setHasChanges(true);
          }}
        />
      </section>

      {/* Section 3: Grade Calculation & Promotion Policy */}
      <section className="space-y-4">
        <GradePolicyCard
          value={data.gradePolicy}
          onChange={(gradePolicy) => {
            setData((d) => ({ ...d, gradePolicy }));
            setHasChanges(true);
          }}
        />
      </section>

      {/* Section 4: Manual Attendance Fallback */}
      <section className="space-y-4">
        <ManualAttendanceCard
          value={data.manualAttendance}
          onChange={(manualAttendance) => {
            setData((d) => ({ ...d, manualAttendance }));
            setHasChanges(true);
          }}
        />
      </section>

      {/* Bottom Save Action */}
      <div className="flex items-center justify-end pt-4 border-t border-slate-200/80">
        {saveButton}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <PageFrame size="wide" spacing="default">
      {content}
    </PageFrame>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Clock, FileBadge2 } from "lucide-react";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { ManualAttendanceCard } from "./manual-attendance-card";
import { StatutoryDeductionLimitsCard } from "./statutory-deduction-limits-card";
import { InsuranceDiscountsCard } from "./insurance-discounts-card";
import { Banner, type BannerTone } from "@/components/ui/banner";
import type { SystemControlData } from "@/lib/types/system-control";
import { saveSystemControlAction } from "@/app/actions/system-control.actions";
import { DataSaveButton } from "../ui/data-save-button";
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

  const content = (
    <>
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={dismissBanner}
      />

      {embedded ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-payroll-border/50">
          <div>
            <h3 className="text-base font-semibold text-payroll-navy">Rules &amp; Defaults</h3>
            <p className="text-xs text-payroll-slate">
              Global statutory deduction limits, insurance rebate thresholds, and manual attendance controls.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved Changes
              </span>
            )}
            <DataSaveButton onClick={handleSave} isSaving={isSaving} />
          </div>
        </div>
      ) : (
        <PageHeader
          title="System Control"
          description="Configure global statutory deduction limits, insurance rebate thresholds, and manual attendance controls across the payroll system."
        >
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved Changes
              </span>
            )}
            <DataSaveButton onClick={handleSave} isSaving={isSaving} />
          </div>
        </PageHeader>
      )}

      {/* Consolidated Company Setup Reference Card */}
      <div className="rounded-xl border border-payroll-border bg-linear-to-r from-payroll-light/70 via-white to-payroll-light/30 p-4 shadow-payroll-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-payroll-primary text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-payroll-navy">
                Organization Timing &amp; Classifications Master
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Weekly operating schedule, office shift hours, winter timing, and statutory employment classifications (SSF, PF, Festival Bonus) are unified in Company Setup.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/setup/company-setup?tab=work_schedule"
              className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-border bg-white px-3 py-1.5 text-xs font-semibold text-payroll-navy shadow-xs hover:bg-payroll-light transition-colors"
            >
              <Clock className="h-3.5 w-3.5 text-payroll-primary" />
              <span>Work Timing</span>
            </Link>
            <Link
              href="/setup/company-setup?tab=employment_types"
              className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-payroll-primary/90 transition-colors"
            >
              <FileBadge2 className="h-3.5 w-3.5" />
              <span>Employment Types</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Statutory &amp; Tax Deductions
          </h2>
          <p className="text-xs text-muted-foreground">
            Global limits and exemption thresholds for retirement funds and medical insurance
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <StatutoryDeductionLimitsCard
            value={data.statutoryDeductionLimits}
            onChange={(statutoryDeductionLimits) => {
              setData((d) => ({ ...d, statutoryDeductionLimits }));
              setHasChanges(true);
            }}
          />
          <InsuranceDiscountsCard
            value={data.insuranceDiscounts}
            isSuperAdmin={isSuperAdmin}
            onChange={(insuranceDiscounts) => {
              setData((d) => ({ ...d, insuranceDiscounts }));
              setHasChanges(true);
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Attendance &amp; Payroll Operations
          </h2>
          <p className="text-xs text-muted-foreground">
            Fallback calculations when regular daily attendance is unposted
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ManualAttendanceCard
            value={data.manualAttendance}
            onChange={(manualAttendance) => {
              setData((d) => ({ ...d, manualAttendance }));
              setHasChanges(true);
            }}
          />
        </div>
      </div>
      
      <div className="flex shrink-0 items-center justify-end pt-2">
        <DataSaveButton onClick={handleSave} isSaving={isSaving} />
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <PageFrame size="wide" spacing="default">
      {content}
    </PageFrame>
  );
}

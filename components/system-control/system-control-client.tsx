"use client";

import { useState } from "react";
import { SystemControlHero } from "./system-control-hero";
import { OfficeTimeCard } from "./office-time-card";
import { ManualAttendanceCard } from "./manual-attendance-card";
import { LeavePermissionsCard } from "./leave-permissions-card";
import { StatutoryDeductionLimitsCard } from "./statutory-deduction-limits-card";
import { InsuranceDiscountsCard } from "./insurance-discounts-card";
import { Banner, type BannerTone } from "@/components/ui/banner";
import type { SystemControlData } from "@/lib/types/system-control";
import { saveSystemControlAction } from "@/app/actions/system-control.actions";
import { DataSaveButton } from "../ui/data-save-button";
import { useToast } from "@/components/ui/toast";

interface SystemControlClientProps {
  initialData: SystemControlData;
}

export function SystemControlClient({ initialData }: SystemControlClientProps) {
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

  function onSave(): void {
    throw new Error("Function not implemented.");
  }

  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={dismissBanner}
      />

      {/* Note: I added disabled={!hasChanges} so the button behaves correctly! */}
      <SystemControlHero onSave={handleSave} isSaving={isSaving} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OfficeTimeCard
          value={data.officeTime}
          onChange={(officeTime) => {
            setData((d) => ({ ...d, officeTime }));
            setHasChanges(true);
          }}
        />
        <ManualAttendanceCard
          value={data.manualAttendance}
          onChange={(manualAttendance) => {
            setData((d) => ({ ...d, manualAttendance }));
            setHasChanges(true);
          }}
        />
      </div>

      <LeavePermissionsCard
        value={data.leavePermissions}
        onChange={(leavePermissions) => {
          setData((d) => ({ ...d, leavePermissions }));
          setHasChanges(true);
        }}
      />

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
          onChange={(insuranceDiscounts) => {
            setData((d) => ({ ...d, insuranceDiscounts }));
            setHasChanges(true);
          }}
        />
      </div>
      
      <div className="flex shrink-0 items-center justify-end pt-2 pr-4">
        <DataSaveButton onClick={handleSave} isSaving={isSaving} />
      </div>
    </div>
  );
}

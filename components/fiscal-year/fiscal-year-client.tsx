"use client";

import { useState, useMemo } from "react";
import { Plus, CalendarDays, Calendar, Lock, CheckCircle2 } from "lucide-react";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStrip, type KpiMetric } from "@/components/layout/kpi-strip";
import { Button } from "@/components/ui/button";
import { DateFormatMenu } from "@/components/ui/date-format-menu";
import { FiscalYearTable } from "./fiscal-year-table";
import { FiscalYearFormModal } from "./fiscal-year-form-modal";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ConfirmUnlockDialog } from "./confirm-unlock-dialog";
import { Banner, type BannerTone } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import type {
  FiscalYear,
  FiscalYearData,
  FiscalYearFormData,
} from "@/lib/types/fiscal-year";
import {
  createFiscalYearAction,
  updateFiscalYearAction,
  deleteFiscalYearAction,
  setFiscalYearStatusAction,
  unlockFiscalYearAction,
} from "@/app/actions/fiscal-year.actions";

interface FiscalYearClientProps {
  initialData: FiscalYearData;
  embedded?: boolean;
}

/**
 * Top-level state container for the Fiscal Year Setup page.
 *
 * Mutations go through the service layer (via Server Actions),
 * which performs engine validation + authorization before calling
 * the repository. Allows making fiscal years Active or Inactive,
 * and unlocking previously locked fiscal years.
 */
export function FiscalYearClient({ initialData, embedded = false }: FiscalYearClientProps) {
  const [data, setData] = useState<FiscalYearData>(initialData);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFY, setEditingFY] = useState<FiscalYear | null>(null);
  const [deletingFY, setDeletingFY] = useState<FiscalYear | null>(null);
  const [unlockingFY, setUnlockingFY] = useState<FiscalYear | null>(null);

  // Banner state
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
      toast.info(message);
    }
  }

  function dismissBanner() {
    setBanner((b) => ({ ...b, visible: false }));
  }

  // -- Create / Edit --------------------------------------------------------

  function handleOpenCreate() {
    setEditingFY(null);
    setIsFormOpen(true);
  }

  function handleOpenEdit(fy: FiscalYear) {
    if (fy.status === "Locked" || fy.payslipsGenerated) {
      showBanner(
        `"${fy.label}" is currently locked. Click "Unlock" to enable edits.`,
        "info",
      );
      return;
    }
    setEditingFY(fy);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingFY(null);
  }

  async function handleSubmitForm(payload: FiscalYearFormData) {
    try {
      if (editingFY) {
        const result = await updateFiscalYearAction(editingFY.id, payload);
        if (!result.success) {
          showBanner(
            `Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`,
            "info",
          );
          return;
        }
        setData((prev) => ({
          ...prev,
          fiscalYears: prev.fiscalYears.map((fy) => {
            if (fy.id === result.data!.id) return result.data!;
            if (result.data!.status === "Active") return { ...fy, status: "Inactive" };
            return fy;
          }),
        }));
        showBanner(`Fiscal year "${result.data!.label}" updated.`);
      } else {
        const result = await createFiscalYearAction(payload);
        if (!result.success) {
          showBanner(
            `Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`,
            "info",
          );
          return;
        }
        setData((prev) => ({
          ...prev,
          fiscalYears: [
            ...prev.fiscalYears.map((fy) =>
              result.data!.status === "Active" ? { ...fy, status: "Inactive" as const } : fy,
            ),
            result.data!,
          ],
        }));
        showBanner(`Fiscal year "${result.data!.label}" created.`);
      }
      handleCloseForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${msg}`, "info");
    }
  }

  // -- Delete --------------------------------------------------------------

  function handleOpenDelete(fy: FiscalYear) {
    if (fy.status === "Locked" || fy.payslipsGenerated) {
      showBanner(
        `"${fy.label}" is currently locked. Click "Unlock" to enable deletion.`,
        "info",
      );
      return;
    }
    setDeletingFY(fy);
  }

  function handleCloseDelete() {
    setDeletingFY(null);
  }

  async function handleConfirmDelete() {
    if (!deletingFY) return;
    const label = deletingFY.label;
    try {
      const result = await deleteFiscalYearAction(deletingFY.id);
      if (!result.success) {
        showBanner(`Could not delete: ${result.error}`, "info");
      } else {
        setData((prev) => ({
          ...prev,
          fiscalYears: prev.fiscalYears.filter((fy) => fy.id !== deletingFY.id),
        }));
        showBanner(`Fiscal year "${label}" deleted.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not delete: ${msg}`, "info");
    } finally {
      handleCloseDelete();
    }
  }

  // -- Toggle Active / Inactive --------------------------------------------

  async function handleToggleStatus(
    fy: FiscalYear,
    targetStatus: "Active" | "Inactive",
  ) {
    try {
      const result = await setFiscalYearStatusAction(fy.id, targetStatus);
      if (!result.success) {
        showBanner(`Could not change status: ${result.error}`, "info");
        return;
      }
      setData((prev) => ({
        ...prev,
        fiscalYears: prev.fiscalYears.map((item) => {
          if (item.id === fy.id) {
            return { ...item, status: targetStatus, payslipsGenerated: false };
          }
          if (targetStatus === "Active") {
            return { ...item, status: "Inactive" };
          }
          return item;
        }),
      }));
      showBanner(`Fiscal year "${fy.label}" is now ${targetStatus}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not change status: ${msg}`, "info");
    }
  }

  // -- Unlock ---------------------------------------------------------------

  function handleOpenUnlock(fy: FiscalYear) {
    setUnlockingFY(fy);
  }

  function handleCloseUnlock() {
    setUnlockingFY(null);
  }

  async function handleConfirmUnlock(targetStatus: "Active" | "Inactive") {
    if (!unlockingFY) return;
    const label = unlockingFY.label;
    const id = unlockingFY.id;
    try {
      const result = await unlockFiscalYearAction(id, targetStatus);
      if (!result.success) {
        showBanner(`Could not unlock: ${result.error}`, "info");
        return;
      }
      setData((prev) => ({
        ...prev,
        fiscalYears: prev.fiscalYears.map((item) => {
          if (item.id === id) {
            return { ...item, status: targetStatus, payslipsGenerated: false };
          }
          if (targetStatus === "Active") {
            return { ...item, status: "Inactive" };
          }
          return item;
        }),
      }));
      showBanner(
        `Fiscal year "${label}" has been unlocked and set to ${targetStatus}.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not unlock: ${msg}`, "info");
    } finally {
      handleCloseUnlock();
    }
  }

  // -- KPI Metrics --------------------------------------------------------
  const activeFY = useMemo(
    () => data.fiscalYears.find((fy) => fy.status === "Active"),
    [data.fiscalYears],
  );
  const lockedCount = useMemo(
    () => data.fiscalYears.filter((fy) => fy.status === "Locked" || fy.payslipsGenerated).length,
    [data.fiscalYears],
  );

  const kpiMetrics: KpiMetric[] = [
    {
      title: "Active Fiscal Year",
      value: activeFY?.label ?? "None Active",
      subtext: activeFY ? `${activeFY.startDateBS} to ${activeFY.endDateBS}` : "Please activate a cycle",
      icon: CalendarDays,
      badge: activeFY ? "Current Active" : "Action Needed",
    },
    {
      title: "Configured Cycles",
      value: `${data.fiscalYears.length} Total FY`,
      subtext: "Recorded accounting periods",
      icon: Calendar,
    },
    {
      title: "Locked Records",
      value: `${lockedCount} Locked`,
      subtext: "Protected from payroll changes",
      icon: Lock,
    },
    {
      title: "Statutory Range",
      value: "Shrawan – Ashadh",
      subtext: "Nepal Government standard",
      icon: CheckCircle2,
    },
  ];

  // -- Render --------------------------------------------------------------

  const content = (
    <>
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={dismissBanner}
      />

      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
          <div>
            <h2 className="text-base font-bold text-payroll-navy">Fiscal Year Cycles</h2>
            <p className="text-xs text-muted-foreground">Manage Bikram Sambat fiscal years and accounting period locks.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DateFormatMenu size="md" />
            <Button
              onClick={handleOpenCreate}
              size="md"
              className="bg-payroll-primary text-white hover:bg-payroll-navy font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span>New Fiscal Year</span>
            </Button>
          </div>
        </div>
      ) : (
        <PageHeader
          title="Fiscal Year Setup"
          description="Manage Bikram Sambat fiscal years and accounting cycle parameters. Historical records are protected once payslips are generated."
        >
          <div className="flex items-center gap-2">
            <DateFormatMenu size="md" />
            <Button
              onClick={handleOpenCreate}
              size="md"
              className="bg-payroll-primary text-white hover:bg-payroll-navy font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span>New Fiscal Year</span>
            </Button>
          </div>
        </PageHeader>
      )}

      <KpiStrip metrics={kpiMetrics} columns={4} />

      <FiscalYearTable
        fiscalYears={data.fiscalYears}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        onToggleStatus={handleToggleStatus}
        onUnlock={handleOpenUnlock}
      />

      <FiscalYearFormModal
        key={editingFY?.id ?? "new"}
        open={isFormOpen}
        initialValue={editingFY}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingFY)}
        fiscalYear={deletingFY}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmUnlockDialog
        open={Boolean(unlockingFY)}
        fiscalYear={unlockingFY}
        onClose={handleCloseUnlock}
        onConfirm={handleConfirmUnlock}
      />
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
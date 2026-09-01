"use client";

import { useState } from "react";
import { FiscalYearHero } from "./fiscal-year-hero";
import { FiscalYearTable } from "./fiscal-year-table";
import { FiscalYearFormModal } from "./fiscal-year-form-modal";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ConfirmLockDialog } from "./confirm-lock-dialog";
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
  lockFiscalYearAction,
} from "@/app/actions/fiscal-year.actions";

interface FiscalYearClientProps {
  initialData: FiscalYearData;
}

/**
 * Top-level state container for the Fiscal Year Setup page.
 *
 * Mutations go through the service layer (via Server Actions),
 * which performs engine validation + authorization before calling
 * the repository. This component is pure orchestration + view.
 */
export function FiscalYearClient({ initialData }: FiscalYearClientProps) {
  const [data, setData] = useState<FiscalYearData>(initialData);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFY, setEditingFY] = useState<FiscalYear | null>(null);
  const [deletingFY, setDeletingFY] = useState<FiscalYear | null>(null);
  const [lockingFY, setLockingFY] = useState<FiscalYear | null>(null);

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
    if (fy.payslipsGenerated) {
      showBanner(
        "Edit is disabled — payslips have been generated for this fiscal year.",
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
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setData((prev) => ({
          ...prev,
          fiscalYears: prev.fiscalYears.map((fy) => (fy.id === result.data!.id ? result.data! : fy))
        }));
        showBanner(`Fiscal year "${result.data!.label}" updated.`);
      } else {
        const result = await createFiscalYearAction(payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setData((prev) => ({
          ...prev,
          fiscalYears: [...prev.fiscalYears, result.data!]
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
    if (fy.payslipsGenerated) {
      showBanner(
        "Delete is disabled — payslips have been generated for this fiscal year.",
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
          fiscalYears: prev.fiscalYears.filter((fy) => fy.id !== deletingFY.id)
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

  // -- Lock -----------------------------------------------------------------

  function handleOpenLock(fy: FiscalYear) {
    setLockingFY(fy);
  }

  function handleCloseLock() {
    setLockingFY(null);
  }

  async function handleConfirmLock() {
    if (!lockingFY) return;
    const label = lockingFY.label;
    try {
      const result = await lockFiscalYearAction(lockingFY.id);
      if (!result.success) {
        showBanner(`Could not lock: ${result.error}`, "info");
      } else {
        setData((prev) => ({
          ...prev,
          fiscalYears: prev.fiscalYears.map((fy) => (fy.id === lockingFY.id ? result.data! : fy))
        }));
        showBanner(`Fiscal year "${label}" has been locked.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not lock: ${msg}`, "info");
    } finally {
      handleCloseLock();
    }
  }

  const isLastActive = lockingFY?.status === "Active" && data.fiscalYears.filter((fy) => fy.status === "Active").length === 1;

  // -- Render --------------------------------------------------------------


  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={dismissBanner}
      />

      <FiscalYearHero onCreate={handleOpenCreate} />

      <FiscalYearTable
        fiscalYears={data.fiscalYears}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        onLock={handleOpenLock}
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

      <ConfirmLockDialog
        open={Boolean(lockingFY)}
        fiscalYear={lockingFY}
        isLastActive={isLastActive}
        onClose={handleCloseLock}
        onConfirm={handleConfirmLock}
      />
    </div>
  );
}
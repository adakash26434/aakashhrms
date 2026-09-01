"use client";

import { useMemo, useState } from "react";
import { Percent } from "lucide-react";
import { TaxRateHero } from "./tax-rate-hero";
import { TaxRateTabs } from "./tax-rate-tabs";
import { TaxRateSlabsCard } from "./tax-rate-slabs-card";
import { TaxRateKpiCards } from "./tax-rate-kpi-cards";
import { TaxSlabFormModal } from "./tax-slab-form-modal";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { Banner, type BannerTone } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import {
  TAX_CATEGORIES,
  type TaxCategory,
  type TaxRateData,
  type TaxSlab,
  type TaxSlabFormData,
} from "@/lib/types/tax-rate";
import {
  countConfiguredCategories,
  highestRateForFY,
  isCategoryConfigured,
  buildNextSlabDefaults,
} from "@/lib/engines/tax-rate.engine";
import { createTaxSlabAction, updateTaxSlabAction, deleteTaxSlabAction } from "@/app/actions/tax-rate.actions";

interface TaxRateClientProps {
  initialData: TaxRateData;
}

interface BannerState {
  visible: boolean;
  message: string;
  tone: BannerTone;
}

/**
 * Top-level state container for the Tax Rate Setup page.
 *
 * Responsibilities:
 *  - Hold the mutable slab dataset (synced to the repository via the
 *    service after every create/update/delete).
 *  - Track the active fiscal year and category tab.
 *  - Wire the form modal, the delete dialog, and the banner.
 *
 * **Data flow:**
 *   user action → service.createSlab/updateSlab/deleteSlab
 *              → repository (mock today, DB tomorrow)
 *              → optimistic state update on success
 *              → banner message
 *
 * All authorization, validation, and persistence live in the service
 * layer — this component is just the orchestrator and the view.
 */
export function TaxRateClient({ initialData }: TaxRateClientProps) {
  // -- Data -----------------------------------------------------------------

  const [slabs, setSlabs] = useState<TaxSlab[]>(initialData.slabs);

  // -- Selected fiscal year -------------------------------------------------
  // Default to the FIRST (newest, non-locked) fiscal year.
  const defaultFYId = useMemo(() => {
    const firstNonLocked = initialData.fiscalYears.find((fy) => !fy.isLocked);
    return (firstNonLocked ?? initialData.fiscalYears[0])?.id ?? "";
  }, [initialData.fiscalYears]);

  const [selectedFYId, setSelectedFYId] = useState<string>(defaultFYId);
  const selectedFY = useMemo(
    () => initialData.fiscalYears.find((fy) => fy.id === selectedFYId),
    [initialData.fiscalYears, selectedFYId],
  );
  const isLocked = Boolean(selectedFY?.isLocked);

  // -- Active category tab --------------------------------------------------

  const [activeCategory, setActiveCategory] = useState<TaxCategory>(
    TAX_CATEGORIES[0],
  );

  // -- Form modal state -----------------------------------------------------

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState<TaxSlab | null>(null);
  const [newSlabDefaults, setNewSlabDefaults] = useState<{
    amountFrom: number;
    amountTo: number | null;
    ratePercent: number;
    fixedDeduction: number;
  } | null>(null);
  // -- Delete dialog state --------------------------------------------------

  const [deletingSlab, setDeletingSlab] = useState<TaxSlab | null>(null);

  const [modalKey, setModalKey] = useState<number>(0);
  const toast = useToast();
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    message: "",
    tone: "success",
  });

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

  // -- Derived: slabs for the active (category, FY) ------------------------

  const slabsForActiveCategory = useMemo(
    () =>
      slabs
        .filter(
          (s) =>
            s.fiscalYearId === selectedFYId && s.category === activeCategory,
        )
        .sort((a, b) => a.amountFrom - b.amountFrom),
    [slabs, selectedFYId, activeCategory],
  );

  /**
   * The "last" (top) slab for the active (category, FY) — used by
   * the form modal to pre-fill the new slab's `amountFrom` to
   * `last.amountTo + 1`.
   */
  const previousSlab =
    slabsForActiveCategory[slabsForActiveCategory.length - 1] ?? null;

  // -- Derived: slabs for KPI cards (all categories, selected FY) ----------

  const slabsForKpi = useMemo(
    () => slabs.filter((s) => s.fiscalYearId === selectedFYId),
    [slabs, selectedFYId],
  );

  // -- Derived: per-category "configured" map -------------------------------

  const configuredMap = useMemo(() => {
    const out: Partial<Record<TaxCategory, boolean>> = {};
    for (const c of TAX_CATEGORIES) {
      out[c] = isCategoryConfigured({
        slabs,
        fiscalYearId: selectedFYId,
        category: c,
      });
    }
    return out;
  }, [slabs, selectedFYId]);

  // -- Form open/close handlers -------------------------------------------

 function handleOpenCreate() {
    // 1. Get all slabs for the CURRENT fiscal year and CURRENT category
    const currentLadder = slabs
      .filter((s) => s.fiscalYearId === selectedFYId && s.category === activeCategory)
      .sort((a, b) => a.amountFrom - b.amountFrom);

    // 2. Find the last slab in that specific ladder
    const last = currentLadder.length > 0 ? currentLadder[currentLadder.length - 1] : null;

    // 3. Let the engine calculate the perfect next defaults
    const defaults = buildNextSlabDefaults(last);
    
    // 4. Save defaults to state and open the modal
    setNewSlabDefaults(defaults);
    setModalKey(Date.now());
    setEditingSlab(null);
    setIsFormOpen(true);
  }

  function handleOpenEdit(slab: TaxSlab) {
    if (isLocked) {
      showBanner(
        "Edit is disabled — payslips have been generated for this fiscal year.",
        "info",
      );
      return;
    }
    setEditingSlab(slab);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingSlab(null);
  }

  // -- Form submit (async — calls the service) -----------------------------

  async function handleSubmitForm(payload: TaxSlabFormData) {
    try {
      if (editingSlab) {
        const result = await updateTaxSlabAction(editingSlab.id, payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setSlabs((all) => all.map((s) => (s.id === result.data!.id ? result.data! : s)));
        showBanner(`Slab updated.`);
      } else {
        const result = await createTaxSlabAction({
          fiscalYearId: selectedFYId,
          category: activeCategory,
          data: payload,
        });
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setSlabs((all) => [...all, result.data!]);
        showBanner(`New slab added to ${activeCategory}.`);
      }
      handleCloseForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${msg}`, "info");
    }
  }



  // -- Delete (async — calls the service) ----------------------------------

  function handleOpenDelete(slab: TaxSlab) {
    if (isLocked) {
      showBanner(
        "Delete is disabled — payslips have been generated for this fiscal year.",
        "info",
      );
      return;
    }
    setDeletingSlab(slab);
  }

  function handleCloseDelete() {
    setDeletingSlab(null);
  }

    async function handleConfirmDelete() {
    if (!deletingSlab) return;
    try {
      const result = await deleteTaxSlabAction(deletingSlab.id);
      if (!result.success) {
        showBanner(`Could not delete: ${result.error}`, "info");
      } else {
        setSlabs((all) => all.filter((s) => s.id !== deletingSlab.id));
        showBanner(`Slab deleted.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not delete: ${msg}`, "info");
    } finally {
      handleCloseDelete();
    }
  }

  // -- KPI derived values (engine functions) --------------------------------

  const highestRate = highestRateForFY({
    slabs,
    fiscalYearId: selectedFYId,
  });
  const configuredCount = countConfiguredCategories({
    slabs,
    fiscalYearId: selectedFYId,
  });

  // -- Render -------------------------------------------------------------

  if (initialData.fiscalYears.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <div className="rounded-xl border border-dashed border-[#d7e8d0] bg-white p-12 shadow-sm space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6faf6]">
            <Percent className="h-8 w-8 text-[#2e7d32]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-[#1b3a1f]">
              No Fiscal Years Defined
            </h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Tax rates are configured per fiscal year. You need to create at least one fiscal year before you can set up tax rates.
            </p>
          </div>
          <div>
            <a
              href="/setup/fiscal-year"
              className="inline-flex items-center justify-center rounded-lg bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-[#1b3a1f] focus:outline-none focus:ring-2 focus:ring-[#2e7d32] focus:ring-offset-2"
            >
              Set Up Fiscal Years
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-350 space-y-6 p-6">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={dismissBanner}
      />

      <TaxRateHero
        fiscalYears={initialData.fiscalYears}
        selectedFYId={selectedFYId}
        onChangeFY={setSelectedFYId}
      />

      <TaxRateTabs
        active={activeCategory}
        onChange={setActiveCategory}
        configuredMap={configuredMap}
      />

      <TaxRateSlabsCard
        category={activeCategory}
        fiscalYearLabel={selectedFY?.label ?? ""}
        slabs={slabsForActiveCategory}
        isLocked={isLocked}
        onAdd={handleOpenCreate}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
      />

      <TaxRateKpiCards
        slabs={slabsForKpi}
        highestRate={highestRate}
        configuredCount={configuredCount}
        totalCategories={TAX_CATEGORIES.length}
      />

           <TaxSlabFormModal
        key={editingSlab ? `edit-${editingSlab.id}` : `new-${modalKey}`}
        open={isFormOpen}
        editingSlab={editingSlab}
        fiscalYearLabel={
          initialData.fiscalYears.find((f) => f.id === selectedFYId)?.label ?? ""
        }
        category={activeCategory}
        newDefaults={newSlabDefaults} 
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingSlab)}
        slab={deletingSlab}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

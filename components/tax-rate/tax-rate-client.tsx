"use client";

import { useMemo, useState } from "react";
import { Percent, ChevronDown, Layers, TrendingUp, ListChecks } from "lucide-react";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStrip, type KpiMetric } from "@/components/layout/kpi-strip";
import { DropdownMenu, type DropdownOption } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { TaxRateTabs } from "./tax-rate-tabs";
import { TaxRateSlabsCard } from "./tax-rate-slabs-card";
import { TaxSlabFormModal } from "./tax-slab-form-modal";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { Banner, type BannerTone } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import {
  TAX_CATEGORIES,
  formatRateLabel,
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
  embedded?: boolean;
}

interface BannerState {
  visible: boolean;
  message: string;
  tone: BannerTone;
}

export function TaxRateClient({ initialData, embedded = false }: TaxRateClientProps) {
  // -- Data -----------------------------------------------------------------
  const [slabs, setSlabs] = useState<TaxSlab[]>(initialData.slabs);

  // -- Selected fiscal year -------------------------------------------------
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
    const currentLadder = slabs
      .filter((s) => s.fiscalYearId === selectedFYId && s.category === activeCategory)
      .sort((a, b) => a.amountFrom - b.amountFrom);

    const last = currentLadder.length > 0 ? currentLadder[currentLadder.length - 1] : null;
    const defaults = buildNextSlabDefaults(last);
    
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

  // -- FY Dropdown Options ------------------------------------------------
  const fyDropdownOptions: DropdownOption<string>[] = useMemo(
    () =>
      initialData.fiscalYears.map((fy) => ({
        value: fy.id,
        label: fy.label,
        description: fy.isLocked
          ? "Locked — payslips generated"
          : "Active — editable",
        adornment: fy.isLocked ? (
          <Badge variant="default" className="text-2xs">
            Locked
          </Badge>
        ) : (
          <Badge variant="success" className="text-2xs">
            Active
          </Badge>
        ),
      })),
    [initialData.fiscalYears],
  );

  // -- KPI Metrics --------------------------------------------------------
  const kpiMetrics: KpiMetric[] = useMemo(
    () => [
      {
        title: "Selected Fiscal Year",
        value: selectedFY?.label ?? "None Selected",
        subtext: isLocked ? "Locked — payslips generated" : "Active & editable cycle",
        icon: Percent,
        badge: isLocked ? "Locked" : "Active",
      },
      {
        title: "Slabs Configured",
        value: `${slabsForKpi.length} Active Slabs`,
        subtext: "Across all tax categories",
        icon: Layers,
      },
      {
        title: "Categories Defined",
        value: `${configuredCount} of ${TAX_CATEGORIES.length} Categories`,
        subtext: "Single, Married, and Handicapped",
        icon: ListChecks,
        badge: configuredCount === TAX_CATEGORIES.length ? "Complete" : "In Progress",
      },
      {
        title: "Highest Marginal Rate",
        value: highestRate > 0 ? formatRateLabel(highestRate) : "—",
        subtext: "Maximum statutory bracket",
        icon: TrendingUp,
      },
    ],
    [selectedFY, isLocked, slabsForKpi.length, configuredCount, highestRate],
  );

  // Empty state: no fiscal years exist at all.
  if (initialData.fiscalYears.length === 0) {
    return (
      <PageFrame size="wide" spacing="default">
        <PageHeader
          title="Tax Rates & Slabs Setup"
          description="Configure progressive TDS slabs, marginal thresholds, and deduction rates per fiscal year."
        />
        <div className="rounded-xl border border-payroll-light bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-payroll-cream text-payroll-primary">
            <Percent className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-bold text-payroll-navy">
            No Fiscal Years Defined
          </h2>
          <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
            Tax rates are configured per fiscal year. You need to create at least one fiscal year before you can set up tax rates.
          </p>
          <div className="mt-5">
            <a
              href="/setup/company-setup?section=fiscal_year"
              className="inline-flex items-center justify-center rounded-lg bg-payroll-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-payroll-primary-hover cursor-pointer"
            >
              Set Up Fiscal Years
            </a>
          </div>
        </div>
      </PageFrame>
    );
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
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              Progressive tax brackets
            </h2>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
              Progressive slab-based TDS thresholds for {selectedFY?.label ?? "the selected cycle"} across Individual Single, Married, and Handicapped categories.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <DropdownMenu<string>
              value={selectedFYId}
              onChange={setSelectedFYId}
              options={fyDropdownOptions}
              ariaLabel="Select fiscal year"
              minWidth={220}
              renderTrigger={({ open, selected, triggerRef, toggle }) => (
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={toggle}
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  className="h-9 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-xs transition-colors hover:bg-slate-50 focus:outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary cursor-pointer"
                >
                  <span className="text-slate-400">Fiscal year:</span>
                  <span className="font-semibold text-slate-900">
                    {selected?.label ?? "Select year"}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            />
          </div>
        </div>
      ) : (
        <PageHeader
          title="Tax brackets &amp; TDS setup"
          description={`Configure progressive TDS slabs, marginal thresholds, and deduction rates for ${selectedFY?.label ?? "the selected fiscal year"}.`}
        >
          <DropdownMenu<string>
            value={selectedFYId}
            onChange={setSelectedFYId}
            options={fyDropdownOptions}
            ariaLabel="Select fiscal year"
            minWidth={220}
            renderTrigger={({ open, selected, triggerRef, toggle }) => (
              <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="h-9 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-xs transition-colors hover:bg-slate-50 focus:outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary cursor-pointer"
              >
                <span className="text-slate-400">Fiscal year:</span>
                <span className="font-semibold text-slate-900">
                  {selected?.label ?? "Select year"}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          />
        </PageHeader>
      )}

      {embedded ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 bg-slate-50/80 px-4 py-2.5 rounded-lg border border-slate-200/80">
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <span className="text-slate-400">Active period:</span>
            <span className="font-semibold text-slate-900">{selectedFY?.label ?? "None selected"}</span>
            {isLocked ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.2 text-2xs font-mono font-medium text-amber-800 border border-amber-200">
                Locked
              </span>
            ) : (
              <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-2xs font-mono font-medium text-emerald-800 border border-emerald-200/60">
                Editable
              </span>
            )}
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <div>
            <span className="text-slate-400">Configured slabs:</span>{" "}
            <strong className="text-slate-900 font-semibold">{slabsForKpi.length}</strong>
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <div>
            <span className="text-slate-400">Categories defined:</span>{" "}
            <strong className="text-slate-900 font-semibold">{configuredCount} of {TAX_CATEGORIES.length}</strong>
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <div>
            <span className="text-slate-400">Top rate:</span>{" "}
            <strong className="text-emerald-900 font-semibold">{highestRate > 0 ? formatRateLabel(highestRate) : "—"}</strong>
          </div>
        </div>
      ) : (
        <KpiStrip metrics={kpiMetrics} columns={4} />
      )}

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

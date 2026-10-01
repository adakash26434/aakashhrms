"use client";

import { useMemo, useState } from "react";
import { Plus, Layers, ArrowUpCircle, ArrowDownCircle, ShieldCheck } from "lucide-react";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStrip, type KpiMetric } from "@/components/layout/kpi-strip";
import { Button } from "@/components/ui/button";
import { Banner, type BannerTone } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import type { PayHead, PayHeadData, PayHeadFormData, TypeFilter } from "@/lib/types/pay-head";
import { countByType, filterPayHeads } from "@/lib/engines/pay-head.engine";
import { createPayHeadAction, updatePayHeadAction, deletePayHeadAction } from "@/app/actions/pay-head.actions";
import { PayHeadSearchAndTabs } from "./pay-head-search-and-tabs";
import { PayHeadsCard } from "./pay-heads-card";
import { PayHeadDetailPanel } from "./pay-head-detail-panel";
import { PayHeadFormModal } from "./pay-head-form-modal";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { HowPayHeadsWork } from "./how-pay-heads-work";

interface PayHeadClientProps {
  initialData: PayHeadData;
  embedded?: boolean;
}

interface BannerState {
  visible: boolean;
  message: string;
  tone: BannerTone;
}

/**
 * Top-level state container for the Pay Head Setup page.
 *
 * Responsibilities:
 *  - Hold the mutable pay-head dataset (synced to the repository
 *    via the service after every create/update/delete).
 *  - Track the type filter, the search query, and the modal/panel
 *    state.
 *  - Wire the form modal, the delete dialog, the detail panel,
 *    and the banner.
 *
 * **Data flow:**
 *   user action → service.createPayHead / updatePayHead / deletePayHead
 *              → repository (mock today, DB tomorrow)
 *              → optimistic state update on success
 *              → banner message
 *
 * All authorization, validation, and persistence live in the
 * service layer — this component is just the orchestrator and
 * the view.
 */
export function PayHeadClient({ initialData, embedded = false }: PayHeadClientProps) {
  // -- Data -----------------------------------------------------------------

  const [heads, setHeads] = useState<PayHead[]>(initialData.payHeads);
  const [departments] = useState(initialData.departments);
  const [designations] = useState(initialData.designations);

  // -- Derived maps for fast id → name lookups -----------------------------

  const departmentNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments) m.set(d.id, d.name);
    return m;
  }, [departments]);

  const designationNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of designations) m.set(d.id, d.name);
    return m;
  }, [designations]);

  // -- Filter + search ------------------------------------------------------

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // -- View / Edit / Delete state ------------------------------------------

  const [viewingHead, setViewingHead] = useState<PayHead | null>(null);
  const [editingHead, setEditingHead] = useState<PayHead | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingHead, setDeletingHead] = useState<PayHead | null>(null);

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

  // -- Derived: filtered list + counts -------------------------------------

  const filtered = useMemo(
    () => filterPayHeads({ heads, typeFilter, search }),
    [heads, typeFilter, search],
  );

  const counts = useMemo(() => countByType(heads), [heads]);

  // -- Open / close handlers -----------------------------------------------

  function handleOpenCreate() {
    setEditingHead(null);
    setIsFormOpen(true);
  }

  function handleOpenView(head: PayHead) {
    setViewingHead(head);
  }

  function handleCloseView() {
    setViewingHead(null);
  }

  function handleOpenEditFromTable(head: PayHead) {
    setViewingHead(null); // close any open detail panel
    setEditingHead(head);
    setIsFormOpen(true);
  }

  function handleOpenEditFromPanel(head: PayHead) {
    setViewingHead(null);
    setEditingHead(head);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingHead(null);
  }

  function handleOpenDelete(head: PayHead) {
    setDeletingHead(head);
  }

  function handleCloseDelete() {
    setDeletingHead(null);
  }

  // -- Form submit (async — calls the service) -----------------------------

    async function handleSubmitForm(payload: PayHeadFormData) {
    try {
      if (editingHead) {
        const result = await updatePayHeadAction(editingHead.id, payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "error");
          return;
        }
        // Update the array state
        setHeads((prev) => prev.map((ph) => (ph.id === result.data!.id ? result.data! : ph)));
        showBanner(`Pay Head "${result.data!.name}" updated.`);
      } else {
        const result = await createPayHeadAction(payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "error");
          return;
        }
        // Append to the array state
        setHeads((prev) => [...prev, result.data!]);
        showBanner(`Pay Head "${result.data!.name}" created.`);
      }
      handleCloseForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${msg}`, "error");
    }
  }

  async function handleConfirmDelete() {
    if (!deletingHead) return;
    const name = deletingHead.name;
    try {
      const result = await deletePayHeadAction(deletingHead.id);
      if (!result.success) {
        showBanner(result.error || `Could not delete pay head "${name}".`, "error");
      } else {
        // Filter out from the array state
        setHeads((prev) => prev.filter((ph) => ph.id !== deletingHead.id));
        showBanner(`Pay Head "${name}" deleted.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(msg, "error");
    } finally {
      handleCloseDelete();
    }
  }


  // -- KPI Metrics --------------------------------------------------------
  const kpiMetrics: KpiMetric[] = useMemo(
    () => [
      {
        title: "Total Heads",
        value: `${counts.total} Heads`,
        subtext: "Master salary components",
        icon: Layers,
      },
      {
        title: "Allowances (Earnings)",
        value: `${counts.allowances} Earnings`,
        subtext: "Taxable & fixed allowances",
        icon: ArrowUpCircle,
        badge: "Earnings",
      },
      {
        title: "Deductions",
        value: `${counts.deductions} Deductions`,
        subtext: "Salary withholding heads",
        icon: ArrowDownCircle,
        badge: "Deductions",
      },
      {
        title: "Statutory Heads",
        value: `${counts.statutory} Mandatory`,
        subtext: "Nepal Labour & Tax mandates",
        icon: ShieldCheck,
        badge: "Statutory",
      },
    ],
    [counts],
  );

  // -- Render -------------------------------------------------------------

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
              Salary pay heads
            </h2>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
              Allowance and deduction components with calculation rules, taxable status, and statutory compliance flags.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleOpenCreate}
            size="sm"
            className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-xs h-9 px-3.5 rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add pay head</span>
          </Button>
        </div>
      ) : (
        <PageHeader
          title="Salary pay heads master"
          description="Configure salary allowance and deduction heads with calculation rules, tax effects, statutory compliance flags, and organizational applicability."
        >
          <Button
            type="button"
            onClick={handleOpenCreate}
            size="sm"
            className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-xs h-9 px-3.5 rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add pay head</span>
          </Button>
        </PageHeader>
      )}

      {embedded ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 bg-slate-50/80 px-4 py-2.5 rounded-lg border border-slate-200/80">
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <span className="text-slate-400">Total heads:</span>
            <span className="font-semibold text-slate-900">{counts.total}</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <div>
            <span className="text-slate-400">Allowances:</span>{" "}
            <strong className="text-slate-900 font-semibold">{counts.allowances}</strong>
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <div>
            <span className="text-slate-400">Deductions:</span>{" "}
            <strong className="text-slate-900 font-semibold">{counts.deductions}</strong>
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <div>
            <span className="text-slate-400">Statutory mandatory:</span>{" "}
            <strong className="text-slate-900 font-semibold">{counts.statutory}</strong>
          </div>
        </div>
      ) : (
        <KpiStrip metrics={kpiMetrics} columns={4} />
      )}

      <PayHeadSearchAndTabs
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        totalCount={counts.total}
        filteredCount={filtered.length}
      />

      <PayHeadsCard
        heads={filtered}
        departmentNameById={departmentNameById}
        totalDepartmentCount={initialData.departments.length}
        onView={handleOpenView}
        onEdit={handleOpenEditFromTable}
        onDelete={handleOpenDelete}
      />

      {!embedded && <HowPayHeadsWork />}

      <PayHeadDetailPanel
        open={Boolean(viewingHead)}
        head={viewingHead}
        departmentNameById={departmentNameById}
        designationNameById={designationNameById}
        totalDepartmentCount={departments.length}
        totalDesignationCount={designations.length}
        onClose={handleCloseView}
        onEdit={handleOpenEditFromPanel}
      />

      <PayHeadFormModal
        key={editingHead?.id ?? "new"}
        open={isFormOpen}
        editingHead={editingHead}
        departments={departments}
        designations={designations}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingHead)}
        head={deletingHead}
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

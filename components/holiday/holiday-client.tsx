"use client";

import { useMemo, useState } from "react";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStrip, type KpiMetric } from "@/components/layout/kpi-strip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, type DropdownOption } from "@/components/ui/dropdown-menu";
import { CalendarDays, Sun, Building2, MapPin, Plus, ChevronDown } from "lucide-react";
import { HolidaySearch } from "./holiday-search";
import { HolidayCardsGrid } from "./holiday-cards-grid";
import { HolidayDetailPanel } from "./holiday-detail-panel";
import { HolidayFormModal } from "./holiday-form-modal";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { HowHolidaysWork } from "./how-holidays-work";
import { Banner, type BannerTone } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import type { Holiday, HolidayData, HolidayFormData, CategoryFilter } from "@/lib/types/holiday";
import { countHolidays, filterHolidays } from "@/lib/engines/holiday.engine";

// Server Actions
import { createHolidayAction, updateHolidayAction, deleteHolidayAction } from "@/app/actions/holiday.actions";

interface HolidayClientProps {
  initialData: HolidayData;
}

export function HolidayClient({ initialData }: HolidayClientProps) {
  const [data, setData] = useState<HolidayData>(initialData);
  
  // -- FY State --
  const [selectedFYId, setSelectedFYId] = useState<string>(
    data.fiscalYears[0]?.id || "",
  );
  
  // -- Filter + Search State --
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  // -- Modal / Panel State --
  const [viewingHoliday, setViewingHoliday] = useState<Holiday | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);
  
  const [modalKey, setModalKey] = useState<number>(0);

  const toast = useToast();
  const [banner, setBanner] = useState<{ visible: boolean; message: string; tone: BannerTone }>({
    visible: false, message: "", tone: "success"
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

  // -- Derived Data --
  const branchNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of data.branches) m.set(b.id, b.name);
    return m;
  }, [data.branches]);

  const filtered = useMemo(
    () => filterHolidays({ holidays: data.holidays, search, category: categoryFilter }),
    [data.holidays, search, categoryFilter]
  );

  const counts = useMemo(() => countHolidays(data.holidays), [data.holidays]);

  const selectedFY = data.fiscalYears?.find((fy) => fy.id === selectedFYId);

  const fyOptions: DropdownOption<string>[] = useMemo(
    () =>
      (data.fiscalYears || []).map((fy) => ({
        value: fy.id,
        label: fy.label,
        description: fy.isLocked
          ? "Locked — payslips have been generated"
          : "Active — editable",
        adornment: fy.isLocked ? (
          <Badge variant="default" className="text-[10px]">
            Locked
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            Active
          </Badge>
        ),
      })),
    [data.fiscalYears],
  );

  const kpiMetrics: KpiMetric[] = useMemo(
    () => [
      {
        title: "Total Holidays",
        value: counts.total,
        subtext: "Defined in system",
        icon: CalendarDays,
      },
      {
        title: "Holiday Days",
        value: `${counts.totalDays} Days`,
        subtext: "Total off days",
        icon: Sun,
      },
      {
        title: "All Branches",
        value: counts.allBranchCount,
        subtext: "Nationwide applicability",
        icon: Building2,
      },
      {
        title: "Branch Specific",
        value: counts.total - counts.allBranchCount,
        subtext: "Regional holidays",
        icon: MapPin,
      },
    ],
    [counts],
  );

  // -- Handlers --
  function handleOpenCreate() {
    setEditingHoliday(null);
    setModalKey(Date.now());
    setIsFormOpen(true);
  }

  function handleOpenView(h: Holiday) { setViewingHoliday(h); }
  function handleCloseView() { setViewingHoliday(null); }

  function handleOpenEditFromGrid(h: Holiday) {
    setViewingHoliday(null);
    setEditingHoliday(h);
    setIsFormOpen(true);
  }

  function handleOpenEditFromPanel(h: Holiday) {
    setViewingHoliday(null);
    setEditingHoliday(h);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingHoliday(null);
  }

  function handleOpenDelete(h: Holiday) { setDeletingHoliday(h); }
  function handleCloseDelete() { setDeletingHoliday(null); }

  // -- Server Action Mutations --
  async function handleSubmitForm(payload: HolidayFormData) {
    try {
      if (editingHoliday) {
        const result = await updateHolidayAction(editingHoliday.id, payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setData((prev) => ({
          ...prev,
          holidays: prev.holidays.map((h) => (h.id === result.data!.id ? result.data! : h))
        }));
        showBanner(`Holiday "${result.data!.name}" updated.`);
      } else {
        const result = await createHolidayAction(payload);
        if (!result.success) {
          showBanner(`Could not save: ${result.validationErrors ? Object.values(result.validationErrors)[0] : result.error}`, "info");
          return;
        }
        setData((prev) => ({
          ...prev,
          holidays: [...prev.holidays, result.data!]
        }));
        showBanner(`Holiday "${result.data!.name}" created.`);
      }
      handleCloseForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not save: ${msg}`, "info");
    }
  }

  async function handleConfirmDelete() {
    if (!deletingHoliday) return;
    const name = deletingHoliday.name;
    try {
      const result = await deleteHolidayAction(deletingHoliday.id);
      if (!result.success) {
        showBanner(`Could not delete: ${result.error}`, "info");
      } else {
        setData((prev) => ({
          ...prev,
          holidays: prev.holidays.filter((h) => h.id !== deletingHoliday.id)
        }));
        showBanner(`Holiday "${name}" deleted.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      showBanner(`Could not delete: ${msg}`, "info");
    } finally {
      handleCloseDelete();
    }
  }

  return (
    <PageFrame size="wide" spacing="default">
      <Banner visible={banner.visible} message={banner.message} tone={banner.tone} onDismiss={dismissBanner} />

      <PageHeader
        title="Holidays Setup"
        description={`Define festival holidays and calendar events for ${selectedFY?.label ?? "the selected fiscal year"}. All branches or specific branches can be assigned.`}
      >
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu<string>
            value={selectedFYId}
            onChange={setSelectedFYId}
            options={fyOptions}
            ariaLabel="Select fiscal year"
            minWidth={260}
            renderTrigger={({ open, selected, triggerRef, toggle }) => (
              <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-payroll-border bg-white px-3 text-sm font-medium text-payroll-navy shadow-xs transition-colors hover:bg-payroll-light focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
              >
                <CalendarDays className="h-4 w-4 text-payroll-primary" />
                <span className="text-muted-foreground">FY</span>
                <span className="text-sm font-semibold text-payroll-navy">
                  {selected?.label ?? "Select year"}
                </span>
                {selected?.adornment}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          />
          <Button type="button" onClick={handleOpenCreate} size="md">
            <Plus className="h-4 w-4 mr-1.5" />
            New Holiday
          </Button>
        </div>
      </PageHeader>

      <KpiStrip metrics={kpiMetrics} columns={4} />

      <HolidaySearch
        search={search}
        onSearchChange={setSearch}
        category={categoryFilter}
        onCategoryChange={setCategoryFilter}
        totalCount={data.holidays.length}
        filteredCount={filtered.length}
      />

      <HolidayCardsGrid
        holidays={filtered}
        branchNameById={branchNameById}
        totalBranchCount={data.branches.length}
        onView={handleOpenView}
        onEdit={handleOpenEditFromGrid}
        onDelete={handleOpenDelete}
      />

      <HowHolidaysWork />

      <HolidayDetailPanel
        open={Boolean(viewingHoliday)}
        holiday={viewingHoliday}
        branchNameById={branchNameById}
        totalBranchCount={data.branches.length}
        onClose={handleCloseView}
        onEdit={handleOpenEditFromPanel}
      />

      <HolidayFormModal
        key={editingHoliday ? `edit-${editingHoliday.id}` : `new-${modalKey}`}
        open={isFormOpen}
        editingHoliday={editingHoliday}
        branches={data.branches}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingHoliday)}
        holiday={deletingHoliday}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
      />
    </PageFrame>
  );
}
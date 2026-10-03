"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, PanelRight, Pencil, Plus, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { SplitView } from "@/components/kit/split-view";
import { WindowButton } from "@/components/kit/window";
import { deleteEmployeeAction } from "@/app/actions/employee.actions";
import { EMPLOYEE_CATEGORIES } from "@/lib/types/system-control";
import type { EmployeeListRow, EmployeeRegisterData } from "@/lib/types/employee";
import { EmployeeQuickView } from "./employee-quick-view";
import { EmployeeRegister } from "./employee-register";

const QUICK_VIEW_KEY = "aakash.employees.quickView";
const REGISTER_FILTERS = ["dept", "branch", "category", "status"] as const;

function readQuickView(): boolean {
  try {
    return localStorage.getItem(QUICK_VIEW_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Filter ids (never search text or names) go in the URL, so Back from a record returns to the same list. */
function syncUrl(values: FilterValues) {
  const params = new URLSearchParams();
  for (const key of REGISTER_FILTERS) if (values[key]) params.set(key, values[key]);
  const text = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${text ? `?${text}` : ""}`);
}

/**
 * Employees register (4.2, template A): toolbar, filters, the grid and a quick
 * view. Enter or double-click opens the full record page.
 */
export function EmployeeClient({
  data,
  initialFilters,
  initialSearch,
}: {
  data: EmployeeRegisterData;
  initialFilters: FilterValues;
  initialSearch: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const { rows, counts, permissions } = data;
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [search, setSearch] = useState(initialSearch);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickView, setQuickView] = useState(true);
  const [deleting, setDeleting] = useState<EmployeeListRow | null>(null);

  // Browser storage is only readable after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setQuickView(readQuickView()), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!filters.dept || r.departmentId === filters.dept) &&
        (!filters.branch || r.branchId === filters.branch) &&
        (!filters.category || r.category === filters.category) &&
        (!filters.status || r.status === filters.status) &&
        (!q || r.fullName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q) || r.attendanceCode.toLowerCase().includes(q))
    );
  }, [rows, filters, search]);

  const active = visible.find((r) => r.id === activeId) ?? null;
  const open = (row: EmployeeListRow | null) => row && router.push(`/workforce/employees/${row.id}`);
  const edit = (row: EmployeeListRow | null) => row && router.push(`/workforce/employees/${row.id}/edit`);

  const toggleQuickView = () => {
    const next = !quickView;
    setQuickView(next);
    try {
      localStorage.setItem(QUICK_VIEW_KEY, next ? "on" : "off");
    } catch {
      /* preference only */
    }
  };

  const changeFilters = (next: FilterValues) => {
    setFilters(next);
    syncUrl(next);
  };

  const filtered = Object.values(filters).some(Boolean) || search.trim() !== "";
  const summary = [`${counts.active} active`, counts.inactive ? `${counts.inactive} inactive` : null, counts.toFix ? `${counts.toFix} with records to fix` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageBar
        title="Employees"
        description={counts.total ? summary : "No employees yet"}
        actions={[
          {
            id: "new",
            label: "New employee",
            icon: Plus,
            group: "create",
            primary: true,
            shortcut: "Ctrl+N",
            hidden: !permissions.add,
            onClick: () => router.push("/workforce/employees/new"),
          },
          {
            id: "open",
            label: "Open",
            icon: ExternalLink,
            group: "selection",
            disabled: !active,
            disabledReason: "Select an employee first",
            onClick: () => open(active),
          },
          {
            id: "edit",
            label: "Edit",
            icon: Pencil,
            group: "selection",
            shortcut: "F2",
            hidden: !permissions.edit,
            disabled: !active,
            disabledReason: "Select an employee first",
            onClick: () => edit(active),
          },
          {
            id: "delete",
            label: "Delete",
            icon: Trash2,
            group: "selection",
            shortcut: "Delete",
            hidden: !permissions.remove,
            disabled: !active,
            disabledReason: "Select an employee first",
            onClick: () => setDeleting(active),
          },
          { id: "quick", label: quickView ? "Hide quick view" : "Show quick view", icon: PanelRight, group: "output", onClick: toggleQuickView },
          {
            id: "refresh",
            label: refreshing ? "Refreshing…" : "Refresh",
            icon: RefreshCw,
            group: "refresh",
            disabled: refreshing,
            onClick: () => startRefresh(() => router.refresh()),
          },
        ]}
      />

      <FilterStrip
        id="employees"
        className="mb-3"
        values={filters}
        onChange={changeFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Name, code or attendance code" }}
        filters={[
          { id: "dept", label: "Department", allLabel: "All departments", options: data.departments.map((d) => ({ value: d.id, label: d.name })) },
          { id: "branch", label: "Branch", allLabel: "All branches", options: data.branches.map((b) => ({ value: b.id, label: b.name })) },
          { id: "category", label: "Category", allLabel: "All categories", options: EMPLOYEE_CATEGORIES.map((c) => ({ value: c, label: c === "OutSource" ? "Outsourced" : c })) },
          { id: "status", label: "Status", allLabel: "All statuses", options: [{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }] },
        ]}
      />

      <SplitView
        id="employees"
        detailTitle={active ? `${active.fullName} · ${active.employeeCode}` : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={quickView && active ? <EmployeeQuickView row={active} canEdit={permissions.edit} /> : null}
        master={
          <EmployeeRegister
            rows={visible}
            activeId={activeId}
            onActive={(r) => setActiveId(r.id)}
            onOpen={open}
            selected={selected}
            onSelectedChange={setSelected}
            canExport={permissions.export}
            empty={
              filtered
                ? {
                    title: "No employees match",
                    description: "Clear the filters or search to see everyone.",
                    action: (
                      <WindowButton
                        onClick={() => {
                          changeFilters({});
                          setSearch("");
                        }}
                      >
                        Clear filters
                      </WindowButton>
                    ),
                  }
                : {
                    title: "No employees yet",
                    description: "Add your first employee to start running payroll.",
                    action: permissions.add ? (
                      <WindowButton variant="primary" onClick={() => router.push("/workforce/employees/new")}>
                        <UserPlus className="h-3.5 w-3.5" /> Add employee
                      </WindowButton>
                    ) : undefined,
                  }
            }
          />
        }
      />

      <Confirm
        open={!!deleting}
        tone="danger"
        title={deleting ? `Delete ${deleting.fullName}?` : ""}
        confirmLabel="Delete permanently"
        requireText={deleting?.employeeCode}
        message={
          <>
            This removes the employee and their login for good. Employees with payroll, loans or pending leave cannot be deleted; set their
            status to Inactive with a separation date instead.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteEmployeeAction(deleting.id);
          if (!result.success) throw new Error(result.error);
          setDeleting(null);
          setActiveId(null);
          router.refresh();
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

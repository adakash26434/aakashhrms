"use client";

import { useMemo, useState, type SyntheticEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterDef, type FilterValues } from "@/components/kit/filter-strip";
import { SplitView } from "@/components/kit/split-view";
import { WindowButton } from "@/components/kit/window";
import { addressLine } from "@/lib/constants/nepal-locations";
import { ORG_KIND_LABEL, REMOTE_CATEGORIES, typeEligibility as eligibility } from "@/lib/engines/organization.engine";
import type {
  OrgBranch,
  OrgDepartment,
  OrgDesignation,
  OrgEmploymentType,
  OrgKind,
  OrgLevel,
  OrganizationData,
  OrgStatus,
  OrgUsage,
} from "@/lib/types/organization";
import { formatPhoneNumber } from "@/lib/utils/phone";
import { cn } from "@/lib/utils";
import type { OrgSelection } from "./organization-client";
import { OrganizationDetail } from "./organization-detail";

type Row = { id: string; name: string; status: OrgStatus; usage: OrgUsage; isHeadOffice?: boolean };

const stop = (e: SyntheticEvent) => e.stopPropagation();

/** Row actions: Edit, and the Active / Inactive switch (asks first, never toggles silently). */
function RowActions<T extends Row>({ row, kind, onEdit, onToggleStatus }: { row: T; kind: OrgKind; onEdit?: (kind: OrgKind, id: string) => void; onToggleStatus?: (t: OrgSelection) => void }) {
  if (!onEdit && !onToggleStatus) return null;
  const active = row.status === "active";
  const locked = kind === "branch" && row.isHeadOffice && active;
  return (
    <span className="flex items-center gap-1">
      {onEdit && (
        <button
          type="button"
          tabIndex={-1}
          title={`Edit ${row.name}`}
          aria-label={`Edit ${row.name}`}
          onClick={(e) => {
            stop(e);
            onEdit(kind, row.id);
          }}
          onDoubleClick={stop}
          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
      {onToggleStatus && (
        <button
          type="button"
          role="switch"
          aria-checked={active}
          tabIndex={-1}
          disabled={locked}
          title={locked ? "The head office stays active" : active ? "Make inactive" : "Make active"}
          aria-label={`${row.name}: ${active ? "active, click to make inactive" : "inactive, click to make active"}`}
          onClick={(e) => {
            stop(e);
            onToggleStatus({ kind, id: row.id, name: row.name, status: row.status, usage: row.usage, isHeadOffice: row.isHeadOffice });
          }}
          onDoubleClick={stop}
          className={cn(
            "relative ml-1 inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            active ? "bg-success" : "bg-line-strong"
          )}
        >
          <span className={cn("absolute h-3 w-3 rounded-full bg-white shadow transition-transform", active ? "translate-x-3.5" : "translate-x-0.5")} />
        </button>
      )}
    </span>
  );
}

const STATUS_FILTER: FilterDef = {
  id: "status",
  label: "Status",
  allLabel: "All statuses",
  options: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
};

interface RegisterProps<T extends Row> {
  kind: OrgKind;
  rows: T[];
  columns: GridColumn<T>[];
  matches: (row: T, query: string, filters: FilterValues) => boolean;
  filters?: FilterDef[];
  searchPlaceholder: string;
  data: OrganizationData;
  selectedId: string | null;
  onSelect: (s: OrgSelection) => void;
  onEdit?: (kind: OrgKind, id: string) => void;
  onNew?: () => void;
}

/** One master's register: filters, the grid and the detail pane (template A). */
function Register<T extends Row>({ kind, rows, columns, matches, filters = [], searchPlaceholder, data, selectedId, onSelect, onEdit, onNew }: RegisterProps<T>) {
  const [values, setValues] = useState<FilterValues>({ status: "active" });
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (!values.status || r.status === values.status) && matches(r, q, values));
  }, [rows, values, search, matches]);
  const active = rows.find((r) => r.id === selectedId) ?? null;
  const select = (r: T) => onSelect({ kind, id: r.id, name: r.name, status: r.status, usage: r.usage, isHeadOffice: r.isHeadOffice });
  const filtered = search.trim() !== "" || Object.entries(values).some(([k, v]) => v && !(k === "status" && v === "active"));
  const noun = ORG_KIND_LABEL[kind];

  return (
    <div className="p-3">
      <FilterStrip
        id={`org-${kind}`}
        className="mb-3"
        values={values}
        onChange={setValues}
        search={{ value: search, onChange: setSearch, placeholder: searchPlaceholder }}
        filters={[...filters, STATUS_FILTER]}
      />
      <SplitView
        id={`org-${kind}`}
        detailTitle={active ? active.name : undefined}
        onCloseDetail={() => onSelect({ kind, id: "", name: "", status: "active", usage: { employees: 0 } })}
        detail={active ? <OrganizationDetail kind={kind} id={active.id} data={data} onEdit={onEdit} /> : null}
        master={
          <DataGrid
            id={`org-${kind}`}
            label={`${noun[0].toUpperCase()}${noun.slice(1)}s`}
            columns={columns}
            rows={visible}
            getRowId={(r) => r.id}
            activeRowId={selectedId}
            onActiveRowChange={select}
            onOpen={(r) => (onEdit ? onEdit(kind, r.id) : select(r))}
            pageSize={100}
            maxHeight="calc(100vh - 330px)"
            empty={
              filtered
                ? {
                    title: `No ${noun}s match`,
                    description: "Clear the search or filters to see everything.",
                    action: (
                      <WindowButton
                        onClick={() => {
                          setValues({});
                          setSearch("");
                        }}
                      >
                        Clear filters
                      </WindowButton>
                    ),
                  }
                : {
                    title: `No ${noun}s yet`,
                    description: kind === "level" ? "Add levels one by one, or load an industry scale from the Levels window." : undefined,
                    action: onNew ? (
                      <WindowButton variant="primary" onClick={onNew}>
                        <Plus className="h-3.5 w-3.5" /> New {noun}
                      </WindowButton>
                    ) : undefined,
                  }
            }
          />
        }
      />
    </div>
  );
}

const lower = (v: string | null | undefined) => (v ?? "").toLowerCase();
const names = (ids: string[], list: { id: string; name: string }[]) =>
  ids
    .map((id) => list.find((x) => x.id === id)?.name)
    .filter(Boolean)
    .join(", ");

/** The register for the chosen master. */
export function OrganizationRegisters({
  kind,
  data,
  selectedId,
  onSelect,
  onEdit,
  onToggleStatus,
  onNew,
}: {
  kind: OrgKind;
  data: OrganizationData;
  selectedId: string | null;
  onSelect: (s: OrgSelection | null) => void;
  onEdit?: (kind: OrgKind, id: string) => void;
  onToggleStatus?: (t: OrgSelection) => void;
  onNew?: () => void;
}) {
  const select = (s: OrgSelection) => onSelect(s.id ? s : null);
  const actions = <T extends Row>(): GridColumn<T> => ({
    id: "actions",
    header: "Actions",
    width: 76,
    sortable: false,
    hideable: false,
    value: () => "",
    cell: (r) => <RowActions row={r} kind={kind} onEdit={onEdit} onToggleStatus={onToggleStatus} />,
  });
  const people = data.people;
  const personName = (id: string | null) => (id ? people?.find((p) => p.id === id)?.fullName : undefined);
  const common = { data, selectedId, onSelect: select, onEdit, onNew };

  switch (kind) {
    case "branch":
      return (
        <Register<OrgBranch>
          {...common}
          kind="branch"
          rows={data.branches}
          searchPlaceholder="Code, name or location"
          matches={(r, q) => !q || lower(r.code).includes(q) || lower(r.name).includes(q) || lower(addressLine(r.location)).includes(q)}
          columns={[
            { id: "code", header: "Code", type: "code", sticky: true, width: 90, value: (r) => r.code },
            {
              id: "name",
              header: "Branch",
              sticky: true,
              width: 200,
              value: (r) => r.name,
              cell: (r) => (
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-ink">{r.name}</span>
                  {r.isHeadOffice && <span className="shrink-0 rounded border border-brand/25 bg-brand-subtle px-1 text-3xs font-semibold uppercase text-brand-strong">Head office</span>}
                </span>
              ),
            },
            { id: "location", header: "Location", width: 260, value: (r) => addressLine(r.location) ?? "" },
            { id: "phone", header: "Phone", type: "code", width: 140, value: (r) => (r.phone ? formatPhoneNumber(r.phone) : "") },
            { id: "email", header: "Email", width: 200, defaultHidden: true, value: (r) => r.email },
            { id: "remote", header: "Remote area", width: 150, defaultHidden: true, value: (r) => REMOTE_CATEGORIES.find((c) => c.value === r.remoteCategory)?.label ?? r.remoteCategory },
            { id: "headcount", header: "Employees", type: "number", width: 96, value: (r) => r.headcount, total: "sum" },
            { id: "status", header: "Status", type: "status", width: 90, value: (r) => r.status },
            actions<OrgBranch>(),
          ]}
        />
      );
    case "department":
      return (
        <Register<OrgDepartment>
          {...common}
          kind="department"
          rows={data.departments}
          searchPlaceholder="Code, name or head"
          filters={[{ id: "branch", label: "Branch", allLabel: "All branches", options: data.branches.map((b) => ({ value: b.id, label: b.name })) }]}
          matches={(r, q, f) =>
            (!f.branch || r.branchIds.length === 0 || r.branchIds.includes(f.branch)) &&
            (!q || lower(r.code).includes(q) || lower(r.name).includes(q) || lower(personName(r.headEmployeeId) ?? r.headName).includes(q))
          }
          columns={[
            { id: "code", header: "Code", type: "code", sticky: true, width: 96, value: (r) => r.code },
            { id: "name", header: "Department", sticky: true, width: 200, value: (r) => r.name, cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
            {
              id: "head",
              header: "Head",
              width: 180,
              value: (r) => personName(r.headEmployeeId) ?? r.headName ?? "",
              cell: (r) => {
                const picked = personName(r.headEmployeeId);
                if (picked) return picked;
                if (r.headName) return <span className="text-ink-muted" title="Typed name; pick an employee in Edit">{r.headName} (typed)</span>;
                return <span className="text-ink-faint">—</span>;
              },
            },
            {
              id: "branches",
              header: "Branches",
              width: 180,
              value: (r) => (r.branchIds.length ? names(r.branchIds, data.branches) : "All branches"),
              cell: (r) => (r.branchIds.length ? names(r.branchIds, data.branches) : <span className="text-ink-muted">All branches</span>),
            },
            { id: "designations", header: "Designations", type: "number", width: 104, value: (r) => r.usage.designations ?? 0 },
            { id: "headcount", header: "Employees", type: "number", width: 96, value: (r) => r.headcount, total: "sum" },
            { id: "description", header: "Description", width: 240, defaultHidden: true, value: (r) => r.description },
            { id: "status", header: "Status", type: "status", width: 90, value: (r) => r.status },
            actions<OrgDepartment>(),
          ]}
        />
      );
    case "designation":
      return (
        <Register<OrgDesignation>
          {...common}
          kind="designation"
          rows={data.designations}
          searchPlaceholder="Designation"
          filters={[{ id: "department", label: "Department", allLabel: "All departments", options: data.departments.map((d) => ({ value: d.id, label: d.name })) }]}
          matches={(r, q, f) => (!f.department || r.departmentId === f.department) && (!q || lower(r.name).includes(q))}
          columns={[
            { id: "name", header: "Designation", sticky: true, width: 220, value: (r) => r.name, cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
            { id: "department", header: "Department", width: 200, value: (r) => data.departments.find((d) => d.id === r.departmentId)?.name ?? "" },
            { id: "headcount", header: "Employees", type: "number", width: 96, value: (r) => r.headcount, total: "sum" },
            { id: "description", header: "Description", width: 280, value: (r) => r.description },
            { id: "status", header: "Status", type: "status", width: 90, value: (r) => r.status },
            actions<OrgDesignation>(),
          ]}
        />
      );
    case "level":
      return (
        <Register<OrgLevel>
          {...common}
          kind="level"
          rows={data.levels}
          searchPlaceholder="Code or name"
          matches={(r, q) => !q || lower(r.code).includes(q) || lower(r.name).includes(q) || r.labelNepali.includes(q)}
          columns={[
            { id: "code", header: "Code", type: "code", sticky: true, width: 90, value: (r) => r.code },
            { id: "number", header: "Level", type: "number", width: 70, value: (r) => r.levelNumber },
            { id: "name", header: "Name", sticky: true, width: 200, value: (r) => r.name, cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
            { id: "nepali", header: "Nepali label", width: 180, value: (r) => r.labelNepali },
            { id: "min", header: "Starting salary", type: "amount", width: 130, value: (r) => r.minSalary },
            { id: "max", header: "Maximum salary", type: "amount", width: 130, value: (r) => r.maxSalary || null },
            { id: "headcount", header: "Employees", type: "number", width: 96, value: (r) => r.headcount, total: "sum" },
            { id: "status", header: "Status", type: "status", width: 90, value: (r) => r.status },
            actions<OrgLevel>(),
          ]}
        />
      );
    case "type":
      return (
        <Register<OrgEmploymentType>
          {...common}
          kind="type"
          rows={data.types}
          searchPlaceholder="Code or name"
          matches={(r, q) => !q || lower(r.code).includes(q) || lower(r.name).includes(q) || r.nameNepali.includes(q)}
          columns={[
            { id: "code", header: "Code", type: "code", sticky: true, width: 110, value: (r) => r.code },
            { id: "name", header: "Employment type", sticky: true, width: 180, value: (r) => r.name, cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
            { id: "nepali", header: "Nepali name", width: 180, defaultHidden: true, value: (r) => r.nameNepali },
            {
              id: "eligible",
              header: "Eligible for",
              width: 200,
              value: (r) => eligibility(r),
              cell: (r) => eligibility(r) || <span className="text-ink-faint">None</span>,
            },
            { id: "notice", header: "Notice (days)", type: "number", width: 104, value: (r) => r.noticePeriodDays },
            { id: "probation", header: "Probation (months)", type: "number", width: 130, value: (r) => r.probationMonths },
            { id: "headcount", header: "Employees", type: "number", width: 96, value: (r) => r.headcount, total: "sum" },
            { id: "status", header: "Status", type: "status", width: 90, value: (r) => r.status },
            actions<OrgEmploymentType>(),
          ]}
        />
      );
  }
}

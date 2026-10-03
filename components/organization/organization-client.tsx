"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, FileBadge2, GitFork, Layers, Network, Pencil, Plus, Power, RefreshCw, Trash2, Users } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { deleteOrgRecordAction, setOrgStatusAction } from "@/app/actions/organization.actions";
import { ORG_KIND_LABEL, deleteBlockers } from "@/lib/engines/organization.engine";
import type { OrgKind, OrgStatus, OrgTab, OrganizationData, OrgUsage } from "@/lib/types/organization";
import { OrganizationRegisters } from "./organization-register";
import { OrganizationReporting } from "./organization-reporting";
import { OrganizationStructure } from "./organization-structure";
import { OrganizationWindow, type EditTarget } from "./organization-window";

const TAB_KIND: Partial<Record<OrgTab, OrgKind>> = {
  branches: "branch",
  departments: "department",
  designations: "designation",
  levels: "level",
  types: "type",
};

/** The selected record of a register tab, as the toolbar needs it. */
export interface OrgSelection {
  kind: OrgKind;
  id: string;
  name: string;
  status: OrgStatus;
  usage: OrgUsage;
  isHeadOffice?: boolean;
}

type Pending = { action: "status" | "delete"; target: OrgSelection } | null;

/**
 * Organization (4.3, template A): one page for the workforce masters. Folder
 * tabs: Structure (branch × department headcount, department tree),
 * Reporting (who reports to whom), then a register per master with a detail
 * pane; records are edited in a Window. Nothing in use is ever deleted: it
 * is made inactive instead.
 */
export function OrganizationClient({ data }: { data: OrganizationData }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<OrgTab>(data.tab);
  const [selection, setSelection] = useState<OrgSelection | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const { permissions } = data;
  const kind = TAB_KIND[tab];
  const canAdd = permissions.add && permissions.companyWide;
  const canEdit = permissions.edit && permissions.companyWide;
  const canDelete = permissions.delete && permissions.companyWide;
  const selected = selection && selection.kind === kind ? selection : null;

  const changeTab = (next: string) => {
    setTab(next as OrgTab);
    setSelection(null);
    setFailure(null);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${next}`);
  };

  const counts = {
    branches: data.branches.filter((b) => b.status === "active").length,
    departments: data.departments.filter((d) => d.status === "active").length,
    designations: data.designations.filter((d) => d.status === "active").length,
    levels: data.levels.filter((l) => l.status === "active").length,
    types: data.types.filter((t) => t.status === "active").length,
  };
  const description = [
    `${counts.branches} branch${counts.branches === 1 ? "" : "es"}`,
    `${counts.departments} department${counts.departments === 1 ? "" : "s"}`,
    `${counts.designations} designation${counts.designations === 1 ? "" : "s"}`,
    `${counts.levels} level${counts.levels === 1 ? "" : "s"}`,
    `${counts.types} employment type${counts.types === 1 ? "" : "s"}`,
  ].join(" · ");

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "structure", label: "Structure", icon: Network },
      { id: "reporting", label: "Reporting", icon: GitFork },
      { id: "branches", label: "Branches", icon: Building2, badge: data.branches.length },
      { id: "departments", label: "Departments", icon: Users, badge: data.departments.length },
      { id: "designations", label: "Designations", icon: Briefcase, badge: data.designations.length },
      { id: "levels", label: "Levels", icon: Layers, badge: data.levels.length },
      { id: "types", label: "Employment types", icon: FileBadge2, badge: data.types.length },
    ],
    [data]
  );

  const blockers = selected ? deleteBlockers(selected.usage) : [];
  const runPending = async () => {
    if (!pending) return;
    const { action, target } = pending;
    const result =
      action === "status"
        ? await setOrgStatusAction(target.kind, target.id, target.status === "active" ? "inactive" : "active")
        : await deleteOrgRecordAction(target.kind, target.id);
    setPending(null);
    if (!result.success) {
      setFailure(result.error);
      return;
    }
    setFailure(null);
    if (action === "delete") setSelection(null);
    router.refresh();
  };

  const label = kind ? ORG_KIND_LABEL[kind] : "";
  return (
    <div>
      <PageBar
        title="Organization"
        description={description}
        actions={[
          {
            id: "new",
            label: kind ? `New ${label}` : "New",
            icon: Plus,
            group: "create",
            primary: true,
            shortcut: "Ctrl+N",
            hidden: !canAdd || !kind,
            onClick: () => kind && setEditing({ kind, id: null }),
          },
          {
            id: "edit",
            label: "Edit",
            icon: Pencil,
            group: "selection",
            shortcut: "F2",
            hidden: !canEdit || !kind,
            disabled: !selected,
            disabledReason: `Select a ${label} first`,
            onClick: () => selected && setEditing({ kind: selected.kind, id: selected.id }),
          },
          {
            id: "status",
            label: selected?.status === "inactive" ? "Make active" : "Make inactive",
            icon: Power,
            group: "selection",
            hidden: !canEdit || !kind,
            disabled: !selected || (selected.kind === "branch" && selected.isHeadOffice && selected.status === "active"),
            disabledReason: selected?.isHeadOffice ? "The head office stays active" : `Select a ${label} first`,
            onClick: () => selected && setPending({ action: "status", target: selected }),
          },
          {
            id: "delete",
            label: "Delete",
            icon: Trash2,
            group: "selection",
            hidden: !canDelete || !kind,
            disabled: !selected || blockers.length > 0 || !!selected.isHeadOffice,
            disabledReason: !selected ? `Select a ${label} first` : blockers.length ? `In use by ${blockers.join(", ")}: make it inactive instead` : "The head office cannot be deleted",
            onClick: () => selected && setPending({ action: "delete", target: selected }),
          },
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

      {!permissions.companyWide && (permissions.add || permissions.edit) && (
        <p className="mb-3 rounded-md border border-info/25 bg-info-subtle px-3 py-2 text-xs text-info">
          Your role is limited to some branches or departments, so you can view the organization but not change it. Changes need a company-wide administrator.
        </p>
      )}
      {failure && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {failure}
        </p>
      )}

      <Tabs variant="folder" items={tabs} value={tab} onChange={changeTab} label="Organization views">
        {tab === "structure" && <OrganizationStructure data={data} />}
        {tab === "reporting" && <OrganizationReporting data={data} />}
        {kind && (
          <OrganizationRegisters
            kind={kind}
            data={data}
            selectedId={selected?.id ?? null}
            onSelect={setSelection}
            onEdit={canEdit ? (k, id) => setEditing({ kind: k, id }) : undefined}
            onToggleStatus={canEdit ? (target) => setPending({ action: "status", target }) : undefined}
            onNew={canAdd ? () => setEditing({ kind, id: null }) : undefined}
          />
        )}
      </Tabs>

      <OrganizationWindow
        target={editing}
        data={data}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setFailure(null);
          router.refresh();
        }}
      />

      <Confirm
        open={pending?.action === "status"}
        title={pending?.target.status === "active" ? `Make ${pending?.target.name} inactive?` : `Make ${pending?.target.name} active?`}
        message={
          pending?.target.status === "active"
            ? "It stays on existing employees, history and reports, but is no longer offered for new choices. You can make it active again at any time."
            : "It will be offered again when people pick a value."
        }
        confirmLabel={pending?.target.status === "active" ? "Make inactive" : "Make active"}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
      <Confirm
        open={pending?.action === "delete"}
        tone="danger"
        title={`Delete ${pending?.target.name}?`}
        message={`Nothing uses this ${pending ? ORG_KIND_LABEL[pending.target.kind] : ""}, so it can be deleted. This cannot be undone.`}
        confirmLabel="Delete"
        requireText={pending?.target.name}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

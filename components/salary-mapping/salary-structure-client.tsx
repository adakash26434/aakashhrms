"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileSignature, LayoutTemplate, Plus, RefreshCw, Table2 } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import type { SubmitResult } from "@/lib/services/salary-structure.service";
import type { SalaryStructureData, StructureRow, StructureTab } from "@/lib/types/salary-structure";
import { resolveStructureTab } from "@/lib/engines/salary-structure.engine";
import { SalaryStructureApprovals } from "./salary-structure-approvals";
import { salaryActor } from "./salary-structure-approval";
import { waitingFor } from "@/lib/engines/approval.engine";
import { needsStructure } from "@/lib/engines/salary-structure.engine";
import { SalaryStructureAddWindow } from "./salary-structure-add-window";
import { SalaryStructureReviseWindow } from "./salary-structure-revise-window";
import { SalaryStructureTemplates } from "./salary-structure-templates";
import { SalaryStructureSheet } from "./salary-structure-sheet";

/**
 * Salary structure (4.4): each employee's pay as dated revisions.
 * Tabs:
 * - Salary sheet: unified view and in-place inline edit table modeled after
 *   classic finance desktop ERPs ("Employee Salary Distribution Maintenance"),
 *   with Mass increment (F14) for one rule over many salaries.
 * - Approvals: multi-level and simple approval batch queue and history. Who
 *   approves is set in Setup → Approvals (4.12d).
 * - Templates: standard structure presets.
 */
export function SalaryStructureClient({ data, initialEmployeeId = null }: { data: SalaryStructureData; initialEmployeeId?: string | null }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<StructureTab>(() => resolveStructureTab(data.tab));
  const [selectedId, setSelectedId] = useState<string | null>(initialEmployeeId);
  const selected = data.rows.find((r) => r.employeeId === selectedId) ?? null;
  const [revising, setRevising] = useState<StructureRow | null>(null);
  const [saved, setSaved] = useState<SubmitResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState<string | null>(null);

  const { permissions } = data;
  const canChange = permissions.edit;

  const changeTab = (next: string) => {
    const resolved = resolveStructureTab(next);
    if (resolved !== "sheet") {
      setBulkTemplate(null);
    }
    setTab(resolved);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${resolved}`);
  };

  const withStructure = data.rows.filter((r) => r.current).length;
  const without = data.rows.length - withStructure;
  const toSetUp = data.rows.filter((r) => r.status === "setup").length;
  const toAdd = data.rows.filter(needsStructure).length;

  const savedBatch = saved ? data.batches.find((b) => b.id === saved.batchId) : null;
  const showSaved = !!saved && !(!saved.approved && savedBatch && savedBatch.status !== "pending");
  const pending = data.batches.filter((b) => b.status === "pending").length;

  const actor = salaryActor(data);
  const mine = data.batches.filter(
    (b) =>
      b.status === "pending" &&
      waitingFor(
        {
          status: b.status,
          preparedById: b.preparedById,
          subjectEmployeeIds: b.employeeIds,
          flow: b.flow,
          currentLevel: b.currentLevel,
        },
        actor,
        { approvers: data.approvers, today: data.today }
      )
  ).length;

  const description = [
    `${withStructure} with a salary structure`,
    without ? `${without} without` : null,
    toSetUp ? `${toSetUp} to set up (basic + grade only)` : null,
    pending ? `${pending} change${pending === 1 ? "" : "s"} waiting for approval${mine ? ` (${mine} for you)` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "sheet", label: "Salary sheet", icon: Table2, badge: data.rows.length },
      { id: "approvals", label: "Approvals", icon: ClipboardCheck, badge: mine || undefined },
      { id: "templates", label: "Templates", icon: LayoutTemplate, badge: data.templates.length || undefined },
    ],
    [data.rows.length, mine, data.templates.length]
  );

  return (
    <div>
      <PageBar
        title="Salary structure"
        description={description || "No active employees yet"}
        actions={[
          {
            id: "add",
            label: "Add new",
            icon: Plus,
            group: "create",
            primary: true,
            shortcut: "Ctrl+N",
            hidden: !canChange || (tab !== "sheet" && tab !== "structures"),
            disabled: !toAdd,
            disabledReason: "Every employee has a salary structure. Use the table to revise.",
            onClick: () => setAdding(true),
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

      <p className="mb-3 flex items-center gap-1.5 text-2xs text-ink-muted">
        <FileSignature aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand" />
        {policyBanner(data)} Nobody approves a change to their own salary.
      </p>

      {saved && showSaved && (
        <div role="status" className="mb-3 flex items-start justify-between gap-3 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-xs text-ink">
          <p>
            {saved.approved
              ? `Saved: ${saved.employeeCount} salar${saved.employeeCount === 1 ? "y" : "ies"} changed${saved.route === "final_approve" ? " and Final approved by you (listed in Approvals)" : ""}.`
              : `Sent for approval to ${saved.waitingFor ?? "an approver"}: ${saved.employeeCount} salar${saved.employeeCount === 1 ? "y" : "ies"}${saved.ownSalary ? ", including your own, so another approver has to accept it" : ""}.`}
            {saved.recalculate.length > 0 && ` Recalculate the draft payroll for ${saved.recalculate.join(", ")} to include it.`}
          </p>
          <button type="button" onClick={() => setSaved(null)} className="shrink-0 cursor-pointer text-2xs font-medium text-ink-muted hover:text-ink">
            Dismiss
          </button>
        </div>
      )}

      <Tabs variant="folder" items={tabs} value={tab === "structures" || tab === "bulk" ? "sheet" : tab} onChange={changeTab} label="Salary structure views">
        {(tab === "sheet" || tab === "structures" || tab === "bulk") && (
          <SalaryStructureSheet
            data={data}
            initialTemplateId={bulkTemplate}
            onSubmitted={(result) => {
              setBulkTemplate(null);
              setSaved(result);
              router.refresh();
            }}
            onAddNew={canChange ? () => setAdding(true) : undefined}
            onOpenApprovals={() => changeTab("approvals")}
            onOpenRevise={canChange ? (r) => setRevising(r) : undefined}
          />
        )}
        {tab === "approvals" && <SalaryStructureApprovals data={data} />}
        {tab === "templates" && (
          <SalaryStructureTemplates
            data={data}
            onApply={
              canChange
                ? (id) => {
                    changeTab("sheet");
                    setBulkTemplate(id);
                  }
                : undefined
            }
          />
        )}
      </Tabs>

      {adding && (
        <SalaryStructureAddWindow
          data={data}
          initialId={selected?.employeeId ?? null}
          onClose={() => setAdding(false)}
          onChoose={(row) => {
            setAdding(false);
            setSelectedId(row.employeeId);
            setRevising(row);
          }}
        />
      )}

      <SalaryStructureReviseWindow
        row={revising}
        data={data}
        onClose={() => setRevising(null)}
        onSaved={(result) => {
          setRevising(null);
          setSaved(result);
          router.refresh();
        }}
      />
    </div>
  );
}

/** One line on the approval setting in force. */
function policyBanner(data: SalaryStructureData): string {
  const p = data.approvalPolicy;
  const name = (id: string) => data.approvers.find((a) => a.userId === id)?.name ?? "approver";
  const rules = data.approvalRules.length ? ` ${data.approvalRules.length} custom rule${data.approvalRules.length === 1 ? " sends" : "s send"} some changes to their own approvers (Setup → Approvals).` : "";
  if (p.type === "none") return `Salary changes count once saved (approval is off).${rules}`;
  if (p.type === "multi_level") return `Salary changes are approved by ${p.levels.map((id, i) => `Level ${i + 1}: ${name(id)}`).join(" → ")}; company administrators can Final approve.${rules}`;
  return `Salary changes need approval by someone other than their preparer; company administrators can Final approve.${rules}`;
}

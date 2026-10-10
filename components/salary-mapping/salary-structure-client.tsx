"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileSignature, LayoutTemplate, ListPlus, Pencil, Plus, Printer, RefreshCw, Table2, TrendingUp, Users } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import type { SubmitResult } from "@/lib/services/salary-structure.service";
import type { SalaryStructureData, StructureRow, StructureTab } from "@/lib/types/salary-structure";
import { SalaryStructureBulk } from "./salary-structure-bulk";
import { SalaryStructureApprovals } from "./salary-structure-approvals";
import { salaryActor } from "./salary-structure-approval";
import { waitingFor } from "@/lib/engines/approval.engine";
import { needsStructure } from "@/lib/engines/salary-structure.engine";
import { SalaryStructureAddWindow } from "./salary-structure-add-window";
import { SalaryStructureRegister } from "./salary-structure-register";
import { SalaryStructureReviseWindow } from "./salary-structure-revise-window";
import { SalaryStructureTemplates } from "./salary-structure-templates";

/**
 * Salary structure (4.4): each employee's pay as dated revisions. Tabs:
 * Structures (register, breakdown and history), Bulk edit (the spreadsheet
 * table), Changes (batches waiting for approval and decided ones) and
 * Templates. Nothing is ever overwritten: every change is a new revision.
 *
 * Toolbar (4.4b): Add new / Bulk add for employees with no structure or only
 * basic + grade; Revise salary / Bulk edit for those who have one; Mass
 * increment (F14) for one rule over many.
 */
export function SalaryStructureClient({ data, initialEmployeeId = null }: { data: SalaryStructureData; initialEmployeeId?: string | null }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<StructureTab>(data.tab);
  // The selection is kept by id and read from the latest data, so after a save
  // the toolbar sees the person's new status (not the row as it was when clicked).
  const [selectedId, setSelectedId] = useState<string | null>(initialEmployeeId);
  const selected = data.rows.find((r) => r.employeeId === selectedId) ?? null;
  const setSelected = (row: StructureRow | null) => setSelectedId(row?.employeeId ?? null);
  const [revising, setRevising] = useState<StructureRow | null>(null);
  const [saved, setSaved] = useState<SubmitResult | null>(null);
  // Bulk add: the bulk table with only the employees who need a structure.
  const [bulkSetup, setBulkSetup] = useState(false);
  const [adding, setAdding] = useState(false);
  // Bulk edit opened from a template's "Apply to employees".
  const [bulkTemplate, setBulkTemplate] = useState<string | null>(null);
  // Bulk edit opened from "Mass increment" (F14): the increment window opens at once.
  const [bulkIncrement, setBulkIncrement] = useState(false);
  const { permissions } = data;
  const canChange = permissions.edit;

  const changeTab = (next: string) => {
    if (next !== "bulk") {
      setBulkSetup(false);
      setBulkTemplate(null);
      setBulkIncrement(false);
    }
    setTab(next as StructureTab);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${next}`);
  };

  const withStructure = data.rows.filter((r) => r.current).length;
  const without = data.rows.length - withStructure;
  const toSetUp = data.rows.filter((r) => r.status === "setup").length;
  const toAdd = data.rows.filter(needsStructure).length;
  const openBulkAdd = () => {
    changeTab("bulk");
    setBulkTemplate(null);
    setBulkSetup(true);
  };
  // "Sent for approval" no longer applies once that change has been decided.
  const savedBatch = saved ? data.batches.find((b) => b.id === saved.batchId) : null;
  const showSaved = !!saved && !(!saved.approved && savedBatch && savedBatch.status !== "pending");
  const pending = data.batches.filter((b) => b.status === "pending").length;
  // Changes this person can act on now (the Approvals tab badge and its default view).
  const actor = salaryActor(data);
  const mine = data.batches.filter(
    (b) => b.status === "pending" && waitingFor({ status: b.status, preparedById: b.preparedById, subjectEmployeeIds: b.employeeIds, flow: b.flow, currentLevel: b.currentLevel }, actor, { approvers: data.approvers, today: data.today })
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
      { id: "structures", label: "Structures", icon: Users, badge: data.rows.length },
      { id: "bulk", label: "Bulk edit", icon: Table2, disabled: !canChange },
      { id: "approvals", label: "Approvals", icon: ClipboardCheck, badge: mine || undefined },
      { id: "templates", label: "Templates", icon: LayoutTemplate, badge: data.templates.length || undefined },
    ],
    [data, mine, canChange]
  );

  const letterId = selected?.current?.id;
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
            hidden: !canChange || tab !== "structures",
            disabled: !toAdd,
            disabledReason: "Every employee has a salary structure. Use Revise salary to change one.",
            onClick: () => setAdding(true),
          },
          {
            id: "bulkAdd",
            label: "Bulk add",
            icon: ListPlus,
            group: "create",
            hidden: !canChange || tab !== "structures",
            disabled: !toAdd,
            disabledReason: "Every employee has a salary structure. Use Bulk edit to change several.",
            onClick: openBulkAdd,
          },
          {
            id: "revise",
            label: "Revise salary",
            icon: Pencil,
            group: "create",
            shortcut: "F2",
            hidden: !canChange || tab !== "structures",
            disabled: !selected || selected.status === "pending" || needsStructure(selected),
            disabledReason: !selected
              ? "Select an employee first"
              : selected.status === "pending"
                ? "A change is waiting for approval"
                : "No salary structure yet: use Add new",
            onClick: () => selected && !needsStructure(selected) && setRevising(selected),
          },
          {
            id: "bulk",
            label: "Bulk edit",
            icon: Table2,
            group: "create",
            hidden: !canChange || tab !== "structures",
            onClick: () => changeTab("bulk"),
          },
          {
            // F14: one rule (basic by % or amount, grades added) for many salaries, through approval.
            id: "increment",
            label: "Mass increment",
            icon: TrendingUp,
            group: "create",
            hidden: !canChange || tab !== "structures",
            disabled: !withStructure,
            disabledReason: "Nobody has a salary structure yet",
            onClick: () => {
              changeTab("bulk");
              setBulkSetup(false);
              setBulkTemplate(null);
              setBulkIncrement(true);
            },
          },
          {
            id: "letter",
            label: "Print salary revision",
            icon: Printer,
            group: "output",
            hidden: tab !== "structures",
            disabled: !letterId,
            disabledReason: "Select an employee with a salary structure",
            onClick: () => letterId && window.open(`/workforce/salary-mapping/letter/${letterId}`, "_blank", "noopener"),
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

      <Tabs variant="folder" items={tabs} value={tab} onChange={changeTab} label="Salary structure views">
        {tab === "structures" && (
          <SalaryStructureRegister
            data={data}
            selectedId={selectedId}
            onSelect={setSelected}
            onRevise={canChange ? setRevising : undefined}
            onAdd={canChange ? () => setAdding(true) : undefined}
            onBulkAdd={canChange ? openBulkAdd : undefined}
          />
        )}
        {tab === "bulk" && canChange && (
          <SalaryStructureBulk
            key={bulkSetup ? "setup" : bulkTemplate ? `template-${bulkTemplate}` : bulkIncrement ? "increment" : "edit"}
            data={data}
            setup={bulkSetup}
            templatePreset={bulkTemplate}
            incrementPreset={bulkIncrement}
            onLeaveSetup={() => setBulkSetup(false)}
            onSubmitted={(result) => {
              setBulkSetup(false);
              setBulkTemplate(null);
              setBulkIncrement(false);
              setSaved(result);
              // The action already sends the fresh page (revalidatePath). Changing the
              // address while the router applies it made Next reload the whole page
              // (losing this message), so the tab changes now and the address after.
              const next = result.approved ? "structures" : "approvals";
              setTab(next);
              window.setTimeout(() => window.history.replaceState(null, "", `${window.location.pathname}?tab=${next}`), 0);
            }}
          />
        )}
        {tab === "approvals" && <SalaryStructureApprovals data={data} />}
        {tab === "templates" && (
          <SalaryStructureTemplates
            data={data}
            onApply={
              canChange
                ? (id) => {
                    changeTab("bulk");
                    setBulkSetup(false);
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
            setSelected(row);
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

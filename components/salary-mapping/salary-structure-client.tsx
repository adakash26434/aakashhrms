"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileSignature, LayoutTemplate, Pencil, Printer, RefreshCw, Table2, Users } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import type { SubmitResult } from "@/lib/services/salary-structure.service";
import type { SalaryStructureData, StructureRow, StructureTab } from "@/lib/types/salary-structure";
import { SalaryStructureBulk } from "./salary-structure-bulk";
import { SalaryStructureApprovals } from "./salary-structure-approvals";
import { ApprovalSettingsWindow, salaryActor } from "./salary-structure-approval";
import { waitingFor } from "@/lib/engines/approval.engine";
import { SalaryStructureRegister } from "./salary-structure-register";
import { SalaryStructureReviseWindow } from "./salary-structure-revise-window";
import { SalaryStructureTemplates } from "./salary-structure-templates";

/**
 * Salary structure (4.4): each employee's pay as dated revisions. Tabs:
 * Structures (register, breakdown and history), Bulk edit (the spreadsheet
 * table), Changes (batches waiting for approval and decided ones) and
 * Templates. Nothing is ever overwritten: every change is a new revision.
 */
export function SalaryStructureClient({ data, initialEmployeeId = null }: { data: SalaryStructureData; initialEmployeeId?: string | null }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<StructureTab>(data.tab);
  const [selected, setSelected] = useState<StructureRow | null>(() => data.rows.find((r) => r.employeeId === initialEmployeeId) ?? null);
  const [revising, setRevising] = useState<StructureRow | null>(null);
  const [saved, setSaved] = useState<SubmitResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNote, setSettingsNote] = useState<string | null>(null);
  const { permissions } = data;
  const canChange = permissions.edit;

  const changeTab = (next: string) => {
    setTab(next as StructureTab);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${next}`);
  };

  const withStructure = data.rows.filter((r) => r.current).length;
  const without = data.rows.length - withStructure;
  const pending = data.batches.filter((b) => b.status === "pending").length;
  // Changes this person can act on now (the Approvals tab badge and its default view).
  const actor = salaryActor(data);
  const mine = data.batches.filter(
    (b) => b.status === "pending" && waitingFor({ status: b.status, preparedById: b.preparedById, subjectEmployeeIds: b.employeeIds, flow: b.flow, currentLevel: b.currentLevel }, actor, { approvers: data.approvers, today: data.today })
  ).length;
  const description = [
    `${withStructure} with a salary structure`,
    without ? `${without} without` : null,
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
            id: "revise",
            label: selected && !selected.current ? "New structure" : "Revise salary",
            icon: Pencil,
            group: "create",
            primary: true,
            shortcut: "F2",
            hidden: !canChange || tab !== "structures",
            disabled: !selected || selected.status === "pending",
            disabledReason: selected?.status === "pending" ? "A change is waiting for approval" : "Select an employee first",
            onClick: () => selected && setRevising(selected),
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
            id: "letter",
            label: "Print letter",
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
      {settingsNote && (
        <p role="status" className="mb-3 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-xs text-ink">
          {settingsNote}
        </p>
      )}

      {saved && (
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
          <SalaryStructureRegister data={data} selectedId={selected?.employeeId ?? null} onSelect={setSelected} onRevise={canChange ? setRevising : undefined} />
        )}
        {tab === "bulk" && canChange && (
          <SalaryStructureBulk
            data={data}
            onSubmitted={(result) => {
              setSaved(result);
              changeTab(result.approved ? "structures" : "approvals");
              router.refresh();
            }}
          />
        )}
        {tab === "approvals" && <SalaryStructureApprovals data={data} onSettings={() => setSettingsOpen(true)} />}
        {tab === "templates" && <SalaryStructureTemplates data={data} />}
      </Tabs>

      {settingsOpen && (
        <ApprovalSettingsWindow
          data={data}
          onClose={() => setSettingsOpen(false)}
          onSaved={(kept) => {
            setSettingsOpen(false);
            setSettingsNote(`Approval settings saved.${kept ? ` ${kept} change${kept === 1 ? "" : "s"} already waiting keep their approvers.` : ""}`);
            router.refresh();
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
  if (p.type === "none") return "Salary changes count once saved (approval is off).";
  if (p.type === "multi_level") return `Salary changes are approved by ${p.levels.map((id, i) => `Level ${i + 1}: ${name(id)}`).join(" → ")}; company administrators can Final approve.`;
  return "Salary changes need approval by someone other than their preparer; company administrators can Final approve.";
}

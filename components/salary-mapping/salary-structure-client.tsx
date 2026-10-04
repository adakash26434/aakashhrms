"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileSignature, LayoutTemplate, Pencil, Printer, RefreshCw, Table2, Users } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import type { SalaryStructureData, StructureRow, StructureTab } from "@/lib/types/salary-structure";
import { SalaryStructureBulk } from "./salary-structure-bulk";
import { SalaryStructureChanges } from "./salary-structure-changes";
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
  const { permissions } = data;
  const canChange = permissions.edit;

  const changeTab = (next: string) => {
    setTab(next as StructureTab);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${next}`);
  };

  const withStructure = data.rows.filter((r) => r.current).length;
  const without = data.rows.length - withStructure;
  const pending = data.batches.filter((b) => b.status === "pending").length;
  const description = [
    `${withStructure} with a salary structure`,
    without ? `${without} without` : null,
    pending ? `${pending} change${pending === 1 ? "" : "s"} waiting for approval` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "structures", label: "Structures", icon: Users, badge: data.rows.length },
      { id: "bulk", label: "Bulk edit", icon: Table2, disabled: !canChange },
      { id: "changes", label: "Changes", icon: ClipboardCheck, badge: pending || undefined },
      { id: "templates", label: "Templates", icon: LayoutTemplate, badge: data.templates.length || undefined },
    ],
    [data, pending, canChange]
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

      {data.approvalRequired && (
        <p className="mb-3 flex items-center gap-1.5 text-2xs text-ink-muted">
          <FileSignature aria-hidden className="h-3.5 w-3.5 text-brand" />
          Salary changes need a second person&apos;s approval before they count (see Changes).
        </p>
      )}

      <Tabs variant="folder" items={tabs} value={tab} onChange={changeTab} label="Salary structure views">
        {tab === "structures" && (
          <SalaryStructureRegister data={data} selectedId={selected?.employeeId ?? null} onSelect={setSelected} onRevise={canChange ? setRevising : undefined} />
        )}
        {tab === "bulk" && canChange && <SalaryStructureBulk data={data} onSubmitted={() => { changeTab(data.approvalRequired ? "changes" : "structures"); router.refresh(); }} />}
        {tab === "changes" && <SalaryStructureChanges data={data} />}
        {tab === "templates" && <SalaryStructureTemplates data={data} />}
      </Tabs>

      <SalaryStructureReviseWindow
        row={revising}
        data={data}
        onClose={() => setRevising(null)}
        onSaved={() => {
          setRevising(null);
          router.refresh();
        }}
      />
    </div>
  );
}

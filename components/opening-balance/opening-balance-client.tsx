"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, RefreshCw, Trash2 } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { Notice } from "@/components/kit/notice";
import { WindowButton } from "@/components/kit/window";
import { removeOpeningBalanceAction } from "@/app/actions/opening-balance.actions";
import type { OpeningBalancesPage, OpeningBalanceView } from "@/lib/types/opening-balance";
import { OpeningImportWindow } from "./opening-balance-import";

// Opening balances (4.8 / F15): what the old system paid each employee in the fiscal year's first
// months, for a company that starts payroll here mid-year. Entered from a file (the import checks
// every row); removing one needs Payroll run → Delete and never one's own record.

export function OpeningBalancesClient({ data }: { data: OpeningBalancesPage }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [importing, setImporting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<OpeningBalanceView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = data.rows.find((r) => r.id === activeId) ?? null;
  const fy = data.fiscalYear;

  const columns = useMemo<GridColumn<OpeningBalanceView>[]>(
    () => [
      { id: "code", header: "Code", type: "code", value: (r) => r.employeeCode, sticky: true, width: 100 },
      { id: "name", header: "Employee", value: (r) => r.employeeName, width: 190 },
      { id: "branch", header: "Branch", value: (r) => r.branchName, width: 140, defaultHidden: true },
      { id: "months", header: "Months", value: (r) => r.covered, width: 140 },
      { id: "gross", header: "Gross earnings", type: "amount", value: (r) => Number(r.grossEarnings), total: "sum", width: 150 },
      { id: "retirement", header: "PF / SSF", type: "amount", value: (r) => Number(r.retirement), total: "sum" },
      { id: "cit", header: "CIT", type: "amount", value: (r) => Number(r.cit), total: "sum", defaultHidden: true },
      { id: "taxable", header: "Taxable income", type: "amount", value: (r) => Number(r.taxableIncome), total: "sum", width: 150 },
      { id: "sst", header: "SST (1%)", type: "amount", value: (r) => Number(r.sst), total: "sum" },
      { id: "incomeTax", header: "Income tax", type: "amount", value: (r) => Number(r.incomeTax), total: "sum" },
      { id: "tds", header: "Tax deducted", type: "amount", value: (r) => Number(r.tds), total: "sum", width: 140 },
      { id: "note", header: "Note", value: (r) => r.note ?? "", defaultHidden: true },
      { id: "updated", header: "Entered", type: "date", value: (r) => r.updatedAt },
      { id: "by", header: "By", value: (r) => r.updatedByName ?? "", width: 140, defaultHidden: true },
    ],
    []
  );

  const remove = async () => {
    if (!removing) return;
    const r = await removeOpeningBalanceAction(removing.id);
    if (!r.success) throw new Error(r.error);
    setNotice(`${removing.employeeName}'s opening balance was removed.`);
    setRemoving(null);
    setActiveId(null);
    router.refresh();
  };

  return (
    <div>
      <PageBar
        title="Opening balances"
        description={fy ? `${fy.label} · what the old system paid before payroll started here` : "No active fiscal year"}
        actions={[
          { id: "import", label: "Import", icon: FileUp, group: "create", primary: true, hidden: !data.permissions.import || !fy, onClick: () => setImporting(true) },
          {
            id: "remove",
            label: "Remove",
            icon: Trash2,
            group: "selection",
            hidden: !data.permissions.remove,
            disabled: !active || active.own,
            disabledReason: active?.own ? "Your own pay record is changed by someone else" : "Choose a row first",
            onClick: () => active && setRemoving(active),
          },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />

      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {!fy ? (
        <Notice tone="warning">There is no active fiscal year. Set one up under Setup → Fiscal year first.</Notice>
      ) : (
        <>
          <Notice tone="info" className="mb-3">
            Needed only when payroll starts here after Shrawan. For each employee, enter what the old system paid this year from Shrawan. Payroll counts those months for tax (the monthly projection and
            the Ashadh reconciliation) and on the tax certificate, and won&apos;t pay them again.
          </Notice>
          <DataGrid
            id="opening-balances"
            label={`Opening balances, ${fy.label}`}
            columns={columns}
            rows={data.rows}
            getRowId={(r) => r.id}
            activeRowId={activeId}
            onActiveRowChange={(r) => setActiveId(r.id)}
            empty={{
              title: "No opening balances",
              description: "Payroll started here at the beginning of the year, or none have been entered yet.",
              action: data.permissions.import ? (
                <WindowButton onClick={() => setImporting(true)}>
                  <FileUp className="h-3.5 w-3.5" /> Import
                </WindowButton>
              ) : undefined,
            }}
          />
        </>
      )}

      {importing && fy && (
        <OpeningImportWindow
          fiscalYear={fy.label}
          onClose={() => setImporting(false)}
          onImported={(text) => {
            setNotice(text);
            router.refresh();
          }}
        />
      )}
      <Confirm
        open={!!removing}
        title={removing ? `Remove ${removing.employeeName}'s opening balance?` : ""}
        message="Tax for the months still to come is then worked out without it, and it leaves the tax certificate. Payslips already final keep what they deducted."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

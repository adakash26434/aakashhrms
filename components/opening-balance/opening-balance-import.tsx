"use client";

import { ImportWindow } from "@/components/kit/import-window";
import { commitOpeningImportAction, previewOpeningImportAction } from "@/app/actions/import.actions";
import { OPENING_IMPORT_COLUMNS } from "@/lib/engines/opening-balance.engine";

/** Import opening balances (4.8 / F15): one row per employee; a new file replaces an employee's earlier one. */
export function OpeningImportWindow({ fiscalYear, onClose, onImported }: { fiscalYear: string; onClose: () => void; onImported: (text: string) => void }) {
  return (
    <ImportWindow
      title={`Import opening balances · ${fiscalYear}`}
      description="For each employee, what the old system paid this fiscal year before payroll started here: the months from Shrawan, gross earnings, contributions and tax deducted. Months already paid here can't be carried."
      columns={OPENING_IMPORT_COLUMNS}
      templateFile="opening-balances-template.csv"
      rowHint="Add one row per employee"
      commitLabel={(n) => (n ? `Save ${n} opening balance${n === 1 ? "" : "s"}` : "Save")}
      onClose={onClose}
      onPreview={async (csv) => {
        const r = await previewOpeningImportAction(csv);
        return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error };
      }}
      onCommit={async (csv) => {
        const r = await commitOpeningImportAction(csv);
        if (!r.success) return { ok: false, error: r.error };
        const text = `${r.data.saved} opening balance${r.data.saved === 1 ? "" : "s"} saved. Payroll counts them from the next month it runs.`;
        onImported(text);
        return { ok: true, value: text };
      }}
    />
  );
}

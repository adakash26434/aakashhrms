"use client";

import { ImportWindow } from "@/components/kit/import-window";
import { commitPunchImportAction, previewPunchImportAction } from "@/app/actions/import.actions";
import { PUNCH_IMPORT_COLUMNS } from "@/lib/engines/punch-import.engine";

/** Import punches (4.8 / F15): an old system's or a device's file; the day rules decide each day from them. */
export function PunchImportWindow({ onClose, onImported }: { onClose: () => void; onImported: (text: string) => void }) {
  return (
    <ImportWindow
      title="Import punches"
      description="Check-in and check-out times from an old system or an attendance device's file. Each day is then worked out by the attendance rules, as for device and web punches; days in closed months are refused."
      columns={PUNCH_IMPORT_COLUMNS}
      templateFile="attendance-punches-template.csv"
      rowHint="Add one row per employee and day (or one per punch)"
      commitLabel={(n) => (n ? `Import ${n.toLocaleString("en-IN")} row${n === 1 ? "" : "s"}` : "Import")}
      onClose={onClose}
      onPreview={async (csv) => {
        const r = await previewPunchImportAction(csv);
        return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error };
      }}
      onCommit={async (csv) => {
        const r = await commitPunchImportAction(csv);
        if (!r.success) return { ok: false, error: r.error };
        const { added, alreadyThere, employees } = r.data;
        const text = `${added.toLocaleString("en-IN")} punch${added === 1 ? "" : "es"} added for ${employees} employee${employees === 1 ? "" : "s"}${
          alreadyThere ? ` (${alreadyThere.toLocaleString("en-IN")} were already imported)` : ""
        }.`;
        onImported(text);
        return { ok: true, value: text };
      }}
    />
  );
}

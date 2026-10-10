"use client";

import Link from "next/link";
import { ImportWindow } from "@/components/kit/import-window";
import { commitEmployeeImportAction, previewEmployeeImportAction } from "@/app/actions/import.actions";
import { EMPLOYEE_IMPORT_COLUMNS } from "@/lib/engines/employee-import.engine";

/** Import employees (4.8 / F15): the template, the server's check, then one save per row. */
export function EmployeeImportWindow({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  return (
    <ImportWindow
      title="Import employees"
      description="Add many employees from a filled-in template. Every row is checked with the employee form's rules; self-service logins and identity scans are added from each record afterwards."
      columns={EMPLOYEE_IMPORT_COLUMNS}
      templateFile="employees-import-template.csv"
      commitLabel={(n) => (n ? `Import ${n} employee${n === 1 ? "" : "s"}` : "Import")}
      onClose={onClose}
      onPreview={async (csv) => {
        const r = await previewEmployeeImportAction(csv);
        return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error };
      }}
      onCommit={async (csv) => {
        const r = await commitEmployeeImportAction(csv);
        if (!r.success) return { ok: false, error: r.error };
        onImported();
        const { created, failed } = r.data;
        return {
          ok: true,
          value: (
            <div className="space-y-1">
              <p>
                {created.length} employee{created.length === 1 ? "" : "s"} added
                {created.length > 0 && (
                  <>
                    {" "}
                    ({created
                      .slice(0, 5)
                      .map((c) => c.employeeCode)
                      .join(", ")}
                    {created.length > 5 ? ", …" : ""}). Each is listed under records to fix until its citizenship scan is added.
                  </>
                )}
              </p>
              {failed.length > 0 && (
                <ul className="list-disc pl-4 text-danger">
                  {failed.map((f) => (
                    <li key={f.line}>
                      Line {f.line}: {f.message}
                    </li>
                  ))}
                </ul>
              )}
              {created[0] && (
                <Link href={`/workforce/employees/${created[0].employeeId}`} className="font-medium underline underline-offset-2">
                  Open {created[0].fullName}
                </Link>
              )}
            </div>
          ),
        };
      }}
    />
  );
}

"use client";

import { useRef, useState, type ReactNode } from "react";
import { Download, FileUp, Loader2, RefreshCw } from "lucide-react";
import { Notice } from "./notice";
import { Window, WindowButton } from "./window";
import { downloadTextFile } from "@/lib/export/download";
import { MAX_IMPORT_BYTES, templateHeader, type ImportColumn, type ImportReport } from "@/lib/engines/import.engine";
import { cn } from "@/lib/utils";

// Import window (4.8 / F15): download the template, fill it in Excel (save as CSV), choose it, read
// the server's line-by-line report, and import only when every row checks clean. The server does
// the checking and the saving; this window only carries the file's text.

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

export function ImportWindow({
  title,
  description,
  columns,
  templateFile,
  onPreview,
  onCommit,
  commitLabel,
  onClose,
}: {
  title: string;
  description: string;
  columns: readonly ImportColumn[];
  /** File name of the downloaded template, e.g. "employees-import.csv". */
  templateFile: string;
  onPreview: (csv: string) => Promise<Outcome<ImportReport>>;
  /** Saves; returns what to show afterwards. */
  onCommit: (csv: string) => Promise<Outcome<ReactNode>>;
  commitLabel: (rows: number) => string;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<null | "check" | "import">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReactNode | null>(null);

  const check = async (f: { name: string; text: string }) => {
    setBusy("check");
    setError(null);
    setReport(null);
    const result = await onPreview(f.text);
    setBusy(null);
    if (result.ok) setReport(result.value);
    else setError(result.error);
  };

  const choose = async (picked: File) => {
    if (picked.size > MAX_IMPORT_BYTES) {
      setError("That file is too large (2 MB at most).");
      return;
    }
    const f = { name: picked.name, text: await picked.text() };
    setFile(f);
    setDone(null);
    await check(f);
  };

  const commit = async () => {
    if (!file || !report?.ready) return;
    setBusy("import");
    setError(null);
    const result = await onCommit(file.text);
    setBusy(null);
    if (result.ok) {
      setDone(result.value);
      setReport(null);
      setFile(null);
    } else setError(result.error);
  };

  const issueRows = report?.rows.filter((r) => r.issues.length) ?? [];
  // Rows that can be imported: notes (warnings) don't hold a row back.
  const readyRows = (report?.rows.length ?? 0) - (report?.errorRows ?? 0);

  return (
    <Window
      open
      onClose={busy ? () => {} : onClose}
      size="xl"
      title={title}
      description={description}
      footer={
        <>
          <WindowButton onClick={onClose} disabled={!!busy}>
            {done ? "Close" : "Cancel"}
          </WindowButton>
          {!done && (
            <WindowButton variant="primary" onClick={commit} disabled={!report?.ready || !!busy}>
              {busy === "import" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {commitLabel(report?.rows.length ?? 0)}
            </WindowButton>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {error && <Notice tone="danger">{error}</Notice>}
        {done && <Notice tone="success">{done}</Notice>}

        <ol className="grid gap-2 md:grid-cols-2">
          <li className="rounded-md border border-line bg-surface-panel p-3">
            <p className="text-xs font-semibold text-ink">1. Fill in the template</p>
            <p className="mt-0.5 text-2xs text-ink-muted">
              Open it in Excel and set the columns to Text first, so BS dates (YYYY-MM-DD) and long numbers stay as typed. Add one row per person and save it as “CSV UTF-8”.
            </p>
            <WindowButton className="mt-2" onClick={() => downloadTextFile(templateFile, templateHeader(columns))}>
              <Download className="h-3.5 w-3.5" /> Download template
            </WindowButton>
          </li>
          <li className="rounded-md border border-line bg-surface-panel p-3">
            <p className="text-xs font-semibold text-ink">2. Choose the filled-in file</p>
            <p className="mt-0.5 text-2xs text-ink-muted">Every row is checked first; nothing is saved while a row has an error.</p>
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <WindowButton onClick={() => fileRef.current?.click()} disabled={!!busy}>
                <FileUp className="h-3.5 w-3.5" /> {file ? "Choose another file" : "Choose file"}
              </WindowButton>
              {file && (
                <WindowButton onClick={() => check(file)} disabled={!!busy} title="Check the same file again (after fixing the organization or codes)">
                  <RefreshCw className="h-3.5 w-3.5" /> Check again
                </WindowButton>
              )}
              {busy === "check" && <Loader2 aria-label="Checking" className="h-3.5 w-3.5 animate-spin text-ink-muted" />}
              {file && <span className="truncate text-2xs text-ink-muted">{file.name}</span>}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void choose(f);
                e.target.value = "";
              }}
            />
          </li>
        </ol>

        {report && (
          <section aria-label="Check result" className="space-y-2">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>
                <strong className="tabular-nums">{report.rows.length}</strong> row{report.rows.length === 1 ? "" : "s"}
              </span>
              <span className={report.errorRows ? "font-medium text-danger" : "text-ink-muted"}>
                <strong className="tabular-nums">{report.errorRows}</strong> with errors
              </span>
              <span className={report.warningRows ? "text-warning" : "text-ink-muted"}>
                <strong className="tabular-nums">{report.warningRows}</strong> with notes
              </span>
              <span className={readyRows ? "text-success" : "text-ink-muted"}>
                <strong className="tabular-nums">{readyRows}</strong> ready
              </span>
            </p>
            {report.fileIssues.length > 0 && (
              <Notice tone="danger" title="The file can't be read as the template">
                <ul className="list-disc pl-4">
                  {report.fileIssues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </Notice>
            )}
            {report.ignored.length > 0 && <Notice tone="info">Columns not in the template are ignored: {report.ignored.join(", ")}.</Notice>}
            {report.ready ? (
              <Notice tone="success">Every row checks clean{report.warningRows ? " (read the notes below)" : ""}. Import when ready.</Notice>
            ) : report.errorRows > 0 ? (
              <Notice tone="warning">Fix the rows below in the file, save it, and choose it again.</Notice>
            ) : null}
            {issueRows.length > 0 && (
              <div className="max-h-80 overflow-auto rounded-md border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-sunken">
                    <tr className="text-left text-2xs uppercase tracking-wide text-ink-faint">
                      <th className="px-2 py-1.5 font-medium">Line</th>
                      <th className="px-2 py-1.5 font-medium">Row</th>
                      <th className="px-2 py-1.5 font-medium">Column</th>
                      <th className="px-2 py-1.5 font-medium">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueRows.flatMap((r) =>
                      [...r.issues]
                        .sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1))
                        .map((i, n) => (
                          <tr key={`${r.line}-${n}`} className="border-t border-line/70 align-top">
                            <td className="px-2 py-1 tabular-nums text-ink-muted">{n === 0 ? r.line : ""}</td>
                            <td className="px-2 py-1 text-ink">{n === 0 ? r.label : ""}</td>
                            <td className="px-2 py-1 text-ink-muted">{i.column || "—"}</td>
                            <td className={cn("px-2 py-1", i.level === "error" ? "text-danger" : "text-warning")}>{i.message}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <details className="rounded-md border border-line bg-surface px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-ink">What goes in each column</summary>
          <table className="mt-2 w-full">
            <tbody>
              {columns.map((c) => (
                <tr key={c.key} className="border-t border-line/60 align-top">
                  <td className="py-1 pr-3 font-medium text-ink">
                    {c.header}
                    {c.required && <span className="text-danger"> *</span>}
                  </td>
                  <td className="py-1 text-ink-muted">{c.help || (c.required ? "Required." : "Optional.")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </Window>
  );
}

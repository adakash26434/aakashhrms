"use client";

import { useRef, useState } from "react";
import { Eye, Loader2, Paperclip, X } from "lucide-react";
import { fileProblem, fileSizeText } from "@/lib/engines/employee-document.engine";
import type { DocumentFileRef } from "@/lib/types/employee-document";
import { DocumentViewer, scanUrl } from "./employee-document-viewer";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/**
 * One attached scan (4.2c): choose / view / replace / remove, uploaded through
 * the staged-scan route the identity documents use (same limits, same
 * ownership rules). The ref goes into the row; the employee save claims it.
 */
export function ScanField({ value, onChange, employeeId, staged, title, hint, disabled }: { value: DocumentFileRef | null; onChange: (file: DocumentFileRef | null) => void; employeeId: string | null; staged: Set<string>; title: string; hint?: string; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const discard = (id: string) => {
    if (!staged.has(id)) return;
    staged.delete(id);
    void fetch(scanUrl(id), { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
  };

  const upload = async (file: File) => {
    const problem = fileProblem(file.size);
    if (problem) return setError(problem);
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const query = employeeId ? `?employee=${encodeURIComponent(employeeId)}` : "";
      const res = await fetch(`/api/employees/documents/files${query}`, { method: "POST", body, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { success: boolean; data?: DocumentFileRef; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) return setError(json?.error ?? "The file could not be uploaded. Try again.");
      staged.add(json.data.id);
      if (value) discard(value.id);
      onChange(json.data);
    } catch {
      setError("The file could not be uploaded. Check the connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {value ? (
        <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface px-2 py-1 text-xs">
          <Paperclip aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          <span className="min-w-0 max-w-64 truncate font-medium text-ink" title={value.name}>{value.name}</span>
          <span className="shrink-0 text-2xs text-ink-faint">{fileSizeText(value.size)}</span>
          <button type="button" data-enter-skip onClick={() => setViewing(true)} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded px-1.5 text-2xs font-medium text-brand hover:bg-brand-subtle"><Eye aria-hidden className="h-3.5 w-3.5" /> View</button>
          {!disabled && (
            <>
              <button type="button" data-enter-skip onClick={() => input.current?.click()} disabled={uploading} className="inline-flex h-7 cursor-pointer items-center rounded px-1.5 text-2xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink">Replace</button>
              <button type="button" data-enter-skip onClick={() => { discard(value.id); onChange(null); }} aria-label="Remove the file" className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-ink-muted hover:bg-danger-subtle hover:text-danger"><X aria-hidden className="h-3.5 w-3.5" /></button>
            </>
          )}
        </span>
      ) : (
        <button type="button" data-enter-skip onClick={() => input.current?.click()} disabled={uploading || disabled} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:border-brand hover:text-brand disabled:cursor-wait disabled:opacity-60">
          {uploading ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Paperclip aria-hidden className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Choose file"}
        </button>
      )}
      {hint && <p className="text-2xs text-ink-muted">{hint}</p>}
      {error && <p role="alert" className="text-2xs font-medium text-danger">{error}</p>}
      <input ref={input} type="file" accept={ACCEPT} tabIndex={-1} aria-hidden className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
      {viewing && <DocumentViewer open title={title} file={value} onClose={() => setViewing(false)} />}
    </div>
  );
}

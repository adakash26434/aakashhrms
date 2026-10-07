"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, TriangleAlert } from "lucide-react";
import { Window, WindowButton } from "@/components/kit/window";
import { fileSizeText } from "@/lib/engines/employee-document.engine";
import type { DocumentFileRef } from "@/lib/types/employee-document";

/** Where a scan is fetched from (the route checks permission and scope, S25). */
export const scanUrl = (id: string) => `/api/employees/documents/files/${encodeURIComponent(id)}`;

type Loaded = { id: string; url: string; mime: string } | { id: string; error: string };

/**
 * One scan, fetched with the user's session and shown from a blob: (the page
 * CSP allows blob: images and frames; the file itself is always sent as a
 * download, never opened as a page on this site).
 */
function ScanPreview({ file }: { file: DocumentFileRef }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let url = "";
    let cancelled = false;
    fetch(scanUrl(file.id), { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "This scan isn't available." : "The scan could not be opened.");
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        if (!cancelled) setLoaded({ id: file.id, url, mime: blob.type || file.mime });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoaded({ id: file.id, error: err instanceof Error ? err.message : "The scan could not be opened." });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, file.mime]);

  const current = loaded && loaded.id === file.id ? loaded : null;
  if (!current) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center gap-2 text-xs text-ink-muted">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Opening the scan…
      </div>
    );
  }
  if ("error" in current) {
    return (
      <div role="alert" className="flex h-full min-h-64 items-center justify-center gap-2 text-xs text-danger">
        <TriangleAlert aria-hidden className="h-4 w-4" /> {current.error}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-line bg-surface-sunken">
        {current.mime === "application/pdf" ? (
          <iframe title={file.name} src={current.url} className="h-full min-h-[60vh] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a blob: URL, not an optimisable image
          <img src={current.url} alt={file.name} className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-2xs text-ink-muted">
        <span className="min-w-0 truncate">
          {file.name} · {fileSizeText(file.size)}
        </span>
        <a
          href={current.url}
          download={file.name}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-2xs font-medium text-ink hover:bg-surface-sunken"
        >
          <Download aria-hidden className="h-3.5 w-3.5" /> Download
        </a>
      </div>
    </div>
  );
}

/** A document's scan in a window (front and back are in the one file). */
export function DocumentViewer({ open, title, file, onClose }: { open: boolean; title: string; file: DocumentFileRef | null; onClose: () => void }) {
  return (
    <Window open={open && !!file} onClose={onClose} title={title} size="lg" footer={<WindowButton onClick={onClose}>Close</WindowButton>}>
      {file && <ScanPreview key={file.id} file={file} />}
    </Window>
  );
}

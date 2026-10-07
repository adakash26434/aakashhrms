"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/kit/avatar";
import { GridField } from "@/components/kit/form-grid";
import { ImageCropWindow } from "@/components/kit/image-crop-window";
import { photoUrl } from "@/lib/engines/employee-document.engine";
import { PHOTO_SOURCE_MAX_BYTES } from "@/lib/types/employee-document";
import { label, type EmployeeFormApi } from "./employee-form-fields";

const discardUpload = (id: string) => void fetch(photoUrl(id) as string, { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);

/**
 * The employee's photo (4.2b): choose an image, crop it to a square, and it uploads as a
 * 512 x 512 JPG; it is kept with the employee when the form is saved. Remove clears it.
 */
export function EmployeePhotoField({ api }: { api: EmployeeFormApi }) {
  const { form, set, ctx } = api;
  const input = useRef<HTMLInputElement>(null);
  // Uploads made on this page and not saved yet: replacing or removing one deletes it.
  const staged = useRef(new Set<string>());
  const [source, setSource] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const choose = (file: File) => {
    setError("");
    if (!file.type.startsWith("image/")) return setError("Choose a photo (JPG, PNG or WebP).");
    if (file.size > PHOTO_SOURCE_MAX_BYTES) return setError("The image is larger than 10 MB.");
    setSource(file);
  };

  const replaceWith = (id: string) => {
    if (form.photoId && staged.current.has(form.photoId)) {
      staged.current.delete(form.photoId);
      discardUpload(form.photoId);
    }
    set("photoId", id);
  };

  const upload = async (blob: Blob) => {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", blob, "photo.jpg");
      const query = ctx.employeeId ? `?employee=${encodeURIComponent(ctx.employeeId)}` : "";
      const res = await fetch(`/api/employees/photos${query}`, { method: "POST", body, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { success: boolean; data?: { id: string }; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) {
        setError(json?.error ?? "The photo could not be uploaded. Try again.");
        return;
      }
      staged.current.add(json.data.id);
      replaceWith(json.data.id);
      setSource(null);
    } catch {
      setError("The photo could not be uploaded. Check the connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <GridField label={label("photoId")} error={error || api.errors.photoId} size="full" help="Any photo; you crop it to a square. Shown on the record, the quick view and self-service.">
      <div className="flex items-center gap-3">
        <Avatar name={form.fullName || "?"} src={photoUrl(form.photoId)} size="lg" />
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-enter-skip
            data-field-anchor="photoId"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-2xs font-medium text-ink hover:bg-surface-sunken disabled:cursor-wait disabled:opacity-60"
          >
            {uploading ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Camera aria-hidden className="h-3.5 w-3.5" />}
            {form.photoId ? "Change" : "Upload photo"}
          </button>
          {form.photoId && (
            <button
              type="button"
              data-enter-skip
              onClick={() => replaceWith("")}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-2xs font-medium text-ink-muted hover:bg-danger-subtle hover:text-danger"
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          tabIndex={-1}
          aria-hidden
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) choose(file);
          }}
        />
      </div>
      <ImageCropWindow file={source} title="Crop the photo" onCancel={() => setSource(null)} onDone={upload} />
    </GridField>
  );
}

// Employee photos (4.2b, S25): a 512 x 512 JPG cropped in the browser, uploaded before the
// form is saved and kept with the employee when it is. The routes in app/api/employees/photos
// check the request and the permission first.

import { createHash } from "node:crypto";
import * as repo from "@/lib/repositories/employee-photo.repository";
import { getEmployeeInScope } from "@/lib/services/employee.service";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { sniffFileType } from "@/lib/engines/employee-document.engine";
import { PHOTO_MAX_BYTES } from "@/lib/types/employee-document";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import { isUuid } from "@/lib/utils/uuid";

/** Unsaved photo uploads one user may have at a time (each kept a day). */
export const MAX_STAGED_PHOTOS_PER_USER = 5;

/** Stores a cropped photo for a form not saved yet: JPEG or PNG by content, at most 1 MB. */
export async function uploadPhoto(input: { bytes: Uint8Array; employeeId: string | null }, scope: ScopeFilter): Promise<{ id: string }> {
  if (input.employeeId !== null) {
    const employee = await getEmployeeInScope(input.employeeId, scope, "EDIT");
    if (!employee) throw new UserFacingError("Employee not found.");
  }
  if (input.bytes.length === 0) throw new UserFacingError("The photo is empty.");
  if (input.bytes.length > PHOTO_MAX_BYTES) throw new UserFacingError("The photo is larger than 1 MB.");
  const mime = sniffFileType(input.bytes);
  if (mime !== "image/jpeg" && mime !== "image/png") throw new UserFacingError("Only a JPG or PNG photo can be used.");

  await repo.pruneStagedPhotos();
  if ((await repo.countStagedPhotosBy(scope.userId)) >= MAX_STAGED_PHOTOS_PER_USER) {
    throw new UserFacingError("Too many photos are waiting to be saved. Save the form first, or try again later.");
  }
  const content = Buffer.from(input.bytes);
  const id = await repo.insertStagedPhoto({
    mimeType: mime,
    sizeBytes: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
    content,
    uploadedBy: scope.userId,
  });
  await recordAuditLog({
    userId: scope.userId,
    action: "ADD",
    module: "EMPLOYEES",
    recordId: input.employeeId,
    result: "SUCCESS",
    newValues: { photo: "uploaded", photoId: id, sizeBytes: content.length, mimeType: mime },
  });
  return { id };
}

/** Who is asking for a photo: an Employees viewer with a scope, or a signed-in employee (their own photo only). */
export type PhotoViewer = { kind: "scope"; scope: ScopeFilter } | { kind: "self"; userId: string; employeeId: string };

/**
 * A photo's bytes for someone who may see it: a saved photo needs the employee in the viewer's
 * scope, or to be the viewer's own (self-service); an unsaved one only its uploader. Null
 * otherwise (the route answers 404 either way). Not audited: photos show on every pane.
 */
export async function openPhoto(photoId: unknown, viewer: PhotoViewer): Promise<{ mime: string; content: Buffer } | null> {
  if (!isUuid(photoId)) return null;
  const meta = await repo.findPhotoMeta(photoId);
  if (!meta) return null;
  if (meta.employeeId === null) {
    const userId = viewer.kind === "scope" ? viewer.scope.userId : viewer.userId;
    if (meta.uploadedBy !== userId) return null;
  } else if (viewer.kind === "self") {
    if (meta.employeeId !== viewer.employeeId) return null;
  } else {
    const employee = await getEmployeeInScope(meta.employeeId, viewer.scope, "VIEW");
    if (!employee) return null;
  }
  const content = await repo.findPhotoContent(meta.id);
  if (!content) return null;
  return { mime: meta.mimeType, content };
}

/** Removes a photo upload that was not saved, only for the person who uploaded it. */
export async function discardPhoto(photoId: unknown, userId: string): Promise<boolean> {
  if (!isUuid(photoId)) return false;
  return repo.deleteStagedPhoto(photoId, userId);
}

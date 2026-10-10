// Employee document scans (4.2b, S25): upload before the form is saved, open with
// the employee's scope, discard an unsaved upload. The routes in
// app/api/employees/documents check the request and the permission first.

import { createHash } from "node:crypto";
import * as repo from "@/lib/repositories/employee-document.repository";
import { getEmployeeInScope } from "@/lib/services/employee.service";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import { safeFileName, sniffFileType } from "@/lib/engines/employee-document.engine";
import { DOCUMENT_MAX_BYTES, type DocumentFileRef } from "@/lib/types/employee-document";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import { isUuid } from "@/lib/utils/uuid";

/** Unsaved uploads one user may have at a time (each kept a day). */
export const MAX_STAGED_PER_USER = 10;

export interface ScanUpload {
  bytes: Uint8Array;
  name: string;
  /** The employee being edited; null on the New employee form. */
  employeeId: string | null;
}

/**
 * Stores a scan for a form that is not saved yet. The content decides the type
 * (PDF, JPEG or PNG only); the browser's type and the name are not trusted.
 */
export async function uploadScan(input: ScanUpload, scope: ScopeFilter): Promise<DocumentFileRef> {
  if (input.employeeId !== null) {
    const employee = await getEmployeeInScope(input.employeeId, scope, "EDIT");
    if (!employee) throw new UserFacingError("Employee not found.");
  }
  if (input.bytes.length === 0) throw new UserFacingError("The file is empty.");
  if (input.bytes.length > DOCUMENT_MAX_BYTES) throw new UserFacingError("The file is larger than 3 MB. Scan at a lower resolution or save it as JPG.");
  const mime = sniffFileType(input.bytes);
  if (!mime) throw new UserFacingError("Only PDF, JPG or PNG files can be attached.");

  await repo.pruneStaged();
  if ((await repo.countStagedBy(scope.userId)) >= MAX_STAGED_PER_USER) {
    throw new UserFacingError("Too many scans are waiting to be saved. Save the form first, or remove some.");
  }

  const content = Buffer.from(input.bytes);
  const ref = await repo.insertStagedFile({
    employeeId: input.employeeId,
    fileName: safeFileName(input.name, mime),
    mimeType: mime,
    sizeBytes: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
    content,
    uploadedBy: scope.userId,
  });
  // Ids, side, size and type only: never the content or the number on it.
  await recordAuditLog({
    userId: scope.userId,
    action: "ADD",
    module: "EMPLOYEES",
    recordId: input.employeeId,
    result: "SUCCESS",
    newValues: { scan: "uploaded", fileId: ref.id, sizeBytes: ref.size, mimeType: ref.mime },
  });
  return ref;
}

export interface OpenedScan {
  name: string;
  mime: string;
  content: Buffer;
}

/**
 * A scan's content for someone who may see it: a saved scan needs the employee in
 * the user's scope; an unsaved one is visible only to whoever uploaded it.
 * Null for anything else (the route answers 404 either way).
 */
export async function openScan(fileId: unknown, scope: ScopeFilter): Promise<OpenedScan | null> {
  if (!isUuid(fileId)) return null;
  const meta = await repo.findFileMeta(fileId);
  if (!meta) return null;
  if (meta.documentId === null && meta.attachedTo === null) {
    if (meta.uploadedBy !== scope.userId) return null;
  } else {
    if (!meta.employeeId) return null;
    const employee = await getEmployeeInScope(meta.employeeId, scope, "VIEW");
    if (!employee) return null;
  }
  const content = await repo.findFileContent(meta.id);
  if (!content) return null;
  await recordAuditLog({
    userId: scope.userId,
    action: "VIEW",
    module: "EMPLOYEES",
    recordId: meta.employeeId,
    result: "SUCCESS",
    newValues: { scan: "opened", fileId: meta.id },
  });
  return { name: meta.fileName, mime: meta.mimeType, content };
}

/** Removes an upload that was not saved, only for the person who uploaded it. */
export async function discardScan(fileId: unknown, scope: ScopeFilter): Promise<boolean> {
  if (!isUuid(fileId)) return false;
  return repo.deleteStagedFile(fileId, scope.userId);
}

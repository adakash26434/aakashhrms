import { randomUUID } from "node:crypto";
import { and, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { employeePhotos } from "@/lib/db/schema";
import { UserFacingError } from "@/lib/errors/action-error";
import { stagedSince, type Tx } from "./employee-document.repository";

/** Photo columns without the content (S25). */
const PHOTO_META = {
  id: employeePhotos.id,
  employeeId: employeePhotos.employeeId,
  mimeType: employeePhotos.mimeType,
  sizeBytes: employeePhotos.sizeBytes,
  uploadedBy: employeePhotos.uploadedBy,
  uploadedAt: employeePhotos.uploadedAt,
};

export type PhotoMeta = { id: string; employeeId: string | null; mimeType: string; sizeBytes: number; uploadedBy: string; uploadedAt: Date };

/** Photo id per employee (saved photos only), for the register and the record. */
export async function photoIdsByEmployee(): Promise<Map<string, string>> {
  const rows = await (await getDb()).select({ id: employeePhotos.id, employeeId: employeePhotos.employeeId }).from(employeePhotos).where(isNotNull(employeePhotos.employeeId));
  return new Map(rows.map((r) => [r.employeeId as string, r.id]));
}

export async function findPhotoIdFor(employeeId: string): Promise<string | null> {
  const [row] = await (await getDb()).select({ id: employeePhotos.id }).from(employeePhotos).where(eq(employeePhotos.employeeId, employeeId)).limit(1);
  return row?.id ?? null;
}

export async function countStagedPhotosBy(userId: string): Promise<number> {
  const [row] = await (await getDb())
    .select({ n: sql<number>`count(*)::int` })
    .from(employeePhotos)
    .where(and(isNull(employeePhotos.employeeId), eq(employeePhotos.uploadedBy, userId), gt(employeePhotos.uploadedAt, stagedSince())));
  return Number(row?.n ?? 0);
}

/** Photos never saved with a form are removed after a day. */
export async function pruneStagedPhotos(): Promise<void> {
  await (await getDb()).delete(employeePhotos).where(and(isNull(employeePhotos.employeeId), lt(employeePhotos.uploadedAt, stagedSince())));
}

export async function insertStagedPhoto(photo: { mimeType: string; sizeBytes: number; sha256: string; content: Buffer; uploadedBy: string }): Promise<string> {
  const id = randomUUID();
  await (await getDb()).insert(employeePhotos).values({ id, employeeId: null, ...photo });
  return id;
}

export async function deleteStagedPhoto(id: string, userId: string): Promise<boolean> {
  const rows = await (await getDb())
    .delete(employeePhotos)
    .where(and(eq(employeePhotos.id, id), isNull(employeePhotos.employeeId), eq(employeePhotos.uploadedBy, userId)))
    .returning({ id: employeePhotos.id });
  return rows.length > 0;
}

export async function findPhotoMeta(id: string): Promise<PhotoMeta | undefined> {
  const [row] = await (await getDb()).select(PHOTO_META).from(employeePhotos).where(eq(employeePhotos.id, id)).limit(1);
  return row;
}

/** The only query that reads a photo's bytes (the image route). */
export async function findPhotoContent(id: string): Promise<Buffer | undefined> {
  const [row] = await (await getDb()).select({ content: employeePhotos.content }).from(employeePhotos).where(eq(employeePhotos.id, id)).limit(1);
  return row?.content;
}

/**
 * Sets the employee's photo to `photoId` ("" = none), inside the employee's save transaction.
 * The old photo is deleted; a new one is attached only when it is this user's own unsaved
 * upload from the last day. Anything else stops the whole save.
 */
export async function savePhotoTx(tx: Tx, employeeId: string, photoId: string, userId: string): Promise<void> {
  const [current] = await tx.select({ id: employeePhotos.id }).from(employeePhotos).where(eq(employeePhotos.employeeId, employeeId)).limit(1);
  if ((current?.id ?? "") === photoId) return;
  // The photo it had (replaced or removed); only ever this employee's own row.
  if (current) await tx.delete(employeePhotos).where(and(eq(employeePhotos.id, current.id), eq(employeePhotos.employeeId, employeeId)));
  if (!photoId) return;
  const claimed = await tx
    .update(employeePhotos)
    .set({ employeeId })
    .where(and(eq(employeePhotos.id, photoId), isNull(employeePhotos.employeeId), eq(employeePhotos.uploadedBy, userId), gt(employeePhotos.uploadedAt, stagedSince())))
    .returning({ id: employeePhotos.id });
  if (claimed.length === 0) throw new UserFacingError("The photo has expired or can't be used. Upload it again and save.");
}
